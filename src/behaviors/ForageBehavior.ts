import { AgentBehavior } from './AgentBehavior';
import { BaseAgent } from '../agents/BaseAgent';
import { Resource } from '../Resource';
import { Dijkstra } from '../pathfinding/Dijkstra';
import { ItemType } from '../types/ItemType';
import { InventoryItem } from '../types/InventoryItem';
import { ResourceType } from '../types/ResourceType';
import { gameState } from '../state/GameState';

export class ForageBehavior implements AgentBehavior {
  private readonly HARVEST_DELAY = 60;  // 1 second at 60fps
  private harvestTimer: number = 0;
  private currentBerry: Resource | null = null;
  private readonly pathfinder = new Dijkstra();
  
  constructor() {}

  private isBerryResource(type: ResourceType): boolean {
    return type === ResourceType.BerryBush || 
           type === ResourceType.BerryPile || 
           type === ResourceType.BerryTree;
  }

  update(agent: BaseAgent): void {
    // Stop foraging if inventory is full and not currently harvesting
    if (!agent.hasInventorySpace() && !this.currentBerry) {
      this.currentBerry = null;
      this.harvestTimer = 0;
      agent.setBehavior('Flush');
      agent.setLastBehavior('Forage');
      return;
    }

    // If we're currently harvesting, continue the harvest
    if (this.currentBerry && this.harvestTimer > 0) {
      agent.clearTarget();
      
      this.harvestTimer--;
      if (this.harvestTimer === 0) {
        const harvested = this.currentBerry.harvest(1);
        
        if (harvested > 0) {
          const added = agent.addToInventory({
            type: ItemType.Berry,
            quantity: 1
          } as InventoryItem);
          
          // If we couldn't add to inventory, put it back in the bush
          if (!added) {
            this.currentBerry.addAmount(1);
            this.currentBerry = null;
            return;
          }
        }
        
        // Only stop if berry is depleted or inventory is full
        if (this.currentBerry.isDepleted() || !agent.hasInventorySpace()) {
          this.currentBerry = null;
        } else {
          // Continue harvesting if we can
          this.harvestTimer = this.HARVEST_DELAY;
        }
      }
      return;
    }

    // If we're near a berry bush, start harvesting it
    const pos = agent.getPosition();
    
    const resources = gameState.getResources().filter(resource => {
      if (!this.isBerryResource(resource.getType()) || resource.isDepleted()) return false;
      
      const resourcePos = resource.getPosition();
      const distance = Math.hypot(
        resourcePos.x - pos.x,
        resourcePos.y - pos.y
      );
      
      return distance <= 0.82;
    });

    if (resources.length > 0) {
      this.currentBerry = resources[0];
      this.harvestTimer = this.HARVEST_DELAY;
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

    // If we don't have a target, find nearest berry bush
    if (!agent.hasTarget()) {
      const nearestBerry = this.findNearestBerry(agent);
      if (nearestBerry) {
        const berryPos = nearestBerry.getPosition();
        agent.setTarget(berryPos.x, berryPos.y);
      }
    }
  }

  getName(): string {
    return 'Forage';
  }

  private findNearestBerry(agent: BaseAgent): Resource | null {
    const pos = agent.getPosition();
    let nearestBerry: Resource | null = null;
    let shortestPathLength = Infinity;
    
    // Get forageable tiles from GameState
    const forageableTiles = gameState.getForageableTiles();

    // Get all resources that are on forageable tiles
    const resources = gameState.getResources().filter(resource => {
      const resourcePos = resource.getPosition();
      return forageableTiles.some(tile => 
        Math.floor(resourcePos.x) === tile.x && 
        Math.floor(resourcePos.y) === tile.y
      );
    });

    for (const resource of resources) {
      if (!this.isBerryResource(resource.getType()) || resource.isDepleted()) {
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
        nearestBerry = resource;
      }
    }

    return nearestBerry;
  }
} 