import { DemoAccess } from "./DemoAccess";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Sun,
  Moon,
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
      {siteConfig.name}
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
        </div>
      ))}
      <NatureMotion atmosphere={atmosphere} paused={paused} asset={asset} />
    </div>
  );
}
function TimeLabel({ lighting }: { lighting: Lighting }) {
  const Icon = lighting === "night" ? Moon : Sun;
  return (
    <span className="time-label">
      <Icon aria-hidden="true" size={14} strokeWidth={1.5} />
      {lightingLabels[lighting]}
      <span className="time-note"> / Light study</span>
    </span>
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
      {controls.paused ? (
        <Play aria-hidden="true" size={12} />
      ) : (
        <Pause aria-hidden="true" size={12} />
      )}
      <span>{controls.paused ? "Still" : "Pause"}</span>
    </button>
  );
}
function SiteFooter({ controls }: { controls?: AtmosphereControls }) {
  return (
    <footer
      className={`site-footer${controls ? " has-atmosphere" : ""}`}
      aria-label="Site information"
    >
      <span>
        © {new Date().getFullYear()} {siteConfig.copyrightOwner}.
        <span className="copyright-rights"> All rights reserved.</span>
      </span>
      {controls && (
        <span className="atmosphere-controls">
          <TimeLabel lighting={controls.atmosphere.lighting} />
          <MotionControl controls={controls} />
        </span>
      )}
      {siteConfig.contactEmail ? (
        <a
          className="footer-contact"
          href={`mailto:${siteConfig.contactEmail}`}
        >
          {siteConfig.contactEmail}{" "}
          <ArrowUpRight aria-hidden="true" size={12} />
        </a>
      ) : (
        <span className="footer-contact">Enquiries · Email coming soon</span>
      )}
    </footer>
  );
}
function Landing({ controls }: { controls: AtmosphereControls }) {
  const { atmosphere, paused } = controls;
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
            <a className="nav-demo" href="#/demo">
              Enter demo <ArrowUpRight aria-hidden="true" size={16} />
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
            <em>see for yourself.</em>
          </h1>
          <p className="hero-description">
            Beyond the drawings. Before the build.
            <br />
            Explore a home from every angle.
          </p>
          <a className="button button-bronze" href="#/demo">
            Enter the demo <ArrowUpRight aria-hidden="true" size={19} />
          </a>
          <span className="hero-availability">
            Exterior studio · Explore and customize
          </span>
        </div>
        <div className="hero-footer">
          <SiteFooter controls={controls} />
        </div>
      </main>
    </>
  );
}
function BrowserDemo() {
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [unlocked,setUnlocked]=useState(false);
  return (
    <div className="browser-demo-page">
      <header className="browser-demo-header">
        <Brand />
        <span className="browser-demo-label">The exterior studio</span>
        <a className="back-link" href="#/"><ArrowLeft aria-hidden="true" size={16} /> Back to home</a>
      </header>
      <main id="main-content" tabIndex={-1} className="browser-demo-main" aria-label="Interactive exterior home studio">
        {unlocked && !frameLoaded && <div className="browser-demo-loading" role="status">Opening your exterior studio…</div>}
        {unlocked ? <iframe
          title="Coastal Residence — customize and explore the exterior"
          src={`${import.meta.env.BASE_URL}browser-demo/index.html`}
          allow="fullscreen"
          allowFullScreen
          onLoad={() => setFrameLoaded(true)}
        /> : <div className="browser-demo-gate"><img src={`${import.meta.env.BASE_URL}browser-demo/home-preview.webp`} alt="Preview of the exterior model" /><DemoAccess onUnlock={()=>setUnlocked(true)} /></div>}
      </main>
    </div>
  );
}
export function App() {
  const [hash, setHash] = useState(window.location.hash);
  const controls = useAtmosphere();
  const demo = hash === "#/demo" || hash === "#/simulation";
  useEffect(() => {
    const route = () => setHash(window.location.hash);
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    document.title = demo ? `The exterior studio — ${siteConfig.name}` : `${siteConfig.name} — From vision to presence`;
    if (hash === "#main-content")
      document.getElementById("main-content")?.focus();
    else window.scrollTo(0, 0);
  }, [hash, demo]);
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
      {demo ? (<BrowserDemo />) : (
        <Landing controls={controls} />
      )}
    </>
  );
}
