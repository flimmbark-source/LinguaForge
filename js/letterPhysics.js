/**
 * LINGUA FORGE - LETTER PHYSICS SYSTEM
 * Canvas-based physics for thrown letter blocks with gravity,
 * wall/floor collision, mold-slot auto-fill, and tool interaction.
 */

import { gameState } from './state.js?v=9';
import { canPlaceInHearth, heatHearth } from './RuneHearth.js?v=9';

// ─── Physics constants ───────────────────────────────────────
const GRAVITY        = 2000;   // px/s²
const AIR_FRICTION   = 0.999;  // per-frame velocity damping
const RESTITUTION    = 0.45;   // bounce energy kept on wall/floor hit
const FLOOR_FRICTION = 0.82;   // tangential damping on floor bounce
const STOP_VEL       = 25;     // below this speed → settled
const LETTER_SIZE    = 28;     // px  (visual tile size)
const HALF           = LETTER_SIZE / 2;
const FLOOR_MARGIN   = 10;     // px above screen bottom

export class LetterPhysicsSystem {
  constructor() {
    /** @type {PhysicsLetter[]} */
    this.letters = [];
    this._idCounter = 0;

    // callback set by app.js when a mold slot is filled
    this.onSlotFilled = null;
  }

  // ─── Spawning ────────────────────────────────────────────

  /**
   * Add a physics letter at the given viewport position.
   * @param {string} char  Hebrew character
   * @param {number} x     viewport X
   * @param {number} y     viewport Y
   * @param {number} [vx]  initial horizontal velocity (px/s)
   * @param {number} [vy]  initial vertical velocity (px/s)
   * @returns {object} the new letter object
   */
  spawn(char, x, y, vx = 0, vy = 0) {
    const letter = {
      id: ++this._idCounter,
      char,
      x, y,
      vx, vy,
      angle: 0,
      angularVel: (Math.random() - 0.5) * 8,
      isHeld: false,
      settled: false,
      consumed: false,
    };
    this.letters.push(letter);
    return letter;
  }

  // ─── Update ──────────────────────────────────────────────

  /**
   * Step all letters forward by dt seconds.
   * @param {number} dt   seconds since last frame
   * @param {number} w    viewport width
   * @param {number} h    viewport height
   */
  update(dt, w, h) {
    const floorY = h - FLOOR_MARGIN;

    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;

      // If already settled just skip heavy math
      if (l.settled) continue;

      // Gravity
      l.vy += GRAVITY * dt;

      // Air friction
      l.vx *= AIR_FRICTION;
      l.vy *= AIR_FRICTION;

      // Integrate position
      l.x += l.vx * dt;
      l.y += l.vy * dt;

      // Rotation
      l.angle += l.angularVel * dt;

      // ── Floor ──
      if (l.y + HALF > floorY) {
        l.y = floorY - HALF;
        if (l.vy > 0) {
          l.vy = -l.vy * RESTITUTION;
          l.vx *= FLOOR_FRICTION;
          l.angularVel *= 0.7;
          if (Math.abs(l.vy) < STOP_VEL) {
            l.vy = 0;
            l.vx *= 0.5;
            if (Math.abs(l.vx) < STOP_VEL) {
              l.vx = 0;
              l.angularVel = 0;
              l.settled = true;
              // Snap angle to nearest upright
              l.angle = Math.round(l.angle / (Math.PI / 2)) * (Math.PI / 2);
            }
          }
        }
      }

      // ── Ceiling ──
      if (l.y - HALF < 0) {
        l.y = HALF;
        if (l.vy < 0) l.vy = -l.vy * RESTITUTION;
      }

      // ── Left wall ──
      if (l.x - HALF < 0) {
        l.x = HALF;
        if (l.vx < 0) {
          l.vx = -l.vx * RESTITUTION;
          l.vy *= FLOOR_FRICTION;
        }
      }

      // ── Right wall ──
      if (l.x + HALF > w) {
        l.x = w - HALF;
        if (l.vx > 0) {
          l.vx = -l.vx * RESTITUTION;
          l.vy *= FLOOR_FRICTION;
        }
      }
    }

    // Purge consumed
    this.letters = this.letters.filter(l => !l.consumed);
  }

  // ─── Mold-slot auto-fill ─────────────────────────────────

  /**
   * Check every in-flight letter against visible mold slots.
   * If the letter's character matches an open slot it overlaps, fill it.
   */
  checkMoldSlots() {
    const moldListDiv = document.getElementById('moldList');
    if (!moldListDiv) return;

    const slots = moldListDiv.querySelectorAll('.slot');
    if (!slots.length) return;

    // Batch-read all slot rects ONCE, then check letters against cached rects
    const slotData = [];
    for (const slotEl of slots) {
      const moldId  = Number(slotEl.dataset.moldId);
      const slotIdx = Number(slotEl.dataset.slotIndex);
      if (!gameState.currentLine || !gameState.currentLine.molds) continue;
      const mold = gameState.currentLine.molds.find(m => m.id === moldId);
      if (!mold) continue;
      if (mold.slots[slotIdx]) continue; // already filled
      const neededChar = mold.pattern[slotIdx];
      if (!neededChar) continue;
      const sr = slotEl.getBoundingClientRect();
      slotData.push({ slotEl, mold, slotIdx, neededChar, left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom });
    }

    if (!slotData.length) return;

    const tolerance = 6;
    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      const speed = Math.hypot(l.vx, l.vy);
      if (speed < 30 && !l.settled) continue;

      for (const sd of slotData) {
        if (sd.neededChar !== l.char) continue;
        if (l.x >= sd.left - tolerance && l.x <= sd.right + tolerance &&
            l.y >= sd.top - tolerance  && l.y <= sd.bottom + tolerance) {
          sd.mold.slots[sd.slotIdx] = true;
          l.consumed = true;
          if (this.onSlotFilled) this.onSlotFilled(sd.slotEl);
          // Remove this slot from further checks
          slotData.splice(slotData.indexOf(sd), 1);
          break;
        }
      }
    }
  }

  // ─── Hearth auto-feed ────────────────────────────────────

  /**
   * Check if any moving letter has entered the hearth and feed it.
   */
  checkHearth() {
    const hearthDiv = document.getElementById('hearth');
    if (!hearthDiv) return;
    if (!canPlaceInHearth()) return;

    const hr = hearthDiv.getBoundingClientRect();

    for (const l of this.letters) {
      if (l.consumed || l.isHeld || l.settled) continue;
      if (l.x >= hr.left && l.x <= hr.right && l.y >= hr.top && l.y <= hr.bottom) {
        l.consumed = true;
        heatHearth(1);
      }
    }
  }

  // ─── Basket return ─────────────────────────────────────

  /**
   * Check if any non-held physics letters have entered the letter basket.
   * If so, mark them consumed and call the callback to return them to inventory.
   * @param {Function} onReturnToBasket - callback(char) when a letter returns to basket
   */
  checkBasket(onReturnToBasket) {
    const letterPool = document.getElementById('letterPool');
    if (!letterPool) return;

    // Use the pool element rect with modest insets (avoids per-tile rect reads)
    const br = letterPool.getBoundingClientRect();
    const insetX = br.width * 0.2;
    const margin = 12;
    const left   = br.left + insetX - margin;
    const top    = br.top - margin;
    const right  = br.right - insetX + margin;
    const bottom = br.bottom + margin;

    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      if (l.x >= left && l.x <= right && l.y >= top && l.y <= bottom) {
        l.consumed = true;
        if (onReturnToBasket) onReturnToBasket(l.char);
      }
    }
  }

  // ─── Tool interaction helpers ────────────────────────────

  /**
   * Try to pick up a physics letter near (screenX, screenY).
   * Returns the letter object (caller should set consumed=true) or null.
   * @param {number} screenX  viewport X
   * @param {number} screenY  viewport Y
   * @param {number} [radius] search radius
   */
  pickupNearest(screenX, screenY, radius = 35) {
    let best = null;
    let bestDist = radius;
    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      const d = Math.hypot(l.x - screenX, l.y - screenY);
      if (d < bestDist) { best = l; bestDist = d; }
    }
    return best;
  }

  /**
   * Find all physics letters overlapping an AABB (in viewport coords).
   * @returns {object[]} array of overlapping letter objects
   */
  pickupInRect(left, top, right, bottom) {
    const results = [];
    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      if (l.x + HALF >= left && l.x - HALF <= right &&
          l.y + HALF >= top  && l.y - HALF <= bottom) {
        results.push(l);
      }
    }
    return results;
  }

  /**
   * Push letters away from a circle (e.g. hammer head).
   * @param {number} cx     center X (viewport)
   * @param {number} cy     center Y (viewport)
   * @param {number} radius collision radius
   * @param {number} pushVx horizontal push velocity
   * @param {number} pushVy vertical push velocity
   */
  pushFrom(cx, cy, radius, pushVx = 0, pushVy = 0) {
    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      const dx = l.x - cx;
      const dy = l.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < radius + HALF && dist > 0) {
        // Normalize direction and apply push
        const nx = dx / dist;
        const ny = dy / dist;
        const pushStrength = 400;
        l.vx += nx * pushStrength + pushVx * 0.3;
        l.vy += ny * pushStrength + pushVy * 0.3;
        l.settled = false;
        l.angularVel = (Math.random() - 0.5) * 10;
      }
    }
  }

  // ─── Render ──────────────────────────────────────────────

  /**
   * Draw all physics letters onto a canvas 2D context.
   * Assumes the context is in viewport-coordinate space.
   */
  render(ctx) {
    for (const l of this.letters) {
      if (l.consumed) continue;

      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.angle);

      // Tile background
      const s = LETTER_SIZE;
      roundRect(ctx, -s / 2, -s / 2, s, s, 6);
      ctx.fillStyle = l.isHeld ? '#1e293b' : '#111827';
      ctx.fill();
      ctx.strokeStyle = l.isHeld ? '#6366f1' : '#4b5563';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Letter character
      ctx.fillStyle = '#f9fafb';
      ctx.font = 'bold 18px "Noto Sans Hebrew", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.char, 0, 2); // slight offset for visual centering

      ctx.restore();
    }
  }

  /** Number of active (non-consumed) letters */
  get count() {
    return this.letters.filter(l => !l.consumed).length;
  }
}

// ─── Helper: canvas rounded rect ──────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
