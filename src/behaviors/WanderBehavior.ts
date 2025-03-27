import { AgentBehavior } from './AgentBehavior';
import { BaseAgent } from '../agents/BaseAgent';
import { TileType } from '../types/TileType';

export class WanderBehavior implements AgentBehavior {
  private readonly BASE_WAIT_DURATION = 60;   // 1 second at 60fps
  private readonly WAIT_VARIANCE = 60;        // ±1 second variance
  private waitTimer: number = 0;
  
  update(agent: BaseAgent): void {
    // If we're waiting, continue until timer runs out
    if (this.waitTimer > 0) {
      this.waitTimer--;
      if (this.waitTimer === 0) {
        // Higher chance to switch to grazing (40-70% chance)
        if (Math.random() < 0.4 + (Math.random() * 0.3)) {
          agent.setBehavior('Graze');
          return;
        }
      } else {
        return;
      }
    }

    // If we've reached our target or don't have one, pick a new one
    if (!agent.hasTarget()) {
      const pos = agent.getPosition();
      let attempts = 0;
      const maxAttempts = 20;
      const maxDistance = 8;
      
      while (attempts < maxAttempts) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 2 + (Math.random() * maxDistance); // Minimum distance of 2
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

      // Start waiting timer when we pick a new target
      this.waitTimer = this.BASE_WAIT_DURATION + Math.floor(Math.random() * this.WAIT_VARIANCE * 2) - this.WAIT_VARIANCE;
    }
  }

  getName(): string {
    return 'Wander';
  }
}
