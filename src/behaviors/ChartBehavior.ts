import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Resource } from '../Resource';
import { Dijkstra } from '../pathfinding/Dijkstra';
import { TileType } from '../types/TileType';

export class ChartBehavior implements AgentBehavior {
  private readonly VISION_RANGE = 10;
  private readonly pathfinder = new Dijkstra();
  
  constructor(private resources: Resource[]) {}

  update(agent: Agent): void {
    const pos = agent.getPosition();
    
    this.exploreVisibleTiles(agent);
    this.scanForResources(agent);
    
    if (!agent.hasTarget() || agent.isStuck()) {
      const target = this.findNextTarget(agent);
      
      if (target) {
        const path = this.findPathToTarget(agent, target);
        
        if (path) {
          agent.setTargetWithPath(target, path);
        }
      } else {
        agent.pickNewRandomTarget();
      }
    }
  }

  private exploreVisibleTiles(agent: Agent): void {
    const pos = agent.getPosition();
    let newTilesExplored = 0;
    
    for (let dy = -this.VISION_RANGE; dy <= this.VISION_RANGE; dy++) {
      for (let dx = -this.VISION_RANGE; dx <= this.VISION_RANGE; dx++) {
        const x = Math.floor(pos.x + dx);
        const y = Math.floor(pos.y + dy);
        
        if (Math.hypot(dx, dy) <= this.VISION_RANGE) {
          if (!agent.hasExploredTile(x, y)) {
            newTilesExplored++;
          }
          agent.addExploredTile(x, y);
        }
      }
    }
    
    if (newTilesExplored > 0) {
    }
  }

  private scanForResources(agent: Agent): void {
    const pos = agent.getPosition();
    let newResourcesFound = 0;
    let resourcesRemoved = 0;
    
    for (const resource of this.resources) {
        if (resource.isDepleted()) {
            agent.removeKnownResource(resource);
            resourcesRemoved++;
            continue;
        }
        
        const resourcePos = resource.getPosition();
        const distance = Math.hypot(
            resourcePos.x - pos.x,
            resourcePos.y - pos.y
        );

        if (distance <= this.VISION_RANGE) {
            const knownResources = agent.getKnownResources();
            const isNewResource = !knownResources.some(known => 
                known.getPosition().x === resourcePos.x && 
                known.getPosition().y === resourcePos.y
            );
            
            if (isNewResource) {
                newResourcesFound++;
                agent.addKnownResource(resource);
            }
        }
    }
  }

  private findNextTarget(agent: Agent): {x: number, y: number} | null {
    const pos = agent.getPosition();
    const px = Math.floor(pos.x);
    const py = Math.floor(pos.y);
    const map = agent.getMap();
    
    const candidates: Array<{x: number, y: number, distance: number}> = [];
    const searchRange = this.VISION_RANGE * 3;
    
    const numPoints = 50;
    for (let i = 0; i < numPoints; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * searchRange;
        
        const dx = Math.floor(Math.cos(angle) * distance);
        const dy = Math.floor(Math.sin(angle) * distance);
        
        const tx = px + dx;
        const ty = py + dy;
        
        if (ty < 0 || ty >= map.length || tx < 0 || tx >= map[0].length) {
            continue;
        }

        if (this.isValidTarget(agent, tx, ty)) {
            candidates.push({ x: tx, y: ty, distance });
        }
    }
    
    if (candidates.length === 0) {
        return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    
    const numChoices = Math.min(3, candidates.length);
    const selectedIndex = Math.floor(Math.random() * numChoices);
    return candidates[selectedIndex];
  }

  private isValidTarget(agent: Agent, x: number, y: number): boolean {
    if (agent.hasExploredTile(x, y) || agent.isWater(x, y)) {
      return false;
    }
    
    const directions = [
      {x: 1, y: 0}, {x: -1, y: 0},
      {x: 0, y: 1}, {x: 0, y: -1},
      {x: 1, y: 1}, {x: -1, y: 1},
      {x: 1, y: -1}, {x: -1, y: -1}
    ];
    
    return directions.some(dir => {
      const nx = x + dir.x;
      const ny = y + dir.y;
      return !agent.isWater(nx, ny) && agent.hasExploredTile(nx, ny);
    });
  }

  private findPathToTarget(
    agent: Agent, 
    target: {x: number, y: number}
  ): {x: number, y: number}[] | null {
    const pos = agent.getPosition();
    const start = {
      x: Math.floor(pos.x),
      y: Math.floor(pos.y)
    };
    
    return this.pathfinder.findPath(
      start,
      target,
      (x, y) => {
        const tile = agent.getMap()[y][x];
        return tile !== TileType.Water && 
               tile !== TileType.DeepWater && 
               tile !== TileType.Stone && 
               tile !== TileType.Snow;
      },
      agent.getMap()[0].length,
      agent.getMap().length
    );
  }

  getName(): string {
    return 'Chart';
  }
} 