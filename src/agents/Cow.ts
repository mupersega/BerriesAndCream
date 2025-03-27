import { BaseAgent } from './BaseAgent';
import { TileType } from '../types/TileType';

export class Cow extends BaseAgent {
    protected readonly MOVE_SPEED: number = 0.0005;
    protected readonly MAX_SPEED: number = 0.005;

    private grazingAnimationTimer: number = 0;
    private readonly GRAZING_ANIMATION_INTERVAL: number = 2000; // Switch every 2 seconds

    constructor(map: TileType[][], startX?: number, startY?: number) {
        super(map, startX, startY, ['Wander', 'Graze', 'Follow'], 'Cow');
        
        // Set cow-specific bounce properties
        this.setBounceHeight(2);
        this.setBounceSpeed(0.06);
        this.setBounceSquash(0.00);
        
        this.setBehavior('Wander');
    }

    protected getSpritesheetPosition(): { x: number, y: number } {
        const isGrazing = this.getBehavior() === 'Graze';
        const showGrazingAnimation = isGrazing && Math.floor(this.grazingAnimationTimer / this.GRAZING_ANIMATION_INTERVAL) % 2 === 0;
        
        return {
            x: this.facingLeft ? 0 : 32,
            y: 128 - (showGrazingAnimation ? 32 : 0)
        };
    }

    protected getSpriteSize(): { width: number, height: number } {
        return {
            width: 32,
            height: 32
        };
    }
} 