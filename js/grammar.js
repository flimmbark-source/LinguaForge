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
  console.log('setupVerseWordChipDrag called for instanceId:', instanceId, 'chip:', chip);
  let dragState = null;

  chip.addEventListener('pointerdown', e => {
    console.log('POINTERDOWN EVENT FIRED for instanceId:', instanceId);
    e.preventDefault();
    const rect = chip.getBoundingClientRect();

    // Create placeholder element
    const placeholder = document.createElement('div');
    placeholder.className = 'line-word-chip-placeholder';
    placeholder.style.width = rect.width + 'px';
    placeholder.style.height = rect.height + 'px';
    placeholder.style.opacity = '0.3';
    placeholder.style.border = '2px dashed #666';
    placeholder.style.background = 'transparent';
    placeholder.style.boxSizing = 'border-box';
    console.log('Created placeholder:', placeholder, 'size:', rect.width, 'x', rect.height);

    dragState = {
      chip,
      instanceId,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      placeholder,
    };

    // Insert placeholder at current position
    chip.parentElement.insertBefore(placeholder, chip);

    // Make chip draggable
    chip.style.position = 'fixed';
    chip.style.left = rect.left + 'px';
    chip.style.top = rect.top + 'px';
    chip.style.zIndex = '1000';
    chip.style.opacity = '0.8';
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

    // Update placeholder position based on where drop would occur
    console.log('pointermove: updating placeholder position, clientX=', e.clientX);
    updatePlaceholderPosition(e.clientX, e.clientY, instanceId, dragState.placeholder);
  });

  chip.addEventListener('pointerup', e => {
    if (!dragState || dragState.chip !== chip) return;
    chip.releasePointerCapture(e.pointerId);

    // Check if we moved significantly (to distinguish from clicks)
    const moved = Math.abs(e.clientX - dragState.startX) > 5 || Math.abs(e.clientY - dragState.startY) > 5;

    if (moved) {
      // Calculate insertion index BEFORE resetting styling
      // This ensures we query chip positions while the dragged chip is still out of flow
      handleVerseWordDrop(e.clientX, e.clientY, instanceId, onUpdate);
    }

    // Remove placeholder
    if (dragState.placeholder && dragState.placeholder.parentElement) {
      dragState.placeholder.parentElement.removeChild(dragState.placeholder);
    }

    // Reset chip styling after reordering
    chip.style.position = '';
    chip.style.left = '';
    chip.style.top = '';
    chip.style.zIndex = '';
    chip.style.opacity = '';

    if (!moved) {
      // Just a click, not a drag - still update UI
      if (onUpdate) onUpdate();
    }

    gameState.draggedVerseInstanceId = null;
    dragState = null;
  });

  chip.addEventListener('pointercancel', e => {
    if (!dragState || dragState.chip !== chip) return;
    chip.releasePointerCapture(e.pointerId);

    // Remove placeholder
    if (dragState.placeholder && dragState.placeholder.parentElement) {
      dragState.placeholder.parentElement.removeChild(dragState.placeholder);
    }

    // Reset chip styling
    chip.style.position = '';
    chip.style.left = '';
    chip.style.top = '';
    chip.style.zIndex = '';
    chip.style.opacity = '';

    gameState.draggedVerseInstanceId = null;
    dragState = null;

    // Update UI to refresh the chips
    if (onUpdate) onUpdate();
  });
}

/**
 * Update placeholder position during drag to show where word will be inserted
 * @param {number} clientX - Mouse X position
 * @param {number} clientY - Mouse Y position
 * @param {string} instanceId - Instance ID of the word being dragged
 * @param {HTMLElement} placeholder - Placeholder element
 */
function updatePlaceholderPosition(clientX, clientY, instanceId, placeholder) {
  const verseArea = document.getElementById('grammarHebrewLine');
  if (!verseArea || !placeholder) {
    console.log('updatePlaceholderPosition: missing verseArea or placeholder', {verseArea, placeholder});
    return;
  }

  const chips = Array.from(verseArea.querySelectorAll('.line-word-chip, .line-word-chip-placeholder'));
  let insertBeforeChip = null;

  console.log('updatePlaceholderPosition: clientX=', clientX, 'chips count=', chips.length);

  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    // Skip the chip being dragged and the placeholder
    if (chip.dataset.instanceId === instanceId || chip.classList.contains('line-word-chip-placeholder')) continue;

    const rect = chip.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    console.log(`  Chip ${i}: left=${rect.left}, midX=${midX}, checking if ${clientX} < ${midX}`);

    if (clientX < midX) {
      insertBeforeChip = chip;
      console.log('  -> Will insert before this chip');
      break;
    }
  }

  // Move placeholder to the calculated position
  if (insertBeforeChip) {
    console.log('Inserting placeholder before chip:', insertBeforeChip.textContent);
    verseArea.insertBefore(placeholder, insertBeforeChip);
  } else {
    console.log('Appending placeholder to end');
    verseArea.appendChild(placeholder);
  }
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
  const chips = Array.from(verseArea.querySelectorAll('.line-word-chip, .line-word-chip-placeholder'));
  let insertIndex = 0;  // Start at position 0

  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    // Skip the chip being dragged and any placeholders
    if (chip.dataset.instanceId === instanceId || chip.classList.contains('line-word-chip-placeholder')) continue;

    const rect = chip.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    if (clientX < midX) {
      // Drop before this chip
      break;
    }

    // Drop after this chip, increment position
    insertIndex++;
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
  let inventoryDragPlaceholder = null;

  verseArea.addEventListener('dragenter', e => {
    if (gameState.draggedWordId === null) return;

    // Create placeholder if it doesn't exist
    if (!inventoryDragPlaceholder) {
      inventoryDragPlaceholder = document.createElement('div');
      inventoryDragPlaceholder.className = 'line-word-chip-placeholder';
      inventoryDragPlaceholder.style.width = '60px';
      inventoryDragPlaceholder.style.height = '24px';
      inventoryDragPlaceholder.style.opacity = '0.3';
      inventoryDragPlaceholder.style.border = '2px dashed #666';
      inventoryDragPlaceholder.style.background = 'transparent';
      inventoryDragPlaceholder.style.boxSizing = 'border-box';
      verseArea.appendChild(inventoryDragPlaceholder);
    }
  });

  verseArea.addEventListener('dragover', e => {
    e.preventDefault();

    // Update placeholder position if dragging from inventory
    if (gameState.draggedWordId !== null && inventoryDragPlaceholder) {
      updateInventoryPlaceholderPosition(e.clientX, verseArea, inventoryDragPlaceholder);
    }
  });

  verseArea.addEventListener('dragleave', e => {
    // Only remove placeholder if leaving the verse area entirely
    if (e.target === verseArea && inventoryDragPlaceholder) {
      if (inventoryDragPlaceholder.parentElement) {
        inventoryDragPlaceholder.parentElement.removeChild(inventoryDragPlaceholder);
      }
      inventoryDragPlaceholder = null;
    }
  });

  verseArea.addEventListener('drop', e => {
    e.preventDefault();

    // Calculate insertion index based on pointer position (before removing placeholder)
    const chips = Array.from(verseArea.querySelectorAll('.line-word-chip, .line-word-chip-placeholder'));
    let insertIndex = 0;
    for (let i = 0; i < chips.length; i++) {
      const chip = chips[i];
      // Skip any placeholders
      if (chip.classList.contains('line-word-chip-placeholder')) continue;

      const rect = chip.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (e.clientX < midX) {
        // Insert before this chip
        break;
      }
      // Insert after this chip
      insertIndex++;
    }

    // Remove placeholder
    if (inventoryDragPlaceholder && inventoryDragPlaceholder.parentElement) {
      inventoryDragPlaceholder.parentElement.removeChild(inventoryDragPlaceholder);
      inventoryDragPlaceholder = null;
    }

    // Dropping a word from inventory (still uses HTML5 drag-and-drop)
    if (gameState.draggedWordId !== null) {
      placeWordInVerse(gameState.draggedWordId, insertIndex);
      gameState.draggedWordId = null;
      if (onUpdate) onUpdate();
    }
  });
}

/**
 * Update placeholder position for inventory word drops
 * @param {number} clientX - Mouse X position
 * @param {HTMLElement} verseArea - Verse area element
 * @param {HTMLElement} placeholder - Placeholder element
 */
function updateInventoryPlaceholderPosition(clientX, verseArea, placeholder) {
  if (!verseArea || !placeholder) return;

  const chips = Array.from(verseArea.querySelectorAll('.line-word-chip, .line-word-chip-placeholder'));
  let insertBeforeChip = null;

  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    // Skip the placeholder itself
    if (chip.classList.contains('line-word-chip-placeholder')) continue;

    const rect = chip.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    if (clientX < midX) {
      insertBeforeChip = chip;
      break;
    }
  }

  // Move placeholder to the calculated position
  if (insertBeforeChip) {
    verseArea.insertBefore(placeholder, insertBeforeChip);
  } else {
    // Insert at the end
    verseArea.appendChild(placeholder);
  }
}
