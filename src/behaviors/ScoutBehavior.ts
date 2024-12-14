import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Resource, ResourceType } from '../Resource';

export class ScoutBehavior implements AgentBehavior {
  private readonly VISION_RANGE = 3;
  private readonly WATER_SEARCH_THRESHOLD = 40;
  private needsWater: boolean = false;
  
  constructor(private resources: Resource[]) {}

  update(agent: Agent): void {
    const pos = agent.getPosition();
    this.needsWater = agent.getHydration() < this.WATER_SEARCH_THRESHOLD && 
                      !agent.getKnownResources().some(r => r.getType() === ResourceType.Well);
    
    // Mark current tile as explored in agent's memory
    agent.addExploredTile(pos.x, pos.y);
    
    // Look for resources in vision range
    this.scanForResources(agent);
    
    // Pick new target if we don't have one
    if (!agent.hasTarget()) {
      const target = this.findUnexploredTarget(agent);
      if (target) {
        agent.setTarget(target.x, target.y);
      }
    }
  }

  private scanForResources(agent: Agent): void {
    const pos = agent.getPosition();
    
    // Clean up depleted resources from agent's knowledge
    const knownResources = agent.getKnownResources();
    for (const resource of knownResources) {
      if (resource.isDepleted()) {
        agent.removeKnownResource(resource);
      }
    }

    // Scan for new resources
    for (const resource of this.resources) {
      if (resource.isDepleted()) continue;

      const resourcePos = resource.getPosition();
      const distance = Math.hypot(
        resourcePos.x - pos.x,
        resourcePos.y - pos.y
      );

      // If resource is within vision range, agent remembers it
      if (distance <= this.VISION_RANGE) {
        agent.addKnownResource(resource);
      }
    }
  }

  private findUnexploredTarget(agent: Agent): {x: number, y: number} | null {
    const map = agent.getMap();
    const pos = agent.getPosition();
    const radius = 10;
    
    if (this.needsWater) {
      // First try to find any visible wells
      const nearbyWell = this.resources.find(r => {
        if (r.getType() !== ResourceType.Well || r.isDepleted()) return false;
        const resourcePos = r.getPosition();
        const distance = Math.hypot(resourcePos.x - pos.x, resourcePos.y - pos.y);
        return distance <= radius;
      });

      if (nearbyWell) {
        const wellPos = nearbyWell.getPosition();
        return { x: wellPos.x, y: wellPos.y };
      }
    }

    // Try to find unexplored tiles, with increased attempts when searching for water
    const maxAttempts = this.needsWater ? 40 : 20;
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const tx = Math.floor(pos.x + Math.cos(angle) * distance);
      const ty = Math.floor(pos.y + Math.sin(angle) * distance);
      
      if (tx >= 0 && tx < map[0].length &&
          ty >= 0 && ty < map.length &&
          !agent.hasExploredTile(tx, ty)) {
        return {x: tx, y: ty};
      }
    }

    // If no unexplored tiles found, pick a random valid position
    // Double the attempts when searching for water
    const fallbackAttempts = this.needsWater ? 20 : 10;
    for (let attempts = 0; attempts < fallbackAttempts; attempts++) {
      const tx = Math.floor(Math.random() * map[0].length);
      const ty = Math.floor(Math.random() * map.length);
      
      if (!agent.isWater(tx, ty)) {
        return {x: tx, y: ty};
      }
    }

    return null;
  }

  getName(): string {
    return this.needsWater ? 'Scout (Water Search)' : 'Scout';
  }
} 