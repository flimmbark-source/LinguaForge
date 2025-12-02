/**
 * LINGUA FORGE - MAIN APPLICATION
 * Entry point that initializes the game and manages the game loop
 */

import { initializeMoldSlots, STARTING_LETTERS, VERSE_COMPLETION_REWARD } from './config.js';
import { spawnLetter } from './letters.js';
import { setMoldViewportWidth, navigatePreviousMold, navigateNextMold, forgeWords } from './molds.js';
import { hireScribe, updateScribes } from './scribes.js';
import { setupVerseAreaDrop, completeVerse } from './grammar.js';
import { initializeElements, updateUI } from './ui.js';
import { gameState } from './state.js';

/**
 * Initialize the game
 */
function initializeGame() {
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
 * Setup all event handlers for buttons and interactions
 */
function setupEventHandlers() {
  // Strike button - generate letters
  const strikeBtn = document.getElementById('strikeBtn');
  if (strikeBtn) {
    strikeBtn.addEventListener('click', () => {
      for (let i = 0; i < gameState.lettersPerClick; i++) {
        spawnLetter(updateUI);
      }
      updateUI();
    });
  }

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

  // Forge words button
  const forgeWordsBtn = document.getElementById('forgeWordsBtn');
  if (forgeWordsBtn) {
    forgeWordsBtn.addEventListener('click', () => {
      forgeWords();
      updateUI();
    });
  }

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
