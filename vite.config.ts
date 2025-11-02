import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/radius-circle-map-tool/', // Change this to '/' if using custom domain or username.github.io
})
