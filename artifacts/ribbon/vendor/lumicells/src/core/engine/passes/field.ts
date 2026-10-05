import { DISCOVERY_CUTOUT_GLSL } from '../../../../../../discovery-cutout.js';
import {TD_MORPH_GLSL,initTdMorph,uploadTdMorph} from './td-morph';
/**
 * Field pass (MRT, one fragment per cell incl. pad): evaluates the weighted modes, shapes the
 * intensity (gamma, flicker, sparsity, sparkles), applies influences, pulses and lift sockets,
 * and maps the result to a palette position.
 *
 * fieldA (HDR): rgb = linear base color, a = intensity (socket-dimmed).
 * fieldB (RGBA8): r = palette t, g = hot amount, b = dead-cell visibility,
 *                 a = intensity before socket dimming / 2 (read by the lift pass for gating).
 * bloom (third attachment, HDR): the bloom source (thresholded, fill-scaled emission), computed
 *                 here from the unencoded values instead of in a prefilter pass of its own.
 */

import { FULLSCREEN_VS } from '../glsl/common';
import { INFLUENCE_GLSL } from '../glsl/influence';
import { MODE_STRUCT_GLSL, MODES_EVAL_GLSL, MODES_GLSL } from '../glsl/modes/index';
import { NOISE_GLSL } from '../glsl/noise';
import { CUBES_MASK_GLSL } from '../glsl/cubes-mask';
import { BLOOM_SOURCE_GLSL } from './bloom';
import {
  bindTexture,
  discardTargets,
  LazyProgram,
  type PassContext,
  setSampler,
  UNIT_LIFE,
  UNIT_LUT,
} from './shared';

function fieldFs(header: string, cubeMask: boolean, scenarioParameters: boolean, cubeGeometry: boolean, profile = ''): string {
  return `${header}
${NOISE_GLSL}
${cubeMask ? CUBES_MASK_GLSL : ''}
uniform sampler2D u_life;
uniform sampler2D u_lut;
uniform sampler2D u_inputA,u_inputB,u_body;
uniform sampler2D u_tdMask;
uniform sampler2D u_rowStream;
uniform float u_rowStreamEnabled;
${DISCOVERY_CUTOUT_GLSL}
${TD_MORPH_GLSL}
uniform vec4 u_tdMaskInfo; // full global lattice width/height, fresh snapshot, reserved
uniform float u_tdProceduralEnvelope;
uniform vec4 u_tdPhysicalRect,u_tdColorRect;
uniform vec2 u_tdOffset;
uniform vec4 u_inputCrop,u_bodyCrop;
uniform vec2 u_inputMap;
uniform float u_inputMix,u_bodyAlive,u_inputEnabled,u_inputLocal;
uniform vec4 u_maskPair; // parent pitch, fine flag, large zero, fine zero (raw M)
uniform vec4 u_brand; // enabled, start/end normalised, purple amount
uniform vec4 u_jointRing0; // enabled, rear-wall UV center, radius in wall-height units
uniform vec4 u_jointRing1; // band width, dark-core radius, pulse Hz, radius excursion
layout(location = 0) out vec4 o_fieldA;
layout(location = 1) out vec4 o_fieldB;
layout(location = 2) out vec4 o_bloom;
${INFLUENCE_GLSL}
${BLOOM_SOURCE_GLSL}
${MODE_STRUCT_GLSL}
${MODES_GLSL}

struct Mix { float scr; float over; float sum; float mx; float w; float env; float accent; };

// Gate residual floor/sparkles and their emission before independent row streams enter.
void applyDiscovery(float keep) {
  if(keep>=1.)return;
  vec4 field=dec4(o_fieldA);field.a*=keep;o_fieldA=enc4(field);
  ${cubeGeometry ? '' : 'o_fieldB.b*=keep;'}
  o_fieldB.a*=keep;
  vec4 bloom=dec4(o_bloom);bloom.rgb*=keep;o_bloom=enc4(bloom);
}

void applyRowStream(ivec2 cell) {
  if(u_rowStreamEnabled<0.5)return;
  vec4 line=texelFetch(u_rowStream,cell,0);
  if(line.a<=0.001)return;
  vec4 field=dec4(o_fieldA);
  field.rgb=mix(field.rgb,line.rgb/max(line.a,0.001),line.a);
  field.a=max(field.a,line.a*1.4);
  o_fieldA=enc4(field);
${scenarioParameters ? '  o_fieldB.r=max(o_fieldB.r,line.a);' : ''}
${scenarioParameters && cubeGeometry ? '  o_fieldB.b=0.0; o_fieldB.a=1.0;' : ''}
  vec4 bloom=dec4(o_bloom);
  o_bloom=enc4(vec4(max(bloom.rgb,bloomSource(field.rgb*field.a)),bloom.a));
}

void addMode(inout Mix x, float w, vec3 v) {
  float wi = w * max(v.x, 0.0);
  x.scr *= 1.0 - min(wi, 1.0);
  x.over += max(wi - 1.0, 0.0);
  x.sum += wi;
  x.mx = max(x.mx, wi);
  x.w += w;
  x.env = 1.0 - (1.0 - x.env) * (1.0 - sat(w * v.y));
  x.accent = max(x.accent, w * v.z);
}

// Per-cell value noise in time: aperiodic, smooth, identical at any frame rate. It doubles as the
// per-cell brightness variety: calm on the dense structure, twice as wide where the envelope
// thins out (the reference's outer band mixes bright and dim cells side by side).
float flickerF(uvec2 key, float h, float env) {
  float amt = P_animation_flicker_amount * (1.0 - 0.8 * f_clock.w)
            * (1.0 + 1.2 * (1.0 - smoothstep(0.3, 0.9, env)));
  amt = min(amt, 0.9);
  if (amt <= 0.001) return 1.0;
  // Each cell runs at k / FLICKER_RATE_STEPS (0.6..1.4) of the base phase. The whole part is
  // multiplied in integers: an EPOCH_WRAP jump of the base phase moves every cell by k whole
  // multiples of the cell's index period (EPOCH_WRAP / FLICKER_RATE_STEPS), so the wrap is
  // seamless, and the fraction keeps full precision.
  float q = float(FLICKER_RATE_STEPS);
  float k = floor((0.6 + 0.8 * h) * q + 0.5);
  uint pk = uint(f_epochB.x) * uint(k);
  float tt = (float(pk % FLICKER_RATE_STEPS) + f_epochB.y * k) / q + h * 7.0;
  float e = floor(tt);
  float f = tt - e;
  uint mask = EPOCH_MASK / FLICKER_RATE_STEPS;
  uint ue = (pk / FLICKER_RATE_STEPS + uint(e)) & mask;
  uint ue1 = (ue + 1u) & mask;
  float a = u01(hash3(uvec3(key.x ^ 0x68bc21ebu, key.y, ue)));
  float b = u01(hash3(uvec3(key.x ^ 0x68bc21ebu, key.y, ue1)));
  return 1.0 - amt * (1.0 - mix(a, b, f * f * (3.0 - 2.0 * f)));
}

// Sparsity: where the envelope is low, cells drop out (re-rolled every period, crossfaded over
// 0.4 s) instead of all dimming, and survivors get brighter and more varied: sparse, crisp
// outskirts. "vary" is the survivor's brightness factor (1 where nothing is killed).
float presenceF(uvec2 key, float h, float env, out float killP, out float vary) {
  // Calibrated on the reference: ~5% / 30% / 75% of cells out where the envelope is ~0.7 /
  // 0.45 / 0.1 at the default amount.
  killP = min(1.0, 1.45 * P_animation_sparsity_amount) * pow(1.0 - smoothstep(0.08, 0.9, env), 1.5);
  // Where the envelope is ~0 (far outskirts of a wide host) the survivors thin out to nothing, so
  // the edges read as clean navy instead of a uniform sprinkle of boosted cells.
  killP = mix(killP, sat(2.0 * P_animation_sparsity_amount), 1.0 - smoothstep(0.01, 0.1, env));
  vary = 1.0;
  if (killP <= 0.001) return 1.0;
  float period = max(P_animation_sparsity_period, 0.1);
  uint ue;
  float fr = epochAt(f_epochA.xy, h, ue);
  float x = smoothstep(period - 0.4, period, fr * period);
  uint ka = hash3(uvec3(key.x ^ 0x02e5be93u, key.y, ue));
  uint kb = hash3(uvec3(key.x ^ 0x02e5be93u, key.y, (ue + 1u) & EPOCH_MASK));
  float a = smoothstep(killP - 0.04, killP + 0.04, u01(ka));
  float b = smoothstep(killP - 0.04, killP + 0.04, u01(kb));
  vary = mix(1.0, mix(0.45 + 1.1 * u01(pcg(ka)), 0.45 + 1.1 * u01(pcg(kb)), x), sat(1.6 * killP));
  return mix(a, b, x);
}

// Event sparkles only inside the lit structure: fast attack, smooth release, never pure white.
float sparkleF(uvec2 key, float h, float I) {
  float rate = P_animation_sparkle_rate;
  if (rate <= 0.0 || P_animation_sparkle_amount <= 0.0) return 0.0;
  float D = max(P_animation_sparkle_duration, 0.05);
  uint ue;
  float x = epochAt(f_epochA.zw, h, ue);
  float fire = step(u01(hash3(uvec3(key.x ^ 0x2c1b3c6du, key.y, ue))), rate * D);
  float env = x < 0.3 ? smoothstep(0.0, 0.3, x) : sq((1.0 - x) / 0.7);
  return fire * env * smoothstep(0.2, 0.45, I) * (1.0 - f_clock.w);
}

// Spatial ramp calibration: at scale 1 / offset 0 the default ring runs from red (left) through
// violet to azure (right), with the far right fading into the palette's navy end.
#define SPATIAL_T0 0.45
#define SPATIAL_K 1.2
float mapT(float mode, vec2 p, float I, float cs) {
  float sc = P_color_scale;
  if (mode < 0.5) {
    // bend > 0 curves the color boundaries into arcs around the center: the ends of a boundary
    // drift toward the palette end, so the start color stays a crescent on one side.
    vec2 d = vec2(cos(P_color_angle), sin(P_color_angle));
    float across = dot(p, vec2(-d.y, d.x));
    return SPATIAL_T0 + 0.5 * SPATIAL_K * sc * (dot(p, d) + P_color_bend * across * across);
  }
  if (mode < 1.5) return length(p) * sc * 0.75;
  if (mode < 2.5) {
    // Mirrored so a non-cyclic palette has no seam; t = 0 toward color.angle.
    float u = fract((atan(p.y, p.x) - P_color_angle) / TAU + 1.0);
    return 0.5 + (0.5 - abs(2.0 * u - 1.0)) * sc;
  }
  if (mode < 3.5) return 0.5 + (I - 0.5) * sc;
  float fq = P_color_warpScale * 0.8;
  return 0.5 + 0.9 * sc * fbm3(vec3(p * fq + 13.0, f_clock.x * 0.0625), 3, fq * cs);
}

${profile}
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  float pitch = f_grid.z;
  vec2 cpx = f_origin.xy + (vec2(cell) + 0.5) * pitch;
${profile ? `
  vec4 sceneCell=profileField(cpx-f_host.xy,f_host.zw);
  o_fieldA=enc4(sceneCell);
  o_fieldB=vec4(0.0,0.0,0.0,sceneCell.a*0.5);
  o_bloom=enc4(vec4(bloomSource(sceneCell.rgb*sceneCell.a),1.0));
  return;
` : ''}
  float discoveryKeep=1.-discoveryCutout(cpx-f_host.xy,f_host.zw,pitch);
${cubeMask ? `
  {
  // One sampled cell equals one instanced tile, as in TD fit1/fit2 -> TOP to CHOP.
  // Global host coordinates keep the 3072/4096 rear crops phase-aligned.
  vec2 maskCell=vec2(cell);
  vec2 maskPx=cpx;
  if(u_maskPair.x>0.5){
    maskCell=floor((cpx-f_host.xy)/u_maskPair.x);
    maskPx=f_host.xy+(maskCell+0.5)*u_maskPair.x;
  }
  vec2 uv=(maskPx-f_host.xy)/max(f_host.zw,vec2(1.0));
  // The broad TD mask supplies the moving shape. A stable, independent value
  // per global cell breaks equal-sized/equal-colored runs without flicker.
  float detail=gnoise3(vec3((maskCell+0.5)*u_cubeArt[11].x+u_cubeArt[11].zw,f_clock.x*u_cubeArt[11].y));
  uint tileKey=hash2(uvec2(ivec2(maskCell)+ivec2(int(u_cubeArt[20].z))));
  float tileA=u01(tileKey),tileB=u01(pcg(tileKey^0x9e3779b9u));
  // Noise alone spans black through gray, never white. Only the intersection
  // of a strong noise region and the passing ramp can produce exact-one peaks.
  vec2 maskParts=cubesMaskPartsAt(uv,f_clock.x);
  float noiseSignal=maskParts.x+u_cubeArt[8].y*detail+u_cubeArt[8].z*(tileA-0.5);
  float noiseMask=u_cubeArt[8].w*cubesEase((noiseSignal-u_cubeArt[9].x)/(u_cubeArt[9].y-u_cubeArt[9].x));
  float rampCrest=cubesEase((maskParts.y-u_cubeArt[9].z)/(u_cubeArt[9].w-u_cubeArt[9].z));
  float noiseCrest=cubesEase((noiseMask-u_cubeArt[10].x)/(u_cubeArt[10].y-u_cubeArt[10].x));
  float mask=noiseMask+(1.0-noiseMask)*rampCrest*noiseCrest;
  // The junction is a radial grayscale ramp sampled once per cell. It begins
  // dark, rises continuously to white, then blends back into the existing mask.
  // No full-resolution circular cut or material-specific overlay is involved.
  if(u_jointRing0.x>0.5){
    vec2 delta=(uv-u_jointRing0.yz)*vec2(f_host.z/max(f_host.w,1.0),1.0);
    float distanceToJoint=length(delta);
    float radius=u_jointRing0.w+u_jointRing1.w*sin(6.28318530718*u_jointRing1.z*f_clock.x);
    float rising=cubesEase((distanceToJoint-u_jointRing1.y)/max(radius-u_jointRing1.y,0.001));
    float falling=1.0-cubesEase((distanceToJoint-radius)/max(2.0*u_jointRing1.x,0.001));
    mask=mix(mask,rising*falling,falling);
  }
  float rawMask=mask;
  ivec2 tdLocal=ivec2(0);
  if(u_tdMaskInfo.z>0.5){
    vec2 cellUV=clamp((cpx-f_host.xy)/max(f_host.zw,vec2(1.0)),vec2(0.0),vec2(0.999999));
    ivec2 globalTexel=ivec2(floor(vec2(cpx.x-f_host.x,f_host.w-cpx.y+f_host.y)/max(u_tdMaskInfo.w,0.001)));
    globalTexel=clamp(globalTexel,ivec2(0),ivec2(u_tdMaskInfo.xy)-ivec2(1));
    tdLocal=clamp(globalTexel-ivec2(u_tdOffset),ivec2(0),ivec2(u_tdPhysicalRect.zw)-ivec2(1));
    rawMask=texelFetch(u_tdMask,ivec2(u_tdPhysicalRect.xy)+tdLocal,0).r;
  }
  // Optional external envelope composes with the native field instead of replacing it.
  // Default off preserves every existing physical-mask consumer.
  if(u_tdMaskInfo.z>0.5 && u_tdProceduralEnvelope>0.5) mask*=rawMask;
  float sourceMask=rawMask;
  rawMask*=discoveryKeep;
  mask*=discoveryKeep;
  if(u_maskPair.x>0.5){
    // External grayscale is direct for EACH independently authored layer.
    // The procedural fallback retains the complementary fine branch.
    mask=u_tdMaskInfo.z>0.5
      ? cubesEase((rawMask-(u_maskPair.y>0.5?u_maskPair.w:u_maskPair.z))/max(1.0-(u_maskPair.y>0.5?u_maskPair.w:u_maskPair.z),0.0001))
      : u_maskPair.y>0.5
      ? 1.0-cubesEase(rawMask/max(u_maskPair.w,0.0001))
      : cubesEase((rawMask-u_maskPair.z)/max(1.0-u_maskPair.z,0.0001));
  }
  vec3 base=cubesPalette(sourceMask); // cutout changes presence, never the source palette
  // Size follows the continuous mask, not palette R. The old red-channel
  // coupling made red islands huge and blue neighbours almost disappear.
  float activity=mask;
  // Even the brightest noise-only tile stays below a grid step after the
  // per-cell size variation; overlap is reserved for ramp/noise peaks.
  float sizeVariation=clamp(u_cubeArt[13].x+u_cubeArt[10].z*detail+u_cubeArt[10].w*(tileB-0.5),u_cubeArt[13].y,u_cubeArt[13].z);
  // Color gets independent broad and medium fields. Neighbour variation only
  // changes luminance, so it cannot invent off-brand hues or couple size to RGB.
  if(u_brand.x>0.5) {
    vec2 colorCoord=(uv-0.5)*vec2(f_host.z/max(f_host.w,1.0),1.0);
    float colorSignal=clamp(u_cubeArt[19].x
      +u_cubeArt[19].y*gnoise3(vec3(colorCoord*u_cubeArt[17].x+u_cubeArt[17].zw,f_clock.x*u_cubeArt[17].y))
      +u_cubeArt[19].z*gnoise3(vec3(colorCoord*u_cubeArt[18].x+u_cubeArt[18].zw,f_clock.x*u_cubeArt[18].y))
      +u_cubeArt[19].w*(tileB-0.5),0.0,1.0);
    // One 7168-pixel domain: the 3072-pixel service boundary is only a crop.
    float brand=smoothstep(u_brand.y,u_brand.z,cpx.x/f_host.z)*u_brand.w;
    base=mix(cubesVkColor(colorSignal),cubesMaxColor(colorSignal),brand);
    base*=u_cubeArt[20].x+u_cubeArt[20].y*tileA;
  } else {
    base*=vec3(0.91+0.18*tileB,0.94+0.12*tileA,0.92+0.16*tileB);
  }
  if(u_tdMaskInfo.z>0.5){
    vec3 rgb=texelFetch(u_tdMask,ivec2(u_tdColorRect.xy)+tdLocal,0).rgb;
    // Authored RGB is sRGB data; decode once into the lighting field.
    base=mix(rgb/12.92,pow((rgb+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),rgb));
  }
  base=mix(base,vec3(1.),tdMorphAt(cpx));
  vec2 map=u_inputCrop.xy+vec2(cpx.x/f_host.z,1.0-cpx.y/f_host.w)*u_inputCrop.zw;
  vec2 inputUV=mix(map/max(u_inputMap,vec2(1.0)),(map-u_inputCrop.xy)/max(u_inputCrop.zw,vec2(1.0)),u_inputLocal);
  float local=mix(texture(u_inputA,inputUV).g,texture(u_inputB,inputUV).g,u_inputMix)*4.0*u_inputEnabled;
  vec2 bodyUV=(map-u_bodyCrop.xy)/max(u_bodyCrop.zw,vec2(1.0));
  float inside=step(0.0,bodyUV.x)*step(bodyUV.x,1.0)*step(0.0,bodyUV.y)*step(bodyUV.y,1.0);
  vec3 body=texture(u_body,bodyUV).rgb*u_bodyAlive*inside;
  float reactive=max(0.0,local+body.g*1.5+body.b*0.25);
${scenarioParameters ? `  // Stage 1: the existing noise/ramp mask above remains the geometry signal.
  // Stage 2: original LumiCells controls resolve per-cell radiance separately.
  // The same flicker/sparsity response now drives the CUBES geometry mask.
  uvec2 scenarioKey=uvec2(cell+ivec2(4096));
  float baseIntensity=pow(max(mask,0.0),max(P_animation_gamma,0.05));
  float I=baseIntensity*P_animation_brightness*P_animation_energy;
  float flicker=flickerF(scenarioKey,tileA,mask);
  I*=flicker;
  float killP,vary;
  float presence=presenceF(scenarioKey,tileB,mask,killP,vary);
  I*=presence*vary;
  float visibleMask=baseIntensity*flicker*presence*vary;
  float sparkle=sparkleF(scenarioKey,tileA,I);
  I+=P_animation_sparkle_amount*sparkle;
  I+=reactive*(1.0-0.5*sat(I));
  float hot=smoothstep(P_color_hot_threshold,1.0,I)*P_color_hot_amount;
  float dead=P_animation_floor*mask*presence;
  ${cubeGeometry ? `// Stage 3 / CUBES: geometry follows the same animated visibility as the vanilla stamp.
  // Keep the production CUBES albedo independent of light controls.
  o_fieldA=enc4(vec4(base*(1.0+0.55*reactive),I));
  o_fieldB=vec4(sat(visibleMask),sat(reactive),sizeVariation,sat(visibleMask*0.5));` : `// Stage 3 / vanilla: preserve the current stamp/composite channel semantics.
  o_fieldA=enc4(vec4(base,I));
  // Local comparison shares pre-Energy visibility with CUBES in alpha.
  o_fieldB=vec4(mask,sat(hot),sat(dead),sat(visibleMask*0.5));`}
  o_bloom=enc4(vec4(bloomSource(base*I),rawMask));` : `  // Physical silhouette/pointer energy illuminates the tile and its bloom
  // without replacing the continuous size mask.
  o_fieldA=enc4(vec4(base*(1.0+0.55*reactive),activity));
  o_fieldB=vec4(mask,sat(reactive),sizeVariation,sat(mask*0.5));
  o_bloom=enc4(vec4(bloomSource(base*(0.48*activity*activity+reactive)),rawMask));`}
  applyDiscovery(discoveryKeep);
  applyRowStream(cell);
  return;
  }
` : ''}
  // Hash key relative to the center cell (cols and rows are odd): neither a pad change nor
  // symmetric grid growth (cols/rows change in steps of 2 around a fixed center) re-rolls the
  // cells that stay in place.
  ivec2 ctr = ivec2(int(f_grid.w + 0.5)) + (ivec2(f_grid.xy + 0.5) - 1) / 2;
  uvec2 key = uvec2(cell - ctr + 4096);
  uint hk = hash2(key);
  float h = u01(hk);
  float h2 = u01(pcg(hk ^ 0x9e3779b9u));
  float zoom = max(P_scene_zoom, 0.05);
  vec2 p = ((cpx - f_space.xy) * f_space.z - P_scene_center) / zoom;
  float cs = f_space.w / zoom;
  int nInf = int(f_counts.x + 0.5);

  // Repel influences push the sampling position outward before any mode sees it.
  for (int i = 0; i < MAX_INFLUENCES; i++) {
    if (i >= nInf) break;
    vec4 b = f_inf[i * 3 + 1];
    if (b.w > 3.5) {
      vec2 dv = cpx - f_inf[i * 3].xy;
      float len = length(dv);
      if (len > 1e-3) p += (dv / len) * (influenceK(i, cpx, pitch) * b.z * 0.25 / zoom);
    }
  }

  ModeIn m = ModeIn(p, length(p), cs, cell, h);
  Mix x = Mix(1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
${MODES_EVAL_GLSL}
  float blend = P_animation_blend;
  float I = blend < 0.5 ? 1.0 - x.scr + x.over : (blend < 1.5 ? x.sum / max(1.0, x.w) : x.mx);
  float env = sat(x.env);

  I = pow(max(I, 0.0), max(P_animation_gamma, 0.05)) * P_animation_brightness * P_animation_energy;
  I *= flickerF(key, h, env);
  // Heat is judged before the sparsity boost: a lone bright survivor in the outskirts must stay
  // saturated, only the genuinely hottest cells of the structure get pastel cores.
  float Iheat = I;
  float killP;
  float vary;
  float pres = presenceF(key, h2, env, killP, vary);
  // Dropped cells linger as dim squares next to the structure (the reference's outer band mixes
  // dim and bright cells) and vanish completely far out.
  I *= vary * mix(0.25 * smoothstep(0.2, 0.7, env), 1.0 + 2.5 * killP, pres);
  // Soft gate on near-black cells: against navy even I = 0.05 reads as a dim grid, while the
  // look wants the outskirts either empty or holding a few crisp survivors.
  I *= smoothstep(0.015, 0.09, I);
  float spk = sparkleF(key, h, I);
  I += P_animation_sparkle_amount * spk;
  // Sparkles are brightness peaks with only a hint of the hot tint, never white flashes.
  float hotAdd = 0.3 * spk * min(P_animation_sparkle_amount * 2.5, 1.0);

  // Influences (device px): light adds and tints, shadow multiplies down, lift heats up.
  vec3 tint = vec3(0.0);
  float tintW = 0.0;
  float shade = 1.0;
  for (int i = 0; i < MAX_INFLUENCES; i++) {
    if (i >= nInf) break;
    vec4 b = f_inf[i * 3 + 1];
    if (b.w > 2.5) continue;
    float k = influenceK(i, cpx, pitch) * b.z;
    if (k <= 0.0) continue;
    if (b.w < 0.5) {
      // Light lifts dim cells more than bright ones and never bleaches them: a lit neighbourhood
      // stays saturated neon instead of turning pastel.
      I += k * (1.0 - 0.5 * sat(I));
      vec4 c = f_inf[i * 3 + 2];
      tint += c.rgb * (k * c.a);
      tintW += k * c.a;
    } else if (b.w < 1.5) {
      shade *= 1.0 - sat(k);
    } else {
      I += 0.3 * k;
      hotAdd += 0.6 * k;
    }
  }
  // Pulses: gaussian rings in device px, widened to the cell footprint.
  int nPulse = int(f_counts.y + 0.5);
  for (int i = 0; i < MAX_PULSES; i++) {
    if (i >= nPulse) break;
    vec4 a = f_pulse[i * 3];
    vec4 b = f_pulse[i * 3 + 1];
    float w = sqrt(sq(0.5 * a.w) + sq(0.7 * pitch));
    float band = b.x * exp(-sq(length(cpx - a.xy) - a.z) / (2.0 * w * w));
    I += band;
    hotAdd += 0.1 * band;
    tint += f_pulse[i * 3 + 2].rgb * (band * b.y);
    tintW += band * b.y;
  }
  vec2 map = u_inputCrop.xy + vec2(cpx.x/f_host.z,1.0-cpx.y/f_host.w)*u_inputCrop.zw;
  vec2 inputUV=mix(map/max(u_inputMap,vec2(1.0)),(map-u_inputCrop.xy)/max(u_inputCrop.zw,vec2(1.0)),u_inputLocal);
  float local=mix(texture(u_inputA,inputUV).g,texture(u_inputB,inputUV).g,u_inputMix)*4.0*u_inputEnabled;
  vec2 bodyUV=(map-u_bodyCrop.xy)/max(u_bodyCrop.zw,vec2(1.0));
  float inside=step(0.0,bodyUV.x)*step(bodyUV.x,1.0)*step(0.0,bodyUV.y)*step(bodyUV.y,1.0);
  vec3 body=texture(u_body,bodyUV).rgb*u_bodyAlive*inside;
  I+=local*(1.0-0.5*sat(I))+body.g*1.5+body.b*0.25;
  I=max(I,body.r*0.28);
  float Ipre = I * shade;

  // Lift sockets: the source cell dims while its copy floats above.
  float sock = 0.0;
  int nSock = int(f_counts.z + 0.5);
  for (int i = 0; i < MAX_LIFTS; i++) {
    if (i >= nSock) break;
    vec4 s = f_socket[i];
    if (ivec2(floor(s.xy + 0.5)) == cell) sock = max(sock, s.z);
  }
  // Same gate as the lift pass: a copy faded out over a dark cell leaves no dimmed socket behind.
#ifdef P_lift_threshold
  float gateHi = P_lift_threshold;
#else
  float gateHi = 0.2;
#endif
  I = Ipre * (1.0 - sat(sock) * smoothstep(0.5 * gateHi, gateHi, Ipre));

  float hot = (smoothstep(P_color_hot_threshold, 1.0, Iheat) * P_color_hot_amount + hotAdd) * shade;

  // Palette position: mapping (+ crossfade from the previous mapping), warp, jitter, drift.
  float t = mapT(P_color_mapping, p, Ipre, cs);
  if (f_misc.y < 0.999) t = mix(mapT(f_misc.x, p, Ipre, cs), t, sat(f_misc.y));
  float warpN = P_color_warp > 0.0
    ? fbm3(vec3(p * P_color_warpScale, f_clock.x * 0.0625), 2, P_color_warpScale * cs)
    : 0.0;
  t += P_color_offset + P_color_warp * warpN + P_color_jitter * (h2 - 0.5)
     + P_color_intensityShift * (Ipre - 0.5);
  // Drift: tri() folds the palette (period 2, the drift phase wraps at 2 as well). The switch is a
  // per-frame flag (rate or phase nonzero), never the phase value itself.
  t = f_misc.w > 0.5 ? tri(t + f_phaseB.w) : sat(t);

  if(u_brand.x>0.5) t=smoothstep(u_brand.y,u_brand.z,cpx.x/f_host.z)*u_brand.w;
  vec3 base = texture(u_lut, vec2(t * (255.0 / 256.0) + 0.5 / 256.0, 0.25)).rgb;
  // Hue cues from the reference: organic inner-edge patches take the accent color on the cool
  // half of the palette (cyan in the blue), hot cells lean red on the warm side. Both in OKLab.
  // Sharpened so patch cores take the accent fully (distinct teal cells, not a tinted azure).
  float acc = sat(1.6 * x.accent * P_color_accent_amount - 0.3) * smoothstep(0.42, 0.58, t);
  float rot = 0.35 * sat(hot) * (1.0 - smoothstep(0.2, 0.35, t));
  if (acc > 1e-3 || rot > 1e-3) {
    vec3 lab = lin2oklab(base);
    float cr = cos(rot);
    float sr = sin(rot);
    lab.yz = vec2(lab.y * cr - lab.z * sr, lab.y * sr + lab.z * cr);
    lab = mix(lab, lin2oklab(P_color_accent_color), acc);
    base = max(oklab2lin(lab), vec3(0.0));
  }
  base = saturateColor(base, P_color_saturation);
  if (tintW > 0.0) base = mix(base, tint / tintW, sat(tintW));

  float dead = P_animation_floor * (0.25 + 0.75 * env) * pres * mix(1.0, shade, 0.7);
  // Quadratic visibility: unlit cells read faintly next to the structure and vanish in the hole
  // and the far outskirts (clean navy there, as in the reference).
  dead *= min(dead * 4.0, 1.0);
  o_fieldA = enc4(vec4(base, I));
  o_fieldB = vec4(t, sat(hot), sat(dead), sat(Ipre * 0.5));
  o_bloom = enc4(vec4(bloomSource(base * I), 1.0));
  applyDiscovery(discoveryKeep);
  applyRowStream(cell);
}
`;
}

export class FieldPass {
  private readonly prog: LazyProgram;
  private readonly cubeMask: boolean;

  constructor(private readonly ctx: PassContext, cubeMask = false, scenarioParameters = false, cubeGeometry = false, profile = '') {
    this.cubeMask = cubeMask;
    this.prog = new LazyProgram(ctx, FULLSCREEN_VS, fieldFs(ctx.header, cubeMask, scenarioParameters, cubeGeometry, profile), 'field', (p) => {
      setSampler(ctx.gl, p, 'u_life', UNIT_LIFE);
      initTdMorph(ctx,p);
      setSampler(ctx.gl, p, 'u_lut', UNIT_LUT);
      setSampler(ctx.gl,p,'u_inputA',9);setSampler(ctx.gl,p,'u_inputB',10);setSampler(ctx.gl,p,'u_body',11);setSampler(ctx.gl,p,'u_tdMask',12);setSampler(ctx.gl,p,'u_rowStream',13);
    });
  }

  poll(): boolean {
    return this.prog.poll();
  }

  /** `fb` has three attachments: fieldA, fieldB and the bloom source. */
  run(fb: WebGLFramebuffer, w: number, h: number, life: WebGLTexture, input: any = null): void {
    const gl = this.ctx.gl;
    const p=this.prog.use();
    uploadTdMorph(this.ctx,p,input);
    const q=input?.crop ?? [0,0,1,1], b=input?.bodyCrop ?? [0,0,1,1], brand=input?.brand ?? [0,0,1,0];
    gl.uniform4fv(p.uniform('u_inputCrop'),q);gl.uniform4fv(p.uniform('u_bodyCrop'),b);
    gl.uniform2fv(p.uniform('u_inputMap'),input?.map ?? [1,1]);
    gl.uniform1f(p.uniform('u_inputMix'),input?.mix ?? 0);gl.uniform1f(p.uniform('u_bodyAlive'),input?.enabled===false?0:input?.bodyAlive ?? 0);gl.uniform1f(p.uniform('u_inputEnabled'),input&&input.enabled!==false?1:0);
    gl.uniform4fv(p.uniform('u_maskPair'),input?.maskPair ?? [0,0,0,0]);
    gl.uniform4fv(p.uniform('u_tdMaskInfo'),input?.externalMask?[...input.externalMask.size,1,input.externalMask.pitch]:[1,1,0,1]);
    gl.uniform1f(p.uniform('u_tdProceduralEnvelope'),input?.externalMask?.proceduralEnvelope?1:0);
    gl.uniform1f(p.uniform('u_rowStreamEnabled'),input?.rowStream?.texture?1:0);
    gl.uniform1i(p.uniform('u_discoveryCount'),input?.discovery?.count??0);
    gl.uniform1f(p.uniform('u_discoveryFeather'),input?.discovery?.featherCells??3);
    if(input?.discovery?.count){
      gl.uniform4fv(p.uniform('u_discoveryRects[0]'),input.discovery.rects);
      gl.uniform1fv(p.uniform('u_discoveryAlpha[0]'),input.discovery.alpha);
    }
    gl.uniform4fv(p.uniform('u_tdPhysicalRect'),input?.externalMask?.physicalRect??[0,0,1,1]);
    gl.uniform4fv(p.uniform('u_tdColorRect'),input?.externalMask?.colorRect??[0,0,1,1]);
    gl.uniform2fv(p.uniform('u_tdOffset'),input?.externalMask?.offset??[0,0]);
    gl.uniform4fv(p.uniform('u_brand'),brand);
    gl.uniform4fv(p.uniform('u_jointRing0'),input?.jointRing?.[0] ?? [0,0,0,0]);
    gl.uniform4fv(p.uniform('u_jointRing1'),input?.jointRing?.[1] ?? [0,0,0,0]);
    if(this.cubeMask){
      if(!(input?.cubeArt instanceof Float32Array)||input.cubeArt.length!==21*4)throw Error('[lumicells] missing CUBES art parameters');
      gl.uniform4fv(p.uniform('u_cubeArt[0]'),input.cubeArt);
    }
    gl.uniform1f(p.uniform('u_inputLocal'),input?.local?1:0);
    bindTexture(gl,9,input?.a ?? life);bindTexture(gl,10,input?.b ?? life);bindTexture(gl,11,input?.body ?? life);bindTexture(gl,12,input?.externalMask?.texture ?? life);bindTexture(gl,13,input?.rowStream?.texture ?? life);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    discardTargets(this.ctx, 3);
    gl.viewport(0, 0, w, h);
    bindTexture(gl, UNIT_LIFE, life);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.prog.dispose();
  }
}
