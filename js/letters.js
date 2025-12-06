/**
 * LINGUA FORGE - LETTER TILE SYSTEM
 * Handles letter generation, tile creation, and drag-and-drop mechanics
 */

import { getAllowedLetters, INK_PER_LETTER } from './config.js';
import { gameState, addLetters, addInk, getNextLetterId } from './state.js';
import { spawnResourceGain } from './resourceGainFeedback.js';
import { canPlaceInHearth, heatHearth } from './hearth.js';

function getLetterDragOverlay() {
  let overlay = document.getElementById('letterDragOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'letterDragOverlay';
    overlay.className = 'letter-drag-overlay';
    document.body.appendChild(overlay);
  }
  return overlay;
}

/**
 * Get a random allowed letter
 * @returns {string} Random Hebrew letter
 */
export function randomAllowedLetter() {
  const allowedLetters = getAllowedLetters();
  if (allowedLetters.length === 0) return 'א';
  const idx = Math.floor(Math.random() * allowedLetters.length);
  return allowedLetters[idx];
}

/**
 * Update letter tile label (character + count badge if > 1)
 * @param {HTMLElement} tile - Letter tile element
 */
export function updateLetterTileLabel(tile) {
  const char = tile.dataset.letterChar || '';
  const count = parseInt(tile.dataset.count || '1', 10);
  tile.innerHTML = '<span>' + char + '</span>';
  if (count > 1) {
    const badge = document.createElement('span');
    badge.className = 'letter-count';
    badge.textContent = 'x' + count;
    tile.appendChild(badge);
  }
}

/**
 * Reset letter tile position to default
 * @param {HTMLElement} tile - Letter tile element
 */
export function resetLetterTilePosition(tile) {
  tile.style.position = '';
  tile.style.left = '';
  tile.style.top = '';
  tile.style.zIndex = '';
}

/**
 * Consume one letter from a tile (decrement count or remove)
 * @param {HTMLElement} tile - Letter tile element
 */
export function consumeLetterTile(tile) {
  const count = parseInt(tile.dataset.count || '1', 10);
  if (count > 1) {
    tile.dataset.count = String(count - 1);
    updateLetterTileLabel(tile);
  } else {
    tile.remove();
  }
}

/**
 * Sell one letter from a tile (convert to ink)
 * @param {HTMLElement} tile - Letter tile element
 */
export function sellOneLetterFromTile(tile) {
  consumeLetterTile(tile);
  addInk(INK_PER_LETTER);
}

/**
 * Feed one letter to the hearth (heat it up)
 * @param {HTMLElement} tile - Letter tile element
 */
export function feedLetterToHearth(tile) {
  if (!canPlaceInHearth()) {
    // maybe snap the letter back or show a tooltip
    console.log('You cannot place letters in the hearth while it is off.');
    return false;
  }
  consumeLetterTile(tile);
  heatHearth(1); // Heat hearth for 5 seconds per letter
  return true;
}

/**
 * Check if two rectangles intersect
 * @param {DOMRect} r1 - First rectangle
 * @param {DOMRect} r2 - Second rectangle
 * @returns {boolean} True if rectangles intersect
 */
function rectsIntersect(r1, r2) {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
}

/**
 * Handle letter tile drop (check for valid drop zones)
 * @param {number} clientX - Mouse X position
 * @param {number} clientY - Mouse Y position
 * @param {HTMLElement} tile - Letter tile element
 * @param {Object} dragState - Drag state object
 * @param {Function} onSlotFilled - Callback when slot is filled
 */
export function handleLetterDrop(clientX, clientY, tile, dragState, onSlotFilled) {
  const tileRect = tile.getBoundingClientRect();
  const hearthDiv = document.getElementById('hearth');
  const moldListDiv = document.getElementById('moldList');
  const letterPoolDiv = document.getElementById('letterPool');

  const returnTileToBasket = () => {
    if (letterPoolDiv) {
      letterPoolDiv.appendChild(tile);
    } else if (dragState.originalParent && dragState.originalParent.isConnected) {
      dragState.originalParent.appendChild(tile);
    }
  };

  // Priority 1: Hearth (heat it up)
  if (hearthDiv) {
    const hearthRect = hearthDiv.getBoundingClientRect();
    if (rectsIntersect(tileRect, hearthRect)) {
      const consumed = feedLetterToHearth(tile);
      if (consumed) {
        if (tile.isConnected) {
          returnTileToBasket();
          resetLetterTilePosition(tile);
        }
      } else {
        returnTileToBasket();
        resetLetterTilePosition(tile);
      }
      return;
    }
  }

  // Priority 2: Mold slots (fill slots with matching letters)
  let matched = false;
  const char = tile.dataset.letterChar || '';
  if (moldListDiv) {
    const visibleSlots = moldListDiv.querySelectorAll('.slot');
    for (const slotEl of visibleSlots) {
      if (matched) break;

      const moldId = Number(slotEl.dataset.moldId);
      const slotIndex = Number(slotEl.dataset.slotIndex);
      const mold = gameState.currentLine.molds.find(m => m.id === moldId);
      if (!mold) continue;
      if (mold.slots[slotIndex]) continue; // Already filled
      if (mold.pattern[slotIndex] !== char) continue; // Wrong letter

      const slotRect = slotEl.getBoundingClientRect();
      if (!rectsIntersect(tileRect, slotRect)) continue;

      // Valid drop! Fill the slot
      mold.slots[slotIndex] = true;
      const centerX = slotRect.left + slotRect.width / 2;
      const centerY = slotRect.top + slotRect.height / 2;
      const rewardAmount = 2;
      addLetters(rewardAmount);
      spawnResourceGain(centerX, centerY, rewardAmount, 'renown');
      addLetters(2);
      spawnResourceGain(centerX, centerY, 2, 'renown');
      consumeLetterTile(tile);
      matched = true;
      if (onSlotFilled) onSlotFilled();
    }
  }

  if (matched) {
    returnTileToBasket(tile);
    resetLetterTilePosition(tile);
    return;
  }

  // Priority 3: Letter pool (return to pool)
  if (letterPoolDiv) {
    const poolRect = letterPoolDiv.getBoundingClientRect();
    if (rectsIntersect(tileRect, poolRect)) {
      letterPoolDiv.appendChild(tile);
      resetLetterTilePosition(tile);
      return;
    }
  }

  // Priority 4: Default - return to original parent
  returnTileToBasket();
  resetLetterTilePosition(tile);
}

/**
 * Setup pointer drag events for a letter tile
 * @param {HTMLElement} tile - Letter tile element
 * @param {Function} onDrop - Callback when tile is dropped
 */
export function setupLetterTilePointerDrag(tile, onDrop) {
  tile.addEventListener('pointerdown', e => {
    e.preventDefault();
    const rect = tile.getBoundingClientRect();
    const overlay = getLetterDragOverlay();
    gameState.activeLetterDrag = {
      tile,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      originalParent: tile.parentElement,
    };
    overlay.appendChild(tile);
    tile.style.position = 'fixed';
    tile.style.left = rect.left + 'px';
    tile.style.top = rect.top + 'px';
    tile.style.zIndex = '1000';
    tile.setPointerCapture(e.pointerId);
  });

  tile.addEventListener('pointermove', e => {
    if (!gameState.activeLetterDrag || gameState.activeLetterDrag.tile !== tile) return;
    e.preventDefault();
    const x = e.clientX - gameState.activeLetterDrag.offsetX;
    const y = e.clientY - gameState.activeLetterDrag.offsetY;
    tile.style.left = x + 'px';
    tile.style.top = y + 'px';
  });

  tile.addEventListener('pointerup', e => {
    if (!gameState.activeLetterDrag || gameState.activeLetterDrag.tile !== tile) return;
    tile.releasePointerCapture(e.pointerId);
    const dragState = gameState.activeLetterDrag;
    gameState.activeLetterDrag = null;
    handleLetterDrop(e.clientX, e.clientY, tile, dragState, onDrop);
  });
}

/**
 * Create a new letter tile element
 * @param {string} char - Hebrew character
 * @param {Function} onDrop - Callback when tile is dropped
 * @returns {HTMLElement} Letter tile element
 */
export function createLetterTile(char, onDrop) {
  const tile = document.createElement('div');
  tile.className = 'letter-tile';
  tile.dataset.letterChar = char;
  tile.dataset.count = '1';
  tile.dataset.letterId = String(getNextLetterId());
  updateLetterTileLabel(tile);
  setupLetterTilePointerDrag(tile, onDrop);
  return tile;
}

/**
 * Spawn a new letter (add to pool)
 * @param {Function} onDrop - Callback when tile is dropped
 */
export function spawnLetter(onDrop) {
  const char = randomAllowedLetter();
  addLetters(1);
  const letterPoolDiv = document.getElementById('letterPool');
  if (!letterPoolDiv) return;

  // Check if we already have a tile with this character (stack them)
  const existing = Array.from(letterPoolDiv.children).find(
    el => el.classList && el.classList.contains('letter-tile') && el.dataset.letterChar === char
  );
  if (existing) {
    const current = parseInt(existing.dataset.count || '1', 10);
    existing.dataset.count = String(current + 1);
    updateLetterTileLabel(existing);
    return;
  }

  // Create new tile
  const tile = createLetterTile(char, onDrop);
  letterPoolDiv.appendChild(tile);
}
