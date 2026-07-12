import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-ignore
import { apiPlugin } from './vite-plugin-api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    apiPlugin(), // handles /api/ routes in dev — same logic as Vercel functions
  ],
})
