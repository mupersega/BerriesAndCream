import { TileType } from './types/TileType';
import { Resource, ResourceType } from './Resource';
import { BehaviorManager } from './behaviors/BehaviorManager';
import { AgentRole } from './types/AgentRole';
import { InventoryItem } from './types/InventoryItem';
import { Point } from './types/Point';
import { Dijkstra } from './pathfinding/Dijkstra';
import { BehaviorEntity } from './behaviors/BehaviourEntity';
import { IDrawable } from './interfaces/IDrawable';
import { IsometricRenderer } from './rendering/IsometricRenderer';

interface AgentObserver {
  onHealthChange?: (health: number) => void;
  onInventoryChange?: (inventory: (InventoryItem | null)[]) => void;
  onStuckChange?: (isStuck: boolean) => void;
  onPathChange?: (path: Point[]) => void;
  onKnownResourcesChange?: (resources: Resource[]) => void;
}

export class Agent implements BehaviorEntity, IDrawable {
  private x: number;
  private y: number;
  private map: TileType[][];
  private target: { x: number, y: number } | null = null;
  private waitTime: number = 0;
  private readonly WAIT_DURATION = 60;  // frames to wait at each destination
  private stuckTime: number = 0;
  private readonly STUCK_THRESHOLD = 180; // 3 seconds at 60fps
  private behaviorManager: BehaviorManager;
  private maxHealth: number = 100;
  private currentHealth: number = 100;
  private readonly CRITICAL_HEALTH = 30;  // Threshold for low health
  
  private isDead_: boolean = false;
  private knownResources: Map<string, Resource> = new Map();
  private exploredTiles: Set<string> = new Set();
  private currentPath: {x: number, y: number}[] = [];
  private readonly pathfinder = new Dijkstra();
  private facingLeft: boolean = false;
  private animationTime: number = 0;
  private readonly BOUNCE_SPEED = 0.05;
  private readonly BOUNCE_HEIGHT = 8;
  private isMoving: boolean = false;
  private role: AgentRole = AgentRole.Idle;

  // Inventory system
  private readonly INVENTORY_SIZE = 10;
  private inventory: (InventoryItem | null)[] = [];
  private readonly MAX_STACK_SIZE = 5;

  private currentBehavior: string = 'Idle';  // Add this property

  private observers: AgentObserver[] = [];

  constructor(map: TileType[][], resources: Resource[], startX?: number, startY?: number) {
    this.map = map;
    
    if (startX === undefined || startY === undefined) {
      do {
        this.x = Math.floor(Math.random() * map[0].length);
        this.y = Math.floor(Math.random() * map.length);
      } while (this.isWater(this.x, this.y));
    } else {
      this.x = startX;
      this.y = startY;
    }
    
    this.currentHealth = this.maxHealth;
    this.behaviorManager = new BehaviorManager(resources, 'agent');
    this.role = AgentRole.Scout;
    this.inventory = new Array(this.INVENTORY_SIZE).fill(null);
  }

  public update(): void {
    if (this.isDead_) return;

    // Update wait time
    if (this.waitTime > 0) {
      this.waitTime--;
    }

    // Update behavior
    this.behaviorManager.update(this);

    // Update movement if we have a target
    if (this.hasTarget() && this.waitTime <= 0) {
      this.updateMovement();
    }

    // Check for death
    if (this.currentHealth <= 0) {
      this.die();
    }
  }

  public isWater(x: number, y: number): boolean {
    // Convert to integers and check bounds
    const ix = Math.round(x);
    const iy = Math.round(y);
    
    if (iy < 0 || iy >= this.map.length || 
        ix < 0 || ix >= this.map[0].length) {
        return true; // Treat out-of-bounds as water
    }
    
    const tile = this.map[iy][ix];
    return tile === TileType.Water || tile === TileType.DeepWater;
  }

  public moveTowards(targetX: number, targetY: number) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    
    // Update facing direction
    if (Math.abs(dx) > 0.01) {
        this.facingLeft = dx < 0;
    }
    
    const moveSpeed = 0.01;
    const PUSH_STRENGTH = 0.9;
    
    // Calculate movement
    const distance = Math.hypot(dx, dy);
    if (distance < 0.1) {
        this.x = targetX;
        this.y = targetY;
        this.isMoving = false;
        return;
    }
    
    // Set isMoving to true when actually moving
    this.isMoving = true;
    
    // Try to move
    const moveX = (dx / distance) * moveSpeed;
    const moveY = (dy / distance) * moveSpeed;
    const newX = this.x + moveX;
    const newY = this.y + moveY;
    
    // Check if new position is blocked
    if (this.isWater(newX, newY)) {
        // If blocked, push away from obstacle with stronger force
        const obstacleX = Math.floor(newX);
        const obstacleY = Math.floor(newY);
        
        // Push directly away from obstacle
        this.x += (this.x - obstacleX) * PUSH_STRENGTH;
        this.y += (this.y - obstacleY) * PUSH_STRENGTH;
    } else {
        this.x = newX;
        this.y = newY;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, screenX: number, screenY: number): void {
    const spritesheet = window.gameState.getSpritesheetSync();
    if (!spritesheet?.complete) return;

    // Update bounce animation with debug logging
    if (this.isMoving) {
      this.animationTime = (this.animationTime + this.BOUNCE_SPEED) % (Math.PI * 2);
    } else {
      this.animationTime = 0;
    }
    
    // Use a smoother bounce curve
    const bounceOffset = this.isMoving ? 
      Math.pow(Math.sin(this.animationTime), 2) * this.BOUNCE_HEIGHT : 0;

    console.log('Agent bounce:', {
      isMoving: this.isMoving,
      animationTime: this.animationTime,
      bounceOffset: bounceOffset
    });

    // Draw shadow
    this.drawShadow(ctx, screenX, screenY);

    // Draw health bar
    this.drawHealthBar(ctx, screenX, screenY);

    // Draw agent sprite with bounce
    IsometricRenderer.drawSprite(
      ctx,
      spritesheet,
      {
        x: this.facingLeft ? 64 : 96,
        y: 160,
        width: 32,
        height: 32,
        anchorBottom: true,
        verticalOffset: 0,
        additionalOffset: bounceOffset
      },
      screenX,
      screenY,
      this.x,
      this.y
    );
  }

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const verticalOffset = IsometricRenderer.getHeightOffset(this.x, this.y);
    const bounceOffset = this.isMoving ? 
      (1 - Math.cos(this.animationTime)) * this.BOUNCE_HEIGHT * 0.5 : 0;
    
    const shadowAlpha = Math.max(0.1, 0.3 - (verticalOffset / 100));
    const shadowScaleX = 1 + (bounceOffset / 16);
    const shadowScaleY = 1 - (bounceOffset / 32);
    
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(
      x + 6,
      y - verticalOffset + 5,
      8 * shadowScaleX,
      2 * shadowScaleY,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  private drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const verticalOffset = IsometricRenderer.getHeightOffset(this.x, this.y);
    const barWidth = 32;
    const barHeight = 4;
    const barOffset = 40;

    ctx.fillStyle = '#000';
    ctx.fillRect(
      x - barWidth/2,
      y - verticalOffset - barOffset,
      barWidth,
      barHeight
    );

    ctx.fillStyle = '#f00';
    ctx.fillRect(
      x - barWidth/2,
      y - verticalOffset - barOffset,
      barWidth * (this.currentHealth / this.maxHealth),
      barHeight
    );
  }

  public getDrawOrder(): number {
    return this.x + this.y;
  }

  public getPosition() {
    return { 
      x: this.x, 
      y: this.y
    };
  }

  public getMap(): TileType[][] {
    return this.map;
  }

  private updateMovement(): void {
    if (this.hasPath()) {
        const nextPoint = this.getNextPathPoint()!;
        const distance = Math.hypot(nextPoint.x - this.x, nextPoint.y - this.y);
        
        // Update facing direction based on isometric movement
        const isometricDirection = (nextPoint.x - this.x) - (nextPoint.y - this.y);
        if (Math.abs(isometricDirection) > 0.01) {
            this.facingLeft = isometricDirection < 0;
        }
        
        if (distance < 0.1) {
            this.advancePath();
            if (!this.hasPath()) {
                this.clearTarget();
                this.waitTime = this.WAIT_DURATION;
            }
        } else {
            this.moveTowards(nextPoint.x, nextPoint.y);
        }
    }
  }

  public setTargetWithPath(target: {x: number, y: number}, path: {x: number, y: number}[]): void {    
    this.target = target;
    this.currentPath = path;
  }

  private pickNewTarget(): void {
    // Try to find a valid land position within reasonable distance
    let attempts = 0;
    const maxAttempts = 50; // Increased from 20 to 50
    const maxDistance = 15; // Increased from 10 to 15
    
    while (attempts < maxAttempts) {
      // Pick a random point within maxDistance tiles
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * maxDistance;
      const tx = Math.floor(this.x + Math.cos(angle) * distance);
      const ty = Math.floor(this.y + Math.sin(angle) * distance);
      
      // Check if the target is within bounds and on land
      if (tx >= 0 && tx < this.map[0].length &&
          ty >= 0 && ty < this.map.length &&
          !this.isWater(tx, ty)) {
        this.setTarget(tx, ty);
        return;
      }
      
      attempts++;
    }
    
    // If we couldn't find a good target nearby, try to find ANY valid land tile
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[0].length; x++) {
        if (!this.isWater(x, y)) {
          this.setTarget(x, y);
          return;
        }
      }
    }
    
    // If we still can't find a target (shouldn't happen), reset position
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.target = null;
  }

  public getTarget(): { x: number, y: number } | null {
    return this.target;
  }

  public getCurrentTile(): TileType {
    return this.map[Math.floor(this.y)][Math.floor(this.x)];
  }

  public isStuck(): boolean {
    return this.stuckTime >= this.STUCK_THRESHOLD;
  }

  public getBehavior(): string {
    return this.currentBehavior;
  }
  
  public hasTarget(): boolean {
    const result = this.target !== null;
    return result;
  }
  
  public setTarget(x: number, y: number): void {
    const start = {
      x: Math.round(this.x),
      y: Math.round(this.y)
    };
    const goal = { x: Math.round(x), y: Math.round(y) };
    
    // Modify the isWalkable function to exclude stone and snow tiles
    const path = this.pathfinder.findPath(
      start,
      goal,
      (x, y) => {
        const tile = this.map[y][x];
        return tile !== TileType.Water && 
               tile !== TileType.DeepWater && 
               tile !== TileType.Stone && 
               tile !== TileType.Snow;
      },
      this.map[0].length,
      this.map.length
    );
    
    if (path) {
      this.setTargetWithPath(goal, path);
    } else {
      this.clearTarget();
    }
  }

  public clearTarget(): void {
    this.target = null;
    this.currentPath = [];
    this.isMoving = false;
  }

  public getHealth(): number {
    return this.currentHealth;
  }

  public heal(amount: number): void {
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    this.notifyHealthChange();
  }

  public damage(amount: number): void {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
    this.notifyHealthChange();
  }

  public isLowHealth(): boolean {
    return this.currentHealth <= this.CRITICAL_HEALTH;
  }

  public isDead(): boolean {
    return this.isDead_;
  }

  public addKnownResource(resource: Resource): void {
    const pos = resource.getPosition();
    const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
    
    if (!resource.isDepleted()) {
      this.knownResources.set(key, resource);
    }
  }

  public removeKnownResource(resource: Resource): void {
    const pos = resource.getPosition();
    const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
    this.knownResources.delete(key);
  }

  public getKnownResources(): Resource[] {
    // Filter out any depleted resources and remove them from the map
    const resources = Array.from(this.knownResources.values());
    const validResources = resources.filter(resource => {
      if (resource.isDepleted()) {
        this.removeKnownResource(resource);
        return false;
      }
      return true;
    });
    return validResources;
  }

  public getKnownBerries(): Resource[] {
    return this.getKnownResources().filter(resource => resource.getType() === ResourceType.Berry);
  }

  public getKnownWells(): Resource[] {
    return this.getKnownResources().filter(resource => resource.getType() === ResourceType.Well);
  }

  public addExploredTile(x: number, y: number): void {
    this.exploredTiles.add(`${Math.round(x)},${Math.round(y)}`);
  }

  public hasExploredTile(x: number, y: number): boolean {
    return this.exploredTiles.has(`${Math.round(x)},${Math.round(y)}`);
  }

  public setPath(path: {x: number, y: number}[]): void {
    this.currentPath = path;
  }

  public hasPath(): boolean {
    return this.currentPath.length > 0;
  }

  public getNextPathPoint(): {x: number, y: number} | null {
    return this.currentPath[0] || null;
  }

  public advancePath(): void {
    this.currentPath.shift();
  }

  public getCurrentPath(): {x: number, y: number}[] {
    return this.currentPath;
  }

  private ensurePathToTarget(): void {
    if (this.target && !this.hasPath()) {
        // console.log(`[Agent] Target exists but no path, recalculating path...`);
        this.setTarget(this.target.x, this.target.y);  // This will recalculate the path
    }
  }

  public setRole(newRole: AgentRole): void {
    if (this.role !== newRole) {
      this.role = newRole;
      this.clearTarget();  // Clear current target when role changes
      console.log(`Agent role changed to ${AgentRole[newRole]}`);
    }
  }

  public getRole(): AgentRole {
    return this.role;
  }

  // New inventory management methods
  public addToInventory(item: InventoryItem): boolean {
    // First try to stack with existing items
    for (let i = 0; i < this.inventory.length; i++) {
      const slot = this.inventory[i];
      if (slot?.type === item.type && slot.quantity < this.MAX_STACK_SIZE) {
        slot.quantity++;
        this.notifyInventoryChange();  // Notify observers
        return true;
      }
    }

    // If no stack found, try to find empty slot
    const emptySlot = this.inventory.findIndex(slot => slot === null);
    if (emptySlot !== -1) {
      this.inventory[emptySlot] = {
        type: item.type,
        quantity: 1
      };
      this.notifyInventoryChange();  // Notify observers
      return true;
    }

    return false; // Inventory is full
  }

  public removeFromInventory(itemType: string, amount: number = 1): number {
    let removed = 0;
    for (let i = 0; i < this.inventory.length && removed < amount; i++) {
      const slot = this.inventory[i];
      if (slot?.type === itemType) {
        const toRemove = Math.min(slot.quantity, amount - removed);
        slot.quantity -= toRemove;
        removed += toRemove;

        // Clear slot if empty
        if (slot.quantity === 0) {
          this.inventory[i] = null;
        }
      }
    }
    
    if (removed > 0) {
      this.notifyInventoryChange();  // Notify observers
    }
    
    return removed;
  }

  public getInventoryCount(itemType: string): number {
    return this.inventory.reduce((total, slot) => 
      total + (slot?.type === itemType ? slot.quantity : 0), 0);
  }

  public hasInventorySpace(): boolean {
    return this.inventory.some(slot => 
      slot === null || slot.quantity < this.MAX_STACK_SIZE);
  }

  public getInventory(): (InventoryItem | null)[] {
    return [...this.inventory];
  }

  private die(): void {
    this.isDead_ = true;
  }

  public pickNewRandomTarget(): void {
    this.pickNewTarget();
  }

  public getBehaviorManager(): BehaviorManager {
    return this.behaviorManager;
  }

  public setBehavior(behaviorName: string): void {
    console.log('[Agent] Setting behavior:', { 
        from: this.currentBehavior, 
        to: behaviorName 
    });
    this.currentBehavior = behaviorName;
    this.behaviorManager.setBehavior(behaviorName);
    this.clearTarget();
  }

  // Add observer methods
  public addObserver(observer: AgentObserver) {
    this.observers.push(observer);
  }

  public removeObserver(observer: AgentObserver) {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  // Add notification methods
  private notifyHealthChange() {
    this.observers.forEach(observer => {
      observer.onHealthChange?.(this.currentHealth);
    });
  }

  private notifyInventoryChange() {
    this.observers.forEach(observer => {
      observer.onInventoryChange?.(this.getInventory());
    });
  }

  private notifyStuckChange() {
    this.observers.forEach(observer => {
      observer.onStuckChange?.(this.isStuck());
    });
  }

  private notifyPathChange() {
    this.observers.forEach(observer => {
      observer.onPathChange?.(this.getCurrentPath());
    });
  }

  private notifyKnownResourcesChange() {
    this.observers.forEach(observer => {
      observer.onKnownResourcesChange?.(this.getKnownResources());
    });
  }

  public initializeUI(index: number): void {
    const agentContainer = document.querySelector('.agent-container');
    if (!agentContainer) return;

    // Create card element
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.dataset.agentIndex = index.toString();
    
    // Set initial HTML
    card.innerHTML = `
        <header class="agent-header">
            <h4>Agent ${index + 1}</h4>
            <div class="behavior-controls">
                <select class="behavior-select" data-agent-index="${index}">
                    <option value="Idle" ${this.currentBehavior === 'Idle' ? 'selected' : ''}>Idle</option>
                    <option value="Explore" ${this.currentBehavior === 'Explore' ? 'selected' : ''}>Explore</option>
                    <option value="Forage" ${this.currentBehavior === 'Forage' ? 'selected' : ''}>Forage</option>
                </select>
            </div>
            <button class="debug-toggle">${window.DEBUG.agentDebug[index] ? '▼' : '▶'}</button>
        </header>
        <div class="agent-stats">
            ${createProgressBar(this.getHealth(), 'health')}
            ${renderInventory(this.getInventory())}
            ${this.isStuck() ? '<div class="status-warning">STUCK!</div>' : ''}
        </div>
        <div class="debug-info ${window.DEBUG.agentDebug[index] ? 'show' : ''}">
            ${renderPath(this.getCurrentPath())}
            ${renderKnownResources(this.getKnownResources())}
        </div>
    `;

    // Add event listeners
    const select = card.querySelector('.behavior-select') as HTMLSelectElement;
    if (select) {
        select.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            const newBehavior = target.value;
            console.log('[Agent UI] Behavior change requested:', { index, newBehavior });
            this.setBehavior(newBehavior);
        });
    }

    const debugToggle = card.querySelector('.debug-toggle');
    if (debugToggle) {
        debugToggle.addEventListener('click', () => {
            window.DEBUG.toggleAgentDebug(index);
        });
    }

    // Add card to container
    agentContainer.appendChild(card);
  }

  // Add this method for debugging
  public debugKnownResources(): void {
    console.log('[Agent] Known Resources:');
    this.getKnownResources().forEach(resource => {
      const pos = resource.getPosition();
      console.log(`- ${ResourceType[resource.getType()]} at (${pos.x}, ${pos.y}), amount: ${resource.getAmount()}`);
    });
  }

  private findPathToTarget(
    agent: Agent, 
    target: {x: number, y: number}
  ): {x: number, y: number}[] | null {
    const pos = agent.getPosition();
    const start = {
      x: Math.floor(pos.x),
      y: Math.floor(pos.y)
    };
    
    return this.pathfinder.findPath(
      start,
      target,
      (x, y) => {
        const tile = agent.getMap()[y][x];
        return tile !== TileType.Water && 
               tile !== TileType.DeepWater && 
               tile !== TileType.Stone && 
               tile !== TileType.Snow;
      },
      agent.getMap()[0].length,
      agent.getMap().length
    );
  }

  private isValidTarget(agent: Agent, x: number, y: number): boolean {
    const tile = agent.getMap()[y][x];
    if (agent.hasExploredTile(x, y) || 
        tile === TileType.Water || 
        tile === TileType.DeepWater ||
        tile === TileType.Stone ||
        tile === TileType.Snow) {
      return false;
    }
    
    const directions = [
      {x: 1, y: 0}, {x: -1, y: 0},
      {x: 0, y: 1}, {x: 0, y: -1},
      {x: 1, y: 1}, {x: -1, y: 1},
      {x: 1, y: -1}, {x: -1, y: -1}
    ];
    
    return directions.some(dir => {
      const nx = x + dir.x;
      const ny = y + dir.y;
      const neighborTile = agent.getMap()[ny][nx];
      return neighborTile !== TileType.Water && 
             neighborTile !== TileType.DeepWater &&
             neighborTile !== TileType.Stone &&
             neighborTile !== TileType.Snow &&
             agent.hasExploredTile(nx, ny);
    });
  }

  // Add static method for generating agents
  public static generateAgents(map: TileType[][], resources: Resource[], count: number): Agent[] {
    const agents: Agent[] = [];
    
    for (let i = 0; i < count; i++) {
      // Create new agent with random valid position
      const agent = new Agent(map, resources);
      agent.initializeUI(i);
      agents.push(agent);
    }

    return agents;
  }
} 