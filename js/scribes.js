/**
 * LINGUA FORGE - SCRIBE SYSTEM
 * Handles automatic letter generation through Apprentice Scribes
 */

import {
  getScribeCost,
  SCRIBE_LETTERS_PER_BATCH,
  SCRIBE_INK_PER_BATCH,
  SCRIBE_CYCLE_SECONDS,
  SCRIBE_GHOST_LIFETIME,
} from './config.js?v=5';
import {
  gameState,
  spendLetters,
  spendInk,
  addScribe,
  addScribeGhost,
  updateScribeGhosts,
  getNextScribeId,
} from './state.js?v=5';
import { spawnLetter } from './letters.js?v=5';

/**
 * Hire a new scribe (if player can afford it)
 * @returns {boolean} True if successful
 */
export function hireScribe() {
  const cost = getScribeCost(gameState.scribeList.length);
  if (spendLetters(cost)) {
    const newScribe = {
      id: getNextScribeId(),
      progress: 0,
      paused: false,
      lettersLeftInBatch: 0,
    };
    addScribe(newScribe);
    return true;
  }
  return false;
}

/**
 * Toggle scribe paused state
 * @param {number} scribeId - Scribe ID
 */
export function toggleScribePaused(scribeId) {
  const scribe = gameState.scribeList.find(s => s.id === scribeId);
  if (scribe) {
    scribe.paused = !scribe.paused;
  }
}

/**
 * Process a single scribe tick (produce one letter)
 * @param {Object} scribe - Scribe object
 * @param {Function} onLetterSpawned - Callback when letter is spawned
 * @returns {boolean} True if letter was produced, false if blocked (no ink)
 */
export function processScribeTick(scribe, onLetterSpawned) {
  // Check if we need to start a new batch
  if (scribe.lettersLeftInBatch <= 0) {
    if (gameState.ink <= 0) {
      // No ink, can't start new batch
      scribe.progress = 1;
      return false;
    }
    // Start new batch
    spendInk(SCRIBE_INK_PER_BATCH);
    scribe.lettersLeftInBatch = SCRIBE_LETTERS_PER_BATCH;
  }

  // Produce letter
  scribe.progress -= 1;
  spawnLetter(onLetterSpawned);
  scribe.lettersLeftInBatch -= 1;
  addScribeGhost(scribe.id);
  return true;
}

/**
 * Update all scribes (called every frame)
 * @param {number} deltaTime - Time elapsed in seconds
 * @param {Function} onLetterSpawned - Callback when letter is spawned
 */
export function updateScribes(deltaTime, onLetterSpawned) {
  // Update scribes
  for (const scribe of gameState.scribeList) {
    if (scribe.paused) continue;

    scribe.progress += deltaTime / SCRIBE_CYCLE_SECONDS;
    while (scribe.progress >= 1) {
      const produced = processScribeTick(scribe, onLetterSpawned);
      if (!produced) {
        break;
      }
    }
  }

  // Update ghost animations
  updateScribeGhosts(deltaTime, SCRIBE_GHOST_LIFETIME);
}
