import { AgentBehavior } from './AgentBehavior';
import { BaseAgent } from '../agents/BaseAgent';

export class FollowBehavior implements AgentBehavior {
  private readonly FOLLOW_RANGE = 50; // Maximum distance before losing leader
  private readonly UPDATE_THRESHOLD = 2; // Only update path when leader moves this far
  private readonly MIN_DISTANCE = 1; // Minimum distance to keep from leader
  private leader: BaseAgent | null = null;
  private lastLeaderPos: { x: number, y: number } | null = null;

  public setLeader(leader: BaseAgent): void {
    console.log(`[FollowBehavior] Setting leader to ${leader.getId()}`);
    this.leader = leader;
    this.lastLeaderPos = leader.getPosition();
  }

  public getLeader(): BaseAgent | null {
    return this.leader;
  }

  update(agent: BaseAgent): void {
    if (!this.leader || !this.lastLeaderPos) {
      console.log(`[FollowBehavior] No leader set, reverting to previous behavior`);
      agent.setBehavior(agent.getLastBehavior());
      return;
    }

    const agentPos = agent.getPosition();
    const leaderPos = this.leader.getPosition();
    const distance = Math.hypot(
      leaderPos.x - agentPos.x,
      leaderPos.y - agentPos.y
    );

    // Check if leader has moved significantly
    const leaderMovement = Math.hypot(
      leaderPos.x - this.lastLeaderPos.x,
      leaderPos.y - this.lastLeaderPos.y
    );

    console.log(`[FollowBehavior] Status:`, {
      distance: distance.toFixed(2),
      leaderMovement: leaderMovement.toFixed(2),
      hasTarget: agent.hasTarget(),
      hasPath: agent.hasPath(),
      agentPos: `(${agentPos.x.toFixed(2)}, ${agentPos.y.toFixed(2)})`,
      leaderPos: `(${leaderPos.x.toFixed(2)}, ${leaderPos.y.toFixed(2)})`
    });

    if (distance > this.FOLLOW_RANGE) {
      console.log(`[FollowBehavior] Lost leader - too far away (${distance.toFixed(2)} > ${this.FOLLOW_RANGE})`);
      this.leader = null;
      this.lastLeaderPos = null;
      agent.setBehavior(agent.getLastBehavior());
      return;
    }

    // Only update path if:
    // 1. We don't have a current target/path OR
    // 2. Leader has moved significantly AND we're not too close
    if (!agent.hasTarget() || (leaderMovement > this.UPDATE_THRESHOLD && distance > this.MIN_DISTANCE)) {
      console.log(`[FollowBehavior] Updating path to leader`);
      agent.setTarget(leaderPos.x, leaderPos.y);
      this.lastLeaderPos = { ...leaderPos };
    }
  }

  getName(): string {
    return 'Follow';
  }
} 