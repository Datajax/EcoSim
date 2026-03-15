import type { SimParams, InitialCounts } from './types';

// ── Single "quick save" slot ──────────────────────────────────────────────────

const STORAGE_KEY = 'ecosim_settings';

export interface PersistedSettings {
  params: SimParams;
  initialCounts: InitialCounts;
}

export function loadSettings(): PersistedSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSettings;
  } catch {
    return null;
  }
}

export function saveSettings(params: SimParams, initialCounts: InitialCounts): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ params, initialCounts }));
}

// ── Named configuration library ───────────────────────────────────────────────

const NAMED_CONFIGS_KEY = 'ecosim_named_configs';

export interface NamedConfig {
  name: string;
  params: SimParams;
  initialCounts: InitialCounts;
}

/** Optimizer-verified configurations that survive 5000 ticks. */
const DEFAULT_NAMED_CONFIGS: NamedConfig[] = [
  {
    name: '5000k1',
    initialCounts: { plant: 550, herbivore: 70, carnivore: 8 },
    params: {
      plant:     { nutrientMax: 4, growthRate: 0.03, spawnRadius: 2 },
      herbivore: { nutrientMax: 33, nutrientLossRate: 0.09, speed: 2,
                   perceptionRadius: 10, mateThreshold: 32, mateChance: 0.95, killChance: 1 },
      carnivore: { nutrientMax: 91, nutrientLossRate: 0.17, speed: 3,
                   perceptionRadius: 6,  mateThreshold: 46, mateChance: 0.80,
                   killChance: 0.50, failedKillStunDuration: 6 },
      simSpeed: 100,
    },
  },
  {
    name: '5000k2',
    initialCounts: { plant: 1200, herbivore: 200, carnivore: 19 },
    params: {
      plant:     { nutrientMax: 5, growthRate: 0.075, spawnRadius: 9 },
      herbivore: { nutrientMax: 108, nutrientLossRate: 0.14, speed: 7,
                   perceptionRadius: 30, mateThreshold: 14, mateChance: 0.75, killChance: 1 },
      carnivore: { nutrientMax: 89, nutrientLossRate: 0.23, speed: 1,
                   perceptionRadius: 20, mateThreshold: 68, mateChance: 0.30,
                   killChance: 0.75, failedKillStunDuration: 3 },
      simSpeed: 100,
    },
  },
  {
    name: 'Perm-6-96%',
    initialCounts: { plant: 1000, herbivore: 250, carnivore: 22 },
    params: {
      plant:     { nutrientMax: 4, growthRate: 0.075, spawnRadius: 8 },
      herbivore: { nutrientMax: 120, nutrientLossRate: 0.13, speed: 8,
                   perceptionRadius: 30, mateThreshold: 10, mateChance: 0.95, killChance: 1 },
      carnivore: { nutrientMax: 111, nutrientLossRate: 0.25, speed: 1,
                   perceptionRadius: 23, mateThreshold: 88, mateChance: 0.40,
                   killChance: 0.90, failedKillStunDuration: 3 },
      simSpeed: 100,
    },
  },
  {
    name: 'Perm-7-87%',
    initialCounts: { plant: 1500, herbivore: 240, carnivore: 23 },
    params: {
      plant:     { nutrientMax: 5, growthRate: 0.085, spawnRadius: 9 },
      herbivore: { nutrientMax: 120, nutrientLossRate: 0.17, speed: 6,
                   perceptionRadius: 30, mateThreshold: 15, mateChance: 0.95, killChance: 1 },
      carnivore: { nutrientMax: 85, nutrientLossRate: 0.20, speed: 1,
                   perceptionRadius: 24, mateThreshold: 80, mateChance: 0.30,
                   killChance: 0.70, failedKillStunDuration: 3 },
      simSpeed: 100,
    },
  },
  {
    name: 'Perm-8-59%',
    initialCounts: { plant: 1400, herbivore: 190, carnivore: 18 },
    params: {
      plant:     { nutrientMax: 6, growthRate: 0.070, spawnRadius: 8 },
      herbivore: { nutrientMax: 85, nutrientLossRate: 0.11, speed: 7,
                   perceptionRadius: 29, mateThreshold: 17, mateChance: 0.60, killChance: 1 },
      carnivore: { nutrientMax: 90, nutrientLossRate: 0.18, speed: 1,
                   perceptionRadius: 25, mateThreshold: 54, mateChance: 0.25,
                   killChance: 0.95, failedKillStunDuration: 3 },
      simSpeed: 100,
    },
  },
  {
    name: 'Perm-9-62%',
    initialCounts: { plant: 1250, herbivore: 180, carnivore: 23 },
    params: {
      plant:     { nutrientMax: 4, growthRate: 0.075, spawnRadius: 10 },
      herbivore: { nutrientMax: 89, nutrientLossRate: 0.17, speed: 6,
                   perceptionRadius: 30, mateThreshold: 11, mateChance: 0.65, killChance: 1 },
      carnivore: { nutrientMax: 73, nutrientLossRate: 0.18, speed: 1,
                   perceptionRadius: 24, mateThreshold: 55, mateChance: 0.25,
                   killChance: 0.85, failedKillStunDuration: 3 },
      simSpeed: 100,
    },
  },
  {
    name: 'Perm-12-96%',
    initialCounts: { plant: 1350, herbivore: 200, carnivore: 23 },
    params: {
      plant:     { nutrientMax: 5, growthRate: 0.085, spawnRadius: 9 },
      herbivore: { nutrientMax: 119, nutrientLossRate: 0.18, speed: 7,
                   perceptionRadius: 27, mateThreshold: 12, mateChance: 0.60, killChance: 1 },
      carnivore: { nutrientMax: 113, nutrientLossRate: 0.16, speed: 1,
                   perceptionRadius: 20, mateThreshold: 73, mateChance: 0.25,
                   killChance: 0.55, failedKillStunDuration: 3 },
      simSpeed: 100,
    },
  },
];

export function loadNamedConfigs(): NamedConfig[] {
  try {
    const raw = localStorage.getItem(NAMED_CONFIGS_KEY);
    if (!raw) return DEFAULT_NAMED_CONFIGS.map(c => ({ ...c }));
    const parsed = JSON.parse(raw) as NamedConfig[];
    return parsed.length > 0 ? parsed : DEFAULT_NAMED_CONFIGS.map(c => ({ ...c }));
  } catch {
    return DEFAULT_NAMED_CONFIGS.map(c => ({ ...c }));
  }
}

export function saveNamedConfigs(configs: NamedConfig[]): void {
  localStorage.setItem(NAMED_CONFIGS_KEY, JSON.stringify(configs));
}

export function addOrUpdateNamedConfig(
  name: string,
  params: SimParams,
  initialCounts: InitialCounts,
): NamedConfig[] {
  const configs = loadNamedConfigs();
  const idx = configs.findIndex(c => c.name === name);
  if (idx >= 0) {
    configs[idx] = { name, params, initialCounts };
  } else {
    configs.push({ name, params, initialCounts });
  }
  saveNamedConfigs(configs);
  return configs;
}

export function removeNamedConfig(name: string): NamedConfig[] {
  const configs = loadNamedConfigs().filter(c => c.name !== name);
  saveNamedConfigs(configs);
  return configs;
}
