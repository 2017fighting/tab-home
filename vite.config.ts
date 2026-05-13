import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import webExtension from 'vite-plugin-web-extension'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    webExtension({
      manifest: resolve(__dirname, 'src/manifest.json'),
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'extension',
    emptyOutDir: false,
  },
})
