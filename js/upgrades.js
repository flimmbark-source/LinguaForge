/**
 * LINGUA FORGE - UPGRADE SYSTEM
 * Node-based skill tree with progressive unlock and reveal
 */

import { gameState, spendLetters, spendInk } from './state.js';
import { updateHearthVisuals } from './hearth.js';

/**
 * Node type definitions for visual styling
 * - circle: round nodes (primary path upgrades)
 * - square: square nodes with rounded corners (secondary upgrades)
 */
const NODE_SHAPES = {
  CIRCLE: 'circle',
  SQUARE: 'square'
};

/**
 * Node color types
 * - teal: primary/core upgrades
 * - pink: combat/offensive upgrades  
 * - yellow: special/utility upgrades
 */
const NODE_COLORS = {
  TEAL: 'teal',
  PINK: 'pink',
  YELLOW: 'yellow'
};

// Big virtual canvas so we can scroll in all directions
const VIRTUAL_TREE_SIZE = 3000; // pixels, square canvas
let hasCenteredUpgradeTree = false;

/**
 * Upgrade tree data structure
 * Each upgrade has:
 * - id: unique identifier
 * - name: display name
 * - description: what the upgrade does
 * - icon: emoji icon
 * - maxLevel: maximum levels
 * - baseCost/costPerLevel: scaling costs
 * - prerequisites: required upgrades
 * - position: { x, y } grid position (center = 0,0)
 * - connections: visual connections to other nodes
 * - nodeShape: circle or square
 * - nodeColor: teal, pink, or yellow
 * - onPurchase: callback when purchased
 */
export const UPGRADE_TREE = {
  // ===============================================
  // CENTER - STARTING NODE
  // ===============================================
    activateHearth: {
    id: 'activateHearth',
    name: 'Activate Hearth',
    description: 'Unlock the Hearth system. Feed letters to the hearth to heat up your hammer!',
    icon: '🔥',
    maxLevel: 1,
    baseCost: { renown: 15, ink: 0 },
    costPerLevel: { renown: 0, ink: 0 },
    prerequisites: [],
    position: { x: 0, y: 0 },
    connections: ['gripStrength','heatLevel', 'hireScribes', 'unlockPestle'],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.PINK,
    onPurchase: () => {
      gameState.hearthUnlocked = true;
      gameState.hearthTurnedon = true;
      updateHearthVisuals();
    }
  },

  // ===============================================
  // TIER 1 - BRANCH FROM CENTER
  // ===============================================
gripStrength: {
    id: 'gripStrength',
    name: 'Grip Strength',
    description: 'Increase grip strength by 10% per level. Allows for harder hits.',
    icon: '💪',
    maxLevel: 5,
    baseCost: { renown: 10, ink: 0 },
    costPerLevel: { renown: 10, ink: 0 },
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: -2, y: 1 },
    connections: [],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.TEAL,
    onPurchase: (level) => {
      const baseThreshold = 3400;
      gameState.ripSpeedThreshold = baseThreshold * Math.pow(1.1, level);
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
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: 0, y: 1.5 },
    connections: ['scribeUse', 'scribeSpeed', 'scribeCapacity'],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.TEAL,
    onPurchase: () => {
      gameState.scribesUnlocked = true;
    }
  },

  unlockPestle: {
    id: 'unlockPestle',
    name: 'Unlock Pestle',
    description: 'Unlock the Pestel to produce Ink from letter blocks.',
    icon: '🥄',
    maxLevel: 1,
    baseCost: { renown: 15, ink: 0 },
    costPerLevel: { renown: 0, ink: 0 },
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: 2, y: 1 },
    connections: ['increasePestleCap', 'unlockShovel'],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.YELLOW,
    onPurchase: () => {
    gameState.pestleUnlocked = true;
    }
  },

  // ===============================================
  // TIER 2 - HEARTH BRANCH
  // ===============================================
    increasePestleCap: {
    id: 'increasePestleCap',
    name: 'Pestle Capacity',
    description: 'Increase letters gathered by pestle by 5 per level.',
    icon: '🥄',
    maxLevel: 5,
    baseCost: { renown: 15, ink: 10 },
    costPerLevel: { renown: 10, ink: 5 },
    prerequisites: [{ id: 'unlockPestle', minLevel: 1 }],
    position: { x: 2, y: 2 },
    connections: ['lettersPerChurn', 'churnSpeed'],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.YELLOW,
    onPurchase: (level) => {
      gameState.pestleCapacity = 10 + (level * 5);
    }
  },
  
  redHotDurability: {
    id: 'redHotDurability',
    name: 'Red Hot Durability',
    description: 'Increase Red Hot hits by 1 per level.',
    icon: '🔴',
    maxLevel: 5,
    baseCost: { renown: 12, ink: 10 },
    costPerLevel: { renown: 5, ink: 5 },
    prerequisites: [{ id: 'heatLevel', minLevel: 1 }],
    position: { x: -3.5, y: 2 },
    connections: ['emberRetention'],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.PINK,
    onPurchase: (level) => {
      gameState.redHotHits = 1 + level;
    }
  },

  heatLevel: {
    id: 'heatLevel',
    name: 'Heat Level',
    description: 'Unlock additional heat levels. Each level takes 5s in hearth and grants +1x letter multiplier when striking (Level 1: 2x, Level 2: 3x, Level 3: 4x).',
    icon: '🌡️',
    maxLevel: 3,
    baseCost: { renown: 40, ink: 0 },
    costPerLevel: { renown: 40, ink: 0 },
    prerequisites: [{ id: 'activateHearth', minLevel: 1 }],
    position: { x: -2.5, y: 2.2 },
    connections: [ 'lettersPerRedHot', 'redHotDurability', 'heatPerLetter' ],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.PINK,
    onPurchase: (level) => {
      gameState.heatLevels = level + 1;
    }
  },

  heatPerLetter: {
    id: 'heatPerLetter',
    name: 'Heat Efficiency',
    description: 'Increase heat duration per letter by 1 second per level.',
    icon: '⏱️',
    maxLevel: 5,
    baseCost: { renown: 14, ink: 5 },
    costPerLevel: { renown: 24, ink: 0 },
    prerequisites: [{ id: 'heatLevel', minLevel: 1 }],
    position: { x: -1.5, y: 2.2 },
    connections: [],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.PINK,
    onPurchase: (level) => {
      gameState.secondsPerLetter = 5 + level;
    }
  },

  lettersPerRedHot: {
    id: 'lettersPerRedHot',
    name: 'Red Hot Yield',
    description: 'Increase letters from Red Hot hits by 1 per level.',
    icon: '📝',
    maxLevel: 3,
    baseCost: { renown: 18, ink: 0 },
    costPerLevel: { renown: 18, ink: 0 },
    prerequisites: [{ id: 'heatLevel', minLevel: 1 }],
    position: { x: -2, y: 2.8 },
    connections: [],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.YELLOW,
    onPurchase: (level) => {
      gameState.lettersPerRedHot = 1 + level;
    }
  },

  // ===============================================
  // TIER 3 - HEARTH DEEP
  // ===============================================
  emberRetention: {
    id: 'emberRetention',
    name: 'Ember Retention',
    description: 'Heat decays 10% slower per level.',
    icon: '✨',
    maxLevel: 3,
    baseCost: { renown: 30, ink: 15 },
    costPerLevel: { renown: 20, ink: 10 },
    prerequisites: [{ id: 'redHotDurability', minLevel: 2 }],
    position: { x: -4, y: 3 },
    connections: [],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.PINK,
    onPurchase: (level) => {
      gameState.heatDecayMultiplier = 1 - (level * 0.1);
    }
  },

  // ===============================================
  // TIER 2 - SCRIBE BRANCH
  // ===============================================
  scribeUse: {
    id: 'scribeUse',
    name: 'Scribe Efficiency',
    description: 'Increase uses per ink for each scribe by 1 per level.',
    icon: '⚡',
    maxLevel: 3,
    baseCost: { renown: 0, ink: 20 },
    costPerLevel: { renown: 0, ink: 10 },
    prerequisites: [{ id: 'hireScribes', minLevel: 1 }],
    position: { x: -0.8, y: 2.5 },
    connections: [],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.TEAL,
    onPurchase: (level) => {
      gameState.scribeLettersPerInk = 5 + level;
    }
  },

  scribeSpeed: {
    id: 'scribeSpeed',
    name: 'Swift Quills',
    description: 'Scribes work 15% faster per level.',
    icon: '💨',
    maxLevel: 3,
    baseCost: { renown: 20, ink: 15 },
    costPerLevel: { renown: 15, ink: 10 },
    prerequisites: [{ id: 'hireScribes', minLevel: 1 }],
    position: { x: 0.8, y: 2.5 },
    connections: ['masterScribe'],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.TEAL,
    onPurchase: (level) => {
      gameState.scribeSpeedMultiplier = 1 + (level * 0.15);
    }
  },

  scribeCapacity: {
    id: 'scribeCapacity',
    name: 'Larger Desk',
    description: 'Hire 1 additional scribe slot per level.',
    icon: '📚',
    maxLevel: 3,
    baseCost: { renown: 50, ink: 0 },
    costPerLevel: { renown: 50, ink: 0 },
    prerequisites: [{ id: 'hireScribes', minLevel: 1 }],
    position: { x: 0, y: 3 },
    connections: [],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.YELLOW,
    onPurchase: (level) => {
      gameState.maxScribes = 3 + level;
    }
  },

  // ===============================================
  // TIER 3 - SCRIBE DEEP
  // ===============================================
  masterScribe: {
    id: 'masterScribe',
    name: 'Master Scribe',
    description: 'One scribe produces double letters.',
    icon: '👨‍🏫',
    maxLevel: 1,
    baseCost: { renown: 80, ink: 40 },
    costPerLevel: { renown: 0, ink: 0 },
    prerequisites: [{ id: 'scribeSpeed', minLevel: 2 }],
    position: { x: 1.5, y: 3.5 },
    connections: [],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.YELLOW,
    onPurchase: () => {
      gameState.hasMasterScribe = true;
    }
  },

  // ===============================================
  // TIER 2 - PESTLE BRANCH
  // ===============================================
  lettersPerChurn: {
    id: 'lettersPerChurn',
    name: 'Churn Yield',
    description: 'Increase letters per churn by 1 per level.',
    icon: '🌀',
    maxLevel: 3,
    baseCost: { renown: 40, ink: 30 },
    costPerLevel: { renown: 10, ink: 10 },
    prerequisites: [{ id: 'increasePestleCap', minLevel: 1 }],
    position: { x: 2.5, y: 2.6 },
    connections: ['multiChurn'],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.YELLOW,
    onPurchase: (level) => {
      gameState.inkPerChurn = 1 + level;
    }
  },

  churnSpeed: {
    id: 'churnSpeed',
    name: 'Quick Churn',
    description: 'Churning is 20% faster per level.',
    icon: '⚡',
    maxLevel: 3,
    baseCost: { renown: 25, ink: 20 },
    costPerLevel: { renown: 15, ink: 15 },
    prerequisites: [{ id: 'increasePestleCap', minLevel: 1 }],
    position: { x: 1.9, y: 3 },
    connections: [],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.TEAL,
    onPurchase: (level) => {
      gameState.churnSpeedMultiplier = 1 + (level * 0.2);
    }
  },

  // ===============================================
  // TIER 3 - PESTLE DEEP
  // ===============================================
  multiChurn: {
    id: 'multiChurn',
    name: 'Multi-Churn',
    description: 'Each churn has a 25% chance to trigger twice.',
    icon: '🎲',
    maxLevel: 1,
    baseCost: { renown: 60, ink: 50 },
    costPerLevel: { renown: 0, ink: 0 },
    prerequisites: [{ id: 'lettersPerChurn', minLevel: 2 }],
    position: { x: 3, y: 3 },
    connections: [],
    nodeShape: NODE_SHAPES.CIRCLE,
    nodeColor: NODE_COLORS.PINK,
    onPurchase: () => {
      gameState.multiChurnChance = 0.25;
    }
  },

  // ===============================================
  // TIER 2 - Shovel Branch
  // ===============================================

  unlockShovel: {
    id: 'unlockShovel',
    name: 'Unlock Shovel',
    description: 'Unlock the Shovel to scoop up multiple letter blocks at once.',
    icon: '🧰',
    maxLevel: 1,
    baseCost: { renown: 15, ink: 0 },
    costPerLevel: { renown: 0, ink: 0 },
    prerequisites: [{ id: 'unlockPestle', minLevel: 1 }],
    position: { x: 3.5, y: 2 },
    connections: [],
    nodeShape: NODE_SHAPES.SQUARE,
    nodeColor: NODE_COLORS.YELLOW,
    onPurchase: () => {
      gameState.shovelUnlocked = true;
    }
  },
};

/**
 * Get the current level of an upgrade
 */
export function getUpgradeLevel(upgradeId) {
  return gameState.upgrades[upgradeId] || 0;
}

/**
 * Check if an upgrade can be purchased
 */
export function canPurchaseUpgrade(upgradeId) {
  const upgrade = UPGRADE_TREE[upgradeId];
  if (!upgrade) {
    return { canPurchase: false, reason: 'Upgrade not found' };
  }

  const currentLevel = getUpgradeLevel(upgradeId);

  if (currentLevel >= upgrade.maxLevel) {
    return { canPurchase: false, reason: 'Max level reached' };
  }

  for (const prereq of upgrade.prerequisites) {
    const prereqLevel = getUpgradeLevel(prereq.id);
    if (prereqLevel < prereq.minLevel) {
      const prereqUpgrade = UPGRADE_TREE[prereq.id];
      return {
        canPurchase: false,
        reason: `Requires ${prereqUpgrade.name} Lv.${prereq.minLevel}`
      };
    }
  }

  const cost = getUpgradeCost(upgradeId, currentLevel + 1);

  if (gameState.letters < cost.renown) {
    return { canPurchase: false, reason: `Need ${cost.renown} Renown` };
  }
  if (gameState.ink < cost.ink) {
    return { canPurchase: false, reason: `Need ${cost.ink} Ink` };
  }

  return { canPurchase: true, reason: '' };
}

/**
 * Get the cost for a specific level
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
 */
export function purchaseUpgrade(upgradeId) {
  const check = canPurchaseUpgrade(upgradeId);
  if (!check.canPurchase) {
    return false;
  }

  const upgrade = UPGRADE_TREE[upgradeId];
  const currentLevel = getUpgradeLevel(upgradeId);
  const nextLevel = currentLevel + 1;
  const cost = getUpgradeCost(upgradeId, nextLevel);

  if (!spendLetters(cost.renown)) return false;
  if (!spendInk(cost.ink)) {
    gameState.letters += cost.renown;
    return false;
  }

  gameState.upgrades[upgradeId] = nextLevel;

  if (upgrade.onPurchase) {
    upgrade.onPurchase(nextLevel);
  }

  return true;
}

/**
 * Get visible upgrades with progressive reveal
 * An upgrade is visible if:
 * 1. It's the starting node (activateHearth)
 * 2. It's been purchased
 * 3. Any of its prerequisites have been purchased
 */
export function getVisibleUpgrades() {
  const visible = new Set();
  const locked = new Set();

  // Always show starting node
  visible.add('activateHearth');

  // First pass: find all purchased upgrades and their connections
  for (const [upgradeId, upgrade] of Object.entries(UPGRADE_TREE)) {
    if (getUpgradeLevel(upgradeId) > 0) {
      visible.add(upgradeId);
      
      // Show connected nodes
      for (const connectedId of upgrade.connections) {
        visible.add(connectedId);
      }
    }
  }

  // Second pass: add locked placeholders for nodes connected to visible nodes
  for (const upgradeId of visible) {
    const upgrade = UPGRADE_TREE[upgradeId];
    if (!upgrade) continue;
    
    for (const connectedId of upgrade.connections) {
      const connected = UPGRADE_TREE[connectedId];
      if (!connected) continue;
      
      // Check connections of visible but unpurchased nodes
      if (getUpgradeLevel(upgradeId) > 0) {
        // Show actual nodes for connections of purchased nodes
        visible.add(connectedId);
        
        // Show locked placeholders one step further
        for (const deepConnectedId of connected.connections) {
          if (!visible.has(deepConnectedId) && getUpgradeLevel(connectedId) === 0) {
            locked.add(deepConnectedId);
          }
        }
      }
    }
  }

  return { visible: Array.from(visible), locked: Array.from(locked) };
}

/**
 * Check if prerequisites are met
 */
export function arePrerequisitesMet(upgradeId) {
  const upgrade = UPGRADE_TREE[upgradeId];
  if (!upgrade) return false;
  
  for (const prereq of upgrade.prerequisites) {
    if (getUpgradeLevel(prereq.id) < prereq.minLevel) {
      return false;
    }
  }
  return true;
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

  const scrollContainer = treeContainer.parentElement; // .upgrade-tree-container

  // Remember current scroll BEFORE clearing (only meaningful after first center)
  let prevLeft = 0;
  let prevTop = 0;
  if (scrollContainer && hasCenteredUpgradeTree) {
    prevLeft = scrollContainer.scrollLeft;
    prevTop  = scrollContainer.scrollTop;
  }

  const { visible, locked } = getVisibleUpgrades();

  // Clear and size the virtual canvas
  treeContainer.innerHTML = '';
  treeContainer.style.width = `${VIRTUAL_TREE_SIZE}px`;
  treeContainer.style.height = `${VIRTUAL_TREE_SIZE}px`;

  // Layout parameters: center of the virtual canvas
  const gridSize = 100;
  const layout = {
    gridSize,
    centerX: VIRTUAL_TREE_SIZE / 2,
    centerY: VIRTUAL_TREE_SIZE / 2
  };

  // SVG for lines
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'upgrade-connections');
  treeContainer.appendChild(svg);

  const nodes = {};

  // Visible (real) nodes
  for (const upgradeId of visible) {
    const upgrade = UPGRADE_TREE[upgradeId];
    if (!upgrade) continue;

    const node = createUpgradeNode(upgrade, false, layout);
    nodes[upgradeId] = node;
    treeContainer.appendChild(node);
  }

  // Locked placeholder nodes
  for (const upgradeId of locked) {
    const upgrade = UPGRADE_TREE[upgradeId];
    if (!upgrade) continue;

    const node = createUpgradeNode(upgrade, true, layout);
    nodes[upgradeId] = node;
    treeContainer.appendChild(node);
  }

  // Draw connection lines AFTER layout and then center
  requestAnimationFrame(() => {
    for (const upgradeId of visible) {
      const upgrade = UPGRADE_TREE[upgradeId];
      if (!upgrade) continue;

      const isPurchased = getUpgradeLevel(upgradeId) > 0;

      for (const connectedId of upgrade.connections) {
        if (nodes[upgradeId] && nodes[connectedId]) {
          drawConnection(svg, nodes[upgradeId], nodes[connectedId], isPurchased);
        }
      }
    }

    if (!scrollContainer) return;

if (!hasCenteredUpgradeTree) {
  const startNode = nodes['activateHearth'];

  if (startNode) {
    const nodeRect = startNode.getBoundingClientRect();
    const treeRect = treeContainer.getBoundingClientRect();

    // Center of node in tree content coordinates
    const nodeCenterX =
      (nodeRect.left - treeRect.left) + nodeRect.width / 2;
    const nodeCenterY =
      (nodeRect.top  - treeRect.top)  + nodeRect.height / 2;

    // Read padding from the scroll container
    const style = getComputedStyle(scrollContainer);
    const padLeft   = parseFloat(style.paddingLeft)   || 0;
    const padRight  = parseFloat(style.paddingRight)  || 0;
    const padTop    = parseFloat(style.paddingTop)    || 0;
    const padBottom = parseFloat(style.paddingBottom) || 0;

    const usableWidth  = scrollContainer.clientWidth  - padLeft - padRight;
    const usableHeight = scrollContainer.clientHeight - padTop  - padBottom;

    scrollContainer.scrollLeft = nodeCenterX - usableWidth  / 2;
    scrollContainer.scrollTop  = nodeCenterY - usableHeight / 2;
  }

  hasCenteredUpgradeTree = true;
} else {
  scrollContainer.scrollLeft = prevLeft;
  scrollContainer.scrollTop  = prevTop;
}
  });

  updateHeaderStats();
}

function nudgeUpgradeTreeDown(offset = 120, duration = 800) {
  const treeContainer = document.getElementById('upgradeTree');
  if (!treeContainer) return;
  const scrollContainer = treeContainer.parentElement; // .upgrade-tree-container
  if (!scrollContainer) return;

  const startTop = scrollContainer.scrollTop;
  const targetTop = startTop + offset;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);

    // Smoothstep easing
    const eased = t * t * (3 - 2 * t);

    scrollContainer.scrollTop = startTop + (targetTop - startTop) * eased;

    if (t < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}



/**
 * Update resource display in header
 */
function updateHeaderStats() {
  const renownDisplay = document.getElementById('upgradeRenown');
  const inkDisplay = document.getElementById('upgradeInk');
  
  if (renownDisplay) {
    renownDisplay.textContent = Math.floor(gameState.letters);
  }
  if (inkDisplay) {
    inkDisplay.textContent = Math.floor(gameState.ink);
  }
}

/**
 * Create an upgrade node element
 */
function createUpgradeNode(upgrade, isLocked, layout) {
  const node = document.createElement('div');
  node.className = 'upgrade-node';
  node.dataset.upgradeId = upgrade.id;

  const currentLevel = getUpgradeLevel(upgrade.id);
  const maxLevel = upgrade.maxLevel;
  const prereqsMet = arePrerequisitesMet(upgrade.id);

  // Use virtual grid centered in VIRTUAL_TREE_SIZE
  const { gridSize, centerX, centerY } = layout;
  node.style.left = `${centerX + upgrade.position.x * gridSize}px`;
  node.style.top  = `${centerY + upgrade.position.y * gridSize}px`;

  // Shape
  node.classList.add(`node-${upgrade.nodeShape}`);

  // Color/state
  if (isLocked) {
    node.classList.add('locked');
  } else if (currentLevel >= maxLevel) {
    node.classList.add('purchased', 'max-level', `node-${upgrade.nodeColor}`);
  } else if (currentLevel > 0) {
    node.classList.add('purchased', `node-${upgrade.nodeColor}`);
  } else if (prereqsMet) {
    node.classList.add('available', `node-${upgrade.nodeColor}`);
  } else {
    node.classList.add('locked');
  }

  // Inner content
  const inner = document.createElement('div');
  inner.className = 'upgrade-node-inner';

  const icon = document.createElement('div');
  icon.className = 'upgrade-icon';
  icon.textContent = isLocked ? '?' : upgrade.icon;
  inner.appendChild(icon);

  node.appendChild(inner);

  // Level badge
  if (!isLocked && maxLevel > 1 && currentLevel > 0) {
    const badge = document.createElement('div');
    badge.className = 'upgrade-level-badge';
    badge.textContent = `${currentLevel}`;
    node.appendChild(badge);
  }

  // Tooltip + click only for real nodes
  if (!isLocked) {
    const tooltip = createUpgradeTooltip(upgrade);
    node.appendChild(tooltip);

node.addEventListener('click', (e) => {
  e.stopPropagation();

  // 1. Snapshot what’s visible BEFORE purchase
  const before = getVisibleUpgrades();
  const beforeSet = new Set([
    ...before.visible,
    ...before.locked
  ]);

  // 2. Try to purchase
  if (purchaseUpgrade(upgrade.id)) {
    // 3. Compute visibility AFTER purchase (state has changed now)
    const after = getVisibleUpgrades();
    const afterIds = [...after.visible, ...after.locked];

    const revealedNewNodes = afterIds.some(id => !beforeSet.has(id));

    // 4. Re-render tree
    renderUpgradeTree();

    // 5. Only slide down if new nodes were revealed
    if (revealedNewNodes) {
      // Let renderUpgradeTree restore scroll, then animate
      requestAnimationFrame(() => {
        nudgeUpgradeTreeDown(120, 800); // tweak offset/duration to taste
      });
    }

    if (window.updateUI) window.updateUI();
  }
});
  }
  return node;
}


/**
 * Create tooltip for an upgrade
 */
function createUpgradeTooltip(upgrade) {
  const tooltip = document.createElement('div');
  tooltip.className = 'upgrade-tooltip';

  const currentLevel = getUpgradeLevel(upgrade.id);
  const nextLevel = currentLevel + 1;
  const isMaxed = currentLevel >= upgrade.maxLevel;

  // Header with title and level pill
  const header = document.createElement('div');
  header.className = 'tooltip-header';

  const title = document.createElement('div');
  title.className = 'tooltip-title';
  title.textContent = upgrade.name;
  header.appendChild(title);

  const levelPill = document.createElement('div');
  levelPill.className = 'tooltip-level-pill' + (isMaxed ? ' maxed' : '');
  levelPill.textContent = `${currentLevel}/${upgrade.maxLevel}`;
  header.appendChild(levelPill);

  tooltip.appendChild(header);

  // Description
  const desc = document.createElement('div');
  desc.className = 'tooltip-description';
  desc.textContent = upgrade.description;
  tooltip.appendChild(desc);

  if (isMaxed) {
    // Max level indicator
    const maxText = document.createElement('div');
    maxText.className = 'tooltip-max';
    maxText.textContent = '✦ MAX LEVEL ✦';
    tooltip.appendChild(maxText);
  } else {
    // Cost display
    const cost = getUpgradeCost(upgrade.id, nextLevel);
    const costDiv = document.createElement('div');
    costDiv.className = 'tooltip-cost';

    if (cost.renown > 0) {
      const renownCost = document.createElement('div');
      renownCost.className = 'tooltip-cost-item renown';
      renownCost.classList.add(gameState.letters >= cost.renown ? 'affordable' : 'unaffordable');
      renownCost.innerHTML = `<span>⭐</span> ${cost.renown}`;
      costDiv.appendChild(renownCost);
    }

    if (cost.ink > 0) {
      const inkCost = document.createElement('div');
      inkCost.className = 'tooltip-cost-item ink';
      inkCost.classList.add(gameState.ink >= cost.ink ? 'affordable' : 'unaffordable');
      inkCost.innerHTML = `<span>💧</span> ${cost.ink}`;
      costDiv.appendChild(inkCost);
    }

    if (cost.renown > 0 || cost.ink > 0) {
      tooltip.appendChild(costDiv);
    }

    // Warning/requirement
    const check = canPurchaseUpgrade(upgrade.id);
    if (!check.canPurchase && check.reason !== 'Max level reached') {
      const warning = document.createElement('div');
      warning.className = 'tooltip-warning';
      warning.textContent = check.reason;
      tooltip.appendChild(warning);
    }
  }

  return tooltip;
}

/**
 * Draw a connection line between two nodes
 */
function drawConnection(svg, fromNode, toNode, isActive) {
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
  line.setAttribute('class', 'upgrade-connection-line' + (isActive ? ' active' : ''));

  svg.appendChild(line);
}

// Export for global access
if (typeof window !== 'undefined') {
  window.showUpgradeScreen = showUpgradeScreen;
  window.hideUpgradeScreen = hideUpgradeScreen;
}