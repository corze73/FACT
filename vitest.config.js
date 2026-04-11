import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    exclude: ['**/node_modules/**', 'tests/integration.test.js', '.netlify/**', 'apps/web/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        'dist/',
        'netlify/functions/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
      '@fact/api': path.resolve(__dirname, './packages/api/src/index.ts'),
      '@fact/auth': path.resolve(__dirname, './packages/auth/src/index.ts'),
      '@fact/domain': path.resolve(__dirname, './packages/domain/src/index.ts'),
      '@fact/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@fact/types': path.resolve(__dirname, './packages/types/src/index.ts')
    }
  }
})
