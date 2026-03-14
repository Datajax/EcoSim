import './style.css';
import { SimulationEngine } from './simulation';
import { setupControls, makeDefaultParams } from './ui/controls';
import { DEFAULT_INITIAL_COUNTS } from './config';
import { loadSettings } from './persistence';

const canvas = document.getElementById('sim-canvas') as HTMLCanvasElement;

const saved = loadSettings();
const params = saved ? saved.params : makeDefaultParams();
const initialCounts = saved ? { ...saved.initialCounts } : { ...DEFAULT_INITIAL_COUNTS };

const sim = new SimulationEngine(canvas, params, initialCounts);

setupControls(sim, params, initialCounts, (currentParams, currentCounts) => {
  sim.reset(currentParams, currentCounts);
});

sim.drawInitial();
