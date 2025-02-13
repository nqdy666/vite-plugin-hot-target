import { defineConfig } from 'vite'
import VitePluginHotTarget from 'vite-plugin-hot-target'

export default defineConfig({
  plugins: [
    VitePluginHotTarget({
      targetFile: 'target.js',
    }),
  ],
})
