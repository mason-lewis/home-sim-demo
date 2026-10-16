import { useEffect, useRef, useState } from "react";
import { cycleOrder, type Atmosphere, type Lighting } from "./lighting";
import { createNatureRenderer } from "./nature/renderer";
import { NatureSimulation } from "./nature/simulation";
interface Props {
  atmosphere: Atmosphere;
  paused: boolean;
  asset: (name: string) => string;
}
export function NatureMotion({ atmosphere, paused, asset }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef({ atmosphere, paused });
  current.current = { atmosphere, paused };
  const simulation = useRef<NatureSimulation | null>(null);
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width: 640px)").matches,
  );
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const size = matchMedia("(max-width: 640px)"),
      motion = matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => setMobile(size.matches),
      preference = () => setReduced(motion.matches);
    size.addEventListener("change", resize);
    motion.addEventListener("change", preference);
    return () => {
      size.removeEventListener("change", resize);
      motion.removeEventListener("change", preference);
    };
  }, []);
  useEffect(() => {
    setReady(false);
    if (!canvas.current || reduced) return;
    simulation.current ??= new NatureSimulation();
    const images = Object.fromEntries(
      cycleOrder.map((scene) => [
        scene,
        asset(`residence-${scene}${mobile ? "-mobile" : ""}.webp`),
      ]),
    ) as Record<Lighting, string>;
    return createNatureRenderer({
      canvas: canvas.current,
      images,
      mask: asset("nature-mask.webp"),
      simulation: simulation.current,
      options: () => current.current,
      ready: setReady,
    });
  }, [mobile, reduced, asset]);
  return (
    <canvas
      ref={canvas}
      className={`nature-motion ${ready ? "is-ready" : ""}`}
      data-motion={reduced ? "reduced" : paused ? "paused" : "ambient"}
      aria-hidden="true"
    />
  );
}
