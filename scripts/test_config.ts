/**
 * Run N simulations with a fixed named config and report survival stats.
 * Usage:  npx tsx scripts/test_config.ts [configName] [runs]
 * Example: npx tsx scripts/test_config.ts 5000k1 1000
 */

import { Grid }           from '../src/grid.js';
import { SpatialIndex }   from '../src/ai/spatialIndex.js';
import { Plant }          from '../src/entities/Plant.js';
import { Herbivore }      from '../src/entities/Herbivore.js';
import { Carnivore }      from '../src/entities/Carnivore.js';
import { resetEntityIds } from '../src/entities/Entity.js';
import { GRID_W, GRID_H, MAX_POPULATION } from '../src/config.js';
import { EntityType }     from '../src/types.js';
import type { SimParams, InitialCounts } from '../src/types.js';
import type { Entity }    from '../src/entities/Entity.js';

// ── Named configs (mirrors persistence.ts defaults) ───────────────────────────
const NAMED_CONFIGS: Record<string, { params: SimParams; initialCounts: InitialCounts }> = {
  '5000k1': {
    initialCounts: { plant: 550, herbivore: 70, carnivore: 8 },
    params: {
      plant:     { nutrientMax: 4, growthRate: 0.03, spawnRadius: 2 },
      herbivore: { nutrientMax: 33, nutrientLossRate: 0.09, speed: 2,
                   perceptionRadius: 10, mateThreshold: 32, mateChance: 0.95, killChance: 1 },
      carnivore: { nutrientMax: 91, nutrientLossRate: 0.17, speed: 3,
                   perceptionRadius: 6,  mateThreshold: 46, mateChance: 0.80,
                   killChance: 0.50, failedKillStunDuration: 6 },
      simSpeed: 100,
    },
  },
  '5000k2': {
    initialCounts: { plant: 1200, herbivore: 200, carnivore: 19 },
    params: {
      plant:     { nutrientMax: 5, growthRate: 0.075, spawnRadius: 9 },
      herbivore: { nutrientMax: 108, nutrientLossRate: 0.14, speed: 7,
                   perceptionRadius: 30, mateThreshold: 14, mateChance: 0.75, killChance: 1 },
      carnivore: { nutrientMax: 89, nutrientLossRate: 0.23, speed: 1,
                   perceptionRadius: 20, mateThreshold: 68, mateChance: 0.30,
                   killChance: 0.75, failedKillStunDuration: 3 },
      simSpeed: 100,
    },
  },
};

// ── Headless simulation (same as optimize.ts) ─────────────────────────────────
class HeadlessSim {
  grid: Grid; spatialIndex: SpatialIndex;
  params: SimParams; initialCounts: InitialCounts;
  plants: Plant[] = []; herbivores: Herbivore[] = []; carnivores: Carnivore[] = [];
  tickCount = 0;
  private _plantAlive = 0; private _herbAlive = 0; private _carnAlive = 0;
  private plantMap = new Map<number, Plant>();

  constructor(params: SimParams, initialCounts: InitialCounts) {
    this.params = params; this.initialCounts = initialCounts;
    this.grid = new Grid(); this.spatialIndex = new SpatialIndex();
    this.init();
  }

  private init(): void {
    resetEntityIds();
    for (let i = 0; i < this.initialCounts.plant; i++) {
      const x = Math.floor(Math.random() * GRID_W), y = Math.floor(Math.random() * GRID_H);
      if (!this.grid.hasPlant(x, y)) this.spawnPlantAt(x, y, 1 + Math.random() * (this.params.plant.nutrientMax - 1));
    }
    for (let i = 0; i < this.initialCounts.herbivore; i++) {
      const x = Math.floor(Math.random() * GRID_W), y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y)) this.spawnHerbivoreAt(x, y, this.params.herbivore.nutrientMax * 0.6);
    }
    for (let i = 0; i < this.initialCounts.carnivore; i++) {
      const x = Math.floor(Math.random() * GRID_W), y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y)) this.spawnCarnivoreAt(x, y, this.params.carnivore.nutrientMax * 0.6);
    }
  }

  private spawnPlantAt(x: number, y: number, n: number): Plant {
    const p = new Plant(x, y, n); this.plants.push(p); this._plantAlive++;
    this.plantMap.set(y * GRID_W + x, p);
    this.grid.set(x, y, EntityType.Plant, p.id, Math.round((n / this.params.plant.nutrientMax) * 255));
    return p;
  }
  trySpawnPlant(fx: number, fy: number): void {
    if (this._plantAlive >= MAX_POPULATION.plant) return;
    const pos = this.grid.randomPlantEmptyInRadius(fx, fy, this.params.plant.spawnRadius);
    if (pos) this.spawnPlantAt(pos[0], pos[1], 1);
  }
  private spawnHerbivoreAt(x: number, y: number, n: number): Herbivore {
    const h = new Herbivore(x, y, n); this.herbivores.push(h); this._herbAlive++;
    this.grid.set(x, y, EntityType.Herbivore, h.id, Math.round(h.nutrientRatio(this.params.herbivore.nutrientMax) * 255));
    return h;
  }
  spawnHerbivore(fx: number, fy: number, n: number): void {
    if (this._herbAlive >= MAX_POPULATION.herbivore) return;
    const pos = this.grid.randomEmptyInRadius(fx, fy, 3); if (pos) this.spawnHerbivoreAt(pos[0], pos[1], n);
  }
  private spawnCarnivoreAt(x: number, y: number, n: number): Carnivore {
    const c = new Carnivore(x, y, n); this.carnivores.push(c); this._carnAlive++;
    this.grid.set(x, y, EntityType.Carnivore, c.id, Math.round(c.nutrientRatio(this.params.carnivore.nutrientMax) * 255));
    return c;
  }
  spawnCarnivore(fx: number, fy: number, n: number): void {
    if (this._carnAlive >= MAX_POPULATION.carnivore) return;
    const pos = this.grid.randomEmptyInRadius(fx, fy, 3); if (pos) this.spawnCarnivoreAt(pos[0], pos[1], n);
  }
  getPlantAt(x: number, y: number): Plant | null {
    if (!this.grid.hasPlant(x, y)) return null;
    return this.plantMap.get(y * GRID_W + x) ?? null;
  }
  killEntity(entity: Entity): void {
    entity.alive = false;
    if (entity.type === EntityType.Plant) {
      this.grid.clearPlant(entity.x, entity.y); this.plantMap.delete(entity.y * GRID_W + entity.x); this._plantAlive--;
    } else if (entity.type === EntityType.Herbivore) {
      this.grid.clear(entity.x, entity.y); this._herbAlive--;
    } else {
      this.grid.clear(entity.x, entity.y); this._carnAlive--;
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

// ── Main ──────────────────────────────────────────────────────────────────────

const configName = process.argv[2] ?? '5000k1';
const RUNS       = parseInt(process.argv[3] ?? '1000', 10);
const MAX_TICKS  = 5000;

const cfg = NAMED_CONFIGS[configName];
if (!cfg) {
  console.error(`Unknown config "${configName}". Available: ${Object.keys(NAMED_CONFIGS).join(', ')}`);
  process.exit(1);
}

console.log(`\nTesting config "${configName}" — ${RUNS} runs × ${MAX_TICKS} ticks`);
console.log(`  Plants: ${cfg.initialCounts.plant} start  nutrientMax=${cfg.params.plant.nutrientMax}  growthRate=${cfg.params.plant.growthRate}  spawnRadius=${cfg.params.plant.spawnRadius}`);
console.log(`  Herbivores: ${cfg.initialCounts.herbivore} start  nutrientMax=${cfg.params.herbivore.nutrientMax}  lossRate=${cfg.params.herbivore.nutrientLossRate}  mateThresh=${cfg.params.herbivore.mateThreshold}  mateChance=${cfg.params.herbivore.mateChance}`);
console.log(`  Carnivores: ${cfg.initialCounts.carnivore} start  nutrientMax=${cfg.params.carnivore.nutrientMax}  lossRate=${cfg.params.carnivore.nutrientLossRate}  killChance=${cfg.params.carnivore.killChance}`);
console.log();

let survived = 0;
let collapsed = 0;
const collapsedBy: Record<string, number> = { plants: 0, herbivores: 0, carnivores: 0 };
const collapseTickBuckets: number[] = new Array(10).fill(0); // 0-499, 500-999, ..., 4500-4999

const t0 = Date.now();

for (let i = 0; i < RUNS; i++) {
  const sim = new HeadlessSim(cfg.params, cfg.initialCounts);
  let collapseAt = -1;

  for (let t = 0; t < MAX_TICKS; t++) {
    sim.tick();
    if (sim.plantCount === 0 || sim.herbivoreCount === 0 || sim.carnivoreCount === 0) {
      collapseAt = t + 1;
      if (sim.plantCount === 0)     collapsedBy.plants++;
      if (sim.herbivoreCount === 0) collapsedBy.herbivores++;
      if (sim.carnivoreCount === 0) collapsedBy.carnivores++;
      collapseTickBuckets[Math.min(9, Math.floor(t / 500))]++;
      break;
    }
  }

  if (collapseAt === -1) survived++;
  else collapsed++;

  if ((i + 1) % 100 === 0) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(`  [${String(i + 1).padStart(4)}/${RUNS}]  survived=${survived}  collapsed=${collapsed}  —  ${elapsed}s\n`);
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
const survivePct  = (survived  / RUNS * 100).toFixed(1);
const collapsePct = (collapsed / RUNS * 100).toFixed(1);

console.log(`\n${'─'.repeat(50)}`);
console.log(`Config: ${configName}   Runs: ${RUNS}   Time: ${elapsed}s`);
console.log(`${'─'.repeat(50)}`);
console.log(`  Survived  5000 ticks : ${String(survived).padStart(4)}  (${survivePct}%)`);
console.log(`  Collapsed before 5000: ${String(collapsed).padStart(4)}  (${collapsePct}%)`);

if (collapsed > 0) {
  console.log(`\n  Collapsed by population:`);
  console.log(`    Plants     went to 0: ${collapsedBy.plants}`);
  console.log(`    Herbivores went to 0: ${collapsedBy.herbivores}`);
  console.log(`    Carnivores went to 0: ${collapsedBy.carnivores}`);

  console.log(`\n  Collapse tick distribution:`);
  for (let b = 0; b < 10; b++) {
    const lo = b * 500, hi = lo + 499;
    const count = collapseTickBuckets[b];
    const bar = '█'.repeat(Math.round(count / RUNS * 40));
    console.log(`    ${String(lo).padStart(4)}-${String(hi).padEnd(4)}  ${String(count).padStart(4)}  ${bar}`);
  }
}
console.log(`${'─'.repeat(50)}`);
