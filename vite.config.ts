import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// base './' = relative asset paths, so the same build works on GitHub Pages
// (served under /right-hand-practice/), Cloudflare Pages, or any static host.
export default defineConfig({
  base: './',
  plugins: [preact()],
})
