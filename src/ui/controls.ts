import { createSliderGroup } from './sliderGroups';
import type { SimulationEngine } from '../simulation';
import type { SimParams, InitialCounts } from '../types';
import { DEFAULT_PARAMS } from '../config';

export function setupControls(
  sim: SimulationEngine,
  params: SimParams,
  initialCounts: InitialCounts,
  onReset: (params: SimParams, initialCounts: InitialCounts) => void
): void {
  // ── Simulation speed slider (global) ─────────────────────────────────────
  const speedSlider = document.getElementById('sim-speed') as HTMLInputElement;
  const speedVal = document.getElementById('sim-speed-val') as HTMLSpanElement;
  if (speedSlider && speedVal) {
    speedSlider.addEventListener('input', () => {
      const tps = parseInt(speedSlider.value);
      speedVal.textContent = String(tps);
      params.simSpeed = Math.round(1000 / tps);
    });
  }

  // ── Start/Stop button ─────────────────────────────────────────────────────
  const startBtn = document.getElementById('btn-start') as HTMLButtonElement;
  startBtn?.addEventListener('click', () => {
    if (sim.isRunning) {
      sim.stop();
      startBtn.textContent = 'Start';
      startBtn.classList.remove('active');
    } else {
      sim.start();
      startBtn.textContent = 'Stop';
      startBtn.classList.add('active');
    }
  });

  // ── Step button ───────────────────────────────────────────────────────────
  const stepBtn = document.getElementById('btn-step') as HTMLButtonElement;
  stepBtn?.addEventListener('click', () => {
    if (!sim.isRunning) sim.step();
  });

  // ── Reset button ──────────────────────────────────────────────────────────
  const resetBtn = document.getElementById('btn-reset') as HTMLButtonElement;
  resetBtn?.addEventListener('click', () => {
    sim.stop();
    startBtn.textContent = 'Start';
    startBtn.classList.remove('active');
    onReset(params, initialCounts);
  });

  // ── Reset-to-defaults button ──────────────────────────────────────────────
  const defaultsBtn = document.getElementById('btn-defaults') as HTMLButtonElement;
  defaultsBtn?.addEventListener('click', () => {
    // Reset every range input in the slider panel to its stored default value.
    // Each input carries data-default-value set at creation time from DEFAULT_PARAMS.
    // Dispatching a synthetic 'input' event re-runs the onChange callback, which
    // updates the shared params object and the displayed value label automatically.
    const panel = document.getElementById('slider-panel')!;
    panel.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(input => {
      const def = input.dataset.defaultValue;
      if (def === undefined) return;
      input.value = def;
      input.dispatchEvent(new Event('input'));
    });

    // Also reset the global speed slider
    if (speedSlider) {
      speedSlider.value = '10';
      speedSlider.dispatchEvent(new Event('input'));
    }
  });

  // ── Stats display ─────────────────────────────────────────────────────────
  setInterval(() => {
    const tick = document.getElementById('stat-tick');
    const plants = document.getElementById('stat-plants');
    const herbs = document.getElementById('stat-herbs');
    const carns = document.getElementById('stat-carns');
    if (tick) tick.textContent = String(sim.tickCount);
    if (plants) plants.textContent = String(sim.plantCount);
    if (herbs) herbs.textContent = String(sim.herbivoreCount);
    if (carns) carns.textContent = String(sim.carnivoreCount);
  }, 200);

  // ── Entity sliders ────────────────────────────────────────────────────────
  const panelEl = document.getElementById('slider-panel')!;

  createSliderGroup('Starting Counts', '#888', [
    { key: 'plant',     label: 'Plants',     min: 50,  max: 2000, step: 50,  value: initialCounts.plant },
    { key: 'herbivore', label: 'Herbivores', min: 10,  max: 500,  step: 10,  value: initialCounts.herbivore },
    { key: 'carnivore', label: 'Carnivores', min: 1,   max: 100,  step: 1,   value: initialCounts.carnivore },
  ], panelEl, (key, value) => {
    (initialCounts as unknown as Record<string, number>)[key] = value;
  });

  createSliderGroup('Plants', '#4caf50', [
    { key: 'nutrientMax',  label: 'Nutrient Max',  min: 2, max: 20,  step: 1,      value: params.plant.nutrientMax },
    { key: 'growthRate',   label: 'Growth Rate',   min: 0.005, max: 0.1, step: 0.005, value: params.plant.growthRate,
      format: v => v.toFixed(3) },
    { key: 'spawnRadius',  label: 'Spawn Radius',  min: 1, max: 10,  step: 1,      value: params.plant.spawnRadius },
  ], panelEl, (key, value) => {
    (params.plant as unknown as Record<string, number>)[key] = value;
  });

  createSliderGroup('Herbivores', '#42a5f5', [
    { key: 'speed',            label: 'Speed',           min: 1, max: 8,    step: 1,      value: params.herbivore.speed },
    { key: 'nutrientMax',      label: 'Nutrient Max',    min: 10, max: 120, step: 1,      value: params.herbivore.nutrientMax },
    { key: 'nutrientLossRate', label: 'Loss Rate',       min: 0.01, max: 0.5, step: 0.01, value: params.herbivore.nutrientLossRate,
      format: v => v.toFixed(2) },
    { key: 'perceptionRadius', label: 'Perception',      min: 2, max: 30,   step: 1,      value: params.herbivore.perceptionRadius },
    { key: 'mateThreshold',    label: 'Mate Threshold',  min: 5, max: 100,  step: 1,      value: params.herbivore.mateThreshold },
    { key: 'mateChance',       label: 'Mate Chance',     min: 0.05, max: 1.0, step: 0.05, value: params.herbivore.mateChance,
      format: v => v.toFixed(2) },
  ], panelEl, (key, value) => {
    (params.herbivore as unknown as Record<string, number>)[key] = value;
  });

  createSliderGroup('Carnivores', '#ef5350', [
    { key: 'speed',            label: 'Speed',           min: 1, max: 8,    step: 1,      value: params.carnivore.speed },
    { key: 'nutrientMax',      label: 'Nutrient Max',    min: 10, max: 150, step: 1,      value: params.carnivore.nutrientMax },
    { key: 'nutrientLossRate', label: 'Loss Rate',       min: 0.01, max: 0.5, step: 0.01, value: params.carnivore.nutrientLossRate,
      format: v => v.toFixed(2) },
    { key: 'perceptionRadius', label: 'Perception',      min: 2, max: 30,   step: 1,      value: params.carnivore.perceptionRadius },
    { key: 'mateThreshold',    label: 'Mate Threshold',  min: 5, max: 120,  step: 1,      value: params.carnivore.mateThreshold },
    { key: 'mateChance',       label: 'Mate Chance',     min: 0.05, max: 1.0, step: 0.05, value: params.carnivore.mateChance,
      format: v => v.toFixed(2) },
    { key: 'killChance',             label: 'Kill Chance',       min: 0.05, max: 1.0, step: 0.05, value: params.carnivore.killChance,
      format: v => v.toFixed(2) },
    { key: 'failedKillStunDuration', label: 'Miss Stun Duration', min: 0,    max: 20,  step: 1,    value: params.carnivore.failedKillStunDuration },
  ], panelEl, (key, value) => {
    (params.carnivore as unknown as Record<string, number>)[key] = value;
  });
}

export function deepCopyParams(p: SimParams): SimParams {
  return {
    plant:     { ...p.plant },
    herbivore: { ...p.herbivore },
    carnivore: { ...p.carnivore },
    simSpeed:  p.simSpeed,
  };
}

export function makeDefaultParams(): SimParams {
  return deepCopyParams(DEFAULT_PARAMS);
}
