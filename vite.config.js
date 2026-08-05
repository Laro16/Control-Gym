import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',   // los deploys nuevos se aplican solos al recargar
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-monochrome.svg'],
      manifest: {
        name: 'Control Gym',
        short_name: 'Control Gym',
        description: 'Membresías, pagos, progreso y asistencia de tu gimnasio en un solo lugar.',
        id: '/',
        scope: '/',
        lang: 'es-GT',
        dir: 'ltr',
        categories: ['fitness', 'health', 'business', 'productivity'],
        theme_color: '#080B12',
        background_color: '#080B12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/pwa-monochrome.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'monochrome' },
        ],
      },
      workbox: {
        // Nunca cachear llamadas a Supabase: datos siempre frescos
        navigateFallbackDenylist: [/^\/rest/, /^\/auth/],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
