import { Grid } from './grid';
import { SpatialIndex } from './ai/spatialIndex';
import { Renderer } from './rendering/renderer';
import { Plant } from './entities/Plant';
import { Herbivore } from './entities/Herbivore';
import { Carnivore } from './entities/Carnivore';
import { resetEntityIds } from './entities/Entity';
import {
  GRID_W, GRID_H, MAX_POPULATION,
} from './config';
import { EntityType } from './types';
import type { SimParams, InitialCounts } from './types';
import type { Entity } from './entities/Entity';

export class SimulationEngine {
  grid: Grid;
  spatialIndex: SpatialIndex;
  params: SimParams;
  initialCounts: InitialCounts;

  plants: Plant[] = [];
  herbivores: Herbivore[] = [];
  carnivores: Carnivore[] = [];

  private renderer: Renderer;
  private running = false;
  private rafHandle = 0;
  private lastTime = 0;
  private accumulator = 0;

  tickCount = 0;

  constructor(canvas: HTMLCanvasElement, params: SimParams, initialCounts: InitialCounts) {
    this.params = params;
    this.initialCounts = initialCounts;
    this.grid = new Grid();
    this.spatialIndex = new SpatialIndex();
    this.renderer = new Renderer(canvas);
    this.initEntities();
  }

  private initEntities(): void {
    resetEntityIds();
    // Scatter plants — only need a plant-free cell, animals may share
    for (let i = 0; i < this.initialCounts.plant; i++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (!this.grid.hasPlant(x, y)) this.spawnPlantAt(x, y, 1 + Math.random() * (this.params.plant.nutrientMax - 1));
    }
    // Scatter herbivores
    for (let i = 0; i < this.initialCounts.herbivore; i++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y)) this.spawnHerbivoreAt(x, y, this.params.herbivore.nutrientMax * 0.6);
    }
    // Scatter carnivores
    for (let i = 0; i < this.initialCounts.carnivore; i++) {
      const x = Math.floor(Math.random() * GRID_W);
      const y = Math.floor(Math.random() * GRID_H);
      if (this.grid.isEmpty(x, y)) this.spawnCarnivoreAt(x, y, this.params.carnivore.nutrientMax * 0.6);
    }
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────────

  private spawnPlantAt(x: number, y: number, nutrients: number): Plant {
    const p = new Plant(x, y, nutrients);
    this.plants.push(p);
    this.grid.set(x, y, EntityType.Plant, p.id, Math.round((nutrients / this.params.plant.nutrientMax) * 255));
    return p;
  }

  trySpawnPlant(fromX: number, fromY: number): void {
    if (this.plants.filter(p => p.alive).length >= MAX_POPULATION.plant) return;
    const radius = this.params.plant.spawnRadius;
    const pos = this.grid.randomPlantEmptyInRadius(fromX, fromY, radius);
    if (pos) this.spawnPlantAt(pos[0], pos[1], 1);
  }

  private spawnHerbivoreAt(x: number, y: number, nutrients: number): Herbivore {
    const h = new Herbivore(x, y, nutrients);
    this.herbivores.push(h);
    this.grid.set(x, y, EntityType.Herbivore, h.id, Math.round(h.nutrientRatio(this.params.herbivore.nutrientMax) * 255));
    return h;
  }

  spawnHerbivore(fromX: number, fromY: number, nutrients: number): void {
    if (this.herbivores.filter(h => h.alive).length >= MAX_POPULATION.herbivore) return;
    const pos = this.grid.randomEmptyInRadius(fromX, fromY, 3);
    if (pos) this.spawnHerbivoreAt(pos[0], pos[1], nutrients);
  }

  private spawnCarnivoreAt(x: number, y: number, nutrients: number): Carnivore {
    const c = new Carnivore(x, y, nutrients);
    this.carnivores.push(c);
    this.grid.set(x, y, EntityType.Carnivore, c.id, Math.round(c.nutrientRatio(this.params.carnivore.nutrientMax) * 255));
    return c;
  }

  spawnCarnivore(fromX: number, fromY: number, nutrients: number): void {
    if (this.carnivores.filter(c => c.alive).length >= MAX_POPULATION.carnivore) return;
    const pos = this.grid.randomEmptyInRadius(fromX, fromY, 3);
    if (pos) this.spawnCarnivoreAt(pos[0], pos[1], nutrients);
  }

  // ── Entity queries ────────────────────────────────────────────────────────

  getPlantAt(x: number, y: number): Plant | null {
    if (!this.grid.hasPlant(x, y)) return null;
    for (const p of this.plants) {
      if (p.alive && p.x === x && p.y === y) return p;
    }
    return null;
  }

  killEntity(entity: Entity): void {
    entity.alive = false;
    if (entity.type === EntityType.Plant) {
      this.grid.clearPlant(entity.x, entity.y);
    } else {
      this.grid.clear(entity.x, entity.y);
    }
  }

  // ── Counts (live only) ────────────────────────────────────────────────────

  get plantCount(): number { return this.plants.filter(p => p.alive).length; }
  get herbivoreCount(): number { return this.herbivores.filter(h => h.alive).length; }
  get carnivoreCount(): number { return this.carnivores.filter(c => c.alive).length; }

  // ── Tick logic ─────────────────────────────────────────────────────────────

  drawInitial(): void {
    this.renderer.draw(this);
  }

  step(): void {
    this.doTick();
    this.renderer.draw(this);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafHandle = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafHandle);
  }

  get isRunning(): boolean { return this.running; }

  reset(params: SimParams, initialCounts: InitialCounts): void {
    this.stop();
    this.grid.reset();
    this.plants = [];
    this.herbivores = [];
    this.carnivores = [];
    this.tickCount = 0;
    this.accumulator = 0;
    this.params = params;
    this.initialCounts = initialCounts;
    this.initEntities();
    this.renderer.draw(this);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(now - this.lastTime, 150);
    this.lastTime = now;
    this.accumulator += dt;

    const tickInterval = this.params.simSpeed;
    while (this.accumulator >= tickInterval) {
      this.doTick();
      this.accumulator -= tickInterval;
    }

    this.renderer.draw(this);
    this.rafHandle = requestAnimationFrame(this.loop);
  };

  private doTick(): void {
    this.tickCount++;
    this.spatialIndex.rebuild(this.herbivores, this.carnivores);

    for (const p of this.plants) if (p.alive) p.tick(this);
    for (const h of this.herbivores) if (h.alive) h.tick(this);
    for (const c of this.carnivores) if (c.alive) c.tick(this);

    this.pruneDeadEntities();
  }

  private pruneDeadEntities(): void {
    // Prune periodically to avoid unbounded array growth
    if (this.tickCount % 100 === 0) {
      this.plants = this.plants.filter(p => p.alive);
      this.herbivores = this.herbivores.filter(h => h.alive);
      this.carnivores = this.carnivores.filter(c => c.alive);
    }
  }
}
