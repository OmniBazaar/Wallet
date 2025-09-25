// vite.config.ts
import { defineConfig } from "file:///home/rickc/OmniBazaar/node_modules/vite/dist/node/index.js";
import vue from "file:///home/rickc/OmniBazaar/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { resolve } from "path";
import webExtension from "file:///home/rickc/OmniBazaar/node_modules/vite-plugin-web-extension/dist/index.js";
import wasm from "file:///home/rickc/OmniBazaar/node_modules/vite-plugin-wasm/exports/import.mjs";
import topLevelAwait from "file:///home/rickc/OmniBazaar/node_modules/vite-plugin-top-level-await/exports/import.mjs";
import commonjs from "file:///home/rickc/OmniBazaar/node_modules/@rollup/plugin-commonjs/dist/es/index.js";
var __vite_injected_original_dirname = "/home/rickc/OmniBazaar/Wallet";
var targetBrowser = process.env.TARGET_BROWSER || "chrome";
var vite_config_default = defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    vue(),
    webExtension({
      manifest: `manifest/${targetBrowser === "firefox" ? "v2" : "v3"}/manifest.json`,
      watchFilePaths: ["src/**/*"],
      verbose: true
    }),
    commonjs({
      include: /node_modules/,
      requireReturnsDefault: "auto",
      transformMixedEsModules: true
    })
  ],
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "src"),
      "@/core": resolve(__vite_injected_original_dirname, "src/core"),
      "@/background": resolve(__vite_injected_original_dirname, "src/background"),
      "@/content": resolve(__vite_injected_original_dirname, "src/content"),
      "@/popup": resolve(__vite_injected_original_dirname, "src/popup"),
      "@/omnibazaar": resolve(__vite_injected_original_dirname, "src/omnibazaar"),
      "@/types": resolve(__vite_injected_original_dirname, "src/types"),
      "@/utils": resolve(__vite_injected_original_dirname, "src/core/utils"),
      "@polkadot/x-globalThis": resolve(__vite_injected_original_dirname, "polyfills.js"),
      "@polkadot/x-global": resolve(__vite_injected_original_dirname, "polyfills.js"),
      "./globalThis/globalXpub": resolve(__vite_injected_original_dirname, "polyfills.js"),
      "./globalThis/unsignedTx": resolve(__vite_injected_original_dirname, "polyfills.js")
    }
  },
  define: {
    global: "globalThis",
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false
  },
  build: {
    target: "esnext",
    minify: process.env.NODE_ENV === "production",
    sourcemap: true,
    outDir: `dist/${targetBrowser}`,
    rollupOptions: {
      input: {
        background: resolve(__vite_injected_original_dirname, "src/background/background.ts"),
        "content-script": resolve(__vite_injected_original_dirname, "src/content/content-script.ts"),
        popup: resolve(__vite_injected_original_dirname, "src/popup/popup.html")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]"
      },
      plugins: [
        {
          name: "fix-globalThis-imports",
          resolveId(source) {
            if (source.includes("./globalThis/") && source.includes("?commonjs-external")) {
              return resolve(__vite_injected_original_dirname, "polyfills.js");
            }
            return null;
          }
        }
      ]
    }
  },
  server: {
    port: 3e3,
    hmr: {
      port: 3001
    }
  },
  esbuild: {
    target: "esnext"
  },
  optimizeDeps: {
    include: ["@polkadot/util", "@polkadot/keyring", "@polkadot/api"],
    exclude: ["tiny-secp256k1"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9yaWNrYy9PbW5pQmF6YWFyL1dhbGxldFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvcmlja2MvT21uaUJhemFhci9XYWxsZXQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvcmlja2MvT21uaUJhemFhci9XYWxsZXQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCdcbmltcG9ydCB3ZWJFeHRlbnNpb24gZnJvbSAndml0ZS1wbHVnaW4td2ViLWV4dGVuc2lvbidcbmltcG9ydCB3YXNtIGZyb20gJ3ZpdGUtcGx1Z2luLXdhc20nXG5pbXBvcnQgdG9wTGV2ZWxBd2FpdCBmcm9tICd2aXRlLXBsdWdpbi10b3AtbGV2ZWwtYXdhaXQnXG5pbXBvcnQgY29tbW9uanMgZnJvbSAnQHJvbGx1cC9wbHVnaW4tY29tbW9uanMnXG5cbmNvbnN0IHRhcmdldEJyb3dzZXIgPSBwcm9jZXNzLmVudi5UQVJHRVRfQlJPV1NFUiB8fCAnY2hyb21lJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgd2FzbSgpLFxuICAgIHRvcExldmVsQXdhaXQoKSxcbiAgICB2dWUoKSxcbiAgICB3ZWJFeHRlbnNpb24oe1xuICAgICAgbWFuaWZlc3Q6IGBtYW5pZmVzdC8ke3RhcmdldEJyb3dzZXIgPT09ICdmaXJlZm94JyA/ICd2MicgOiAndjMnfS9tYW5pZmVzdC5qc29uYCxcbiAgICAgIHdhdGNoRmlsZVBhdGhzOiBbJ3NyYy8qKi8qJ10sXG4gICAgICB2ZXJib3NlOiB0cnVlLFxuICAgIH0pLFxuICAgIGNvbW1vbmpzKHtcbiAgICAgIGluY2x1ZGU6IC9ub2RlX21vZHVsZXMvLFxuICAgICAgcmVxdWlyZVJldHVybnNEZWZhdWx0OiAnYXV0bycsXG4gICAgICB0cmFuc2Zvcm1NaXhlZEVzTW9kdWxlczogdHJ1ZSxcbiAgICB9KSxcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjJyksXG4gICAgICAnQC9jb3JlJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvY29yZScpLFxuICAgICAgJ0AvYmFja2dyb3VuZCc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2JhY2tncm91bmQnKSxcbiAgICAgICdAL2NvbnRlbnQnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9jb250ZW50JyksXG4gICAgICAnQC9wb3B1cCc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3BvcHVwJyksXG4gICAgICAnQC9vbW5pYmF6YWFyJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvb21uaWJhemFhcicpLFxuICAgICAgJ0AvdHlwZXMnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy90eXBlcycpLFxuICAgICAgJ0AvdXRpbHMnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9jb3JlL3V0aWxzJyksXG4gICAgICAnQHBvbGthZG90L3gtZ2xvYmFsVGhpcyc6IHJlc29sdmUoX19kaXJuYW1lLCAncG9seWZpbGxzLmpzJyksXG4gICAgICAnQHBvbGthZG90L3gtZ2xvYmFsJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdwb2x5ZmlsbHMuanMnKSxcbiAgICAgICcuL2dsb2JhbFRoaXMvZ2xvYmFsWHB1Yic6IHJlc29sdmUoX19kaXJuYW1lLCAncG9seWZpbGxzLmpzJyksXG4gICAgICAnLi9nbG9iYWxUaGlzL3Vuc2lnbmVkVHgnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3BvbHlmaWxscy5qcycpLFxuICAgIH0sXG4gIH0sXG4gIGRlZmluZToge1xuICAgIGdsb2JhbDogJ2dsb2JhbFRoaXMnLFxuICAgIF9fVlVFX09QVElPTlNfQVBJX186IHRydWUsXG4gICAgX19WVUVfUFJPRF9ERVZUT09MU19fOiBmYWxzZSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdlc25leHQnLFxuICAgIG1pbmlmeTogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJyxcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgb3V0RGlyOiBgZGlzdC8ke3RhcmdldEJyb3dzZXJ9YCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBiYWNrZ3JvdW5kOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9iYWNrZ3JvdW5kL2JhY2tncm91bmQudHMnKSxcbiAgICAgICAgJ2NvbnRlbnQtc2NyaXB0JzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvY29udGVudC9jb250ZW50LXNjcmlwdC50cycpLFxuICAgICAgICBwb3B1cDogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvcG9wdXAvcG9wdXAuaHRtbCcpLFxuICAgICAgfSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ1tuYW1lXS5qcycsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnY2h1bmtzL1tuYW1lXS5baGFzaF0uanMnLFxuICAgICAgICBhc3NldEZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0uW2hhc2hdLltleHRdJyxcbiAgICAgIH0sXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnZml4LWdsb2JhbFRoaXMtaW1wb3J0cycsXG4gICAgICAgICAgcmVzb2x2ZUlkKHNvdXJjZSkge1xuICAgICAgICAgICAgLy8gSGFuZGxlIHRoZSBtYWxmb3JtZWQgZ2xvYmFsVGhpcyBpbXBvcnRzXG4gICAgICAgICAgICBpZiAoc291cmNlLmluY2x1ZGVzKCcuL2dsb2JhbFRoaXMvJykgJiYgc291cmNlLmluY2x1ZGVzKCc/Y29tbW9uanMtZXh0ZXJuYWwnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShfX2Rpcm5hbWUsICdwb2x5ZmlsbHMuanMnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgaG1yOiB7XG4gICAgICBwb3J0OiAzMDAxLFxuICAgIH0sXG4gIH0sXG4gIGVzYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdlc25leHQnLFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ0Bwb2xrYWRvdC91dGlsJywgJ0Bwb2xrYWRvdC9rZXlyaW5nJywgJ0Bwb2xrYWRvdC9hcGknXSxcbiAgICBleGNsdWRlOiBbJ3Rpbnktc2VjcDI1NmsxJ10sXG4gICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgIGRlZmluZToge1xuICAgICAgICBnbG9iYWw6ICdnbG9iYWxUaGlzJyxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pICJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVEsU0FBUyxvQkFBb0I7QUFDdFMsT0FBTyxTQUFTO0FBQ2hCLFNBQVMsZUFBZTtBQUN4QixPQUFPLGtCQUFrQjtBQUN6QixPQUFPLFVBQVU7QUFDakIsT0FBTyxtQkFBbUI7QUFDMUIsT0FBTyxjQUFjO0FBTnJCLElBQU0sbUNBQW1DO0FBUXpDLElBQU0sZ0JBQWdCLFFBQVEsSUFBSSxrQkFBa0I7QUFFcEQsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsS0FBSztBQUFBLElBQ0wsY0FBYztBQUFBLElBQ2QsSUFBSTtBQUFBLElBQ0osYUFBYTtBQUFBLE1BQ1gsVUFBVSxZ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
