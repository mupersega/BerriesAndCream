import { Agent } from '../Agent';
import { InventoryItem } from '../types/InventoryItem';
import { Point } from '../types/Point';
import { TileType } from '../types/TileType';
import { Resource } from '../Resource';
import { ResourceType } from '../types/ResourceType';
import { gameState, GameState } from '../state/GameState';
import { getTilesInRadius } from '../utils/tileUtils';

export const UIComponents = {
  createAgentCard(agent: Agent, index: number): string {
    const behaviorValue = agent.getBehavior();
    const isDebugEnabled = false;
    
    return `
      <div class="agent-card" data-agent-index="${index}">
        <header class="agent-header">
          <h4>Agent ${index + 1}</h4>
          <div class="behavior-controls">
            <select class="behavior-select" data-agent-index="${index}">
              <option value="Idle" ${behaviorValue === 'Idle' ? 'selected' : ''}>Idle</option>
              <option value="Forage" ${behaviorValue === 'Forage' ? 'selected' : ''}>Forage</option>
              <option value="Fell" ${behaviorValue === 'Fell' ? 'selected' : ''}>Fell</option>
            </select>
          </div>
          <button class="debug-toggle">▶</button>
        </header>
        <div class="debug-info">
          ${createProgressBar(agent.getHealth(), 'health')}
          ${renderInventory(agent.getInventory())}
          ${agent.isStuck() ? '<div class="status-warning">STUCK!</div>' : ''}
        </div>
      </div>
    `;
  }
};

export function initInfoPanel(agents: Agent[]) {
  const infoPanel = document.getElementById('infoPanel');
  
  if (!infoPanel) return;
  
  // Initialize debug array with all false values
  window.DEBUG.agentDebug = new Array(agents.length).fill(false);
  
  // Create HTML string for all agents
  const html = agents.map((agent, index) => 
    UIComponents.createAgentCard(agent, index)
  ).join('');
  
  infoPanel.innerHTML = html;
  
  const hoverContainer = document.createElement('div');
  hoverContainer.className = 'hover-info-container';
  infoPanel.appendChild(hoverContainer);
  
  // Add event listeners and observers for each agent
  agents.forEach((agent, index) => {
    const card = infoPanel.querySelector(`[data-agent-index="${index}"]`);
    
    if (!card) return;
    
    // Add debug toggle listener with explicit debug state handling
    const debugToggle = card.querySelector('.debug-toggle');
    const debugInfo = card.querySelector('.debug-info');
    
    if (debugToggle && debugInfo) {
      debugToggle.addEventListener('click', () => {
        window.DEBUG.agentDebug[index] = !window.DEBUG.agentDebug[index];
        debugToggle.textContent = window.DEBUG.agentDebug[index] ? '▼' : '▶';
        debugInfo.classList.toggle('show', window.DEBUG.agentDebug[index]);
        // render inventory
        const inventoryContainer = debugInfo.querySelector('.inventory-container');
        if (inventoryContainer) {
          inventoryContainer.outerHTML = renderInventory(agent.getInventory());
        }
        console.log(`Debug toggled for agent ${index}:`, window.DEBUG.agentDebug[index]); // Debug log
      });

      // Set initial state
      debugToggle.textContent = window.DEBUG.agentDebug[index] ? '▼' : '▶';
      debugInfo.classList.toggle('show', window.DEBUG.agentDebug[index]);
    }

    // Add behavior select listener
    const select = card.querySelector('.behavior-select') as HTMLSelectElement;
    
    if (select) {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const newBehavior = target.value;
        console.log('[UI] Select changed:', { 
          agentIndex: index, 
          newBehavior, 
          event: e 
        });
        window.changeBehavior(index, newBehavior);
      });
    } else {
      console.warn(`[InitInfoPanel] Could not find select element for agent ${index}`);
    }
    
    // Add observer for this agent's card
    agent.addObserver({
      onHealthChange: (health) => {
        if (window.DEBUG.agentDebug[index]) {
          const debugInfo = card.querySelector('.debug-info');
          if (debugInfo) {
            const healthBar = debugInfo.querySelector('.stat-container');
            if (healthBar) {
              healthBar.innerHTML = createProgressBar(health, 'health');
            }
          }
        }
      },
      onInventoryChange: (inventory) => {
        if (window.DEBUG.agentDebug[index]) {
          const debugInfo = card.querySelector('.debug-info');
          if (debugInfo) {
            const inventoryContainer = debugInfo.querySelector('.inventory-container');
            if (inventoryContainer) {
              inventoryContainer.outerHTML = renderInventory(inventory);
            }
          }
        }
      },
      onStuckChange: (isStuck) => {
        if (window.DEBUG.agentDebug[index]) {
          const debugInfo = card.querySelector('.debug-info');
          if (debugInfo) {
            const warningContainer = debugInfo.querySelector('.status-warning');
            if (isStuck && !warningContainer) {
              debugInfo.insertAdjacentHTML('beforeend', '<div class="status-warning">STUCK!</div>');
            } else if (!isStuck && warningContainer) {
              warningContainer.remove();
            }
          }
        }
      },
    });
  });
}

// Keep the helper functions
function createProgressBar(value: number, type: string, maxValue?: number): string {
  const percentage = Math.round((value / (maxValue || 100)) * 100);
  const isAmount = type === 'amount';
  const style = maxValue && maxValue > 10 ? 'dotted' : 'segmented';
  return `
    <div class="stat-container">
      <label>${type.charAt(0).toUpperCase() + type.slice(1)}</label>
      <div class="progress-bar ${type}" ${maxValue ? `style="--max-segments: ${maxValue}"` : ''} ${isAmount ? `data-style="${style}"` : ''}>
        <div class="bar ${type}" style="width: ${percentage}%"></div>
      </div>
      <span class="value">${isAmount ? `${value}/${maxValue}` : percentage + '%'}</span>
    </div>
  `;
}

function renderInventory(inventory: (InventoryItem | null)[]): string {
  return `
    <div class="inventory-container">
      <h5>Inventory</h5>
      <div class="inventory-grid">
        ${inventory.map((slot, index) => `
          <div class="inventory-slot ${slot ? 'filled' : 'empty'}">
            ${slot ? `
              <div class="item ${slot.type.toLowerCase()}">
                <span class="item-quantity">${slot.quantity}</span>
                <span class="item-type">${slot.type}</span>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

export function initSelectedTilePanel() {
  const uiContainer = document.querySelector('.ui');
  if (!uiContainer) return;

  // Create selected tile panel
  const selectedTilePanel = document.createElement('div');
  selectedTilePanel.className = 'selected-tile-panel';
  selectedTilePanel.innerHTML = `
    <h3>Selected Tile</h3>
    <div class="selected-tile-content"></div>
  `;
  
  uiContainer.appendChild(selectedTilePanel);
}

export function updateSelectedTilePanel(selectedTile: Point | null, gameState: GameState) {
  const selectedTileContent = document.querySelector('.selected-tile-content');
  if (!selectedTileContent) return;

  if (!selectedTile) {
    selectedTileContent.innerHTML = '<p>No tile selected</p>';
    return;
  }

  const tile = gameState.getTileAt(selectedTile.x, selectedTile.y);
  
  // Get resources at the selected tile
  const resourcesAtTile = gameState.getResources().filter(resource => {
    const pos = resource.getPosition();
    return pos.x === selectedTile.x && pos.y === selectedTile.y;
  });

  let resourcesHtml = '';
  if (resourcesAtTile.length > 0) {
    resourcesHtml = `
      <div class="resources-info">
        <h4>Resources</h4>
        ${resourcesAtTile.map(resource => `
          <div class="resource-item">
            <span class="resource-type">${ResourceType[resource.getType()]}</span>
            <div class="resource-amount">
              ${createProgressBar(
                resource.getAmount(),
                'amount',
                resource.getMaxAmount()
              )}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  selectedTileContent.innerHTML = `
    <p>Position: (${selectedTile.x}, ${selectedTile.y})</p>
    <p>Type: ${TileType[tile]}</p>
    ${resourcesHtml}
  `;
}

export function initActionPanel() {
  const uiContainer = document.querySelector('.ui');
  if (!uiContainer) return;

  // Create action panel with toggle buttons
  const actionPanel = document.createElement('div');
  actionPanel.className = 'action-panel';
  actionPanel.innerHTML = `
    <div class="action-group">
      <button class="action-button find-button">Find in Area (1-5)</button>
      <button class="toggle-button find-toggle" data-active="true">👁</button>
    </div>
    <div class="action-group">
    <button class="action-button forage-button">Forage in Area</button>
    <button class="toggle-button forage-toggle" data-active="true">👁</button>
    </div>
    <div class="action-group">
      <button class="action-button fell-button">Fell in Area</button>
      <button class="toggle-button fell-toggle" data-active="true">👁</button>
    </div>
    <button class="action-button clear-button">Clear All Areas (C)</button>
  `;
  
  uiContainer.appendChild(actionPanel);

  // Add visibility state to window.DEBUG
  window.DEBUG.showFindableTiles = true;
  window.DEBUG.showForageableTiles = true;
  window.DEBUG.showFellableTiles = true;

  // Add click handlers for toggles
  const findToggle = actionPanel.querySelector('.find-toggle');
  const forageToggle = actionPanel.querySelector('.forage-toggle');
  const fellToggle = actionPanel.querySelector('.fell-toggle');

  findToggle?.addEventListener('click', () => {
    const button = findToggle as HTMLButtonElement;
    window.DEBUG.showFindableTiles = !window.DEBUG.showFindableTiles;
    button.dataset.active = window.DEBUG.showFindableTiles.toString();
  });

  forageToggle?.addEventListener('click', () => {
    const button = forageToggle as HTMLButtonElement;
    window.DEBUG.showForageableTiles = !window.DEBUG.showForageableTiles;
    button.dataset.active = window.DEBUG.showForageableTiles.toString();
  });

  fellToggle?.addEventListener('click', () => {
    console.log('Fell toggle clicked');
    const button = fellToggle as HTMLButtonElement;
    window.DEBUG.showFellableTiles = !window.DEBUG.showFellableTiles;
    button.dataset.active = window.DEBUG.showFellableTiles.toString();
  });

  // Add click handlers
  const findButton = actionPanel.querySelector('.find-button');
  const forageButton = actionPanel.querySelector('.forage-button');
  const fellButton = actionPanel.querySelector('.fell-button');
  const clearButton = actionPanel.querySelector('.clear-button');

  if (findButton) {
    findButton.addEventListener('click', () => {
      const selectedTile = gameState.getSelectedTile();
      if (!selectedTile) return;

      const tilesInRadius = getTilesInRadius(selectedTile, 8, gameState);
      tilesInRadius.forEach(tile => {
        gameState.markTileAsFindable(tile.x, tile.y);
      });
    });
  }

  if (forageButton) {
    forageButton.addEventListener('click', () => {
      const selectedTile = gameState.getSelectedTile();
      if (!selectedTile) return;

      const tilesInRadius = getTilesInRadius(selectedTile, 5, gameState);
      tilesInRadius.forEach(tile => {
        gameState.markTileAsForageable(tile.x, tile.y);
      });
    });
  }

  if (fellButton) {
    fellButton.addEventListener('click', () => {
      const selectedTile = gameState.getSelectedTile();
      console.log('Fell button clicked');
      if (!selectedTile) return;

      const tilesInRadius = getTilesInRadius(selectedTile, 5, gameState);
      tilesInRadius.forEach(tile => {
        gameState.markTileAsFellable(tile.x, tile.y);
      });
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      gameState.clearAllMarkedTiles();
    });
  }

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only trigger if not typing in an input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case '1':
        findButton?.click();
        break;
      case '2':
        forageButton?.click();
        break;
      case '3':
        fellButton?.click();
        break;
      case 'c':
        clearButton?.click();
        break;
    }
  });
}
