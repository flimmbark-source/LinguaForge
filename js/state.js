/**
 * LINGUA FORGE - GAME STATE MANAGEMENT
 * Centralized state management for all game data
 */

import { CURRENT_LINE } from './config.js';

/**
 * Game state object containing all game data
 */
export const gameState = {
  // Economy
  letters: 0,
  ink: 0,
  lettersPerClick: 1,

  // Words (player inventory)
  words: [],
  nextWordId: 1,

  // Scribes
  scribeList: [],
  nextScribeId: 1,
  scribeGhosts: [],

  // Letters (for letter tiles)
  letterIdCounter: 1,

  // Molds
  currentLine: CURRENT_LINE,
  currentMoldIndex: 0,

  // Verse / Grammar
  verseWords: [],

  // Drag state
  draggedWordId: null,
  draggedVerseInstanceId: null,
  activeLetterDrag: null,

  // Completed lines counter
  linesCompleted: 0,

  // Upgrades
  upgrades: {},

  // Unlockable features (disabled by default)
  hearthUnlocked: true, // Start unlocked for now - can be set to false if upgrade is needed
  scribesUnlocked: false,
  pestleUnlocked: false,

  // Upgrade-affected properties
  pestleCapacity: 10,
  redHotHits: 3,
  heatLevels: 1,
  secondsPerLetter: 5,
  lettersPerRedHot: 1,
  scribeLettersPerInk: 5,
  inkPerChurn: 1,
  ripSpeedThreshold: 3400, // Base threshold for hammer rip
};

/**
 * Add letters to player's total
 * @param {number} amount - Number of letters to add
 */
export function addLetters(amount) {
  gameState.letters += amount;
}

/**
 * Spend letters (returns true if successful)
 * @param {number} amount - Number of letters to spend
 * @returns {boolean} True if successful, false if insufficient letters
 */
export function spendLetters(amount) {
  if (gameState.letters >= amount) {
    gameState.letters -= amount;
    return true;
  }
  return false;
}

/**
 * Add ink to player's total
 * @param {number} amount - Amount of ink to add
 */
export function addInk(amount) {
  gameState.ink += amount;
}

/**
 * Spend ink (returns true if successful)
 * @param {number} amount - Amount of ink to spend
 * @returns {boolean} True if successful, false if insufficient ink
 */
export function spendInk(amount) {
  if (gameState.ink >= amount) {
    gameState.ink -= amount;
    return true;
  }
  return false;
}

/**
 * Add a word to player's inventory
 * @param {Object} word - Word object to add
 */
export function addWord(word) {
  gameState.words.push(word);
}

/**
 * Remove a word from player's inventory
 * @param {number} wordId - ID of word to remove
 * @returns {Object|null} Removed word or null if not found
 */
export function removeWord(wordId) {
  const index = gameState.words.findIndex(w => w.id === wordId);
  if (index !== -1) {
    return gameState.words.splice(index, 1)[0];
  }
  return null;
}

/**
 * Find a word by ID
 * @param {number} wordId - ID of word to find
 * @returns {Object|null} Word object or null if not found
 */
export function findWord(wordId) {
  return gameState.words.find(w => w.id === wordId) || null;
}

/**
 * Add a scribe
 * @param {Object} scribe - Scribe object to add
 */
export function addScribe(scribe) {
  gameState.scribeList.push(scribe);
}

/**
 * Add a scribe ghost (visual effect)
 * @param {number} scribeId - ID of the scribe
 */
export function addScribeGhost(scribeId) {
  gameState.scribeGhosts.push({
    id: Date.now() + Math.random(),
    scribeId,
    t: 0,
  });
}

/**
 * Update scribe ghosts (age them and remove expired ones)
 * @param {number} deltaTime - Time elapsed in seconds
 * @param {number} lifetime - Maximum lifetime for ghosts
 */
export function updateScribeGhosts(deltaTime, lifetime) {
  gameState.scribeGhosts.forEach(ghost => {
    ghost.t += deltaTime;
  });
  gameState.scribeGhosts = gameState.scribeGhosts.filter(g => g.t < lifetime);
}

/**
 * Add a verse word (placing word in verse area)
 * @param {Object} verseWord - Verse word object
 * @param {number} insertIndex - Index to insert at
 */
export function addVerseWord(verseWord, insertIndex) {
  if (insertIndex < 0 || insertIndex > gameState.verseWords.length) {
    insertIndex = gameState.verseWords.length;
  }
  gameState.verseWords.splice(insertIndex, 0, verseWord);
}

/**
 * Remove a verse word
 * @param {string} instanceId - Instance ID of the verse word
 * @returns {Object|null} Removed verse word or null if not found
 */
export function removeVerseWord(instanceId) {
  const index = gameState.verseWords.findIndex(w => w.instanceId === instanceId);
  if (index !== -1) {
    return gameState.verseWords.splice(index, 1)[0];
  }
  return null;
}

/**
 * Reorder a verse word
 * @param {string} instanceId - Instance ID of the verse word
 * @param {number} newIndex - New index for the word
 */
export function reorderVerseWord(instanceId, newIndex) {
  const oldIndex = gameState.verseWords.findIndex(w => w.instanceId === instanceId);
  if (oldIndex !== -1) {
    const [moved] = gameState.verseWords.splice(oldIndex, 1);
    let insertIndex = newIndex;
    if (insertIndex > oldIndex) insertIndex--;
    if (insertIndex < 0 || insertIndex > gameState.verseWords.length) {
      insertIndex = gameState.verseWords.length;
    }
    gameState.verseWords.splice(insertIndex, 0, moved);
  }
}

/**
 * Clear all verse words (after completing a verse)
 */
export function clearVerseWords() {
  gameState.verseWords = [];
}

/**
 * Increment completed lines counter
 */
export function incrementLinesCompleted() {
  gameState.linesCompleted++;
}

/**
 * Get next word ID and increment counter
 * @returns {number} Next word ID
 */
export function getNextWordId() {
  return gameState.nextWordId++;
}

/**
 * Get next scribe ID and increment counter
 * @returns {number} Next scribe ID
 */
export function getNextScribeId() {
  return gameState.nextScribeId++;
}

/**
 * Get next letter ID and increment counter
 * @returns {number} Next letter ID
 */
export function getNextLetterId() {
  return gameState.letterIdCounter++;
}
