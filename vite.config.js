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
    port: 5173,
    strictPort: true,
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
      '@fact/domain': path.resolve(__dirname, './packages/domain/src/index.ts'),
      '@fact/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@fact/types': path.resolve(__dirname, './packages/types/src/index.ts'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
}) 