import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vitest/config'

const BRIDGE_FILES = ['shadcn-bridge.css', 'shadcn-bridge-hsl.css']
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

export default defineConfig({
  plugins: [
    react(),
    // R11: tüketicinin derleyicisi node_modules'ü işlemez; paket derlenmiş çıkar.
    babel({ presets: [reactCompilerPreset()] }),
    dts({ tsconfigPath: 'tsconfig.build.json', bundleTypes: true }),
    {
      // Giriş noktası import etmediği için köprü CSS'leri dist'e ayrıca kopyalanır (02 · shadcn köprüsü).
      name: 'dt-copy-bridge-css',
      apply: 'build',
      generateBundle() {
        for (const f of BRIDGE_FILES) this.emitFile({ type: 'asset', fileName: f, source: read(`./src/styles/${f}`) })
      },
    },
  ],
  build: {
    lib: {
      entry: { index: 'src/index.ts' },
      formats: ['es'],
      cssFileName: 'style',
    },
    rolldownOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/],
    },
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
