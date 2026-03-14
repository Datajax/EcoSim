import { GRID_W, GRID_H } from '../config';
import type { Herbivore } from '../entities/Herbivore';
import type { Carnivore } from '../entities/Carnivore';

const BUCKET_SIZE = 10;
const BUCKETS_X = Math.ceil(GRID_W / BUCKET_SIZE);
const BUCKETS_Y = Math.ceil(GRID_H / BUCKET_SIZE);

export class SpatialIndex {
  private herbBuckets: Herbivore[][];
  private carnBuckets: Carnivore[][];

  constructor() {
    const count = BUCKETS_X * BUCKETS_Y;
    this.herbBuckets = Array.from({ length: count }, () => []);
    this.carnBuckets = Array.from({ length: count }, () => []);
  }

  private bucketIdx(x: number, y: number): number {
    const bx = Math.floor(x / BUCKET_SIZE);
    const by = Math.floor(y / BUCKET_SIZE);
    return by * BUCKETS_X + bx;
  }

  rebuild(herbivores: Herbivore[], carnivores: Carnivore[]): void {
    for (const b of this.herbBuckets) b.length = 0;
    for (const b of this.carnBuckets) b.length = 0;

    for (const h of herbivores) {
      if (h.alive) this.herbBuckets[this.bucketIdx(h.x, h.y)].push(h);
    }
    for (const c of carnivores) {
      if (c.alive) this.carnBuckets[this.bucketIdx(c.x, c.y)].push(c);
    }
  }

  nearestHerbivore(x: number, y: number, radius: number, excludeId?: number): Herbivore | null {
    return this.nearestIn(this.herbBuckets, x, y, radius, excludeId) as Herbivore | null;
  }

  nearestCarnivore(x: number, y: number, radius: number, excludeId?: number): Carnivore | null {
    return this.nearestIn(this.carnBuckets, x, y, radius, excludeId) as Carnivore | null;
  }

  private nearestIn(
    buckets: (Herbivore | Carnivore)[][],
    x: number, y: number,
    radius: number,
    excludeId?: number
  ): Herbivore | Carnivore | null {
    const r2 = radius * radius;
    let best: Herbivore | Carnivore | null = null;
    let bestDist = Infinity;

    const minBx = Math.max(0, Math.floor((x - radius) / BUCKET_SIZE));
    const maxBx = Math.min(BUCKETS_X - 1, Math.floor((x + radius) / BUCKET_SIZE));
    const minBy = Math.max(0, Math.floor((y - radius) / BUCKET_SIZE));
    const maxBy = Math.min(BUCKETS_Y - 1, Math.floor((y + radius) / BUCKET_SIZE));

    for (let by = minBy; by <= maxBy; by++) {
      for (let bx = minBx; bx <= maxBx; bx++) {
        for (const e of buckets[by * BUCKETS_X + bx]) {
          if (excludeId !== undefined && e.id === excludeId) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && d2 < bestDist) {
            bestDist = d2;
            best = e;
          }
        }
      }
    }
    return best;
  }
}
