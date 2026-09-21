import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,                       // served from public/
      workbox: {
        // The table is the app. Without it explicitly precached the service
        // worker installs happily and the app cannot answer anything offline.
        globPatterns: ['**/*.{js,css,html,bin,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
