import { Agent } from '../Agent';
import { InventoryItem } from '../types/InventoryItem';
import { Point } from '../types/Point';
import { TileType } from '../types/TileType';
import { ResourceType } from '../types/ResourceType';
import { gameState, GameState } from '../state/GameState';
import { getTilesInRadius } from '../utils/tileUtils';

export const UIComponents = {
  createAgentCard(agent: Agent, index: number): string {
    const behaviorValue = agent.getBehavior();
    
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
      ${isAmount ? '' :`<label>${type.charAt(0).toUpperCase() + type.slice(1)}</label>`}
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

export function initHoverInfo() {
  const hoverContainer = document.createElement('div');
  hoverContainer.className = 'hover-info-container';
  document.body.appendChild(hoverContainer);
}

export function updateHoverInfo(hoverContainer: HTMLElement, selectedTile: Point | null, gameState: GameState) {
  if (!hoverContainer || !selectedTile || !gameState) return;

  const tile = gameState.getTileAt(selectedTile.x, selectedTile.y);
  hoverContainer.innerHTML = `
    <p class="tile-info">${TileType[tile]} (${selectedTile.x}, ${selectedTile.y})</p>
  `;
}

export function initSelectedTilePanel() {
  const uiContainer = document.querySelector('.ui');
  if (!uiContainer) return;

  // Create selected tile panel
  const selectedTilePanel = document.createElement('div');
  selectedTilePanel.className = 'selected-tile-panel';
  selectedTilePanel.innerHTML = `
    <div class="selected-tile-content">
    </div>
  `;

  selectedTilePanel.style.display = 'none';
  uiContainer.appendChild(selectedTilePanel);
}

export function updateSelectedTilePanel(selectedTile: Point | null, gameState: GameState) {
  const selectedTileContent = document.querySelector('.selected-tile-content');
  const selectedTilePanel = document.querySelector('.selected-tile-panel');
  if (!selectedTileContent || !selectedTilePanel) return;

  if (!selectedTile) {
    if (selectedTilePanel) {
      (selectedTilePanel as HTMLElement).style.display = 'none';
    }
    return;
  }
  
  // Get resources at the selected tile
  const resourcesAtTile = gameState.getResources().filter(resource => {
    const pos = resource.getPosition();
    return pos.x === selectedTile.x && pos.y === selectedTile.y;
  });

  if (resourcesAtTile.length === 0) {
    if (selectedTilePanel) {
      (selectedTilePanel as HTMLElement).style.display = 'none';
    }
    return;
  }

  (selectedTilePanel as HTMLElement).style.display = 'block';

  let resourcesHtml = '';
  if (resourcesAtTile.length > 0) {
    resourcesHtml = `
      <div class="resources-info">
        ${resourcesAtTile.length === 0 ? '<p>No resources at this tile</p>' : ''}
        ${resourcesAtTile.map(resource => `
          <div class="resource-item">
            <div class="resource-type">${ResourceType[resource.getType()]} </div>
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
    ${resourcesHtml}
  `;
}

export function initActionPanel() {
  const uiContainer = document.querySelector('.ui');
  if (!uiContainer) return;

  const actionPanel = document.createElement('div');
  actionPanel.className = 'action-panel';
  actionPanel.innerHTML = `
    <div class="action-group">
      <button class="toggle-button find-toggle" data-active="true">👁</button>
      <button class="action-button find-button">Find</button>
      <button class="toggle-button find-clear">✕</button>
    </div>
    <div class="action-group">
      <button class="toggle-button forage-toggle" data-active="true">👁</button>
      <button class="action-button forage-button">Forage</button>
      <button class="toggle-button forage-clear">✕</button>
    </div>
    <div class="action-group">
      <button class="toggle-button fell-toggle" data-active="true">👁</button>
      <button class="action-button fell-button">Fell</button>
      <button class="toggle-button fell-clear">✕</button>
    </div>
    <div class="separator"></div>
    <button class="action-button clear-all-button">Clear All (C)</button>
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
    gameState.toggleFindableTiles();
    button.dataset.active = gameState.isShowingFindableTiles().toString();
  });

  forageToggle?.addEventListener('click', () => {
    const button = forageToggle as HTMLButtonElement;
    gameState.toggleForageableTiles();
    button.dataset.active = gameState.isShowingForageableTiles().toString();
  });

  fellToggle?.addEventListener('click', () => {
    const button = fellToggle as HTMLButtonElement;
    gameState.toggleFellableTiles();
    button.dataset.active = gameState.isShowingFellableTiles().toString();
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
        // ensure findable tiles are visible
        if (!gameState.isShowingFindableTiles()) {
          gameState.toggleFindableTiles();
          // set toggle button to active
          if (findToggle) {
            (findToggle as HTMLButtonElement).dataset.active = 'true';
          }
        }
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
        // ensure forageable tiles are visible
        if (!gameState.isShowingForageableTiles()) {
          gameState.toggleForageableTiles();
          // set toggle button to active
          if (forageToggle) {
            (forageToggle as HTMLButtonElement).dataset.active = 'true';
          }
        }
      });
    });
  }

  if (fellButton) {
    fellButton.addEventListener('click', () => {
      const selectedTile = gameState.getSelectedTile();
      if (!selectedTile) return;

      const tilesInRadius = getTilesInRadius(selectedTile, 5, gameState);
      tilesInRadius.forEach(tile => {
        gameState.markTileAsFellable(tile.x, tile.y);
        // ensure fellable tiles are visible
        if (!gameState.isShowingFellableTiles()) {
          gameState.toggleFellableTiles();
          // set toggle button to active
          if (fellToggle) {
            (fellToggle as HTMLButtonElement).dataset.active = 'true';
          }
        }
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
        (findButton as HTMLButtonElement).click();
        break;
      case '2':
        (forageButton as HTMLButtonElement).click();
        break;
      case '3':
        (fellButton as HTMLButtonElement).click();
        break;
      case 'c':
        (clearButton as HTMLButtonElement).click();
        break;
    }
  });

  // Update clear button handlers
  const findClear = actionPanel.querySelector('.find-clear');
  const forageClear = actionPanel.querySelector('.forage-clear');
  const fellClear = actionPanel.querySelector('.fell-clear');

  findClear?.addEventListener('click', () => {
    gameState.clearFindableTiles();
  });

  forageClear?.addEventListener('click', () => {
    gameState.clearForageableTiles();
  });

  fellClear?.addEventListener('click', () => {
    gameState.clearFellableTiles();
  });
}
