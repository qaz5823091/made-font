/**
 * Service worker template — NOT shipped as-is.
 *
 * The `emit-sw` plugin in vite.config.ts reads this file at build time and
 * writes the result to dist/sw.js, substituting the two placeholders below:
 * VERSION becomes a "<pkg.version>-<hash>" string, PRECACHE becomes the JSON
 * array of app-shell URLs. (Don't repeat the placeholder tokens anywhere else
 * in this file — including in comments — or they get substituted too.)
 *
 * Plain JS on purpose: no bundler, no deps, no vite-plugin-pwa.
 */

const VERSION = "__CACHE_VERSION__"
const PRECACHE = __PRECACHE_MANIFEST__

// App shell (HTML + hashed /assets/* + icons). Keyed on VERSION so every
// deploy starts from a clean cache and stale hashed chunks get evicted.
const SHELL_CACHE = "made-font-shell-" + VERSION

// Fonts and emoji webfonts (up to ~38MB). Deliberately NOT keyed on VERSION:
// these files are immutable-by-name — a changed font ships under a new name —
// so the cache survives deploys instead of forcing a multi-MB re-download.
// They are also never precached; they land here on first actual use.
const FONT_CACHE = "made-font-fonts-v1"

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== FONT_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Serve from `cacheName`, falling back to the network and caching the result. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  // Don't poison the cache with 404s, redirects or opaque errors.
  if (response.ok) cache.put(request, response.clone())
  return response
}

/** Navigations: always try the network, fall back to the precached shell. */
async function navigate(request) {
  try {
    return await fetch(request)
  } catch (error) {
    const cached = await caches.match("/index.html")
    if (cached) return cached
    throw error
  }
}

/** Anything unclassified: straight to the network, cache only as a lifeline. */
async function networkFirst(request) {
  try {
    return await fetch(request)
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    throw error
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request

  // Bail out early on anything we have no business touching — POSTs, and every
  // cross-origin request (Firebase, analytics, third-party fonts). Returning
  // without calling respondWith hands the request back to the browser
  // untouched.
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(navigate(request))
    return
  }

  if (url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/emoji/")) {
    event.respondWith(cacheFirst(request, FONT_CACHE))
    return
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  event.respondWith(networkFirst(request))
})
