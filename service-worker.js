const CACHE_NAME = 'bitauto-cache-v1';
const ASSETS = [
  'dashboard.html',
  'index.html',
  'generales.html',
  'fotos.html',
  'verificacion.html',
  'correo.html',
  'styles.css',
  'fotos.css',
  'correo.css',
  'verificacion.css',
  'storage.js',
  'dashboard.js',
  'script.js',
  'generales.js',
  'fotos.js',
  'verificacion.js',
  'correo.js',
  'voice.js',
  'manifest.json',
  'assets/app_icon_512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
