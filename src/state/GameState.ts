import { Agent } from '../Agent';
import { Resource } from '../Resource';
import { Structure } from '../Structure';
import { TileType } from '../types/TileType';
import { StructureType } from '../types/StructureType';
import { findSuitableBuildingLocation } from '../utils/locationUtils';
import { Point } from '../types/Point';

export class GameState {
  protected map: TileType[][] = [];
  private resources: Resource[] = [];
  private structures: Structure[] = [];
  private agents: Agent[] = [];
  private spritesheet: HTMLImageElement | null = null;
  private spritesheetLoadPromise: Promise<HTMLImageElement> | null = null;
  private selectedTile: Point | null = null;
  private findableTiles: Set<string> = new Set();
  private forageableTiles: Set<string> = new Set();
  private fellableTiles: Set<string> = new Set();

  // Individual area visibility flags
  private showFindableTiles: boolean = true;
  private showForageableTiles: boolean = true;
  private showFellableTiles: boolean = true;

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
  addAgent(agent: Agent) {
    this.agents.push(agent);
    console.log('Agent added:', agent);
  }

  removeAgent(agent: Agent) {
    const index = this.agents.indexOf(agent);
    if (index > -1) {
      agent.cleanup?.();
      this.agents.splice(index, 1);
      console.log('Agent removed:', agent);
    }
  }

  getAgents(): Agent[] {
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
    const structuresToAdd = [{ type: StructureType.Farm, count: 2 }];
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

    // Generate new agents
    const newAgents = Agent.generateAgents(this.map, this.resources, numAgents);
    newAgents.forEach(agent => this.addAgent(agent));
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

  // Clear all marked tiles
  public clearAllMarkedTiles(): void {
    this.clearFindableTiles();
    this.clearForageableTiles();
    this.clearFellableTiles();
  }

  // Reset visibility states
  public resetVisibility(): void {
    this.showFindableTiles = true;
    this.showForageableTiles = true;
    this.showFellableTiles = true;
  }
}

// Create a singleton instance
export const gameState = new GameState();
