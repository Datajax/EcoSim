# Changelog

## [Unreleased]

---

## [0.6.0] - 2026-03-13

### Added
- **Failed-kill stun** — When a carnivore's kill attempt fails (governed by `killChance`), it now freezes in place for a configurable number of ticks (`failedKillStunDuration`, default 4) instead of lunging forward. This gives prey a genuine escape window after surviving an attack. Exposed as a **Miss Stun Duration** slider (0–20) on the Carnivores panel.

### Changed
- **Toroidal map wrapping** — Entity movement now wraps at all four edges instead of clamping. Entities that move off the right edge reappear on the left, and entities that move off the bottom reappear on the top (and vice versa). Replaced the `clamp` movement helper with a `wrap` function in `behaviors.ts`.

---

## [0.5.0] - 2026-03-12

### Added
- **Probabilistic killing** — Carnivore kill attempts now use a configurable `killChance` roll (default 0.80). On a miss the carnivore still lunges toward the prey but deals no damage, giving fast herbivores a chance to escape even when caught. Exposed as a **Kill Chance** slider on the Carnivores panel.
- **Probabilistic mating** — Both herbivore and carnivore mating attempts use a configurable `mateChance` roll (default 0.85). The nutrient cost and mate cooldown are always applied regardless of outcome, so failed attempts still consume resources and time. Exposed as a **Mate Chance** slider on both Herbivores and Carnivores panels.
- **Variable plant spawn radius** — Plants now scatter offspring up to a configurable radius (default 3 cells) instead of always planting in an immediately adjacent cell. This spreads vegetation more evenly across the grid and reduces dense single-cell plant clusters. Exposed as a **Spawn Radius** slider on the Plants panel.

### Changed
- **Carnivore AI priority** — Mating now takes priority over hunting when a carnivore is above `mateThreshold`. Previous order: hunt → mate → wander. New order: mate → hunt → wander. Well-fed carnivores will seek partners before continuing to chase prey.

---

## [0.4.0] - 2026-03-12

### Fixed
- **Herbivore population explosion** — Three compounding causes identified and corrected:
  - `perceptionRadius 12 → 9`: herbivores could see ~452 cells and always find food instantly; smaller radius forces active searching.
  - `mateThreshold 35 → 43` (86% of max): previously reachable after only 3 plant visits; now requires ~5, lengthening the breeding cycle to ~130–160 ticks.
  - `MAX_POPULATION.plant 4000 → 1500`: unlimited plant growth permanently fed unchecked breeding; tighter cap makes plants a genuine limiting resource.
  - `MATE_COOLDOWN 40 → 70` ticks: directly throttles maximum reproduction rate.
  - `nutrientLossRate 0.08 → 0.10`: less time spent at or above mating threshold.
  - Starting counts reduced (plants 600 → 400, herbivores 100 → 70) to avoid an explosive first wave.

### Added
- **"Reset to Defaults" button** at the top of the slider panel. Resets all entity sliders and the speed slider to `DEFAULT_PARAMS` values without restarting the simulation. Each slider carries a `data-default-value` attribute set at creation time; the button dispatches synthetic `input` events so the params object and value labels update in one pass.

---

## [0.3.0] - 2026-03-12

### Changed — Equilibrium tuning (`config.ts`)

Full analytical pass over every rate and ratio in the system. Changes target sustained Lotka-Volterra-style oscillations rather than boom-then-extinction cycles.

| Parameter | Before | After | Reason |
|---|---|---|---|
| Plant `growthRate` | 0.015 | **0.020** | Faster recovery from grazing; spawn interval drops 167 → 125 ticks/plant |
| Herb `nutrientMax` | 40 | **50** | Larger nutrient buffer; mating cost and threshold scale accordingly |
| Herb `nutrientLossRate` | 0.05 | **0.08** | Creates meaningful food pressure; starvation window ~625 ticks from full, ~250 from birth |
| Herb `perceptionRadius` | 8 | **12** | *Larger than carnivore's 9* — prey detects predator first, enabling spatial escape before the chase begins |
| Herb `mateThreshold` | 30 | **35** | 70% of new nutrientMax; roughly same relative difficulty to mate |
| Carn `nutrientMax` | 60 | **80** | Bigger nutrient tank per kill; one average kill fills only ~31% of max |
| Carn `nutrientLossRate` | 0.08 | **0.15** | Fast starvation when prey is scarce (~213 ticks from birth); enables herbivore recovery after predator crash |
| Carn `perceptionRadius` | 12 | **9** | *Smaller than herbivore's 12* — prey has a detection head-start; herbivores can flee before carnivore even sees them |
| Carn `mateThreshold` | 45 | **60** | Requires ~2 kills after cooldown to breed again; breeding is now food-limited not cooldown-limited |
| `MATE_COOLDOWN` | 30 | **40** | Slightly longer break between matings, moderates reproduction rate |
| Initial plants | 500 | **600** | Denser start gives herbivores immediate food access |
| Initial herbivores | 80 | **100** | Better starting population to absorb early predation pressure |
| Initial carnivores | 20 | **12** | Gives herbivores time to establish before significant predation begins |

**Root causes fixed by this tuning:**
- *Carnivore extinction spiral* — At old settings, carnivores hit `mateThreshold` after a single kill (gained all prey nutrients) and bred on cooldown alone. Population exploded, consumed all herbivores, then starved en masse. New settings require 2+ kills after each cooldown to breed.
- *Herbivore immortality* — Old `lossRate=0.05` gave an 800-tick starvation window; herbivores had no real food pressure and bred unchecked. New `lossRate=0.08` means a young herbivore must find food within 250 ticks.
- *No spatial refuge* — Old carnivore `perceptionRadius=12` exceeded herbivore `perceptionRadius=8`, so prey was always spotted before it could react. Inverted radii (herb 12 > carn 9) give prey a meaningful head start.

---

## [0.2.0] - 2026-03-12

### Fixed
- **Entities getting stuck** — Replaced single-attempt movement with `moveInDirection`, which tries up to 8 progressively rotated angles (±30°, ±60°, ±90°, 180°) when the direct path is blocked. Entities now slide around obstacles instead of freezing.
- **Carnivores not killing herbivores** — Replaced strict adjacency check (`isAdjacent`) with a reach-based check (`canReach`: dist ≤ speed + 0.5). Previously, carnivores with speed ≥ 2 computed their destination as the prey's occupied cell, got blocked, and looped forever without ever closing to eating range.
- **Carnivore kill sequence** — `eatHerbivore` now kills the prey first to free its grid cell, then steps the carnivore forward into the vacated position.

---

## [0.1.0] - 2026-03-12

### Added
- Initial project scaffolded with Vite + TypeScript (vanilla, no UI framework).
- **156×156 grid** backed by three typed arrays (`typeGrid`, `entityGrid`, `nutrientGrid`) for O(1) cell access.
- **Plant entity** — stationary, grows each tick, spawns a neighbor when fully grown, dies when eaten to 0.
- **Herbivore entity** — moves using priority AI: flee carnivores → eat plants → mate → wander.
- **Carnivore entity** — moves using priority AI: hunt herbivores → mate → wander.
- **Perception-based AI** — entities scan a configurable radius each tick using a bucket-based spatial hash for efficient neighbor queries.
- **Wander behavior** — drifting angle float produces smooth, organic-looking random movement.
- **Nutrient system** — all entities gain/lose nutrients each tick; entities die and are removed when nutrients reach 0.
- **Reproduction** — herbivores and carnivores mate when well-fed; reproduction costs nutrients from both parents and has a per-entity cooldown.
- **Renderer** — offscreen `ImageData` bulk-write scaled 5× to a 780×780 display canvas; entity brightness reflects nutrient level.
- **UI** — start/stop/step/reset controls; global simulation speed slider (1–30 ticks/s).
- **Parameter sliders** — live-updating sliders per entity type (plants: nutrient max, growth rate; herbivores/carnivores: speed, nutrient max, loss rate, perception radius, mate threshold).
- **Stats bar** — live tick count, plant count, herbivore count, carnivore count.
- `README.md` documenting setup, controls, sliders, and architecture.
