import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default defineConfig({
  plugins:[react()],base:"./",
  build:{rollupOptions:{input:{site:resolve(import.meta.dirname,"index.html"),studio:resolve(import.meta.dirname,"browser-demo/index.html")},output:{manualChunks:{graphics:["three"]}}}},
});
