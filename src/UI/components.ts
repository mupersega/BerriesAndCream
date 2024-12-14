import { ResourceType } from '../Resource';
import { Agent } from '../Agent';
import { Resource } from '../Resource';
import { InventoryItem } from '../types/InventoryItem';
import { Point } from '../types/Point';

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
              <option value="Explore" ${behaviorValue === 'Explore' ? 'selected' : ''}>Explore</option>
              <option value="Forage" ${behaviorValue === 'Forage' ? 'selected' : ''}>Forage</option>
              <option value="Fell" ${behaviorValue === 'Fell' ? 'selected' : ''}>Fell</option>
            </select>
          </div>
          <button class="debug-toggle">${window.DEBUG.agentDebug[index] ? '▼' : '▶'}</button>
        </header>
        <div class="agent-stats">
          ${createProgressBar(agent.getHealth(), 'health')}
          ${renderInventory(agent.getInventory())}
          ${agent.isStuck() ? '<div class="status-warning">STUCK!</div>' : ''}
        </div>
        <div class="debug-info ${window.DEBUG.agentDebug[index] ? 'show' : ''}">
          ${renderPath(agent.getCurrentPath())}
          ${renderKnownResources(agent.getKnownResources())}
        </div>
      </div>
    `;
  }
};

export function initInfoPanel(agents: Agent[]) {
  const infoPanel = document.getElementById('infoPanel');
  
  if (!infoPanel) return;
  
  // Create HTML string for all agents
  const html = agents.map((agent, index) => 
    UIComponents.createAgentCard(agent, index)
  ).join('');

  
  // Set innerHTML once
  infoPanel.innerHTML = html;
  
  const hoverContainer = document.createElement('div');
  hoverContainer.className = 'hover-info-container';
  infoPanel.appendChild(hoverContainer);
  
  // Add event listeners and observers for each agent
  agents.forEach((agent, index) => {
    const card = infoPanel.querySelector(`[data-agent-index="${index}"]`);
    
    if (!card) return;
    
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
    
    // Add debug toggle listener
    const debugToggle = card.querySelector('.debug-toggle') as HTMLButtonElement;
    if (debugToggle) {
      debugToggle.addEventListener('click', () => {
        window.DEBUG.toggleAgentDebug(index);
      });
    }

    // Add observer for this agent's card
    agent.addObserver({
      onHealthChange: (health) => {
        const healthBar = card.querySelector('.agent-stats');
        if (healthBar) {
          healthBar.innerHTML = createProgressBar(health, 'health');
        }
      },
      onInventoryChange: (inventory) => {
        const inventoryContainer = card.querySelector('.inventory-container');
        if (inventoryContainer) {
          inventoryContainer.innerHTML = renderInventory(inventory);
        }
      },
      onStuckChange: (isStuck) => {
        const warningContainer = card.querySelector('.status-warning');
        if (isStuck && !warningContainer) {
          const statsContainer = card.querySelector('.agent-stats');
          if (statsContainer) {
            statsContainer.insertAdjacentHTML('beforeend', '<div class="status-warning">STUCK!</div>');
          }
        } else if (!isStuck && warningContainer) {
          warningContainer.remove();
        }
      },
      onPathChange: (path) => {
        if (window.DEBUG.agentDebug[index]) {
          const debugInfo = card.querySelector('.debug-info');
          if (debugInfo) {
            debugInfo.innerHTML = `
              ${renderPath(path)}
              ${renderKnownResources(agent.getKnownResources())}
            `;
          }
        }
      },
      onKnownResourcesChange: (resources) => {
        if (window.DEBUG.agentDebug[index]) {
          const debugInfo = card.querySelector('.debug-info');
          if (debugInfo) {
            debugInfo.innerHTML = `
              ${renderPath(agent.getCurrentPath())}
              ${renderKnownResources(resources)}
            `;
          }
        }
      }
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

function renderPath(path: Point[]): string {
  if (!path.length) return '';
  return `
    <div class="path-info">
      <h5>Current Path</h5>
      <div class="path-points">
        ${path.map(p => `(${p.x},${p.y})`).join(' → ')}
      </div>
    </div>
  `;
}

function renderKnownResources(resources: Resource[]): string {
  if (!resources.length) return '';
  
  // Group resources by type
  const groupedResources = resources.reduce((acc, resource) => {
    const type = ResourceType[resource.getType()];
    if (!acc[type]) acc[type] = [];
    acc[type].push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  return `
    <div class="known-resources">
      <h5>Known Resources</h5>
      <div class="resource-list">
        ${Object.entries(groupedResources).map(([type, resources]) => `
          <div class="resource-group">
            <div class="resource-type">${type} (${resources.length})</div>
            ${resources.map(resource => {
              const pos = resource.getPosition();
              const amount = resource.getAmount();
              const maxAmount = resource.getMaxAmount();
              return `
                <div class="resource-entry">
                  <div class="resource-location">(${Math.round(pos.x)}, ${Math.round(pos.y)})</div>
                  <div class="resource-amount">${amount}/${maxAmount}</div>
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
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
