import { createRoot } from "react-dom/client";
import { App } from "../App";

if (!import.meta.env.DEV)
  throw new Error(
    "Mobile viewport review is available in local development only.",
  );

// Reproduce safe-area geometry without pretending to emulate Safari's chrome.
// Query format: ?safe=top,right,bottom,left, in CSS pixels.
const insets =
  new URLSearchParams(location.search).get("safe")?.split(",") ?? [];
["top", "right", "bottom", "left"].forEach((edge, index) => {
  const value = Number(insets[index] ?? 0);
  if (Number.isFinite(value) && value >= 0 && value <= 200)
    document.documentElement.style.setProperty(`--safe-${edge}`, `${value}px`);
});
createRoot(document.getElementById("root")!).render(<App />);
