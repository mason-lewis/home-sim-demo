import { cycleOrder, type Atmosphere, type Lighting } from "../lighting";
import { coverTransform, imagePoint, renderSize } from "./geometry";
import { NatureSimulation } from "./simulation";
import { fragmentShader, vertexShader } from "./shaders";

interface Options {
  atmosphere: Atmosphere;
  paused: boolean;
}
interface RendererConfig {
  canvas: HTMLCanvasElement;
  images: Record<Lighting, string>;
  mask: string;
  simulation: NatureSimulation;
  options: () => Options;
  ready: (ready: boolean) => void;
}
export function createNatureRenderer(config: RendererConfig) {
  const { canvas, simulation, options } = config;
  const context = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!context) return () => {};
  const gl = context;
  let disposed = false,
    loaded = false,
    frame = 0,
    last = 0,
    lastDraw = 0,
    announced = false;
  const textures: WebGLTexture[] = [];
  const shaders: WebGLShader[] = [];
  let buffer: WebGLBuffer | null = null,
    program: WebGLProgram | null = null;
  const fail = () => {
    loaded = false;
    if (!disposed) config.ready(false);
  };
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Shader allocation failed");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error("Nature shader compilation failed");
    return shader;
  };
  let uniforms: Record<string, WebGLUniformLocation | null> = {};
  try {
    program = gl.createProgram();
    if (!program) throw new Error("Program allocation failed");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Nature shader linking failed");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    uniforms = Object.fromEntries(
      [
        "currentImage",
        "nextImage",
        "motionMask",
        "blend",
        "time",
        "wind",
        "sway",
        "scale",
        "offset",
        "ripples[0]",
      ].map((name) => [name, gl.getUniformLocation(program!, name)]),
    );
  } catch {
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    return () => {};
  }
  const load = (src: string) =>
    new Promise<{ texture: WebGLTexture; width: number; height: number }>(
      (resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          if (disposed) return;
          const texture = gl.createTexture();
          if (!texture) {
            reject(new Error("Texture allocation failed"));
            return;
          }
          textures.push(texture);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image,
          );
          resolve({
            texture,
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
        };
        image.onerror = () => reject(new Error("Nature asset unavailable"));
        image.src = src;
      },
    );
  let images: Record<
    Lighting,
    { texture: WebGLTexture; width: number; height: number }
  >;
  let mask: WebGLTexture;
  let displayedScene: Lighting = cycleOrder[0],
    displayedBlend = 0;
  const order = cycleOrder;
  Promise.all([
    ...order.map((scene) => load(config.images[scene])),
    load(config.mask),
  ])
    .then((results) => {
      if (disposed) return;
      images = Object.fromEntries(
        order.map((scene, i) => [scene, results[i]]),
      ) as typeof images;
      mask = results[4].texture;
      loaded = true;
      last = performance.now();
      frame = requestAnimationFrame(render);
    })
    .catch(fail);
  const bind = (unit: number, texture: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
  };
  function transform() {
    const rect = canvas.getBoundingClientRect();
    const position =
      rect.width <= 640 && Boolean(canvas.closest(".hero")) ? 0.65 : 0.5;
    return coverTransform(
      rect.width,
      rect.height,
      images.day.width,
      images.day.height,
      position,
    );
  }
  function render(now: number) {
    if (disposed || document.hidden || !loaded) return;
    frame = requestAnimationFrame(render);
    if (now - lastDraw < 32) return;
    const dt = Math.min((now - last) / 1000, 0.075);
    last = now;
    lastDraw = now;
    const state = options();
    if (!state.paused) simulation.advance(dt);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { width, height } = renderSize(
      rect.width,
      rect.height,
      devicePixelRatio,
    );
    const resized = canvas.width !== width || canvas.height !== height;
    if (resized) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    const cover = transform();
    if (state.paused && announced && !resized) return;
    gl.useProgram(program);
    bind(0, images[state.atmosphere.current].texture);
    bind(1, images[state.atmosphere.next].texture);
    bind(2, mask);
    gl.uniform1i(uniforms.currentImage, 0);
    gl.uniform1i(uniforms.nextImage, 1);
    gl.uniform1i(uniforms.motionMask, 2);
    if (displayedScene !== state.atmosphere.current) {
      displayedScene = state.atmosphere.current;
      displayedBlend = 0;
    }
    displayedBlend = state.paused
      ? state.atmosphere.blend
      : displayedBlend +
        (state.atmosphere.blend - displayedBlend) * (1 - Math.exp(-dt * 14));
    gl.uniform1f(uniforms.blend, displayedBlend);
    gl.uniform1f(uniforms.time, simulation.time);
    gl.uniform1f(uniforms.wind, simulation.wind);
    gl.uniform3f(
      uniforms.sway,
      simulation.sway[0],
      simulation.sway[1],
      simulation.sway[2],
    );
    gl.uniform2f(uniforms.scale, cover.scale[0], cover.scale[1]);
    gl.uniform2f(uniforms.offset, cover.offset[0], cover.offset[1]);
    gl.uniform4fv(uniforms["ripples[0]"], simulation.rippleUniforms());
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (!announced) {
      announced = true;
      config.ready(true);
    }
  }
  const pointerHost = canvas.closest(".hero, .viewer") ?? canvas;
  const disturb = (event: Event) => {
    if (!loaded || options().paused) return;
    const pointer = event as PointerEvent;
    if (pointer.pointerType === "touch" && event.type !== "pointerdown") return;
    const rect = canvas.getBoundingClientRect();
    const uv = [
      (pointer.clientX - rect.left) / rect.width,
      (pointer.clientY - rect.top) / rect.height,
    ] as const;
    simulation.disturb(imagePoint(uv, transform()));
  };
  const leave = () => simulation.leave();
  const visibility = () => {
    cancelAnimationFrame(frame);
    last = performance.now();
    if (!document.hidden && loaded) frame = requestAnimationFrame(render);
  };
  const lost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    fail();
  };
  pointerHost.addEventListener("pointermove", disturb);
  pointerHost.addEventListener("pointerdown", disturb);
  pointerHost.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", lost);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    pointerHost.removeEventListener("pointermove", disturb);
    pointerHost.removeEventListener("pointerdown", disturb);
    pointerHost.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("webglcontextlost", lost);
    textures.forEach((texture) => gl.deleteTexture(texture));
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };
}
