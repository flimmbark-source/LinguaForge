/**
 * LINGUA FORGE - UPGRADE SYSTEM
 * Node-based skill tree with progressive unlock and reveal
 */

import { gameState, spendLetters, spendInk } from './state.js?v=9';
import { updateHearthVisuals } from './RuneHearth.js?v=9';

// ===============================================
// Column / tool classification for every upgrade
// Workshop = tool unlocks, Forgecraft = stat upgrades
// ===============================================
const UPGRADE_META = {
  // Workshop ─ tool unlocks
  activateHearth:    { column: 'workshop', tool: 'forge' },
  hireScribes:       { column: 'workshop', tool: 'scribes' },
  unlockPestle:      { column: 'workshop', tool: 'pestle' },
  unlockShovel:      { column: 'workshop', tool: 'shovel' },
  // Forgecraft ─ Forge stats
  heatLevel:         { column: 'forgecraft', tool: 'forge' },
  redHotDurability:  { column: 'forgecraft', tool: 'forge' },
  emberRetention:    { column: 'forgecraft', tool: 'forge' },
  heatPerLetter:     { column: 'forgecraft', tool: 'forge' },
  lettersPerRedHot:  { column: 'forgecraft', tool: 'forge' },
  // Forgecraft ─ Fist stats
  gripStrength:      { column: 'forgecraft', tool: 'fist' },
  // Forgecraft ─ Scribes stats
  scribeUse:         { column: 'forgecraft', tool: 'scribes' },
  scribeSpeed:       { column: 'forgecraft', tool: 'scribes' },
  scribeCapacity:    { column: 'forgecraft', tool: 'scribes' },
  masterScribe:      { column: 'forgecraft', tool: 'scribes' },
  // Forgecraft ─ Pestle stats
  increasePestleCap: { column: 'forgecraft', tool: 'pestle' },
  lettersPerChurn:   { column: 'forgecraft', tool: 'pestle' },
  churnSpeed:        { column: 'forgecraft', tool: 'pestle' },
  multiChurn:        { column: 'forgecraft', tool: 'pestle' },
};

// Tool blocks shown in the Workshop column (clickable to filter Forgecraft)
const WORKSHOP_TOOLS = [
  { id: 'fist',    label: 'Fist',    icon: '💪', upgradeId: null,             alwaysVisible: true },
  { id: 'forge',   label: 'Hearth',   icon: '🔥', upgradeId: 'activateHearth', alwaysVisible: true },
  { id: 'pestle',  label: 'Pestle',  icon: '🥄', upgradeId: 'unlockPestle',  visibleWhen: 'activateHearth' },
  { id: 'scribes', label: 'Scribes', icon: '✍️', upgradeId: 'hireScribes',   visibleWhen: 'unlockPestle' },
  { id: 'shovel',  label: 'Shovel',  icon: '🧰', upgradeId: 'unlockShovel',  visibleWhen: 'unlockPestle' },
];

// Currently selected tool in Workshop (filters Forgecraft); null = show all
let selectedTool = null;

// Node shape and color constants (used by UPGRADE_TREE data)
const NODE_SHAPES = { CIRCLE: 'circle', SQUARE: 'square' };
const NODE_COLORS = { TEAL: 'teal', PINK: 'pink', YELLOW: 'yellow' };

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
    connections: ['gripStrength','heatLevel', 'unlockPestle'],
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
    prerequisites: [{ id: 'unlockPestle', minLevel: 1 }],
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
    connections: ['increasePestleCap', 'unlockShovel', 'hireScribes'],
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
 * 3. Any of its prerequisites have been purchased (shown as available)
 * A locked placeholder is shown for connections of visible-but-unpurchased nodes
 * (giving a preview of the next tier).
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

      // Show connected nodes as available
      for (const connectedId of upgrade.connections) {
        visible.add(connectedId);
      }
    }
  }

  // Second pass: for every visible node, show its connections as locked previews
  // (so the player always sees what's coming next in the chain)
  const snapshot = Array.from(visible);
  for (const upgradeId of snapshot) {
    const upgrade = UPGRADE_TREE[upgradeId];
    if (!upgrade) continue;

    for (const connectedId of upgrade.connections) {
      if (!visible.has(connectedId)) {
        locked.add(connectedId);
      }

      // One more step deep: show connections of visible-but-unpurchased as locked
      const connected = UPGRADE_TREE[connectedId];
      if (connected && getUpgradeLevel(upgradeId) > 0) {
        for (const deepId of connected.connections) {
          if (!visible.has(deepId)) {
            locked.add(deepId);
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
 * Update resource display in upgrade header (exported so main UI loop can call it)
 */
export function updateUpgradeHeaderStats() {
  const modal = document.getElementById('upgradeModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const renownDisplay = document.getElementById('upgradeRenown');
  const inkDisplay = document.getElementById('upgradeInk');
  if (renownDisplay) renownDisplay.textContent = Math.floor(gameState.letters);
  if (inkDisplay) inkDisplay.textContent = Math.floor(gameState.ink);
}

/**
 * Render the two-column upgrade screen
 */
export function renderUpgradeTree() {
  const { visible, locked } = getVisibleUpgrades();
  const allShown = new Set([...visible, ...locked]);

  renderWorkshop(allShown, visible, locked);
  renderForgecraft(allShown, visible, locked);
  updateUpgradeHeaderStats();
}

/**
 * Render the Workshop column (clickable tool blocks)
 */
function renderWorkshop(allShown, visible, locked) {
  const listEl = document.getElementById('workshopList');
  if (!listEl) return;

  const prevScroll = listEl.scrollTop;
  listEl.innerHTML = '';

  for (const tool of WORKSHOP_TOOLS) {
    // Visibility: always visible, or visible when a prerequisite upgrade is purchased/visible
    if (!tool.alwaysVisible) {
      if (tool.visibleWhen && getUpgradeLevel(tool.visibleWhen) === 0) {
        // Also show if the upgrade itself is in the visible/locked set
        if (tool.upgradeId && !allShown.has(tool.upgradeId)) continue;
      }
    }

    const block = createWorkshopToolBlock(tool, visible, locked);
    listEl.appendChild(block);
  }

  listEl.scrollTop = prevScroll;
}

/**
 * Create a Workshop tool block element
 */
function createWorkshopToolBlock(tool, visible, locked) {
  const block = document.createElement('div');
  block.className = 'workshop-tool-block';
  block.dataset.toolId = tool.id;

  const isSelected = selectedTool === tool.id;
  if (isSelected) block.classList.add('tool-selected');

  // Determine status
  let status = 'permanent'; // Fist (no upgrade to buy)
  if (tool.upgradeId) {
    const level = getUpgradeLevel(tool.upgradeId);
    const isLocked = locked.includes(tool.upgradeId);
    const upgrade = UPGRADE_TREE[tool.upgradeId];
    const isMaxed = level >= upgrade.maxLevel;

    if (isLocked) {
      status = 'locked';
    } else if (isMaxed || level > 0) {
      status = 'unlocked';
    } else {
      status = 'available';
    }
  }
  block.classList.add('tool-' + status);

  // Icon
  const iconEl = document.createElement('div');
  iconEl.className = 'workshop-tool-icon';
  iconEl.textContent = status === 'locked' ? '?' : tool.icon;
  block.appendChild(iconEl);

  // Info section
  const info = document.createElement('div');
  info.className = 'workshop-tool-info';

  const labelEl = document.createElement('div');
  labelEl.className = 'workshop-tool-label';
  labelEl.textContent = status === 'locked' ? '???' : tool.label;
  info.appendChild(labelEl);

  // Show description for purchasable tool unlocks
  if (tool.upgradeId && status === 'available') {
    const upgrade = UPGRADE_TREE[tool.upgradeId];
    const descEl = document.createElement('div');
    descEl.className = 'workshop-tool-desc';
    descEl.textContent = upgrade.description;
    info.appendChild(descEl);
  }

  block.appendChild(info);

  // Right side: cost or status indicator
  const rightEl = document.createElement('div');
  rightEl.className = 'workshop-tool-right';

  if (tool.upgradeId && status === 'available') {
    const cost = getUpgradeCost(tool.upgradeId, 1);
    const costEl = document.createElement('div');
    costEl.className = 'workshop-tool-cost';
    if (cost.renown > 0) {
      const r = document.createElement('span');
      r.className = gameState.letters >= cost.renown ? 'cost-affordable' : 'cost-unaffordable';
      r.textContent = `⭐${cost.renown}`;
      costEl.appendChild(r);
    }
    if (cost.ink > 0) {
      const i = document.createElement('span');
      i.className = gameState.ink >= cost.ink ? 'cost-affordable' : 'cost-unaffordable';
      i.textContent = `💧${cost.ink}`;
      costEl.appendChild(i);
    }
    rightEl.appendChild(costEl);
  } else if (status === 'unlocked' || status === 'permanent') {
    const checkEl = document.createElement('div');
    checkEl.className = 'workshop-tool-check';
    checkEl.textContent = '✓';
    rightEl.appendChild(checkEl);
  }

  block.appendChild(rightEl);

  // Click handler
  if (status !== 'locked') {
    block.addEventListener('click', () => {
      // If purchasable, buy first
      if (status === 'available' && tool.upgradeId) {
        if (purchaseUpgrade(tool.upgradeId)) {
          if (window.updateUI) window.updateUI();
        }
      }
      // Toggle filter selection
      selectedTool = (selectedTool === tool.id) ? null : tool.id;
      renderUpgradeTree();
    });
  }

  return block;
}

/**
 * Render the Forgecraft column (stat upgrade blocks, filtered by selected tool)
 */
function renderForgecraft(allShown, visible, locked) {
  const listEl = document.getElementById('forgecraftList');
  if (!listEl) return;

  const prevScroll = listEl.scrollTop;
  listEl.innerHTML = '';

  // Gather stat upgrades for Forgecraft column
  const columnUpgrades = [];
  for (const [id, meta] of Object.entries(UPGRADE_META)) {
    if (meta.column !== 'forgecraft') continue;
    if (selectedTool && meta.tool !== selectedTool) continue;
    if (!allShown.has(id)) continue;
    columnUpgrades.push(id);
  }

  // Sort: purchased first, then available, then locked
  columnUpgrades.sort((a, b) => {
    const aLevel = getUpgradeLevel(a);
    const bLevel = getUpgradeLevel(b);
    const aLocked = locked.includes(a);
    const bLocked = locked.includes(b);
    if (aLevel > 0 && bLevel === 0) return -1;
    if (bLevel > 0 && aLevel === 0) return 1;
    if (!aLocked && bLocked) return -1;
    if (aLocked && !bLocked) return 1;
    return 0;
  });

  for (const upgradeId of columnUpgrades) {
    const isLocked = locked.includes(upgradeId);
    const block = createUpgradeBlock(upgradeId, isLocked);
    listEl.appendChild(block);
  }

  if (columnUpgrades.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'upgrade-empty';
    empty.textContent = selectedTool ? 'No upgrades for this tool yet' : 'No upgrades available yet';
    listEl.appendChild(empty);
  }

  listEl.scrollTop = prevScroll;
}

/**
 * Create an upgrade block element
 */
function createUpgradeBlock(upgradeId, isLocked) {
  const upgrade = UPGRADE_TREE[upgradeId];
  const block = document.createElement('div');
  block.className = 'upgrade-block';
  block.dataset.upgradeId = upgradeId;

  const currentLevel = getUpgradeLevel(upgradeId);
  const maxLevel = upgrade.maxLevel;
  const isMaxed = currentLevel >= maxLevel;
  const prereqsMet = arePrerequisitesMet(upgradeId);

  if (isLocked) {
    block.classList.add('block-locked');
  } else if (isMaxed) {
    block.classList.add('block-maxed');
  } else if (currentLevel > 0) {
    block.classList.add('block-purchased');
  } else if (prereqsMet) {
    block.classList.add('block-available');
  } else {
    block.classList.add('block-locked');
  }

  // Icon
  const iconEl = document.createElement('div');
  iconEl.className = 'upgrade-block-icon';
  iconEl.textContent = isLocked ? '?' : upgrade.icon;
  block.appendChild(iconEl);

  // Info section
  const info = document.createElement('div');
  info.className = 'upgrade-block-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'upgrade-block-name';
  nameEl.textContent = isLocked ? '???' : upgrade.name;
  info.appendChild(nameEl);

  if (!isLocked) {
    const descEl = document.createElement('div');
    descEl.className = 'upgrade-block-desc';
    descEl.textContent = upgrade.description;
    info.appendChild(descEl);
  }

  block.appendChild(info);

  // Right side: level + cost
  const rightEl = document.createElement('div');
  rightEl.className = 'upgrade-block-right';

  if (!isLocked) {
    // Level indicator
    const levelEl = document.createElement('div');
    levelEl.className = 'upgrade-block-level';
    if (isMaxed) {
      levelEl.textContent = 'MAX';
      levelEl.classList.add('level-max');
    } else {
      levelEl.textContent = `${currentLevel}/${maxLevel}`;
    }
    rightEl.appendChild(levelEl);

    // Cost (only if not maxed)
    if (!isMaxed) {
      const cost = getUpgradeCost(upgradeId, currentLevel + 1);
      const costEl = document.createElement('div');
      costEl.className = 'upgrade-block-cost';
      if (cost.renown > 0) {
        const r = document.createElement('span');
        r.className = gameState.letters >= cost.renown ? 'cost-affordable' : 'cost-unaffordable';
        r.textContent = `⭐${cost.renown}`;
        costEl.appendChild(r);
      }
      if (cost.ink > 0) {
        const i = document.createElement('span');
        i.className = gameState.ink >= cost.ink ? 'cost-affordable' : 'cost-unaffordable';
        i.textContent = `💧${cost.ink}`;
        costEl.appendChild(i);
      }
      rightEl.appendChild(costEl);
    }
  }

  block.appendChild(rightEl);

  // Click to purchase (only for non-locked, non-maxed blocks)
  if (!isLocked && !isMaxed) {
    block.addEventListener('click', () => {
      if (purchaseUpgrade(upgradeId)) {
        renderUpgradeTree();
        if (window.updateUI) window.updateUI();
      }
    });
  }

  // Requirement warning
  if (!isLocked && !isMaxed) {
    const check = canPurchaseUpgrade(upgradeId);
    if (!check.canPurchase && check.reason !== 'Max level reached') {
      const warn = document.createElement('div');
      warn.className = 'upgrade-block-warning';
      warn.textContent = check.reason;
      block.appendChild(warn);
    }
  }

  return block;
}

// Export for global access
if (typeof window !== 'undefined') {
  window.showUpgradeScreen = showUpgradeScreen;
  window.hideUpgradeScreen = hideUpgradeScreen;
}