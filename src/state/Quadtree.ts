interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuadtreePoint {
  x: number;
  y: number;
  data: any;
}

export class Quadtree {
  private boundary: Rectangle;
  private capacity: number;
  private points: QuadtreePoint[];
  private divided: boolean;
  private northwest?: Quadtree;
  private northeast?: Quadtree;
  private southwest?: Quadtree;
  private southeast?: Quadtree;

  constructor(boundary: Rectangle, capacity: number = 4) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.divided = false;
  }

  // Subdivide this quadtree into four smaller quadtrees
  private subdivide(): void {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.width / 2;
    const h = this.boundary.height / 2;

    const nw = { x: x, y: y, width: w, height: h };
    const ne = { x: x + w, y: y, width: w, height: h };
    const sw = { x: x, y: y + h, width: w, height: h };
    const se = { x: x + w, y: y + h, width: w, height: h };

    this.northwest = new Quadtree(nw, this.capacity);
    this.northeast = new Quadtree(ne, this.capacity);
    this.southwest = new Quadtree(sw, this.capacity);
    this.southeast = new Quadtree(se, this.capacity);

    this.divided = true;
  }

  // Insert a point into the quadtree
  insert(point: QuadtreePoint): boolean {
    // Check if point is within boundary
    if (!this.contains(point)) {
      return false;
    }

    // If there's space in this quad and it's not divided, add here
    if (this.points.length < this.capacity && !this.divided) {
      this.points.push(point);
      return true;
    }

    // Otherwise, subdivide and then add the point to whichever node will accept it
    if (!this.divided) {
      this.subdivide();
    }

    return (
      this.northwest!.insert(point) ||
      this.northeast!.insert(point) ||
      this.southwest!.insert(point) ||
      this.southeast!.insert(point)
    );
  }

  // Query all points within a range
  query(range: Rectangle): QuadtreePoint[] {
    const found: QuadtreePoint[] = [];

    // If range doesn't intersect this quad, return empty array
    if (!this.intersects(range, this.boundary)) {
      return found;
    }

    // Check points at this level
    for (const point of this.points) {
      if (this.pointInRange(point, range)) {
        found.push(point);
      }
    }

    // If this quad is divided, check children
    if (this.divided) {
      found.push(...this.northwest!.query(range));
      found.push(...this.northeast!.query(range));
      found.push(...this.southwest!.query(range));
      found.push(...this.southeast!.query(range));
    }

    return found;
  }

  // Clear all points from the quadtree
  clear(): void {
    this.points = [];
    if (this.divided) {
      this.northwest = undefined;
      this.northeast = undefined;
      this.southwest = undefined;
      this.southeast = undefined;
      this.divided = false;
    }
  }

  // Helper method to check if a point is within the quadtree's boundary
  private contains(point: QuadtreePoint): boolean {
    return (
      point.x >= this.boundary.x &&
      point.x < this.boundary.x + this.boundary.width &&
      point.y >= this.boundary.y &&
      point.y < this.boundary.y + this.boundary.height
    );
  }

  // Helper method to check if a point is within a range
  private pointInRange(point: QuadtreePoint, range: Rectangle): boolean {
    return (
      point.x >= range.x &&
      point.x < range.x + range.width &&
      point.y >= range.y &&
      point.y < range.y + range.height
    );
  }

  // Helper method to check if two rectangles intersect
  private intersects(rangeA: Rectangle, rangeB: Rectangle): boolean {
    return !(
      rangeA.x + rangeA.width < rangeB.x ||
      rangeB.x + rangeB.width < rangeA.x ||
      rangeA.y + rangeA.height < rangeB.y ||
      rangeB.y + rangeB.height < rangeA.y
    );
  }
}
