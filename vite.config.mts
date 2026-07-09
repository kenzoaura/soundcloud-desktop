import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              // Bundle discord-rpc + ws INTO main so the packaged app has no
              // runtime node_modules dependency. Only ws's optional native
              // add-ons stay external — ws loads them via try/catch and works
              // fine when they are absent.
              external: ['bufferutil', 'utf-8-validate'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
      },
    ]),
  ],
})
