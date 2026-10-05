'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {waitForLocalUi}=require('./ui-ready.cjs');
const shell=fs.realpathSync(__dirname),root=fs.realpathSync(path.resolve(shell,'../..'));
if(path.resolve(root,'app/stella-kiosk').toLowerCase()!==shell.toLowerCase())throw Error('Install shell only at ROLE/app/stella-kiosk');
const confined=file=>{const relative=path.relative(root,fs.realpathSync(file));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Path outside STELLA package');return file;};
const configPath=confined(path.join(root,'config/node.json'));
if(fs.statSync(configPath).size>32768)throw Error('Invalid node config size');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
if(config.schemaVersion!==1||config.role!=='STELLA'||!Number.isInteger(config.uiPort)||config.uiPort<1024||config.uiPort>65535)throw Error('STELLA role and valid uiPort required');
const electron=confined(path.join(root,'runtime/electron/electron.exe'));
if(fs.readFileSync(confined(path.join(root,'runtime/electron/version')),'utf8').trim()!=='44.4.5')throw Error('Pinned Electron 44.4.5 required');
const data=path.join(root,'data');fs.mkdirSync(data,{recursive:true});confined(data);
const log=(name)=>{const file=path.join(data,name);if(fs.existsSync(file))confined(file);return fs.openSync(file,'a');};
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.NODE_PATH;
async function launch(){
 const readiness=await waitForLocalUi(config.uiPort);
 console.log(JSON.stringify({state:'local-ui-ready',...readiness}));
 const stdout=log('stella-kiosk.stdout.log'),stderr=log('stella-kiosk.stderr.log');
try{
 const child=spawn(electron,[shell,'--root',root],{cwd:root,env,detached:true,windowsHide:true,stdio:['ignore',stdout,stderr]});
 child.once('error',error=>{console.error('STELLA shell spawn failed: '+error.message);process.exitCode=1;});
 child.once('spawn',()=>{fs.writeFileSync(path.join(data,'stella-kiosk-launch.json'),JSON.stringify({pid:child.pid,launchedAt:new Date().toISOString(),executable:electron,shell},null,2)+'\n');console.log(JSON.stringify({state:'spawned-not-verified',pid:child.pid,status:'data/stella-kiosk-status.json'}));child.unref();});
}finally{fs.closeSync(stdout);fs.closeSync(stderr);}
}
void launch().catch(error=>{console.error(error.message);process.exitCode=1;});
