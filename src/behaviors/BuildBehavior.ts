import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';
import { Structure } from '../Structure';
import { StructureType } from '../types/StructureType';

export class BuildBehavior implements AgentBehavior {
  private targetStructure: Structure | null = null;

  public update(agent: Agent): void {
    if (!this.targetStructure) {
      // Find incomplete structure
      this.targetStructure = window.gameState.structures.find(
        s => !s.isComplete()
      ) || null;
    }

    if (this.targetStructure) {
      const structurePos = this.targetStructure.getPosition();
      const agentPos = agent.getPosition();
      
      // If close enough, contribute to construction
      if (Math.abs(structurePos.x - agentPos.x) <= 1 &&
          Math.abs(structurePos.y - agentPos.y) <= 1) {
        this.targetStructure.addConstructionProgress(0.5);
        if (this.targetStructure.isComplete()) {
          this.targetStructure = null;
        }
      } else {
        // Move towards structure
        agent.setTarget(structurePos.x, structurePos.y);
      }
    }
  }
}
