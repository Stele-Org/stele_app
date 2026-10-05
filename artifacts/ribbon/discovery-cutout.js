const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
export const DISCOVERY_CORNER_RADIUS=.28;
// Positions use the same top-down full-surface coordinates as the bubble snapshot.
export function discoveryCutoutAt(x,y,pitch,bubbles,featherCells=3){
 let union=0;
 for(const b of bubbles){
  const radius=DISCOVERY_CORNER_RADIUS*b.height,qx=Math.abs(x-b.x-b.width/2)-b.width/2+radius,qy=Math.abs(y-b.y-b.height/2)-b.height/2+radius;
  const distance=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
  const coverage=1-smooth(distance/Math.max(featherCells*pitch,.0001));
  union=Math.max(union,coverage*b.alpha);
 }
 return Math.max(0,Math.min(1,union));
}
export function discoveryCutoutData(bubbles,width,height,featherCells=3){
 const rects=new Float32Array(128),alpha=new Float32Array(32);
 for(const [i,b] of bubbles.slice(0,32).entries()){
  rects.set([b.x/width,b.y/height,b.width/width,b.height/height],i*4);alpha[i]=b.alpha;
 }
 return {count:Math.min(bubbles.length,32),rects,alpha,featherCells};
}
export const DISCOVERY_CUTOUT_GLSL=`
uniform int u_discoveryCount;
uniform vec4 u_discoveryRects[32];
uniform float u_discoveryAlpha[32];
uniform float u_discoveryFeather;
float discoveryCutout(vec2 px,vec2 size,float pitch){
 float result=0.;
 for(int i=0;i<32;i++){
  if(i>=u_discoveryCount)break;
  if(u_discoveryAlpha[i]<=0.)continue;
  vec4 rect=u_discoveryRects[i]*vec4(size,size);
  float radius=${DISCOVERY_CORNER_RADIUS}*rect.w;
  vec2 q=abs(px-rect.xy-.5*rect.zw)-.5*rect.zw+radius;
  float distance=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
  float coverage=1.-smoothstep(0.,max(u_discoveryFeather*pitch,.0001),distance);
  result=max(result,coverage*u_discoveryAlpha[i]);
 }
 return clamp(result,0.,1.);
}
`;
