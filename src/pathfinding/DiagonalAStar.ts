type Point = {
  x: number;
  y: number;
};

type Node = {
  position: Point;
  gCost: number;    // Cost from start to this node
  hCost: number;    // Estimated cost from this node to goal
  fCost: number;    // Total cost (g + h)
  parent: Node | null;
};

export class DiagonalAStar {
  private readonly DIAGONAL_COST = Math.SQRT2;  // ≈ 1.414
  private readonly STRAIGHT_COST = 1.0;
  private isWalkable: ((x: number, y: number) => boolean) | null = null;
  private currentGoal: Point = { x: 0, y: 0 };

  findPath(
    start: Point,
    goal: Point,
    isWalkable: (x: number, y: number) => boolean,
    maxX: number,
    maxY: number
  ): Point[] | null {
    this.isWalkable = isWalkable;
    this.currentGoal = { x: Math.round(goal.x), y: Math.round(goal.y) };
    const openSet = new Map<string, Node>();
    const closedSet = new Set<string>();

    // Initialize start node with rounded coordinates instead of floor
    const startNode: Node = {
      position: { x: Math.round(start.x), y: Math.round(start.y) },
      gCost: 0,
      hCost: this.calculateHeuristic(start, goal),
      fCost: 0,
      parent: null
    };
    startNode.fCost = startNode.gCost + startNode.hCost;
    
    openSet.set(this.pointToKey(startNode.position), startNode);

    while (openSet.size > 0) {
      const current = this.getLowestFCostNode(openSet);
      if (!current) break;

      if (this.isAtGoal(current.position, goal)) {
        return this.reconstructPath(current);
      }

      openSet.delete(this.pointToKey(current.position));
      closedSet.add(this.pointToKey(current.position));

      for (const neighbor of this.getNeighbors(current, maxX, maxY)) {
        const neighborKey = this.pointToKey(neighbor.position);
        
        if (closedSet.has(neighborKey)) continue;
        if (!isWalkable(neighbor.position.x, neighbor.position.y)) continue;

        const tentativeGCost = current.gCost + neighbor.gCost;

        const existingNeighbor = openSet.get(neighborKey);
        if (!existingNeighbor) {
          neighbor.gCost = tentativeGCost;
          neighbor.hCost = this.calculateHeuristic(neighbor.position, goal);
          neighbor.fCost = neighbor.gCost + neighbor.hCost;
          neighbor.parent = current;
          openSet.set(neighborKey, neighbor);
        } else if (tentativeGCost < existingNeighbor.gCost) {
          existingNeighbor.gCost = tentativeGCost;
          existingNeighbor.fCost = existingNeighbor.gCost + existingNeighbor.hCost;
          existingNeighbor.parent = current;
        }
      }
    }

    return null;  // No path found
  }

  private calculateHeuristic(from: Point, to: Point): number {
    // Using Chebyshev distance for better diagonal path estimation
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    return Math.max(dx, dy);
  }

  private getNeighbors(node: Node, maxX: number, maxY: number): Node[] {
    const neighbors: Node[] = [];
    const { x, y } = node.position;

    // All 8 directions
    const directions = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
    ];

    // Get the general direction to the goal
    const goalDirection = {
      dx: Math.sign(this.currentGoal.x - x),
      dy: Math.sign(this.currentGoal.y - y)
    };

    // Sort directions based on alignment with goal direction
    directions.sort((a, b) => {
      const alignmentA = a.dx * goalDirection.dx + a.dy * goalDirection.dy;
      const alignmentB = b.dx * goalDirection.dx + b.dy * goalDirection.dy;
      return alignmentB - alignmentA; // Higher alignment first
    });

    for (const { dx, dy } of directions) {
      const newX = x + dx;
      const newY = y + dy;

      // Check if the target position is walkable first
      if (!this.isWalkableSafe(newX, newY, maxX, maxY)) {
        continue;
      }

      const isDiagonal = dx !== 0 && dy !== 0;
      
      // For diagonal movement, check if we can actually move diagonally
      if (isDiagonal) {
        // Check if we can walk through the corners
        const canWalkHorizontal = this.isWalkableSafe(x + dx, y, maxX, maxY);
        const canWalkVertical = this.isWalkableSafe(x, y + dy, maxX, maxY);
        
        // Only allow diagonal movement if both adjacent tiles are walkable
        if (!canWalkHorizontal || !canWalkVertical) {
          continue;
        }
      }

      neighbors.push({
        position: { x: newX, y: newY },
        gCost: isDiagonal ? this.DIAGONAL_COST : this.STRAIGHT_COST,
        hCost: 0,
        fCost: 0,
        parent: null
      });
    }

    return neighbors;
  }

  private isWalkableSafe(x: number, y: number, maxX: number, maxY: number): boolean {
    if (x < 0 || x >= maxX || y < 0 || y >= maxY) {
      return false;
    }
    return this.isWalkable?.(x, y) ?? false;  // Use the isWalkable callback
  }

  private getLowestFCostNode(openSet: Map<string, Node>): Node | null {
    let lowest: Node | null = null;
    let lowestF = Infinity;

    for (const node of openSet.values()) {
      if (node.fCost < lowestF) {
        lowest = node;
        lowestF = node.fCost;
      }
    }

    return lowest;
  }

  private isAtGoal(position: Point, goal: Point): boolean {
    return position.x === Math.round(goal.x) && 
           position.y === Math.round(goal.y);
  }

  private pointToKey(point: Point): string {
    return `${point.x},${point.y}`;
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
} 