Here is the updated Product Requirements Document (PRD), fully formatted in Markdown and updated to reflect the modern Astro + React "Islands" architecture.

***

# PRD: kam-ui Component Registry

## 1. Project Overview
* **Project Name:** `ui.philippekam.dev` (product: **kam-ui**)
* **Repository Name:** `kam-ui` (or `ui.philippekam.dev`)
* **Objective:** To build an open-source, opinionated UI component registry. Unlike standard utility libraries, this registry focuses exclusively on high-end, complex micro-interactions and expressive components that developers can easily copy-paste or install into their React/Next.js projects.
* **Long-term Goal:** Establish a personal design system, drive developer traffic via high-quality open-source tools, and eventually monetize through premium "Pro Blocks" and full-page templates.

---

## 2. Target Audience
* Frontend developers building portfolios, creative agency sites, or modern SaaS landing pages.
* Developers who want "Awwwards-winning" animations but lack the time or specific expertise to write complex Framer Motion, WebGL, or CSS math logic from scratch.

---

## 3. Core Features & Scope (v1.0)
* **Component Showcase (The Shell):** A blazing-fast, highly polished, dark-mode biased documentation site where users can interact with the components live.
* **Code Viewer:** A toggle on each component block to view and copy the exact React/Tailwind code required.
* **Dependencies & Setup List:** Clear instructions on required libraries (e.g., `framer-motion`, `clsx`, `tailwind-merge`).
* **Registry specimens (v1 gallery):** Eight motion-heavy blocks with a **shadcn-compatible** static registry under `public/r/` (`registry.json`, per-item JSON, `kam-utils`, `kam-containment`). Interactive previews hydrate with **`client:visible`** (see specimen pages).
* **Original five:** Proximity Glow Card, Magnetic Action Button, Terminal Scramble, Gooey/Liquid FAB menu, 3D Parallax Tilt Card.
* **Flagship extensions:** Destructive Input (canvas sparks + kinetic shake), Spatial Portal (R3F + `MeshPortalMaterial`, WebGL), Gravity Tag Chamber (Rapier + orthographic chamber).

---

## 4. Technical Architecture
This project utilizes an **Astro Islands** architecture to achieve maximum performance for the documentation while maintaining the complex interactivity of React.

* **Website Framework (The Shell):** Astro. Delivers zero JavaScript by default for lightning-fast page loads and SEO optimization. (Potential to use Astro's *Starlight* template for instant, high-quality documentation UI).
* **Component Framework (The Core):** React. Used strictly to author the interactive UI components. Integrated into Astro using the `@astrojs/react` integration and hydrated on the client only when needed (e.g., `<MagneticButton client:visible />`).
* **Styling:** Tailwind CSS for utility-first styling, ensuring developers can easily copy-paste the code into their own Tailwind-configured projects.
* **Animation Engine:** Framer Motion for handling complex spring physics, drag, and state-based layout animations within the React components.
* **Class Merging:** `clsx` and `tailwind-merge` (the standard `shadcn` utility setup) to handle dynamic Tailwind class overrides cleanly.
* **Hosting:** Vercel or Cloudflare Pages.
* **Analytics:** Plausible or Vercel Analytics for privacy-friendly traffic tracking.

---

## 5. Repository Structure
The repository needs to cleanly separate the Astro documentation site from the raw, copy-pasteable React components.

```text
/
├── src/
│   ├── pages/              # Astro routes (e.g., index.astro, components/button.astro)
│   ├── layouts/            # Astro shell layouts (Header, Sidebar, Footer)
│   ├── components/
│   │   ├── docs/           # Astro components for the site (Code blocks, UI shell)
│   │   └── react/          # The actual product: Copy-pasteable React components
│   └── styles/             # Global Tailwind CSS config
├── public/                 # Static assets
├── astro.config.mjs        # Astro configuration (includes React integration)
├── @tailwindcss/vite       # Tailwind v4 via Vite plugin (no root tailwind.config.js required)
└── package.json
```

---

## 6. Development Milestones

### Phase 1: Foundation & Architecture
* Initialize the Astro project and install `@astrojs/react` and `@astrojs/tailwind`.
* Set up the base layout, typography, navigation sidebar, and dark mode styling.
* Create the generic `lib/utils.ts` helper for Tailwind class merging.
* Set up a custom `<CodeBlock />` component in Astro to display snippet contents nicely.

### Phase 2: Component Engineering (complete for OSS core)
* Ship React specimens under `src/components/react/` with Tailwind + Framer (and Three/Rapier where needed).
* Wire **specimen routes** + **ComponentPlayground** + raw source in `componentRegistry.ts`; run `npm run registry:build` so `/r/*.json` stays in sync.
* Enforce **containment** helpers (`lib/containment.ts`): viewport pause for canvas/WebGL/physics, reduced motion, fine-pointer checks for hover physics.

### Phase 3: Launch & Distribution (current)
* Deploy the Astro site to production.
* Add an "Open-Source" section to the main `philippekam.dev` portfolio linking to this subdomain.
* Create high-quality screen recordings (GIFs/MP4s) of the components in action.
* Share the repository and the screen recordings on X (Twitter), Reddit (`r/reactjs`, `r/webdev`), and relevant developer communities.

---

## 7. Future Roadmap (Monetization Phase)
Once the open-source core is generating consistent traffic:
* Introduce **"Pro Blocks"**: Complex, full-page sections (e.g., Animated Pricing Tiers, WebGL Hero Sections) kept in a private repository and sold for a one-time fee.
* Build complete **Astro + React Templates** utilizing the component library, sold to freelancers and agencies.