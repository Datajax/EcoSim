import { Entity } from './Entity';
import { EntityType } from '../types';
import { herbivoreAI } from '../ai/behaviors';
import type { SimulationEngine } from '../simulation';

export class Herbivore extends Entity {
  readonly type = EntityType.Herbivore;
  wanderAngle: number;
  mateCooldown = 0;
  fleeAngle: number | null = null;

  constructor(x: number, y: number, nutrients: number) {
    super(x, y, nutrients);
    this.wanderAngle = Math.random() * Math.PI * 2;
  }

  tick(sim: SimulationEngine): void {
    const params = sim.params.herbivore;

    // Drain nutrients
    this.nutrients -= params.nutrientLossRate;
    if (this.nutrients <= 0) {
      sim.killEntity(this);
      return;
    }

    if (this.mateCooldown > 0) this.mateCooldown--;

    // Update grid nutrient display
    sim.grid.updateNutrient(this.x, this.y, Math.round(this.nutrientRatio(params.nutrientMax) * 255));

    // Run AI
    herbivoreAI(this, sim);
  }
}
