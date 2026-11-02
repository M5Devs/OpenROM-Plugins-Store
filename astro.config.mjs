// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// Full-stack storefront: every route is server-rendered at the edge so the catalog
// is always read live from D1 (the `DB` binding) instead of a build-time snapshot.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // Emulate the D1 binding from wrangler.toml during `astro dev`.
    platformProxy: {
      enabled: true,
      configPath: 'wrangler.toml',
      persist: { path: './.wrangler/state/v3' },
    },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
