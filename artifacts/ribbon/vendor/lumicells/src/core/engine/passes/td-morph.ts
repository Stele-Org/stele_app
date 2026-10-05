import {bindTexture,setSampler,type PassContext} from './shared';

// Capability bit 0 in header pixel 1.B: physical page G carries morph, R stays physical.
// The same global cell address is used by field, CUBES and vanilla; no tile-local UV.
export const TD_MORPH_GLSL = `
uniform sampler2D u_morphAtlas;
uniform vec4 u_morphInfo,u_morphRect;
uniform vec2 u_morphOffset;
float tdMorphAt(vec2 center){
 if(u_morphInfo.z<.5)return 0.;
 ivec2 globalCell=ivec2(floor(vec2(center.x-f_host.x,f_host.w-center.y+f_host.y)/max(u_morphInfo.w,.001)));
 globalCell=clamp(globalCell,ivec2(0),ivec2(u_morphInfo.xy)-1);
 ivec2 local=clamp(globalCell-ivec2(u_morphOffset),ivec2(0),ivec2(u_morphRect.zw)-1);
 return clamp(texelFetch(u_morphAtlas,ivec2(u_morphRect.xy)+local,0).g,0.,1.);
}
`;
export function initTdMorph(ctx:PassContext,p:any){setSampler(ctx.gl,p,'u_morphAtlas',12);}
export function uploadTdMorph(ctx:PassContext,p:any,input:any){
 const gl=ctx.gl,m=input?.externalMask;
 gl.uniform4fv(p.uniform('u_morphInfo'),m?.morph?[...m.size,1,m.pitch]:[1,1,0,1]);
 gl.uniform4fv(p.uniform('u_morphRect'),m?.physicalRect??[0,0,1,1]);
 gl.uniform2fv(p.uniform('u_morphOffset'),m?.offset??[0,0]);
 bindTexture(gl,12,m?.texture??null);
}
