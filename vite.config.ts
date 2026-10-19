import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相對路徑，Capacitor 與單檔預覽都能正確載入資源
  base: './',
  build: {
    rollupOptions: {
      // SINGLE=1 時把所有程式碼打成單一檔案（給瀏覽器預覽版用）
      output: process.env.SINGLE === '1' ? { inlineDynamicImports: true } : {},
    },
  },
})
