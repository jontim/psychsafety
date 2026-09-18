import { defineConfig } from "vite";
import path from "node:path";

const here = import.meta.dirname;

export default defineConfig({
  root: path.resolve(here, "src/web"),
  publicDir: path.resolve(here, "public"),
  build: { outDir: path.resolve(here, "dist"), emptyOutDir: true },
  server: {
    port: 5173,
    // Only real API calls go to the story server; "^/api/" keeps module requests such as
    // /backend.ts (or anything else that merely starts with "api") on the Vite dev server.
    proxy: { "^/api/": "http://localhost:8787" },
  },
});
