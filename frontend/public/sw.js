const CACHE_VERSION = "mappening-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Fichiers essentiels mis en cache des l'installation du service worker.
const APP_SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/favicon-light.svg",
  "/favicon-dark.svg",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
];

// Endpoints publics que l'on peut relire depuis le cache si le reseau echoue.
const PUBLIC_API_CACHE_PATHS = [
  "/api/events",
  "/api/events/map",
  "/api/events/upcoming",
  "/api/events/popular",
  "/api/event-categories",
];

// Les donnees privees ou sensibles ne doivent jamais etre stockees par le cache PWA.
const PRIVATE_API_PREFIXES = [
  "/api/auth",
  "/api/me",
  "/api/admin",
  "/api/moderation",
  "/api/organizations",
  "/api/media",
];

// Installation: prepare le cache de base de l'application.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
  );
  self.skipWaiting();
});

// Activation: nettoie les anciens caches apres un changement de version.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );
  self.clients.claim();
});

const isPublicApiGet = (requestUrl) =>
  PUBLIC_API_CACHE_PATHS.some(
    (path) =>
      requestUrl.pathname === path || requestUrl.pathname.startsWith(`${path}/`),
  );

const isPrivateApiRequest = (requestUrl) =>
  PRIVATE_API_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix));

const isUploadAsset = (requestUrl) => requestUrl.pathname.startsWith("/uploads/");

const isStaticAsset = (request) =>
  request.destination === "script" ||
  request.destination === "style" ||
  request.destination === "font" ||
  request.destination === "image";

// Cache-first: ideal pour les fichiers statiques qui changent peu.
const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }

  return response;
};

// Network-first: garde les donnees fraiches avec un fallback cache hors ligne.
const networkFirst = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
};

// Intercepte les requetes GET pour appliquer la strategie de cache adaptee.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) return;

  if (isPrivateApiRequest(requestUrl)) return;

  if (isPublicApiGet(requestUrl)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isUploadAsset(requestUrl) || isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
  }
});
