import { AgentBehavior } from './AgentBehavior';
import { BaseAgent } from '../agents/BaseAgent';
import { TileType } from '../types/TileType';

export class GrazeBehavior implements AgentBehavior {
  private readonly BASE_GRAZE_DURATION = 300;  // 5 seconds at 60fps
  private readonly GRAZE_VARIANCE = 240;       // ±4 seconds variance
  private grazeTimer: number = 0;
  
  update(agent: BaseAgent): void {
    // If we're currently grazing, continue until timer runs out
    if (this.grazeTimer > 0) {
      this.grazeTimer--;
      if (this.grazeTimer === 0) {
        // When done grazing, switch to wandering
        agent.setBehavior('Wander');
      }
      return;
    }

    // Check if we're on a valid grazing tile
    const currentTile = agent.getCurrentTile();
    if (currentTile === TileType.Grass || currentTile === TileType.Highlands) {
      // Start grazing with random duration
      this.grazeTimer = this.BASE_GRAZE_DURATION + 
        Math.floor(Math.random() * this.GRAZE_VARIANCE * 2) - this.GRAZE_VARIANCE;
      agent.clearTarget();
      return;
    }

    // If not on grass/highlands, find a valid grazing spot
    if (!agent.hasTarget()) {
      // Try to find a valid grazing position within reasonable distance
      let attempts = 0;
      const maxAttempts = 20;
      const maxDistance = 10;
      const pos = agent.getPosition();
      
      while (attempts < maxAttempts) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * maxDistance;
        const tx = Math.floor(pos.x + Math.cos(angle) * distance);
        const ty = Math.floor(pos.y + Math.sin(angle) * distance);
        
        const map = agent.getMap();
        if (tx >= 0 && tx < map[0].length && 
            ty >= 0 && ty < map.length) {
          const tile = map[ty][tx];
          if (tile === TileType.Grass || tile === TileType.Highlands) {
            agent.setTarget(tx, ty);
            break;
          }
        }
        attempts++;
      }
    }
  }

  getName(): string {
    return 'Graze';
  }
}
