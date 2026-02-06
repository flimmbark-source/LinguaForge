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
import { ShovelSystem } from './shovel.js';
import { ChipSystem } from './chips.js';
import { initializeHearth, updateHearth } from './hearth.js';
import { addInk /*, whatever else you need */ } from './state.js';
import { showUpgradeScreen, hideUpgradeScreen } from './upgrades.js';
import { getResourceFeedbackSystem, updateResourceFeedback, spawnResourceGain } from './resourceGainFeedback.js';
import { initMagicBook, initToolsSidebar, updateSidebarToolVisibility } from './bookAndSidebar.js';

// Global crafting system references
let hammerSystem = null;
let pestleSystem = null;
let shovelSystem = null;
let chipSystem = null;
let activeTool = 'hammer'; // 'hammer' or 'pestle'

/**
 * Handle mold slot being filled by a letter drop.
 * Spawns renown feedback at the slot location, then updates UI.
 * @param {HTMLElement} slotEl
 */
function handleMoldSlotFilled(slotEl) {
  if (slotEl) {
    const rect = slotEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spawnResourceGain(centerX, centerY, 2, 'renown');
  }

  updateUI();
}

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

  // Setup tool selection
  setupToolSelection();

  // Initialize magic book and tools sidebar
  initMagicBook();
  initToolsSidebar(
    // onToolSelected: pull a tool out to use it
    (toolName) => {
      const btnMap = {
        hammer: document.getElementById('selectHammer'),
        pestle: document.getElementById('selectPestle'),
        shovel: document.getElementById('selectShovel')
      };
      const btn = btnMap[toolName];
      if (btn) btn.click();
    },
    // onToolPutAway: drop a tool back in the sidebar to stow it
    (toolName) => {
      if (toolName === 'hammer' && hammerSystem) hammerSystem.stop();
      if (toolName === 'pestle' && pestleSystem) pestleSystem.stop();
      if (toolName === 'shovel' && shovelSystem) shovelSystem.stop();

      // Clear the active tool if we just put away the one that was active
      if (activeTool === toolName) {
        activeTool = null;
      }

      // Also clear active state on hidden tool buttons
      const btn = document.getElementById(
        toolName === 'hammer' ? 'selectHammer' :
        toolName === 'pestle' ? 'selectPestle' :
        toolName === 'shovel' ? 'selectShovel' : ''
      );
      if (btn) btn.classList.remove('active');

      console.log('Put away tool:', toolName);
    }
  );

  // Spawn starting letters
  for (let i = 0; i < STARTING_LETTERS; i++) {
    spawnLetter(handleMoldSlotFilled);
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
  const chipCanvas = document.getElementById('chipCanvas');

  if (!craftingCanvas) {
    console.warn('Crafting canvas not found');
    return;
  }

  const chipLayer = chipCanvas || craftingCanvas;
  const syncChipCanvasSize = () => {
    const rect = craftingCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    chipLayer.width = rect.width * dpr;
    chipLayer.height = rect.height * dpr;
    chipLayer.style.width = `${rect.width}px`;
    chipLayer.style.height = `${rect.height}px`;

    const chipCtx = chipLayer.getContext('2d');
    chipCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  syncChipCanvasSize();
  window.addEventListener('resize', syncChipCanvasSize);

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
  hammerSystem.onLetterLanded = (letterChar, canvasX, canvasY) => {
    addLetters(1);

    // Spawn resource gain feedback at letter position
    const craftingCanvas = document.getElementById('craftingCanvas');
    if (craftingCanvas) {
      const rect = craftingCanvas.getBoundingClientRect();
      const screenX = rect.left + canvasX;
      const screenY = rect.top + canvasY;
      spawnResourceGain(screenX, screenY, 1, 'renown');
    }

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
      const tile = createLetterTile(letterChar, handleMoldSlotFilled);
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
  };

  // Callback when red-hot hammer strikes mold viewport - forge words and spawn chips
  hammerSystem.onForgeTriggered = () => {
    const forgedWords = forgeWords();

    // Spawn physics chips for each forged word
    if (forgedWords.length > 0 && chipSystem) {
      const moldViewport = document.querySelector('.mold-viewport');
      if (moldViewport) {
        const moldBounds = moldViewport.getBoundingClientRect();
        forgedWords.forEach((word, index) => {
          // Stagger spawns so chips pop out one at a time instead of overlapping
          setTimeout(() => {
            chipSystem.spawnChip(word, moldBounds);
          }, index * 120);
        });
      }
    }

    updateUI();
  };

  // Create chip system
  chipSystem = new ChipSystem(chipLayer);
  chipSystem.onUpdate = updateUI;

  // Render chips after the active tool draws so they remain visible on the shared canvas
  const renderChips = () => chipSystem.render();

  // Create pestle system with callbacks
  pestleSystem = new PestleSystem(craftingCanvas);
    if (typeof pestleSystem.setOverlayRenderer === 'function') {
    pestleSystem.setOverlayRenderer(renderChips);
  } else {
    // Fallback for older PestleSystem implementations that don't expose a setter yet
    pestleSystem.overlayRenderer = renderChips;
  }

  // Callback when ink is produced
  pestleSystem.onInkProduced = (letter, canvasX, canvasY) => {
    const inkAmount = gameState.inkPerChurn;
    addInk(inkAmount);

    // Spawn resource gain feedback at pestle tip position
    const craftingCanvas = document.getElementById('craftingCanvas');
    if (craftingCanvas) {
      const rect = craftingCanvas.getBoundingClientRect();
      const screenX = rect.left + canvasX;
      const screenY = rect.top + canvasY;
      spawnResourceGain(screenX, screenY, inkAmount, 'ink');
    }

    updateUI();
    console.log('Produced', inkAmount, 'ink from letter:', letter);
  };

  // Start with hammer active
  hammerSystem.setOverlayRenderer(renderChips);
  hammerSystem.start();
  // Create and start shovel (initialized but not active by default)
  shovelSystem = new ShovelSystem(craftingCanvas);
  shovelSystem.setOverlayRenderer(renderChips);
  // do not start shovel until selected

  // Wire up put-away callbacks: when a tool is released near the sidebar, stow it
  function makePutAwayHandler(toolName) {
    return () => {
      console.log('Tool put away via canvas drag:', toolName);
      if (toolName === 'hammer' && hammerSystem) hammerSystem.stop();
      if (toolName === 'pestle' && pestleSystem) pestleSystem.stop();
      if (toolName === 'shovel' && shovelSystem) shovelSystem.stop();
      if (activeTool === toolName) activeTool = null;
      // Update sidebar slot
      const slotId = toolName === 'hammer' ? 'toolSlotHammer' :
                     toolName === 'pestle' ? 'toolSlotPestle' :
                     toolName === 'shovel' ? 'toolSlotShovel' : '';
      const slot = document.getElementById(slotId);
      if (slot) slot.classList.remove('active');
      // Update hidden button
      const btnId = toolName === 'hammer' ? 'selectHammer' :
                    toolName === 'pestle' ? 'selectPestle' :
                    toolName === 'shovel' ? 'selectShovel' : '';
      const btn = document.getElementById(btnId);
      if (btn) btn.classList.remove('active');
    };
  }
  hammerSystem.onPutAway = makePutAwayHandler('hammer');
  pestleSystem.onPutAway = makePutAwayHandler('pestle');
  shovelSystem.onPutAway = makePutAwayHandler('shovel');

  console.log('Crafting systems initialized');
}

/**
 * Setup tool selection handlers
 */
function setupToolSelection() {
  const hammerBtn = document.getElementById('selectHammer');
  const pestleBtn = document.getElementById('selectPestle');
  const shovelBtn = document.getElementById('selectShovel');
  const craftingHint = document.getElementById('craftingHint');
  if (!hammerBtn || !pestleBtn || !shovelBtn) return;

  hammerBtn.addEventListener('click', () => {
    if (activeTool === 'hammer') return;

    activeTool = 'hammer';
    hammerBtn.classList.add('active');
    pestleBtn.classList.remove('active');
    shovelBtn.classList.remove('active');

    // Switch systems
    if (shovelSystem) shovelSystem.stop();
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
    shovelBtn.classList.remove('active');
    pestleBtn.classList.add('active');
    hammerBtn.classList.remove('active');

    // Switch systems
    if (hammerSystem) hammerSystem.stop();
    if (shovelSystem) shovelSystem.stop();
    if (pestleSystem) pestleSystem.start();

    // Update hint text
    if (craftingHint) {
      craftingHint.textContent = '';
      craftingHint.classList.remove('hidden');
    }

    console.log('Switched to Pestle & Mortar');
  });

  shovelBtn.addEventListener('click', () => {
    if (activeTool === 'shovel') return;

    activeTool = 'shovel';
    shovelBtn.classList.add('active');
    hammerBtn.classList.remove('active');
    pestleBtn.classList.remove('active');

    // Switch systems
    if (hammerSystem) hammerSystem.stop();
    if (pestleSystem) pestleSystem.stop();
    if (shovelSystem) shovelSystem.start();

    // Update hint text
    if (craftingHint) {
      craftingHint.textContent = '';
      craftingHint.classList.remove('hidden');
    }

    console.log('Switched to Shovel');
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
        // Spawn resource gain feedback at verse area center
        const grammarHebrewLineDiv = document.getElementById('grammarHebrewLine');
        if (grammarHebrewLineDiv) {
          const rect = grammarHebrewLineDiv.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          spawnResourceGain(centerX, centerY, VERSE_COMPLETION_REWARD, 'ink');
        }

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
  // Ensure chips stay visible even when no tool overlay is running
    chipSystem.render();
  }

  // Update scribes
  if (gameState.scribeList.length > 0) {
    updateScribes(dt, handleMoldSlotFilled);
  }

  // Update resource gain feedback
  updateResourceFeedback(dt);

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

