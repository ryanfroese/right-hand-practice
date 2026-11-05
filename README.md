# Right-Hand Rule Practice

Infinite, auto-generated right-hand-rule practice for physics students — moving charges, currents & wires, loops & solenoids, and Lenz's law. Every diagram is inline SVG generated from code (no images), so the whole app is ~45 KB gzipped and crisp on any screen.

## How it works
- `src/physics/vec.ts` — page coordinates (+x right, +y up, +z out of page); every answer is computed with real cross products.
- `src/diagram/` — reusable SVG parts (vectors, ⊙/⊗, field grids/lines, charges, wires, bar magnet, loops, solenoids).
- `src/problems/<category>.tsx` — problem generators; each `ProblemType.generate(rng)` returns diagram + prompt + choices + answer + explanation + structured `facts`.
- `src/problems/*.test.ts` — re-derive every answer independently from `facts` over hundreds of random seeds.
- Color code: **v** green, **B** purple, **F** coral, **I** amber. Solid = near side, dashed = far side for 3D coils.

## Develop
```sh
npm install
npm run dev          # local dev server
npm test             # physics tests
npm run snap -- coil- 4   # render sample diagrams to snapshots/*.png
npm run build
```

Share a specific problem with `#t=<typeId>&s=<seed>` (the in-app "Copy link" button does this).

Deploys to GitHub Pages on every push to `main`.
