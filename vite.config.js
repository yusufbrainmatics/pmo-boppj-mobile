import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// /m on the shared domain (web admin owns /); BASE env overrides the mount, e.g. GitHub Pages /pmo-boppj-mobile/.
const base = process.env.BASE || '/m/'

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PMO Kontraktor BOPPJ',
        short_name: 'PMO BOPPJ',
        description: 'Pelaporan progres harian proyek Pantura Jawa untuk kontraktor.',
        lang: 'id',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#002C75',
        background_color: '#F3F5F9',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Map tiles only; user photos live in IndexedDB and never pass through the SW.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 150, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
})
