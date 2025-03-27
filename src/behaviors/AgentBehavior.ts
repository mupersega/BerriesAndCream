import { Agent } from "../agents/BaseAgent";

export interface AgentBehavior {
  update(agent: Agent): void;
  getName(): string;
} 