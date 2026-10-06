import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // base: '/Productionsystem/',
base: './',
  build: {
    outDir: 'build', 
  },
optimizeDeps: {
      include: ["dhtmlx-gantt"]
    },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000", // change this if your Node backend runs on a different port
        changeOrigin: true
      }
    }
  },

})