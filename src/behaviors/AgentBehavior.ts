import { Agent } from "../Agent";

export interface AgentBehavior {
  update(agent: Agent): void;
  getName(): string;
} 