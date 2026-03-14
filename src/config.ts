import type { SimParams } from './types';

export const GRID_W = 256;
export const GRID_H = 256;
export const GRID_SIZE = GRID_W * GRID_H;
export const DISPLAY_SIZE = 768; // 3x scale

export const DEFAULT_INITIAL_COUNTS = {
  plant: 500,
  herbivore: 80,
  carnivore: 10,
};

export const MAX_POPULATION = {
  plant: 4000,
  herbivore: 2000,
  carnivore: 500,
};

export const DEFAULT_PARAMS: SimParams = {
  plant: {
    nutrientMax: 5,
    growthRate: 0.025, // spawn every ~100 ticks from half-full (↑ from 0.020 / 125 ticks).
                       // 25% faster recovery raises the plant floor under heavy grazing.
    spawnRadius: 3,
  },
  herbivore: {
    nutrientMax: 50,
    // 0.08/tick: starvation from birth (17.5 nutrients) in ~219 ticks.
    // Higher drain (vs 0.06) ensures herbivores stay actively food-seeking during their
    // cooldown — they eat 3-5 plants but still need food after cooldown ends.
    // This ties breeding rate to plant density (density-dependent regulation):
    //   • When plants are abundant → cycle ≈ 100 ticks → fast recovery.
    //   • When plants are scarce   → cycle stretches to 150-185 ticks → automatic brake.
    nutrientLossRate: 0.08,
    speed: 2,
    // Perception 1 cell above carnivore's (9 vs 8) — prey detects predator first.
    perceptionRadius: 9,
    // 70% of nutrientMax. Cost = 17.5 each. After mating: 35 − 17.5 = 17.5.
    // Cooldown drain (70 × 0.08) = 5.6 → 11.9 remaining; eats 3 plants during cooldown
    // (+15 nutrients) → ~26.9 at cooldown end; needs ~2 more plants (~20 ticks) after.
    // Full cycle ≈ 90-100 ticks when plants are moderately available.
    // Birth rate ≈ 0.90 / (2 × 95) ≈ 0.0047/tick per individual.
    //
    // Plant sustainability check: ~5 plants eaten per 95-tick cycle = 0.053 plants/tick.
    // At growthRate=0.025 (spawn every 100 ticks), sustainable up to:
    //   H_max = MAX_POPULATION.plant / (0.053 × 100) ≈ 283 herbivores.
    // Carnivores keep H well below this ceiling in normal operation.
    mateThreshold: 35,
    mateChance: 0.90,
    killChance: 1.0,  // unused for herbivores
  },
  carnivore: {
    nutrientMax: 80,
    // 0.18/tick: starvation from birth (27.5 nutrients) in ~153 ticks.
    // ↑ from 0.15 (183 ticks): carnivores now collapse ~30 ticks faster when prey is
    // scarce, giving herbivores a wider recovery window before the next predation peak.
    nutrientLossRate: 0.18,
    speed: 3,
    // 1 cell below herbivore perception (8 < 9) — prey retains detection head-start.
    perceptionRadius: 8,
    // Cost = 27.5 each. After mating: 55 − 27.5 = 27.5.
    // Cooldown drain (70 × 0.18) = 12.6 → 14.9 remaining; needs 40.1 more.
    // Average herbivore ≈ 25 nutrients: Kill 1 → 39.9 (below 55). Kill 2 → 64.9 (≥ 55 ✓).
    // Breeding is always 2-kill food-limited after every cooldown.
    mateThreshold: 55,
    mateChance: 0.60, // ↓ from 0.80: lower birth probability prevents carnivore overshoot.
                      // Cycle ≈ 92 ticks. Rate ≈ 0.60 / (2 × 92) ≈ 0.00326/tick.
                      // Combined with faster drain, carnivore peak is lower and bust is quicker.
    // killChance=0.70: 30% miss rate. From in-range, expected extra ticks per kill from
    // stuns: X = 0.30 × (6 + X) → X ≈ 2.6 stun-overhead ticks per kill (~8 ticks total).
    killChance: 0.70,
    // 6 ticks: herbivore moves 12 cells (6×speed=2) during stun before carnivore resumes.
    failedKillStunDuration: 6,
  },
  simSpeed: 100,
};

export const MATE_COOLDOWN = 70; // ticks — minimum time between breeding attempts

// ── Three-way equilibrium summary ──────────────────────────────────────────
//
// Herbivore birth rate (plants abundant): 0.90 / (2 × 95)  ≈ 0.0047/tick
// Carnivore birth rate:                   0.60 / (2 × 92)  ≈ 0.0033/tick
// H/C birth ratio: 1.43× — herbivores recover faster than carnivores grow.
//
// Density-dependent brake (key stability mechanism):
//   Herbivore birth rate drops automatically when plants are scarce:
//   plants abundant → cycle ~95 ticks → rate 0.0047/tick
//   plants scarce   → cycle ~175 ticks → rate 0.0026/tick
//   This prevents herbivores from overrunning the plant base.
//
// Starvation asymmetry:
//   Herbivore from birth (17.5 @ 0.08): 219 ticks
//   Carnivore from birth (27.5 @ 0.18): 153 ticks  ← 30% shorter
//   Carnivores crash fast when prey is scarce; herbivores persist through lean periods.
//
// Plant ceiling (hard limit on herbivore population):
//   5 plants consumed per ~95-tick herbivore cycle = 0.053 plants/tick.
//   MAX_POPULATION.plant=1500 supports at most ~283 herbivores sustainably.
//   With carnivores keeping H near 100-150, plants stabilize at 500-800 — well clear.
