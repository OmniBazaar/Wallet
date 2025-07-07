import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { webExtension } from 'vite-plugin-web-extension'

const targetBrowser = process.env.TARGET_BROWSER || 'chrome'

export default defineConfig({
  plugins: [
    vue(),
    webExtension({
      manifest: `manifest/${targetBrowser === 'firefox' ? 'v2' : 'v3'}/manifest.json`,
      watchFilePaths: ['src/**/*'],
      verbose: true,
    }),
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
    },
  },
  define: {
    global: 'globalThis',
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
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
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
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
}) 