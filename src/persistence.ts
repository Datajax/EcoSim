import type { SimParams, InitialCounts } from './types';

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
