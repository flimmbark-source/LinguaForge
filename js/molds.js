/**
 * LINGUA FORGE - MOLD & WORD SYSTEM
 * Handles mold display, mold-world physics, and inventory management
 */

import { computeWordPower, INK_PER_WORD_LETTER } from './config.js?v=9';
import { gameState, addWord, removeWord, findWord, addInk, getNextWordId, recordForgedWord } from './state.js?v=9';

const moldWorldState = {
  initialized: false,
  worldLayer: null,
  pointerId: null,
  activeMoldId: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  lastX: 0,
  lastY: 0,
  lastTime: 0,
  rafId: 0,
  lastFrameTime: 0,
};

const GRAVITY = 1900;
const AIR_DRAG = 0.985;
const FLOOR_FRICTION = 0.86;
const HEARTH_DOCK_MARGIN = 40;

function ensureMoldRuntime(mold) {
  if (!mold.runtime) {
    mold.runtime = {
      inViewport: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      dragging: false,
      docked: false,
      heated: false,
      consumed: false,
      rotationDeg: 0,
    };
  }
  return mold.runtime;
}

function getHearthRects() {
  const hearth = document.getElementById('hearth');
  const base = document.querySelector('#hearth .hearth-base');
  if (!hearth) return null;
  const hearthRect = hearth.getBoundingClientRect();
  const baseRect = base ? base.getBoundingClientRect() : hearthRect;
  return { hearthRect, baseRect };
}

function ensureWorldLayer() {
  if (moldWorldState.worldLayer && moldWorldState.worldLayer.isConnected) return moldWorldState.worldLayer;
  let layer = document.getElementById('moldWorldLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'moldWorldLayer';
    layer.className = 'mold-world-layer';
    document.body.appendChild(layer);
  }
  moldWorldState.worldLayer = layer;
  return layer;
}

function spawnMoldClink(x, y) {
  const el = document.createElement('div');
  el.className = 'mold-clink-popup';
  el.textContent = 'Clink!';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 650);
}


function createMoldCard(mold, { world = false } = {}) {
  const card = document.createElement('div');
  card.className = world ? 'mold-card mold-instance world-mold' : 'mold-card mold-instance viewport-mold';
  card.dataset.moldId = String(mold.id);

  const slotsRow = document.createElement('div');
  slotsRow.className = 'mold-slots';
  mold.pattern.split('').forEach((ch, idx) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.moldId = String(mold.id);
    slot.dataset.slotIndex = String(idx);
    slot.textContent = ch;
    slotsRow.appendChild(slot);
  });

  card.appendChild(slotsRow);
  return card;
}



function attachWorldMoldPointerDrag(card) {
  if (!card || card.dataset.dragBound === 'true') return;
  card.dataset.dragBound = 'true';
  card.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    beginDragFromCard(card, e, false);
  });
}
function hydrateMoldCard(card, mold, { world = false } = {}) {
  const runtime = ensureMoldRuntime(mold);
  card.classList.toggle('is-heated', Boolean(runtime.heated));
  card.classList.toggle('is-docked', Boolean(runtime.docked));
  card.classList.toggle('is-consumed', Boolean(runtime.consumed));
  card.dataset.heated = runtime.heated ? 'true' : 'false';

  const slotCount = Math.max(1, mold.pattern.length);
  const slotSize = 32;
  const slotGap = 6;
  const sideBuffer = 10;
  const moldWidth = slotCount * slotSize + (slotCount - 1) * slotGap + sideBuffer * 2;
  card.style.width = `${moldWidth}px`;

  const slots = card.querySelectorAll('.slot');
  slots.forEach((slotEl) => {
    const idx = Number(slotEl.dataset.slotIndex);
    const filled = Boolean(mold.slots[idx]);
    slotEl.classList.toggle('filled', filled);
    slotEl.style.opacity = filled ? '1' : '0.4';
  });

  if (world) {
    card.style.transform = `translate(${runtime.x}px, ${runtime.y}px) rotate(${runtime.rotationDeg || 0}deg)`;
  }
}

function pointerToViewportPosition(e) {
  return { x: e.clientX, y: e.clientY, time: performance.now() };
}

function beginDragFromCard(card, e, fromViewport = false) {
  const moldId = Number(card.dataset.moldId);
  const mold = gameState.currentLine.molds.find(m => m.id === moldId);
  if (!mold) return;
  const runtime = ensureMoldRuntime(mold);
  if (runtime.consumed) return;

  const worldLayer = ensureWorldLayer();
  let worldCard = worldLayer.querySelector(`.world-mold[data-mold-id="${moldId}"]`);
  const rect = card.getBoundingClientRect();

  if (!worldCard) {
    worldCard = createMoldCard(mold, { world: true });
    worldLayer.appendChild(worldCard);
  }
  attachWorldMoldPointerDrag(worldCard);

  if (fromViewport) {
    runtime.inViewport = false;
    runtime.x = rect.left;
    runtime.y = rect.top;
  }

  hydrateMoldCard(worldCard, mold, { world: true });

  runtime.dragging = true;
  runtime.vx = 0;
  runtime.vy = 0;

  moldWorldState.pointerId = e.pointerId ?? null;
  moldWorldState.activeMoldId = moldId;
  moldWorldState.dragOffsetX = e.clientX - rect.left;
  moldWorldState.dragOffsetY = e.clientY - rect.top;
  const p = pointerToViewportPosition(e);
  moldWorldState.lastX = p.x;
  moldWorldState.lastY = p.y;
  moldWorldState.lastTime = p.time;

  worldCard.setPointerCapture?.(e.pointerId);
}

function updateDrag(e) {
  if (!moldWorldState.activeMoldId) return;
  const mold = gameState.currentLine.molds.find(m => m.id === moldWorldState.activeMoldId);
  if (!mold) return;
  const runtime = ensureMoldRuntime(mold);
  if (!runtime.dragging) return;

  runtime.x = e.clientX - moldWorldState.dragOffsetX;
  runtime.y = e.clientY - moldWorldState.dragOffsetY;

  const now = performance.now();
  const dt = Math.max(0.008, (now - moldWorldState.lastTime) / 1000);
  runtime.vx = (e.clientX - moldWorldState.lastX) / dt;
  runtime.vy = (e.clientY - moldWorldState.lastY) / dt;
  moldWorldState.lastX = e.clientX;
  moldWorldState.lastY = e.clientY;
  moldWorldState.lastTime = now;
}

function finishDrag() {
  if (!moldWorldState.activeMoldId) return;
  const mold = gameState.currentLine.molds.find(m => m.id === moldWorldState.activeMoldId);
  moldWorldState.activeMoldId = null;
  moldWorldState.pointerId = null;
  if (!mold) return;

  const runtime = ensureMoldRuntime(mold);
  runtime.dragging = false;

  runtime.inViewport = false;
}

function setupPointerHandlers() {
  if (moldWorldState.initialized) return;
  moldWorldState.initialized = true;

  document.addEventListener('pointermove', (e) => {
    if (moldWorldState.pointerId !== null && e.pointerId !== moldWorldState.pointerId) return;
    updateDrag(e);
  });
  document.addEventListener('pointerup', (e) => {
    if (moldWorldState.pointerId !== null && e.pointerId !== moldWorldState.pointerId) return;
    finishDrag(e);
  });
  document.addEventListener('pointercancel', (e) => {
    if (moldWorldState.pointerId !== null && e.pointerId !== moldWorldState.pointerId) return;
    finishDrag(e);
  });
}

function tickMoldPhysics(now) {
  if (!moldWorldState.lastFrameTime) moldWorldState.lastFrameTime = now;
  const dt = Math.min(0.033, (now - moldWorldState.lastFrameTime) / 1000);
  moldWorldState.lastFrameTime = now;

  const worldLayer = ensureWorldLayer();
  const hearthRects = getHearthRects();

  gameState.currentLine.molds.forEach((mold) => {
    const runtime = ensureMoldRuntime(mold);
    const existing = worldLayer.querySelector(`.world-mold[data-mold-id="${mold.id}"]`);

    if (runtime.consumed || runtime.inViewport) {
      if (existing) existing.remove();
      runtime.heated = false;
      return;
    }

    let card = existing;
    if (!card) {
      card = createMoldCard(mold, { world: true });
      worldLayer.appendChild(card);
    }
    attachWorldMoldPointerDrag(card);

    if (!runtime.dragging) {
      runtime.vy += GRAVITY * dt;
      runtime.vx *= AIR_DRAG;
      runtime.vy *= AIR_DRAG;
      runtime.x += runtime.vx * dt;
      runtime.y += runtime.vy * dt;

      const cardWidth = card.offsetWidth || 240;
      const cardHeight = card.offsetHeight || 110;
      runtime.x = Math.max(8, Math.min(window.innerWidth - cardWidth - 8, runtime.x));

      const floor = window.innerHeight - cardHeight - 12;
      if (runtime.y > floor) {
        runtime.y = floor;
        runtime.vy = 0;
        runtime.vx *= FLOOR_FRICTION;
      }

      let willDock = false;
      if (hearthRects) {
        const { hearthRect, baseRect } = hearthRects;
        const centerX = runtime.x + cardWidth / 2;
        const nearHearth = centerX > hearthRect.left - HEARTH_DOCK_MARGIN && centerX < hearthRect.right + HEARTH_DOCK_MARGIN;
        const baseTop = baseRect.top - cardHeight + 8;
        if (nearHearth && runtime.y >= baseTop - 16 && runtime.y <= baseTop + 26) {
          runtime.y = baseTop;
          runtime.vy = 0;
          runtime.vx *= 0.45;
          willDock = true;
        }
      }

      if (willDock && !runtime.docked) {
        runtime.rotationDeg = (Math.random() * 10) - 5;
        spawnMoldClink(runtime.x + cardWidth * 0.5, runtime.y + 12);
      } else if (!willDock) {
        runtime.rotationDeg *= 0.85;
      }

      runtime.docked = willDock;
      runtime.heated = willDock;
    }

    hydrateMoldCard(card, mold, { world: true });
  });

  moldWorldState.rafId = requestAnimationFrame(tickMoldPhysics);
}


function getStoredMolds() {
  return gameState.currentLine.molds.filter((mold) => {
    const runtime = ensureMoldRuntime(mold);
    return runtime.inViewport && !runtime.consumed;
  });
}

/**
 * Set mold viewport width based on longest mold pattern
 */
export function setMoldViewportWidth() {
  // Mold viewport removed.
}

export function navigatePreviousMold() {
  gameState.currentMoldIndex = 0;
}

export function navigateNextMold() {
  gameState.currentMoldIndex = 0;
}

export function initializeMoldSystem() {
  const worldLayer = document.getElementById('moldWorldLayer');
  if (worldLayer) worldLayer.remove();
}

export function getMoldById(moldId) {
  return gameState.currentLine.molds.find(m => m.id === moldId) || null;
}

export function getWorldMoldElement(moldId) {
  return document.querySelector(`.world-mold[data-mold-id="${moldId}"]`);
}

export function getForgeableMoldAtPoint(clientX, clientY) {
  void clientX;
  void clientY;
  return null;
}

export function consumeMold(moldId) {
  const mold = getMoldById(moldId);
  if (!mold) return;
  const runtime = ensureMoldRuntime(mold);
  runtime.consumed = true;
  runtime.inViewport = true;
  runtime.heated = false;
}

/**
 * Forge a completed mold into a word.
 * @param {Object} mold
 * @returns {Object|null}
 */
export function forgeSingleMold(mold) {
  if (!mold || mold.slots.some(slot => !slot)) return null;

  const word = {
    id: getNextWordId(),
    text: mold.pattern,
    english: mold.english,
    length: mold.pattern.length,
    power: computeWordPower(mold.pattern.length),
  };

  addWord(word);
  recordForgedWord(word);
  mold.slots = new Array(mold.pattern.length).fill(false);
  consumeMold(mold.id);

  return word;
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

export function renderMoldsInViewport(container) {
  if (container) {
    container.innerHTML = '';
  }
}
