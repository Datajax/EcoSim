import { Entity } from './Entity';
import { EntityType } from '../types';
import { carnivoreAI } from '../ai/behaviors';
import type { SimulationEngine } from '../simulation';

export class Carnivore extends Entity {
  readonly type = EntityType.Carnivore;
  wanderAngle: number;
  mateCooldown = 0;
  stunTicksRemaining = 0;
  /** Hysteresis flag: set when nutrients cross mateThreshold, cleared when they fall
   *  below mateThreshold * 0.5. Keeps the carnivore mating-viable through minor dips. */
  matingViable = false;

  constructor(x: number, y: number, nutrients: number) {
    super(x, y, nutrients);
    this.wanderAngle = Math.random() * Math.PI * 2;
  }

  tick(sim: SimulationEngine): void {
    const params = sim.params.carnivore;

    // Drain nutrients
    this.nutrients -= params.nutrientLossRate;
    if (this.nutrients <= 0) {
      sim.killEntity(this);
      return;
    }

    if (this.mateCooldown > 0) this.mateCooldown--;
    if (this.stunTicksRemaining > 0) {
      this.stunTicksRemaining--;
      sim.grid.updateNutrient(this.x, this.y, Math.round(this.nutrientRatio(params.nutrientMax) * 255));
      return;
    }

    // Update grid nutrient display
    sim.grid.updateNutrient(this.x, this.y, Math.round(this.nutrientRatio(params.nutrientMax) * 255));

    // Run AI
    carnivoreAI(this, sim);
  }
}
