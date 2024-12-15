import { Point } from '../types/Point';
import { GameState } from '../state/GameState';

export function getTilesInRadius(
  center: Point,
  radius: number,
  gameState: GameState
): Point[] {
  const tiles: Point[] = [];
  
  // Loop through the square that contains our circle
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      // Use a smoother approximation
      // This averages between Manhattan and Euclidean distance
      const distance = (Math.abs(dx) + Math.abs(dy) + Math.sqrt(dx * dx + dy * dy)) / 3;
      
      // If the point is within our radius and map bounds
      if (distance <= radius) {
        const newX = center.x + dx;
        const newY = center.y + dy;
        
        if (newX >= 0 && newX < gameState.getMapWidth() &&
            newY >= 0 && newY < gameState.getMapHeight()) {
          tiles.push({ x: newX, y: newY });
        }
      }
    }
  }
  
  return tiles;
}
