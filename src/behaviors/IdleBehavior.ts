import { AgentBehavior } from './AgentBehavior';
import { Agent } from '../Agent';

export class IdleBehavior implements AgentBehavior {
    public update(agent: Agent): void {
        // Do nothing - agent stays still
        agent.clearTarget();
    }

    public getName(): string {
        return 'Idle';
    }
} 