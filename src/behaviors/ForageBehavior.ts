import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
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

  update(agent: Agent): void {
    console.log(`[Forage] Starting update for agent at (${agent.getPosition().x}, ${agent.getPosition().y})`);
    console.log('[Forage] Berry count in inventory:', agent.getInventoryCount('Berry'));
    
    // Stop foraging if inventory is full and not currently harvesting
    if (!agent.hasInventorySpace() && !this.currentBerry) {
      console.log('[Forage] Inventory full - switching to Flush behavior');
      this.currentBerry = null;
      this.harvestTimer = 0;
      agent.setBehavior('idle');
      return;
    }

    // If we're currently harvesting, continue the harvest
    if (this.currentBerry && this.harvestTimer > 0) {
      console.log(`[Forage] Continuing harvest - ${this.harvestTimer} ticks remaining`);
      agent.clearTarget();
      
      this.harvestTimer--;
      if (this.harvestTimer === 0) {
        console.log('[Forage] Harvest timer complete, attempting to harvest berry');
        console.log(`[Forage] Current berry details:`, {
          type: ResourceType[this.currentBerry.getType()],
          amount: this.currentBerry.getAmount(),
          position: this.currentBerry.getPosition()
        });
        
        const harvested = this.currentBerry.harvest(1);
        console.log(`[Forage] Harvested amount: ${harvested}`);
        
        if (harvested > 0) {
          const added = agent.addToInventory({
            type: ItemType.Berry,
            quantity: 1
          } as InventoryItem);
          
          console.log(`[Forage] Inventory add ${added ? 'successful' : 'failed'}`);
          
          // If we couldn't add to inventory, put it back in the bush
          if (!added) {
            console.log('[Forage] Returning berry to bush - inventory full');
            this.currentBerry.addAmount(1);
            this.currentBerry = null;
            return;
          }
        }
        
        // Only stop if berry is depleted or inventory is full
        if (this.currentBerry.isDepleted() || !agent.hasInventorySpace()) {
          console.log(`[Forage] Stopping harvest - Berry depleted: ${this.currentBerry.isDepleted()}, Inventory full: ${!agent.hasInventorySpace()}`);
          this.currentBerry = null;
        } else {
          // Continue harvesting if we can
          console.log('[Forage] Continuing harvest cycle');
          this.harvestTimer = this.HARVEST_DELAY;
        }
      }
      return;
    }

    // If we're near a berry bush, start harvesting it
    const pos = agent.getPosition();
    console.log('[Forage] Checking for nearby berries');
    
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
      console.log(`[Forage] Found berry to harvest at (${resources[0].getPosition().x}, ${resources[0].getPosition().y})`);
      this.currentBerry = resources[0];
      this.harvestTimer = this.HARVEST_DELAY;
      agent.clearTarget();
      return;
    }

    // Check if we've reached our target
    if (agent.hasTarget()) {
      const target = agent.getTarget();
      const distance = Math.hypot(target.x - pos.x, target.y - pos.y);
      
      console.log(`[Forage] Distance to target: ${distance}`);
      
      if (distance <= 0.5) {  // If we're close enough to the target
        console.log('[Forage] Reached target, clearing it');
        agent.clearTarget();
      } else {
        console.log(`[Forage] Moving to target at (${target.x}, ${target.y})`);
        return;  // Continue moving to target
      }
    }

    // If we don't have a target, find nearest berry bush
    if (!agent.hasTarget()) {
      console.log('[Forage] No current target, searching for nearest berry');
      const nearestBerry = this.findNearestBerry(agent);
      if (nearestBerry) {
        const berryPos = nearestBerry.getPosition();
        console.log(`[Forage] Setting target to berry at (${berryPos.x}, ${berryPos.y})`);
        agent.setTarget(berryPos.x, berryPos.y);
      } else {
        console.log('[Forage] No reachable berries found');
      }
    }
  }

  getName(): string {
    return 'Forage';
  }

  private findNearestBerry(agent: Agent): Resource | null {
    const pos = agent.getPosition();
    let nearestBerry: Resource | null = null;
    let shortestPathLength = Infinity;

    console.log(`[Forage] Searching for nearest berry from position (${pos.x}, ${pos.y})`);
    
    // Get forageable tiles from GameState
    const forageableTiles = gameState.getForageableTiles();
    console.log(`[Forage] Found ${forageableTiles.length} forageable tiles`);

    // Get all resources that are on forageable tiles
    const resources = gameState.getResources().filter(resource => {
      const resourcePos = resource.getPosition();
      return forageableTiles.some(tile => 
        Math.floor(resourcePos.x) === tile.x && 
        Math.floor(resourcePos.y) === tile.y
      );
    });

    console.log(`[Forage] Filtered to ${resources.length} resources on forageable tiles`);

    for (const resource of resources) {
      if (!this.isBerryResource(resource.getType()) || resource.isDepleted()) {
        console.log(`[Forage] Skipping resource: ${resource.getType()} (depleted: ${resource.isDepleted()})`);
        continue;
      }

      const resourcePos = resource.getPosition();
      const directDistance = Math.hypot(
        resourcePos.x - pos.x,
        resourcePos.y - pos.y
      );
      
      console.log(`[Forage] Checking berry at (${resourcePos.x}, ${resourcePos.y}), direct distance: ${directDistance}`);
      
      const path = this.pathfinder.findPath(
        { x: Math.round(pos.x), y: Math.round(pos.y) },
        { x: Math.round(resourcePos.x), y: Math.round(resourcePos.y) },
        (x, y) => !agent.isWater(x, y),
        agent.getMap()[0].length,
        agent.getMap().length
      );

      const distance = path ? path.length : directDistance;
      console.log(`[Forage] Path ${path ? 'found' : 'not found'}, distance: ${distance}`);

      if (distance < shortestPathLength) {
        shortestPathLength = distance;
        nearestBerry = resource;
        console.log(`[Forage] New nearest berry found at (${resourcePos.x}, ${resourcePos.y})`);
      }
    }

    console.log(`[Forage] Search complete. ${nearestBerry ? 'Berry found' : 'No berry found'}`);
    return nearestBerry;
  }
} 