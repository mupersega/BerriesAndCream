export class Basecamp {
  private position: Point;
  private storedFood: number = 0;
  private storedWater: number = 0;
  private maxStorage: number = 1000;
  private structures: Structure[] = [];

  constructor(x: number, y: number) {
    this.position = { x, y };
  }

  public addResources(type: ResourceType, amount: number) {
    switch(type) {
      case ResourceType.BerryBush:
      case ResourceType.BerryPile:
      case ResourceType.BerryTree:
        this.storedFood = Math.min(this.maxStorage, this.storedFood + amount);
        break;
      case ResourceType.Water:
        this.storedWater = Math.min(this.maxStorage, this.storedWater + amount);
        break;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Draw basecamp structure
    const spritesheet = window.gameState.getSpritesheet();
    if (spritesheet?.complete) {
      ctx.drawImage(
        spritesheet,
        0, 128,  // Assuming basecamp sprite position
        64, 64,  // Sprite size
        x - 32, y - 32,
        64, 64
      );
    }

    // Draw resource indicators
    this.drawResourceBars(ctx, x, y);
  }

  private drawResourceBars(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Draw food and water storage bars
    const barWidth = 50;
    const barHeight = 4;
    
    // Food bar (green)
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(x - barWidth/2, y - 40, 
      (this.storedFood / this.maxStorage) * barWidth, barHeight);
    
    // Water bar (blue)
    ctx.fillStyle = '#3498db';
    ctx.fillRect(x - barWidth/2, y - 35, 
      (this.storedWater / this.maxStorage) * barWidth, barHeight);
  }
} 