import { GRID_W, GRID_H, GRID_SIZE } from './config';
import { EntityType } from './types';

export class Grid {
  /** Animal layer — herbivores and carnivores only */
  readonly animalTypeGrid: Uint8Array;
  readonly animalEntityGrid: Uint16Array;
  readonly animalNutrientGrid: Uint8Array;

  /** Plant layer — independent of animals; a cell can hold both */
  readonly plantGrid: Uint8Array;      // 1 = plant present, 0 = none
  readonly plantNutrientGrid: Uint8Array;

  constructor() {
    this.animalTypeGrid    = new Uint8Array(GRID_SIZE);
    this.animalEntityGrid  = new Uint16Array(GRID_SIZE);
    this.animalNutrientGrid = new Uint8Array(GRID_SIZE);
    this.plantGrid         = new Uint8Array(GRID_SIZE);
    this.plantNutrientGrid = new Uint8Array(GRID_SIZE);
  }

  idx(x: number, y: number): number {
    return y * GRID_W + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
  }

  /** True if no animal (herbivore or carnivore) occupies this cell */
  isEmpty(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.animalTypeGrid[this.idx(x, y)] === EntityType.Empty;
  }

  hasPlant(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.plantGrid[this.idx(x, y)] === 1;
  }

  /** Returns the animal type if one is present, the plant type if a plant is present, else Empty */
  getType(x: number, y: number): EntityType {
    if (!this.inBounds(x, y)) return EntityType.Empty;
    const i = this.idx(x, y);
    if (this.animalTypeGrid[i] !== EntityType.Empty) return this.animalTypeGrid[i] as EntityType;
    if (this.plantGrid[i]) return EntityType.Plant;
    return EntityType.Empty;
  }

  set(x: number, y: number, type: EntityType, poolIdx: number, nutrient: number): void {
    const i = this.idx(x, y);
    if (type === EntityType.Plant) {
      this.plantGrid[i] = 1;
      this.plantNutrientGrid[i] = nutrient;
    } else {
      this.animalTypeGrid[i] = type;
      this.animalEntityGrid[i] = poolIdx;
      this.animalNutrientGrid[i] = nutrient;
    }
  }

  /** Clear the animal at this cell (plant is unaffected) */
  clear(x: number, y: number): void {
    const i = this.idx(x, y);
    this.animalTypeGrid[i] = EntityType.Empty;
    this.animalEntityGrid[i] = 0;
    this.animalNutrientGrid[i] = 0;
  }

  /** Clear the plant at this cell (animal is unaffected) */
  clearPlant(x: number, y: number): void {
    const i = this.idx(x, y);
    this.plantGrid[i] = 0;
    this.plantNutrientGrid[i] = 0;
  }

  /** Update the nutrient display for the animal at this cell */
  updateNutrient(x: number, y: number, nutrient: number): void {
    this.animalNutrientGrid[this.idx(x, y)] = nutrient;
  }

  /** Update the nutrient display for the plant at this cell */
  updatePlantNutrient(x: number, y: number, nutrient: number): void {
    this.plantNutrientGrid[this.idx(x, y)] = nutrient;
  }

  /** Find a random cell with no animal adjacent to (x, y) */
  randomAdjacentEmpty(x: number, y: number): [number, number] | null {
    const dirs: [number, number][] = [
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1],
    ];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (this.isEmpty(nx, ny)) return [nx, ny];
    }
    return null;
  }

  /** Find a random cell with no animal within radius r of (x, y) */
  randomEmptyInRadius(x: number, y: number, r: number): [number, number] | null {
    const candidates: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (this.isEmpty(nx, ny)) candidates.push([nx, ny]);
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** True if any of the 8 neighbours of (x, y) contain a plant */
  private hasAdjacentPlant(x: number, y: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, ny) && this.plantGrid[this.idx(nx, ny)] === 1) return true;
      }
    }
    return false;
  }

  /** Find a random cell with no plant and no adjacent plant within radius r of (x, y) */
  randomPlantEmptyInRadius(x: number, y: number, r: number): [number, number] | null {
    const candidates: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (this.inBounds(nx, ny) && this.plantGrid[this.idx(nx, ny)] === 0 && !this.hasAdjacentPlant(nx, ny)) {
          candidates.push([nx, ny]);
        }
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  reset(): void {
    this.animalTypeGrid.fill(0);
    this.animalEntityGrid.fill(0);
    this.animalNutrientGrid.fill(0);
    this.plantGrid.fill(0);
    this.plantNutrientGrid.fill(0);
  }
}
