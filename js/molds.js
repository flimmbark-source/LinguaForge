/**
 * LINGUA FORGE - MOLD & WORD SYSTEM
 * Handles mold display, word forging, and inventory management
 */

import { computeWordPower, INK_PER_WORD_LETTER } from './config.js?v=6';
import { gameState, addWord, removeWord, findWord, addInk, getNextWordId } from './state.js?v=6';

/**
 * Set mold viewport width based on longest mold pattern
 */
export function setMoldViewportWidth() {
  const moldViewportDiv = document.querySelector('.mold-viewport');
  if (!moldViewportDiv || !gameState.currentLine.molds.length) return;

  const longest = gameState.currentLine.molds.reduce((max, m) => Math.max(max, m.pattern.length + 1), 0);
  const slotWidth = 32;
  const gap = 6;
  const extra = 96;
  const innerWidth = longest > 0 ? (longest * slotWidth + (longest - 1) * gap) : 0;
  const viewportWidth = innerWidth + extra;
  moldViewportDiv.style.width = viewportWidth + 'px';
}

/**
 * Navigate to previous mold
 */
export function navigatePreviousMold() {
  if (!gameState.currentLine.molds.length) return;
  gameState.currentMoldIndex = (gameState.currentMoldIndex - 1 + gameState.currentLine.molds.length) % gameState.currentLine.molds.length;
}

/**
 * Navigate to next mold
 */
export function navigateNextMold() {
  if (!gameState.currentLine.molds.length) return;
  gameState.currentMoldIndex = (gameState.currentMoldIndex + 1) % gameState.currentLine.molds.length;
}

/**
 * Forge words from completed molds
 * @returns {Array} Array of forged word objects
 */
export function forgeWords() {
  const forgedWords = [];

  gameState.currentLine.molds.forEach(mold => {
    // Check if all slots are filled
    if (mold.slots.every(slot => slot)) {
      const word = {
        id: getNextWordId(),
        text: mold.pattern,
        english: mold.english,
        length: mold.pattern.length,
        power: computeWordPower(mold.pattern.length),
      };
      addWord(word);
      forgedWords.push(word);

      // Reset mold slots
      mold.slots = new Array(mold.pattern.length).fill(false);
    }
  });

  return forgedWords;
}

/**
 * Sell a word for ink
 * @param {number} wordId - ID of word to sell
 * @returns {boolean} True if successful
 */
export function sellWord(wordId) {
  const word = findWord(wordId);
  if (!word) return false;

  const inkGain = word.length * INK_PER_WORD_LETTER;
  addInk(inkGain);
  removeWord(wordId);
  return true;
}

/**
 * Setup drag events for a word chip
 * @param {HTMLElement} chip - Word chip element
 * @param {number} wordId - Word ID
 */
export function setupWordChipDrag(chip, wordId) {
  chip.draggable = true;
  chip.addEventListener('dragstart', e => {
    gameState.draggedWordId = wordId;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', String(wordId));
    }
  });
  chip.addEventListener('dragend', () => {
    gameState.draggedWordId = null;
  });
}
