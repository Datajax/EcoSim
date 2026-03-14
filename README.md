# EcoSim — Ecological Simulator

> **Last updated: 2026-03-13**

A real-time ecological simulation running in the browser. Plants grow and spread, herbivores roam and graze, carnivores hunt — all driven by nutrient mechanics and perception-based AI on a 256×256 toroidal grid.

## Entities

| Entity | Color | Behavior |
|---|---|---|
| Plants | Green (light → dark as they grow) | Stationary. Grow over time, spawn neighbors when fully grown, die when eaten to 0. Cannot spawn adjacent to another plant. |
| Herbivores | Blue (dim → bright with nutrients) | Flee carnivores → mate → eat plants → herd → wander |
| Carnivores | Red (dim → bright with nutrients) | Mate (when well-fed) → hunt herbivores → wander |

Entity brightness reflects current nutrient level — dim means near starvation, bright means well-fed.

## Getting Started

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open the URL shown in the terminal (default: `http://localhost:5173`).

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

## Controls

| Control | Action |
|---|---|
| **Start / Stop** | Toggle the simulation loop |
| **Step** | Advance exactly one tick (only when stopped) |
| **Reset** | Rebuild the world using current slider values (including Starting Counts) |
| **Reset to Defaults** | Restore all sliders to their equilibrium default values |
| **Speed slider** | Set simulation rate from 1–30 ticks per second |

## Parameter Sliders

Changes to entity sliders take effect **immediately** — no reset needed. Starting Counts only apply on the next **Reset**.

### Starting Counts
| Slider | Description |
|---|---|
| Plants | Number of plants placed at reset |
| Herbivores | Number of herbivores placed at reset |
| Carnivores | Number of carnivores placed at reset |

### Plants
| Slider | Description |
|---|---|
| Nutrient Max | Maximum nutrient level a plant reaches before spawning a neighbor |
| Growth Rate | Nutrients gained per tick |
| Spawn Radius | Maximum distance a plant can spawn an offspring cell away |

### Herbivores & Carnivores
| Slider | Description |
|---|---|
| Speed | Cells moved per tick |
| Nutrient Max | Maximum nutrient storage |
| Loss Rate | Nutrients drained per tick — entity dies when nutrients reach 0 |
| Perception | Radius in cells scanned each tick for food, mates, and threats |
| Mate Threshold | Minimum nutrients required to attempt mating |
| Mate Chance | Probability mating produces an offspring (cost always applies) |

### Carnivores only
| Slider | Description |
|---|---|
| Kill Chance | Probability a hunt attempt succeeds; on a miss the carnivore is stunned |
| Miss Stun Duration | Ticks a carnivore is frozen after a failed kill attempt |

## AI Behaviour

Mobile entities evaluate a **priority chain** every tick and execute the first applicable action:

**Herbivores:** Flee carnivores → mate (when well-fed) → eat plants (when not full) → herd → wander

**Carnivores:** Mate (when well-fed) → hunt herbivores → wander

**Herding** — When no immediate threat, food, or mate is in range, herbivores follow the nearest visible herd-member (90% chance per tick), producing emergent flocking behavior and group foraging.

**Carnivore mating viability** uses hysteresis: a carnivore becomes mate-viable once nutrients exceed `mateThreshold` and stays viable until nutrients fall below 50% of that threshold. When mate-viable, the carnivore searches for a partner at 4× its normal perception radius.

**Toroidal wrapping** — the grid has no edges. Entities that move off one side reappear on the opposite side.

**Flee behavior** — Fleeing herbivores periodically pick new escape angles (10% redirect chance per tick) chosen to avoid moving adjacent to the threatening carnivore, preventing straight-line predictable runs.

**Key design:** herbivore `perceptionRadius` is kept one cell larger than the carnivore's. This gives prey a detection head-start — herbivores begin fleeing while the predator is still unaware, creating spatial refuges where herbivore populations can recover.

Wander uses a drifting angle float (incremented with small random noise each tick) so movement looks organic rather than jittery. When blocked by other entities, movement tries up to 8 progressively rotated angles (±30°, ±60°, ±90°, 180°) so entities slide around obstacles instead of freezing.

## Architecture

```
src/
  types.ts              EntityType constant, param interfaces (InitialCounts, SimParams)
  config.ts             Grid size, default initial counts, default param values, population caps
  grid.ts               Two-layer typed-array grid (animal layer + plant layer)
  simulation.ts         Engine: tick loop, spawn/kill lifecycle, reset
  entities/
    Entity.ts           Abstract base class
    Plant.ts            Growth logic + neighbor spawning
    Herbivore.ts        Nutrient drain + AI delegation (fleeAngle state)
    Carnivore.ts        Nutrient drain + AI delegation (stunTicksRemaining, matingViable)
  ai/
    spatialIndex.ts     Bucket-based spatial hash for O(1) radius queries
    behaviors.ts        Priority FSM per species
  rendering/
    colors.ts           Nutrient → RGB mapping per entity type
    renderer.ts         Two-layer ImageData bulk-write, 3× scaled display canvas
  ui/
    sliderGroups.ts     Builds labeled slider fieldsets; stores default values as data attributes
    controls.ts         Wires buttons and sliders to the engine; Starting Counts group
```

### Key Design Decisions

**Two-layer grid** — Separate typed-array buffers for animals and plants allow a cell to hold both simultaneously. Animals are drawn on top in the renderer. `isEmpty()` checks the animal layer only; `hasPlant()` checks the plant layer.

**Plant spacing** — When a plant reproduces, candidate spawn cells are filtered to exclude any cell adjacent to an existing plant, preventing dense single-cell clusters and distributing vegetation more evenly.

**Grid storage** — Five `TypedArray` buffers across the two layers for the 256×256 grid (65,536 cells). The renderer's inner loop remains fast with a single pass over `GRID_SIZE`.

**Rendering** — An offscreen 256×256 canvas is written pixel-by-pixel via `ImageData`, then scaled 3× to the 768×768 display canvas with `imageSmoothingEnabled = false` for a crisp pixel look.

**Spatial queries** — A bucket-based spatial hash (10×10 cell buckets) is rebuilt each tick from the live entity lists. Perception-radius scans check only the relevant buckets, keeping per-entity query cost well below O(N).

**Param propagation** — All entities of a type share one `params` object by reference. Slider callbacks mutate it directly; every entity sees the change on its next tick with zero overhead.

**Starting Counts as mutable state** — `initialCounts` is a plain object held in `main.ts` and mutated by the Starting Counts sliders. It is passed to `SimulationEngine.reset()` so sliders take effect on the next reset without requiring a page reload.

**Simulation speed** — A `requestAnimationFrame` accumulator decouples tick rate from render rate. Multiple ticks can fire per frame at high speed; the canvas always redraws once per frame.

## Equilibrium Values

The default parameters in `config.ts` are tuned for sustained predator-prey oscillations.

| Parameter | Value | Role |
|---|---|---|
| Plant `growthRate` | 0.025/tick | Spawn every ~100 ticks from half-full; raises the plant floor under heavy grazing |
| Plant `MAX_POPULATION` | 4000 | Caps plant density so food is a genuine limiting resource |
| Herb `perceptionRadius` | 9 | 1 cell more than carnivore's 8 — spatial escape advantage |
| Herb `mateThreshold` | 35 (70%) | Density-dependent: fast cycle (~95 ticks) when food abundant, slow (~175 ticks) when scarce |
| Herb `nutrientLossRate` | 0.08/tick | Starvation from birth in ~219 ticks; creates genuine food pressure |
| Herb `MATE_COOLDOWN` | 70 ticks | Minimum gap between matings |
| Carn `nutrientLossRate` | 0.18/tick | Starvation from birth in ~153 ticks — collapses fast when prey scarce |
| Carn `mateThreshold` | 55 (69%) | Requires 2 kills after each cooldown; breeding is food-limited |
| Carn `mateChance` | 0.60 | Lower birth probability prevents carnivore overshoot |

**Plant sustainability ceiling:** ~5 plants consumed per ~95-tick herbivore breeding cycle = 0.053 plants/tick per herbivore. At `MAX_POPULATION.plant = 4000` this supports up to ~750 herbivores sustainably; carnivores normally keep the population well below this.

## Tuning Tips

- **Everything goes extinct quickly** — reduce herbivore or carnivore **Loss Rate**, or increase plant **Growth Rate**
- **Herbivores boom and crash** — raise herbivore **Mate Threshold** or **Loss Rate**, or reduce **Starting Counts: Herbivores**
- **Carnivores wipe out herbivores** — reduce carnivore **Speed**, **Kill Chance**, or **Perception**; or raise **Mate Threshold**
- **Carnivores keep going extinct** — lower carnivore **Loss Rate** or **Mate Threshold**; increase **Starting Counts: Herbivores** to give carnivores more prey
- **Sliders drifted too far** — click **Reset to Defaults** in the slider panel to restore equilibrium values instantly

## Tech Stack

- [Vite](https://vite.dev/) — dev server and bundler
- TypeScript — strict mode, no external runtime dependencies
- HTML5 Canvas — `ImageData` bulk rendering
- Vanilla HTML/CSS — zero UI framework overhead
