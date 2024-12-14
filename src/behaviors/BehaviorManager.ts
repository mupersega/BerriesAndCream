import { BehaviorEntity } from './BehaviorEntity';
import { Agent } from '../Agent';
import { AgentBehavior } from './AgentBehavior';
import { ForageBehavior } from './ForageBehavior';
import { ChartBehavior } from './ChartBehavior';
import { IdleBehavior } from './IdleBehavior';
import { FellBehavior } from './FellBehavior';
import { BuildBehavior } from './BuildBehavior';
import { FlushBehavior } from './FlushBehavior';

import { Resource } from '../Resource';

export class BehaviorManager {
  private forageBehavior: ForageBehavior;
  private chartBehavior: ChartBehavior;
  private idleBehavior: IdleBehavior;
  private fellBehavior: FellBehavior;
  private buildBehavior: BuildBehavior;
  private flushBehavior: FlushBehavior;
  private currentBehavior: AgentBehavior | null = null;
  private selectedBehavior: string = 'Idle';
  private entityType: 'agent' | 'creature';

  constructor(resources: Resource[], entityType: 'agent' | 'creature' = 'agent') {
    this.entityType = entityType;
    this.forageBehavior = new ForageBehavior();
    this.chartBehavior = new ChartBehavior(resources);
    this.idleBehavior = new IdleBehavior();
    this.fellBehavior = new FellBehavior();
    this.buildBehavior = new BuildBehavior();
    this.flushBehavior = new FlushBehavior();
  }

  public setBehavior(behaviorName: string): void {
    console.log('[BehaviorManager] Setting behavior:', {
      from: this.selectedBehavior,
      to: behaviorName
    });
    this.selectedBehavior = behaviorName;
    this.currentBehavior = null;
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

    if (this.currentBehavior) {
      if (this.entityType === 'creature' && this.currentBehavior instanceof IdleBehavior) {
        this.currentBehavior.update(entity);
      } else if (this.entityType === 'agent') {
        this.currentBehavior.update(entity as Agent);
      }
    }
  }

  private getBehaviorByName(name: string): AgentBehavior {
    switch (name) {
      case 'Forage':
        return this.forageBehavior;
      case 'Explore':
        return this.chartBehavior;
      case 'Fell':
        return this.fellBehavior;
      case 'Idle':
      case 'Build':
      case 'Flush':
      default:
        return this.idleBehavior;
    }
  }

  public getCurrentBehavior(): AgentBehavior | null {
    return this.currentBehavior;
  }
} 