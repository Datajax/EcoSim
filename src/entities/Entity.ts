import { EntityType } from '../types';

let nextId = 1;

export abstract class Entity {
  readonly id: number;
  x: number;
  y: number;
  nutrients: number;
  alive: boolean;
  abstract readonly type: EntityType;

  constructor(x: number, y: number, nutrients: number) {
    this.id = nextId++;
    this.x = x;
    this.y = y;
    this.nutrients = nutrients;
    this.alive = true;
  }

  /** Called once per simulation tick */
  abstract tick(sim: import('../simulation').SimulationEngine): void;

  /** Nutrient ratio 0..1 */
  nutrientRatio(max: number): number {
    return Math.max(0, Math.min(1, this.nutrients / max));
  }

  die(): void {
    this.alive = false;
  }
}

export function resetEntityIds(): void {
  nextId = 1;
}
