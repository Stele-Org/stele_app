'use strict';
const {app, BrowserWindow, screen} = require('electron');
// BRIO: Chromium Media Foundation aborts on venue PC; verified DirectShow capture.
app.commandLine.appendSwitch('disable-features', 'MediaFoundationVideoCapture');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const fs = require('node:fs');
const path = require('node:path');
const {createCameraLog} = require('./camera-diagnostics.cjs');
const {selectPortraitDisplay, sameBounds} = require('./display-policy.cjs');
let win, logCount = 0, closing = false, ready = false, applying = false, pending = false, scheduleTimer;
function diagnostic(event, detail) {
  if (logCount++ < 100) console.error(JSON.stringify({component:'stella-kiosk', event, detail:String(detail?.stack ?? detail ?? '').slice(0,2048)}));
}
process.on('uncaughtException', error => {diagnostic('fatal',error); app.exit(1);});
process.on('unhandledRejection', error => {diagnostic('fatal',error); app.exit(1);});
const index = process.argv.indexOf('--root');
if (index < 0 || !process.argv[index+1]) throw Error('Managed STELLA package --root required');
if (process.versions.electron !== '44.4.5') throw Error('Pinned Electron 44.4.5 required');
const root = fs.realpathSync(process.argv[index+1]);
const cameraLog=createCameraLog(path.join(root,'data','stella-camera-debug.jsonl'));
cameraLog({event:'kiosk.boot',electron:process.versions.electron,chrome:process.versions.chrome,captureBackend:'DirectShow'});
const confined = file => {
  const relative = path.relative(root,fs.realpathSync(file));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('STELLA path outside package');
  return file;
};
const configPath = confined(path.join(root,'config/node.json'));
if (fs.statSync(configPath).size > 32768) throw Error('Invalid node config size');
const config = JSON.parse(fs.readFileSync(configPath,'utf8'));
if (config.schemaVersion !== 1 || config.role !== 'STELLA' || !Number.isInteger(config.uiPort) || config.uiPort < 1024 || config.uiPort > 65535) throw Error('STELLA role and valid uiPort required');
const data = path.join(root,'data'); fs.mkdirSync(data,{recursive:true}); confined(data);
const profile = path.join(data,'stella-kiosk'); fs.mkdirSync(profile,{recursive:true}); confined(profile);
app.setPath('userData',profile);
const origin = `http://127.0.0.1:${config.uiPort}`;
const entry = origin+'/stella/?master=1';
const sameOrigin = value => {try {return new URL(value).origin === origin;} catch {return false;}};
const allowedPage = value => {try {const u = new URL(value); return u.origin === origin && u.pathname === '/stella/' && u.searchParams.get('master') === '1';} catch {return false;}};
const owns = wc => !!win && !win.isDestroyed() && wc === win.webContents && allowedPage(wc.getURL());
function presentationState() {
  return {fullscreen:win.isFullScreen(),kiosk:win.isKiosk(),visible:win.isVisible(),bounds:win.getBounds(),mappedDisplayId:screen.getDisplayMatching(win.getBounds()).id};
}
function saveStatus(reason, target, beforeHide = null) {
  const status = {timestamp:new Date().toISOString(), pid:process.pid, reason,
    url:win.webContents.getURL(), audioMuted:win.webContents.isAudioMuted(), ...presentationState(), beforeHide,
    display:target ? {id:target.id,label:target.label,bounds:target.bounds,scaleFactor:target.scaleFactor,rotation:target.rotation} : null};
  const destination = path.join(data,'stella-kiosk-status.json');
  if (fs.existsSync(destination)) confined(destination);
  fs.writeFileSync(destination,JSON.stringify(status,null,2)+'\n');
}
function fullscreen(value) {
  if (win.isFullScreen() === value) return Promise.resolve();
  return new Promise((resolve,reject) => {
    const event = value ? 'enter-full-screen' : 'leave-full-screen';
    let timer;
    const done = () => {clearTimeout(timer); win.removeListener(event,done); resolve();};
    win.once(event,done);
    timer = setTimeout(() => {win.removeListener(event,done); reject(Error(`Fullscreen transition timed out: ${value}`));},3000);
    win.setFullScreen(value);
  });
}
async function verifyPresentation(target) {
  const deadline=Date.now()+3000;
  do {
    if (closing || win.isDestroyed()) throw Error('Kiosk closed during presentation');
    const current=selectPortraitDisplay(screen.getAllDisplays(),config.stellaDisplayId);
    if (current.id!==target.id || !sameBounds(current.bounds,target.bounds)) throw Error('Portrait topology changed during presentation');
    if (win.isVisible() && win.isFullScreen() && win.isKiosk() &&
      screen.getDisplayMatching(win.getBounds()).id===target.id && sameBounds(win.getBounds(),target.bounds)) return;
    await new Promise(resolve=>setTimeout(resolve,50));
  } while(Date.now()<deadline);
  throw Error('Kiosk presentation not confirmed: visible/fullscreen/kiosk/bounds');
}
async function reconcile() {
  if (closing || !win || win.isDestroyed()) return;
  if (applying) {pending=true; return;}
  applying=true;
  try {
    const target = selectPortraitDisplay(screen.getAllDisplays(),config.stellaDisplayId);
    // Loading must never wait for a native transition on an initially hidden HWND.
    if (!ready) {saveStatus('preparing',target); return;}
    const mapped = screen.getDisplayMatching(win.getBounds());
    if (mapped.id !== target.id || !sameBounds(win.getBounds(),target.bounds)) {
      // Leave fullscreen before positioning: Windows otherwise keeps the old display.
      win.setKiosk(false);
      await fullscreen(false);
      win.setPosition(target.bounds.x,target.bounds.y,false);
      win.setBounds({...target.bounds},false);
    }
    // Show on the selected portrait display before changing native window mode.
    // Do not hide an already valid window: hiding here can suppress initial painting.
    if (!win.isVisible()) win.show();
    await fullscreen(true);
    if (!win.isKiosk()) win.setKiosk(true);
    // Windows may change visibility during the native mode transition. Re-show
    // afterward (as in the original working kiosk), and never accept hidden ready.
    if (win.isMinimized()) win.restore();
    win.show();
    // Display topology may have changed during a native fullscreen transition.
    const current = selectPortraitDisplay(screen.getAllDisplays(),config.stellaDisplayId);
    if (current.id !== target.id || !sameBounds(current.bounds,target.bounds)) {pending=true; return;}
    if (screen.getDisplayMatching(win.getBounds()).id !== target.id || !sameBounds(win.getBounds(),target.bounds)) throw Error('Native kiosk bounds do not match target display');
    await verifyPresentation(target);
    win.focus();
    saveStatus('portrait-ready',target);
  } catch (error) {
    if (!closing && win && !win.isDestroyed()) {
      const beforeHide=presentationState();
      diagnostic('presentation-before-hide',JSON.stringify({pid:process.pid,...beforeHide}));
      win.hide(); diagnostic('portrait-unavailable',error); saveStatus('portrait-unavailable',null,beforeHide);
    }
  } finally {
    applying=false;
    if (pending && !closing) {pending=false; scheduleReconcile();}
  }
}
function scheduleReconcile() {
  if (closing) return;
  clearTimeout(scheduleTimer);
  scheduleTimer=setTimeout(() => void reconcile(),120);
}
function waitForPortrait() {
  return new Promise(resolve => {
    const events=['display-added','display-removed','display-metrics-changed'];
    let warned=false;
    const dispose=() => {for (const event of events) screen.removeListener(event,check); app.removeListener('before-quit',dispose);};
    const check=() => {
      if (closing) return;
      try {
        const target=selectPortraitDisplay(screen.getAllDisplays(),config.stellaDisplayId);
        dispose(); resolve(target);
      } catch (error) {if (!warned) {warned=true; diagnostic('waiting-for-portrait',error);}}
    };
    for (const event of events) screen.on(event,check);
    app.once('before-quit',dispose);
    check();
  });
}
const acquired=app.requestSingleInstanceLock();
if (!acquired) app.quit();
else {
  app.on('before-quit',() => {closing=true; clearTimeout(scheduleTimer);});
  app.on('second-instance',() => {if (win && !win.isDestroyed() && win.isMinimized()) win.restore(); scheduleReconcile();});
  app.on('window-all-closed',() => app.quit());
  app.whenReady().then(async () => {
    // Wait for a portrait monitor after boot; never open on a landscape fallback.
    const target = await waitForPortrait();
    // Electron 44 Windows: thickFrame:false bypasses widget()->SetFullscreen and
    // only resizes bounds; isFullScreen/isKiosk never become true on that path.
    win = new BrowserWindow({...target.bounds,show:false,fullscreen:false,kiosk:false,frame:false,thickFrame:true,
      backgroundColor:'#050514',autoHideMenuBar:true,
      webPreferences:{partition:'persist:stella-kiosk',nodeIntegration:false,contextIsolation:true,sandbox:true,
        webSecurity:true,backgroundThrottling:false,devTools:false}});
    win.webContents.setAudioMuted(true);
    win.setMenu(null);
    const session = win.webContents.session;
    session.setPermissionCheckHandler((wc,permission,requestingOrigin,details) => {
      const allowed=owns(wc) && permission==='media' && sameOrigin(requestingOrigin) && details?.isMainFrame===true && details?.mediaType==='video';
      if(permission==='media') cameraLog({event:'permission.check',permission,owned:owns(wc),originMatches:sameOrigin(requestingOrigin),isMainFrame:details?.isMainFrame??null,mediaType:details?.mediaType??null,allowed});
      return allowed;
    });
    session.setPermissionRequestHandler((wc,permission,callback,details) => {
      const allowed=owns(wc) && permission==='media' && details?.isMainFrame===true && sameOrigin(details.requestingUrl) && Array.isArray(details.mediaTypes) && details.mediaTypes.length>0 && details.mediaTypes.every(type => type==='video');
      if(permission==='media') cameraLog({event:'permission.request',permission,owned:owns(wc),originMatches:sameOrigin(details?.requestingUrl),isMainFrame:details?.isMainFrame??null,mediaTypes:details?.mediaTypes??null,allowed});
      callback(allowed);
    });
    session.setDevicePermissionHandler(() => false);
    win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    win.webContents.on('will-navigate',(event,url) => {if (!allowedPage(url)) event.preventDefault();});
    win.webContents.on('will-redirect',(event,url) => {if (!allowedPage(url)) event.preventDefault();});
    win.webContents.on('will-attach-webview',event => event.preventDefault());
    win.webContents.on('console-message',event => {
      if(typeof event.message==='string' && event.message.startsWith('[stella-camera]')){
        try {const data=JSON.parse(event.message.slice('[stella-camera]'.length).trim());if(typeof data.event==='string')cameraLog(data);}catch{}
      }
      if (event.level==='error') diagnostic('console',event.message);
    });
    win.webContents.on('render-process-gone',(_event,details) => {diagnostic('renderer-exit',details.reason); app.exit(1);});
    win.webContents.on('did-fail-load',(_event,code,description,_url,isMainFrame) => {if (isMainFrame && code!==-3) {diagnostic('load-failed',`${code}: ${description}`); app.exit(1);}});
    win.webContents.on('before-input-event',(event,input) => {
      if (input.key==='F11' || input.key==='F12' || ((input.control || input.meta) && ['+','-','=','0'].includes(input.key))) event.preventDefault();
    });
    win.webContents.setZoomFactor(1);
    void win.webContents.setVisualZoomLevelLimits(1,1).catch(error => diagnostic('zoom-limit',error));
    const pageReady=() => {if (!ready) {ready=true; scheduleReconcile();}};
    win.once('ready-to-show',pageReady);
    // On some Windows/GPU combinations the hidden window never emits ready-to-show.
    // A loaded local page is a deterministic fallback; the dark background is configured.
    win.webContents.once('did-finish-load',pageReady);
    win.on('leave-full-screen',() => {if (!applying) scheduleReconcile();});
    win.on('restore',scheduleReconcile);
    win.once('closed',() => {closing=true; clearTimeout(scheduleTimer);});
    for (const event of ['display-added','display-removed','display-metrics-changed']) screen.on(event,scheduleReconcile);
    await reconcile();
    await win.loadURL(entry);
    diagnostic('page-loaded',entry);
  }).catch(error => {diagnostic('startup',error); app.exit(1);});
}
