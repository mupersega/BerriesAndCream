interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
  cost: number;
}

export function astar(
  start: {x: number, y: number},
  goal: {x: number, y: number},
  isWalkable: (x: number, y: number) => boolean,
  maxX: number,
  maxY: number
): {x: number, y: number}[] | null {
  const startX = Math.floor(start.x);
  const startY = Math.floor(start.y);
  const goalX = Math.floor(goal.x);
  const goalY = Math.floor(goal.y);

  console.log(`\n[A*] ====== New Path Calculation ======`);
  console.log(`[A*] Agent at (${start.x.toFixed(3)}, ${start.y.toFixed(3)})`);
  console.log(`[A*] Finding path from (${startX}, ${startY}) to (${goalX}, ${goalY})`);

  // Validate start and goal
  if (!isWalkable(startX, startY)) {
    console.log(`[A*] Start position (${startX}, ${startY}) is not walkable!`);
    return null;
  }
  if (!isWalkable(goalX, goalY)) {
    console.log(`[A*] Goal position (${goalX}, ${goalY}) is not walkable!`);
    return null;
  }

  const openSet: Node[] = [];
  const closedSet = new Set<string>();
  
  const startNode: Node = {
    x: startX,
    y: startY,
    g: 0,
    h: heuristic({x: startX, y: startY}, {x: goalX, y: goalY}),
    f: 0,
    parent: null,
    cost: 0
  };
  startNode.f = startNode.g + startNode.h;
  
  openSet.push(startNode);
  
  while (openSet.length > 0) {
    // Find node with lowest f score
    let current = openSet.reduce((min, node) => 
      node.f < min.f ? node : min, openSet[0]);
    
    // Found the goal
    if (current.x === goalX && current.y === goalY) {
      const path = reconstructPath(current);
      console.log(`[A*] Path found with ${path.length} steps:`);
      console.log(`[A*] Start: (${startX}, ${startY})`);
      path.forEach((point, i) => {
        console.log(`[A*]   Step ${i}: (${point.x}, ${point.y})`);
      });
      console.log(`[A*] Goal: (${goalX}, ${goalY})`);
      console.log(`[A*] ================================\n`);
      
      // Pause execution when path is found
      // window.DEBUG.isPaused = true;
      // console.log('[A*] Execution paused after finding path. Press Step or Resume to continue.');
      
      return path;
    }
    
    // Remove current from openSet
    openSet.splice(openSet.indexOf(current), 1);
    closedSet.add(`${current.x},${current.y}`);
    
    // Check neighbors
    const neighbors = getNeighbors(current, maxX, maxY);
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (!isWalkable(neighbor.x, neighbor.y) || closedSet.has(key)) continue;
      
      // Calculate G cost using the actual movement cost
      const tentativeG = current.g + neighbor.cost;
      
      const existingNeighbor = openSet.find(n => 
        n.x === neighbor.x && n.y === neighbor.y);
      
      if (!existingNeighbor) {
        neighbor.g = tentativeG;
        neighbor.h = heuristic(
          {x: neighbor.x, y: neighbor.y}, 
          {x: goalX, y: goalY}
        );
        neighbor.f = neighbor.g + neighbor.h;
        neighbor.parent = current;
        openSet.push(neighbor);
      } else if (tentativeG < existingNeighbor.g) {
        existingNeighbor.g = tentativeG;
        existingNeighbor.f = existingNeighbor.g + existingNeighbor.h;
        existingNeighbor.parent = current;
      }
    }
  }
  
  console.log(`[A*] No path found from (${startX}, ${startY}) to (${goalX}, ${goalY})`);
  return null;
}

function heuristic(a: {x: number, y: number}, b: {x: number, y: number}): number {
  // Simple Manhattan distance for grid-based movement
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(node: Node, maxX: number, maxY: number): Node[] {
  // Only cardinal directions (NSEW)
  const directions = [
    {x: 0, y: -1, cost: 1},  // North
    {x: 0, y: 1, cost: 1},   // South
    {x: 1, y: 0, cost: 1},   // East
    {x: -1, y: 0, cost: 1},  // West
  ];
  
  const neighbors: Node[] = [];
  
  for (const dir of directions) {
    const newX = node.x + dir.x;
    const newY = node.y + dir.y;
    
    // Check bounds
    if (newX >= 0 && newX < maxX && newY >= 0 && newY < maxY) {
      neighbors.push({
        x: newX,
        y: newY,
        g: 0,
        h: 0,
        f: 0,
        parent: null,
        cost: dir.cost
      });
    }
  }

  return neighbors;
}

function reconstructPath(node: Node): {x: number, y: number}[] {
  const path: {x: number, y: number}[] = [];
  let current: Node | null = node;
  
  while (current !== null) {
    path.unshift({x: current.x, y: current.y});
    current = current.parent;
  }
  
  // If start and end are the same tile, return empty path
  if (path.length === 1) {
    return [];
  }
  
  // If path has more than one point, check if we can simplify it
  if (path.length > 1) {
    // Remove the first point if it's the current position
    const first = path[0];
    const second = path[1];
    if (first.x === second.x && first.y === second.y) {
      path.shift();
    }
  }
  
  return path;
} 