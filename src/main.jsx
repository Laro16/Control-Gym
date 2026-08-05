import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Si Vercel acaba de publicar una version nueva, una pestaña antigua puede
// intentar cargar un chunk que ya no existe. Vite emite este evento: una sola
// recarga obtiene el index y los nombres de archivos de la version actual.
const PRELOAD_RELOAD_KEY = 'control-gym-preload-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) || 0)
  if (Date.now() - lastReload > 15_000) {
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()))
    window.location.reload()
  }
})

// Registrar inmediatamente para que el service worker compruebe y active
// versiones nuevas sin dejar la PWA anclada al despliegue anterior.
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
