/**
 * LINGUA FORGE - GRAMMAR & VERSE SYSTEM
 * Handles verse assembly, grammar checking, and line completion
 */

import { GRAMMAR_LEXICON, SOLUTION_HEBREW_ORDER, VERSE_COMPLETION_REWARD } from './config.js?v=9';
import {
  gameState,
  findWord,
  removeWord,
  addVerseWord,
  reorderVerseWord,
  removeVerseWord,
  clearVerseWords,
  addInk,
  incrementLinesCompleted,
} from './state.js?v=9';

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
 * Remove a placed verse word by instance id and return it to inventory.
 * @param {string} instanceId
 * @returns {boolean}
 */
export function removeVerseWordByInstanceId(instanceId) {
  const removed = removeVerseWord(instanceId);
  if (!removed) return false;
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
 * Check if a selected sequence exactly matches the target verse.
 * @param {string[]} selectedWords - Hebrew words selected by player
 * @returns {boolean}
 */
export function isSelectedVerseCorrect(selectedWords) {
  if (!Array.isArray(selectedWords)) return false;
  if (selectedWords.length !== SOLUTION_HEBREW_ORDER.length) return false;
  return SOLUTION_HEBREW_ORDER.every((h, i) => selectedWords[i] === h);
}

/**
 * Complete verse from glossary selection flow.
 * @param {string[]} selectedWords
 * @returns {boolean} True when completion succeeded
 */
export function completeSelectedVerse(selectedWords) {
  if (!isSelectedVerseCorrect(selectedWords)) return false;

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

    // Create placeholder element
    const placeholder = document.createElement('div');
    placeholder.className = 'line-word-chip-placeholder';
    placeholder.style.width = rect.width + 'px';
    placeholder.style.height = rect.height + 'px';
    placeholder.style.opacity = '0.3';
    placeholder.style.border = '2px dashed #666';
    placeholder.style.background = 'transparent';
    placeholder.style.boxSizing = 'border-box';

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
  if (!verseArea || !placeholder) return;

  const isRTL = getComputedStyle(verseArea).direction === 'rtl';

  // Get chips excluding placeholder and dragged chip
  const chips = Array.from(verseArea.children).filter(el =>
    el.classList.contains('line-word-chip') &&
    !el.classList.contains('line-word-chip-placeholder') &&
    el.dataset.instanceId !== instanceId
  );

  // Sort chips by visual position for screen-space calculation
  chips.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

  let insertIndex = 0;

  for (const chip of chips) {
    const rect = chip.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    // Since chips are sorted by screen position, always use screen-space comparison
    if (clientX < midX) {
      break;
    }
    insertIndex++;
  }

  // Convert screen-space index to state-space index for RTL
  if (isRTL) {
    insertIndex = chips.length - insertIndex;
  }

  // Get all children again (without sorting) to find the element at state index
  const allChildren = Array.from(verseArea.children).filter(el =>
    el.classList.contains('line-word-chip') &&
    !el.classList.contains('line-word-chip-placeholder') &&
    el.dataset.instanceId !== instanceId
  );

  const insertBeforeChip = allChildren[insertIndex] || null;

  // Insert placeholder at calculated position
  if (insertBeforeChip) {
    verseArea.insertBefore(placeholder, insertBeforeChip);
  } else {
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

  const isRTL = getComputedStyle(verseArea).direction === 'rtl';
  const chips = Array.from(verseArea.children).filter(el =>
    el.classList.contains('line-word-chip') &&
    !el.classList.contains('line-word-chip-placeholder') &&
    el.dataset.instanceId !== instanceId
  );

  // Sort chips by visual position (left to right on screen)
  chips.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

  let insertIndex = 0;

  for (const chip of chips) {
    const rect = chip.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    // Since chips are sorted by screen position, always use screen-space comparison
    if (clientX < midX) {
      break;  // Insert at current index
    }

    insertIndex++;  // Move past this chip
  }

  // In RTL, state array order is right-to-left but we calculated index left-to-right
  // Convert: screen-left-to-right index -> state-right-to-left index
  if (isRTL) {
    insertIndex = chips.length - insertIndex;
  }

  // Get fresh DOM-order filtered array to find the actual element at this position
  const allChildren = Array.from(verseArea.children).filter(el =>
    el.classList.contains('line-word-chip') &&
    !el.classList.contains('line-word-chip-placeholder') &&
    el.dataset.instanceId !== instanceId
  );

  const insertBeforeChip = allChildren[insertIndex] || null;

  // Convert to state array index by finding the element in the full state
  let stateIndex;
  if (insertBeforeChip) {
    const targetInstanceId = insertBeforeChip.dataset.instanceId;
    stateIndex = gameState.verseWords.findIndex(w => w.instanceId === targetInstanceId);
  } else {
    // Insert at end
    stateIndex = gameState.verseWords.length;
  }

  reorderWord(instanceId, stateIndex);
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

    const isRTL = getComputedStyle(verseArea).direction === 'rtl';
    const chips = Array.from(verseArea.children).filter(el =>
      !el.classList.contains('line-word-chip-placeholder')
    );

    // Sort chips by visual position (left to right on screen)
    chips.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    let insertIndex = 0;

    for (const chip of chips) {
      const rect = chip.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;

      // Since chips are sorted by screen position, always use screen-space comparison
      if (e.clientX < midX) {
        break;
      }

      insertIndex++;
    }

    // In RTL, state array order is right-to-left but we calculated index left-to-right
    if (isRTL) {
      insertIndex = chips.length - insertIndex;
    }

    // Remove placeholder
    if (inventoryDragPlaceholder && inventoryDragPlaceholder.parentElement) {
      inventoryDragPlaceholder.parentElement.removeChild(inventoryDragPlaceholder);
      inventoryDragPlaceholder = null;
    }

    // Dropping a word from inventory
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

  const isRTL = getComputedStyle(verseArea).direction === 'rtl';

  // Get chips excluding placeholder (matches drop handler exactly)
  const chips = Array.from(verseArea.children).filter(el =>
    !el.classList.contains('line-word-chip-placeholder')
  );

  // Sort chips by visual position for screen-space calculation
  chips.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

  let insertIndex = 0;

  for (const chip of chips) {
    const rect = chip.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    // Since chips are sorted by screen position, always use screen-space comparison
    if (clientX < midX) {
      break;
    }
    insertIndex++;
  }

  // Convert screen-space index to state-space index for RTL
  if (isRTL) {
    insertIndex = chips.length - insertIndex;
  }

  // Get all children again (without sorting) to find the element at state index
  const allChildren = Array.from(verseArea.children).filter(el =>
    !el.classList.contains('line-word-chip-placeholder')
  );

  const insertBeforeChip = allChildren[insertIndex] || null;

  // Insert placeholder at calculated position
  if (insertBeforeChip) {
    verseArea.insertBefore(placeholder, insertBeforeChip);
  } else {
    verseArea.appendChild(placeholder);
  }
}
