import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "src/web"),
  publicDir: path.resolve(__dirname, "public"),
  build: { outDir: path.resolve(__dirname, "dist"), emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://localhost:8787" } },
});
