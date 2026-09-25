// Minimal service worker — just enough to make the app installable
// (Chrome/Android require a registered service worker for the
// "Add to Home Screen" install prompt to appear). It does not cache
// anything, so the app always loads fresh data over the network.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass-through: always fetch from network, no offline caching.
  event.respondWith(fetch(event.request));
});
