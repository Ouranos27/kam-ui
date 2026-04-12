import type { ComponentSlug } from './componentRegistry';

export const componentUsageExamples: Record<ComponentSlug, string> = {
	'chromatic-leaks': `import { ChromaticLeaks } from "@/components/ui/chromatic-leaks";

// As a transparent overlay — four corners leak colour, centre stays clear.
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <ChromaticLeaks
        color1="#7c3aed"
        color2="#f97316"
        color3="#0ea5e9"
        color4="#10b981"
        clearStop={42}
        drift={8}
      />
      {/* Content sits above — centre is transparent so it remains readable */}
      <div className="relative z-10 flex h-full items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white">Your heading here</h1>
      </div>
    </section>
  );
}

// Two-colour variant — opposite corners for a split-diagonal feel
export function SplitHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <ChromaticLeaks color1="#6366f1" color2="#ec4899" color3="transparent" color4="transparent" clearStop={50} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}`,
	'halo-ring': `import { HaloRing } from "@/components/ui/halo-ring";

// As a transparent overlay — ring of colour floats in the centre of the section.
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <HaloRing
        color="#a855f7"
        innerStop={28}
        bandWidth={38}
        drift={10}
        breathe={true}
      />
      {/* Content in the transparent centre zone */}
      <div className="relative z-10 flex h-full items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white">Your heading here</h1>
      </div>
    </section>
  );
}

// Warm variant — amber halo, larger band
export function WarmHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <HaloRing color="#f97316" innerStop={20} bandWidth={50} speed={0.3} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}`,
	'shimmer-ring': `import { ShimmerRing } from "@/components/ui/shimmer-ring";

// Transparent ring overlay — shimmering colour band, clear centre and edges.
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <ShimmerRing
        color="#a855f7"
        innerRadius={0.22}
        bandWidth={0.15}
        shimmer={0.65}
        bandFibers={0.55}
        drift={0.04}
      />
      {/* Content sits in the transparent centre zone */}
      <div className="relative z-10 flex h-full items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white">Your heading here</h1>
      </div>
    </section>
  );
}

// Tight sparkle ring — narrow band, high shimmer
export function SparkleHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <ShimmerRing color="#ec4899" innerRadius={0.28} bandWidth={0.06} shimmer={0.9} speed={1.2} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}`,
	'crown-glow': `import { CrownGlow } from "@/components/ui/crown-glow";

// Crown / horizon glow — glowing arc visible at the top of the composition.
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <CrownGlow
        color1="#a855f7"
        color2="#7c3aed"
        centerY={1.25}
        radius1={0.65}
        radius2={0.9}
        shimmer={0.55}
        arcFibers={0.55}
      />
      {/* Content reads clearly against the dark base below the crown */}
      <div className="relative z-10 flex h-full items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white">Your heading here</h1>
      </div>
    </section>
  );
}

// Warm amber crown — lower centre, wider arc
export function WarmCrown() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <CrownGlow color1="#f97316" color2="#dc2626" centerY={1.15} radius1={0.8} radius2={1.1} shimmer={0.4} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}`,
	'chromatic-field': `import { ChromaticField } from "@/components/ui/chromatic-field";

// Full-screen cinematic background — dark field with chromatic lens fringing.
// Sphere stays canvas-centred by default; set mouseMoveSphere for parallax.
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <ChromaticField
        color="#b4ccdf"
        aberration={0.55}
        speed={0.55}
        intensity={1.0}
        coronaFibers={0.65}
      />
      {/* Content floats above the dark field */}
      <div className="relative z-10 flex h-full items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white">Your heading here</h1>
      </div>
    </section>
  );
}

// Warm variant — amber accent, stronger aberration
export function WarmHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <ChromaticField color="#fbbf24" aberration={0.8} speed={0.4} intensity={1.2} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}`,
	'radiant-veil': `import { RadiantVeil } from "@/components/ui/radiant-veil";

// As a transparent overlay — the page background shows through the clear zone.
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-white">
      {/* Radiant overlay — transparent at centre, violet bleeds in from the top */}
      <RadiantVeil
        color="#7c3aed"
        from="top"
        clearStop={40}
        size={125}
        drift={6}
        breathe={false}
      />
      {/* Content sits above the overlay — the clear centre keeps it readable */}
      <div className="relative z-10 flex h-full items-center justify-center p-8">
        <h1 className="text-4xl font-bold">Your heading here</h1>
      </div>
    </section>
  );
}

// Dark-surface variant — use a near-black bg + deep accent
export function DarkHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-zinc-950">
      <RadiantVeil color="#0d1a36" from="bottom" clearStop={40} size={125} drift={5} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}

// Colour morph — accent cycles rose → amber → fuchsia
export function MorphHero() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden bg-zinc-950">
      <RadiantVeil
        variant="morph"
        color="#e11d48"
        color2="#f59e0b"
        color3="#d946ef"
        speed={0.4}
      />
      <div className="relative z-10 p-8 text-white">Content</div>
    </section>
  );
}

// Dual — two radial sources in emerald + cyan drift independently
export function DualHero() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden bg-zinc-950">
      <RadiantVeil
        variant="dual"
        color="#10b981"
        color2="#06b6d4"
        from="top-left"
      />
      <div className="relative z-10 p-8 text-white">Content</div>
    </section>
  );
}`,
	'solar-flare': `import { SolarFlare } from "@/components/ui/solar-flare";

// Full-screen procedural sun — photosphere, chromosphere band, and corona tongues.
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <SolarFlare
        className="absolute inset-0"
        color="#ff8840"
        radius={0.24}
        flareCount={5}
        limbDark={0.7}
        speed={0.5}
        intensity={1.0}
      />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}

// Quiet sun — smaller disk, calmer corona, slower flow
export function QuietHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <SolarFlare color="#ffb347" radius={0.20} flareCount={2} speed={0.3} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}

// Taller corona — stretch glow top/bottom (defaults are 1,1 for a circular halo)
export function TallCoronaHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <SolarFlare color="#ff8840" coronaRadiiX={1} coronaRadiiY={1.35} />
      <div className="relative z-10 p-8">Content</div>
    </section>
  );
}`,
	'mesh-gradient': `import { MeshGradient } from "@/components/ui/mesh-gradient";

// Default — indigo, pink, teal, amber on deep navy
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <MeshGradient className="absolute inset-0" />
      <div className="relative z-10 flex min-h-[60vh] items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white">Your heading</h1>
      </div>
    </section>
  );
}

// Warm sunset palette
export function SunsetMesh() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden">
      <MeshGradient
        color1="#f97316"
        color2="#ef4444"
        color3="#eab308"
        color4="#f59e0b"

        speed={0.3}
      />
      <div className="relative z-10 p-8 text-white">Content</div>
    </section>
  );
}

// Ocean — cool tones, slower drift
export function OceanMesh() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden">
      <MeshGradient
        color1="#0ea5e9"
        color2="#6366f1"
        color3="#14b8a6"
        color4="#8b5cf6"

        blobScale={1.0}
        speed={0.25}
      />
      <div className="relative z-10 p-8 text-white">Content</div>
    </section>
  );
}`,
	'atmospheric-sky': `import { AtmosphericSky } from "@/components/ui/atmospheric-sky";

// Animated day/night cycle — sun drifts across the sky
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <AtmosphericSky className="absolute inset-0" />
      <div className="relative z-10 flex min-h-[60vh] items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white drop-shadow-lg">Your heading</h1>
      </div>
    </section>
  );
}

// Frozen sunset — no animation, dramatic warm sky
export function SunsetHero() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden">
      <AtmosphericSky
        sunZenith={1.5}
        animateSun={false}
        exposure={12}
        mieScale={2}
        className="absolute inset-0"
      />
      <div className="relative z-10 p-8 text-white">Content</div>
    </section>
  );
}

// Night sky with stars — sun below horizon
export function NightHero() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden">
      <AtmosphericSky
        sunZenith={2.0}
        animateSun={false}
        exposure={4}
        className="absolute inset-0"
      />
      <div className="relative z-10 p-8 text-white">Content</div>
    </section>
  );
}`,
	'milky-way': `// REQUIRED ASSET: copy public/milky-way/milky-way.jpg (~945 KB)
// from the kam-ui repo into your project's public/ folder.
// Credit: ESA/Gaia/DPAC (CC BY-SA 3.0 IGO)

import { MilkyWay } from "@/components/ui/milky-way";

// Full galaxy background
export function GalaxyHero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden">
      <MilkyWay className="absolute inset-0" />
      <div className="relative z-10 flex min-h-[60vh] items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white drop-shadow-lg">Explore the Galaxy</h1>
      </div>
    </section>
  );
}

// Bright, rotated view
export function BrightGalaxy() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden">
      <MilkyWay
        brightness={2.5}
        rotation={1.2}
        speed={0.05}
        className="absolute inset-0"
      />
      <div className="relative z-10 p-8 text-white">Content</div>
    </section>
  );
}`,
	'black-hole': `// REQUIRED ASSETS: copy the entire public/black-hole/ folder (~3.6 MB)
// from the kam-ui repo into your project's public/ folder.
// Contains: deflection.dat, inverse_radius.dat, doppler.dat,
//           black_body.dat, noise_texture.png
// License: BSD-3-Clause (Eric Bruneton)

import { BlackHole } from "@/components/ui/black-hole";

// Physical Schwarzschild + accretion disc (Bruneton et al., beam tracing + precomputed tables).
export function Hero() {
  return (
    <section className="relative min-h-[60vh] w-full overflow-hidden bg-black">
      <BlackHole className="absolute inset-0 min-h-full" />
      <div className="relative z-10 flex min-h-[60vh] items-center justify-center p-8">
        <h1 className="text-4xl font-bold text-white">Your heading</h1>
      </div>
    </section>
  );
}

// Closer camera, tilted view, hotter disc
export function TunedBlackHole() {
  return (
    <section className="relative min-h-[70vh] w-full overflow-hidden bg-black">
      <BlackHole
        cameraDistanceIndex={600}
        orbitInclinationIndex={800}
        discTemperatureIndex={520}
        exposureIndex={560}
        speed={0.6}
      />
      <div className="relative z-10 p-8 text-zinc-200">Content</div>
    </section>
  );
}`,
};
