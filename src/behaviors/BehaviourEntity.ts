import { Point } from '../main';

export interface BehaviorEntity {
  clearTarget(): void;
  setTarget(x: number, y: number): void;
  getPosition(): Point;
  getMap(): TileType[][];
}
