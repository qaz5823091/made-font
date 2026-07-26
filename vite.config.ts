import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import react from "@vitejs/plugin-react"
import { type Plugin, defineConfig } from "vite"
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

// Top-level dist/ directories left out of the service worker precache. Both are
// multi-MB (the emoji webfonts alone reach ~38MB) and are cache-first'd at
// runtime instead — keep these in sync with the /fonts/ and /emoji/ prefixes in
// scripts/sw.template.js.
const PRECACHE_SKIP_DIRS = new Set(["fonts", "emoji"])

// Root files that are never part of the app shell: crawler/social assets, and
// the service worker itself (a SW must never precache its own script).
const PRECACHE_SKIP_FILES = new Set(["og-image.png", "sitemap.xml", "robots.txt", "sw.js"])

/**
 * Emits dist/sw.js from scripts/sw.template.js after the bundle is written.
 *
 * Hand-rolled rather than vite-plugin-pwa: the project takes no new deps, and
 * the caching rules here are specific enough (huge immutable font payloads that
 * must outlive a deploy) that a generic Workbox config would be more work.
 */
function emitServiceWorker(): Plugin {
  return {
    name: "emit-sw",
    apply: "build",
    enforce: "post",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist")
      const template = fs.readFileSync(path.resolve(__dirname, "scripts/sw.template.js"), "utf8")

      // "/" is the URL the app is actually opened at; index.html is added by
      // the walk below and both are needed so the offline shell resolves either
      // way.
      const urls = new Set<string>(["/"])
      const walk = (dir: string, prefix: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const isRoot = prefix === "/"
          if (entry.isDirectory()) {
            if (isRoot && PRECACHE_SKIP_DIRS.has(entry.name)) continue
            walk(path.join(dir, entry.name), `${prefix}${entry.name}/`)
          } else if (!(isRoot && PRECACHE_SKIP_FILES.has(entry.name))) {
            urls.add(`${prefix}${entry.name}`)
          }
        }
      }
      walk(distDir, "/")

      const precache = [...urls].sort()
      // Hash the manifest *and* the template so a change to either — a new
      // asset hash, a tweaked fetch handler — invalidates the shell cache.
      const hash = crypto
        .createHash("sha256")
        .update(`${precache.join("\n")}\n${template}`)
        .digest("hex")
        .slice(0, 8)
      const version = `${pkg.version}-${hash}`

      // Function replacements: keeps `$&`-style sequences in the payload literal.
      const sw = template
        .replaceAll("__CACHE_VERSION__", () => version)
        .replaceAll("__PRECACHE_MANIFEST__", () => JSON.stringify(precache))

      fs.writeFileSync(path.join(distDir, "sw.js"), sw)
      console.log(`[emit-sw] dist/sw.js — cache "${version}", ${precache.length} precached files`)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "inject-site-url",
      transformIndexHtml: (html) =>
        html.replaceAll("%SITE_URL%", SITE_URL).replaceAll("%FB_APP_ID%", FB_APP_ID),
    },
    emitServiceWorker(),
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
