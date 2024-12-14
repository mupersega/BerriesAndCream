import { Point } from '../types/Point';
import { TileType } from '../types/TileType';

export interface BehaviorEntity {
  clearTarget(): void;
  setTarget(x: number, y: number): void;
  getPosition(): Point;
  getMap(): TileType[][];
}
