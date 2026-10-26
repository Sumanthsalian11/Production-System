import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('pdf-lib') || id.includes('pdfjs-dist') || id.includes('html2pdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx') || id.includes('xlsx-js-style')) {
              return 'vendor-xlsx';
            }
            if (id.includes('chart.js') || id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('dhtmlx-gantt') || id.includes('frappe-gantt')) {
              return 'vendor-gantt';
            }
            if (id.includes('tesseract.js')) {
              return 'vendor-tesseract';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1600,
  },
  optimizeDeps: {
    include: ["dhtmlx-gantt"]
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true
      }
    }
  },
})
