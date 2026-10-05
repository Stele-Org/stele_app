// LumiCells' existing CompositePass glow lookup, shared unchanged with the CUBES adapter.
// Keeping one sampler prevents opaque geometry from erasing the already-composited glow.
export const COMPOSITE_GLOW_GLSL = `
mediump vec3 sampleCompositeGlow(sampler2D source,vec2 gp,vec4 cellTex,bool cubic,bool enabled) {
  mediump vec3 glow=vec3(0.0);
  if(enabled) {
    if(cubic) glow=texBicubicDec(source,gp,cellTex.xy,cellTex.zw).rgb;
    else glow=texBilinearDec(source,gp,cellTex.xy,cellTex.zw).rgb;
    glow*=GLOW_SCALE;
    vec2 ge=min(gp,cellTex.xy-gp);
    glow*=smoothstep(0.0,2.0,min(ge.x,ge.y));
  }
  return glow;
}
`;
