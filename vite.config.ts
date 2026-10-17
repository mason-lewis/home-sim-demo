import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const assetRevision = createHash("sha256").update(readFileSync(resolve(import.meta.dirname, "public/browser-demo/release-manifest.json"))).digest("hex").slice(0, 12);
export default defineConfig({
  plugins:[react(), {name:"version-demo-preview",transformIndexHtml:html=>html.replace('href="./home-preview.webp"',`href="./home-preview.webp?v=${assetRevision}"`)}],base:"./",
  define:{__DEMO_ASSET_REVISION__:JSON.stringify(assetRevision)},
  build:{rollupOptions:{input:{site:resolve(import.meta.dirname,"index.html"),studio:resolve(import.meta.dirname,"browser-demo/index.html")},output:{manualChunks:{graphics:["three"]}}}},
});
