import { BaseAgent } from '../agents/BaseAgent';
import { LittleLad } from '../agents/LittleLad';
import { Resource } from '../Resource';
import { Structure } from '../Structure';
import { TileType } from '../types/TileType';
import { StructureType } from '../types/StructureType';
import { findSuitableBuildingLocation } from '../utils/locationUtils';
import { Point } from '../types/Point';
import { ResourceCount } from '../types/ResourceType';
import { Cow } from '../agents/Cow';

export class GameState {
  protected map: TileType[][] = [];
  private resources: Resource[] = [];
  private structures: Structure[] = [];
  private agents: BaseAgent[] = [];
  private spritesheet: HTMLImageElement | null = null;
  private spritesheetLoadPromise: Promise<HTMLImageElement> | null = null;
  private selectedTile: Point | null = null;
  private findableTiles: Set<string> = new Set();
  private forageableTiles: Set<string> = new Set();
  private fellableTiles: Set<string> = new Set();
  private fetchableTiles: Set<string> = new Set();

  // Individual area visibility flags
  private showFindableTiles: boolean = true;
  private showForageableTiles: boolean = true;
  private showFellableTiles: boolean = true;
  private showFetchableTiles: boolean = true;

  // Visibility getters
  public isShowingFindableTiles(): boolean {
    return this.showFindableTiles;
  }

  public isShowingForageableTiles(): boolean {
    return this.showForageableTiles;
  }

  public isShowingFellableTiles(): boolean {
    return this.showFellableTiles;
  }

  public isShowingFetchableTiles(): boolean {
    return this.showFetchableTiles;
  }

  // Visibility toggles
  public toggleFindableTiles(): void {
    this.showFindableTiles = !this.showFindableTiles;
  }

  public toggleForageableTiles(): void {
    this.showForageableTiles = !this.showForageableTiles;
  }

  public toggleFellableTiles(): void {
    this.showFellableTiles = !this.showFellableTiles;
  }

  public toggleFetchableTiles(): void {
    this.showFetchableTiles = !this.showFetchableTiles;
  }

  // Add a method to preload the spritesheet
  async loadSpritesheet(): Promise<HTMLImageElement> {
    if (this.spritesheetLoadPromise) {
      return this.spritesheetLoadPromise;
    }

    this.spritesheetLoadPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.src = '/sprites.png';
      
      img.onload = () => {
        console.log('Spritesheet loaded successfully');
        this.spritesheet = img;
        resolve(img);
      };
      
      img.onerror = (error) => {
        console.error('Failed to load spritesheet:', error);
        reject(error);
      };
    });

    return this.spritesheetLoadPromise;
  }

  // Modified getSpritesheet to use cached version or wait for load
  async getSpritesheet(): Promise<HTMLImageElement> {
    if (this.spritesheet) {
      return this.spritesheet;
    }
    return this.loadSpritesheet();
  }

  // Synchronous version for when we know spritesheet is loaded
  getSpritesheetSync(): HTMLImageElement | null {
    return this.spritesheet;
  }

  addResource(resource: Resource) {
    this.resources.push(resource);
    console.log('Resource added:', resource);
  }

  removeResource(resource: Resource) {
    const index = this.resources.indexOf(resource);
    if (index > -1) {
      resource.remove();
      this.resources.splice(index, 1);
      console.log('Resource removed:', resource);
    }
  }

  addStructure(structure: Structure) {
    this.structures.push(structure);
    console.log('Structure added:', structure);
  }

  removeStructure(structure: Structure) {
    const index = this.structures.indexOf(structure);
    if (index > -1) {
      this.structures.splice(index, 1);
      console.log('Structure removed:', structure);
    }
  }

  getTileAt(x: number, y: number): TileType {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.map[0]?.length || y < 0 || y >= this.map.length) {
      return TileType.DeepWater;
    }
    return this.map[y][x] || TileType.DeepWater;
  }

  setMap(map: TileType[][]) {
    this.map = map;
  }

  getResources(): Resource[] {
    return this.resources;
  }

  getStructures(): Structure[] {
    return this.structures;
  }

  getMap(): TileType[][] {
    return this.map;
  }

  // Add these helper methods for map dimensions
  getMapWidth(): number {
    return this.map[0]?.length || 0;
  }

  getMapHeight(): number {
    return this.map.length || 0;
  }

  // Add agent methods
  addAgent(agent: BaseAgent) {
    this.agents.push(agent);
    console.log('Agent added:', agent);
  }

  removeAgent(agent: BaseAgent) {
    const index = this.agents.indexOf(agent);
    if (index > -1) {
      agent.cleanup?.();
      this.agents.splice(index, 1);
      console.log('Agent removed:', agent);
    }
  }

  getAgents(): BaseAgent[] {
    return this.agents;
  }

  // Update clearGameState to be more explicit
  public clearGameState() {
    // Clean up existing entities
    this.agents.forEach(agent => agent.cleanup?.());
    this.resources.forEach(resource => resource.remove());
    this.structures.forEach(structure => structure.cleanup?.());
    
    // Reset arrays
    this.agents = [];
    this.resources = [];
    this.structures = [];
    this.map = [];
    
    console.log('Game state cleared');
    this.resetVisibility();
    this.clearAllMarkedTiles();
  }

  public generateInitialResources(): void {
    // Clear existing resources
    this.resources.forEach(resource => resource.remove());
    this.resources = [];

    // Generate new resources
    const newResources = Resource.generateResources(this.map);
    newResources.forEach(resource => this.addResource(resource));
  }

  public generateInitialStructures(): void {
    const structuresToAdd = [{ type: StructureType.Headquarters, count: 1 }];
    // Clear existing structures
    this.structures.forEach(structure => structure.cleanup?.());
    this.structures = [];

    // Generate new structures
    structuresToAdd.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        const location = findSuitableBuildingLocation(this.map, type);
        if (location) {
          const structure = new Structure(type, location);
          this.addStructure(structure);
        }
      }
    });
  }

  public generateInitialAgents(numAgents: number = 2): void {
    // Clear existing agents
    this.agents.forEach(agent => agent.cleanup?.());
    this.agents = [];

    // Find headquarters location
    const hq = this.structures.find(s => s.getType() === StructureType.Headquarters);
    if (!hq) {
      console.warn('No headquarters found for agent spawning');
      return;
    }
    
    // Generate new agents near HQ
    for (let i = 0; i < numAgents; i++) {
      const agent = new LittleLad(this.map);
      if (agent) {
        this.addAgent(agent);
      }
    }
    for (let i = 0; i < numAgents; i++) {
      const agent = new Cow(this.map);
      if (agent) {
        this.addAgent(agent);
      }
    }

    console.log(`Successfully placed ${this.agents.length} out of ${numAgents} requested agents`);
  }

  public getHQPosition(): Point {
    const hq = this.structures.find(s => s.getType() === StructureType.Headquarters);
    if (!hq) {
      console.warn('No headquarters found for agent spawning');
      return { x: 0, y: 0 };
    }
    return hq.getPosition();
  }

  // Add getter and setter for selected tile
  getSelectedTile(): Point | null {
    return this.selectedTile;
  }

  setSelectedTile(point: Point | null): void {
    this.selectedTile = point;
  }

  // Add methods to manage findable tiles
  markTileAsFindable(x: number, y: number): void {
    this.findableTiles.add(`${x},${y}`);
  }

  // Modified get methods to respect visibility
  public getFindableTiles(): Point[] {
    if (!this.showFindableTiles) return [];
    return Array.from(this.findableTiles).map(coord => {
      const [x, y] = coord.split(',').map(Number);
      return { x, y };
    });
  }

  // Individual clear methods
  public clearFindableTiles(): void {
    this.findableTiles.clear();
  }

  // Add methods for forageable tiles
  markTileAsForageable(x: number, y: number): void {
    this.forageableTiles.add(`${x},${y}`);
  }

  // Individual clear methods
  public clearForageableTiles(): void {
    this.forageableTiles.clear();
  }

  // Modified get methods to respect visibility
  public getForageableTiles(): Point[] {
    if (!this.showForageableTiles) return [];
    return Array.from(this.forageableTiles).map(coord => {
      const [x, y] = coord.split(',').map(Number);
      return { x, y };
    });
  }

  // fell tiles
  markTileAsFellable(x: number, y: number): void {
    console.log('Marking tile as fellable:', x, y);
    this.fellableTiles.add(`${x},${y}`);
  }

  // Individual clear methods
  public clearFellableTiles(): void {
    this.fellableTiles.clear();
  }

  // Modified get methods to respect visibility
  public getFellableTiles(): Point[] {
    if (!this.showFellableTiles) return [];
    return Array.from(this.fellableTiles).map(coord => {
      const [x, y] = coord.split(',').map(Number);
      return { x, y };
    });
  }

  // fetch tiles
  markTileAsFetchable(x: number, y: number): void {
    this.fetchableTiles.add(`${x},${y}`);
  }

  // Individual clear methods
  public clearFetchableTiles(): void {
    this.fetchableTiles.clear();
  }

  // Modified get methods to respect visibility
  public getFetchableTiles(): Point[] {
    if (!this.showFetchableTiles) return [];
    return Array.from(this.fetchableTiles).map(coord => {
      const [x, y] = coord.split(',').map(Number);
      return { x, y };
    });
  }

  // Clear all marked tiles
  public clearAllMarkedTiles(): void {
    this.clearFindableTiles();
    this.clearForageableTiles();
    this.clearFellableTiles();
    this.clearFetchableTiles();
  }

  // Reset visibility states
  public resetVisibility(): void {
    this.showFindableTiles = true;
    this.showForageableTiles = true;
    this.showFellableTiles = true;
    this.showFetchableTiles = true;
  }

  private resourceCounts: Map<ResourceCount, number> = new Map([
    [ResourceCount.Berries, 0],
    [ResourceCount.Wood, 0],
    [ResourceCount.Cream, 0],
    [ResourceCount.Stone, 0],
  ]);

  // Add these new methods
  public getResourceCount(type: ResourceCount): number {
    return this.resourceCounts.get(type) || 0;
  }

  public addToResourceCount(type: ResourceCount, amount: number): void {
    const currentAmount = this.resourceCounts.get(type) || 0;
    this.resourceCounts.set(type, currentAmount + amount);
  }

  public removeFromResourceCount(type: ResourceCount, amount: number): boolean {
    const currentAmount = this.resourceCounts.get(type) || 0;
    if (currentAmount >= amount) {
      this.resourceCounts.set(type, currentAmount - amount);
      return true;
    }
    return false;
  }
}

// Create a singleton instance
export const gameState = new GameState();
