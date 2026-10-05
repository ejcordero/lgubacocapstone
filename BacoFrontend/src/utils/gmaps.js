// src/utils/gmaps.js
// Loads the Google Maps JS API once, no matter how many components need it.

let loadPromise = null

export function loadGoogleMaps(apiKey) {
  // Diagnostic — shows exactly what key string the app actually received
  console.log(
    '🔑 Maps key received:',
    apiKey
      ? `${apiKey.slice(0, 10)}…${apiKey.slice(-4)}`
      : '(undefined — VITE_GOOGLE_MAPS_API_KEY never loaded!)'
  )

  // Fail fast with an actionable message instead of Google's cryptic InvalidKeyMapError
  if (!apiKey) {
    return Promise.reject(
      new Error(
        'VITE_GOOGLE_MAPS_API_KEY is not set. Check: (1) .env is in the FRONTEND root next to vite.config.js, ' +
        '(2) the name is spelled exactly VITE_GOOGLE_MAPS_API_KEY, ' +
        '(3) you fully restarted npm run dev after editing .env.'
      )
    )
  }

  // Already loaded
  if (window.google?.maps) return Promise.resolve(window.google.maps)

  // Load once
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      window.__gmapsReady = () => resolve(window.google.maps)
      const s = document.createElement('script')
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&callback=__gmapsReady`
      s.async = true
      s.onerror = () => {
        loadPromise = null
        reject(new Error('Google Maps script failed to load — check the API key / billing / network'))
      }
      document.head.appendChild(s)
    })
  }
  return loadPromise
}