import { BaseAgent } from "../agents/BaseAgent";

export interface AgentBehavior {
  update(agent: BaseAgent): void;
  getName(): string;
} 