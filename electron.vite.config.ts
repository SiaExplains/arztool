import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { defineConfig as defineElectronConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildCsp } from './src/shared/csp'

const alias = { '@shared': resolve(__dirname, 'src/shared') }

// The CSP is injected at build time rather than hard-coded in index.html because
// the dev server needs a looser policy (React Refresh preamble is an inline
// script, HMR uses a websocket). Production gets the strict policy only.
function cspPlugin(): Plugin {
  let isDev = false
  return {
    name: 'arztool-csp',
    configResolved(config) {
      isDev = config.command === 'serve'
    },
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp({ dev: isDev }) },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineElectronConfig({
  main: {
    resolve: { alias },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } },
    },
  },
  preload: {
    resolve: { alias },
    build: {
      // Sandboxed preloads can only require('electron'), so every dependency
      // must be inlined into the preload bundle. (electron-vite's isolatedEntries
      // would do this per entry but crashes when stdout is not a TTY, e.g. in CI.)
      externalizeDeps: false,
      rollupOptions: { input: { shell: resolve(__dirname, 'src/preload/shell.ts') } },
    },
  },
  renderer: defineConfig({
    root: resolve(__dirname, 'src/renderer'),
    resolve: { alias },
    plugins: [react(), tailwindcss(), cspPlugin()],
    build: {
      minify: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          'viewer-toolbar': resolve(__dirname, 'src/renderer/viewer-toolbar.html'),
        },
      },
    },
  }),
})
