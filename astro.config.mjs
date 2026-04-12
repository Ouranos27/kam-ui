// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: 'https://ui.philippekam.dev',
  integrations: [react()],

  vite: {
    // Tailwind v4: factory returns Plugin[] — Vite flattens one level (see Tailwind + Astro docs).
    plugins: [tailwindcss()],
    resolve: {
      alias: { '@': srcDir },
    },
  },
});