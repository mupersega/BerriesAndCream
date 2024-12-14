import { Creature } from './Creature';
import { TileType } from '../types/TileType';
import { CreatureType } from '../types/CreatureType';

export class Cow extends Creature {
    private readonly GRAZING_DURATION = 180; // 3 seconds at 60fps
    private grazingTime: number = 0;

    constructor(map: TileType[][], startX?: number, startY?: number) {
        super(map, CreatureType.Cow, startX, startY);
    }

    public update(): void {
        super.update();
        
        if (this.grazingTime > 0) {
            this.grazingTime--;
            // Handle grazing behavior
        }
    }

    public graze(): void {
        this.grazingTime = this.GRAZING_DURATION;
        // Add grazing-specific logic
    }
}
