import './style.css';
import { SimulationEngine } from './simulation';
import { setupControls, makeDefaultParams } from './ui/controls';
import { DEFAULT_INITIAL_COUNTS } from './config';

const canvas = document.getElementById('sim-canvas') as HTMLCanvasElement;
const params = makeDefaultParams();
const initialCounts = { ...DEFAULT_INITIAL_COUNTS };
const sim = new SimulationEngine(canvas, params, initialCounts);

setupControls(sim, params, initialCounts, (currentParams, currentCounts) => {
  sim.reset(currentParams, currentCounts);
});

sim.drawInitial();
