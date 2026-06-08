const CACHE_NAME = 'rao-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const base = new URL(self.registration.scope).pathname
      const SHELL = [
        base,
        `${base}index.html`,
        `${base}app.js`,
        `${base}src/speechCapture.js`,
        `${base}src/notify.js`,
        `${base}src/recapEmail.js`,
        `${base}src/phraseParser.js`,
        `${base}src/numberWords.js`,
        `${base}src/sessionStore.js`,
        `${base}src/relayClient.js`,
        `${base}src/ui/dicteeScreen.js`,
        `${base}src/ui/historiqueScreen.js`,
        `${base}public/manifest.json`,
      ]
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(SHELL)
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})
