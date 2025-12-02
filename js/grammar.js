/**
 * LINGUA FORGE - GRAMMAR & VERSE SYSTEM
 * Handles verse assembly, grammar checking, and line completion
 */

import { GRAMMAR_LEXICON, SOLUTION_HEBREW_ORDER, VERSE_COMPLETION_REWARD } from './config.js';
import {
  gameState,
  findWord,
  removeWord,
  addVerseWord,
  reorderVerseWord,
  clearVerseWords,
  addInk,
  incrementLinesCompleted,
} from './state.js';

/**
 * Evaluate the current verse
 * @param {Array} verseWordsArr - Array of verse word objects
 * @returns {Object} Evaluation result with translit, literal, and score
 */
export function evaluateVerse(verseWordsArr) {
  const verseHebrew = verseWordsArr.map(w => w.hebrew);

  // Build transliteration and literal gloss from lexicon
  const translitParts = [];
  const literalParts = [];
  verseHebrew.forEach(h => {
    const entry = GRAMMAR_LEXICON[h];
    if (entry) {
      translitParts.push(entry.translit);
      literalParts.push(entry.gloss);
    } else {
      translitParts.push(h);
      literalParts.push(h);
    }
  });

  // Score: how many positions match the solution order
  const len = SOLUTION_HEBREW_ORDER.length;
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (verseHebrew[i] && verseHebrew[i] === SOLUTION_HEBREW_ORDER[i]) {
      matches++;
    }
  }
  const score = len ? matches / len : 0;

  return {
    translit: translitParts.join(' '),
    literal: literalParts.join(' '),
    score,
  };
}

/**
 * Check if the verse is correctly solved
 * @returns {boolean} True if verse matches solution
 */
export function isVerseSolved() {
  const verseHebrew = gameState.verseWords.map(w => w.hebrew);
  if (verseHebrew.length !== SOLUTION_HEBREW_ORDER.length) return false;
  return SOLUTION_HEBREW_ORDER.every((h, i) => verseHebrew[i] === h);
}

/**
 * Place a word from inventory into the verse
 * @param {number} wordId - Word ID
 * @param {number} insertIndex - Index to insert at
 * @returns {boolean} True if successful
 */
export function placeWordInVerse(wordId, insertIndex) {
  const word = findWord(wordId);
  if (!word) return false;

  const instanceId = 'vw-' + Date.now() + '-' + Math.random();
  addVerseWord({ instanceId, hebrew: word.text }, insertIndex);
  removeWord(wordId);
  return true;
}

/**
 * Reorder a word within the verse
 * @param {string} instanceId - Instance ID of the verse word
 * @param {number} newIndex - New index for the word
 */
export function reorderWord(instanceId, newIndex) {
  reorderVerseWord(instanceId, newIndex);
}

/**
 * Complete the verse (if solved)
 * @returns {boolean} True if verse was completed
 */
export function completeVerse() {
  if (!isVerseSolved()) return false;

  addInk(VERSE_COMPLETION_REWARD);
  incrementLinesCompleted();
  clearVerseWords();
  return true;
}

/**
 * Setup drag-and-drop for verse word chips
 * @param {HTMLElement} chip - Word chip element
 * @param {string} instanceId - Instance ID of the verse word
 */
export function setupVerseWordChipDrag(chip, instanceId) {
  chip.draggable = true;
  chip.addEventListener('dragstart', e => {
    gameState.draggedVerseInstanceId = instanceId;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', instanceId);
    }
  });
  chip.addEventListener('dragend', () => {
    gameState.draggedVerseInstanceId = null;
  });
}

/**
 * Setup drag-and-drop for the verse area
 * @param {HTMLElement} verseArea - Verse area element
 * @param {Function} onUpdate - Callback when verse is updated
 */
export function setupVerseAreaDrop(verseArea, onUpdate) {
  verseArea.addEventListener('dragover', e => {
    e.preventDefault();
  });

  verseArea.addEventListener('drop', e => {
    e.preventDefault();

    // Calculate insertion index based on pointer position
    const chips = Array.from(verseArea.querySelectorAll('.line-word-chip'));
    let insertIndex = chips.length;
    for (let i = 0; i < chips.length; i++) {
      const rect = chips[i].getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (e.clientX < midX) {
        insertIndex = i;
        break;
      }
    }

    // Reordering existing verse chips
    if (gameState.draggedVerseInstanceId) {
      reorderWord(gameState.draggedVerseInstanceId, insertIndex);
      gameState.draggedVerseInstanceId = null;
      if (onUpdate) onUpdate();
      return;
    }

    // Dropping a word from inventory
    if (gameState.draggedWordId !== null) {
      placeWordInVerse(gameState.draggedWordId, insertIndex);
      gameState.draggedWordId = null;
      if (onUpdate) onUpdate();
    }
  });
}
