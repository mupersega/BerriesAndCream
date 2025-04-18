import './style.scss'

import { Dijkstra } from './pathfinding/Dijkstra';
import { TileType } from './types/TileType';
import { initInfoPanel, initSelectedTilePanel, updateSelectedTilePanel, initActionPanel, initHoverInfo, initResourceCounter, initHelperText } from './UI/components';
import { Point } from './types/Point';
import { gameState } from './state/GameState';
import { RenderSystem } from './rendering/RenderingSystem';
import { BaseAgent } from './agents/BaseAgent';

import { IDrawable } from './interfaces/IDrawable';
import { Quadtree } from './state/Quadtree';

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
      let centerX: number, centerY: number;
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

  // TODO: include number of rivers as a parameter
  public generateRivers() {
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
function generateTileMap(width: number, height: number): TileType[][] {
  const heightMap = new HeightMapGenerator(width, height);
  // heightMap.smooth(2); // Reduced from 3 to 1 pass of smoothing
  heightMap.generateRivers();
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

// Add at the top with other globals
interface DebugFlags {
  showFindableTiles: boolean;
  showForageableTiles: boolean;
  showFellableTiles: boolean;
  showFetchableTiles: boolean;
  isPaused: boolean;
  agentDebug: boolean[];
  toggleAgentDebug: (index: number) => void;
}

// Make DEBUG globally accessible
window.DEBUG = {
  isPaused: false,
  showFindableTiles: false,
  showForageableTiles: false,
  showFellableTiles: false,
  showFetchableTiles: false,
  agentDebug: [],
  toggleAgentDebug: (index: number) => {
    window.DEBUG.agentDebug[index] = !window.DEBUG.agentDebug[index];
    updateInfoPanel();
    console.log(`Toggled debug for agent ${index}:`, window.DEBUG.agentDebug[index]);
  }
};

// Add at the top with other globals
const agentQuadtree = new Quadtree({
  x: 0,
  y: 0,
  width: mapWidth,
  height: mapHeight
});

// Modify the gameLoop function
function gameLoop() {
  if (!window.DEBUG.isPaused) {
    // Clear quadtree at the start of each frame
    agentQuadtree.clear();
    
    // Update agents and add them to quadtree
    gameState.getAgents().forEach(agent => {
      if (agent && !agent.isDead()) {
        agent.update();
        
        // Add agent to quadtree
        const pos = agent.getPosition();
        agentQuadtree.insert({
          x: pos.x,
          y: pos.y,
          data: agent
        });
      }
    });

    // Example: Check for collisions between agents
    gameState.getAgents().forEach(agent => {
      if (agent && !agent.isDead()) {
        const pos = agent.getPosition();
        
        // Increase query area to detect agents further away
        const searchRadius = 2; // Increased from 1
        const nearbyPoints = agentQuadtree.query({
          x: pos.x - searchRadius,
          y: pos.y - searchRadius,
          width: searchRadius * 2,
          height: searchRadius * 2
        });

        // Filter out self and process nearby agents
        const nearbyAgents = nearbyPoints
          .filter(point => point.data !== agent)
          .map(point => point.data);

        // Enhanced collision response
        nearbyAgents.forEach(otherAgent => {
          const otherPos = otherAgent.getPosition();
          const dx = pos.x - otherPos.x;
          const dy = pos.y - otherPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const minDistance = 1.0;
          
          if (distance < minDistance) {
            // Calculate normalized direction vector
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Calculate perpendicular vector (rotated 90 degrees clockwise)
            // This creates a rightward sidestep motion
            const px = ny;  // Perpendicular x component
            const py = -nx; // Perpendicular y component
            
            // Calculate relative velocity
            const v1 = agent.getVelocity();
            const v2 = otherAgent.getVelocity();
            const relativeVx = v1.x - v2.x;
            const relativeVy = v1.y - v2.y;
            
            // Calculate push strength with overlap
            const overlap = minDistance - distance;
            const relativeSpeed = nx * relativeVx + ny * relativeVy;
            const pushStrength = Math.max(0.3, overlap * 0.8 - relativeSpeed * 0.5);
            
            // Combine separation force with rightward sidestep
            const sideStepStrength = 0.4; // Adjust this to control sidestep strength
            const forceX = (nx * pushStrength) + (px * sideStepStrength);
            const forceY = (ny * pushStrength) + (py * sideStepStrength);
            
            // Apply forces to both agents
            agent.applyForce(forceX, forceY);
            otherAgent.applyForce(-forceX, -forceY);
          }
        });
      }
    });
  }
  
  // Render map using the map from gameState
  renderDynamics();

  requestAnimationFrame(gameLoop);
}

function renderDynamics() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, 100);


  // Draw all overlays in a single batch
  drawTileOverlays(ctx);

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
  initHoverInfo();
  setTimeout(() => {
    initHelperText();
  }, 2000);
  initActionPanel();
  renderBackground(map);
  renderDynamics();
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

  // antialiasing
  // mainCtx.imageSmoothingEnabled = true;
  // mainCtx.imageSmoothingQuality = 'low';

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
  // const hoveredResource = gameState.getResources().find(resource => {
  //   const pos = resource.getPosition();
  //   return pos.x === mouseX && pos.y === mouseY;
  // }) || null;
  
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
  initScrollZones();
  
  // Start the game loop
  requestAnimationFrame(gameLoop);
  requestAnimationFrame(scrollLoop);
}

// Update the updateInfoPanel function to use UIComponents
function updateInfoPanel() {
  const tileInfo = document.querySelector('.tile-info');
  if (!tileInfo || !gameState) return;

  // Tile info (when hovering)
  if (mouseX >= 0 && mouseY >= 0 && mouseX < mapWidth && mouseY < mapHeight) {
    const tile = gameState.getTileAt(mouseX, mouseY);
    const tileInfoContent = `
      <p class="tile-info">${TileType[tile]} (${mouseX}, ${mouseY})</p>
    `;
    tileInfo.outerHTML = tileInfoContent;
  }
}

// Split render into static and dynamic parts
function renderBackground(map: TileType[][]) {
  backgroundCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

  // backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  // add another gradient pass
  const gradient = backgroundCtx.createLinearGradient(0, 0, 0, backgroundCanvas.height);
  gradient.addColorStop(0, 'rgba(52, 245, 255, 0.94)');
  gradient.addColorStop(1, 'rgba(255, 81, 0, 0.65)');
  backgroundCtx.fillStyle = gradient;
  backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  const bgGrd = backgroundCtx.createRadialGradient(
    backgroundCanvas.width / 2,
    backgroundCanvas.height / 2,
    0,
    backgroundCanvas.width / 2,
    backgroundCanvas.height / 2,
    backgroundCanvas.width / 2,
  );
  bgGrd.addColorStop(0, 'rgba(87, 87, 87, 0.88)');
  bgGrd.addColorStop(0.3, 'rgba(44, 44, 44, 0.7)');
  bgGrd.addColorStop(1, 'rgba(0, 0, 0, 0.93)');


  backgroundCtx.fillStyle = bgGrd;
  backgroundCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

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
  nodes.forEach((node) => {
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
      dec.points.forEach((point: Point, index: number) => {
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
    gameState.getAgents()[agentIndex].setNewBehavior(behaviorName);
    console.log(`Changed agent ${agentIndex} behavior to ${behaviorName}`);
  }
};

// Add this function to draw the agent's path
function drawAgentPath(agent: BaseAgent, path: Point[]) {
  // Early return if debug isn't enabled for this agent
  const agentIndex = gameState.getAgents().indexOf(agent);
  if (!window.DEBUG.agentDebug[agentIndex]) return;

  const pos = agent.getPosition();
  
  ctx.save();
  // Match the translation used in renderDynamics
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
  ctx.strokeStyle = 'rgba(0, 42, 255, 0.62)'; // Brighter yellow
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Draw points along the path
  path.forEach(point => {
    const isoX = (point.x - point.y) * tileSize;
    const isoY = (point.x + point.y) * (tileSize/2);
    
    ctx.beginPath();
    ctx.arc(isoX, isoY, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 170, 255, 0.61)'; // Red dots
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

// Helper function to draw all tile overlays efficiently
function drawTileOverlays(ctx: CanvasRenderingContext2D) {
  // Start a single path for all overlays
  ctx.beginPath();

  // Draw findable tiles
  if (window.DEBUG.showFindableTiles) {
    gameState.getFindableTiles().forEach(tile => {
      const tileType = gameState.getTileAt(tile.x, tile.y);
      const heightFactor = getTileHeightFactor(tileType);
      const verticalOffset = heightFactor * tileSize;
      
      const isoX = (tile.x - tile.y) * tileSize;
      const isoY = (tile.x + tile.y) * (tileSize/2) - verticalOffset;
      
      // Add to path instead of creating new one
      ctx.moveTo(isoX, isoY);
      ctx.lineTo(isoX + tileSize, isoY + tileSize/2);
      ctx.lineTo(isoX, isoY + tileSize);
      ctx.lineTo(isoX - tileSize, isoY + tileSize/2);
      ctx.closePath();
    });
  }
  
  // Fill all findable tiles at once
  ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
  ctx.fill();
  
  // Start new path for forageable tiles
  ctx.beginPath();
  
  // Draw forageable tiles
  if (window.DEBUG.showForageableTiles) {
    gameState.getForageableTiles().forEach(tile => {
      const tileType = gameState.getTileAt(tile.x, tile.y);
      const heightFactor = getTileHeightFactor(tileType);
      const verticalOffset = heightFactor * tileSize;
      
      const isoX = (tile.x - tile.y) * tileSize;
      const isoY = (tile.x + tile.y) * (tileSize/2) - verticalOffset;
      
      // Add to path instead of creating new one
      ctx.moveTo(isoX, isoY);
      ctx.lineTo(isoX + tileSize, isoY + tileSize/2);
      ctx.lineTo(isoX, isoY + tileSize);
      ctx.lineTo(isoX - tileSize, isoY + tileSize/2);
      ctx.closePath();
    });
  }
  
  // Fill all forageable tiles at once
  ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
  ctx.fill();

  // Draw fellable tiles
  ctx.beginPath();
  if (window.DEBUG.showFellableTiles) {
    gameState.getFellableTiles().forEach(tile => {
      const tileType = gameState.getTileAt(tile.x, tile.y);
      const heightFactor = getTileHeightFactor(tileType);
      const verticalOffset = heightFactor * tileSize;
      
      const isoX = (tile.x - tile.y) * tileSize;
      const isoY = (tile.x + tile.y) * (tileSize/2) - verticalOffset;
      
      ctx.moveTo(isoX, isoY);
      ctx.lineTo(isoX + tileSize, isoY + tileSize/2);
      ctx.lineTo(isoX, isoY + tileSize);
      ctx.lineTo(isoX - tileSize, isoY + tileSize/2);
      ctx.closePath();
    });
  }
  ctx.fillStyle = 'rgba(128, 128, 128, 0.3)';
  ctx.fill();

  // Draw fetchable tiles
  ctx.beginPath();
  if (window.DEBUG.showFetchableTiles) {
    gameState.getFetchableTiles().forEach(tile => {
      const tileType = gameState.getTileAt(tile.x, tile.y);
      const heightFactor = getTileHeightFactor(tileType);
      const verticalOffset = heightFactor * tileSize;
      
      const isoX = (tile.x - tile.y) * tileSize;
      const isoY = (tile.x + tile.y) * (tileSize/2) - verticalOffset;
      
      ctx.moveTo(isoX, isoY);
      ctx.lineTo(isoX + tileSize, isoY + tileSize/2);
      ctx.lineTo(isoX, isoY + tileSize);
      ctx.lineTo(isoX - tileSize, isoY + tileSize/2);
      ctx.closePath();
    });
  }
  // Light pink for fetch overlay
  ctx.fillStyle = 'rgba(255, 192, 203, 0.6)';
  ctx.fill();
}

// Helper function to get height factor (move this outside if not already defined)
function getTileHeightFactor(tileType: TileType): number {
  switch (tileType) {
    case TileType.DeepWater: return 0;
    case TileType.Water: return 0.15;
    case TileType.Sand: return 0.3;
    case TileType.Grass: return 0.45;
    case TileType.Highlands: return 0.6;
    case TileType.Dirt: return 0.75;
    case TileType.Stone: return 0.9;
    case TileType.Snow: return 1;
    default: return 0;
  }
}

// Scroll state
let currentScrollSpeed = 3;
let scrollDirection: { x: number; y: number; } = { x: 0, y: 0 };

// Use requestAnimationFrame for smooth scrolling
function scrollLoop() {
  const app = document.getElementById('app');
  if (!app) return requestAnimationFrame(scrollLoop);

  const isMoving = scrollDirection.x !== 0 || scrollDirection.y !== 0;
  if (isMoving) {
    app.scroll({
      left: app.scrollLeft + scrollDirection.x * currentScrollSpeed,
      top: app.scrollTop + scrollDirection.y * currentScrollSpeed,
      behavior: 'instant'
    });
  }
  requestAnimationFrame(scrollLoop);
}

// Keep track of which keys are currently pressed
const pressedKeys = new Set<string>();

function initScrollZones() {

  // Handle key presses
  document.addEventListener('keydown', (event) => {
    if (['w', 'a', 's', 'd'].includes(event.key)) {
      pressedKeys.add(event.key);
      updateScrollDirection();
    }
  });

  // Handle key releases
  document.addEventListener('keyup', (event) => {
    if (['w', 'a', 's', 'd'].includes(event.key)) {
      pressedKeys.delete(event.key);
      updateScrollDirection();
    }
  });
}

function updateScrollDirection() {
  // Reset scroll direction
  scrollDirection = { x: 0, y: 0 };

  // Update based on currently pressed keys
  if (pressedKeys.has('w')) scrollDirection.y += -1;
  if (pressedKeys.has('s')) scrollDirection.y += 1;
  if (pressedKeys.has('a')) scrollDirection.x += -1;
  if (pressedKeys.has('d')) scrollDirection.x += 1;

  // Normalize diagonal movement (optional)
  if (scrollDirection.x !== 0 && scrollDirection.y !== 0) {
    const length = Math.sqrt(scrollDirection.x * scrollDirection.x + scrollDirection.y * scrollDirection.y);
    scrollDirection.x /= length;
    scrollDirection.y /= length;
  }
}

// Add this with your other UI initialization calls
initResourceCounter();
