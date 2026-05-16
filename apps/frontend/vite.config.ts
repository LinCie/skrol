import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tanstackRouter from '@tanstack/router-plugin/vite'

import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare(),
    tailwindcss(),
    tanstackRouter(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})

export default config
