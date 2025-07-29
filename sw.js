// Service Worker for WaterBear Student Portal
const CACHE_NAME = 'waterbear-portal-v2';

// Additional patterns to cache dynamically
const CACHE_PATTERNS = [
  /^https:\/\/fonts\.gstatic\.com\//,  // Google Fonts files
  /^https:\/\/fonts\.googleapis\.com\// // Google Fonts API
];

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/env.js',
  '/site.webmanifest',
  // Local images
  '/img/white-hori@4x.png',
  '/img/hn-1536x796.jpg.webp',
  // Favicon files
  '/favicon/favicon-96x96.png',
  '/favicon/favicon.svg',
  '/favicon/favicon.ico',
  '/favicon/apple-touch-icon.png',
  '/favicon/web-app-manifest-192x192.png',
  '/favicon/web-app-manifest-512x512.png',
  // External dependencies
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Jost:wght@400;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://unpkg.com/lucide@latest',
  'https://cdn.skypack.dev/motion',
];

// Install event - cache assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle Contentful API requests differently
  if (url.hostname === 'cdn.contentful.com') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone the response before caching
          const responseToCache = response.clone();
          
          // Cache in background, don't wait
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          
          return response;
        })
        .catch(() => {
          // If offline, try to serve from cache
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              console.log('[Service Worker] Serving Contentful data from cache');
              return cachedResponse;
            }
            
            // No cached version available
            console.log('[Service Worker] No cached Contentful data available');
            // Return a proper error response instead of undefined
            return new Response(
              JSON.stringify({ 
                error: 'Offline - No cached data available',
                items: [] 
              }), 
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );
          });
        })
    );
    return;
  }

  // Check if this request matches our cache patterns (like Google Fonts)
  const shouldCache = CACHE_PATTERNS.some(pattern => pattern.test(request.url));
  
  // For static assets we've cached, serve from cache immediately
  if (urlsToCache.some(cached => request.url.includes(cached)) || shouldCache) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // Return cached version immediately
            return response;
          }
          // Not in cache, fetch and cache it
          return fetch(request).then(response => {
            // Only cache successful responses
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // For everything else (dynamic content), try network first
  event.respondWith(
    fetch(request)
      .then(response => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Add to cache in background
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then(response => {
          if (response) {
            return response;
          }
          
          // If it's a navigation request, return the cached index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          
          // For images, you could return a placeholder
          if (request.destination === 'image') {
            // Return a transparent 1x1 pixel as fallback
            return new Response(new Blob(), { headers: { 'Content-Type': 'image/gif' }});
          }
        });
      })
  );
});

// Listen for messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});