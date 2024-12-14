import { Creature } from '../creatures/Creature';

export interface CreatureBehavior {
    update(creature: Creature): void;
    getName(): string;
}
