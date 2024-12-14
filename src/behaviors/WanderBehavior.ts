import { CreatureBehavior } from './CreatureBehavior';
import { Creature } from '../creatures/Creature';

export class WanderBehavior implements CreatureBehavior {
    private readonly WANDER_INTERVAL = 300;
    private timer: number = 0;

    public update(creature: Creature): void {
        this.timer++;
        if (this.timer >= this.WANDER_INTERVAL) {
            this.timer = 0;
            // Pick a new random destination
        }
    }

    public getName(): string {
        return 'Wander';
    }
}
