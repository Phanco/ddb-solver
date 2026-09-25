import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'require-table',
      // A missing table must fail the build loudly. Without this, vite build
      // succeeds silently, emitting a dist/ with no ddb96.bin and a service
      // worker that installs but can never answer anything.
      buildStart() {
        for (const f of ['ddb96.bin', 'illinois-deuces.bin']) {
          if (!existsSync(`public/${f}`)) {
            throw new Error(
              `public/${f} is missing — run \`cd generator && cargo run --release\` ` +
              `and copy out/${f} into app/public/`,
            );
          }
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,                       // served from public/
      workbox: {
        // The table is the app. Without it explicitly precached the service
        // worker installs happily and the app cannot answer anything offline.
        globPatterns: ['**/*.{js,css,html,bin,webmanifest,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
