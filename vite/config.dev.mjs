import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Installable and playable offline: a web manifest, plus a service worker that precaches the build.
const pwa = () => VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    // The glob below already precaches every png, icons included.
    includeManifestIcons: false,
    manifest: {
        name: 'Blackjack',
        short_name: 'Blackjack',
        description: 'Blackjack with Training, Counting and Standard modes.',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0d2f1c',
        theme_color: '#0d2f1c',
        icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
    },
    workbox: {
        globPatterns: ['**/*.{js,css,html,png}'],
        // Vercel's analytics scripts stay network-only and simply fail offline.
        navigateFallbackDenylist: [/^\/_vercel/]
    },
    // No service worker under the dev server, so it cannot serve stale modules over HMR.
    devOptions: { enabled: false }
});

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080
    },
    plugins: [
        pwa()
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../src'),
        }
    }
});
