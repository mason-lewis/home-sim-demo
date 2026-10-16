import { createNatureRenderer } from "../nature/renderer";
import { NatureSimulation } from "../nature/simulation";
import type { Atmosphere, Lighting } from "../lighting";

if (!import.meta.env.DEV)
  throw new Error("Motion review is available in local development only.");
const root = document.getElementById("review")!;
root.innerHTML = `<style>body{margin:0;background:#141917;color:#efeee7;font:14px system-ui}header{display:flex;align-items:center;gap:16px;padding:12px 20px;flex-wrap:wrap}h1{font-size:17px;margin:0 auto 0 0}button,select,a{font:inherit;padding:10px 14px;color:inherit;background:#343f31;border:1px solid #839276;cursor:pointer;text-decoration:none}#stage{width:100%;aspect-ratio:1672/941;position:relative}canvas{position:absolute;width:100%;height:100%}video{display:block;max-width:100%;margin:16px auto}#recording{font-size:12px;color:#cdd5c5}#download[hidden],video[hidden]{display:none}</style>
<header><h1>Local motion review · normal speed</h1><label>Lighting <select id="lighting"><option value="day">Day</option><option value="dusk">Dusk</option><option value="night">Night</option><option value="morning">Morning</option></select></label><button id="record" disabled>Record 12 seconds</button><span id="recording" role="status">Loading renderer</span><a id="download" download="motion-review.webm" hidden>Download recording</a></header><div id="stage"><canvas aria-label="Live nature motion"></canvas></div><video id="playback" controls muted loop hidden aria-label="Recorded motion review"></video>`;
const canvas = root.querySelector("canvas")!;
let lighting: Lighting = "day";
const atmosphere = (): Atmosphere => ({
  current: lighting,
  next: lighting,
  blend: 0,
  lighting,
  weights: {
    morning: lighting === "morning" ? 1 : 0,
    day: lighting === "day" ? 1 : 0,
    dusk: lighting === "dusk" ? 1 : 0,
    night: lighting === "night" ? 1 : 0,
  },
});
const record = document.querySelector<HTMLButtonElement>("#record")!;
const status = document.querySelector("#recording")!;
const download = document.querySelector<HTMLAnchorElement>("#download")!;
const playback = document.querySelector<HTMLVideoElement>("#playback")!;
const simulation = new NatureSimulation(42);
let url = "";
const dispose = createNatureRenderer({
  canvas,
  images: Object.fromEntries(
    (["day", "dusk", "night", "morning"] as Lighting[]).map((scene) => [
      scene,
      `/images/residence-${scene}.webp`,
    ]),
  ) as Record<Lighting, string>,
  mask: "/images/nature-mask.svg",
  simulation,
  options: () => ({ atmosphere: atmosphere(), paused: false }),
  ready: (ready) => {
    status.textContent = ready
      ? "Ready · no pointer input required"
      : "Renderer unavailable";
    record.disabled = !ready;
  },
});
document
  .querySelector<HTMLSelectElement>("#lighting")!
  .addEventListener("change", (event) => {
    lighting = (event.target as HTMLSelectElement).value as Lighting;
  });
record.addEventListener("click", () => {
  record.disabled = true;
  download.hidden = true;
  playback.hidden = true;
  const stream = canvas.captureStream(30);
  const mimeType = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
    download.href = url;
    download.hidden = false;
    playback.src = url;
    playback.hidden = false;
    record.disabled = false;
    status.textContent = "Recording ready · 12 seconds at normal speed";
  };
  recorder.start(250);
  status.textContent = "Recording · keep the cursor outside the image";
  window.setTimeout(() => recorder.stop(), 12_000);
});
window.addEventListener("beforeunload", () => {
  dispose();
  if (url) URL.revokeObjectURL(url);
});
