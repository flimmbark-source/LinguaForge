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
 * Setup pointer-based drag for verse word chips (more reliable than HTML5 drag-and-drop)
 * @param {HTMLElement} chip - Word chip element
 * @param {string} instanceId - Instance ID of the verse word
 * @param {Function} onUpdate - Callback when verse is updated
 */
export function setupVerseWordChipDrag(chip, instanceId, onUpdate) {
  let dragState = null;

  chip.addEventListener('pointerdown', e => {
    e.preventDefault();
    const rect = chip.getBoundingClientRect();
    dragState = {
      chip,
      instanceId,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
    };

    // Make chip draggable
    chip.style.position = 'fixed';
    chip.style.left = rect.left + 'px';
    chip.style.top = rect.top + 'px';
    chip.style.zIndex = '1000';
    chip.setPointerCapture(e.pointerId);

    gameState.draggedVerseInstanceId = instanceId;
  });

  chip.addEventListener('pointermove', e => {
    if (!dragState || dragState.chip !== chip) return;
    e.preventDefault();
    const x = e.clientX - dragState.offsetX;
    const y = e.clientY - dragState.offsetY;
    chip.style.left = x + 'px';
    chip.style.top = y + 'px';
  });

  chip.addEventListener('pointerup', e => {
    if (!dragState || dragState.chip !== chip) return;
    chip.releasePointerCapture(e.pointerId);

    // Check if we moved significantly (to distinguish from clicks)
    const moved = Math.abs(e.clientX - dragState.startX) > 5 || Math.abs(e.clientY - dragState.startY) > 5;

    // Reset chip styling before reordering (so it doesn't flash)
    chip.style.position = '';
    chip.style.left = '';
    chip.style.top = '';
    chip.style.zIndex = '';

    if (moved) {
      handleVerseWordDrop(e.clientX, e.clientY, instanceId, onUpdate);
    } else {
      // Just a click, not a drag - still update UI
      if (onUpdate) onUpdate();
    }

    gameState.draggedVerseInstanceId = null;
    dragState = null;
  });

  chip.addEventListener('pointercancel', e => {
    if (!dragState || dragState.chip !== chip) return;
    chip.releasePointerCapture(e.pointerId);

    // Reset chip styling
    chip.style.position = '';
    chip.style.left = '';
    chip.style.top = '';
    chip.style.zIndex = '';

    gameState.draggedVerseInstanceId = null;
    dragState = null;

    // Update UI to refresh the chips
    if (onUpdate) onUpdate();
  });
}

/**
 * Handle dropping a verse word (reordering within verse)
 * @param {number} clientX - Mouse X position
 * @param {number} clientY - Mouse Y position
 * @param {string} instanceId - Instance ID of the word being dropped
 * @param {Function} onUpdate - Callback when verse is updated
 */
export function handleVerseWordDrop(clientX, clientY, instanceId, onUpdate) {
  const verseArea = document.getElementById('grammarHebrewLine');
  if (!verseArea) return;

  // Calculate insertion index based on pointer position
  const chips = Array.from(verseArea.querySelectorAll('.line-word-chip'));
  let insertIndex = chips.length;

  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    // Skip the chip being dragged
    if (chip.dataset.instanceId === instanceId) continue;

    const rect = chip.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    if (clientX < midX) {
      insertIndex = i;
      break;
    }
  }

  // Reorder the word
  reorderWord(instanceId, insertIndex);

  if (onUpdate) onUpdate();
}

/**
 * Setup drag-and-drop for the verse area (for inventory words)
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

    // Dropping a word from inventory (still uses HTML5 drag-and-drop)
    if (gameState.draggedWordId !== null) {
      placeWordInVerse(gameState.draggedWordId, insertIndex);
      gameState.draggedWordId = null;
      if (onUpdate) onUpdate();
    }
  });
}
