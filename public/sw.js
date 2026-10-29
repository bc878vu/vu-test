// Minimal service worker: makes the app installable without caching
// anything, so new deployments are never hidden behind a stale cache.
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
self.addEventListener('fetch', () => {
  // Pass-through: no caching, the network always wins.
})
