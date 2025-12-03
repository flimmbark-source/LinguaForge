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
import { initializeHearth, updateHearth } from './hearth.js';

// Global hammer system reference
let hammerSystem = null;

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

  // Initialize hammer system
  initializeHammerSystem();

  // Initialize hearth system
  initializeHearth();

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
 * Initialize hammer and anvil system
 */
function initializeHammerSystem() {
  const hammerCanvas = document.getElementById('hammerCanvas');
  const hammerHint = document.getElementById('hammerHint');

  if (!hammerCanvas) {
    console.warn('Hammer canvas not found');
    return;
  }

  // Create hammer system with callbacks
  hammerSystem = new HammerSystem(hammerCanvas);

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
    if (hammerHint && !hammerHint.classList.contains('hidden')) {
      hammerHint.classList.add('hidden');
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
  };

  // Callback when red-hot hammer strikes mold viewport - forge words
  hammerSystem.onForgeTriggered = () => {
    forgeWords();
    updateUI();
  };

  // Start the hammer system
  hammerSystem.start();
  console.log('Hammer system initialized');
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

  // Upgrades button (placeholder for future implementation)
  const upgradesBtn = document.getElementById('upgradesBtn');
  if (upgradesBtn) {
    upgradesBtn.addEventListener('click', () => {
      alert('Upgrades system coming soon!');
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

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
