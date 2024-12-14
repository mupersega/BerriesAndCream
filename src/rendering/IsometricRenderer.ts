import { TileType } from '../types/TileType';
import { gameState } from '../state/GameState';

export interface SpriteConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorBottom?: boolean;
  verticalOffset?: number;
  additionalOffset?: number;
  scaleX?: number;
  scaleY?: number;
}

export class IsometricRenderer {
  private static readonly TILE_SIZE = 16;

  public static getHeightOffset(x: number, y: number): number {
    const tileType = gameState.getTileAt(x, y);
    let heightFactor = 0;
    
    switch (tileType) {
      case TileType.DeepWater: heightFactor = 0; break;
      case TileType.Water: heightFactor = 0.15; break;
      case TileType.Sand: heightFactor = 0.3; break;
      case TileType.Grass: heightFactor = 0.45; break;
      case TileType.Highlands: heightFactor = 0.7; break;
      case TileType.Dirt: heightFactor = 0.8; break;
      case TileType.Stone: heightFactor = 0.9; break;
      case TileType.Snow: heightFactor = 1; break;
    }

    return heightFactor * this.TILE_SIZE;
  }

  public static drawSprite(
    ctx: CanvasRenderingContext2D,
    spritesheet: HTMLImageElement,
    config: SpriteConfig,
    screenX: number,
    screenY: number,
    worldX: number,
    worldY: number
  ): void {
    const verticalOffset = this.getHeightOffset(worldX, worldY);
    const totalOffset = (config.verticalOffset || 0) + (config.additionalOffset || 0);
    
    ctx.save();
    
    const centerX = screenX;
    const centerY = screenY - totalOffset - verticalOffset - 
      (config.anchorBottom ? config.height - (this.TILE_SIZE/2) : config.height/2);

    if (config.scaleX !== undefined || config.scaleY !== undefined) {
      ctx.translate(centerX, centerY);
      ctx.scale(config.scaleX ?? 1, config.scaleY ?? 1);
      ctx.translate(-centerX, -centerY);
    }

    if (config.anchorBottom) {
      ctx.drawImage(
        spritesheet,
        config.x,
        config.y,
        config.width,
        config.height,
        screenX - config.width/2,
        screenY - totalOffset - verticalOffset - config.height + (this.TILE_SIZE/2),
        config.width,
        config.height
      );
    } else {
      ctx.drawImage(
        spritesheet,
        config.x,
        config.y,
        config.width,
        config.height,
        screenX - config.width/2,
        screenY - totalOffset - verticalOffset - config.height/2,
        config.width,
        config.height
      );
    }

    ctx.restore();
  }

  public static worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
    return {
      x: (worldX - worldY) * this.TILE_SIZE,
      y: (worldX + worldY) * (this.TILE_SIZE/2)
    };
  }
}
