# kam-ui design system — Full Lab

**kam-ui** is a **shadcn-compatible registry** surfaced as a **clinical diagnostics console**: sterile chrome, containment chambers for live specimens, and instrument-style copy. Registry schema, `/r` URLs, and CLI flows stay honest; the **experience** reads as precision lab equipment, not a generic component gallery.

Implementation: `src/styles/global.css`. Live reference: **`/design-system`** (title **Lab reference**).

**UX quality bar:** Follow **ui-ux-pro-max** (`.cursor/skills/ui-ux-pro-max/SKILL.md`): SVG-only chrome, `cursor-pointer` on controls, **150–300ms** transitions, **visible focus** (keyboard), **4.5:1** text contrast in light mode, borders visible in both themes, **`prefers-reduced-motion`**, and checks at **375 / 768 / 1024 / 1440**. Automated design-system *search* output is **advisory** — this product keeps **Inter + JetBrains Mono** and Full Lab neutrals unless you intentionally retheme.

---

## 0. Non-goals

- **Not** a soft marketing landing aesthetic (no heavy gradients, no display-serif gallery type).
- **Not** hiding registry behavior — install commands and JSON remain accurate.

---

## 1. Nomenclature

| Typical web term | Lab term (UI) |
|------------------|---------------|
| Components (nav) | **Specimens** |
| Component page | **Specimen dossier** |
| Preview (showcase tab) | **Preview** (containment chamber tab) |
| Code (showcase tab) | **Code** — install line, usage snippet, expandable source |
| Full file (page section) | **Source** (anchor `#source`, Shiki + Extract source) |
| Installation | **Procedure** (anchor `#procedure`) |
| Design system (nav) | **Lab reference** |
| Copy code | **Extract source** |
| Copy install command | **Clone matrix** |
| Prev / Next | **Prior specimen** / **Next specimen** |

---

## 2. Brand & voice

| Element | Guideline |
|--------|------------|
| **Name** | **kam-ui** — lowercase in UI. |
| **Positioning** | Motion-rich React **specimens**, shadcn-compatible distribution. |
| **Voice** | Direct, technical; instrument labels (uppercase mono microcopy) where it aids scan. |
| **Tone** | Sterile, confident; whitespace over decoration. |

---

## 3. Visual principles

1. **Light default, dark + system** — `:root` light; `html.dark` for dark. Storage key `kam-ui-theme`. FOUC script in `DocsLayout.astro`.
2. **Semantic tokens** — shadcn-style roles (`background`, `muted`, `sidebar-*`, …); **brand** is sparse accent only (calibration, focus, links).
3. **Typography** — **Inter** for display and UI; **JetBrains Mono** for data, telemetry, indices, code.
4. **Geometry** — Near-zero default radius token; orthogonal panels; **1px** borders for instrument frames.
5. **Motion** — Shell: minimal transitions (150–200ms). **Respect `prefers-reduced-motion`** (telemetry FPS becomes `STATE: Idle`; sheen static).
6. **Preview is the hero** — Containment chamber frames the live specimen; chrome never obscures the demo.

---

## 4. Containment chamber

**Component:** `src/components/docs/ContainmentChamber.astro`

| Element | Spec |
|--------|------|
| **Frame** | `1px` solid **black** in light mode; **`zinc-400`** (or equivalent) in dark so the edge reads against `#09090B` interiors. |
| **Crosshairs** | Tiny SVG “+” insets at all four corners (`aria-hidden`). |
| **Telemetry** | `TelemetryReadout` (React): specimen id, `ENV: React 19`, then `FPS: n` after a stable sample window or `STATE: Idle` if motion is reduced or measured rate is below threshold (avoids bogus “1 FPS” on load). |
| **Surface `light`** | `.kam-chamber-grid` — pale fill + architectural grid (`linear-gradient` ticks). |
| **Surface `dark`** | Interior `background: #09090B` (`--kam-chamber-dark`); light text where needed. |

Per-specimen surface and id: `src/data/nav.ts` (`specimenCode`, `chamberSurface`).

---

## 5. Specimen dossier layout

1. **Showcase** — `SpecimenWorkspace`: LCD **Preview** \| **Code** above the chamber; **Preview** = chamber + **Props** table + **Dependencies** (peer list). **Code** = **Procedure** (`RegistryInstallTabs`), **Usage** (install line + import snippet), plain **Source**, highlighted **Source** (Shiki + Extract source).
2. **Procedure** — `RegistryInstallTabs`: channel label, LCD package-manager segments, **Clone matrix** copy.
3. **Dependencies** — `Dependencies.astro` readout.
4. **Source** — `CodeBlock.astro` with **Extract source** (full highlighted file).

---

## 6. Hardware-style controls

| Control | Pattern |
|---------|---------|
| **LCD segments** | `.kam-lcd-segment` + `data-active="true"`: light mode active = black bg / white text; dark mode active ≈ light bg / black text. |
| **Extract / clone** | `.kam-extract-btn` + `kam-extract-flash` keyframes on press (`prefers-reduced-motion`: no animation). |
| **Sliders (pattern)** | `.kam-lab-range` — ticked track metaphor; mono numeric readout (`LabDialSlider` demo on lab reference page). |

---

## 7. Design tokens & CSS utilities

| Token / utility | Role |
|-----------------|------|
| `:root` / `.dark` | Semantic OKLCH palette (muted neutrals; restrained brand chroma). |
| `--kam-chamber-dark`, `--kam-chamber-grid-line` | Chamber surfaces / grid lines. |
| `.kam-main-panel` | Main article column — flat border, minimal blur. |
| `.kam-ds-hero-shell` | Intro panel — flat, optional faint sheen (`EditorialHero` `sheen` prop). |
| `.kam-ds-spec`, `.kam-ds-dotfield`, `.kam-ds-index` | Inset readouts, dot texture, section indices. |
| `.kam-section-title` | H2 rail — Inter + left border. |
| `.kam-link` | Underlined links, `cursor-pointer`, brand hover. |

---

## 8. Layout

| Element | Spec |
|---------|------|
| Site max width | `max-w-[1480px]` |
| Sidebar | `calc(var(--spacing) * 72)`; sticky; **no** heavy rounded “glass card”. |
| Article default | `max-w-[40rem]` |
| Article wide | Specimen + lab reference pages |
| Code figures | `border-radius: var(--radius-sm)`; dark Shiki island on light pages |

---

## 9. Accessibility

- **Skip link** → `#kam-main-content`
- **Contrast** — AA for text and controls in light and dark.
- **Focus** — `outline-ring/50` baseline; stark `focus-visible` rings on segments and extract controls.
- **Tabs** — `SpecimenWorkspace` uses `role="tablist"` / `tab` / `tabpanel` with `aria-selected`, `inert` on the hidden panel, and labels.
- **Targets** — Prefer ≥44px touch targets on mobile (sidebar menu, extract buttons).

---

## 10. Quick links

- **Tokens + utilities:** `src/styles/global.css`
- **Layout:** `src/layouts/DocsLayout.astro`
- **Chamber:** `src/components/docs/ContainmentChamber.astro`
- **Tabs + telemetry:** `src/components/react/SpecimenWorkspace.tsx`, `ContainmentChamber.tsx` (React), `TelemetryReadout.tsx`
- **Registry:** [shadcn registry](https://ui.shadcn.com/docs/registry)
