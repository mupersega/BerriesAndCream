import { Resource, ResourceType } from './Resource';

export class Corpse extends Resource {
  constructor(x: number, y: number) {
    // Call Resource constructor with initial amount of nutrients
    super(x, y, ResourceType.Corpse, 50);
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const tileSize = 16;
    // Draw darker circle for corpse
    ctx.fillStyle = '#4a4a4a';  // Dark gray for corpse
    ctx.beginPath();
    ctx.arc(
      this.x * tileSize + tileSize/2,  // center x
      this.y * tileSize + tileSize/2,  // center y
      5,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Draw X mark
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    const size = 4;
    const centerX = this.x * tileSize + tileSize/2;
    const centerY = this.y * tileSize + tileSize/2;
    
    ctx.beginPath();
    ctx.moveTo(centerX - size, centerY - size);
    ctx.lineTo(centerX + size, centerY + size);
    ctx.moveTo(centerX + size, centerY - size);
    ctx.lineTo(centerX - size, centerY + size);
    ctx.stroke();
  }
} 