import { EntityType } from '../types';

/** Convert a 0-255 nutrient byte to an RGB triplet based on entity type */
export function getColor(type: number, nutrient: number): [number, number, number] {
  const t = nutrient / 255; // 0..1

  switch (type as EntityType) {
    case EntityType.Empty:
      return [18, 22, 18];

    case EntityType.Plant: {
      // light green (low) → dark green (high)
      const r = Math.round(60 - t * 40);
      const g = Math.round(130 + t * 80);
      const b = Math.round(40 - t * 20);
      return [r, g, b];
    }

    case EntityType.Herbivore: {
      // dark blue (starving) → bright blue (well-fed)
      const r = Math.round(20 + t * 30);
      const g = Math.round(80 + t * 80);
      const b = Math.round(160 + t * 95);
      return [r, g, b];
    }

    case EntityType.Carnivore: {
      // dark red (starving) → bright red (well-fed)
      const r = Math.round(140 + t * 115);
      const g = Math.round(20 + t * 30);
      const b = Math.round(20 + t * 30);
      return [r, g, b];
    }

    default:
      return [0, 0, 0];
  }
}
