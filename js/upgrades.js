/**
 * LINGUA FORGE - UPGRADE SYSTEM
 * Manages the skill tree upgrade system with progressive unlocking
 */

import { gameState, spendLetters, spendInk } from './state.js';

/**
 * Upgrade tree data structure
 * Each upgrade has:
 * - id: unique identifier
 * - name: display name
 * - description: what the upgrade does
 * - icon: SVG or emoji icon
 * - maxLevel: maximum number of levels (1 for single-level upgrades)
 * - baseCost: { renown, ink } - base cost for first level
 * - costPerLevel: { renown, ink } - additional cost per level
 * - prerequisites: array of upgrade IDs that must be purchased first (with minimum level)
 * - position: { x, y } - position on the skill tree grid
 * - connections: array of upgrade IDs this connects to visually
 * - onPurchase: function called when purchased
 */
export const UPGRADE_TREE = {
  // INITIAL UPGRADE - Center of the tree
  gripStrength: {
    id: 'gripStrength',
    name: 'Grip Strength',
    description: 'Increase grip strength by 10% per level. Allows for harder hits.',
    icon: '💪',
    maxLevel: 5,
    baseCost: { renown: 10, ink: 0 },
    costPerLevel: { renown: 10, ink: 0 },
    prerequisites: [],
    position: { x: 0, y: 0 },
    connections: ['activateHearth', 'hireScribes', 'increasePestleCap'],
    onPurchase: (level) => {
      // Each level increases ripSpeedThreshold by 10%
      const baseThreshold = 3400;
      gameState.ripSpeedThreshold = baseThreshold * Math.pow(1.1, level);
      console.log(`Grip Strength upgraded to level ${level}, threshold: ${gameState.ripSpeedThreshold}`);
    }
  },

  // TIER 1 UPGRADES - Branch from Grip Strength after level 1
  activateHearth: {
    id: 'activateHearth',
    name: 'Activate Hearth',
    description: 'Unlock the Hearth system. Feed letters to the hearth to heat up your hammer!',
    icon: '🔥',
    maxLevel: 1,
    baseCost: { renown: 15, ink: 0 },
    costPerLevel: { renown: 0, ink: 0 },
    prerequisites: [{ id: 'gripStrength', minLevel: 1 }],
    position: { x: -2, y: 1 },
    connections: ['redHotDurability', 'heatLevel', 'heatPerLetter', 'lettersPerRedHot'],
    onPurchase: () => {
      gameState.hearthUnlocked = true;
      console.log('Hearth activated!');
    }
  },

  hireScribes: {
    id: 'hireScribes',
    name: 'Hire Scribes',
    description: 'Unlock the ability to hire Scribes who automatically produce letters.',
    icon: '✍️',
    maxLevel: 1,
    baseCost: { renown: 25, ink: 0 },
    costPerLevel: { renown: 0, ink: 0 },
    prerequisites: [{ id: 'gripStrength', minLevel: 1 }],
    position: { x: 0, y: 1 },
    connections: ['scribeUse'],
    onPurchase: () => {
      gameState.scribesUnlocked = true;
      console.log('Scribes unlocked!');
    }
  },

  increasePestleCap: {
    id: 'increasePestleCap',
    name: 'Increase Pestle Cap',
    description: 'Increase the amount of letters able to be gathered by the pestle by 5 per level.',
    icon: '🥄',
    maxLevel: 5,
    baseCost: { renown: 15, ink: 10 },
    costPerLevel: { renown: 10, ink: 5 },
    prerequisites: [{ id: 'gripStrength', minLevel: 1 }],
    position: { x: 2, y: 1 },
    connections: ['lettersPerChurn'],
    onPurchase: (level) => {
      // Increase pestle capacity
      gameState.pestleCapacity = 10 + (level * 5);
      console.log(`Pestle capacity increased to ${gameState.pestleCapacity}`);
    }
  },

  // TIER 2 UPGRADES - Branch from Activate Hearth
  redHotDurability: {
    id: 'redHotDurability',
    name: 'Red Hot Durability',
    description: 'Increase the amount of Red Hot hits the player can do by 1 per level.',
    icon: '🔴',
    maxLevel: 5,
    baseCost: { renown: 12, ink: 10 },
    costPerLevel: { renown: 5, ink: 5 },
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: -3, y: 2 },
    connections: [],
    onPurchase: (level) => {
      gameState.redHotHits = 3 + level;
      console.log(`Red Hot hits increased to ${gameState.redHotHits}`);
    }
  },

  heatLevel: {
    id: 'heatLevel',
    name: 'Heat Level',
    description: 'Add another level of heat to the forge. Each level increases heat rate but also consumption.',
    icon: '🌡️',
    maxLevel: 3,
    baseCost: { renown: 40, ink: 0 },
    costPerLevel: { renown: 40, ink: 0 },
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: -2.5, y: 2 },
    connections: [],
    onPurchase: (level) => {
      gameState.heatLevels = level;
      console.log(`Heat levels increased to ${level}`);
    }
  },

  heatPerLetter: {
    id: 'heatPerLetter',
    name: 'Heat per Letter',
    description: 'Increase the amount of time generated from a letter thrown in the hearth by 1 second per level.',
    icon: '⏱️',
    maxLevel: 5,
    baseCost: { renown: 14, ink: 5 },
    costPerLevel: { renown: 24, ink: 0 },
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: -1.5, y: 2 },
    connections: [],
    onPurchase: (level) => {
      gameState.secondsPerLetter = 5 + level;
      console.log(`Seconds per letter increased to ${gameState.secondsPerLetter}`);
    }
  },

  lettersPerRedHot: {
    id: 'lettersPerRedHot',
    name: 'Letters per Red Hot',
    description: 'Increase the amount of letters produced by Red Hot hit by 1 per level.',
    icon: '📝',
    maxLevel: 3,
    baseCost: { renown: 18, ink: 0 },
    costPerLevel: { renown: 18, ink: 0 },
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: -1, y: 2 },
    connections: [],
    onPurchase: (level) => {
      gameState.lettersPerRedHot = 1 + level;
      console.log(`Letters per red hot increased to ${gameState.lettersPerRedHot}`);
    }
  },

  // TIER 2 UPGRADES - Branch from Hire Scribes
  scribeUse: {
    id: 'scribeUse',
    name: 'Scribe Efficiency',
    description: 'Increase the amount of uses per ink for each scribe by 1 per level.',
    icon: '⚡',
    maxLevel: 3,
    baseCost: { renown: 0, ink: 20 },
    costPerLevel: { renown: 0, ink: 10 },
    prerequisites: [{ id: 'hireScribes', minLevel: 1 }],
    position: { x: 0, y: 2 },
    connections: [],
    onPurchase: (level) => {
      gameState.scribeLettersPerInk = 5 + level;
      console.log(`Scribe letters per ink increased to ${gameState.scribeLettersPerInk}`);
    }
  },

  // TIER 2 UPGRADES - Branch from Increase Pestle Cap
  lettersPerChurn: {
    id: 'lettersPerChurn',
    name: 'Letters per Churn',
    description: 'Increase the amount of letters produced when the player completes 1 churn by 1 per level.',
    icon: '🌀',
    maxLevel: 3,
    baseCost: { renown: 40, ink: 30 },
    costPerLevel: { renown: 10, ink: 10 },
    prerequisites: [{ id: 'increasePestleCap', minLevel: 1 }],
    position: { x: 2, y: 2 },
    connections: [],
    onPurchase: (level) => {
      gameState.inkPerChurn = 1 + level;
      console.log(`Ink per churn increased to ${gameState.inkPerChurn}`);
    }
  }
};

/**
 * Get the current level of an upgrade
 * @param {string} upgradeId - Upgrade ID
 * @returns {number} Current level (0 if not purchased)
 */
export function getUpgradeLevel(upgradeId) {
  return gameState.upgrades[upgradeId] || 0;
}

/**
 * Check if an upgrade can be purchased
 * @param {string} upgradeId - Upgrade ID
 * @returns {Object} { canPurchase: boolean, reason: string }
 */
export function canPurchaseUpgrade(upgradeId) {
  const upgrade = UPGRADE_TREE[upgradeId];
  if (!upgrade) {
    return { canPurchase: false, reason: 'Upgrade not found' };
  }

  const currentLevel = getUpgradeLevel(upgradeId);

  // Check if already at max level
  if (currentLevel >= upgrade.maxLevel) {
    return { canPurchase: false, reason: 'Max level reached' };
  }

  // Check prerequisites
  for (const prereq of upgrade.prerequisites) {
    const prereqLevel = getUpgradeLevel(prereq.id);
    if (prereqLevel < prereq.minLevel) {
      const prereqUpgrade = UPGRADE_TREE[prereq.id];
      return {
        canPurchase: false,
        reason: `Requires ${prereqUpgrade.name} (level ${prereq.minLevel})`
      };
    }
  }

  // Calculate cost for next level
  const cost = getUpgradeCost(upgradeId, currentLevel + 1);

  // Check if player can afford it
  if (gameState.letters < cost.renown) {
    return { canPurchase: false, reason: `Need ${cost.renown} Renown` };
  }
  if (gameState.ink < cost.ink) {
    return { canPurchase: false, reason: `Need ${cost.ink} Ink` };
  }

  return { canPurchase: true, reason: '' };
}

/**
 * Get the cost for a specific level of an upgrade
 * @param {string} upgradeId - Upgrade ID
 * @param {number} level - Target level
 * @returns {Object} { renown, ink }
 */
export function getUpgradeCost(upgradeId, level) {
  const upgrade = UPGRADE_TREE[upgradeId];
  if (!upgrade) return { renown: 0, ink: 0 };

  const renown = upgrade.baseCost.renown + (upgrade.costPerLevel.renown * (level - 1));
  const ink = upgrade.baseCost.ink + (upgrade.costPerLevel.ink * (level - 1));

  return { renown, ink };
}

/**
 * Purchase an upgrade
 * @param {string} upgradeId - Upgrade ID
 * @returns {boolean} True if successful
 */
export function purchaseUpgrade(upgradeId) {
  const check = canPurchaseUpgrade(upgradeId);
  if (!check.canPurchase) {
    console.log(`Cannot purchase ${upgradeId}: ${check.reason}`);
    return false;
  }

  const upgrade = UPGRADE_TREE[upgradeId];
  const currentLevel = getUpgradeLevel(upgradeId);
  const nextLevel = currentLevel + 1;
  const cost = getUpgradeCost(upgradeId, nextLevel);

  // Spend resources
  if (!spendLetters(cost.renown)) return false;
  if (!spendInk(cost.ink)) {
    // Refund renown if ink purchase fails
    gameState.letters += cost.renown;
    return false;
  }

  // Update level
  gameState.upgrades[upgradeId] = nextLevel;

  // Call onPurchase callback
  if (upgrade.onPurchase) {
    upgrade.onPurchase(nextLevel);
  }

  console.log(`Purchased ${upgrade.name} level ${nextLevel}`);
  return true;
}

/**
 * Get all visible upgrades (unlocked or available to unlock)
 * @returns {Array} Array of upgrade IDs that should be visible
 */
export function getVisibleUpgrades() {
  const visible = new Set();

  // Always show the initial upgrade
  visible.add('gripStrength');

  // Check each upgrade to see if it should be visible
  for (const [upgradeId, upgrade] of Object.entries(UPGRADE_TREE)) {
    // If already purchased, it's visible
    if (getUpgradeLevel(upgradeId) > 0) {
      visible.add(upgradeId);

      // Show all connected upgrades
      for (const connectedId of upgrade.connections) {
        visible.add(connectedId);
      }
    }
  }

  return Array.from(visible);
}

/**
 * Check if upgrade is unlocked (visible but not necessarily purchasable)
 * @param {string} upgradeId - Upgrade ID
 * @returns {boolean} True if visible
 */
export function isUpgradeVisible(upgradeId) {
  const visibleUpgrades = getVisibleUpgrades();
  return visibleUpgrades.includes(upgradeId);
}

/**
 * Show the upgrade screen
 */
export function showUpgradeScreen() {
  const modal = document.getElementById('upgradeModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderUpgradeTree();
  }
}

/**
 * Hide the upgrade screen
 */
export function hideUpgradeScreen() {
  const modal = document.getElementById('upgradeModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Render the upgrade tree
 */
export function renderUpgradeTree() {
  const treeContainer = document.getElementById('upgradeTree');
  if (!treeContainer) return;

  const visibleUpgrades = getVisibleUpgrades();

  // Clear existing content
  treeContainer.innerHTML = '';

  // Create SVG for connection lines
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'upgrade-connections');
  treeContainer.appendChild(svg);

  // Create upgrade nodes
  const nodes = {};
  for (const upgradeId of visibleUpgrades) {
    const upgrade = UPGRADE_TREE[upgradeId];
    const node = createUpgradeNode(upgrade);
    nodes[upgradeId] = node;
    treeContainer.appendChild(node);
  }

  // Draw connection lines
  for (const upgradeId of visibleUpgrades) {
    const upgrade = UPGRADE_TREE[upgradeId];
    const currentLevel = getUpgradeLevel(upgradeId);

    // Only draw connections if this upgrade is purchased
    if (currentLevel > 0) {
      for (const connectedId of upgrade.connections) {
        if (visibleUpgrades.includes(connectedId)) {
          drawConnection(svg, nodes[upgradeId], nodes[connectedId]);
        }
      }
    }
  }
}

/**
 * Create an upgrade node element
 * @param {Object} upgrade - Upgrade data
 * @returns {HTMLElement} Upgrade node element
 */
function createUpgradeNode(upgrade) {
  const node = document.createElement('div');
  node.className = 'upgrade-node';
  node.dataset.upgradeId = upgrade.id;

  const currentLevel = getUpgradeLevel(upgrade.id);
  const maxLevel = upgrade.maxLevel;

  // Position the node
  const gridSize = 120;
  const centerX = 400;
  const centerY = 150;
  node.style.left = `${centerX + upgrade.position.x * gridSize}px`;
  node.style.top = `${centerY + upgrade.position.y * gridSize}px`;

  // Add purchased class if owned
  if (currentLevel > 0) {
    node.classList.add('purchased');
  }

  // Add max level class if at max
  if (currentLevel >= maxLevel) {
    node.classList.add('max-level');
  }

  // Icon
  const icon = document.createElement('div');
  icon.className = 'upgrade-icon';
  icon.textContent = upgrade.icon;
  node.appendChild(icon);

  // Level indicator
  const levelIndicator = document.createElement('div');
  levelIndicator.className = 'upgrade-level';
  levelIndicator.textContent = `${currentLevel}/${maxLevel}`;
  node.appendChild(levelIndicator);

  // Create tooltip
  const tooltip = createUpgradeTooltip(upgrade);
  node.appendChild(tooltip);

  // Keep tooltip inside the upgrade modal horizontally (and a bit vertically)
  node.addEventListener('mouseenter', () => {
    const container =
      document.querySelector('.upgrade-modal-content') ||
      document.querySelector('.upgrade-tree-container');
    if (!container) return;

    // Let the browser lay it out first
    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      const padding = 12; // safe margin from edges
      let offsetX = 0;
      let offsetY = -10; // your original upward offset

      // Clamp left/right
      if (tooltipRect.left < containerRect.left + padding) {
        offsetX = (containerRect.left + padding) - tooltipRect.left;
      } else if (tooltipRect.right > containerRect.right - padding) {
        offsetX = (containerRect.right - padding) - tooltipRect.right;
      }

      // Optional: stop it from going above the header area
      if (tooltipRect.top < containerRect.top + padding) {
        offsetY += (containerRect.top + padding) - tooltipRect.top;
      }

      // Override the default transform
      tooltip.style.transform = `translateX(calc(-50% + ${offsetX}px)) translateY(${offsetY}px)`;
    });
  });

  // Reset transform when leaving so transitions stay nice
  node.addEventListener('mouseleave', () => {
    tooltip.style.transform = 'translateX(-50%) translateY(-10px)';
  });

  // Add click handler
  node.addEventListener('click', () => {
    if (purchaseUpgrade(upgrade.id)) {
      renderUpgradeTree();
      if (window.updateUI) {
        window.updateUI();
      }
    }
  });

  return node;
}


/**
 * Create tooltip for an upgrade
 * @param {Object} upgrade - Upgrade data
 * @returns {HTMLElement} Tooltip element
 */
function createUpgradeTooltip(upgrade) {
  const tooltip = document.createElement('div');
  tooltip.className = 'upgrade-tooltip';

  const currentLevel = getUpgradeLevel(upgrade.id);
  const nextLevel = currentLevel + 1;

  // Title
  const title = document.createElement('div');
  title.className = 'tooltip-title';
  title.textContent = upgrade.name;
  tooltip.appendChild(title);

  // Description
  const desc = document.createElement('div');
  desc.className = 'tooltip-description';
  desc.textContent = upgrade.description;
  tooltip.appendChild(desc);

  // Level info
  const levelInfo = document.createElement('div');
  levelInfo.className = 'tooltip-level';
  levelInfo.textContent = `Level: ${currentLevel}/${upgrade.maxLevel}`;
  tooltip.appendChild(levelInfo);

  // Cost (if not at max level)
  if (currentLevel < upgrade.maxLevel) {
    const cost = getUpgradeCost(upgrade.id, nextLevel);
    const costDiv = document.createElement('div');
    costDiv.className = 'tooltip-cost';

    const costParts = [];
    if (cost.renown > 0) costParts.push(`${cost.renown} Renown`);
    if (cost.ink > 0) costParts.push(`${cost.ink} Ink`);

    costDiv.textContent = `Cost: ${costParts.join(', ')}`;
    tooltip.appendChild(costDiv);

    // Check if can afford
    const check = canPurchaseUpgrade(upgrade.id);
    if (!check.canPurchase) {
      const warning = document.createElement('div');
      warning.className = 'tooltip-warning';
      warning.textContent = check.reason;
      tooltip.appendChild(warning);
    }
  } else {
    const maxText = document.createElement('div');
    maxText.className = 'tooltip-max';
    maxText.textContent = 'MAX LEVEL';
    tooltip.appendChild(maxText);
  }

  return tooltip;
}

/**
 * Draw a connection line between two nodes
 * @param {SVGElement} svg - SVG container
 * @param {HTMLElement} fromNode - Starting node
 * @param {HTMLElement} toNode - Ending node
 */
function drawConnection(svg, fromNode, toNode) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

  const fromRect = fromNode.getBoundingClientRect();
  const toRect = toNode.getBoundingClientRect();
  const containerRect = svg.parentElement.getBoundingClientRect();

  const x1 = fromRect.left + fromRect.width / 2 - containerRect.left;
  const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
  const x2 = toRect.left + toRect.width / 2 - containerRect.left;
  const y2 = toRect.top + toRect.height / 2 - containerRect.top;

  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('class', 'upgrade-connection-line');

  svg.appendChild(line);
}
