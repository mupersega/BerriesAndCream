import { TileType } from '../types/TileType';
import { BehaviorManager } from '../behaviors/BehaviorManager';
import { Point } from '../types/Point';
import { CreatureType } from '../types/CreatureType';
import { BehaviorEntity } from '../behaviors/BehaviourEntity';

export class Creature implements BehaviorEntity {
    protected x: number;
    protected y: number;
    protected map: TileType[][];
    protected health: number;
    protected maxHealth: number;
    protected behaviorManager: BehaviorManager;
    protected type: CreatureType;
    
    protected target: Point | null = null;
    protected currentPath: Point[] = [];
    protected facingLeft: boolean = false;
    protected isDead: boolean = false;
    protected isMoving: boolean = false;
    
    // Animation properties
    protected animationTime: number = 0;
    protected readonly BOUNCE_SPEED = 0.1;
    protected readonly BOUNCE_HEIGHT = 2;

    constructor(map: TileType[][], type: CreatureType, startX?: number, startY?: number) {
        this.map = map;
        this.type = type;
        
        if (startX === undefined || startY === undefined) {
            do {
                this.x = Math.floor(Math.random() * map[0].length);
                this.y = Math.floor(Math.random() * map.length);
            } while (this.isWater(this.x, this.y));
        } else {
            this.x = startX;
            this.y = startY;
        }

        this.maxHealth = 50;
        this.health = this.maxHealth;
        this.behaviorManager = new BehaviorManager([], 'creature');
    }

    public update(): void {
        if (this.isDead) return;
        this.behaviorManager.update(this);
    }

    public draw(ctx: CanvasRenderingContext2D, x: number, y: number): void {
        const spritesheet = window.gameState.getSpritesheet();
        
        // Update animation for bouncing effect
        if (this.isMoving) {
            this.animationTime = (this.animationTime + this.BOUNCE_SPEED) % (Math.PI * 2);
        } else {
            this.animationTime = Math.max(0, this.animationTime - this.BOUNCE_SPEED);
        }
        
        const bounceOffset = this.isMoving ? 
            (1 - Math.cos(this.animationTime)) * this.BOUNCE_HEIGHT * 0.5 : 0;

        // Draw shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
            x + 6,
            y + 5,
            8,
            4,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        if (spritesheet?.complete) {
            // Cow sprite coordinates in spritesheet
            const sprite = {
                x: this.facingLeft ? 0 : 32, // Adjust these coordinates based on your spritesheet
                y: 128,                      // Adjust these coordinates based on your spritesheet
                width: 32,
                height: 32
            };

            ctx.drawImage(
                spritesheet,
                sprite.x,
                sprite.y,
                sprite.width,
                sprite.height,
                x - sprite.width/2,
                y - sprite.height + (16/2) - bounceOffset, // 16 is tileHeight
                sprite.width,
                sprite.height
            );
        } else {
            // Fallback rectangle if spritesheet isn't loaded
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(x - 16, y - 32, 32, 32);
        }
    }

    protected isWater(x: number, y: number): boolean {
        const ix = Math.round(x);
        const iy = Math.round(y);
        
        if (iy < 0 || iy >= this.map.length || 
            ix < 0 || ix >= this.map[0].length) {
            return true;
        }
        
        const tile = this.map[iy][ix];
        return tile === TileType.Water || tile === TileType.DeepWater;
    }

    public getPosition(): Point {
        return { x: this.x, y: this.y };
    }

    public clearTarget(): void {
        this.target = null;
        this.currentPath = [];
    }

    public setTarget(x: number, y: number): void {
        this.target = { x, y };
        // Implement path finding if needed
    }
}
