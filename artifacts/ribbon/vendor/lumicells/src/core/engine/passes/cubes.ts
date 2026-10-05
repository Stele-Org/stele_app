/**
 * CUBES-inspired geometry on the existing LumiCells field. One indexed rounded prism is
 * instanced over the output crop; no CPU readback, second field or extra scene render.
 * The source TD mesh is deliberately simplified (49 vertices instead of 1536).
 */
import { OFF_ORIGIN } from '../frame-block';
import { LazyProgram, type PassContext, setSampler, UNIT_FIELD_A, UNIT_FIELD_B, UNIT_GLOW } from './shared';
import { compositeBackgroundGlsl } from '../glsl/composite-background';
import { COMPOSITE_GLOW_GLSL } from '../glsl/composite-glow';
import type { FrameInputs } from '../types';
import {TD_MORPH_GLSL,initTdMorph,uploadTdMorph} from './td-morph';

function geometry(): { vertices: Float32Array; indices: Uint16Array } {
  const v: number[] = [0, 0, -1, 0, 0]; // center: sign.xy, arc.xy, ring
  const arcs: number[][] = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const start = Math.atan2(sy, sx) - Math.PI / 4;
    for (let i = 0; i < 4; i++) {
      const a = start + i * Math.PI / 6;
      arcs.push([sx, sy, Math.cos(a), Math.sin(a)]);
    }
  }
  for (let ring = 0; ring < 3; ring++) for (const a of arcs) v.push(...a, ring);
  const ix: number[] = [];
  // Without a depth attachment the pass is ordered rear side -> bevel -> front face.
  for (const r of [1, 0]) for (let i = 0; i < 16; i++) {
    const j = (i + 1) % 16, a = 1 + 16 * r + i, b = 1 + 16 * r + j;
    ix.push(a, a + 16, b, b, a + 16, b + 16);
  }
  for (let i = 0; i < 16; i++) ix.push(0, 1 + i, 1 + (i + 1) % 16);
  return { vertices: new Float32Array(v), indices: new Uint16Array(ix) };
}

function vs(header: string, cubeMask: boolean, sharedMotion: boolean): string { return `${header}
layout(location=0) in vec2 a_sign;
layout(location=1) in vec2 a_arc;
layout(location=2) in float a_ring;
uniform sampler2D u_fieldA, u_fieldB;
${TD_MORPH_GLSL}
uniform ivec4 u_cells; // base xy, count x, logical texture width
uniform ivec2 u_limit;
uniform vec4 u_output; // output xywh in the shared canvas
${cubeMask ? 'uniform vec4 u_cubeArt[21];' : ''}
out vec3 v_color;
out vec3 v_normal;
out float v_alpha;
out vec2 v_local;
out float v_morph;
void main() {
  int col = gl_InstanceID % u_cells.z;
  int row = gl_InstanceID / u_cells.z;
  ivec2 cell = u_cells.xy + ivec2(col, row);
  if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, u_limit))) {
    gl_Position = vec4(2.0,2.0,2.0,1.0); v_alpha=0.0; v_color=vec3(0.0); v_normal=vec3(0.0,0.0,1.0); return;
  }
  vec4 A = dec4(texelFetch(u_fieldA,cell,0));
  vec4 B = texelFetch(u_fieldB,cell,0);
  float energy = ${cubeMask ? '(B.b<0.001 && B.a>0.999)?0.0:clamp(B.r,0.0,1.0)' : 'smoothstep(0.06,1.25,A.a)'};
  // Damped spring impulse around each passing Pulse band; its phase comes from the shared
  // clock and global cell position, so left/right crops never accumulate different state.
  vec2 center = f_origin.xy + (vec2(cell)+0.5)*f_grid.z;
  float morph=tdMorphAt(center);v_morph=morph;
  vec2 modePos = (center-f_space.xy)*f_space.z;
  float radial = length(modePos-P_modes_pulse_origin);
  float phase = ${cubeMask ? 'length((center-f_host.xy)/max(f_host.zw,vec2(1.0))-vec2(0.5))/u_cubeArt[4].w-f_clock.x*u_cubeArt[4].z' : 'radial*max(P_modes_pulse_frequency,0.01)-f_phaseA.w'};
  float age = 1.0-fract(phase+0.5);
  float spring = ${sharedMotion ? '0.0' : `exp(-${cubeMask ? 'u_cubeArt[16].y' : '5.2'}*age)*sin(${cubeMask ? 'u_cubeArt[16].z' : '14.0'}*age)`};
  float lift = max(0.0,energy*(${cubeMask ? 'u_cubeArt[15].w+u_cubeArt[16].x' : '0.38+0.10'}*spring));
  float pitch = f_grid.z;
  float base = 1.0-P_grid_gap;
  // Preserve the full grayscale range in visible tile sizes. The previous
  // 1.34 gain hit the 1.14 cap well before white and fused bright regions.
  // Exact black stays zero; only the brightest tiles overlap a grid step.
  float size = pitch*${cubeMask ? 'clamp(u_cubeArt[15].x*energy*B.b+u_cubeArt[15].y*max(spring,0.0)*energy,0.0,u_cubeArt[15].z)' : 'max(0.02,base+energy*(1.045-base)+0.035*spring*energy)'};
  float radius = mix(clamp(P_grid_roundness,0.02,0.48)*0.5,.5,morph);
  vec2 p = a_ring<0.0 ? vec2(0.0) : a_sign*(0.5-radius)+a_arc*radius;
  // Circumscribe the analytic circle so its AA edge is inside the existing mesh.
  p*=mix(1.,1.05,morph);
  v_local=p;
  if (a_ring<0.5) p*=mix(.86,1.,morph); // flatten shoulder into the white disc
  float z = a_ring<0.5 ? 0.0 : a_ring<1.5 ? -0.055 : -0.38;
  z*=1.-morph;
  vec3 pos = vec3(p*size,z*size+lift*pitch);
  // Shallow oblique camera: actual Z changes projected position and exposes the rounded sides.
  pos = vec3(pos.x+0.16*pos.z,pos.y-0.24*pos.z,pos.z);
  float perspective = 1.0+0.12*pos.z/max(pitch,1.0);
  vec2 screen = center+pos.xy*perspective;
  vec2 ndc = vec2((screen.x-u_output.x)/u_output.z*2.0-1.0,
                  1.0-(screen.y-u_output.y)/u_output.w*2.0);
  gl_Position = vec4(ndc,0.0,1.0);
  vec3 n = a_ring<0.5 ? vec3(0.0,0.0,1.0) :
           a_ring<1.5 ? normalize(vec3(a_arc*0.55,0.83)) : normalize(vec3(a_arc,0.08));
  v_normal = normalize(vec3(n.x+0.16*n.z,n.y-0.24*n.z,n.z));
  v_color = ${cubeMask ? 'A.rgb*(1.0+0.35*B.g)' : 'A.rgb * (A.a*(1.0+0.5*B.g)+B.b)'};
  v_alpha = ${cubeMask ? 'smoothstep(0.0,0.025,energy)' : 'smoothstep(0.015,0.08,A.a+B.b)'};
}`; }

function fs(header: string, cubeMask: boolean, backgroundProfile: string): string { return `${header}
in vec3 v_color;
in vec3 v_normal;
in float v_alpha;
in vec2 v_local;
in float v_morph;
uniform float u_linear;
uniform sampler2D u_glow;
uniform vec4 u_output,u_cellTex;
${cubeMask ? 'uniform vec4 u_brand;' : ''}
uniform vec2 u_glowFlags; // enabled, high-quality filter
out vec4 o_color;
${COMPOSITE_GLOW_GLSL}
${compositeBackgroundGlsl(cubeMask, backgroundProfile)}
void main() {
  if(v_alpha<0.002) discard;
  vec3 N=normalize(v_normal);
  vec3 L=normalize(vec3(-0.38,-0.56,0.73));
  float diffuse=max(dot(N,L),0.0);
  float edge=1.0-smoothstep(0.62,0.95,N.z);
  // /CUBES/pbr1 uses roughness 1, specular level 0 and metallic .942.
  // A broad, color-tinted response keeps the form matte; no white pin glint.
  float broad=pow(max(dot(reflect(-L,N),vec3(0.0,0.0,1.0)),0.0),3.0);
  float grain=fract(sin(dot(floor(v_local*180.0),vec2(127.1,311.7)))*43758.5453)-0.5;
  float body=1.0+0.018*grain+0.025*sin(v_local.x*19.0+v_local.y*9.0);
  vec3 lit=v_color*(0.64+0.34*diffuse)*(1.0-0.13*edge+0.025*broad)*body;
  vec2 px=u_output.xy+vec2(gl_FragCoord.x,u_output.w-gl_FragCoord.y);
  vec2 gp=(px-f_origin.xy)/f_grid.z;
  vec3 glow=sampleCompositeGlow(u_glow,gp,u_cellTex,u_glowFlags.y>0.5,u_glowFlags.x>0.5);
  vec2 hp=px-f_host.xy;
  float inHost=sat(min(hp.x,f_host.z-hp.x)+.5)*sat(min(hp.y,f_host.w-hp.y)+.5);
  vec3 background=compositeBackground(px,inHost,true);
  vec3 display=clamp(lin2srgb(tonemapMax((background+lit+glow)*P_glow_exposure,P_glow_whitePoint)),0.0,1.0);
  display=mix(display,vec3(1.),v_morph);
  float distance=length(v_local),aa=max(fwidth(distance),.0001);
  float coverage=mix(1.,1.-smoothstep(.5-aa,.5+aa,distance),v_morph);
  if(coverage<.001)discard;
  vec3 linear=mix(display/12.92,pow((display+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),display));
  o_color=vec4(u_linear>0.5?linear:display,coverage);
}`; }

export class CubesPass {
  private readonly prog: LazyProgram;
  private readonly cubeMask: boolean;
  private readonly vao: WebGLVertexArrayObject;
  private readonly vertex: WebGLBuffer;
  private readonly index: WebGLBuffer;
  private readonly count: number;
  constructor(private readonly ctx: PassContext, cubeMask = false, sharedMotion = false, private readonly minPitch = 16, backgroundProfile = '') {
    this.cubeMask=cubeMask;
    const gl=ctx.gl;
    this.prog=new LazyProgram(ctx,vs(ctx.header,cubeMask,sharedMotion),fs(ctx.header,cubeMask,backgroundProfile),'cubes',(p)=>{
      setSampler(gl,p,'u_fieldA',UNIT_FIELD_A); setSampler(gl,p,'u_fieldB',UNIT_FIELD_B);
      setSampler(gl,p,'u_glow',UNIT_GLOW);
      initTdMorph(ctx,p);
    });
    const vao=gl.createVertexArray(),vertex=gl.createBuffer(),index=gl.createBuffer();
    if(!vao||!vertex||!index)throw Error('[lumicells] cannot create cubes buffers');
    this.vao=vao;this.vertex=vertex;this.index=index;
    const mesh=geometry();this.count=mesh.indices.length;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,8);
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,20,16);
    gl.bindVertexArray(null);
  }
  poll(): boolean {return this.prog.poll();}
  run(f:FrameInputs,w:number,h:number,output:any,allocW:number,allocH:number,glowOn:boolean):number {
    const gl=this.ctx.gl,pitch=f.pitchPx;
    // At tiny pitches the original antialiased stamp is the correct LOD and avoids millions
    // of sub-pixel triangles. The mesh resumes automatically when the grid is enlarged.
    if(pitch<this.minPitch)return 0;
    const ox=output?.x??0,oy=output?.y??0,vw=output?.width??f.canvasWidth,vh=output?.height??f.canvasHeight;
    const gx=f.frame[OFF_ORIGIN]??0,gy=f.frame[OFF_ORIGIN+1]??0;
    const x=Math.max(0,Math.floor((ox-gx)/pitch)-1),y=Math.max(0,Math.floor((oy-gy)/pitch)-1);
    const nx=Math.min(w-x,Math.ceil((ox+vw-gx)/pitch)-x+1);
    const ny=Math.min(h-y,Math.ceil((oy+vh-gy)/pitch)-y+1);
    if(nx<=0||ny<=0)return 0;
    const p=this.prog.use();
    uploadTdMorph(this.ctx,p,output?.interaction);
    gl.uniform4i(p.uniform('u_cells'),x,y,nx,w);
    gl.uniform2i(p.uniform('u_limit'),w,h);
    gl.uniform4f(p.uniform('u_output'),ox,oy,vw,vh);
    gl.uniform1f(p.uniform('u_linear'),output?.linear?1:0);
    gl.uniform4f(p.uniform('u_cellTex'),w,h,1/allocW,1/allocH);
    gl.uniform2f(p.uniform('u_glowFlags'),glowOn?1:0,f.quality==='high'?1:0);
    if(this.cubeMask){
      gl.uniform4fv(p.uniform('u_brand'),output?.interaction?.brand??[0,0,1,0]);
      const art=output?.interaction?.cubeArt;
      if(!(art instanceof Float32Array)||art.length!==21*4)throw Error('[lumicells] missing CUBES art parameters');
      gl.uniform4fv(p.uniform('u_cubeArt[0]'),art.subarray(0,17*4));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,output?.framebuffer??null);
    gl.viewport(0,0,vw,vh);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
    if(output?.interaction?.externalMask?.morph){gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}
    gl.drawElementsInstanced(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0,nx*ny);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    return nx*ny;
  }
  dispose():void {const gl=this.ctx.gl;this.prog.dispose();gl.deleteVertexArray(this.vao);gl.deleteBuffer(this.vertex);gl.deleteBuffer(this.index);}
}
