import { defineConfig } from 'vite'
import VitePluginHotTarget from 'vite-plugin-hot-target'

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: '',
      },
    },
  },
  plugins: [
    VitePluginHotTarget({
      targetFile: 'target.js',
    }),
  ],
})
