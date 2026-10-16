import { useEffect, useRef, useState } from "react";
import { getAtmosphere } from "./lighting";
export function useAtmosphere() {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const elapsedRef = useRef(0);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(preference.matches);
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (paused || reduced) return;
    let last = performance.now();
    const visibility = () => {
      last = performance.now();
    };
    const timer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden) {
        elapsedRef.current += now - last;
        setElapsed(elapsedRef.current);
      }
      last = now;
    }, 250);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [paused, reduced]);
  return {
    atmosphere: getAtmosphere(elapsed),
    paused: paused || reduced,
    reduced,
    toggle: () => setPaused((value) => !value),
  };
}
