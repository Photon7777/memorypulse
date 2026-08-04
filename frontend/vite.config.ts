import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
const pagesBase = process.env.GITHUB_ACTIONS === 'true' && repository ? `/${repository}/` : '/'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? pagesBase,
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
