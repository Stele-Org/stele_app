// Single editable source of the active CUBES art values. Loaded once per page,
// uncached; a refresh picks up JSON edits without rebuilding the shader bundle.
const ART_URL = new URL('./cubes-art.json', import.meta.url);

export function packCubesArt(art) {
  const value = (v, name) => {
    if (!Number.isFinite(v)) throw Error(`CUBES art: ${name} must be finite`);
    return v;
  };
  const pair = (p, name) => {
    if (!Array.isArray(p) || p.length !== 2) throw Error(`CUBES art: ${name} must be a pair`);
    return p.map((v, i) => value(v, `${name}[${i}]`));
  };
  if (art?.version !== 1) throw Error('CUBES art: unsupported JSON version');
  const m = art.mask, c = art.color;
  if (!m || !c) throw Error('CUBES art: mask and color sections are required');
  const noise = (n, name) => [value(n.scale, `${name}.scale`), value(n.speed, `${name}.speed`), ...pair(n.offset, `${name}.offset`)];
  const rows = [
    noise(m.broad, 'mask.broad'), noise(m.medium, 'mask.medium'),
    noise(m.small, 'mask.small'), noise(m.fine, 'mask.fine'),
    [...pair(m.drift, 'mask.drift'), value(m.ramp.speed, 'mask.ramp.speed'), value(m.ramp.period, 'mask.ramp.period')],
    [value(m.warp.scale, 'mask.warp.scale'), value(m.warp.speed, 'mask.warp.speed'), value(m.warp.strength, 'mask.warp.strength'), 0],
    [...pair(m.warp.offsetA, 'mask.warp.offsetA'), ...pair(m.warp.offsetB, 'mask.warp.offsetB')],
    [m.mix.bias, m.mix.broad, m.mix.medium, m.mix.fine],
    [m.mix.small, m.mix.detail, m.mix.tile, m.transfer.cap],
    [m.transfer.noiseLow, m.transfer.noiseHigh, m.transfer.rampLow, m.transfer.rampHigh],
    [m.transfer.crestLow, m.transfer.crestHigh, m.variation.detail, m.variation.tile],
    noise(m.detail, 'mask.detail'),
    [m.ramp.fallEnd, m.ramp.zeroEnd, m.ramp.riseEnd, 0],
    [m.variation.base, m.variation.min, m.variation.max, 0],
    [m.broad.timeOffset, m.medium.timeOffset, m.small.timeOffset, m.fine.timeOffset],
    [m.geometry.sizeGain, m.geometry.springSize, m.geometry.maxSize, m.geometry.liftBase],
    [m.geometry.liftSpring, m.geometry.springDecay, m.geometry.springFrequency, 0],
    noise(c.broad, 'color.broad'), noise(c.medium, 'color.medium'),
    [c.mix.bias, c.mix.broad, c.mix.medium, c.mix.tile],
    [c.brightness.base, c.brightness.tile, m.seed, 0]
  ];
  if (rows.some(row => row.length !== 4 || row.some(v => !Number.isFinite(v))))
    throw Error('CUBES art: every packed value must be finite');
  if (!(Number.isInteger(m.seed) && m.seed >= 0 && m.seed <= 1000000 &&
        m.transfer.cap >= 0.7 && m.transfer.cap <= 0.9 &&
        m.transfer.noiseLow < m.transfer.noiseHigh &&
        m.transfer.rampLow < m.transfer.rampHigh &&
        m.transfer.crestLow < m.transfer.crestHigh &&
        0 < m.ramp.fallEnd && m.ramp.fallEnd < m.ramp.zeroEnd &&
        m.ramp.zeroEnd < m.ramp.riseEnd && m.ramp.riseEnd < 1 &&
        m.variation.min <= m.variation.max && m.variation.min >= 0 &&
        m.geometry.maxSize > 0 && m.ramp.period > 0 && m.warp.scale > 0 &&
        [m.broad, m.medium, m.small, m.fine, m.detail, c.broad, c.medium].every(n => n.scale > 0)))
    throw Error('CUBES art: invalid range or threshold order');
  return new Float32Array(rows.flat());
}

export function packCubesJunctionRing(art) {
  const r=art?.rearJunctionRing;
  if(!r)return null;
  const size=r.canvasPx,center=r.centerPx;
  if(!Array.isArray(size)||size.length!==2||!Array.isArray(center)||center.length!==2||
     ![...size,...center,r.radiusPx,r.widthPx,r.darkRadiusPx,r.pulseHz,r.excursionPx].every(Number.isFinite)||
     size[0]<=0||size[1]<=0||center[0]<0||center[0]>size[0]||center[1]<0||center[1]>size[1]||
     r.radiusPx<=0||r.widthPx<=0||r.darkRadiusPx<=0||r.darkRadiusPx>=r.radiusPx||
     r.pulseHz<0||r.excursionPx<0||r.excursionPx>=r.radiusPx-r.darkRadiusPx)
    throw Error('CUBES art: invalid rear junction ring');
  return [[1,center[0]/size[0],center[1]/size[1],r.radiusPx/size[1]],
          [r.widthPx/size[1],r.darkRadiusPx/size[1],r.pulseHz,r.excursionPx/size[1]]];
}

export async function loadCubesArtDocument() {
  const response = await fetch(ART_URL, {cache: 'no-store'});
  if (!response.ok) throw Error(`CUBES art: HTTP ${response.status} loading ${ART_URL}`);
  return response.json();
}

export async function loadCubesArt() {return packCubesArt(await loadCubesArtDocument());}
