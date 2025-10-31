// Service worker for PWA functionality
// This is a basic service worker to enable PWA features

self.addEventListener('install', (event) => {
  console.log('Service worker installed');
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
});

self.addEventListener('fetch', (event) => {
  // Pass through all fetch requests - no caching for now
  // This ensures the app works properly without complex cache logic
});