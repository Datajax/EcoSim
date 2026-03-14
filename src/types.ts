export interface InitialCounts {
  plant: number;
  herbivore: number;
  carnivore: number;
}

export const EntityType = {
  Empty:     0,
  Plant:     1,
  Herbivore: 2,
  Carnivore: 3,
} as const;
export type EntityType = typeof EntityType[keyof typeof EntityType];

export interface PlantParams {
  nutrientMax: number;
  growthRate: number;
  spawnRadius: number;
}

export interface MobileParams {
  nutrientMax: number;
  nutrientLossRate: number;
  speed: number;
  perceptionRadius: number;
  mateThreshold: number;
  mateChance: number;
  killChance: number;
}

export interface CarnivoreParams extends MobileParams {
  failedKillStunDuration: number;
}

export interface SimParams {
  plant: PlantParams;
  herbivore: MobileParams;
  carnivore: CarnivoreParams;
  simSpeed: number; // ms per tick
}
