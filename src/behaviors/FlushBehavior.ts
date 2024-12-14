import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Structure } from '../Structure';
import { Dijkstra } from '../pathfinding/Dijkstra';

export class FlushBehavior implements AgentBehavior {
  private readonly DEPOSIT_DELAY = 30;  // Half second at 60fps
  private depositTimer: number = 0;
  private currentStructure: Structure | null = null;
  private readonly pathfinder = new Dijkstra();

  getName(): string {
    return 'Flush';
  }

  update(agent: Agent): void {
    // If inventory is empty, switch back to previous behavior
    if (agent.getInventory().every(item => item === null)) {
      console.log('[Flush] Inventory empty, switching to Explore');
      agent.setBehavior('Explore');
      return;
    }

    // If we're currently depositing items
    if (this.currentStructure && this.depositTimer > 0) {
      agent.clearTarget();
      this.depositTimer--;

      if (this.depositTimer === 0) {
        this.depositItems(agent, this.currentStructure);
        
        // Check if we still have items to deposit
        if (agent.getInventory().every(item => item === null)) {
          this.currentStructure = null;
          agent.setBehavior('Explore');
        } else {
          // Continue depositing if we have more items
          this.depositTimer = this.DEPOSIT_DELAY;
        }
      }
      return;
    }

    // If we're near a structure, start depositing
    if (!agent.hasTarget()) {
      const pos = agent.getPosition();
      const nearbyStructure = this.findNearestStructure(agent);

      if (nearbyStructure && 
          Math.hypot(nearbyStructure.getPosition().x - pos.x,
                    nearbyStructure.getPosition().y - pos.y) <= 1) {
        console.log('[Flush] Starting deposit at structure');
        this.currentStructure = nearbyStructure;
        this.depositTimer = this.DEPOSIT_DELAY;
        return;
      }
    }

    // If we don't have a target, find nearest structure
    if (!agent.hasTarget()) {
      const nearestStructure = this.findNearestStructure(agent);
      if (nearestStructure) {
        const structurePos = nearestStructure.getPosition();
        console.log(`[Flush] Moving to structure at (${structurePos.x}, ${structurePos.y})`);
        agent.setTarget(structurePos.x, structurePos.y);
      }
    }
  }

  private findNearestStructure(agent: Agent): Structure | null {
    const pos = agent.getPosition();
    let nearestStructure: Structure | null = null;
    let shortestDistance = Infinity;

    for (const structure of window.gameState.structures) {
      if (!structure.isComplete()) continue;

      const structurePos = structure.getPosition();
      const distance = Math.hypot(
        structurePos.x - pos.x,
        structurePos.y - pos.y
      );

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestStructure = structure;
      }
    }

    return nearestStructure;
  }

  private depositItems(agent: Agent, structure: Structure): void {
    const inventory = agent.getInventory();
    
    inventory.forEach((item, index) => {
      if (item) {
        const amountStored = structure.store(item.type, item.quantity);
        if (amountStored > 0) {
          agent.removeFromInventory(item.type, amountStored);
          console.log(`[Flush] Deposited ${amountStored} ${item.type} in structure`);
        }
      }
    });
  }
}