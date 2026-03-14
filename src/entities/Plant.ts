import { Entity } from './Entity';
import { EntityType } from '../types';
import type { SimulationEngine } from '../simulation';

export class Plant extends Entity {
  readonly type = EntityType.Plant;

  constructor(x: number, y: number, nutrients = 1) {
    super(x, y, nutrients);
  }

  tick(sim: SimulationEngine): void {
    const params = sim.params.plant;

    // Grow
    this.nutrients = Math.min(params.nutrientMax, this.nutrients + params.growthRate);

    // Update grid nutrient display
    sim.grid.updatePlantNutrient(this.x, this.y, Math.round((this.nutrients / params.nutrientMax) * 255));

    // Spawn when fully grown
    if (this.nutrients >= params.nutrientMax) {
      sim.trySpawnPlant(this.x, this.y);
      this.nutrients = params.nutrientMax * 0.5;
    }
  }
}
