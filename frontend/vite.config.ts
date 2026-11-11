import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// `vite build --mode demo` produces the static live demo (see scripts/build-demo.mjs):
// same UI, but every API call is answered from a recorded snapshot. The normal build
// never contains that code: __DEMO__ is replaced by `false` and the branches are dropped.
const DEMO_BASE = process.env.DEMO_BASE ?? '/openspec-ui/'
// `npm run dev` starts the backend on this port (root package.json) and proxies /api to it.
const DEV_API_PORT = process.env.OPENSPEC_UI_DEV_API_PORT ?? '3100'

export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    base: demo ? DEMO_BASE : '/',
    define: {
      __DEMO__: JSON.stringify(demo),
    },
    build: {
      // Keep the demo out of dist/, which the Rust binary embeds.
      outDir: demo ? 'dist-demo' : 'dist',
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': `http://127.0.0.1:${DEV_API_PORT}`,
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  }
})
