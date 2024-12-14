import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Resource, ResourceType } from '../Resource';
import { Dijkstra } from '../pathfinding/Dijkstra';
import { ItemType } from '../types/ItemType';
import { InventoryItem } from '../types/InventoryItem';

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
      agent.setBehavior('Flush');  // Switch to Flush instead of Explore
      return;
    }

    // If we're currently harvesting, continue the harvest
    if (this.currentBerry && this.harvestTimer > 0) {
      console.log(`[Forage] Continuing harvest - ${this.harvestTimer} ticks remaining`);
      agent.clearTarget();
      
      this.harvestTimer--;
      if (this.harvestTimer === 0) {
        console.log('[Forage] Harvest timer complete, attempting to harvest berry');
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
    if (!agent.hasTarget()) {
      const pos = agent.getPosition();
      console.log('[Forage] Checking for nearby berries');
      
      const berryHere = agent.getKnownResources().find(r => {
        if (!this.isBerryResource(r.getType()) || r.isDepleted()) return false;
        
        const distance = Math.hypot(
          r.getPosition().x - pos.x,
          r.getPosition().y - pos.y
        );
        
        return distance <= 0.5;
      });

      if (berryHere) {
        console.log(`[Forage] Found berry to harvest at (${berryHere.getPosition().x}, ${berryHere.getPosition().y})`);
        this.currentBerry = berryHere;
        this.harvestTimer = this.HARVEST_DELAY;
        return;
      } else {
        console.log('[Forage] No berries in range to harvest');
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
    } else {
      console.log(`[Forage] Already has target at (${agent.getTarget().x}, ${agent.getTarget().y})`);
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
    console.log('[Forage] Berry count in inventory:', agent.getInventoryCount('Berry'));
    const knownResources = agent.getKnownResources();
    console.log(`[Forage] Known resources: ${knownResources.length}`);

    for (const resource of knownResources) {
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