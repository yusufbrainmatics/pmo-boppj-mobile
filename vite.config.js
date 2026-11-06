import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// The entry redirects to reporting; the backoffice requires its own URL.
const base = process.env.BASE || '/'
const mobileBase = base === '/' ? '/m/' : `${base.replace(/\/$/, '')}/m/`

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        entry: resolve(import.meta.dirname, 'index.html'),
        mobile: resolve(import.meta.dirname, 'm/index.html'),
        backoffice: resolve(import.meta.dirname, 'backoffice/index.html'),
      },
    },
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      scope: mobileBase,
      manifest: {
        name: 'PMO Kontraktor BOPPJ',
        short_name: 'PMO BOPPJ',
        description: 'Pelaporan progres harian proyek Pantura Jawa untuk kontraktor.',
        lang: 'id',
        start_url: mobileBase,
        scope: mobileBase,
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
        navigateFallback: `${mobileBase}index.html`,
        navigateFallbackDenylist: [/\/backoffice(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/backoffice/**'],
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
