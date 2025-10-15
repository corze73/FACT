import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import securityHeaders from './vite-plugin-security-headers.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    securityHeaders()
  ],
  server: {
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
}) 