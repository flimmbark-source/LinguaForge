/**
 * LINGUA FORGE - MAIN APPLICATION
 * Entry point that initializes the game and manages the game loop
 */

console.log('Lingua Forge app.js loading...');

import { initializeMoldSlots, STARTING_LETTERS, VERSE_COMPLETION_REWARD } from './config.js';
import { spawnLetter, randomAllowedLetter, createLetterTile } from './letters.js';
import { setMoldViewportWidth, navigatePreviousMold, navigateNextMold, forgeWords } from './molds.js';
import { hireScribe, updateScribes } from './scribes.js';
import { setupVerseAreaDrop, completeVerse } from './grammar.js';
import { initializeElements, updateUI } from './ui.js';
import { gameState } from './state.js';
import { addLetters } from './state.js';
import { HammerSystem } from './hammer.js';
import { PestleSystem } from './pestle.js';
import { ChipSystem } from './chips.js';
import { InventoryBagSystem } from './inventoryBag.js';
import { DraggableMoldViewport } from './draggableMoldViewport.js';
import { initializeHearth, updateHearth } from './hearth.js';
import { addInk /*, whatever else you need */ } from './state.js';
import { showUpgradeScreen, hideUpgradeScreen } from './upgrades.js';

// Global crafting system references
let hammerSystem = null;
let pestleSystem = null;
let chipSystem = null;
let inventoryBagSystem = null;
let draggableMoldViewport = null;
let activeTool = 'hammer'; // 'hammer' or 'pestle'

/**
 * Initialize the game
 */
function initializeGame() {
  console.log('Initializing Lingua Forge...');
  // Initialize DOM element references
  initializeElements();

  // Initialize mold slots
  initializeMoldSlots();

  // Setup event handlers
  setupEventHandlers();

  // Setup drag-and-drop for verse area
  const grammarHebrewLineDiv = document.getElementById('grammarHebrewLine');
  if (grammarHebrewLineDiv) {
    setupVerseAreaDrop(grammarHebrewLineDiv, updateUI);
  }

  // Initialize crafting systems
  initializeCraftingSystems();

  // Initialize hearth system
  initializeHearth();

  // Initialize inventory bag system
  inventoryBagSystem = new InventoryBagSystem();
  inventoryBagSystem.onUpdate = updateUI;
  inventoryBagSystem.initialize();

  // Initialize draggable mold viewport
  draggableMoldViewport = new DraggableMoldViewport();
  draggableMoldViewport.initialize();

  // Setup tool selection
  setupToolSelection();

  // Spawn starting letters
  for (let i = 0; i < STARTING_LETTERS; i++) {
    spawnLetter(updateUI);
  }

  // Set mold viewport width
  setMoldViewportWidth();

  // Initial UI update
  updateUI();
}

/**
 * Initialize crafting systems (hammer and pestle)
 */
function initializeCraftingSystems() {
  const craftingCanvas = document.getElementById('craftingCanvas');

  if (!craftingCanvas) {
    console.warn('Crafting canvas not found');
    return;
  }

  // Create hammer system with callbacks
  hammerSystem = new HammerSystem(craftingCanvas);

  // Callback when hammer strikes anvil - spawn flying physics letters
  hammerSystem.onLetterForged = (impactX, impactY, power, strikeVx, multiplier = 1) => {
    // Spawn letters based on lettersPerClick and multiplier
    const totalLetters = gameState.lettersPerClick * multiplier;
    for (let i = 0; i < totalLetters; i++) {
      // Get random Hebrew letter
      const letterChar = randomAllowedLetter();

      // Slight delay between multiple letters for visual effect
      setTimeout(() => {
        hammerSystem.spawnFlyingLetter(impactX, impactY, power, strikeVx, letterChar);
      }, i * 50);
    }

    // Hide hint after first strike
    const hint = document.getElementById('craftingHint');
    if (hint && !hint.classList.contains('hidden')) {
      hint.classList.add('hidden');
    }
  };

  // Callback when letter lands in pool - create DOM tile
  hammerSystem.onLetterLanded = (letterChar) => {
    addLetters(1);
    const letterPoolDiv = document.getElementById('letterPool');
    if (!letterPoolDiv) return;

    // Check if we already have a tile with this character (stack them)
    const existing = Array.from(letterPoolDiv.children).find(
      el => el.classList && el.classList.contains('letter-tile') && el.dataset.letterChar === letterChar
    );

    if (existing) {
      const current = parseInt(existing.dataset.count || '1', 10);
      existing.dataset.count = String(current + 1);
      // Update the label to show new count
      const char = existing.dataset.letterChar || '';
      existing.innerHTML = '<span>' + char + '</span>';
      if (current + 1 > 1) {
        const badge = document.createElement('span');
        badge.className = 'letter-count';
        badge.textContent = 'x' + (current + 1);
        existing.appendChild(badge);
      }

      // Briefly highlight the existing tile
      existing.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
      existing.style.transform = 'scale(1.3)';
      existing.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.6)';
      setTimeout(() => {
        existing.style.transform = '';
        existing.style.boxShadow = '';
      }, 200);
    } else {
      // Create new tile
      const tile = createLetterTile(letterChar, updateUI);
      letterPoolDiv.appendChild(tile);

      // Brief entrance animation
      tile.style.transition = 'transform 0.2s ease';
      tile.style.transform = 'scale(0)';
      setTimeout(() => {
        tile.style.transform = 'scale(1)';
      }, 10);
      setTimeout(() => {
        tile.style.transition = '';
      }, 210);
    }

    updateUI();

    // Update inventory bag popup if open
    if (inventoryBagSystem) {
      inventoryBagSystem.updatePopup();
    }
  };

  // Callback when red-hot hammer strikes mold viewport - forge words and spawn chips
  hammerSystem.onForgeTriggered = () => {
    const forgedWords = forgeWords();

    // Spawn physics chips for each forged word
    if (forgedWords.length > 0 && chipSystem) {
      const moldViewport = document.querySelector('.mold-viewport');
      if (moldViewport) {
        const moldBounds = moldViewport.getBoundingClientRect();
        forgedWords.forEach(word => {
          chipSystem.spawnChip(word, moldBounds);
        });
      }
    }

    updateUI();
  };

  // Create chip system
  chipSystem = new ChipSystem(craftingCanvas);
  chipSystem.onUpdate = updateUI;

  // Create pestle system with callbacks
  pestleSystem = new PestleSystem(craftingCanvas);

  // Callback when ink is produced
  pestleSystem.onInkProduced = (letter) => {
    addInk(1);
    updateUI();
    console.log('Produced 1 ink from letter:', letter);
  };

  // Start with hammer active
  hammerSystem.start();
  console.log('Crafting systems initialized');
}

/**
 * Setup tool selection handlers
 */
function setupToolSelection() {
  const hammerBtn = document.getElementById('selectHammer');
  const pestleBtn = document.getElementById('selectPestle');
  const craftingHint = document.getElementById('craftingHint');

  if (!hammerBtn || !pestleBtn) return;

  hammerBtn.addEventListener('click', () => {
    if (activeTool === 'hammer') return;

    activeTool = 'hammer';
    hammerBtn.classList.add('active');
    pestleBtn.classList.remove('active');

    // Switch systems
    if (pestleSystem) pestleSystem.stop();
    if (hammerSystem) hammerSystem.start();

    // Update hint text
    if (craftingHint) {
      craftingHint.textContent = '';
      craftingHint.classList.remove('hidden');
    }

    console.log('Switched to Hammer');
  });

  pestleBtn.addEventListener('click', () => {
    if (activeTool === 'pestle') return;

    activeTool = 'pestle';
    pestleBtn.classList.add('active');
    hammerBtn.classList.remove('active');

    // Switch systems
    if (hammerSystem) hammerSystem.stop();
    if (pestleSystem) pestleSystem.start();

    // Update hint text
    if (craftingHint) {
      craftingHint.textContent = '';
      craftingHint.classList.remove('hidden');
    }

    console.log('Switched to Pestle & Mortar');
  });
}

/**
 * Setup all event handlers for buttons and interactions
 */
function setupEventHandlers() {
  // Hammer system replaces the strike button (initialized separately)

  // Buy scribe button
  const buyScribeBtn = document.getElementById('buyScribeBtn');
  if (buyScribeBtn) {
    buyScribeBtn.addEventListener('click', () => {
      if (hireScribe()) {
        updateUI();
      }
    });
  }

  // Mold navigation buttons
  const prevMoldBtn = document.getElementById('prevMoldBtn');
  const nextMoldBtn = document.getElementById('nextMoldBtn');
  if (prevMoldBtn && nextMoldBtn) {
    prevMoldBtn.addEventListener('click', () => {
      navigatePreviousMold();
      updateUI();
    });
    nextMoldBtn.addEventListener('click', () => {
      navigateNextMold();
      updateUI();
    });
  }

  // Forge words button removed - now triggered by red-hot hammer hitting mold viewport

  // Enscribe button - complete verse
  const enscribeBtn = document.getElementById('enscribeBtn');
  if (enscribeBtn) {
    enscribeBtn.addEventListener('click', () => {
      if (completeVerse()) {
        alert('Verse completed! You gain ' + VERSE_COMPLETION_REWARD + ' Ink (prototype value).');
        updateUI();
      }
    });
  }

  // Upgrades button
  const upgradesBtn = document.getElementById('upgradesBtn');
  if (upgradesBtn) {
    upgradesBtn.addEventListener('click', () => {
      showUpgradeScreen();
    });
  }

  // Close upgrade modal button
  const closeUpgradeBtn = document.getElementById('closeUpgradeBtn');
  if (closeUpgradeBtn) {
    closeUpgradeBtn.addEventListener('click', () => {
      hideUpgradeScreen();
    });
  }

  // Close modal when clicking outside
  const upgradeModal = document.getElementById('upgradeModal');
  if (upgradeModal) {
    upgradeModal.addEventListener('click', (e) => {
      if (e.target === upgradeModal) {
        hideUpgradeScreen();
      }
    });
  }
}

/**
 * Game loop - runs every frame
 */
let lastTime = performance.now();
function gameLoop(timestamp) {
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  // Update hearth
  updateHearth(dt);

  // Update chip physics
  if (chipSystem) {
    chipSystem.update(dt);
    chipSystem.render();
  }

  // Update scribes
  if (gameState.scribeList.length > 0) {
    updateScribes(dt, updateUI);
  }

  // Update UI
  updateUI();

  // Continue loop
  requestAnimationFrame(gameLoop);
}

/**
 * Start the application
 */
function start() {
  initializeGame();
  requestAnimationFrame(gameLoop);
}

// Expose updateUI globally for upgrade system
window.updateUI = updateUI;

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

