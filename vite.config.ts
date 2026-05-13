import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// `BASE_PATH` is supplied by the GitHub Actions deploy workflow
// (actions/configure-pages outputs e.g. "/made-font/"). Locally and during
// `npm run dev` it's unset, so we fall back to "/".
const rawBase = process.env.BASE_PATH || "/"
const basePath = rawBase.endsWith("/") ? rawBase : `${rawBase}/`

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? basePath : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
}))
