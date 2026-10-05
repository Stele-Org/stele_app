/**
 * GPU translation of the active /CUBES TOP graph (30 Sep 2026):
 * TD-inspired broad noise, circular ramp and independent medium/fine fields.
 * The original switch over-weighted the ring and a scalar noise->noise map:
 * neighbouring cells formed identical bands with only tiny dots between peaks.
 * Noise stays below white; only its moving intersection with the circular
 * ramp can reach 1. The final transfer and crest gate live in field.ts.
 * Global spatial coordinates and time are shared by every output crop.
 */
export const CUBES_MASK_GLSL = /* glsl */ `
// 21 vec4 rows from cubes-art.json, packed by cubes-art.js. The same values
// feed the field and geometry passes across all output crops.
uniform vec4 u_cubeArt[21];
float cubesEase(float x) { x=clamp(x,0.0,1.0); return x*x*(3.0-2.0*x); }
float cubesRamp(float x) {
  x=fract(x);
  vec3 k=u_cubeArt[12].xyz;
  if(x<k.x) return 1.0-cubesEase(x/k.x);
  if(x<k.y) return 0.0;
  if(x<k.z) return cubesEase((x-k.y)/(k.z-k.y));
  return 1.0;
}
vec3 cubesPalette(float x) {
  x=fract(x);
  const vec3 red=vec3(0.961,0.0,0.0);
  const vec3 dark=vec3(0.048800007,0.122,0.11346001);
  const vec3 blue=vec3(0.2997,0.5098049,0.9);
  if(x<0.055837564) return mix(blue,red,cubesEase((x+1.0-0.92903405)/(1.0+0.055837564-0.92903405)));
  if(x<0.3680203) return mix(red,dark,cubesEase((x-0.055837564)/(0.3680203-0.055837564)));
  if(x<0.92903405) return mix(dark,blue,cubesEase((x-0.3680203)/(0.92903405-0.3680203)));
  return mix(blue,red,cubesEase((x-0.92903405)/(1.0+0.055837564-0.92903405)));
}
// Linear-light values of the local brand tokens. VK Video: vkv-color-blue,
// vkv-color-neon-blue. MAX: max.project.palette.20260927.
// Color is sampled from its own field; the grayscale geometry mask never
// addresses this lookup. Red VK Video accents stay in the foreground content.
vec3 cubesVkColor(float t) {
  return mix(vec3(0.0,0.0513,1.0),vec3(0.0,0.1845,1.0),cubesEase(t));
}
vec3 cubesMaxColor(float t) {
  vec3 blue=vec3(0.063,0.0103,1.0);   // #471AFF
  vec3 violet=vec3(0.156,0.0103,1.0); // #6E1AFF
  vec3 purple=vec3(0.301,0.0,1.0);    // #9500FF
  vec3 cyan=vec3(0.0,0.521,1.0);      // #00BFFF
  if(t<0.38) return mix(blue,violet,cubesEase(t/0.38));
  if(t<0.76) return mix(violet,purple,cubesEase((t-0.38)/0.38));
  return mix(purple,cyan,0.36*cubesEase((t-0.76)/0.24));
}
float cubesNoise(vec3 p) { return 0.5+0.5*gnoise3(p); }
vec2 cubesMaskPartsAt(vec2 uv,float seconds) {
  // Noise TOP uses aspect-corrected UVs. The first noise is monochrome, so its
  // RGB channels all address the same XYZ point of the second Noise TOP.
  float aspect=f_host.z/max(f_host.w,1.0);
  vec2 coord=(uv-0.5)*vec2(aspect,1.0);
  // XY advection keeps broad islands travelling even near a 3D-noise extremum,
  // where pure Z evolution can appear stationary for several seconds.
  vec2 moving=coord+seconds*u_cubeArt[4].xy;
  float phase=seconds*u_cubeArt[4].z;
  float n3=cubesNoise(vec3(moving/u_cubeArt[0].x+u_cubeArt[0].zw,seconds*u_cubeArt[0].y+u_cubeArt[14].x));
  float n5=cubesNoise(vec3(moving/u_cubeArt[1].x+u_cubeArt[1].zw,seconds*u_cubeArt[1].y+u_cubeArt[14].y));
  // Keep the broad circular ramp, but bend its sampling coordinates with a
  // slowly moving field. The ring has a white core and a continuous gray halo.
  vec2 warp=vec2(
    gnoise3(vec3(moving/u_cubeArt[5].x+u_cubeArt[6].xy,seconds*u_cubeArt[5].y)),
    gnoise3(vec3(moving/u_cubeArt[5].x+u_cubeArt[6].zw,seconds*u_cubeArt[5].y))
  )*u_cubeArt[5].z;
  // Distance is measured in screen-height units, like the other noise fields.
  // Using normalized-width UV here made one ring cover almost the entire rear
  // wall at once and turned its white phase into a single flat slab.
  vec2 ringCoord=coord+warp;
  float ring=cubesRamp(length(ringCoord)/u_cubeArt[4].w-phase);
  float n4=cubesNoise(vec3(moving/u_cubeArt[2].x+u_cubeArt[2].zw,seconds*u_cubeArt[2].y+u_cubeArt[14].z));
  float fine=cubesNoise(vec3(moving/u_cubeArt[3].x+u_cubeArt[3].zw,seconds*u_cubeArt[3].y+u_cubeArt[14].w));
  // Keep the moving ramp out of the noise-only signal. The field pass caps
  // this signal before adding a crest, so a static noise island cannot be white.
  float noiseSignal=u_cubeArt[7].x+u_cubeArt[7].y*(n3-0.5)+u_cubeArt[7].z*(n5-0.5)
                   +u_cubeArt[7].w*(fine-0.5)+u_cubeArt[8].x*(n4-0.5);
  return vec2(noiseSignal,ring);
}
`;
