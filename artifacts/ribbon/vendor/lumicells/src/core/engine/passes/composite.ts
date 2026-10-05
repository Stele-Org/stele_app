/**
 * Composite (the only full-resolution pass): rounded LED bodies on a pixel-snapped grid, a tight
 * two-lobe halo from the fragment's 2x2 quadrant neighbourhood (compact support of half a pitch,
 * so the 2x2 result equals a full 3x3 sum with no seams), the combined bloom + haze glow, a
 * palette-tinted background, hue-preserving tonemap, sRGB encode and TPDF dither.
 *
 * Kept lean on purpose. Per pixel at 'high': one glow lookup (B-spline, 4 bilinear taps; skipped
 * when both glow strengths are 0); inside the host 4 texelFetch of fieldA (the cell and its
 * quadrant neighbours) and one of fieldB; lit cells add 2 fetches of the baked cell stamp (the
 * cell shape and halo weights, see stamp.ts) and hot cells one LUT lookup.
 * 'medium' samples the glow bilinearly (1 tap). 'low' also drops the halo and the bevel, and with
 * them the neighbour and halo-stamp fetches.
 * Color math runs in mediump (FP16 on mobile GPUs); positions, texture coordinates and the dither
 * hash stay highp.
 */

import { FULLSCREEN_VS } from '../glsl/common';
import { compositeBackgroundGlsl } from '../glsl/composite-background';
import { COMPOSITE_GLOW_GLSL } from '../glsl/composite-glow';
import {TD_MORPH_GLSL,initTdMorph,uploadTdMorph} from './td-morph';
import {
  LazyProgram,
  type PassContext,
  setSampler,
  bindTexture,
  UNIT_FIELD_A,
  UNIT_FIELD_B,
  UNIT_GLOW,
  UNIT_LUT,
  UNIT_STAMP_A,
  UNIT_STAMP_B,
  UNIT_LOOKUP_VK,
  UNIT_LOOKUP_MAX,
  UNIT_SRC,
} from './shared';

function compositeFs(header: string, cubeMask: boolean, cubeGeometry: boolean, cubeMinPitch: number, profile = '', backgroundProfile = ''): string {
  return `${header}
uniform sampler2D u_fieldA;
uniform sampler2D u_fieldB;
uniform sampler2D u_glow;
uniform sampler2D u_lut;
uniform sampler2D u_stampA;
uniform sampler2D u_stampB;
${TD_MORPH_GLSL}
${cubeMask ? 'uniform sampler2D u_maskSource;' : ''}
uniform vec4 u_cellTex;  // xy logical cell texture size, zw 1 / allocation
uniform vec4 u_view;     // xy drawing buffer px, z quality (0 high, 1 medium, 2 low), w debug view
uniform vec4 u_output; // top-left origin and tile size in full-domain pixels
uniform float u_outputLinear; // host atlas receives linear RGB; canvas receives original sRGB
${cubeMask ? 'uniform vec4 u_brand; // same global rear-wall transition as field pass' : ''}
${cubeMask ? `uniform vec4 u_fill; // mode, opacity, gap contribution, inverse contribution
uniform vec2 u_fillEdge;
uniform vec3 u_fillVk,u_fillMax;
uniform sampler2D u_lookupVk,u_lookupMax;` : ''}
uniform vec2 u_flags;    // x opaque output, y glow on (the glow passes ran this frame)
out vec4 o_color;
${COMPOSITE_GLOW_GLSL}

${compositeBackgroundGlsl(cubeMask, backgroundProfile)}
${cubeMask ? `float fillVisibleAt(vec2 p) {
  vec2 s=clamp(p-0.5,vec2(0.0),u_cellTex.xy-1.0);
  ivec2 a=ivec2(floor(s)),b=min(a+ivec2(1),ivec2(u_cellTex.xy)-1);
  vec2 f=fract(s);
  float x0=mix(texelFetch(u_fieldB,a,0).a,texelFetch(u_fieldB,ivec2(b.x,a.y),0).a,f.x);
  float x1=mix(texelFetch(u_fieldB,ivec2(a.x,b.y),0).a,texelFetch(u_fieldB,b,0).a,f.x);
  return sat(2.0*mix(x0,x1,f.y));
}` : ''}

${profile}
void main() {
  vec2 px = u_output.xy + vec2(gl_FragCoord.x, u_output.w - gl_FragCoord.y);
  float pitch = f_grid.z;
  vec2 gp = (px - f_origin.xy) / pitch;
  ivec2 lim = ivec2(u_cellTex.xy) - 1;
  ivec2 c = clamp(ivec2(floor(gp)), ivec2(0), lim);
  vec2 hp = px - f_host.xy;
  mediump float inHost = sat(min(hp.x, f_host.z - hp.x) + 0.5) * sat(min(hp.y, f_host.w - hp.y) + 0.5);
  int dbg = int(u_view.w + 0.5);
${cubeMask ? `  if (dbg == 5) {
    // Raw grayscale mask from the same FieldPass as the final image.
    float raw=dec4(texelFetch(u_maskSource,c,0)).a;
    o_color=vec4(vec3(raw*inHost),1.0);
    return;
  }` : ''}
  bool cubic = u_view.z < 0.5;
  bool lowQ = u_view.z > 1.5;

  mediump vec3 background = compositeBackground(px,inHost,dbg==0);

  // Combined bloom + haze (saturated and weighted per cell by the bloom pass). Decoded sampling:
  // hardware filtering on float targets, decode-then-filter on RGBA8.
  mediump vec3 glow = sampleCompositeGlow(u_glow,gp,u_cellTex,cubic,u_flags.y>0.5);

  mediump vec3 cellC = vec3(0.0);
  mediump vec3 halo = vec3(0.0);
  mediump vec4 f0 = vec4(0.0);
  mediump float cellCoverage = 0.0;
  if (inHost > 0.0 || dbg == 1) {
    f0 = dec4(texelFetch(u_fieldA, c, 0));
${cubeMask && cubeGeometry ? `    if (dbg == 1 || pitch < ${cubeMinPitch.toFixed(1)} || (texelFetch(u_fieldB,c,0).b < 0.001 && texelFetch(u_fieldB,c,0).a > 0.999)) {` : ''}
    mediump vec4 b0 = texelFetch(u_fieldB, c, 0);
    float morph=tdMorphAt(f_origin.xy+(vec2(c)+.5)*pitch);
    // The pixel's offset inside its cell: pitch and origin are whole pixels, so this indexes the
    // baked cell stamp exactly. Its quadrant picks the neighbours the halo stamp was baked for.
    int ip = int(pitch + 0.5);
    ivec2 m = clamp(ivec2(floor(px - f_origin.xy)) - c * ip, ivec2(0), ivec2(ip - 1));
    ivec2 q = ivec2(2 * m.x + 1 < ip ? -1 : 1, 2 * m.y + 1 < ip ? -1 : 1);
    mediump vec4 fx = vec4(0.0);
    mediump vec4 fy = vec4(0.0);
    mediump vec4 fd = vec4(0.0);
    mediump float lit = f0.a;
    if (!lowQ) {
      fx = dec4(texelFetch(u_fieldA, clamp(c + ivec2(q.x, 0), ivec2(0), lim), 0));
      fy = dec4(texelFetch(u_fieldA, clamp(c + ivec2(0, q.y), ivec2(0), lim), 0));
      fd = dec4(texelFetch(u_fieldA, clamp(c + q, ivec2(0), lim), 0));
      lit = max(max(f0.a, fx.a), max(fy.a, fd.a));
    }
    if (lit > 0.002 || b0.b > 0.002) {
      mediump vec4 sa = texelFetch(u_stampA, m, 0);
      if(morph>0.){
        vec2 local=px-f_origin.xy-(vec2(c)+.5)*pitch;
        float hb=(1.-P_grid_gap)*.5*pitch;
        float radius=mix(sat(P_grid_roundness),1.,morph)*hb;
        float distance=sdRoundBox(local,vec2(hb),radius);
        float aw=P_grid_softness+.5;
        float body=1.-smoothstep(-aw,aw,distance);
        float dc=length(local)/max(hb,.0001);
        sa.r=body*(1.-P_grid_emitter*min(dc*dc,1.));
        sa.g*=1.-morph;sa.b=mix(sa.b,.5,morph);
      }
      cellCoverage = sa.r;
      mediump float hk = b0.g * sa.g;
      mediump vec3 cc = f0.rgb;
      if (hk > 0.002) {
        float lutX = b0.r;
        mediump vec3 hotC = ${cubeMask ? 'u_brand.x > 0.5 ? f0.rgb : texture(u_lut, vec2(lutX * (255.0 / 256.0) + 0.5 / 256.0, 0.75)).rgb' : 'texture(u_lut, vec2(lutX * (255.0 / 256.0) + 0.5 / 256.0, 0.75)).rgb'};
        // Keep the tint near the base's brightness: whitening a dark navy cell must not paint a
        // grey dot. The mix runs in a gamma-2 space: linear mixing of a little near-white into
        // saturated neon already reads pastel after the sRGB encode.
        hotC *= min(1.0, 1.6 * max3M(f0.rgb) / max(max3M(hotC), 1e-4));
        cc = sq3M(mix(sqrt(f0.rgb), sqrt(hotC), hk));
      }
      cc = cc * (f0.a * (1.0 + 0.5 * hk)) + f0.rgb * b0.b;
      mediump float bevel = P_grid_bevel;
      if (bevel > 0.0 && !lowQ) cc *= max(0.0, 1.0 + 4.0 * bevel * (2.0 * sa.b - 1.0));
      cellC = cc * sa.r;
      if (!lowQ && lit > 0.002) {
        mediump vec4 sb = texelFetch(u_stampB, m, 0);
        mediump float haloStrength = P_glow_halo_strength;
        halo = (f0.rgb * (f0.a * sb.x) + fx.rgb * (fx.a * sb.y) + fy.rgb * (fy.a * sb.z)
             + fd.rgb * (fd.a * sb.w)) * haloStrength;
      }
    }
${cubeMask ? `    if (u_fill.x > 0.5 && cellCoverage <= 0.0)
      cellCoverage = texelFetch(u_stampA, m, 0).r;` : ''}
${cubeMask && cubeGeometry ? '    }' : ''}
  }

  mediump float gs = P_glow_saturation;
  halo = saturateColorM(halo, gs);

  mediump vec3 col;
  if (dbg == 0) col = background + glow + (cellC + halo) * inHost;
  else if (dbg == 1) col = f0.rgb * f0.a;
  else if (dbg == 2) col = halo * inHost;
  else if (dbg == 3 || dbg == 4) col = glow;  // the bloom pass isolated that layer
  else col = background + cellC * inHost;

${cubeMask ? `  if (dbg == 0 && u_fill.x > 0.5 && inHost > 0.0) {
    float visible=sat(2.0*texelFetch(u_fieldB,c,0).a);
    // The fourth preset uses one continuous signal for both alpha and LUT position.
    if (u_fill.x > 2.5) visible=fillVisibleAt(gp);
    float opacity=0.0;
    if (u_fill.x < 1.5 || u_fill.x > 2.5) {
      opacity=u_fill.y*(1.0-visible);
    } else {
      float spread=3.0;
      float broad=0.25*(fillVisibleAt(gp+vec2(-spread,-spread))+
        fillVisibleAt(gp+vec2(spread,-spread))+
        fillVisibleAt(gp+vec2(-spread,spread))+
        fillVisibleAt(gp+vec2(spread,spread)));
      float envelope=smoothstep(u_fillEdge.x,u_fillEdge.y,max(broad,0.35*visible));
      opacity=u_fill.y*envelope*(u_fill.z*(1.0-cellCoverage)+u_fill.w*(1.0-smoothstep(0.15,0.9,visible)));
    }
    float brand=u_brand.x>0.5 ? smoothstep(u_brand.y,u_brand.z,px.x/f_host.z)*u_brand.w : 0.0;
    vec3 fillColor=mix(u_fillVk,u_fillMax,brand);
    if (u_fill.x > 2.5) {
      vec3 vkColor=texture(u_lookupVk,vec2(visible,0.5)).rgb;
      vec3 maxColor=texture(u_lookupMax,vec2(visible,0.5)).rgb;
      vec3 rgb=mix(vkColor,maxColor,brand);
      fillColor=mix(rgb/12.92,pow((rgb+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),rgb));
    }
    col=mix(col,fillColor,sat(opacity)*inHost);
  }` : ''}

  mediump float exposure = P_glow_exposure;
  mediump float whitePoint = P_glow_whitePoint;
  mediump vec3 tm = tonemapMaxM(col * exposure, whitePoint);
  mediump vec3 srgb = sat3M(lin2srgbM(tm) + ditherTPDF(vec2(px.x, u_view.y-px.y)));
${profile ? `  srgb=profileComposite(px-f_host.xy,f_host.zw,lin2srgbM(tonemapMaxM((cellC+halo+glow)*exposure,whitePoint)));` : ''}
  mediump float a = 1.0;
#ifdef PROFILE_ALPHA
  a = profileAlpha(px-f_host.xy,f_host.zw);
#endif
  if (u_flags.x < 0.5 && inHost < 1.0) {
    // Glow-only margin: keep valid premultiplied alpha (rgb <= a) for every compositor.
    a = max(inHost, max3M(srgb));
    srgb = min(srgb, vec3(a));
  }
  mediump vec3 host = mix(srgb/12.92, pow((srgb+0.055)/1.055,vec3(2.4)), step(vec3(0.04045),srgb));
  o_color = vec4(u_outputLinear>0.5 ? host : srgb, a);
}
`;
}

export class CompositePass {
  private readonly prog: LazyProgram;
  private readonly last = new Float32Array(12).fill(Number.NaN);

  constructor(private readonly ctx: PassContext, private readonly cubeMask = false, private readonly cubeGeometry = false, cubeMinPitch = 16, profile = '', backgroundProfile = '') {
    const gl = ctx.gl;
    this.prog = new LazyProgram(ctx, FULLSCREEN_VS, compositeFs(ctx.header, cubeMask, cubeGeometry, cubeMinPitch, profile, backgroundProfile), 'composite', (p) => {
      setSampler(gl, p, 'u_fieldA', UNIT_FIELD_A);
      setSampler(gl, p, 'u_fieldB', UNIT_FIELD_B);
      setSampler(gl, p, 'u_glow', UNIT_GLOW);
      setSampler(gl, p, 'u_lut', UNIT_LUT);
      setSampler(gl, p, 'u_stampA', UNIT_STAMP_A);
      setSampler(gl, p, 'u_stampB', UNIT_STAMP_B);
      initTdMorph(ctx,p);
      if (cubeMask) setSampler(gl, p, 'u_maskSource', UNIT_SRC);
      if (cubeMask) {
        setSampler(gl, p, 'u_lookupVk', UNIT_LOOKUP_VK);
        setSampler(gl, p, 'u_lookupMax', UNIT_LOOKUP_MAX);
      }
    });
  }

  poll(): boolean {
    return this.prog.poll();
  }

  /** Sizes are uploaded only when they change. `glow`: the glow target was rendered this frame. */
  run(
    viewW: number,
    viewH: number,
    w: number,
    h: number,
    allocW: number,
    allocH: number,
    quality: number,
    debugView: number,
    opaque: boolean,
    glow: boolean,
    output: any = null,
  ): void {
    const gl = this.ctx.gl;
    const p = this.prog.use();
    uploadTdMorph(this.ctx,p,output?.interaction);
    const l = this.last;
    if (l[0] !== w || l[1] !== h || l[2] !== allocW || l[3] !== allocH) {
      l[0] = w;
      l[1] = h;
      l[2] = allocW;
      l[3] = allocH;
      gl.uniform4f(p.uniform('u_cellTex'), w, h, 1 / allocW, 1 / allocH);
    }
    if (l[4] !== viewW || l[5] !== viewH || l[6] !== quality || l[7] !== debugView) {
      l[4] = viewW;
      l[5] = viewH;
      l[6] = quality;
      l[7] = debugView;
      gl.uniform4f(p.uniform('u_view'), viewW, viewH, quality, debugView);
    }
    const op = opaque ? 1 : 0;
    const gw = glow ? 1 : 0;
    if (l[8] !== op || l[9] !== gw) {
      l[8] = op;
      l[9] = gw;
      gl.uniform2f(p.uniform('u_flags'), op, gw);
    }
    gl.uniform4f(p.uniform('u_output'), output?.x ?? 0, output?.y ?? 0, output?.width ?? viewW, output?.height ?? viewH);
    gl.uniform1f(p.uniform('u_outputLinear'),output?.linear?1:0);
    if (this.cubeMask) gl.uniform4fv(p.uniform('u_brand'), output?.interaction?.brand ?? [0,0,1,0]);
    if (this.cubeMask) {
      const fill=output?.interaction?.fill;
      gl.uniform4fv(p.uniform('u_fill'),fill?.controls ?? [0,0,0,0]);
      gl.uniform2fv(p.uniform('u_fillEdge'),fill?.edge ?? [0,1]);
      gl.uniform3fv(p.uniform('u_fillVk'),fill?.vk ?? [0,0,0]);
      gl.uniform3fv(p.uniform('u_fillMax'),fill?.max ?? [0,0,0]);
      bindTexture(gl, UNIT_LOOKUP_VK, fill?.lookupVk ?? null);
      bindTexture(gl, UNIT_LOOKUP_MAX, fill?.lookupMax ?? null);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, output?.framebuffer ?? null);
    gl.viewport(0, 0, output?.width ?? viewW, output?.height ?? viewH);
    if (output?.blendProfile) {
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (output?.blendProfile) gl.disable(gl.BLEND);
  }

  dispose(): void {
    this.prog.dispose();
  }
}
