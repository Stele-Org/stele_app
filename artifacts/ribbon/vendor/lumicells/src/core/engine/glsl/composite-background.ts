export function compositeBackgroundGlsl(cubeMask: boolean, backgroundProfile = ''): string { return `
mediump vec3 spot(mediump vec2 bp, mediump vec2 pos, mediump vec3 color, mediump float radius,
                  mediump float strength) {
  mediump vec2 d = bp - pos;
  mediump float r = max(radius, 1e-3);
  return color * (strength * exp2(-2.885 * dot(d, d) / (r * r)));
}


${backgroundProfile}
mediump vec3 compositeBackground(vec2 px, float inHost, bool useProfile) {
  // Background in host-centered mode units; the vignette touches background and haze only (the
  // glow's haze share carries it already).
  mediump vec2 bp = (px - f_space.xy) * f_space.z;
  mediump vec2 nuv = (px - f_space.xy) / max(0.5 * f_host.zw, vec2(1.0));
  mediump float vigAmount = P_background_vignette;
  mediump float vig = 1.0 - vigAmount * smoothstep(0.5, 1.45, length(nuv));
  mediump vec3 bg = P_background_color;
${cubeMask ? `  if (u_brand.x > 0.5) {
    float brand=smoothstep(u_brand.y,u_brand.z,px.x/f_host.z)*u_brand.w;
    // The stage underlay stays dark; colored light comes from cells and their glow.
    mediump vec3 vkBg=vec3(0.0003,0.0015,0.0137);
    mediump vec3 maxBg=vec3(0.004,0.0,0.0103);
    bg=mix(vkBg,maxBg,brand);
  }` : `  bg += spot(bp, P_background_spotA_position, P_background_spotA_color, P_background_spotA_radius, P_background_spotA_strength)
      + spot(bp, P_background_spotB_position, P_background_spotB_color, P_background_spotB_radius, P_background_spotB_strength);`}

  return ${backgroundProfile ? 'useProfile ? profileUnderlay(px-f_host.xy,f_host.zw,bg*(inHost*vig)) : bg*(inHost*vig)' : 'bg*(inHost*vig)'};
}
`; }
