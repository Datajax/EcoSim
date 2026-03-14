/**
 * EcoSim Headless Optimizer
 *
 * Runs 1000 random parameter permutations of the simulation (no canvas / no
 * rendering) and reports which configurations keep all three populations
 * (plants, herbivores, carnivores) alive for 5000 ticks.
 *
 * Usage:  npx tsx scripts/optimize.ts
 *
 * Outputs:
 *   scripts/optimization_results.json  – all runs sorted by survival length
 *   scripts/best_settings.json         – best survivor in localStorage format
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { Grid }          from '../src/grid.js';
import { SpatialIndex }  from '../src/ai/spatialIndex.js';
import { Plant }         from '../src/entities/Plant.js';
import { Herbivore }     from '../src/entities/Herbivore.js';
import { Carnivore }     from '../src/entities/Carnivore.js';
import { resetEntityIds } from '../src/entities/Entity.js';
import {
  GRID_W, GRID_H, MAX_POPULATION,
  DEFAULT_PARAMS, DEFAULT_INITIAL_COUNTS,
} from '../src/config.js';
import { EntityType }    from '../src/types.js';
import type { SimParams, InitialCounts } from '../src/types.js';
import type { Entity }   from '../src/entities/Entity.js';

// ── Headless simulation ──────────────────────────────────────────────────────
// Mirrors SimulationEngine's public interface (what entities/AI call back on)
// but has no Renderer dependency.

class HeadlessSim {
  grid:         Grid;
  spatialIndex: SpatialIndex;
  params:       SimParams;
  initialCounts: InitialCounts;

  plants:     Plant[]     = [];
  herbivores: Herbivore[] = [];
  carnivores: Carnivore[] = [];
  tickCount = 0;

  // O(1) live-count tracking (avoids Array.filter on every tick)
  private _plantAlive = 0;
  private _herbAlive  = 0;
  private _carnAlive  = 0;

  // O(1) plant lookup by grid position
  private plantMap = new Map<number, Plant>(); // key: y*GRID_W + x

  constructor(params: SimParams, initialCounts: InitialCounts) {
    this.params        = params;
    this.initialCounts = initialCounts;
    this.grid          = new Grid();
    this.spatialIndex  = new SpatialIndex();
    this.init();
  }

  private init(): void {
    resetEntityIds();
    for (let i = 0; i < this.initialCounts.plant; i++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (!this.grid.hasPlant(x, y))
        this.spawnPlantAt(x, y, 1 + Math.random() * (this.params.plant.nutrientMax - 1));
    }
    for (let i = 0; i < this.initialCounts.herbivore; i++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y))
        this.spawnHerbivoreAt(x, y, this.params.herbivore.nutrientMax * 0.6);
    }
    for (let i = 0; i < this.initialCounts.carnivore; i++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y))
        this.spawnCarnivoreAt(x, y, this.params.carnivore.nutrientMax * 0.6);
    }
  }

  // ── Spawn helpers ────────────────────────────────────────────────────────

  private spawnPlantAt(x: number, y: number, nutrients: number): Plant {
    const p = new Plant(x, y, nutrients);
    this.plants.push(p);
    this._plantAlive++;
    this.plantMap.set(y * GRID_W + x, p);
    this.grid.set(x, y, EntityType.Plant, p.id,
      Math.round((nutrients / this.params.plant.nutrientMax) * 255));
    return p;
  }

  trySpawnPlant(fromX: number, fromY: number): void {
    if (this._plantAlive >= MAX_POPULATION.plant) return;
    const pos = this.grid.randomPlantEmptyInRadius(fromX, fromY, this.params.plant.spawnRadius);
    if (pos) this.spawnPlantAt(pos[0], pos[1], 1);
  }

  private spawnHerbivoreAt(x: number, y: number, nutrients: number): Herbivore {
    const h = new Herbivore(x, y, nutrients);
    this.herbivores.push(h);
    this._herbAlive++;
    this.grid.set(x, y, EntityType.Herbivore, h.id,
      Math.round(h.nutrientRatio(this.params.herbivore.nutrientMax) * 255));
    return h;
  }

  spawnHerbivore(fromX: number, fromY: number, nutrients: number): void {
    if (this._herbAlive >= MAX_POPULATION.herbivore) return;
    const pos = this.grid.randomEmptyInRadius(fromX, fromY, 3);
    if (pos) this.spawnHerbivoreAt(pos[0], pos[1], nutrients);
  }

  private spawnCarnivoreAt(x: number, y: number, nutrients: number): Carnivore {
    const c = new Carnivore(x, y, nutrients);
    this.carnivores.push(c);
    this._carnAlive++;
    this.grid.set(x, y, EntityType.Carnivore, c.id,
      Math.round(c.nutrientRatio(this.params.carnivore.nutrientMax) * 255));
    return c;
  }

  spawnCarnivore(fromX: number, fromY: number, nutrients: number): void {
    if (this._carnAlive >= MAX_POPULATION.carnivore) return;
    const pos = this.grid.randomEmptyInRadius(fromX, fromY, 3);
    if (pos) this.spawnCarnivoreAt(pos[0], pos[1], nutrients);
  }

  getPlantAt(x: number, y: number): Plant | null {
    if (!this.grid.hasPlant(x, y)) return null;
    return this.plantMap.get(y * GRID_W + x) ?? null;
  }

  killEntity(entity: Entity): void {
    entity.alive = false;
    if (entity.type === EntityType.Plant) {
      this.grid.clearPlant(entity.x, entity.y);
      this.plantMap.delete(entity.y * GRID_W + entity.x);
      this._plantAlive--;
    } else if (entity.type === EntityType.Herbivore) {
      this.grid.clear(entity.x, entity.y);
      this._herbAlive--;
    } else {
      this.grid.clear(entity.x, entity.y);
      this._carnAlive--;
    }
  }

  get plantCount():    number { return this._plantAlive; }
  get herbivoreCount(): number { return this._herbAlive; }
  get carnivoreCount(): number { return this._carnAlive; }

  tick(): void {
    this.tickCount++;
    this.spatialIndex.rebuild(this.herbivores, this.carnivores);
    for (const p of this.plants)     if (p.alive) p.tick(this as any);
    for (const h of this.herbivores) if (h.alive) h.tick(this as any);
    for (const c of this.carnivores) if (c.alive) c.tick(this as any);
    if (this.tickCount % 100 === 0) {
      this.plants     = this.plants.filter(p => p.alive);
      this.herbivores = this.herbivores.filter(h => h.alive);
      this.carnivores = this.carnivores.filter(c => c.alive);
    }
  }
}

// ── Parameter ranges (mirror of UI slider bounds) ────────────────────────────

interface Range { min: number; max: number; step: number; }

const R = {
  plant: {
    nutrientMax:  { min: 2,     max: 20,  step: 1     },
    growthRate:   { min: 0.005, max: 0.1, step: 0.005 },
    spawnRadius:  { min: 1,     max: 10,  step: 1     },
  },
  herbivore: {
    nutrientMax:      { min: 10,   max: 120, step: 1    },
    nutrientLossRate: { min: 0.01, max: 0.5, step: 0.01 },
    speed:            { min: 1,    max: 8,   step: 1    },
    perceptionRadius: { min: 2,    max: 30,  step: 1    },
    mateThreshold:    { min: 5,    max: 100, step: 1    },
    mateChance:       { min: 0.05, max: 1.0, step: 0.05 },
  },
  carnivore: {
    nutrientMax:            { min: 10,   max: 150, step: 1    },
    nutrientLossRate:       { min: 0.01, max: 0.5, step: 0.01 },
    speed:                  { min: 1,    max: 8,   step: 1    },
    perceptionRadius:       { min: 2,    max: 30,  step: 1    },
    mateThreshold:          { min: 5,    max: 120, step: 1    },
    mateChance:             { min: 0.05, max: 1.0, step: 0.05 },
    killChance:             { min: 0.05, max: 1.0, step: 0.05 },
    failedKillStunDuration: { min: 0,    max: 20,  step: 1    },
  },
  initialCounts: {
    plant:     { min: 50,  max: 2000, step: 50 },
    herbivore: { min: 10,  max: 500,  step: 10 },
    carnivore: { min: 1,   max: 100,  step: 1  },
  },
};

// ── Sampling helpers ─────────────────────────────────────────────────────────

function randStep(r: Range): number {
  const n = Math.floor((r.max - r.min) / r.step);
  return r.min + Math.floor(Math.random() * (n + 1)) * r.step;
}

function perturb(value: number, factor: number, r: Range): number {
  const delta = (Math.random() * 2 - 1) * factor * value;
  const raw   = Math.max(r.min, Math.min(r.max, value + delta));
  const n     = Math.floor((r.max - r.min) / r.step);
  const idx   = Math.round((raw - r.min) / r.step);
  return r.min + Math.min(n, Math.max(0, idx)) * r.step;
}

type Mode = 'random' | 'perturb';

function generateParams(mode: Mode): { params: SimParams; initialCounts: InitialCounts } {
  const d  = DEFAULT_PARAMS;
  const dc = DEFAULT_INITIAL_COUNTS;
  const PF = 0.35; // ±35% perturbation factor

  const p = (def: number, r: Range) =>
    mode === 'random' ? randStep(r) : perturb(def, PF, r);

  const herbNutMax = p(d.herbivore.nutrientMax, R.herbivore.nutrientMax);
  const carnNutMax = p(d.carnivore.nutrientMax, R.carnivore.nutrientMax);

  // mateThreshold must be strictly less than nutrientMax
  const herbMateR: Range = { ...R.herbivore.mateThreshold, max: Math.min(R.herbivore.mateThreshold.max, herbNutMax - 1) };
  const carnMateR: Range = { ...R.carnivore.mateThreshold, max: Math.min(R.carnivore.mateThreshold.max, carnNutMax - 1) };

  return {
    params: {
      plant: {
        nutrientMax:  p(d.plant.nutrientMax,  R.plant.nutrientMax),
        growthRate:   p(d.plant.growthRate,   R.plant.growthRate),
        spawnRadius:  p(d.plant.spawnRadius,  R.plant.spawnRadius),
      },
      herbivore: {
        nutrientMax:      herbNutMax,
        nutrientLossRate: p(d.herbivore.nutrientLossRate, R.herbivore.nutrientLossRate),
        speed:            p(d.herbivore.speed,            R.herbivore.speed),
        perceptionRadius: p(d.herbivore.perceptionRadius, R.herbivore.perceptionRadius),
        mateThreshold:    p(d.herbivore.mateThreshold,    herbMateR),
        mateChance:       p(d.herbivore.mateChance,       R.herbivore.mateChance),
        killChance:       1.0, // unused for herbivores
      },
      carnivore: {
        nutrientMax:            carnNutMax,
        nutrientLossRate:       p(d.carnivore.nutrientLossRate,       R.carnivore.nutrientLossRate),
        speed:                  p(d.carnivore.speed,                  R.carnivore.speed),
        perceptionRadius:       p(d.carnivore.perceptionRadius,       R.carnivore.perceptionRadius),
        mateThreshold:          p(d.carnivore.mateThreshold,          carnMateR),
        mateChance:             p(d.carnivore.mateChance,             R.carnivore.mateChance),
        killChance:             p(d.carnivore.killChance,             R.carnivore.killChance),
        failedKillStunDuration: p(d.carnivore.failedKillStunDuration, R.carnivore.failedKillStunDuration),
      },
      simSpeed: 100,
    },
    initialCounts: {
      plant:     p(dc.plant,     R.initialCounts.plant),
      herbivore: p(dc.herbivore, R.initialCounts.herbivore),
      carnivore: p(dc.carnivore, R.initialCounts.carnivore),
    },
  };
}

// ── Run one simulation ───────────────────────────────────────────────────────

/** Returns the tick at which a population first hit 0, or MAX_TICKS+1 if it survived. */
function runSim(params: SimParams, initialCounts: InitialCounts, maxTicks: number): number {
  const sim = new HeadlessSim(params, initialCounts);
  for (let t = 0; t < maxTicks; t++) {
    sim.tick();
    if (sim.plantCount === 0 || sim.herbivoreCount === 0 || sim.carnivoreCount === 0)
      return t + 1;
  }
  return maxTicks + 1;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const TOTAL_RUNS = 1000;
const MAX_TICKS  = 5000;

interface RunResult {
  run:          number;
  survived:     boolean;
  collapseAt:   number;   // MAX_TICKS+1 when survived
  params:       SimParams;
  initialCounts: InitialCounts;
}

const results: RunResult[] = [];
const t0 = Date.now();

console.log(`\nEcoSim Optimizer — ${TOTAL_RUNS} runs × ${MAX_TICKS} ticks`);
console.log('Strategy: 40% fully-random params, 60% ±35% perturbation from defaults\n');

for (let i = 0; i < TOTAL_RUNS; i++) {
  const mode = Math.random() < 0.4 ? 'random' : 'perturb';
  const { params, initialCounts } = generateParams(mode);
  const collapseAt = runSim(params, initialCounts, MAX_TICKS);
  results.push({ run: i + 1, survived: collapseAt > MAX_TICKS, collapseAt, params, initialCounts });

  if ((i + 1) % 100 === 0) {
    const survivors = results.filter(r => r.survived).length;
    const elapsed   = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  [${String(i + 1).padStart(4)}/${TOTAL_RUNS}]  ${survivors} survivors  —  ${elapsed}s`);
  }
}

const elapsed  = ((Date.now() - t0) / 1000).toFixed(1);
const survivors = results.filter(r => r.survived);

console.log(`\nFinished in ${elapsed}s`);
console.log(`Survived 5000 ticks: ${survivors.length} / ${TOTAL_RUNS} (${(survivors.length / TOTAL_RUNS * 100).toFixed(1)}%)\n`);

// Sort all results best-first
results.sort((a, b) => b.collapseAt - a.collapseAt);

// Print top 5
const top = results.slice(0, 5);
top.forEach((r, i) => {
  const tag = r.survived ? '✓ SURVIVED 5000 ticks' : `✗ collapsed at tick ${r.collapseAt}`;
  const p   = r.params;
  const c   = r.initialCounts;
  console.log(`#${i + 1}  [run ${r.run}]  ${tag}`);
  console.log(`  Initial counts  plants=${c.plant}  herbs=${c.herbivore}  carns=${c.carnivore}`);
  console.log(`  Plant     nutrientMax=${p.plant.nutrientMax}  growthRate=${p.plant.growthRate.toFixed(3)}  spawnRadius=${p.plant.spawnRadius}`);
  console.log(`  Herbivore nutrientMax=${p.herbivore.nutrientMax}  lossRate=${p.herbivore.nutrientLossRate.toFixed(2)}  speed=${p.herbivore.speed}  perception=${p.herbivore.perceptionRadius}  mateThresh=${p.herbivore.mateThreshold}  mateChance=${p.herbivore.mateChance.toFixed(2)}`);
  console.log(`  Carnivore nutrientMax=${p.carnivore.nutrientMax}  lossRate=${p.carnivore.nutrientLossRate.toFixed(2)}  speed=${p.carnivore.speed}  perception=${p.carnivore.perceptionRadius}  mateThresh=${p.carnivore.mateThreshold}  mateChance=${p.carnivore.mateChance.toFixed(2)}  killChance=${p.carnivore.killChance.toFixed(2)}  stunDur=${p.carnivore.failedKillStunDuration}`);
  console.log();
});

// ── Write output files ────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dir, { recursive: true });

writeFileSync(
  join(__dir, 'optimization_results.json'),
  JSON.stringify(results, null, 2),
);
console.log(`All results written to scripts/optimization_results.json`);

if (survivors.length > 0) {
  const best     = survivors[0]; // already sorted best-first (all have collapseAt = MAX_TICKS+1)
  const settings = { params: best.params, initialCounts: best.initialCounts };
  writeFileSync(join(__dir, 'best_settings.json'), JSON.stringify(settings, null, 2));
  console.log(`Best settings written to scripts/best_settings.json`);
  console.log(`\nTo load in the app, open the browser console and paste:`);
  console.log(`  localStorage.setItem('ecosim_settings', '${JSON.stringify(settings)}');`);
  console.log(`  location.reload();`);
} else {
  console.log(`\nNo runs survived 5000 ticks. Longest run: ${results[0].collapseAt} ticks (run ${results[0].run}).`);
}
