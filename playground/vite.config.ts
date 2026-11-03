import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    // Paket kaynaktan: uygulama nasıl import ediyorsa playground da öyle.
    alias: { '@medyat/react-data-table': fileURLToPath(new URL('../src/index.ts', import.meta.url)) },
  },
  server: { port: 5175 },
})
