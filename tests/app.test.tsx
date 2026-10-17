import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { App } from "../src/App";
import { useAtmosphere } from "../src/useAtmosphere";
import { siteConfig } from "../src/config";

const configuredHash = siteConfig.demoPasswordHash;

let root: Root;
let container: HTMLDivElement;
let reduced = false;
let preferenceListeners: (() => void)[];
function Probe() {
  const controls = useAtmosphere();
  return (
    <>
      <output>{controls.atmosphere.lighting}</output>
      <button onClick={controls.toggle}>
        {controls.paused ? "Play" : "Pause"}
      </button>
    </>
  );
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("crypto", webcrypto);
  siteConfig.demoPasswordHash = createHash("sha256").update("test-access").digest("hex");
  vi.useFakeTimers({ toFake: ["performance", "setInterval", "clearInterval"] });
  reduced = false;
  preferenceListeners = [];
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_event: string, listener: () => void) =>
      preferenceListeners.push(listener),
    removeEventListener: (_event: string, listener: () => void) => {
      preferenceListeners = preferenceListeners.filter((l) => l !== listener);
    },
  }));
  vi.stubGlobal("scrollTo", vi.fn());
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  window.history.replaceState(null, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  siteConfig.demoPasswordHash = configuredHash;
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

test("cycle advances, pauses, and resumes without jumping", () => {
  act(() => root.render(<Probe />));
  expect(container.querySelector("output")?.textContent).toBe("morning");
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("day");
  act(() => container.querySelector("button")!.click());
  advance(80_000);
  expect(container.querySelector("output")?.textContent).toBe("day");
  act(() => container.querySelector("button")!.click());
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("dusk");
});
test("hidden tabs pause the cycle and resume from the same moment", () => {
  act(() => root.render(<Probe />));
  advance(20_000);
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: true,
  });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  advance(600_000);
  expect(container.querySelector("output")?.textContent).toBe("day");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("dusk");
});
test("reduced-motion preference freezes the atmosphere and responds to changes", () => {
  reduced = true;
  act(() => root.render(<Probe />));
  advance(80_000);
  expect(container.querySelector("output")?.textContent).toBe("morning");
  reduced = false;
  act(() => preferenceListeners.forEach((listener) => listener()));
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("day");
});
test("the replacement keeps the existing access gate and never opens Vagon", async () => {
  reduced = true;
  window.history.replaceState(null, "", "/#/demo");
  act(() => root.render(<App />));
  expect(container.querySelector("iframe")).toBeNull();
  const password=container.querySelector<HTMLInputElement>("#stream-password")!;
  password.value="wrong-password";
  await act(async()=>{container.querySelector<HTMLFormElement>("form")!.requestSubmit();await new Promise(r=>setTimeout(r,20));});
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("didn’t match");
  password.value="test-access";
  await act(async()=>{container.querySelector<HTMLFormElement>("form")!.requestSubmit();await new Promise(r=>setTimeout(r,20));});
  const frame=container.querySelector<HTMLIFrameElement>("iframe")!;
  expect(frame.getAttribute("src")).toBe("/browser-demo/index.html");
  expect(frame.getAttribute("allow")).toBe("fullscreen");
  expect(frame.src).not.toContain("vagon");
  expect(document.title).toBe("The exterior studio — DREAM VIEW");
  act(()=>{window.history.replaceState(null,"","/#/");window.dispatchEvent(new HashChangeEvent("hashchange"));});
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector("#hero-title")?.textContent).toContain("see for yourself.");
  act(()=>{window.history.replaceState(null,"","/#/simulation");window.dispatchEvent(new HashChangeEvent("hashchange"));});
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector("#stream-password")).not.toBeNull();
});
