import { useEffect, useRef } from "react";

// Small, localized texture displacements keep the residence still while its
// natural surroundings move. The original image remains the no-WebGL fallback.
export function NatureMotion({
  src,
  mobileSrc,
  active,
}: {
  src: string;
  mobileSrc: string;
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return;
    const vert = `attribute vec2 p; varying vec2 uv; void main(){uv=vec2((p.x+1.0)*0.5,(1.0-p.y)*0.5);gl_Position=vec4(p,0.,1.);}`;
    const frag = `precision highp float;
      varying vec2 uv; uniform sampler2D image; uniform float time;
      uniform vec2 scale; uniform vec2 offset; uniform vec2 pointer; uniform float hover;
      float band(float a,float b,float x){return smoothstep(a,b,x);}
      void main(){
        vec2 q=uv*scale+offset;
        // Regions are in the original photograph, independent of screen crop.
        float water=band(.44,.48,q.x)*(1.-band(.96,1.,q.x))*band(.765,.79,q.y)*(1.-band(.93,.95,q.y));
        // A sloping upper pool edge excludes the stone terrace.
        water*=band(.765+.055*(1.-q.x),.785+.055*(1.-q.x),q.y);
        float canopy=band(.40,.48,q.x)*(1.-band(.095,.16,q.y));
        canopy=max(canopy,band(.89,.95,q.x)*(1.-band(.30,.37,q.y)));
        float shrubs=(1.-band(.30,.40,q.x))*band(.68,.83,q.y);
        shrubs=max(shrubs,band(.92,.98,q.y));
        float foliage=max(canopy,shrubs);
        vec2 delta=(uv-pointer)*vec2(1.7,1.);
        float radius=length(delta); float influence=exp(-radius*radius*65.)*hover;
        float wind=sin(time*.8+q.y*19.+q.x*12.)*.00085+sin(time*1.7+q.x*45.)*.00035;
        vec2 motion=vec2(wind,wind*.28)*foliage*(1.+influence*3.5);
        motion+=vec2(sin(q.y*360.+time*1.2)*.00055,cos(q.x*210.+time*.9)*.0006)*water;
        motion+=normalize(delta+vec2(.0001))*sin(radius*110.-time*5.)*.0017*influence*water;
        float mask=max(water,foliage);
        gl_FragColor=vec4(texture2D(image,clamp(q+motion,0.,1.)).rgb,mask);
      }`;
    const shader = (type: number, source: string) => {
      const result = gl.createShader(type)!;
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
        gl.deleteShader(result);
        return null;
      }
      return result;
    };
    const vs = shader(gl.VERTEX_SHADER, vert),
      fs = shader(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const p = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const uniforms = Object.fromEntries(
      ["time", "scale", "offset", "pointer", "hover"].map((name) => [
        name,
        gl.getUniformLocation(program, name),
      ]),
    );
    const img = new Image();
    let ready = false,
      frame = 0,
      last = 0;
    let hover = 0,
      targetHover = 0;
    let pointer = [-0.5, -0.5];
    const mobile = matchMedia("(max-width: 640px)");
    const load = () => {
      ready = false;
      img.src = mobile.matches ? mobileSrc : src;
    };
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      ready = true;
    };
    load();
    mobile.addEventListener("change", load);
    const host = canvas.parentElement!;
    const pointerHost = canvas.closest(".hero, .viewer") ?? host;
    const move = (rawEvent: Event) => {
      const event = rawEvent as PointerEvent;
      if (event.pointerType === "touch") return;
      const r = host.getBoundingClientRect();
      pointer = [
        (event.clientX - r.left) / r.width,
        (event.clientY - r.top) / r.height,
      ];
      targetHover = 1;
    };
    const leave = () => {
      targetHover = 0;
    };
    pointerHost.addEventListener("pointermove", move);
    pointerHost.addEventListener("pointerleave", leave);
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (!ready || document.hidden || now - last < 40) return;
      last = now;
      hover += (targetHover - hover) * 0.12;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const dpr = Math.min(devicePixelRatio, 1.5);
      const w = Math.round(width * dpr),
        h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      const cover = Math.max(
        width / img.naturalWidth,
        height / img.naturalHeight,
      );
      const sx = width / (img.naturalWidth * cover),
        sy = height / (img.naturalHeight * cover);
      const position =
        mobile.matches && Boolean(host.closest(".hero")) ? 0.65 : 0.5;
      gl.uniform2f(uniforms.scale, sx, sy);
      gl.uniform2f(uniforms.offset, (1 - sx) * position, (1 - sy) * 0.5);
      gl.uniform1f(uniforms.time, now / 1000);
      gl.uniform2f(uniforms.pointer, pointer[0], pointer[1]);
      gl.uniform1f(uniforms.hover, hover);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    frame = requestAnimationFrame(render);
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => {
      if (preference.matches) {
        cancelAnimationFrame(frame);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(render);
      }
    };
    preference.addEventListener("change", reduce);
    return () => {
      cancelAnimationFrame(frame);
      pointerHost.removeEventListener("pointermove", move);
      pointerHost.removeEventListener("pointerleave", leave);
      mobile.removeEventListener("change", load);
      preference.removeEventListener("change", reduce);
      img.onload = null;
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [src, mobileSrc, active]);
  return (
    <canvas className="nature-motion" ref={canvasRef} aria-hidden="true" />
  );
}
