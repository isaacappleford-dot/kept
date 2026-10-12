import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { APP } from './src/config/app.ts';

/**
 * Base path. GitHub Pages serves project sites from /<repo>/, so CI sets
 * BASE_PATH=/<repo>/. Vercel/Netlify/local use "/".
 */
const base = normaliseBase(process.env.BASE_PATH ?? '/');

function normaliseBase(b: string): string {
  let out = b.trim() || '/';
  if (!out.startsWith('/')) out = `/${out}`;
  if (!out.endsWith('/')) out = `${out}/`;
  return out;
}

/** Injects the app name/description from src/config/app.ts into index.html. */
function appIdentity(): Plugin {
  return {
    name: 'app-identity',
    transformIndexHtml(html) {
      return html
        .replaceAll('%APP_NAME%', APP.name)
        .replaceAll('%APP_DESCRIPTION%', APP.description)
        .replaceAll('%THEME_COLOR%', APP.themeColor);
    },
  };
}

export default defineConfig(({ mode }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0') },
  plugins: [
    react(),
    appIdentity(),
    mode === 'https' ? basicSsl() : null,
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/logo.svg'],
      manifest: {
        id: base,
        name: APP.name,
        short_name: APP.shortName,
        description: APP.description,
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: APP.backgroundColor,
        theme_color: APP.themeColor,
        categories: ['finance', 'shopping', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell, icons, the OCR worker and the English model are precached so
        // scanning works offline. The WASM engines (one per CPU feature level,
        // ~4 MB each) are cached on first use instead of all being downloaded.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,webmanifest}', 'ocr/lang/*.gz'],
        globIgnores: ['ocr/tesseract-core-*.js'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        importScripts: ['sw-notifications.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/ocr\/tesseract-core-[\w-]+\.wasm\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-engine', expiration: { maxEntries: 4 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: ['es2020', 'safari16', 'chrome87'],
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
  server: { host: true },
}));
