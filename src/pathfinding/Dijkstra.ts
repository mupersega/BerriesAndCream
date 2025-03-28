type Point = {
  x: number;
  y: number;
};

type Node = {
  position: Point;
  cost: number;
  parent: Node | null;
  isExplored: boolean;
  isInOpenSet: boolean;
  isInPath: boolean;
};

export class Dijkstra {
  private readonly DIAGONAL_COST = Math.SQRT2;
  private readonly STRAIGHT_COST = 1.0;
  public isWalkable: ((x: number, y: number) => boolean) | null = null;
  private onVisualizationUpdate?: (nodes: Map<string, Node>) => void;

  private pointToKey(point: Point): string {
    return `${point.x},${point.y}`;
  }

  private isAtGoal(current: Point, goal: Point): boolean {
    return current.x === goal.x && current.y === goal.y;
  }

  private getLowestCostNode(openSet: Map<string, Node>): Node | null {
    let lowestCost = Infinity;
    let lowestNode: Node | null = null;

    openSet.forEach(node => {
      if (node.cost < lowestCost) {
        lowestCost = node.cost;
        lowestNode = node;
      }
    });

    return lowestNode;
  }

  private getNeighbors(node: Node, maxX: number, maxY: number): Node[] {
    const neighbors: Node[] = [];
    const directions = [
      { x: 0, y: -1, cost: this.STRAIGHT_COST },  // North
      { x: 1, y: -1, cost: this.DIAGONAL_COST },  // Northeast
      { x: 1, y: 0, cost: this.STRAIGHT_COST },   // East
      { x: 1, y: 1, cost: this.DIAGONAL_COST },   // Southeast
      { x: 0, y: 1, cost: this.STRAIGHT_COST },   // South
      { x: -1, y: 1, cost: this.DIAGONAL_COST },  // Southwest
      { x: -1, y: 0, cost: this.STRAIGHT_COST },  // West
      { x: -1, y: -1, cost: this.DIAGONAL_COST }, // Northwest
    ];

    for (const dir of directions) {
      const newX = node.position.x + dir.x;
      const newY = node.position.y + dir.y;

      // Skip if out of bounds
      if (newX < 0 || newX >= maxX || newY < 0 || newY >= maxY) continue;

      neighbors.push({
        position: { x: newX, y: newY },
        cost: dir.cost,
        parent: null,
        isExplored: false,
        isInOpenSet: false,
        isInPath: false
      });
    }

    return neighbors;
  }

  private reconstructPath(endNode: Node): Point[] {
    const path: Point[] = [];
    let current: Node | null = endNode;

    while (current) {
      path.unshift(current.position);
      current = current.parent;
    }

    return path;
  }

  public setVisualizationCallback(callback: (nodes: Map<string, Node>) => void) {
    this.onVisualizationUpdate = callback;
  }

  findPath(
    start: Point,
    goal: Point,
    isWalkable: (x: number, y: number) => boolean,
    maxX: number,
    maxY: number
  ): Point[] | null {
    this.isWalkable = isWalkable;
    const openSet = new Map<string, Node>();
    const closedSet = new Set<string>();

    const startNode: Node = {
      position: { x: Math.round(start.x), y: Math.round(start.y) },
      cost: 0,
      parent: null,
      isExplored: false,
      isInOpenSet: true,
      isInPath: false
    };

    openSet.set(this.pointToKey(startNode.position), startNode);

    const visualNodes = new Map<string, Node>();

    while (openSet.size > 0) {
      const current = this.getLowestCostNode(openSet);
      if (!current) break;

      current.isExplored = true;
      current.isInOpenSet = false;
      visualNodes.set(this.pointToKey(current.position), current);

      if (this.isAtGoal(current.position, goal)) {
        let pathNode: Node | null = current;
        while (pathNode) {
          pathNode.isInPath = true;
          visualNodes.set(this.pointToKey(pathNode.position), pathNode);
          pathNode = pathNode.parent;
        }

        this.onVisualizationUpdate?.(visualNodes);
        return this.reconstructPath(current);
      }

      openSet.delete(this.pointToKey(current.position));
      closedSet.add(this.pointToKey(current.position));

      for (const neighbor of this.getNeighbors(current, maxX, maxY)) {
        const neighborKey = this.pointToKey(neighbor.position);

        if (closedSet.has(neighborKey)) continue;
        if (!isWalkable(neighbor.position.x, neighbor.position.y)) continue;

        const tentativeCost = current.cost + neighbor.cost;

        const existingNeighbor = openSet.get(neighborKey);
        if (!existingNeighbor) {
          neighbor.cost = tentativeCost;
          neighbor.parent = current;
          neighbor.isInOpenSet = true;
          openSet.set(neighborKey, neighbor);
          visualNodes.set(neighborKey, neighbor);
        } else if (tentativeCost < existingNeighbor.cost) {
          existingNeighbor.cost = tentativeCost;
          existingNeighbor.parent = current;
        }
      }

      this.onVisualizationUpdate?.(visualNodes);
    }

    // If we exit the loop without finding a path
    console.warn(`[Dijkstra] No path found from (${start.x}, ${start.y}) to (${goal.x}, ${goal.y})`);
    return null;
  }
}