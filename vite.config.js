import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',   // los deploys nuevos se aplican solos al recargar
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Control Gym',
        short_name: 'Control Gym',
        description: 'Gestiona tus pagos, racha y progreso en tu gimnasio',
        theme_color: '#f97316',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Nunca cachear llamadas a Supabase: datos siempre frescos
        navigateFallbackDenylist: [/^\/rest/, /^\/auth/],
        runtimeCaching: [],
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
