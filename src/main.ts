import './style.scss'

import { Dijkstra } from './pathfinding/Dijkstra';
import { TileType } from './types/TileType';
import { initInfoPanel, initSelectedTilePanel, updateSelectedTilePanel } from './UI/components';
import { StructureType } from './types/StructureType';
import { Point } from './types/Point';
import { gameState } from './state/GameState';
import { RenderSystem } from './rendering/RenderingSystem';

type Node = {
  position: { x: number, y: number };
  cost: number;
  parent: Node | null;
  isExplored: boolean;
  isInOpenSet: boolean;
  isInPath: boolean;
};

// Simple 2D noise implementation
class HeightMapGenerator {
  private heightMap: number[][];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.heightMap = [];
    
    // Initialize with random values between 1-40 (lower base height)
    for (let y = 0; y < height; y++) {
      this.heightMap[y] = [];
      for (let x = 0; x < width; x++) {
        this.heightMap[y][x] = Math.floor(Math.random() * 100) + 1;
      }
    }

    // Create multiple mountain systems
    const numSystems = 10;  // Number of separate mountain systems
    const minSystemDistance = 30;  // Minimum distance between system centers

    // Store central peaks to maintain distance between them
    const peaks: {x: number, y: number}[] = [];

    for (let system = 0; system < numSystems; system++) {
      let centerX, centerY;
      let attempts = 0;
      const maxAttempts = 50;

      do {
        centerX = Math.floor(Math.random() * width);
        centerY = Math.floor(Math.random() * height);
        
        // Check distance from other peaks
        const tooClose = peaks.some(peak => {
          const dx = Math.min(Math.abs(centerX - peak.x), width - Math.abs(centerX - peak.x));
          const dy = Math.min(Math.abs(centerY - peak.y), height - Math.abs(centerY - peak.y));
          return Math.sqrt(dx * dx + dy * dy) < minSystemDistance;
        });

        attempts++;
        if (attempts >= maxAttempts) break;  // Prevent infinite loop
        
        if (!tooClose) {
          peaks.push({x: centerX, y: centerY});
          break;
        }
      } while (true);

      // Create central peak
      const centralRadius = 6;
      const centralPeakHeight = 140 + Math.random() * 40;  // Varying peak heights
      for (let dy = -centralRadius; dy <= centralRadius; dy++) {
        for (let dx = -centralRadius; dx <= centralRadius; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= centralRadius) {
            const nx = (centerX + dx + width) % width;
            const ny = (centerY + dy + height) % height;
            const heightIncrease = centralPeakHeight * Math.pow((1 - distance / centralRadius), 1.2);
            this.heightMap[ny][nx] = Math.max(
              this.heightMap[ny][nx],
              heightIncrease
            );
          }
        }
      }

      // Generate mountain ranges from this central peak
      const numRanges = 3 + Math.floor(Math.random() * 3);  // 3-5 ranges per system
      const pointsPerRange = 4 + Math.floor(Math.random() * 3);  // 4-6 points per range
      const minDistance = 12;
      const maxDistance = 25;
      
      const angleStep = (Math.PI * 2) / numRanges;
      
      for (let range = 0; range < numRanges; range++) {
        let x = centerX;
        let y = centerY;
        let peakHeight = centralPeakHeight * 0.9;  // Start slightly lower than central peak
        
        const baseAngle = range * angleStep + (Math.random() * angleStep * 0.5);  // Add some randomness to angle
        
        for (let point = 0; point < pointsPerRange; point++) {
          const angleVariance = Math.PI / 6;
          const angle = baseAngle + (Math.random() * angleVariance - angleVariance/2);
          const distance = minDistance + Math.random() * (maxDistance - minDistance);
          const targetX = Math.floor(x + Math.cos(angle) * distance);
          const targetY = Math.floor(y + Math.sin(angle) * distance);
          
          const steps = Math.floor(distance * 2);
          for (let step = 0; step < steps; step++) {
            const t = step / steps;
            const currentX = Math.floor((x * (1 - t) + targetX * t + width) % width);
            const currentY = Math.floor((y * (1 - t) + targetY * t + height) % height);
            
            const radius = 4;
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= radius) {
                  const nx = (currentX + dx + width) % width;
                  const ny = (currentY + dy + height) % height;
                  const heightIncrease = peakHeight * Math.pow((1 - distance / radius), 1.5);
                  this.heightMap[ny][nx] = Math.max(
                    this.heightMap[ny][nx],
                    heightIncrease
                  );
                }
              }
            }
          }
          
          x = targetX;
          y = targetY;
          peakHeight *= 0.75;
        }
      }
    }
  }

  // Apply convolution with a gaussian-like kernel
  public smooth(passes: number = 3) {
    // Larger radial kernel
    const radius = 3;
    const kernelSize = radius * 2 + 1;
    
    for (let pass = 0; pass < passes; pass++) {
      const newMap = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
      
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          let sum = 0;
          let weightSum = 0;
          
          // Apply radial kernel
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= radius) {
                const px = (x + dx + this.width) % this.width;  // Wrap around
                const py = (y + dy + this.height) % this.height;  // Wrap around
                
                // Gaussian-like weight based on distance
                const weight = Math.exp(-(distance * distance) / (2 * (radius * 0.5) * (radius * 0.5)));
                sum += this.heightMap[py][px] * weight;
                weightSum += weight;
              }
            }
          }
          
          newMap[y][x] = sum / weightSum;
        }
      }
      
      this.heightMap = newMap;
    }
  }

  public getValue(x: number, y: number): number {
    return this.heightMap[y][x] / 100; // Normalize to 0-1
  }

  private quadraticBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
    const x = Math.round((1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x);
    const y = Math.round((1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y);
    return { x, y };
  }

  private generateControlPoints(startX: number, startY: number): Point[] {
    const points: Point[] = [];
    let x = startX;
    let y = startY;
    
    // Start point
    points.push({ x, y });
    
    // Generate 2-4 control points
    const numPoints = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numPoints; i++) {
      // Bias movement towards lower elevation
      let lowestX = x;
      let lowestY = y;
      let lowestHeight = Infinity;
      
      // Sample points in a wider radius
      const radius = 20;
      for (let attempt = 0; attempt < 10; attempt++) {
        const testX = (x + (Math.random() * 2 - 1) * radius + this.width) % this.width;
        const testY = (y + (Math.random() * 2 - 1) * radius + this.height) % this.height;
        const height = this.heightMap[Math.floor(testY)][Math.floor(testX)];
        
        if (height < lowestHeight) {
          lowestHeight = height;
          lowestX = testX;
          lowestY = testY;
        }
      }
      
      x = lowestX;
      y = lowestY;
      points.push({ x, y });
    }
    
    return points;
  }

  private carveRiverPath(startX: number, startY: number, startWidth: number = 2, branchChance: number = 0.15, depth: number = 0) {
    // Limit recursion depth to prevent infinite branching
    if (depth > 3) return; // Reduced max depth

    const controlPoints = this.generateControlPoints(startX, startY);
    let riverWidth = startWidth;
    
    // Carve along each segment of control points
    for (let i = 0; i < controlPoints.length - 2; i++) {
      const p0 = controlPoints[i];
      const p1 = controlPoints[i + 1];
      const p2 = controlPoints[i + 2];
      
      // Validate points before using them
      if (!p0 || !p1 || !p2) continue;
      
      // Use more steps for smoother curves
      const steps = 50;
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const point = this.quadraticBezier(p0, p1, p2, t);
        
        // Ensure point is within bounds
        if (point.x < 0 || point.x >= this.width || point.y < 0 || point.y >= this.height) continue;
        
        // Carve the river at this point
        const currentWidth = Math.max(1, riverWidth * (1 - (step / steps) * 0.2)); // Slower width reduction
        for (let dy = -currentWidth; dy <= currentWidth; dy++) {
          for (let dx = -currentWidth; dx <= currentWidth; dx++) {
            const nx = Math.floor((point.x + dx + this.width) % this.width);
            const ny = Math.floor((point.y + dy + this.height) % this.height);
            
            // Validate coordinates
            if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
            
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= currentWidth) {
              // Reduced depth values
              const depth = 15 + (currentWidth - distance);
              this.heightMap[ny][nx] = Math.min(
                this.heightMap[ny][nx],
                depth
              );
            }
          }
        }

        // Add branches with varying widths
        if (Math.random() < branchChance && riverWidth > 2) {
          const branchX = Math.floor(point.x);
          const branchY = Math.floor(point.y);
          if (branchX >= 0 && branchX < this.width && branchY >= 0 && branchY < this.height) {
            // Create branch with reduced width and branch chance
            const branchWidth = riverWidth * 0.7;
            const newBranchChance = branchChance * 0.5;
            this.carveRiverPath(branchX, branchY, branchWidth, newBranchChance, depth + 1);
          }
        }
      }
      
      riverWidth *= 0.9; // Slower width reduction for main river
    }
  }

  public generateRivers(numRivers: number = 3) {
    // Find the highest point on the map for the main river source
    let startX = 0, startY = 0;
    let highestValue = 0;
    
    // Sample more points to find the best starting location
    for (let j = 0; j < 50; j++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      const value = this.heightMap[y][x];
      if (value > highestValue && value > 80) { // Higher starting point requirement
        highestValue = value;
        startX = x;
        startY = y;
      }
    }

    // Generate one main river with more control points and higher branch chance
    const mainRiverWidth = 3; // Reduced initial width
    this.carveRiverPath(startX, startY, mainRiverWidth, 0.15); // Reduced branch chance
  }
}

// Generate tile map
function generateTileMap(width: number, height: number, seed?: number): TileType[][] {
  const heightMap = new HeightMapGenerator(width, height);
  // heightMap.smooth(2); // Reduced from 3 to 1 pass of smoothing
  heightMap.generateRivers(1);
  heightMap.smooth(4); // Smooth once more to blend rivers
  const map: TileType[][] = [];
  
  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      const value = heightMap.getValue(x, y);
      
      // Adjusted thresholds to reduce sand
      if (value < 0.08) {
        map[y][x] = TileType.DeepWater;
      } else if (value < 0.15) {
        map[y][x] = TileType.Water;
      } else if (value < 0.18) { // Reduced sand threshold significantly
        map[y][x] = TileType.Sand;
      } else if (value < 0.65) { // Increased grass range
        map[y][x] = TileType.Grass;
      } else if (value < 0.75) {
        map[y][x] = TileType.Highlands;
      } else if (value < 0.85) {
        map[y][x] = TileType.Dirt;
      } else if (value < 0.92) {
        map[y][x] = TileType.Stone;
      } else {
        map[y][x] = TileType.Snow;
      }
    }
  }
  
  return map;
}

// Create a global noise generator instance
const noise = new HeightMapGenerator(100, 100);

// Add Agent import at the top
import { Agent } from './Agent';

// Add Resource import at the top
import { Resource, ResourceType } from './Resource';
import { IDrawable } from './interfaces/IDrawable';

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let backgroundCanvas: HTMLCanvasElement;
let backgroundCtx: CanvasRenderingContext2D;

// Add global constants
const mapWidth = 100;
const mapHeight = 100;
const tileSize = 16;

// Add mouse position tracking
let mouseX = 0;
let mouseY = 0;
let hoveredResource: Resource | null = null;

// Add at the top with other globals
interface DebugFlags {
  showExploredTiles: boolean;
  isPaused: boolean;
  agentDebug: boolean[];
  toggleAgentDebug: (index: number) => void;
}

// Make DEBUG globally accessible
window.DEBUG = {
  showExploredTiles: true,
  isPaused: false,
  agentDebug: [],
  toggleAgentDebug: (index: number) => {
    window.DEBUG.agentDebug[index] = !window.DEBUG.agentDebug[index];
    updateInfoPanel();  // Make sure this is called to refresh the UI
    console.log(`Toggled debug for agent ${index}:`, window.DEBUG.agentDebug[index]); // Add logging
  }
};

// Modify the gameLoop function
function gameLoop() {
  if (!window.DEBUG.isPaused) {
    // Update agents
    gameState.getAgents().forEach(agent => {
      if (agent) {
        agent.update();
      }
    });
  }
  
  // Render map using the map from gameState
  renderMap();

  requestAnimationFrame(gameLoop);
}

function renderMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, 100);

  // Draw hovered tile indicator if mouse is within bounds
  if (mouseX >= 0 && mouseX < gameState.getMapWidth() && 
      mouseY >= 0 && mouseY < gameState.getMapHeight()) {
    drawHoveredTile(ctx, mouseX, mouseY);
  }

  // Draw selected tile
  drawSelectedTile(ctx);

  const drawables: IDrawable[] = [
    ...gameState.getResources(),
    ...gameState.getStructures(),
    ...gameState.getAgents().filter(agent => !agent.isDead())
  ];

  RenderSystem.render(ctx, drawables);

  ctx.restore();
  // Draw agent paths
  gameState.getAgents().forEach(agent => {
    if (agent && !agent.isDead()) {
      const path = agent.getCurrentPath();
      if (path.length > 0) {
        drawAgentPath(agent, path);
      }
    }
  });
}

function generateNewMap() {
  // Clear UI elements first
  const agentContainer = document.querySelector('.agent-container');
  if (agentContainer) {
    agentContainer.innerHTML = '';
  }

  // Clear all game state
  gameState.clearGameState();

  // Generate new map and set it in game state
  const map = generateTileMap(mapWidth, mapHeight);
  gameState.setMap(map);

  // Generate initial game entities
  gameState.generateInitialResources();
  gameState.generateInitialStructures();
  gameState.generateInitialAgents(2);
  
  // Reinitialize UI and render
  initInfoPanel(gameState.getAgents());
  initSelectedTilePanel();
  renderBackground(map);
  renderMap();
}

// Initialize the map when the page loads
initMap();

// Add event listener for generate button
document.getElementById('generateMap')?.addEventListener('click', generateNewMap);

function setupCanvases(): {
  mainCanvas: HTMLCanvasElement;
  backgroundCanvas: HTMLCanvasElement;
  mainCtx: CanvasRenderingContext2D;
  backgroundCtx: CanvasRenderingContext2D;
} {
  // Calculate required canvas dimensions for isometric view
  const isoWidth = (mapWidth + mapHeight) * tileSize;
  const isoHeight = (mapWidth + mapHeight) * (tileSize / 2);

  // Create background canvas (static elements)
  const backgroundCanvas = document.createElement('canvas');
  backgroundCanvas.width = isoWidth;
  backgroundCanvas.height = isoHeight + 200;
  backgroundCanvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
  `;
  const backgroundCtx = backgroundCanvas.getContext('2d')!;

  // Create main canvas (dynamic elements)
  const mainCanvas = document.createElement('canvas');
  mainCanvas.width = isoWidth;
  mainCanvas.height = isoHeight + 200;
  mainCanvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
  `;
  const mainCtx = mainCanvas.getContext('2d')!;

  // Add mouse move listener
  mainCanvas.addEventListener('mousemove', handleMouseMove);

  // Add click listener
  mainCanvas.addEventListener('click', handleClick);

  return { mainCanvas, backgroundCanvas, mainCtx, backgroundCtx };
}

function handleMouseMove(event: MouseEvent) {
  if (!canvas || !gameState) return;

  const rect = canvas.getBoundingClientRect();
  // Get mouse position relative to canvas center
  const mouseScreenX = event.clientX - rect.left - canvas.width / 2;
  const mouseScreenY = event.clientY - rect.top - 100;
  
  // First, get the tile coordinates without height offset
  const tileX = Math.floor((mouseScreenX / tileSize + mouseScreenY / (tileSize/2)) / 2);
  const tileY = Math.floor((mouseScreenY / (tileSize/2) - mouseScreenX / tileSize) / 2);
  
  // Get the height offset for this tile
  const tileType = gameState.getTileAt(tileX, tileY);
  let heightFactor = 0;
  switch (tileType) {
    case TileType.DeepWater: heightFactor = 0; break;
    case TileType.Water: heightFactor = 0.15; break;
    case TileType.Sand: heightFactor = 0.3; break;
    case TileType.Grass: heightFactor = 0.45; break;
    case TileType.Highlands: heightFactor = 0.6; break;
    case TileType.Dirt: heightFactor = 0.75; break;
    case TileType.Stone: heightFactor = 0.9; break;
    case TileType.Snow: heightFactor = 1; break;
  }
  
  // Adjust the mouse Y position by the height offset
  const verticalOffset = heightFactor * tileSize;
  const adjustedMouseY = mouseScreenY + verticalOffset;
  
  // Recalculate tile position with height-adjusted mouse position
  mouseX = Math.floor((mouseScreenX / tileSize + adjustedMouseY / (tileSize/2)) / 2);
  mouseY = Math.floor((adjustedMouseY / (tileSize/2) - mouseScreenX / tileSize) / 2);
  
  // Update hovered resource
  hoveredResource = gameState.getResources().find(resource => {
    const pos = resource.getPosition();
    return pos.x === mouseX && pos.y === mouseY;
  }) || null;
  
  updateInfoPanel();
}

async function initMap() {
  // Setup canvases
  const { mainCanvas: newCanvas, backgroundCanvas: newBackgroundCanvas, mainCtx: newCtx, backgroundCtx: newBackgroundCtx } = setupCanvases();
  
  // Update global references
  canvas = newCanvas;
  ctx = newCtx;
  backgroundCanvas = newBackgroundCanvas;
  backgroundCtx = newBackgroundCtx;
  
  // Create info panel
  const infoPanel = document.createElement('div');
  infoPanel.id = 'infoPanel';
  document.querySelector('.ui')?.appendChild(infoPanel);

  // Add canvases to DOM
  document.getElementById('app')?.appendChild(backgroundCanvas);
  document.getElementById('app')?.appendChild(canvas);

  // Wait for spritesheet to load
  await gameState.loadSpritesheet();

  // Generate initial game state
  generateNewMap();
  
  // Start the game loop
  requestAnimationFrame(gameLoop);
}

// Update the updateInfoPanel function to use UIComponents
function updateInfoPanel() {
  const hoverContainer = document.querySelector('.hover-info-container');
  if (!hoverContainer || !gameState) return;
  
  let hoverContent = '';
  
  // Tile info (when hovering)
  if (mouseX >= 0 && mouseY >= 0 && mouseX < mapWidth && mouseY < mapHeight) {
    const tile = gameState.getTileAt(mouseX, mouseY);
    const height = noise.getValue(mouseX, mouseY);
    
    hoverContent += `
      <div class="hover-info">
        <h4>Tile Info</h4>
        <p>Position: (${mouseX}, ${mouseY})</p>
        <p>Type: ${TileType[tile]}</p>
        <p>Height: ${Math.round(height * 100)}</p>
      </div>
    `;
  }
  
  // Resource info (when hovering)
  if (hoveredResource) {
    const amount = hoveredResource.getAmount();
    const maxAmount = hoveredResource.getMaxAmount();
    const filledBars = Math.max(0, Math.min(10, Math.ceil((amount / maxAmount) * 10)));
    const emptyBars = Math.max(0, 10 - filledBars);
    const bars = '█'.repeat(filledBars) + '□'.repeat(emptyBars);
    
    hoverContent += `
      <div class="hover-info">
        <h4>Resource Info</h4>
        <p>Type: ${ResourceType[hoveredResource.getType()]}</p>
        <p class="stat-line">${amount}/${maxAmount} <span class="bars">${bars}</span></p>
      </div>
    `;
  }

  hoverContainer.innerHTML = hoverContent;
}

// Split render into static and dynamic parts
function renderBackground(map: TileType[][]) {
  backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  
  // Center the isometric view
  backgroundCtx.save();
  backgroundCtx.translate(backgroundCanvas.width / 2, 100);
  
  // Draw tiles in reverse order (back to front)
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      // Calculate isometric position
      const isoX = (x - y) * (tileSize);
      const isoY = (x + y) * (tileSize/2);
      
      // Draw tile
      drawIsometricTile(backgroundCtx, isoX, isoY, map[y][x]);
    }
  }
  
  backgroundCtx.restore();
}

// Add to your rendering code
function renderPathfinding(nodes: Map<string, Node>) {
  nodes.forEach((node, key) => {
    const x = node.position.x * tileSize;
    const y = node.position.y * tileSize;
    
    if (node.isInPath) {
      // Draw path nodes in bright green
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.fillRect(x, y, tileSize, tileSize);
    } else if (node.isExplored) {
      // Draw explored nodes in red
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(x, y, tileSize, tileSize);
    } else if (node.isInOpenSet) {
      // Draw frontier nodes in blue
      ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  });
}

// When creating your Agent, set up the visualization callback:
const pathfinder = new Dijkstra();
pathfinder.setVisualizationCallback((nodes) => {
  renderPathfinding(nodes);
});

function renderIsometricMap(map: TileType[][], ctx: CanvasRenderingContext2D) {
  const tileWidth = 32;  // Width of a single tile in isometric view
  const tileHeight = 16; // Height of a single tile in isometric view

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      // Calculate isometric position
      const isoX = (x - y) * tileWidth / 2;
      const isoY = (x + y) * tileHeight / 2;

      // Draw the tile at the isometric position
      drawIsometricTile(ctx, isoX, isoY, map[y][x]);
    }
  }
}

function createNoisePattern(color: string, variation: number): CanvasPattern | null {
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 4;
  patternCanvas.height = 4;
  const patternCtx = patternCanvas.getContext('2d');
  
  if (!patternCtx) return null;
  
  // First fill with base color
  patternCtx.fillStyle = color;
  patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
  
  // Then add noise variation
  for (let y = 0; y < patternCanvas.height; y++) {
    for (let x = 0; x < patternCanvas.width; x++) {
      const noise = (Math.random() - 0.5) * (variation / 2);
      patternCtx.fillStyle = adjustColor(color, noise);
      patternCtx.fillRect(x, y, 1, 1);
    }
  }
  
  const pattern = ctx.createPattern(patternCanvas, 'repeat');
  if (!pattern) {
    console.warn('Failed to create pattern, falling back to base color');
    return null;
  }
  
  return pattern;
}

function drawIsometricTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileType: TileType) {
  const tileWidth = tileSize * 2;
  const tileHeight = tileSize;
  
  // Define wind angle at the start of the function
  const windAngle = Math.PI * 0.25; // Wind blowing towards bottom-right
  
  // Get base colors and patterns for each tile type
  let baseColor: string;
  let pattern: CanvasPattern | undefined;
  let decorations: Array<any> = [];
  
  switch (tileType) {
    case TileType.DeepWater:
      baseColor = '#1a5f7a';
      pattern = createNoisePattern(baseColor, 10) || undefined; // Reduced noise variation
      // Add more subtle wave decorations
      for (let i = 0; i < 4; i++) {
        decorations.push({
          x: Math.random() * tileWidth - tileWidth/2,
          y: Math.random() * tileHeight,
          size: 1.5, // Reduced size
          color: 'rgba(41, 128, 185, 0.3)' // More transparent blue
        });
      }
      break;
    case TileType.Water:
      baseColor = '#2980b9';
      pattern = createNoisePattern(baseColor, 8) || undefined; // Reduced noise variation
      // Add subtle ripple effects
      for (let i = 0; i < 3; i++) {
        decorations.push({
          x: Math.random() * tileWidth - tileWidth/2,
          y: Math.random() * tileHeight,
          size: 1,
          color: 'rgba(255, 255, 255, 0.15)' // Very subtle white ripples
        });
      }
      break;
    case TileType.Sand:
      baseColor = '#e4d03b';
      // Add small dots for sand texture
      for (let i = 0; i < 5; i++) {
        decorations.push({
          x: Math.random() * tileWidth - tileWidth/2,
          y: Math.random() * tileHeight,
          size: 1,
          color: adjustColor(baseColor, -20)
        });
      }
      break;
    case TileType.Grass:
      baseColor = '#2ecc71';
      // Add shorter, denser grass blade decorations
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * tileWidth - tileWidth/2;
        const y = Math.random() * tileHeight;
        // Base angle is wind direction with small random variation
        const angle = windAngle + (Math.random() * 0.4 - 0.2); // ±0.2 radians variation
        const length = 2 + Math.random() * 2;
        
        decorations.push({
          x,
          y,
          angle,
          length,
          color: adjustColor(baseColor, Math.random() * 20 - 10)
        });
      }
      break;
    case TileType.Highlands:
      baseColor = '#207346';
      // Add longer, wilder grass blade decorations with same wind direction
      for (let i = 0; i < 12; i++) {
        const x = Math.random() * tileWidth - tileWidth/2;
        const y = Math.random() * tileHeight;
        // Slightly more variation for highlands as taller grass catches more wind
        const angle = windAngle + (Math.random() * 0.6 - 0.3); // ±0.3 radians variation
        const length = 4 + Math.random() * 4;
        
        decorations.push({
          x,
          y,
          angle,
          length,
          color: adjustColor(baseColor, Math.random() * 20 - 10)
        });
      }
      break;
    case TileType.Dirt:
      baseColor = '#8b4513';
      pattern = createNoisePattern(baseColor, 15) || undefined;
      // Add soil texture dots
      for (let i = 0; i < 4; i++) {
        decorations.push({
          x: Math.random() * tileWidth - tileWidth/2,
          y: Math.random() * tileHeight,
          size: 1,
          color: adjustColor(baseColor, -10)
        });
      }
      break;
    case TileType.Stone:
      baseColor = '#6c7a89';
      // Add rock-like decorations
      for (let i = 0; i < 3; i++) {
        const centerX = Math.random() * tileWidth - tileWidth/2;
        const centerY = Math.random() * tileHeight;
        const points = [];
        const numPoints = 5 + Math.floor(Math.random() * 3);
        const size = 2 + Math.random() * 2;
        
        // Generate points for the shape
        for (let j = 0; j < numPoints; j++) {
          const angle = (j / numPoints) * Math.PI * 2;
          const radius = size * (0.7 + Math.random() * 0.3);
          points.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
          });
        }
        
        // Determine stone color - more contrast between stones
        const colorVariation = i % 2 === 0 
          ? -35 - Math.random() * 10  // Significantly darker stones
          : 25 + Math.random() * 10;  // Significantly lighter stones
        
        decorations.push({
          points: points,
          color: adjustColor(baseColor, colorVariation)
        });
      }
      break;
    case TileType.Snow:
      baseColor = '#ffffff';
      // Add sparkle decorations
      for (let i = 0; i < 3; i++) {
        decorations.push({
          x: Math.random() * tileWidth - tileWidth/2,
          y: Math.random() * tileHeight,
          size: 1,
          color: '#e6f3ff'
        });
      }
      break;
  }

  // Calculate height factor
  let heightFactor = 0;
  switch (tileType) {
    case TileType.DeepWater: heightFactor = 0; break;
    case TileType.Water: heightFactor = 0.15; break;
    case TileType.Sand: heightFactor = 0.3; break;
    case TileType.Grass: heightFactor = 0.45; break;
    case TileType.Highlands: heightFactor = 0.6; break;
    case TileType.Dirt: heightFactor = 0.75; break;
    case TileType.Stone: heightFactor = 0.9; break;
    case TileType.Snow: heightFactor = 1; break;
  }

  const verticalOffset = heightFactor * tileHeight;

  // Draw left face (lighter)
  ctx.beginPath();
  ctx.moveTo(x - tileWidth/2, y + tileHeight/2 - verticalOffset);
  ctx.lineTo(x - tileWidth/2, y + tileHeight/2);
  ctx.lineTo(x, y + tileHeight);
  ctx.lineTo(x, y + tileHeight - verticalOffset);
  ctx.closePath();
  
  if (tileType === TileType.Dirt) {
    ctx.fillStyle = adjustColor(baseColor, 30);  // Removed pattern for dirt
  } else {
    ctx.fillStyle = pattern || adjustColor(baseColor, 20);
  }
  ctx.fill();

  // Draw right face (darker)
  ctx.beginPath();
  ctx.moveTo(x + tileWidth/2, y + tileHeight/2 - verticalOffset);
  ctx.lineTo(x + tileWidth/2, y + tileHeight/2);
  ctx.lineTo(x, y + tileHeight);
  ctx.lineTo(x, y + tileHeight - verticalOffset);
  ctx.closePath();
  
  if (tileType === TileType.Dirt) {
    ctx.fillStyle = adjustColor(baseColor, -40);  // Removed pattern for dirt
  } else {
    ctx.fillStyle = pattern || adjustColor(baseColor, -20);
  }
  ctx.fill();

  // Draw top face with pattern or base color
  ctx.beginPath();
  ctx.moveTo(x, y - verticalOffset);
  ctx.lineTo(x + tileWidth/2, y + tileHeight/2 - verticalOffset);
  ctx.lineTo(x, y + tileHeight - verticalOffset);
  ctx.lineTo(x - tileWidth/2, y + tileHeight/2 - verticalOffset);
  ctx.closePath();
  
  if (tileType === TileType.Dirt) {
    ctx.fillStyle = pattern || baseColor;  // Keep pattern for top face only
  } else {
    ctx.fillStyle = pattern || baseColor;
  }
  ctx.fill();

  // Draw decorations on top face
  // Sort decorations so shadows are drawn first
  const sortedDecorations = decorations.sort((a, b) => {
    if ('isShadow' in a && 'isShadow' in b) {
      return a.isShadow ? -1 : 1;
    }
    return 0;
  });

  sortedDecorations.forEach(dec => {
    if ('angle' in dec) {  // Grass lines
      ctx.beginPath();
      ctx.moveTo(
        x + dec.x,
        y + dec.y - verticalOffset
      );
      ctx.lineTo(
        x + dec.x + Math.cos(dec.angle) * dec.length,
        y + dec.y - verticalOffset - Math.sin(dec.angle) * dec.length
      );
      ctx.strokeStyle = dec.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if ('points' in dec) {  // Stone shapes
      ctx.beginPath();
      dec.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(x + point.x, y + point.y - verticalOffset);
        } else {
          ctx.lineTo(x + point.x, y + point.y - verticalOffset);
        }
      });
      ctx.closePath();
      ctx.fillStyle = dec.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.stroke();
    } else if ('size' in dec) {  // Regular circles
      ctx.beginPath();
      ctx.arc(
        x + dec.x,
        y + dec.y - verticalOffset,
        dec.size,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = dec.color;
      ctx.fill();
    }
  });

  // Add subtle outline
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.stroke();

  // Modified water highlights
  if (tileType === TileType.Water || tileType === TileType.DeepWater) {
    // Reduce the contrast between faces
    ctx.fillStyle = pattern || adjustColor(baseColor, -10); // Reduced darkness for left face
    ctx.fill();
    ctx.fillStyle = pattern || adjustColor(baseColor, 10);  // Reduced brightness for right face
    ctx.fill();
    
    // Add more subtle water highlights
    ctx.beginPath();
    ctx.moveTo(x, y - verticalOffset);
    ctx.lineTo(x + tileWidth/4, y + tileHeight/4 - verticalOffset);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; // More transparent highlight
    ctx.lineWidth = 0.5; // Thinner line
    ctx.stroke();
  }

  // Reduce the opacity of the tile outline for water tiles
  if (tileType === TileType.Water || tileType === TileType.DeepWater) {
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'; // More transparent outline
  } else {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  }
  ctx.stroke();
}

// Helper function to adjust color brightness
function adjustColor(color: string, percent: number): string {
  // Convert hex to RGB first
  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  // Adjust each component
  r = Math.min(255, Math.max(0, r + percent));
  g = Math.min(255, Math.max(0, g + percent));
  b = Math.min(255, Math.max(0, b + percent));

  // Convert back to hex
  const rr = r.toString(16).padStart(2, '0');
  const gg = g.toString(16).padStart(2, '0');
  const bb = b.toString(16).padStart(2, '0');

  return `#${rr}${gg}${bb}`;
}

// Add after other render functions
function drawHoveredTile(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const tileWidth = tileSize * 2;
  const tileHeight = tileSize;
  
  // Get tile type and calculate height
  const tileType = window.gameState.getTileAt(x, y);
  let heightFactor = 0;
  switch (tileType) {
    case TileType.DeepWater: heightFactor = 0; break;
    case TileType.Water: heightFactor = 0.15; break;
    case TileType.Sand: heightFactor = 0.3; break;
    case TileType.Grass: heightFactor = 0.45; break;
    case TileType.Highlands: heightFactor = 0.6; break;
    case TileType.Dirt: heightFactor = 0.75; break;
    case TileType.Stone: heightFactor = 0.9; break;
    case TileType.Snow: heightFactor = 1; break;
  }

  const verticalOffset = heightFactor * tileHeight;

  // Convert tile coordinates to isometric position
  const isoX = (x - y) * (tileSize);
  const isoY = (x + y) * (tileSize/2) - verticalOffset;

  // Draw tile outline
  ctx.beginPath();
  ctx.moveTo(isoX, isoY);
  ctx.lineTo(isoX + tileWidth / 2, isoY + tileHeight / 2);
  ctx.lineTo(isoX, isoY + tileHeight);
  ctx.lineTo(isoX - tileWidth / 2, isoY + tileHeight / 2);
  ctx.closePath();
  
  // Set outline style
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Optional: Add a subtle fill
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fill();
}

// Add to your window declarations
declare global {
  interface Window {
    gameState: typeof gameState;
    DEBUG: DebugFlags & {
      toggleAgentDebug: (index: number) => void;
    };
    changeBehavior: (agentIndex: number, behaviorName: string) => void;
  }
}

// Make gameState available globally if needed
window.gameState = gameState;

// Add the behavior change handler
window.changeBehavior = (agentIndex: number, behaviorName: string) => {
  if (gameState.getAgents()[agentIndex]) {
    gameState.getAgents()[agentIndex].setBehavior(behaviorName);
    console.log(`Changed agent ${agentIndex} behavior to ${behaviorName}`);
  }
};

// Add this function to draw the agent's path
function drawAgentPath(agent: Agent, path: Point[]) {
  // Early return if debug isn't enabled for this agent
  const agentIndex = gameState.getAgents().indexOf(agent);
  if (!window.DEBUG.agentDebug[agentIndex]) return;

  const pos = agent.getPosition();
  
  ctx.save();
  // Match the translation used in renderMap
  ctx.translate(canvas.width / 2, 100);
  
  // Draw path
  ctx.beginPath();
  
  // Start from current position (convert to isometric)
  const startIsoX = (pos.x - pos.y) * tileSize;
  const startIsoY = (pos.x + pos.y) * (tileSize/2);
  ctx.moveTo(startIsoX, startIsoY);
  
  // Draw lines to each point in the path (convert to isometric)
  path.forEach(point => {
    const isoX = (point.x - point.y) * tileSize;
    const isoY = (point.x + point.y) * (tileSize/2);
    ctx.lineTo(isoX, isoY);
  });
  
  // Make the path more visible
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Brighter yellow
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw points along the path
  path.forEach(point => {
    const isoX = (point.x - point.y) * tileSize;
    const isoY = (point.x + point.y) * (tileSize/2);
    
    ctx.beginPath();
    ctx.arc(isoX, isoY, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; // Red dots
    ctx.fill();
  });
  
  ctx.restore();
}

function handleClick(event: MouseEvent) {
  if (!canvas || !gameState) return;

  const rect = canvas.getBoundingClientRect();
  // Get mouse position relative to canvas center
  const mouseScreenX = event.clientX - rect.left - canvas.width / 2;
  const mouseScreenY = event.clientY - rect.top - 100;
  
  // First, get the tile coordinates without height offset
  const tileX = Math.floor((mouseScreenX / tileSize + mouseScreenY / (tileSize/2)) / 2);
  const tileY = Math.floor((mouseScreenY / (tileSize/2) - mouseScreenX / tileSize) / 2);
  
  // Get the height offset for this tile
  const tileType = gameState.getTileAt(tileX, tileY);
  let heightFactor = 0;
  switch (tileType) {
    case TileType.DeepWater: heightFactor = 0; break;
    case TileType.Water: heightFactor = 0.15; break;
    case TileType.Sand: heightFactor = 0.3; break;
    case TileType.Grass: heightFactor = 0.45; break;
    case TileType.Highlands: heightFactor = 0.6; break;
    case TileType.Dirt: heightFactor = 0.75; break;
    case TileType.Stone: heightFactor = 0.9; break;
    case TileType.Snow: heightFactor = 1; break;
  }
  
  // Adjust the mouse Y position by the height offset
  const verticalOffset = heightFactor * tileSize;
  const adjustedMouseY = mouseScreenY + verticalOffset;
  
  // Recalculate tile position with height-adjusted mouse position
  const adjustedTileX = Math.floor((mouseScreenX / tileSize + adjustedMouseY / (tileSize/2)) / 2);
  const adjustedTileY = Math.floor((adjustedMouseY / (tileSize/2) - mouseScreenX / tileSize) / 2);
  
  // Check if the coordinates are within bounds
  if (adjustedTileX >= 0 && adjustedTileX < gameState.getMapWidth() && 
      adjustedTileY >= 0 && adjustedTileY < gameState.getMapHeight()) {
    
    // Toggle selection
    const currentSelection = gameState.getSelectedTile();
    if (currentSelection && 
        currentSelection.x === adjustedTileX && 
        currentSelection.y === adjustedTileY) {
      gameState.setSelectedTile(null); // Deselect if clicking the same tile
    } else {
      gameState.setSelectedTile({ x: adjustedTileX, y: adjustedTileY }); // Select new tile
    }
    
    // Update UI
    updateInfoPanel();
    updateSelectedTilePanel(gameState.getSelectedTile(), gameState);
  }
}

function drawSelectedTile(ctx: CanvasRenderingContext2D) {
  const selectedTile = gameState.getSelectedTile();
  if (!selectedTile) return;

  const { x, y } = selectedTile;
  
  // Get tile type and calculate height
  const tileType = gameState.getTileAt(x, y);
  let heightFactor = 0;
  switch (tileType) {
    case TileType.DeepWater: heightFactor = 0; break;
    case TileType.Water: heightFactor = 0.15; break;
    case TileType.Sand: heightFactor = 0.3; break;
    case TileType.Grass: heightFactor = 0.45; break;
    case TileType.Highlands: heightFactor = 0.6; break;
    case TileType.Dirt: heightFactor = 0.75; break;
    case TileType.Stone: heightFactor = 0.9; break;
    case TileType.Snow: heightFactor = 1; break;
  }

  const verticalOffset = heightFactor * tileSize;

  // Convert tile coordinates to isometric position
  const isoX = (x - y) * (tileSize);
  const isoY = (x + y) * (tileSize/2) - verticalOffset;

  // Draw selection indicator
  ctx.beginPath();
  ctx.moveTo(isoX, isoY);
  ctx.lineTo(isoX + tileSize, isoY + tileSize/2);
  ctx.lineTo(isoX, isoY + tileSize);
  ctx.lineTo(isoX - tileSize, isoY + tileSize/2);
  ctx.closePath();
  
  // Draw glowing effect
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Add pulsing effect
  const pulseAmount = Math.sin(Date.now() / 500) * 0.2 + 0.4;
  ctx.fillStyle = `rgba(255, 255, 255, ${pulseAmount})`;
  ctx.fill();
}
