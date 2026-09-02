import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves project sites from a /<repo>/ subpath, so the base
// must match the repo name when building in CI.
const base = process.env.GITHUB_ACTIONS ? '/audio-tools/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [preact(), tailwindcss()],
})
