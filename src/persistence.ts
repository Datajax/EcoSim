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
