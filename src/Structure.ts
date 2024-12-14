import { StructureType } from './types/StructureType';
import { Point } from './types/Point';
import { TileType } from './types/TileType';

interface StructureConfig {
  sprite: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  verticalOffset: number;
}

export const STRUCTURE_CONFIGS: Record<StructureType, StructureConfig> = {
  [StructureType.Farm]: {
    sprite: {
      x: 128,
      y: 128,
      width: 64,
      height: 64
    },
    verticalOffset: 32
  },
  [StructureType.Warehouse]: {
    sprite: {
      x: 32,
      y: 192,
      width: 32,
      height: 32
    },
    verticalOffset: 0
  },
  [StructureType.Smithy]: {
    sprite: {
      x: 64,
      y: 192,
      width: 32,
      height: 32
    },
    verticalOffset: 0
  },
  [StructureType.House]: {
    sprite: {
      x: 96,
      y: 192,
      width: 32,
      height: 32
    },
    verticalOffset: 0
  }
};

export class Structure {
  private type: StructureType;
  private position: Point;
  private storage: Map<string, number> = new Map();
  private maxStorage: number = 50;
  private constructionProgress: number = 0;
  private isBuilt: boolean = false;
  private config: StructureConfig;

  constructor(type: StructureType, position: Point) {
    this.type = type;
    this.position = position;
    this.config = STRUCTURE_CONFIGS[type];
  }

  public getType(): StructureType {
    return this.type;
  }

  public getPosition(): Point {
    return this.position;
  }

  public isComplete(): boolean {
    return this.isBuilt;
  }

  public addConstructionProgress(amount: number): void {
    this.constructionProgress += amount;
    if (this.constructionProgress >= 100) {
      this.isBuilt = true;
    }
  }

  public store(itemType: string, amount: number): number {
    const currentAmount = this.storage.get(itemType) || 0;
    const spaceAvailable = this.maxStorage - this.getTotalStoredItems();
    const amountToStore = Math.min(amount, spaceAvailable);
    
    this.storage.set(itemType, currentAmount + amountToStore);
    return amountToStore;
  }

  public retrieve(itemType: string, amount: number): number {
    const currentAmount = this.storage.get(itemType) || 0;
    const amountToRetrieve = Math.min(amount, currentAmount);
    
    this.storage.set(itemType, currentAmount - amountToRetrieve);
    return amountToRetrieve;
  }

  private getTotalStoredItems(): number {
    return Array.from(this.storage.values()).reduce((sum, amount) => sum + amount, 0);
  }

  public draw(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const spritesheet = window.gameState.getSpritesheet();
    
    let heightFactor = 0;
    const tileType = window.gameState.getTileAt(this.position.x, this.position.y);
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

    const tileHeight = 16;
    const verticalOffset = heightFactor * tileHeight;

    if (spritesheet?.complete) {
      const sprite = this.config.sprite;
      ctx.drawImage(
        spritesheet,
        sprite.x,
        sprite.y,
        sprite.width,
        sprite.height,
        x - sprite.width/2,
        y - verticalOffset - sprite.height + (tileHeight/2) + this.config.verticalOffset,
        sprite.width,
        sprite.height
      );
    }
  }
}