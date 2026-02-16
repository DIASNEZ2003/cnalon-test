import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  base: './', // Ensures assets load correctly in Electron
  plugins: [
    react(),
    electron([
      {
        // Must match the filename in Step 1
        entry: 'electron/main.js', 
      },
    ]),
    renderer(),
  ],
})