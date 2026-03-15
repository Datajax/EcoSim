/**
 * Two-phase stability tuner.
 *
 * Phase 1 — Exploration:
 *   Runs EXPLORE_RUNS single-simulation permutations of a base config,
 *   each up to MAX_TICKS. Records how long each permutation survives.
 *   Selects the TOP_N configs with the highest tick counts.
 *
 * Phase 2 — Confirmation:
 *   Runs CONFIRM_RUNS simulations for each of the top N configs to
 *   determine their true survival rate.
 *
 * Usage:  npx tsx scripts/tune_base.ts [baseConfig] [explorRuns] [topN] [confirmRuns] [maxTicks]
 * Example: npx tsx scripts/tune_base.ts 5000k2 100 5 100 7500
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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

// ── Base configs ──────────────────────────────────────────────────────────────

const BASE_CONFIGS: Record<string, { params: SimParams; initialCounts: InitialCounts }> = {
  '5000k1': {
    initialCounts: { plant: 550, herbivore: 70, carnivore: 8 },
    params: {
      plant:     { nutrientMax: 4, growthRate: 0.03, spawnRadius: 2 },
      herbivore: { nutrientMax: 33, nutrientLossRate: 0.09, speed: 2,
                   perceptionRadius: 10, mateThreshold: 32, mateChance: 0.95, killChance: 1 },
      carnivore: { nutrientMax: 91, nutrientLossRate: 0.17, speed: 3,
                   perceptionRadius: 6, mateThreshold: 46, mateChance: 0.80,
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

// ── Headless simulation ───────────────────────────────────────────────────────

class HeadlessSim {
  grid: Grid; spatialIndex: SpatialIndex;
  params: SimParams; initialCounts: InitialCounts;
  plants: Plant[] = []; herbivores: Herbivore[] = []; carnivores: Carnivore[] = [];
  tickCount = 0;
  private _p = 0; private _h = 0; private _c = 0;
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
      if (!this.grid.hasPlant(x, y)) this._spawnPlant(x, y, 1 + Math.random() * (this.params.plant.nutrientMax - 1));
    }
    for (let i = 0; i < this.initialCounts.herbivore; i++) {
      const x = Math.floor(Math.random() * GRID_W), y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y)) this._spawnHerb(x, y, this.params.herbivore.nutrientMax * 0.6);
    }
    for (let i = 0; i < this.initialCounts.carnivore; i++) {
      const x = Math.floor(Math.random() * GRID_W), y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y)) this._spawnCarn(x, y, this.params.carnivore.nutrientMax * 0.6);
    }
  }
  private _spawnPlant(x: number, y: number, n: number): Plant {
    const p = new Plant(x, y, n); this.plants.push(p); this._p++;
    this.plantMap.set(y * GRID_W + x, p);
    this.grid.set(x, y, EntityType.Plant, p.id, Math.round((n / this.params.plant.nutrientMax) * 255));
    return p;
  }
  trySpawnPlant(fx: number, fy: number): void {
    if (this._p >= MAX_POPULATION.plant) return;
    const pos = this.grid.randomPlantEmptyInRadius(fx, fy, this.params.plant.spawnRadius);
    if (pos) this._spawnPlant(pos[0], pos[1], 1);
  }
  private _spawnHerb(x: number, y: number, n: number): Herbivore {
    const h = new Herbivore(x, y, n); this.herbivores.push(h); this._h++;
    this.grid.set(x, y, EntityType.Herbivore, h.id, Math.round(h.nutrientRatio(this.params.herbivore.nutrientMax) * 255));
    return h;
  }
  spawnHerbivore(fx: number, fy: number, n: number): void {
    if (this._h >= MAX_POPULATION.herbivore) return;
    const pos = this.grid.randomEmptyInRadius(fx, fy, 3); if (pos) this._spawnHerb(pos[0], pos[1], n);
  }
  private _spawnCarn(x: number, y: number, n: number): Carnivore {
    const c = new Carnivore(x, y, n); this.carnivores.push(c); this._c++;
    this.grid.set(x, y, EntityType.Carnivore, c.id, Math.round(c.nutrientRatio(this.params.carnivore.nutrientMax) * 255));
    return c;
  }
  spawnCarnivore(fx: number, fy: number, n: number): void {
    if (this._c >= MAX_POPULATION.carnivore) return;
    const pos = this.grid.randomEmptyInRadius(fx, fy, 3); if (pos) this._spawnCarn(pos[0], pos[1], n);
  }
  getPlantAt(x: number, y: number): Plant | null {
    if (!this.grid.hasPlant(x, y)) return null;
    return this.plantMap.get(y * GRID_W + x) ?? null;
  }
  killEntity(entity: Entity): void {
    entity.alive = false;
    if (entity.type === EntityType.Plant) {
      this.grid.clearPlant(entity.x, entity.y); this.plantMap.delete(entity.y * GRID_W + entity.x); this._p--;
    } else if (entity.type === EntityType.Herbivore) {
      this.grid.clear(entity.x, entity.y); this._h--;
    } else { this.grid.clear(entity.x, entity.y); this._c--; }
  }
  get plantCount():    number { return this._p; }
  get herbivoreCount(): number { return this._h; }
  get carnivoreCount(): number { return this._c; }
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

// ── Parameter ranges (UI slider bounds) ──────────────────────────────────────

interface Range { min: number; max: number; step: number; }
const R = {
  plant:     { nutrientMax: {min:2,max:20,step:1}, growthRate: {min:0.005,max:0.1,step:0.005}, spawnRadius: {min:1,max:10,step:1} },
  herbivore: { nutrientMax: {min:10,max:120,step:1}, nutrientLossRate: {min:0.01,max:0.5,step:0.01},
               speed: {min:1,max:8,step:1}, perceptionRadius: {min:2,max:30,step:1},
               mateThreshold: {min:5,max:100,step:1}, mateChance: {min:0.05,max:1.0,step:0.05} },
  carnivore: { nutrientMax: {min:10,max:150,step:1}, nutrientLossRate: {min:0.01,max:0.5,step:0.01},
               speed: {min:1,max:8,step:1}, perceptionRadius: {min:2,max:30,step:1},
               mateThreshold: {min:5,max:120,step:1}, mateChance: {min:0.05,max:1.0,step:0.05},
               killChance: {min:0.05,max:1.0,step:0.05}, failedKillStunDuration: {min:0,max:20,step:1} },
  initialCounts: { plant: {min:50,max:2000,step:50}, herbivore: {min:10,max:500,step:10}, carnivore: {min:1,max:100,step:1} },
};

function perturb(value: number, factor: number, r: Range): number {
  const delta = (Math.random() * 2 - 1) * factor * value;
  const raw   = Math.max(r.min, Math.min(r.max, value + delta));
  const n     = Math.floor((r.max - r.min) / r.step);
  const idx   = Math.round((raw - r.min) / r.step);
  return r.min + Math.min(n, Math.max(0, idx)) * r.step;
}

function generatePermutation(
  base: { params: SimParams; initialCounts: InitialCounts },
  factor: number,
): { params: SimParams; initialCounts: InitialCounts } {
  const d  = base.params;
  const dc = base.initialCounts;
  const p  = (val: number, r: Range) => perturb(val, factor, r);

  const herbNutMax = p(d.herbivore.nutrientMax, R.herbivore.nutrientMax);
  const carnNutMax = p(d.carnivore.nutrientMax, R.carnivore.nutrientMax);
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
        killChance:       1.0,
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

// ── Simulation runner ─────────────────────────────────────────────────────────

/** Returns tick at collapse, or maxTicks+1 if survived. */
function runOnce(params: SimParams, initialCounts: InitialCounts, maxTicks: number): number {
  const sim = new HeadlessSim(params, initialCounts);
  for (let t = 0; t < maxTicks; t++) {
    sim.tick();
    if (sim.plantCount === 0 || sim.herbivoreCount === 0 || sim.carnivoreCount === 0) return t + 1;
  }
  return maxTicks + 1;
}

/** Runs N times, returns { survived, collapsed, collapsedBy, buckets }. */
function runBatch(
  params: SimParams, initialCounts: InitialCounts,
  runs: number, maxTicks: number,
  bucketSize: number, numBuckets: number,
): { survived: number; collapsed: number; collapsedBy: Record<string,number>; buckets: number[] } {
  let survived = 0, collapsed = 0;
  const collapsedBy = { plants: 0, herbivores: 0, carnivores: 0 };
  const buckets = new Array(numBuckets).fill(0);
  for (let i = 0; i < runs; i++) {
    const sim = new HeadlessSim(params, initialCounts);
    let collapseAt = -1;
    for (let t = 0; t < maxTicks; t++) {
      sim.tick();
      if (sim.plantCount === 0 || sim.herbivoreCount === 0 || sim.carnivoreCount === 0) {
        collapseAt = t + 1;
        if (sim.plantCount === 0)     collapsedBy.plants++;
        if (sim.herbivoreCount === 0) collapsedBy.herbivores++;
        if (sim.carnivoreCount === 0) collapsedBy.carnivores++;
        buckets[Math.min(numBuckets - 1, Math.floor(t / bucketSize))]++;
        break;
      }
    }
    if (collapseAt === -1) survived++;
    else collapsed++;
  }
  return { survived, collapsed, collapsedBy, buckets };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtParams(p: SimParams, ic: InitialCounts): string[] {
  return [
    `  Initial counts   plants=${ic.plant}  herbs=${ic.herbivore}  carns=${ic.carnivore}`,
    `  Plant            nutrientMax=${p.plant.nutrientMax}  growthRate=${p.plant.growthRate.toFixed(3)}  spawnRadius=${p.plant.spawnRadius}`,
    `  Herbivore        nutrientMax=${p.herbivore.nutrientMax}  lossRate=${p.herbivore.nutrientLossRate.toFixed(2)}  speed=${p.herbivore.speed}  perception=${p.herbivore.perceptionRadius}  mateThresh=${p.herbivore.mateThreshold}  mateChance=${p.herbivore.mateChance.toFixed(2)}`,
    `  Carnivore        nutrientMax=${p.carnivore.nutrientMax}  lossRate=${p.carnivore.nutrientLossRate.toFixed(2)}  speed=${p.carnivore.speed}  perception=${p.carnivore.perceptionRadius}  mateThresh=${p.carnivore.mateThreshold}  mateChance=${p.carnivore.mateChance.toFixed(2)}  killChance=${p.carnivore.killChance.toFixed(2)}  stunDur=${p.carnivore.failedKillStunDuration}`,
  ];
}

function fmtBatchResult(
  r: ReturnType<typeof runBatch>,
  runs: number, maxTicks: number, bucketSize: number, numBuckets: number,
): string[] {
  const lines: string[] = [];
  const sp = (r.survived / runs * 100).toFixed(1);
  const cp = (r.collapsed / runs * 100).toFixed(1);
  lines.push(`  Survived  ${maxTicks} ticks : ${String(r.survived).padStart(4)}  (${sp}%)`);
  lines.push(`  Collapsed before ${maxTicks}: ${String(r.collapsed).padStart(4)}  (${cp}%)`);
  if (r.collapsed > 0) {
    lines.push(`  Which population collapsed:`);
    lines.push(`    Plants     : ${String(r.collapsedBy.plants).padStart(4)}  (${(r.collapsedBy.plants / r.collapsed * 100).toFixed(1)}%)`);
    lines.push(`    Herbivores : ${String(r.collapsedBy.herbivores).padStart(4)}  (${(r.collapsedBy.herbivores / r.collapsed * 100).toFixed(1)}%)`);
    lines.push(`    Carnivores : ${String(r.collapsedBy.carnivores).padStart(4)}  (${(r.collapsedBy.carnivores / r.collapsed * 100).toFixed(1)}%)`);
    lines.push(`  Collapse tick distribution (${bucketSize}-tick buckets):`);
    for (let b = 0; b < numBuckets; b++) {
      const lo = b * bucketSize, hi = lo + bucketSize - 1;
      const bar = '█'.repeat(Math.round(r.buckets[b] / runs * 40));
      lines.push(`    ${String(lo).padStart(5)}-${String(hi).padEnd(5)}  ${String(r.buckets[b]).padStart(4)}  ${bar}`);
    }
  }
  return lines;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const baseConfigName = process.argv[2] ?? '5000k2';
const EXPLORE_RUNS   = parseInt(process.argv[3] ?? '100',  10);
const TOP_N          = parseInt(process.argv[4] ?? '5',    10);
const CONFIRM_RUNS   = parseInt(process.argv[5] ?? '100',  10);
const MAX_TICKS      = parseInt(process.argv[6] ?? '7500', 10);
const PERTURB_FACTOR = 0.30; // ±30% from base values
const BUCKET_SIZE    = Math.floor(MAX_TICKS / 10);
const NUM_BUCKETS    = 10;

const base = BASE_CONFIGS[baseConfigName];
if (!base) {
  console.error(`Unknown base config "${baseConfigName}". Available: ${Object.keys(BASE_CONFIGS).join(', ')}`);
  process.exit(1);
}

const sep  = '═'.repeat(60);
const sep2 = '─'.repeat(60);
const lines: string[] = [];
const w = (...ss: string[]) => ss.forEach(s => lines.push(s));

w(sep, `EcoSim Tuning Report`, `Generated : ${new Date().toISOString()}`, sep);
w(`Base config   : ${baseConfigName}`);
w(`Perturbation  : ±${(PERTURB_FACTOR * 100).toFixed(0)}% per parameter`);
w(`Phase 1       : ${EXPLORE_RUNS} single-run permutations  (max ${MAX_TICKS} ticks each)`);
w(`Phase 2       : ${CONFIRM_RUNS} confirmation runs for each top-${TOP_N} config`);
w(sep);
w(`BASE CONFIG PARAMETERS`);
fmtParams(base.params, base.initialCounts).forEach(l => w(l));
w(sep);

// ── Phase 1: exploration ──────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`Phase 1 — Exploring ${EXPLORE_RUNS} permutations of ${baseConfigName}`);
console.log(`  max ${MAX_TICKS} ticks per run, ±${(PERTURB_FACTOR*100).toFixed(0)}% perturbation`);
console.log(`${'─'.repeat(60)}`);

interface ExploreResult {
  permIdx:       number;
  collapseAt:    number;   // MAX_TICKS+1 = survived
  survived:      boolean;
  params:        SimParams;
  initialCounts: InitialCounts;
}

const exploreResults: ExploreResult[] = [];
const t0 = Date.now();

for (let i = 0; i < EXPLORE_RUNS; i++) {
  const perm       = generatePermutation(base, PERTURB_FACTOR);
  const collapseAt = runOnce(perm.params, perm.initialCounts, MAX_TICKS);
  exploreResults.push({
    permIdx: i + 1,
    collapseAt,
    survived: collapseAt > MAX_TICKS,
    params:        perm.params,
    initialCounts: perm.initialCounts,
  });
  if ((i + 1) % 10 === 0) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const best = Math.max(...exploreResults.map(r => r.collapseAt));
    process.stdout.write(`  [${String(i + 1).padStart(3)}/${EXPLORE_RUNS}]  best so far: ${best > MAX_TICKS ? `${MAX_TICKS}+ (survived)` : best} ticks  —  ${elapsed}s\n`);
  }
}

// Sort best-first
exploreResults.sort((a, b) => b.collapseAt - a.collapseAt);
const top = exploreResults.slice(0, TOP_N);

const p1elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nPhase 1 complete in ${p1elapsed}s`);
console.log(`Top ${TOP_N} permutations by tick count:`);
top.forEach((r, i) => {
  const tag = r.survived ? `${MAX_TICKS}+ (survived)` : `${r.collapseAt} ticks`;
  console.log(`  #${i + 1}  perm ${r.permIdx}: ${tag}`);
});

// Write phase 1 to report
w(`PHASE 1 — EXPLORATION RESULTS`);
w(`${EXPLORE_RUNS} permutations run once each (max ${MAX_TICKS} ticks)`);
w(sep2);
exploreResults.forEach((r, i) => {
  const tag = r.survived ? `SURVIVED ${MAX_TICKS}+ ticks` : `Collapsed at tick ${r.collapseAt}`;
  w(`Rank ${String(i + 1).padStart(3)}  [perm ${String(r.permIdx).padStart(3)}]  ${tag}`);
  if (i < TOP_N) fmtParams(r.params, r.initialCounts).forEach(l => w(l));
});
w(sep);

// ── Phase 2: confirmation runs ────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`Phase 2 — ${CONFIRM_RUNS} confirmation runs for top ${TOP_N} configs`);
console.log(`  max ${MAX_TICKS} ticks per run`);
console.log(`${'─'.repeat(60)}`);

w(`PHASE 2 — CONFIRMATION RESULTS`);
w(`${CONFIRM_RUNS} runs per config, max ${MAX_TICKS} ticks`);
w(sep2);

const t1 = Date.now();

for (let i = 0; i < top.length; i++) {
  const r   = top[i];
  const tag = r.survived ? `survived ${MAX_TICKS}+ ticks in phase 1` : `collapsed at tick ${r.collapseAt} in phase 1`;
  console.log(`\nConfig #${i + 1} (perm ${r.permIdx}, ${tag})`);

  const result = runBatch(r.params, r.initialCounts, CONFIRM_RUNS, MAX_TICKS, BUCKET_SIZE, NUM_BUCKETS);

  const elapsed = ((Date.now() - t1) / 1000).toFixed(1);
  console.log(`  Survived: ${result.survived}/${CONFIRM_RUNS} (${(result.survived/CONFIRM_RUNS*100).toFixed(1)}%)  —  ${elapsed}s total`);

  w(`Config #${i + 1}  [perm ${r.permIdx}]  Phase-1 result: ${tag}`);
  fmtParams(r.params, r.initialCounts).forEach(l => w(l));
  fmtBatchResult(result, CONFIRM_RUNS, MAX_TICKS, BUCKET_SIZE, NUM_BUCKETS).forEach(l => w(`  ${l}`));
  w(sep2);
}

const totalElapsed = ((Date.now() - t0) / 1000).toFixed(1);
w(sep);
w(`Total runtime: ${totalElapsed}s`);
w(sep);

// ── Write report ──────────────────────────────────────────────────────────────

const report    = lines.join('\n');
console.log(`\n${'═'.repeat(60)}`);
console.log(`Total runtime: ${totalElapsed}s`);

const __dir     = dirname(fileURLToPath(import.meta.url));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile   = join(__dir, `tune_${baseConfigName}_e${EXPLORE_RUNS}_top${TOP_N}_c${CONFIRM_RUNS}_${MAX_TICKS}t_${timestamp}.txt`);
writeFileSync(outFile, report);
console.log(`Report saved to scripts/${outFile.split(/[\\/]scripts[\\/]/)[1]}`);
