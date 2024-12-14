export interface IDrawable {
  draw(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void;
  getPosition(): { x: number, y: number };
  getDrawOrder?(): number;  // Optional method for z-ordering
}
