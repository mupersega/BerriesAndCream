import { TileType } from '../types/TileType';
import { StructureType } from '../types/StructureType';
import { Point } from '../types/Point';

export function findSuitableBuildingLocation(map: TileType[][], structureType: StructureType): Point | null {
    // Define suitable tile types for each structure type
    const suitableTiles: Record<StructureType, TileType[]> = {
        [StructureType.Farm]: [TileType.Grass, TileType.Dirt],
        [StructureType.Warehouse]: [TileType.Grass, TileType.Dirt, TileType.Stone],
        [StructureType.Smithy]: [TileType.Stone, TileType.Dirt],
        [StructureType.House]: [TileType.Grass, TileType.Dirt]
    };

    const suitable = suitableTiles[structureType];
    if (!suitable) return null;

    // Get map dimensions
    const height = map.length;
    const width = map[0]?.length || 0;
    if (width === 0 || height === 0) return null;

    // Try random locations up to 50 times
    for (let attempts = 0; attempts < 50; attempts++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);

        // Check if the tile type is suitable
        if (suitable.includes(map[y][x])) {
            // Check surrounding tiles (3x3 area) to ensure there's enough space
            let hasSpace = true;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const checkX = x + dx;
                    const checkY = y + dy;

                    // Check if position is within bounds and not water
                    if (
                        checkX < 0 || checkX >= width ||
                        checkY < 0 || checkY >= height ||
                        map[checkY][checkX] === TileType.Water ||
                        map[checkY][checkX] === TileType.DeepWater
                    ) {
                        hasSpace = false;
                        break;
                    }
                }
                if (!hasSpace) break;
            }

            if (hasSpace) {
                return { x, y };
            }
        }
    }

    return null;
}
