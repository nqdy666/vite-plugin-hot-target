import { defineConfig } from 'vite'
import VitePluginHotTarget from 'vite-plugin-hot-target'

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: '',
      },
      // '/websocket': {
      //   target: 'hotTargetPlugin:wssTarget',
      //   ws: true,
      // },
    },
  },
  plugins: [
    VitePluginHotTarget({
      targetFile: 'target.js',
      // wsEnable: true,
    }),
  ],
})
