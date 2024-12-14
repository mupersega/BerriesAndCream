import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Resource, ResourceType } from '../Resource';

export class DrinkBehavior implements AgentBehavior {
  private readonly DRINK_AMOUNT = 10;
  private readonly DRINK_DELAY = 60;  // 1 second at 60fps
  private drinkTimer: number = 0;
  private currentWell: Resource | null = null;
  
  constructor() {}

  update(agent: Agent): void {
    // Stop if we're hydrated (regardless of current drinking state)
    if (agent.isHydrated()) {
      this.currentWell = null;
      this.drinkTimer = 0;
      return;
    }

    // If we're currently drinking, continue
    if (this.currentWell && this.drinkTimer > 0) {
      if (agent.hasTarget()) {
        agent.clearTarget();
      }
      
      this.drinkTimer--;
      if (this.drinkTimer === 0) {
        // Only try to harvest if the well isn't depleted
        if (!this.currentWell.isDepleted()) {
          const harvested = this.currentWell.harvest(this.DRINK_AMOUNT);
          agent.addHydration(harvested);
        }
        
        // Stop if well is depleted or we're hydrated
        if (this.currentWell.isDepleted() || agent.isHydrated()) {
          this.currentWell = null;
        } else {
          this.drinkTimer = this.DRINK_DELAY;
        }
      }
      return;
    }

    // If we're near a well, start drinking
    if (!agent.hasTarget()) {
      const pos = agent.getPosition();
      const wellHere = agent.getKnownResources().find(r => {
        if (r.getType() !== ResourceType.Well || r.isDepleted()) return false;
        
        const distance = Math.hypot(
          r.getPosition().x - pos.x,
          r.getPosition().y - pos.y
        );
        
        return distance <= 0.5;
      });

      if (wellHere && !wellHere.isDepleted()) {
        this.currentWell = wellHere;
        this.drinkTimer = this.DRINK_DELAY;
        return;
      }
    }

    // If we don't have a target, find nearest well
    if (!agent.hasTarget()) {
      const nearestWell = this.findNearestWell(agent);
      if (nearestWell) {
        const wellPos = nearestWell.getPosition();
        agent.setTarget(wellPos.x, wellPos.y);
      }
    }
  }

  getName(): string {
    return 'Drink';
  }

  private findNearestWell(agent: Agent): Resource | null {
    const pos = agent.getPosition();
    let nearestWell: Resource | null = null;
    let shortestDistance = Infinity;

    for (const resource of agent.getKnownResources()) {
      if (resource.getType() !== ResourceType.Well || resource.isDepleted()) continue;

      const resourcePos = resource.getPosition();
      const distance = Math.hypot(
        resourcePos.x - pos.x,
        resourcePos.y - pos.y
      );

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestWell = resource;
      }
    }

    return nearestWell;
  }
} 