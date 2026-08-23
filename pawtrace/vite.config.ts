import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['paw-icon.svg'],
      workbox: {
        // Pull the Web Push handlers into the generated service worker.
        importScripts: ['push-sw.js'],
      },
      manifest: {
        name: 'PawTrace',
        short_name: 'PawTrace',
        description: 'Community lost & found pet app. Help pets get home.',
        theme_color: '#6FB833',
        background_color: '#FBFAF5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'paw-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
});
