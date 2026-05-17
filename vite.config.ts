import path from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import pkg from "./package.json" with { type: "json" }

// Canonical production URL. Used in index.html (OG meta + canonical link) via
// the inject-site-url plugin below — keeps the domain in one place so we don't
// drift between `og:url`, `og:image`, `twitter:image`, etc.
const SITE_URL = "https://madefont.cppdesigns.cc"

// Facebook App ID — silences Meta sharing debugger 206 "missing fb:app_id".
// Set VITE_FB_APP_ID in .env.local to your real app ID once registered at
// https://developers.facebook.com. Falls back to a numeric placeholder so the
// property is always present (an empty string still triggers the 206 warning).
const FB_APP_ID = process.env.VITE_FB_APP_ID || "0"

export default defineConfig({
  plugins: [
    react(),
    {
      name: "inject-site-url",
      transformIndexHtml: (html) =>
        html.replaceAll("%SITE_URL%", SITE_URL).replaceAll("%FB_APP_ID%", FB_APP_ID),
    },
  ],
  // 無論什麼情況都使用根目錄，適合已綁定獨立子網域的專案
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
