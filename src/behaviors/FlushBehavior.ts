import { AgentBehavior } from './AgentBehavior';
import { Structure } from '../Structure';
import { ItemType } from '../types/ItemType';
import { ResourceCount } from '../types/ResourceType';
import { gameState } from '../state/GameState';
import { BaseAgent } from '../agents/BaseAgent';

export class FlushBehavior implements AgentBehavior {
  private readonly DEPOSIT_DELAY = 30;
  private depositTimer: number = 0;
  private currentStructure: Structure | null = null;

  getName(): string {
    return 'Flush';
  }

  update(agent: BaseAgent): void {

    // If inventory is empty, switch back to previous behavior
    if (agent.getInventory().every((item) => item === null)) {
      agent.setBehavior(agent.getLastBehavior());
      return;
    }

    // If we're currently depositing items
    if (this.currentStructure && this.depositTimer > 0) {
      agent.clearTarget();
      this.depositTimer--;

      if (this.depositTimer === 0) {
        this.depositItems(agent);
        
        // Check if we still have items to deposit
        if (agent.getInventory().every(item => item === null)) {
          this.currentStructure = null;
          agent.setBehavior('Explore');
        } else {
          this.depositTimer = this.DEPOSIT_DELAY;
        }
      }
      return;
    }

    // If we're near a structure, start depositing
    if (!agent.hasTarget()) {
      const pos = agent.getPosition();
      const nearbyStructure = this.findNearestStructure(agent);
      
      if (nearbyStructure) {
        const distance = Math.hypot(
          nearbyStructure.getPosition().x - pos.x,
          nearbyStructure.getPosition().y - pos.y
        );
        
        if (distance <= 1) {
          this.currentStructure = nearbyStructure;
          this.depositTimer = this.DEPOSIT_DELAY;
          return;
        }
      }
    }

    // If we don't have a target, find nearest structure
    if (!agent.hasTarget()) {
      const nearestStructure = this.findNearestStructure(agent);
      if (nearestStructure) {
        const structurePos = nearestStructure.getPosition();
        agent.setTarget(structurePos.x, structurePos.y);
      }
    }
  }

  private findNearestStructure(agent: BaseAgent): Structure | null {
    const pos = agent.getPosition();
    let nearestStructure: Structure | null = null;
    let shortestDistance = Infinity;

    const structures = window.gameState.getStructures();

    for (const structure of structures) {
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

  private depositItems(agent: BaseAgent): void {

    const inventory = agent.getInventory();
    
    inventory.forEach((item) => {
      if (item) {
        
        // Directly add to gameState resource pool
        switch (item.type) {
          case ItemType.Berry:
            gameState.addToResourceCount(ResourceCount.Berries, item.quantity);
            break;
          case ItemType.Wood:
            gameState.addToResourceCount(ResourceCount.Wood, item.quantity);
            break;
          case ItemType.Cream:
            gameState.addToResourceCount(ResourceCount.Cream, item.quantity);
            break;
          case ItemType.Stone:
            gameState.addToResourceCount(ResourceCount.Stone, item.quantity);
            break;
        }
        
        // Clear the inventory slot
        agent.removeFromInventory(item.type, item.quantity);
      }
    });
  }
}