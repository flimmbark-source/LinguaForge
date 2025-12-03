/**
 * LINGUA FORGE - LETTER TILE SYSTEM
 * Handles letter generation, tile creation, and drag-and-drop mechanics
 */

import { getAllowedLetters, INK_PER_LETTER } from './config.js';
import { gameState, addLetters, addInk, getNextLetterId } from './state.js';

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
  const letterSellDiv = document.getElementById('letterSell');
  const moldListDiv = document.getElementById('moldList');
  const letterPoolDiv = document.getElementById('letterPool');

  // Priority 1: Sell board (convert to ink)
  if (letterSellDiv) {
    const sellRect = letterSellDiv.getBoundingClientRect();
    if (rectsIntersect(tileRect, sellRect)) {
      sellOneLetterFromTile(tile);
      resetLetterTilePosition(tile);
      return;
    }
  }

  // Priority 2: Mold slots (fill slots with matching letters)
  let matched = false;
  const char = tile.dataset.letterChar || '';
  if (moldListDiv) {
    const visibleSlots = moldListDiv.querySelectorAll('.slot');
    visibleSlots.forEach(slotEl => {
      if (matched) return;
      const moldId = Number(slotEl.dataset.moldId);
      const slotIndex = Number(slotEl.dataset.slotIndex);
      const mold = gameState.currentLine.molds.find(m => m.id === moldId);
      if (!mold) return;
      if (mold.slots[slotIndex]) return; // Already filled
      if (mold.pattern[slotIndex] !== char) return; // Wrong letter

      const slotRect = slotEl.getBoundingClientRect();
      if (!rectsIntersect(tileRect, slotRect)) return;

      // Valid drop! Fill the slot
      mold.slots[slotIndex] = true;
      consumeLetterTile(tile);
      matched = true;
      if (onSlotFilled) onSlotFilled();
    });
  }

  if (matched) {
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
  if (dragState.originalParent && dragState.originalParent.isConnected) {
    dragState.originalParent.appendChild(tile);
  }
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
    gameState.activeLetterDrag = {
      tile,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      originalParent: tile.parentElement,
    };
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

/**
 * Spawn a letter with animation from a specific position
 * @param {number} fromX - World X position to animate from
 * @param {number} fromY - World Y position to animate from
 * @param {number} power - Strike power (0-1.5) for animation intensity
 * @param {Function} onDrop - Callback when tile is dropped
 */
export function spawnLetterAnimated(fromX, fromY, power, onDrop) {
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

    // Briefly highlight the existing tile
    existing.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
    existing.style.transform = 'scale(1.3)';
    existing.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.6)';
    setTimeout(() => {
      existing.style.transform = '';
      existing.style.boxShadow = '';
    }, 200);
    return;
  }

  // Create new tile
  const tile = createLetterTile(char, onDrop);

  // Position tile at the starting location (absolute positioning)
  tile.style.position = 'fixed';
  tile.style.left = fromX + 'px';
  tile.style.top = fromY + 'px';
  tile.style.zIndex = '200';

  // Get the final position in the letter pool
  letterPoolDiv.appendChild(tile);
  const finalRect = tile.getBoundingClientRect();

  // Calculate offset from start to end
  const deltaX = fromX - finalRect.left;
  const deltaY = fromY - finalRect.top;

  // Set CSS variables for animation
  const rotation = (Math.random() - 0.5) * 720 * power; // Spin based on power
  tile.style.setProperty('--start-x', deltaX + 'px');
  tile.style.setProperty('--start-y', deltaY + 'px');
  tile.style.setProperty('--rotation', rotation + 'deg');

  // Add flying class to trigger animation
  tile.classList.add('flying');

  // Clean up after animation
  setTimeout(() => {
    tile.classList.remove('flying');
    tile.style.position = '';
    tile.style.left = '';
    tile.style.top = '';
    tile.style.zIndex = '';
    tile.style.removeProperty('--start-x');
    tile.style.removeProperty('--start-y');
    tile.style.removeProperty('--rotation');
  }, 800);
}
