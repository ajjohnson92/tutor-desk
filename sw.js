// Keeps the phone page working offline: the page itself from the cache (refreshed in the background), and the
// locked snapshot from the network when there's signal, otherwise the last copy downloaded.
const SHELL = "tutor-desk-shell-v3";  // change this whenever the page changes, so phones drop the old copy
const DATA = "tutor-desk-data";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/snapshot.json")) {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(DATA).then((c) => c.put("snapshot.json", copy));
      }
      return r;
    }).catch(() => caches.open(DATA).then((c) => c.match("snapshot.json"))
      .then((r) => r || new Response("offline", {status: 503}))));
    return;
  }
  e.respondWith(caches.open(SHELL).then((c) => c.match(e.request, {ignoreSearch: true}).then((hit) => {
    const fresh = fetch(e.request).then((r) => {
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }).catch(() => hit);
    return hit || fresh;
  })));
});
