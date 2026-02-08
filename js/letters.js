/**
 * LINGUA FORGE - LETTER TILE SYSTEM
 * Handles letter generation, tile creation, and drag-and-drop mechanics
 */

import { getAllowedLetters, INK_PER_LETTER } from './config.js?v=9';
import { gameState, addLetters, addInk, getNextLetterId } from './state.js?v=9';
import { canPlaceInHearth, heatHearth, spawnHearthSpark } from './RuneHearth.js?v=9';

// ─── Physics-based letter throw ──────────────────────────────
let _heldLetter = null;
let _mouseHist = [];
let _moldHoldState = null;

function setScreenLocked(locked) {
  if (window.setScreenLocked) {
    window.setScreenLocked(locked);
  }
}

function setMoldViewportHold(shouldHold) {
  const wrapper = document.querySelector('.mold-viewport-wrapper');
  if (!wrapper) return;
  if (shouldHold) {
    if (_moldHoldState) return;
    _moldHoldState = {
      wasOpen: wrapper.classList.contains('open'),
    };
    wrapper.classList.add('open');
    wrapper.dataset.dragHold = 'true';
  } else if (_moldHoldState) {
    if (!_moldHoldState.wasOpen) {
      wrapper.classList.remove('open');
    }
    delete wrapper.dataset.dragHold;
    _moldHoldState = null;
  }
}

// Pick up physics letters from the canvas by clicking/tapping on them
document.addEventListener('pointerdown', e => {
  if (_heldLetter) return;
  if (!window.letterPhysics) return;
  // Don't intercept if we're interacting with a DOM letter tile or UI element
  const tag = e.target.tagName.toLowerCase();
  if (tag === 'button' || tag === 'input' || tag === 'select') return;
  if (e.target.classList && e.target.classList.contains('letter-tile')) return;
  if (e.target.closest && e.target.closest('.letter-tile')) return;
  // Only pick up from the canvas or body (not from UI panels)
  if (e.target.closest && (
    e.target.closest('.workers-panel') ||
    e.target.closest('.tools-sidebar') ||
    e.target.closest('.mold-viewport-wrapper') ||
    e.target.closest('.upgrade-modal') ||
    e.target.closest('.stats-wrap') ||
    e.target.closest('.upgrades-btn') ||
    e.target.closest('.letter-basket') ||
    e.target.closest('.magic-book')
  )) return;

  const letter = window.letterPhysics.pickupNearest(e.clientX, e.clientY, 30);
  if (letter) {
    e.preventDefault();
    letter.isHeld = true;
    letter.settled = false;
    _heldLetter = letter;
    _mouseHist = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    gameState.activeLetterDrag = { isPhysics: true };
    setMoldViewportHold(true);
    setScreenLocked(true);
  }
});

document.addEventListener('pointermove', e => {
  if (!_heldLetter) return;
  _heldLetter.x = e.clientX;
  _heldLetter.y = e.clientY;
  _mouseHist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (_mouseHist.length > 6) _mouseHist.shift();
});

document.addEventListener('pointerup', e => {
  if (!_heldLetter) return;
  let vx = 0, vy = 0;
  if (_mouseHist.length >= 2) {
    const a = _mouseHist[_mouseHist.length - 1];
    let b = _mouseHist[0];
    for (let i = _mouseHist.length - 2; i >= 0; i--) {
      if (a.t - _mouseHist[i].t >= 50) { b = _mouseHist[i]; break; }
    }
    const dt = (a.t - b.t) / 1000;
    if (dt > 0.01) {
      vx = (a.x - b.x) / dt;
      vy = (a.y - b.y) / dt;
      const sp = Math.hypot(vx, vy);
      if (sp > 2500) { vx *= 2500 / sp; vy *= 2500 / sp; }
    }
  }
  _heldLetter.isHeld = false;
  _heldLetter.settled = false;
  _heldLetter.vx = vx;
  _heldLetter.vy = vy;
  _heldLetter.angularVel = vx * 0.005;
  _heldLetter = null;
  _mouseHist = [];
  gameState.activeLetterDrag = null;
  setMoldViewportHold(false);
  setScreenLocked(false);
});

document.addEventListener('pointercancel', () => {
  if (!_heldLetter) return;
  _heldLetter.isHeld = false;
  _heldLetter = null;
  _mouseHist = [];
  gameState.activeLetterDrag = null;
  setMoldViewportHold(false);
  setScreenLocked(false);
});

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
  const tileRect = tile.getBoundingClientRect();
  consumeLetterTile(tile);
  heatHearth(1); // Heat hearth for 5 seconds per letter
  spawnHearthSpark(tileRect.left + tileRect.width / 2, tileRect.top + tileRect.height / 2, 5);
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
 * @param {Function} onSlotFilled - Callback when slot is filled (receives the slot element)
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
      if (onSlotFilled) onSlotFilled(slotEl);
    });
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

    // Physics-based throw (if system available)
    if (window.letterPhysics && !_heldLetter) {
      const char = tile.dataset.letterChar || '';
      consumeLetterTile(tile);
      _heldLetter = window.letterPhysics.spawn(char, e.clientX, e.clientY);
      _heldLetter.isHeld = true;
      _mouseHist = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      gameState.activeLetterDrag = { isPhysics: true };
      setMoldViewportHold(true);
      return;
    }

    // Fallback: DOM-based drag
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
    setMoldViewportHold(true);
    setScreenLocked(true);
  });

  tile.addEventListener('pointermove', e => {
    if (!gameState.activeLetterDrag || gameState.activeLetterDrag.isPhysics) return;
    if (gameState.activeLetterDrag.tile !== tile) return;
    e.preventDefault();
    const x = e.clientX - gameState.activeLetterDrag.offsetX;
    const y = e.clientY - gameState.activeLetterDrag.offsetY;
    tile.style.left = x + 'px';
    tile.style.top = y + 'px';
  });

  tile.addEventListener('pointerup', e => {
    if (!gameState.activeLetterDrag || gameState.activeLetterDrag.isPhysics) return;
    if (gameState.activeLetterDrag.tile !== tile) return;
    tile.releasePointerCapture(e.pointerId);
    const dragState = gameState.activeLetterDrag;
    gameState.activeLetterDrag = null;
    handleLetterDrop(e.clientX, e.clientY, tile, dragState, onDrop);
    setMoldViewportHold(false);
    setScreenLocked(false);
  });

  tile.addEventListener('pointercancel', () => {
    if (!gameState.activeLetterDrag || gameState.activeLetterDrag.isPhysics) return;
    if (gameState.activeLetterDrag.tile !== tile) return;
    const dragState = gameState.activeLetterDrag;
    gameState.activeLetterDrag = null;
    if (dragState.originalParent && dragState.originalParent.isConnected) {
      dragState.originalParent.appendChild(tile);
    }
    resetLetterTilePosition(tile);
    setMoldViewportHold(false);
    setScreenLocked(false);
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
