import { AgentBehavior } from './AgentBehavior';
import { BaseAgent } from '../agents/BaseAgent';

export class IdleBehavior implements AgentBehavior {
    public update(agent: BaseAgent): void {
        // Do nothing - agent stays still
        agent.clearTarget();
    }

    public getName(): string {
        return 'Idle';
    }
} 