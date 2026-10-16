import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "../src/App";
import { useAtmosphere } from "../src/useAtmosphere";

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
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

test("cycle advances, pauses, and resumes without jumping", () => {
  act(() => root.render(<Probe />));
  expect(container.querySelector("output")?.textContent).toBe("dusk");
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("night");
  act(() => container.querySelector("button")!.click());
  advance(80_000);
  expect(container.querySelector("output")?.textContent).toBe("night");
  act(() => container.querySelector("button")!.click());
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("morning");
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
  expect(container.querySelector("output")?.textContent).toBe("night");
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("morning");
});
test("reduced-motion preference freezes the atmosphere and responds to changes", () => {
  reduced = true;
  act(() => root.render(<Probe />));
  advance(80_000);
  expect(container.querySelector("output")?.textContent).toBe("dusk");
  reduced = false;
  act(() => preferenceListeners.forEach((listener) => listener()));
  advance(20_000);
  expect(container.querySelector("output")?.textContent).toBe("night");
});
test("simulation route has a clear unavailable state and no iframe", () => {
  reduced = true;
  window.history.replaceState(null, "", "/#/simulation");
  act(() => root.render(<App />));
  expect(container.textContent).toContain("Walkthroughcoming soon.");
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.textContent).toContain("Stream not connected");
  expect(document.title).toBe("The walkthrough — FORM / SPACE");
  act(() => {
    window.history.replaceState(null, "", "/#/");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(container.querySelector("#hero-title")?.textContent).toContain(
    "step inside.",
  );
});
