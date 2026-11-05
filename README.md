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

## Practice sets (instructor links)
The **Practice** panel picks topics plus three settings, and "Copy link to this practice set" puts them all in the URL.
Opening such a link gives the student exactly that set (overriding whatever they had saved); they can still change it.

| hash key | values | default |
|---|---|---|
| `topics` | category ids (`charges`, `wires`, `coils`, `induction`) and/or problem ids, comma-separated | all |
| `ans` | answer kinds that can come up: `plane` (↑↓←→), `depth` (⊙⊗), `rot` (↻↺), `zero` | all |
| `pad` | `full` = every direction (plus ↻↺ on coil-current questions) · `focused` = only answers the picture leaves open | `full` |
| `views` | coil drawings: `side`, `upright`, `end` (end-on = looking down the axis) | all |

Example — beginners, coils only, in-page answers, two-button pads, side-on coils:
`#topics=coils&ans=plane&pad=focused&views=side`

Questions whose answer is a switched-off kind are skipped; topics that can't come up at all are struck through in the panel.

Deploys to GitHub Pages on every push to `main`.
