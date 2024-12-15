import { ResourceType } from '../Resource';
import { Agent } from '../Agent';
import { Resource } from '../Resource';
import { InventoryItem } from '../types/InventoryItem';
import { Point } from '../types/Point';

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
              <option value="Explore" ${behaviorValue === 'Explore' ? 'selected' : ''}>Explore</option>
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
function createProgressBar(value: number, type: string): string {
  const percentage = Math.round(value);
  return `
    <div class="stat-container">
      <label>${type.charAt(0).toUpperCase() + type.slice(1)}</label>
      <div class="progress-bar ${type}">
        <div class="bar" style="width: ${percentage}%"></div>
        <span class="value">${percentage}%</span>
      </div>
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
