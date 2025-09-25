import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import webExtension from 'vite-plugin-web-extension'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

const targetBrowser = process.env.TARGET_BROWSER || 'chrome'

export default defineConfig({
  plugins: [
    wasm({
      sync: ['*'],
    }),
    topLevelAwait({
      promiseExportName: '__tla',
      promiseImportName: (i) => `__tla_${i}`,
    }),
    vue(),
    // Web extension plugin disabled - using post-build script instead
    // The plugin forces IIFE format which breaks our top-level await usage
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/background': resolve(__dirname, 'src/background'),
      '@/content': resolve(__dirname, 'src/content'),
      '@/popup': resolve(__dirname, 'src/popup'),
      '@/omnibazaar': resolve(__dirname, 'src/omnibazaar'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/utils': resolve(__dirname, 'src/core/utils'),
      '@polkadot/x-globalThis': resolve(__dirname, 'polyfills.js'),
      'crypto': 'crypto-browserify',
      'stream': 'stream-browserify',
      'buffer': 'buffer',
      'process': 'process/browser',
      'path': 'path-browserify',
      'fs': resolve(__dirname, 'empty-module.js'),
      'os': resolve(__dirname, 'empty-module.js'),
      'http': resolve(__dirname, 'empty-module.js'),
      'https': resolve(__dirname, 'empty-module.js'),
      'zlib': resolve(__dirname, 'empty-module.js'),
      'vm': resolve(__dirname, 'empty-module.js'),
    },
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    'process.env': {},
  },
  build: {
    target: 'esnext',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    outDir: `dist/${targetBrowser}`,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: 'assets/[name].[ext]',
        chunkFileNames: '[name].js',
        format: 'es',
      },
    },
  },
  server: {
    port: 3000,
    hmr: {
      port: 3001,
    },
  },
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['@polkadot/util', '@polkadot/keyring', '@polkadot/api'],
    exclude: ['tiny-secp256k1'],
    esbuildOptions: {
      // Don't define global here - it causes issues with module paths
    },
  },
}) 