import { GRID_W, GRID_H, MATE_COOLDOWN } from '../config';
import { EntityType } from '../types';
import type { Herbivore } from '../entities/Herbivore';
import type { Carnivore } from '../entities/Carnivore';
import type { SimulationEngine } from '../simulation';

// ── Movement helpers ──────────────────────────────────────────────────────────

function wrap(v: number, max: number): number {
  return ((v % max) + max) % max;
}

/** Attempt to move entity one step in the given angle at the given speed.
 *  If the direct cell is blocked, tries up to 7 rotated alternatives
 *  (±30°, ±60°, ±90°, 180°) so entities slide around obstacles instead
 *  of freezing in place. Returns true if the entity actually moved. */
function moveInDirection(
  entity: Herbivore | Carnivore,
  angle: number,
  speed: number,
  sim: SimulationEngine
): boolean {
  // Rotation offsets to try: direct, then alternating ±30°, ±60°, ±90°, reverse
  const offsets = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI];

  for (const offset of offsets) {
    const a = angle + offset;
    const nx = wrap(Math.round(entity.x + Math.cos(a) * speed), GRID_W);
    const ny = wrap(Math.round(entity.y + Math.sin(a) * speed), GRID_H);

    if (nx === entity.x && ny === entity.y) continue;
    if (sim.grid.isEmpty(nx, ny)) {
      doMove(entity, nx, ny, sim);
      return true;
    }
  }
  return false;
}

function doMove(entity: Herbivore | Carnivore, nx: number, ny: number, sim: SimulationEngine): void {
  sim.grid.clear(entity.x, entity.y);
  entity.x = nx;
  entity.y = ny;
  const nutrientMax = entity.type === EntityType.Herbivore
    ? sim.params.herbivore.nutrientMax
    : sim.params.carnivore.nutrientMax;
  sim.grid.set(nx, ny, entity.type, entity.id, Math.round(entity.nutrientRatio(nutrientMax) * 255));
}

function angleToward(entity: Herbivore | Carnivore, tx: number, ty: number): number {
  return Math.atan2(ty - entity.y, tx - entity.x);
}

function angleAwayFrom(entity: Herbivore | Carnivore, tx: number, ty: number): number {
  return Math.atan2(entity.y - ty, entity.x - tx);
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Can the entity reach (tx, ty) in one step at the given speed? */
function canReach(ex: number, ey: number, tx: number, ty: number, speed: number): boolean {
  return dist(ex, ey, tx, ty) <= speed + 0.5;
}

function moveToward(entity: Herbivore | Carnivore, tx: number, ty: number, speed: number, sim: SimulationEngine): void {
  const angle = angleToward(entity, tx, ty);
  // Store the last purposeful angle so wander can inherit it
  entity.wanderAngle = angle;
  moveInDirection(entity, angle, speed, sim);
}

function moveAwayFrom(entity: Herbivore | Carnivore, tx: number, ty: number, speed: number, sim: SimulationEngine): void {
  const angle = angleAwayFrom(entity, tx, ty);
  entity.wanderAngle = angle;
  moveInDirection(entity, angle, speed, sim);
}

function wander(entity: Herbivore | Carnivore, speed: number, sim: SimulationEngine): void {
  entity.wanderAngle += (Math.random() - 0.5) * 0.6;
  const moved = moveInDirection(entity, entity.wanderAngle, speed, sim);
  // If completely surrounded (very rare), rotate 90° and try again next tick
  if (!moved) entity.wanderAngle += Math.PI * 0.5;
}

// ── Herbivore AI ──────────────────────────────────────────────────────────────

/** Probability per tick that a fleeing herbivore picks a new escape angle. */
const FLEE_REDIRECT_CHANCE = 0.10;

/**
 * Move h away from threat with periodic direction changes.
 * Candidate angles are shuffled so the herbivore doesn't always flee straight
 * back, and any angle whose destination lands adjacent to the threat is
 * skipped so the herbivore never runs directly into the predator's cell.
 */
function fleeCarnivore(
  h: Herbivore,
  threat: { x: number; y: number },
  speed: number,
  sim: SimulationEngine
): void {
  const baseAngle = angleAwayFrom(h, threat.x, threat.y);

  if (h.fleeAngle === null || Math.random() < FLEE_REDIRECT_CHANCE) {
    // Candidate offsets relative to the direct-away angle
    const offsets = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, 3 * Math.PI / 4, -3 * Math.PI / 4];
    // Fisher-Yates shuffle so there's no directional bias
    for (let i = offsets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
    }

    h.fleeAngle = null;
    for (const offset of offsets) {
      const a = baseAngle + offset;
      const nx = wrap(Math.round(h.x + Math.cos(a) * speed), GRID_W);
      const ny = wrap(Math.round(h.y + Math.sin(a) * speed), GRID_H);
      // Reject destinations that land on or directly beside the threat
      if (dist(nx, ny, threat.x, threat.y) > 1.5) {
        h.fleeAngle = a;
        break;
      }
    }
    // Fallback: direct-away angle if every candidate was adjacent to the threat
    if (h.fleeAngle === null) h.fleeAngle = baseAngle;
  }

  h.wanderAngle = h.fleeAngle;
  const moved = moveInDirection(h, h.fleeAngle, speed, sim);
  if (!moved) h.fleeAngle = null; // blocked — pick fresh angle next tick
}

export function herbivoreAI(h: Herbivore, sim: SimulationEngine): void {
  const params = sim.params.herbivore;
  const r = params.perceptionRadius;

  // 1. FLEE carnivores
  const threat = sim.spatialIndex.nearestCarnivore(h.x, h.y, r);
  if (threat) {
    fleeCarnivore(h, threat, params.speed, sim);
    return;
  }
  h.fleeAngle = null; // no longer threatened — reset for next encounter

  // 2. MATE
  if (h.nutrients >= params.mateThreshold && h.mateCooldown === 0) {
    const partner = sim.spatialIndex.nearestHerbivore(h.x, h.y, r, h.id);
    if (partner && partner.nutrients >= params.mateThreshold && partner.mateCooldown === 0) {
      if (canReach(h.x, h.y, partner.x, partner.y, params.speed)) {
        reproduceHerbivore(h, partner, sim);
      } else {
        moveToward(h, partner.x, partner.y, params.speed, sim);
      }
      return;
    }
  }

  // 3. EAT nearest plant (when not full)
  if (h.nutrients < params.nutrientMax * 0.9) {
    const food = findNearestPlant(h.x, h.y, r, sim);
    if (food) {
      const [fx, fy] = food;
      if (canReach(h.x, h.y, fx, fy, params.speed)) {
        eatPlant(h, fx, fy, sim);
      } else {
        moveToward(h, fx, fy, params.speed, sim);
      }
      return;
    }
  }

  // 4. HERD — follow a nearby herbivore 90% of the time
  const neighbor = sim.spatialIndex.nearestHerbivore(h.x, h.y, r, h.id);
  if (neighbor && Math.random() < 0.90) {
    moveToward(h, neighbor.x, neighbor.y, params.speed, sim);
    return;
  }

  // 5. WANDER
  wander(h, params.speed, sim);
}

function findNearestPlant(
  x: number, y: number, radius: number, sim: SimulationEngine
): [number, number] | null {
  const r2 = radius * radius;
  let best: [number, number] | null = null;
  let bestDist = Infinity;

  const minX = Math.max(0, x - radius);
  const maxX = Math.min(GRID_W - 1, x + radius);
  const minY = Math.max(0, y - radius);
  const maxY = Math.min(GRID_H - 1, y + radius);

  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (sim.grid.hasPlant(cx, cy)) {
        const dx = cx - x;
        const dy = cy - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 && d2 < bestDist) {
          bestDist = d2;
          best = [cx, cy];
        }
      }
    }
  }
  return best;
}

function eatPlant(h: Herbivore, px: number, py: number, sim: SimulationEngine): void {
  const plant = sim.getPlantAt(px, py);
  if (!plant) return;

  const params = sim.params.herbivore;
  const plantParams = sim.params.plant;

  const eaten = Math.min(plant.nutrients, params.nutrientMax - h.nutrients);
  h.nutrients = Math.min(params.nutrientMax, h.nutrients + eaten);
  plant.nutrients -= eaten;

  if (plant.nutrients <= 0) {
    sim.killEntity(plant);
  } else {
    sim.grid.updatePlantNutrient(px, py, Math.round((plant.nutrients / plantParams.nutrientMax) * 255));
  }
}

function reproduceHerbivore(a: Herbivore, b: Herbivore, sim: SimulationEngine): void {
  const params = sim.params.herbivore;
  const cost = params.mateThreshold * 0.5;
  a.nutrients -= cost;
  b.nutrients -= cost;
  a.mateCooldown = MATE_COOLDOWN;
  b.mateCooldown = MATE_COOLDOWN;
  // Probabilistic reproduction — nutrient cost and cooldown always apply
  if (Math.random() <= params.mateChance) {
    sim.spawnHerbivore(a.x, a.y, cost);
  }
}

// ── Carnivore AI ──────────────────────────────────────────────────────────────

export function carnivoreAI(c: Carnivore, sim: SimulationEngine): void {
  const params = sim.params.carnivore;
  const r = params.perceptionRadius;

  // Update mating-viability hysteresis:
  // become viable above mateThreshold, stay viable until below 50% of threshold.
  if (c.nutrients >= params.mateThreshold) {
    c.matingViable = true;
  } else if (c.nutrients < params.mateThreshold * 0.5) {
    c.matingViable = false;
  }

  // 1. MATE — takes priority over hunting when mating-viable.
  // Search at 4× normal perception radius to find distant partners.
  if (c.matingViable && c.mateCooldown === 0) {
    const mateRadius = r * 4;
    const partner = sim.spatialIndex.nearestCarnivore(c.x, c.y, mateRadius, c.id);
    if (partner && partner.matingViable && partner.mateCooldown === 0) {
      if (canReach(c.x, c.y, partner.x, partner.y, params.speed)) {
        reproduceCarnivore(c, partner, sim);
      } else {
        moveToward(c, partner.x, partner.y, params.speed, sim);
      }
      return;
    }
  }

  // 2. EAT nearest herbivore — eat when within reach, don't require strict adjacency
  const prey = sim.spatialIndex.nearestHerbivore(c.x, c.y, r);
  if (prey && prey.alive) {
    if (canReach(c.x, c.y, prey.x, prey.y, params.speed)) {
      eatHerbivore(c, prey, sim);
    } else {
      moveToward(c, prey.x, prey.y, params.speed, sim);
    }
    return;
  }

  // 3. WANDER
  wander(c, params.speed, sim);
}

function eatHerbivore(c: Carnivore, prey: Herbivore, sim: SimulationEngine): void {
  const params = sim.params.carnivore;
  const angle = angleToward(c, prey.x, prey.y);
  // Probabilistic kill — on a miss the carnivore is stunned and stays stationary
  if (Math.random() > params.killChance) {
    c.stunTicksRemaining = params.failedKillStunDuration;
    return;
  }
  // Clear prey first so its cell is available for the carnivore to step into
  sim.killEntity(prey);
  // Attempt to move into the freed cell or nearby
  moveInDirection(c, angle, params.speed, sim);
  c.nutrients = Math.min(params.nutrientMax, c.nutrients + prey.nutrients);
}

function reproduceCarnivore(a: Carnivore, b: Carnivore, sim: SimulationEngine): void {
  const params = sim.params.carnivore;
  const cost = params.mateThreshold * 0.5;
  a.nutrients -= cost;
  b.nutrients -= cost;
  a.mateCooldown = MATE_COOLDOWN;
  b.mateCooldown = MATE_COOLDOWN;
  // Probabilistic reproduction — nutrient cost and cooldown always apply
  if (Math.random() <= params.mateChance) {
    sim.spawnCarnivore(a.x, a.y, cost);
  }
}
