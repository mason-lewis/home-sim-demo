import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
} from "lucide-react";
import { lightingLabels, type Lighting, type Atmosphere } from "./lighting";
import { useAtmosphere } from "./useAtmosphere";
import { siteConfig } from "./config";
import "@fontsource/dm-sans/latin-300.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/manrope/latin-300.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "./styles.css";
import { NatureMotion } from "./NatureMotion";

const asset = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;
const scenes: Lighting[] = ["morning", "day", "dusk", "night"];

function Brand() {
  return (
    <a className="brand" href="#/" aria-label={`${siteConfig.name} home`}>
      {siteConfig.name.split("/").map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>/</span>}
          {part.trim()}
        </React.Fragment>
      ))}
    </a>
  );
}
function Scene({
  atmosphere,
  paused,
  className = "",
}: {
  atmosphere: Atmosphere;
  paused: boolean;
  className?: string;
}) {
  const { lighting, weights } = atmosphere;
  const [loaded, setLoaded] = useState<Partial<Record<Lighting, boolean>>>({});
  return (
    <div className={`scene ${className}`} aria-hidden="true">
      {scenes.map((scene) => (
        <div
          key={scene}
          className="scene-layer"
          style={{
            opacity: loaded[scene] ? weights[scene] : 0,
            zIndex: weights[scene] === 1 ? 0 : 1,
          }}
        >
          <picture>
            <source
              media="(max-width: 640px)"
              srcSet={asset(`residence-${scene}-mobile.webp`)}
            />
            <img
              src={asset(`residence-${scene}.webp`)}
              alt=""
              onLoad={() => setLoaded((prev) => ({ ...prev, [scene]: true }))}
              fetchPriority={scene === lighting ? "high" : "low"}
              decoding="async"
            />
          </picture>
          <NatureMotion
            src={asset(`residence-${scene}.webp`)}
            mobileSrc={asset(`residence-${scene}-mobile.webp`)}
            active={!paused && weights[scene] > 0 && Boolean(loaded[scene])}
          />
        </div>
      ))}
    </div>
  );
}
function TimeLabel({ lighting }: { lighting: Lighting }) {
  const Icon = lighting === "night" ? Moon : Sun;
  return (
    <span className="time-label">
      <Icon size={14} strokeWidth={1.5} />
      {lightingLabels[lighting]}
      <span className="time-note"> / Light in motion</span>
    </span>
  );
}
function Footer() {
  return (
    <footer>
      <Brand />
      <span>An architectural walkthrough demo.</span>
      <span>
        © {new Date().getFullYear()} {siteConfig.name}
      </span>
    </footer>
  );
}
type AtmosphereControls = ReturnType<typeof useAtmosphere>;
function MotionControl({ controls }: { controls: AtmosphereControls }) {
  return (
    <button
      className="motion-control"
      onClick={controls.toggle}
      disabled={controls.reduced}
      aria-label={
        controls.reduced
          ? "Atmosphere paused for reduced motion"
          : controls.paused
            ? "Play atmosphere"
            : "Pause atmosphere"
      }
      aria-pressed={controls.paused}
    >
      {controls.paused ? <Play size={12} /> : <Pause size={12} />}
      <span>{controls.paused ? "Still" : "Pause"}</span>
    </button>
  );
}
function Landing({ controls }: { controls: AtmosphereControls }) {
  const { atmosphere, paused } = controls;
  const { lighting } = atmosphere;
  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className="hero"
        aria-labelledby="hero-title"
      >
        <Scene atmosphere={atmosphere} paused={paused} />
        <div className="hero-shade" />
        <header className="main-header">
          <Brand />
          <nav aria-label="Main navigation">
            <a className="nav-demo" href="#/simulation">
              Enter demo <ArrowUpRight size={16} />
            </a>
          </nav>
        </header>
        <div className="hero-content">
          <p className="eyebrow">
            <span className="short-rule" /> A new perspective on home
          </p>
          <h1 id="hero-title">
            Some things
            <br />
            you have to
            <br />
            <em>step inside.</em>
          </h1>
          <p className="hero-description">
            Beyond the drawings. Before the build.
            <br />
            Experience a home from within.
          </p>
          <a className="button button-bronze" href="#/simulation">
            Enter the demo <ArrowUpRight size={19} />
          </a>
          <span className="hero-availability">
            Architectural walkthrough · Demo preview
          </span>
        </div>
        <div className="hero-bottom">
          <span className="concept-label">
            <span className="status-dot" />
            The hillside residence <span>/</span> Illustrative concept
          </span>
          <span className="atmosphere-controls">
            <TimeLabel lighting={lighting} />
            <MotionControl controls={controls} />
          </span>
          <span className="entry-note">A home, before it’s built.</span>
        </div>
      </main>
    </>
  );
}
function Simulation({ controls }: { controls: AtmosphereControls }) {
  const { atmosphere, paused } = controls;
  const { lighting } = atmosphere;
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.getElementById("viewer")?.requestFullscreen();
      setFullscreenError("");
    } catch {
      setFullscreenError("Fullscreen is unavailable in this browser.");
    }
  };
  return (
    <div className="simulation-page">
      <header className="simulation-header">
        <Brand />
        <a className="back-link" href="#/">
          <ArrowLeft size={16} /> Back to home
        </a>
      </header>
      <main id="main-content" tabIndex={-1} className="simulation-main">
        <div className="viewer-heading">
          <div>
            <p className="eyebrow">THE DEMO RESIDENCE</p>
            <h1>
              A space to <em>step into.</em>
            </h1>
          </div>
          <span className="atmosphere-controls">
            <TimeLabel lighting={lighting} />
            <MotionControl controls={controls} />
          </span>
        </div>
        <section
          id="viewer"
          className="viewer"
          aria-label="Architectural walkthrough viewer"
        >
          {siteConfig.streamUrl ? (
            <iframe
              title="Interactive home walkthrough"
              src={siteConfig.streamUrl}
              allowFullScreen
            />
          ) : (
            <>
              <Scene atmosphere={atmosphere} paused={paused} />
              <div className="viewer-shade" />
              <div className="viewer-placeholder">
                <span className="viewer-mark" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <p className="eyebrow">A NEW PERSPECTIVE IS ON ITS WAY</p>
                <h2>
                  Walkthrough
                  <br />
                  <em>coming soon.</em>
                </h2>
                <p>
                  We’re preparing the home for your first visit.
                  <br />
                  The interactive experience will be available here.
                </p>
                <a className="text-link" href="#/">
                  Return home <ArrowRight size={17} />
                </a>
              </div>
            </>
          )}
          <div className="viewer-toolbar">
            <span>
              <span className="status-dot" />
              {siteConfig.streamUrl
                ? "Interactive walkthrough"
                : "Preview / Stream not connected"}
            </span>
            {typeof document.documentElement.requestFullscreen ===
              "function" && (
              <button
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit fullscreen" : "Expand viewer"}
              >
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                <span>{fullscreen ? "Exit fullscreen" : "Expand"}</span>
              </button>
            )}
          </div>
        </section>
        {fullscreenError && <p role="status">{fullscreenError}</p>}
        <div className="viewer-notes">
          <span>
            THE HILLSIDE RESIDENCE{" "}
            <span className="muted"> / Illustrative concept</span>
          </span>
          <p>
            This is a preview of the demo environment. The live walkthrough is
            not yet connected.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
export function App() {
  const [hash, setHash] = useState(window.location.hash);
  const controls = useAtmosphere();
  const simulation = hash === "#/simulation";
  useEffect(() => {
    const route = () => setHash(window.location.hash);
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    document.title = simulation
      ? `The walkthrough — ${siteConfig.name}`
      : `${siteConfig.name} — From vision to presence`;
    if (hash === "#main-content")
      document.getElementById("main-content")?.focus();
    else window.scrollTo(0, 0);
  }, [hash, simulation]);
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {simulation ? (
        <Simulation controls={controls} />
      ) : (
        <Landing controls={controls} />
      )}
    </>
  );
}
