import { CreatureBehavior } from './CreatureBehavior';
import { Creature } from '../creatures/Creature';

export class GrazeBehavior implements CreatureBehavior {
    public update(creature: Creature): void {
        // Implement grazing behavior
        // For example: stay in one place for a while, then move to a new grass tile
    }

    public getName(): string {
        return 'Graze';
    }
}
