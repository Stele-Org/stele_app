'use strict';

// Electron display bounds and window bounds use DIP, never raw Win32 pixels.
function selectPortraitDisplay(displays, requestedId) {
  const portrait = displays.filter(d => d.id >= 0 && d.bounds.width > 0 && d.bounds.height > d.bounds.width);
  if (requestedId !== undefined) {
    const selected = portrait.find(d => String(d.id) === String(requestedId));
    if (!selected) throw Error('Configured portrait display is absent');
    return selected;
  }
  const native1080 = portrait.filter(d => {
    const scale = Number(d.scaleFactor) || 1;
    return Math.abs(d.bounds.width * scale - 1080) <= 2 && Math.abs(d.bounds.height * scale - 1920) <= 2;
  });
  if (native1080.length === 1) return native1080[0];
  if (portrait.length === 1) return portrait[0];
  throw Error(portrait.length ? 'Multiple portrait displays: configure stellaDisplayId' : 'Portrait display is absent');
}

function sameBounds(a, b) {
  return ['x', 'y', 'width', 'height'].every(key => Math.abs(a[key] - b[key]) <= 1);
}

module.exports = {selectPortraitDisplay, sameBounds};
