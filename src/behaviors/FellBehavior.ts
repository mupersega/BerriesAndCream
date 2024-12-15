// src/behaviors/FellBehavior.ts
import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Resource } from '../Resource';
import { Dijkstra } from '../pathfinding/Dijkstra';
import { ItemType } from '../types/ItemType';
import { InventoryItem } from '../types/InventoryItem';
import { ResourceType } from '../types/ResourceType';
import { gameState } from '../state/GameState';

export class FellBehavior implements AgentBehavior {
  private readonly CHOP_DELAY = 120;  // 2 seconds at 60fps (trees take longer than berries)
  private chopTimer: number = 0;
  private currentTree: Resource | null = null;
  private readonly pathfinder = new Dijkstra();
  
  constructor() {}

  private isTreeResource(type: ResourceType): boolean {
    return type === ResourceType.Tree || 
           type === ResourceType.PineTree || 
           type === ResourceType.OakTree;
  }

  update(agent: Agent): void {
    // Stop chopping if inventory is full and not currently chopping
    if (!agent.hasInventorySpace() && !this.currentTree) {
      this.currentTree = null;
      this.chopTimer = 0;
      agent.setBehavior('idle');
      return;
    }

    // If we're currently chopping, continue the chop
    if (this.currentTree && this.chopTimer > 0) {
      agent.clearTarget();
      
      this.chopTimer--;
      if (this.chopTimer === 0) {
        const harvested = this.currentTree.harvest(1);
        
        if (harvested > 0) {
          const added = agent.addToInventory({
            type: ItemType.Wood,
            quantity: 1
          } as InventoryItem);
          
          // If we couldn't add to inventory, put it back in the tree
          if (!added) {
            this.currentTree.addAmount(1);
            this.currentTree = null;
            return;
          }
        }
        
        // Only stop if tree is depleted or inventory is full
        if (this.currentTree.isDepleted() || !agent.hasInventorySpace()) {
          this.currentTree = null;
        } else {
          // Continue chopping if we can
          this.chopTimer = this.CHOP_DELAY;
        }
      }
      return;
    }

    // If we're near a tree, start chopping it
    const pos = agent.getPosition();
    
    const resources = gameState.getResources().filter(resource => {
      if (!this.isTreeResource(resource.getType()) || resource.isDepleted()) return false;
      
      const resourcePos = resource.getPosition();
      const distance = Math.hypot(
        resourcePos.x - pos.x,
        resourcePos.y - pos.y
      );
      
      return distance <= 0.82;
    });

    if (resources.length > 0) {
      this.currentTree = resources[0];
      this.chopTimer = this.CHOP_DELAY;
      agent.clearTarget();
      return;
    }

    // Check if we've reached our target
    if (agent.hasTarget()) {
      const target = agent.getTarget();
      const distance = Math.hypot(target.x - pos.x, target.y - pos.y);
      
      if (distance <= 0.5) {  // If we're close enough to the target
        agent.clearTarget();
      } else {
        return;  // Continue moving to target
      }
    }

    // If we don't have a target, find nearest tree
    if (!agent.hasTarget()) {
      const nearestTree = this.findNearestTree(agent);
      if (nearestTree) {
        const treePos = nearestTree.getPosition();
        agent.setTarget(treePos.x, treePos.y);
      }
    }
  }

  getName(): string {
    return 'Fell';
  }

  private findNearestTree(agent: Agent): Resource | null {
    const pos = agent.getPosition();
    let nearestTree: Resource | null = null;
    let shortestPathLength = Infinity;
    
    // Get fellable tiles from GameState
    const fellableTiles = gameState.getFellableTiles();

    // Get all resources that are on fellable tiles
    const resources = gameState.getResources().filter(resource => {
      const resourcePos = resource.getPosition();
      return fellableTiles.some(tile => 
        Math.floor(resourcePos.x) === tile.x && 
        Math.floor(resourcePos.y) === tile.y
      );
    });

    for (const resource of resources) {
      if (!this.isTreeResource(resource.getType()) || resource.isDepleted()) {
        continue;
      }

      const resourcePos = resource.getPosition();
      const directDistance = Math.hypot(
        resourcePos.x - pos.x,
        resourcePos.y - pos.y
      );
      
      const path = this.pathfinder.findPath(
        { x: Math.round(pos.x), y: Math.round(pos.y) },
        { x: Math.round(resourcePos.x), y: Math.round(resourcePos.y) },
        (x, y) => !agent.isWater(x, y),
        agent.getMap()[0].length,
        agent.getMap().length
      );

      const distance = path ? path.length : directDistance;

      if (distance < shortestPathLength) {
        shortestPathLength = distance;
        nearestTree = resource;
      }
    }

    return nearestTree;
  }
}