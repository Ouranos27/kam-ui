# kam-ui

A **shadcn-compatible registry** of motion-rich React components — WebGL backgrounds, animated specimens, and an editorial Astro docs site.

**Live site:** [ui.philippekam.dev](https://ui.philippekam.dev)

## Components

All components are self-contained React + Tailwind modules, installable via the shadcn CLI or by copying the source directly.

**Backgrounds:** Radiant Veil, Chromatic Leaks, Halo Ring, Shimmer Ring, Crown Glow, Chromatic Field, Solar Flare, Black Hole, Mesh Gradient, Atmospheric Sky, Milky Way

### Install a component

```bash
npx shadcn@latest add https://ui.philippekam.dev/r/<component>.json
```

Or copy the source from the Code tab on any component page.

## Development

```bash
npm install
npm run dev          # Astro dev server → http://localhost:4321
npm run build        # Production build → ./dist/
npm run preview      # Preview production build locally
```

The registry JSON (`public/r/*.json`) is regenerated automatically before `dev` and `build`.

## Deployment

Deploy `dist/` to any static host (Vercel, Cloudflare Pages, Netlify). Set `site` in `astro.config.mjs` to your production origin for correct canonical URLs.

Optional: `REGISTRY_ORIGIN=https://your-domain npm run registry:build` to point `registryDependencies` URLs at production.

## Third-party credits

- **Black Hole component** — derived from [Eric Bruneton's black_hole_shader](https://github.com/ebruneton/black_hole_shader) (BSD-3-Clause). Precomputed `.dat` files under `public/black-hole/`.
- **Milky Way component** — panorama from [ESA Gaia DR2](https://www.esa.int/ESA_Multimedia/Images/2018/04/Gaia_s_sky_in_colour) colour data (CC BY-SA 3.0 IGO, credit: ESA/Gaia/DPAC). Reprojected from Hammer to equirectangular.

## Built with

- [Astro](https://astro.build) — static site generation
- [React](https://react.dev) — component runtime
- [Tailwind CSS v4](https://tailwindcss.com) — styling
- [ogl](https://github.com/oframe/ogl) — lightweight WebGL
- [shadcn registry](https://ui.shadcn.com/docs/registry) — distribution format
- Built with assistance from [Claude](https://claude.ai) (Anthropic)

## License

MIT — see [LICENSE](./LICENSE) for details and third-party attribution.
