import { AgentBehavior } from './AgentBehavior';
import { BaseAgent } from '../agents/BaseAgent';
import { Point } from '../types/Point';
import { gameState } from '../state/GameState';
import { FollowBehavior } from './FollowBehavior';

export class FetchBehavior implements AgentBehavior {
  private readonly FETCH_RANGE = 100; // Range to search for creatures
  private readonly CAPTURE_RANGE = 2; // Minimum range needed to establish leadership
  private readonly LEAD_RANGE = 1; // Max Range at which leader will go ahead
  private target: BaseAgent | null = null;
  private follower: BaseAgent | null = null;
  private HQ_POSITION: Point | null = null; // Replace with actual HQ position

  update(agent: BaseAgent): void {
    const agentPos = agent.getPosition();
    // console.log(`[Fetch] Agent ${agent.getId()} at (${agentPos.x.toFixed(2)}, ${agentPos.y.toFixed(2)})`);

    if (!this.follower) {
      // When searching for or approaching target, use normal speed
      agent.setVelocityMultiplier(1);
      
      if (!this.target) {
        this.target = this.findNearestCreature(agent);
        // console.log(`[Fetch] Finding new target: ${this.target?.getId() || 'none found'}`);
      }

      if (this.target) {
        const targetPos = this.target.getPosition();
        const distance = Math.hypot(targetPos.x - agentPos.x, targetPos.y - agentPos.y);

        if (distance <= this.CAPTURE_RANGE) {
          console.log(`[Fetch] Attempting to establish leadership with ${this.target.getId()}`);
          // Establish leadership
          this.follower = this.target;
          this.target = null;
          
          // Save current behavior first
          this.follower.setLastBehavior(this.follower.getBehavior());
          console.log(`[Fetch] Saved follower's current behavior: ${this.follower.getLastBehavior()}`);
          
          // Get the behavior manager and set up the follow behavior
          const behaviorManager = this.follower.getBehaviorManager();
          const followBehavior = behaviorManager.getBehaviorByName('Follow') as FollowBehavior;
          followBehavior.setLeader(agent);
          console.log(`[Fetch] Set leader ${agent.getId()} for follower's FollowBehavior`);
          
          // Now set the behavior
          this.follower.setBehavior('Follow');
          console.log(`[Fetch] Set follower's behavior to Follow`);
          
          // Set new target to HQ
          this.HQ_POSITION = gameState.getHQPosition();
          if (this.HQ_POSITION) {
            agent.setTarget(this.HQ_POSITION.x, this.HQ_POSITION.y);
            agent.setBounceSpeed(0.08);
            console.log(`[Fetch] Set fetcher target to HQ: (${this.HQ_POSITION.x}, ${this.HQ_POSITION.y})`);
          }
        } else if (!agent.hasTarget()) {
          // Set target to creature position
          agent.setTarget(targetPos.x, targetPos.y);
        //   console.log(`[Fetch] Setting target to ${this.target?.getId()}`);
        }
      }
    } else {
      const followerPos = this.follower.getPosition();
      const followerDistance = Math.hypot(
        followerPos.x - agentPos.x,
        followerPos.y - agentPos.y
      );

        // Calculate speed multiplier based on distance to follower
        if (followerDistance <= this.CAPTURE_RANGE) {
            agent.setVelocityMultiplier(1); // Full speed within lead range
        } else {
            // Scale multiplier based on distance, capped at 1
            const distanceBeyondLead = followerDistance - this.LEAD_RANGE;
            const multiplier = Math.max(1 - distanceBeyondLead / this.LEAD_RANGE, 0.1);
            agent.setVelocityMultiplier(multiplier);
        }

      // If we don't have a target, set it to HQ
      if (!agent.hasTarget()) {
        if (this.HQ_POSITION) {
          agent.setTarget(this.HQ_POSITION.x, this.HQ_POSITION.y);
        }
      }

      // If follower is lost or we reach HQ, reset
      if (this.HQ_POSITION) {
        const distanceToHQ = Math.hypot(
          this.HQ_POSITION.x - agentPos.x,
          this.HQ_POSITION.y - agentPos.y
        );
    //   console.log(`[Fetch] Distance to HQ: ${distanceToHQ.toFixed(2)}`);

      if (followerDistance > this.FETCH_RANGE || distanceToHQ < 1) {
        //   console.log(`[Fetch] Reset - ${followerDistance > this.FETCH_RANGE ? 'Follower lost' : 'Reached HQ'}`);
          this.follower = null;
          this.target = null;
          agent.clearTarget();
        }
      }
    }
  }

  private findNearestCreature(agent: BaseAgent): BaseAgent | null {
    const fetchableTiles = gameState.getFetchableTiles();
    // console.log(`[Fetch] Searching ${fetchableTiles.length} fetchable tiles`);
    
    const creatures = gameState.getAgents().filter(agent => {
      const creaturePos = agent.getPosition();
      console.log(agent.getAgentType());
      return fetchableTiles.some(tile =>
        Math.floor(creaturePos.x) === tile.x && 
        Math.floor(creaturePos.y) === tile.y
      ) && agent.getAgentType() === 'Cow';
    });
    // console.log(`[Fetch] Found ${creatures.length} potential creatures`);

    let nearest: BaseAgent | null = null;
    let shortestDistance = Infinity;

    for (const creature of creatures) {
      const creaturePos = creature.getPosition();
      const distance = Math.hypot(
        creaturePos.x - agent.getPosition().x,
        creaturePos.y - agent.getPosition().y
      );

      if (distance < shortestDistance && distance <= this.FETCH_RANGE) {
        shortestDistance = distance;
        nearest = creature;
      }
    }

    // console.log(`[Fetch] Nearest creature: ${nearest?.getId() || 'none found'}`);
    return nearest;
  }

  getName(): string {
    return 'Fetch';
  }
} 