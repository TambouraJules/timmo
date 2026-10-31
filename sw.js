/* ============================================================
   Timmo — service worker (application installable)
   - Pages : réseau d'abord (toujours la version à jour), copie en cache
     en secours, et page « hors connexion » si rien n'est disponible.
   - CSS et JS : réseau d'abord aussi (jamais de mélange ancien/nouveau code
     après une mise à jour), cache en secours hors connexion.
   - Logos et icônes : cache d'abord, mis à jour en arrière-plan.
   - L'API (autre domaine), les photos d'annonces et les paiements ne passent
     jamais par ce cache : les données affichées sont toujours celles du serveur.
   Pour forcer tous les téléphones à reprendre les fichiers : changer TI_SW_VERSION.
   ============================================================ */
const TI_SW_VERSION = "timmo-v1";
const TI_STATIC = `${TI_SW_VERSION}-static`;
const TI_PAGES = `${TI_SW_VERSION}-pages`;
const TI_PRECACHE = [
  "/offline.html",
  "/css/style.css",
  "/assets/brand/timmo-logo-primary.svg",
  "/assets/brand/icon-192.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(TI_STATIC).then(c => c.addAll(TI_PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(TI_SW_VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // API, photos, cartes, paiements : jamais en cache
  if (url.pathname.startsWith("/p/") || url.pathname.startsWith("/_vercel/")) return; // liens de partage, statistiques

  // Pages HTML : réseau d'abord
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(TI_PAGES).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("/offline.html")))
    );
    return;
  }

  // CSS et JS : réseau d'abord (le code reste toujours cohérent avec les pages
  // après une mise à jour du site), copie en cache pour le mode hors connexion.
  if (/\.(css|js)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(TI_STATIC).then(c => c.put(req, copy)); } return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Logos, icônes, polices : cache d'abord, mise à jour en arrière-plan
  if (/\.(svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(TI_STATIC).then(cache =>
        cache.match(req).then(hit => {
          const network = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || network;
        })
      )
    );
  }
});
