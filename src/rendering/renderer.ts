import { GRID_W, GRID_H, GRID_SIZE, DISPLAY_SIZE } from '../config';
import { getColor } from './colors';
import type { SimulationEngine } from '../simulation';

export class Renderer {
  private offscreen: OffscreenCanvas;
  private offCtx: OffscreenCanvasRenderingContext2D;
  private imageData: ImageData;
  private display: HTMLCanvasElement;
  private dispCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.display = canvas;
    this.display.width = DISPLAY_SIZE;
    this.display.height = DISPLAY_SIZE;
    this.dispCtx = canvas.getContext('2d')!;
    this.dispCtx.imageSmoothingEnabled = false;

    this.offscreen = new OffscreenCanvas(GRID_W, GRID_H);
    this.offCtx = this.offscreen.getContext('2d')!;
    this.imageData = this.offCtx.createImageData(GRID_W, GRID_H);
  }

  draw(sim: SimulationEngine): void {
    const data = this.imageData.data;
    const animalTypeGrid    = sim.grid.animalTypeGrid;
    const animalNutrientGrid = sim.grid.animalNutrientGrid;
    const plantGrid         = sim.grid.plantGrid;
    const plantNutrientGrid = sim.grid.plantNutrientGrid;

    for (let i = 0; i < GRID_SIZE; i++) {
      // Animals are drawn on top of plants when both occupy the same cell
      const type     = animalTypeGrid[i] !== 0 ? animalTypeGrid[i] : (plantGrid[i] ? 1 : 0);
      const nutrient = animalTypeGrid[i] !== 0 ? animalNutrientGrid[i] : plantNutrientGrid[i];
      const [r, g, b] = getColor(type, nutrient);
      const p = i << 2;
      data[p]     = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }

    this.offCtx.putImageData(this.imageData, 0, 0);
    this.dispCtx.drawImage(this.offscreen, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
  }

  clear(): void {
    this.dispCtx.fillStyle = '#121612';
    this.dispCtx.fillRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
  }
}
