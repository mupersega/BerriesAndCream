import { BaseAgent } from './BaseAgent';
import { TileType } from '../types/TileType';

export class LittleLad extends BaseAgent {
    protected readonly MOVE_SPEED: number = 0.002;
    protected readonly MAX_SPEED: number = 0.04;

    constructor(map: TileType[][], startX?: number, startY?: number) {
        super(map, startX, startY, ['Forage', 'Fell', 'Flush', 'Fetch', 'Idle'], 'LittleLad');
        
        // Set LittleLad-specific bounce properties
        this.setBounceHeight(3);
        this.setBounceSpeed(0.15);
        this.setBounceSquash(0.0);
    }

    protected getSpritesheetPosition(): { x: number, y: number } {
        return { x: this.facingLeft ? 64 : 96, y: 160 };
    }

    protected getSpriteSize(): { width: number, height: number } {
        return { width: 32, height: 32 };
    }
}
