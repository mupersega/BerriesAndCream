import { BehaviorEntity } from './BehaviourEntity';
import { BaseAgent } from '../agents/BaseAgent';
import { AgentBehavior } from './AgentBehavior';
import { ForageBehavior } from './ForageBehavior';

import { IdleBehavior } from './IdleBehavior';
import { FellBehavior } from './FellBehavior';
import { FlushBehavior } from './FlushBehavior';
import { FetchBehavior } from './FetchBehavior';

import { GrazeBehavior } from './GrazeBehavior';
import { WanderBehavior } from './WanderBehavior';
import { FollowBehavior } from './FollowBehavior';

export class BehaviorManager {
  private forageBehavior: ForageBehavior;
  private fetchBehavior: FetchBehavior;
  private followBehavior: FollowBehavior;
  private idleBehavior: IdleBehavior;
  private fellBehavior: FellBehavior;
  private flushBehavior: FlushBehavior;
  private grazeBehavior: GrazeBehavior;
  private wanderBehavior: WanderBehavior;
  private currentBehavior: AgentBehavior | null = null;
  private selectedBehavior: string = 'Idle';
  private allowedBehaviors: string[];
  private lastBehavior: string = 'Idle'; 

  constructor(
    allowedBehaviors: string[] = ['Idle']
  ) {
    this.allowedBehaviors = allowedBehaviors;
    this.fetchBehavior = new FetchBehavior();
    this.forageBehavior = new ForageBehavior();
    this.idleBehavior = new IdleBehavior();
    this.fellBehavior = new FellBehavior();
    this.flushBehavior = new FlushBehavior();
    this.grazeBehavior = new GrazeBehavior();
    this.wanderBehavior = new WanderBehavior();
    this.followBehavior = new FollowBehavior();

    // Set initial behavior to first allowed behavior
    if (allowedBehaviors.length > 0) {
      this.selectedBehavior = allowedBehaviors[0];
    }
  }

  public setBehavior(behaviorName: string): void {
    if (!this.allowedBehaviors.includes(behaviorName)) {
      console.warn('[BehaviorManager] Attempted to set unauthorized behavior:', behaviorName);
      return;
    }

    console.log('[BehaviorManager] Setting behavior:', {
      from: this.selectedBehavior,
      to: behaviorName 
    });
    this.selectedBehavior = behaviorName;

    this.currentBehavior = null;
  }

  public getLastBehavior(): string {
    return this.lastBehavior;
  }

  public setLastBehavior(behaviorName: string): void {
    this.lastBehavior = behaviorName;
  }

  // Add getter for allowed behaviors
  public getAllowedBehaviors(): string[] {
    return [...this.allowedBehaviors];
  }

  public update(entity: BehaviorEntity): void {
    const newBehavior = this.getBehaviorByName(this.selectedBehavior);
    
    if (newBehavior !== this.currentBehavior) {
      console.log('[BehaviorManager] Switching to behavior:', 
        this.selectedBehavior);
      this.currentBehavior = newBehavior;
      if ('clearTarget' in entity) {
        entity.clearTarget();
      }
    }

    this.currentBehavior.update(entity as BaseAgent);
  }

  public getBehaviorByName(name: string): AgentBehavior {
    switch (name) {
      case 'Forage':
        return this.forageBehavior;
      case 'Fell':
        return this.fellBehavior;
      case 'Flush':
        return this.flushBehavior;
      case 'Graze':
        return this.grazeBehavior;
      case 'Wander':
        return this.wanderBehavior;
      case 'Fetch':
        return this.fetchBehavior;
      case 'Follow':
        return this.followBehavior;
      case 'Idle':
        return this.idleBehavior;
      default:
        return this.idleBehavior;
    }
  }

  public getCurrentBehavior(): AgentBehavior | null {
    return this.currentBehavior;
  }
} 