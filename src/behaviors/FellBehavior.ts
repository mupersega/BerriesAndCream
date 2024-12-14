// src/behaviors/FellBehavior.ts
import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Resource, ResourceType } from '../Resource';
import { Dijkstra } from '../pathfinding/Dijkstra';
import { ItemType } from '../types/ItemType';
import { InventoryItem } from '../types/InventoryItem';

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
    console.log(`[Fell] Starting update for agent at (${agent.getPosition().x}, ${agent.getPosition().y})`);
    console.log('[Fell] Wood count in inventory:', agent.getInventoryCount('Wood'));
    
    // Stop chopping if inventory is full and not currently chopping
    if (!agent.hasInventorySpace() && !this.currentTree) {
      console.log('[Fell] Inventory full and not chopping - switching to Explore behavior');
      this.currentTree = null;
      this.chopTimer = 0;
      agent.setBehavior('Explore');
      return;
    }

    // If we're currently chopping, continue the chop
    if (this.currentTree && this.chopTimer > 0) {
      console.log(`[Fell] Continuing chop - ${this.chopTimer} ticks remaining`);
      agent.clearTarget();
      
      this.chopTimer--;
      if (this.chopTimer === 0) {
        console.log('[Fell] Chop timer complete, attempting to harvest wood');
        const harvested = this.currentTree.harvest(1);
        console.log(`[Fell] Harvested amount: ${harvested}`);
        
        if (harvested > 0) {
          const added = agent.addToInventory({
            type: ItemType.Wood,
            quantity: 1
          } as InventoryItem);
          
          console.log(`[Fell] Inventory add ${added ? 'successful' : 'failed'}`);
          
          // If we couldn't add to inventory, put it back in the tree
          if (!added) {
            console.log('[Fell] Returning wood to tree - inventory full');
            this.currentTree.addAmount(1);
            this.currentTree = null;
            return;
          }
        }
        
        // Only stop if tree is depleted or inventory is full
        if (this.currentTree.isDepleted() || !agent.hasInventorySpace()) {
          console.log(`[Fell] Stopping chop - Tree depleted: ${this.currentTree.isDepleted()}, Inventory full: ${!agent.hasInventorySpace()}`);
          this.currentTree = null;
        } else {
          // Continue chopping if we can
          console.log('[Fell] Continuing chop cycle');
          this.chopTimer = this.CHOP_DELAY;
        }
      }
      return;
    }

    // If we're near a tree, start chopping it
    if (!agent.hasTarget()) {
      const pos = agent.getPosition();
      console.log('[Fell] Checking for nearby trees');
      
      const treeHere = agent.getKnownResources().find(r => {
        if (!this.isTreeResource(r.getType()) || r.isDepleted()) return false;
        
        const distance = Math.hypot(
          r.getPosition().x - pos.x,
          r.getPosition().y - pos.y
        );
        
        return distance <= 0.5;
      });

      if (treeHere) {
        console.log(`[Fell] Found tree to chop at (${treeHere.getPosition().x}, ${treeHere.getPosition().y})`);
        this.currentTree = treeHere;
        this.chopTimer = this.CHOP_DELAY;
        return;
      } else {
        console.log('[Fell] No trees in range to chop');
      }
    }

    // If we don't have a target, find nearest tree
    if (!agent.hasTarget()) {
      console.log('[Fell] No current target, searching for nearest tree');
      const nearestTree = this.findNearestTree(agent);
      if (nearestTree) {
        const treePos = nearestTree.getPosition();
        console.log(`[Fell] Setting target to tree at (${treePos.x}, ${treePos.y})`);
        agent.setTarget(treePos.x, treePos.y);
      } else {
        console.log('[Fell] No reachable trees found');
      }
    } else {
      console.log(`[Fell] Already has target at (${agent.getTarget().x}, ${agent.getTarget().y})`);
    }
  }

  getName(): string {
    return 'Fell';
  }

  private findNearestTree(agent: Agent): Resource | null {
    const pos = agent.getPosition();
    let nearestTree: Resource | null = null;
    let shortestPathLength = Infinity;

    console.log(`[Fell] Searching for nearest tree from position (${pos.x}, ${pos.y})`);
    const knownResources = agent.getKnownResources();
    console.log(`[Fell] Known resources: ${knownResources.length}`);

    for (const resource of knownResources) {
      if (!this.isTreeResource(resource.getType()) || resource.isDepleted()) {
        console.log(`[Fell] Skipping resource: ${resource.getType()} (depleted: ${resource.isDepleted()})`);
        continue;
      }

      const resourcePos = resource.getPosition();
      const directDistance = Math.hypot(
        resourcePos.x - pos.x,
        resourcePos.y - pos.y
      );
      
      console.log(`[Fell] Checking tree at (${resourcePos.x}, ${resourcePos.y}), direct distance: ${directDistance}`);
      
      const path = this.pathfinder.findPath(
        { x: Math.round(pos.x), y: Math.round(pos.y) },
        { x: Math.round(resourcePos.x), y: Math.round(resourcePos.y) },
        (x, y) => !agent.isWater(x, y),
        agent.getMap()[0].length,
        agent.getMap().length
      );

      const distance = path ? path.length : directDistance;
      console.log(`[Fell] Path ${path ? 'found' : 'not found'}, distance: ${distance}`);

      if (distance < shortestPathLength) {
        shortestPathLength = distance;
        nearestTree = resource;
        console.log(`[Fell] New nearest tree found at (${resourcePos.x}, ${resourcePos.y})`);
      }
    }

    console.log(`[Fell] Search complete. ${nearestTree ? 'Tree found' : 'No tree found'}`);
    return nearestTree;
  }
}