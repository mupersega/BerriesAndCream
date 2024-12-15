import { TileType } from './types/TileType';
import { IDrawable } from './interfaces/IDrawable';
import { IsometricRenderer } from './rendering/IsometricRenderer';
import { gameState } from './state/GameState';

export enum ResourceType {
  BerryBush,
  BerryPile,
  BerryTree,
  Corpse,
  Tree
}

interface ResourceConfig {
  maxQuantity: number;
  color: string;
  size: number;
  validTiles: {
    type: TileType;
    weight: number;  // Higher weight = more likely to spawn
  }[];
  spawnDensity: number;
  sprite: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  anchorBottom: boolean;
  verticalOffset: number;
}

export const RESOURCE_CONFIGS: Record<ResourceType, ResourceConfig> = {
  [ResourceType.BerryBush]: {
    maxQuantity: 40,
    color: '#cc2166',
    size: 32,
    validTiles: [
      { type: TileType.Grass, weight: 1 },
      { type: TileType.Highlands, weight: 0.5 }
    ],
    spawnDensity: 0.005,
    sprite: {
      x: 0,
      y: 64,
      width: 32,
      height: 32
    },
    anchorBottom: false,
    verticalOffset: 0,
  },
  [ResourceType.BerryPile]: {
    maxQuantity: 25,
    color: '#cc2166',
    size: 16,
    validTiles: [
      { type: TileType.Grass, weight: 1 },
      { type: TileType.Highlands, weight: 1 },
      { type: TileType.Sand, weight: 1 },
      { type: TileType.Dirt, weight: 1 }
    ],
    spawnDensity: 0.001,
    sprite: {
      x: 32,
      y: 64,
      width: 16,
      height: 16
    },
    anchorBottom: false,
    verticalOffset: -6,
  },
  [ResourceType.BerryTree]: {
    maxQuantity: 80,
    color: '#cc2166',
    size: 32,
    validTiles: [
      { type: TileType.Grass, weight: 0.3 },
      { type: TileType.Highlands, weight: 1 }
    ],
    spawnDensity: 0.003,
    sprite: {
      x: 64,
      y: 64,
      width: 64,
      height: 64
    },
    anchorBottom: true,
    verticalOffset: -6,
  },
  [ResourceType.Corpse]: {
    maxQuantity: 50,
    color: '#4a4a4a',
    size: 32,
    validTiles: [
      { type: TileType.Grass, weight: 1 },
      { type: TileType.Highlands, weight: 1 },
      { type: TileType.Sand, weight: 1 },
      { type: TileType.Dirt, weight: 1 }
    ],
    spawnDensity: 0,
    sprite: {
      x: 32,
      y: 0,
      width: 32,
      height: 32
    },
    anchorBottom: false,
    verticalOffset: 8,
  },
  [ResourceType.Tree]: {
    maxQuantity: 100,
    color: '#228B22',
    size: 32,
    validTiles: [
      { type: TileType.Grass, weight: 0.5 },
      { type: TileType.Highlands, weight: 3 }  // Trees twice as likely to spawn on highlands
    ],
    spawnDensity: 0.01,
    sprite: {
      x: 0,
      y: 0,
      width: 64,
      height: 64
    },
    anchorBottom: true,
    verticalOffset: -6,
  }
};

export class Resource implements IDrawable {
  private x: number;
  private y: number;
  private type: ResourceType;
  private amount: number;
  private maxAmount: number;
  private config: ResourceConfig;

  // Add to class-level static properties
  private static occupiedTiles: Set<string> = new Set();

  constructor(x: number, y: number, type: ResourceType) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.config = JSON.parse(JSON.stringify(RESOURCE_CONFIGS[type]));
    this.maxAmount = this.config.maxQuantity;
    this.amount = Math.floor(this.maxAmount * (0.5 + Math.random() * 0.5));

    // Register this tile as occupied
    Resource.occupiedTiles.add(`${x},${y}`);

    // Randomly select a sprite for trees or berry trees
    if (type === ResourceType.Tree) {
      const treeSprites = [
        { x: 0, y: 0 },
        { x: 64, y: 0 },
        { x: 128, y: 0 }
      ];
      const randomSprite = treeSprites[Math.floor(Math.random() * treeSprites.length)];
      this.config.sprite.x = randomSprite.x;
      this.config.sprite.y = randomSprite.y;
      this.config.sprite.width = 64;
      this.config.sprite.height = 64;
    } else if (type === ResourceType.BerryTree) {
      const berryTreeSprites = [
        { x: 64, y: 64 },
        { x: 128, y: 64 }
      ];
      const randomSprite = berryTreeSprites[Math.floor(Math.random() * berryTreeSprites.length)];
      this.config.sprite.x = randomSprite.x;
      this.config.sprite.y = randomSprite.y;
      this.config.sprite.width = 64;
      this.config.sprite.height = 64;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
    const spritesheet = gameState.getSpritesheetSync();
    if (!spritesheet?.complete) return;

    IsometricRenderer.drawSprite(
      ctx,
      spritesheet,
      {
        ...this.config.sprite,
        anchorBottom: this.config.anchorBottom,
        verticalOffset: this.config.verticalOffset
      },
      screenX,
      screenY,
      this.x,
      this.y
    );
  }

  public getDrawOrder(): number {
    return this.x + this.y;  // Simple isometric ordering
  }

  public getPosition() {
    return { x: this.x, y: this.y };
  }

  public getType(): ResourceType {
    return this.type;
  }

  public getAmount(): number {
    return this.amount;
  }

  public getMaxAmount(): number {
    return this.maxAmount;
  }

  public harvest(amount: number): number {
    const harvested = Math.min(this.amount, amount);
    this.amount -= harvested;
    
    // If depleted, notify the game state
    if (this.isDepleted()) {
      window.gameState.removeResource(this);
    }
    
    return harvested;
  }

  public isDepleted(): boolean {
    return this.amount <= 0;
  }

  // Helper method to check if a resource can exist on a given tile type
  public static canExistOnTile(resourceType: ResourceType, tileType: TileType): boolean {
    return RESOURCE_CONFIGS[resourceType].validTiles.some(t => t.type === tileType);
  }

  // Add method to get tile weight
  private static getTileWeight(resourceType: ResourceType, tileType: TileType): number {
    const tileConfig = RESOURCE_CONFIGS[resourceType].validTiles.find(t => t.type === tileType);
    return tileConfig ? tileConfig.weight : 0;
  }

  // Static method to generate resources for a map
  public static generateResources(map: TileType[][]): Resource[] {
    const resources: Resource[] = [];
    const height = map.length;
    const width = map[0].length;
    const totalTiles = width * height;
    
    // Reset occupied tiles
    this.occupiedTiles.clear();
    
    // Generate resources for each type that has a spawn density
    Object.entries(RESOURCE_CONFIGS).forEach(([type, config]) => {
      if (config.spawnDensity > 0) {
        const count = Math.floor(totalTiles * config.spawnDensity);
        this.generateResourcesOfType(Number(type) as ResourceType, count, map, resources);
      }
    }); 

    return resources;
  }

  private static generateResourcesOfType(type: ResourceType, count: number, map: TileType[][], resources: Resource[]) {
    const width = map[0].length;
    const height = map.length;

    // Create weighted list of all valid positions
    const validPositions: Array<{x: number, y: number, weight: number}> = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileType = map[y][x];
        const weight = this.getTileWeight(type, tileType);
        
        if (weight > 0 && !this.occupiedTiles.has(`${x},${y}`)) {
          validPositions.push({x, y, weight});
        }
      }
    }

    // Helper function for weighted random selection
    const selectWeightedPosition = () => {
      const totalWeight = validPositions.reduce((sum, pos) => sum + pos.weight, 0);
      let random = Math.random() * totalWeight;
      
      for (let i = 0; i < validPositions.length; i++) {
        random -= validPositions[i].weight;
        if (random <= 0) {
          return validPositions.splice(i, 1)[0];
        }
      }
      return null;
    };

    // Generate resources using weighted selection
    for (let i = 0; i < count && validPositions.length > 0; i++) {
      const position = selectWeightedPosition();
      if (position) {
        const posKey = `${position.x},${position.y}`;
        this.occupiedTiles.add(posKey);
        resources.push(new Resource(position.x, position.y, type));
      }
    }
  }

  public getColor(): string {
    return this.config.color;
  }

  // Add cleanup method for when resources are removed
  public remove(): void {
    const posKey = `${this.x},${this.y}`;
    Resource.occupiedTiles.delete(posKey);
  }

  public addAmount(amount: number): void {
    this.amount = Math.min(this.maxAmount, this.amount + amount);
  }
} 