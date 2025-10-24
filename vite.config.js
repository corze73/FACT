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
    allowedHosts: true,
    proxy: {
      // Forward API calls to local Express server during dev
      '/stripe': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
}) 