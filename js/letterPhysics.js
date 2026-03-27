/**
 * LINGUA FORGE - LETTER PHYSICS SYSTEM
 * Canvas-based physics for thrown letter blocks with gravity,
 * wall/floor collision, mold-slot auto-fill, and tool interaction.
 */

import { gameState } from './state.js?v=9';
import { canPlaceInHearth, heatHearth, spawnHearthSpark } from './RuneHearth.js?v=9';

// ─── Physics constants ───────────────────────────────────────
const GRAVITY        = 2000;   // px/s²
const AIR_FRICTION   = 0.999;  // per-frame velocity damping
const RESTITUTION    = 0.45;   // bounce energy kept on wall/floor hit
const FLOOR_FRICTION = 0.82;   // tangential damping on floor bounce
const STOP_VEL       = 25;     // below this speed → settled
const LETTER_WIDTH   = 22;     // px (visual tile width)
const LETTER_HEIGHT  = 34;     // px (visual tile height)
const HALF_W         = LETTER_WIDTH / 2;
const HALF_H         = LETTER_HEIGHT / 2;
const MAX_HALF       = Math.max(HALF_W, HALF_H);
const FLOOR_MARGIN   = 10;     // px above screen bottom

// ─── Mobile performance tuning ──────────────────────────────
const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
const MAX_PHYSICS_LETTERS = IS_MOBILE ? 20 : 60;
// On mobile, settle letters faster to reduce per-frame work
const MOBILE_STOP_VEL = IS_MOBILE ? 40 : STOP_VEL;

export class LetterPhysicsSystem {
  constructor() {
    /** @type {PhysicsLetter[]} */
    this.letters = [];
    this._idCounter = 0;

    // callback set by app.js when a mold slot is filled
    this.onSlotFilled = null;
    this.onAnvilClick = null;

    // Cached tile gradient (rebuilt when canvas context changes)
    this._tileGradient = null;

    // Cached DOM refs/rects to avoid per-frame layout reads
    this._slotCache = null;
    this._slotCacheTime = 0;
    this._slotCacheInterval = IS_MOBILE ? 260 : 160;
    this._slotCacheLineRef = null;

    this._hearthRectCache = null;
    this._hearthCacheTime = 0;
    this._hearthCacheInterval = IS_MOBILE ? 220 : 140;

    this._basketRectCache = null;
    this._basketCacheTime = 0;
    this._basketCacheInterval = IS_MOBILE ? 220 : 140;
    this._basketRef = null;
    this._letterPoolRef = null;
    this._anvilRectCache = null;
    this._anvilCacheTime = 0;
    this._anvilCacheInterval = IS_MOBILE ? 120 : 80;
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
    // Cap max physics letters to prevent performance degradation
    if (this.letters.length >= MAX_PHYSICS_LETTERS) {
      // Mark the oldest non-held letter as consumed to make room
      const oldest = this.letters.find(l => !l.consumed && !l.isHeld && l.settled);
      if (oldest) oldest.consumed = true;
      else return null; // hard cap
    }

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
      hasAnvilLanded: false,
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
    const now = performance.now();
    if (!this._anvilRectCache || now - this._anvilCacheTime > this._anvilCacheInterval) {
      this._anvilRectCache = typeof window.getAnvilViewportRect === 'function'
        ? window.getAnvilViewportRect()
        : null;
      this._anvilCacheTime = now;
    }
    const anvilRect = this._anvilRectCache;
    let hasActive = false;
    let hasMoving = false;

    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      hasActive = true;

      // If already settled just skip heavy math
      if (l.settled) continue;
      hasMoving = true;

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
      if (l.y + HALF_H > floorY) {
        l.y = floorY - HALF_H;
        if (l.vy > 0) {
          l.vy = -l.vy * RESTITUTION;
          l.vx *= FLOOR_FRICTION;
          l.angularVel *= 0.7;
          if (Math.abs(l.vy) < MOBILE_STOP_VEL) {
            l.vy = 0;
            l.vx *= 0.5;
            if (Math.abs(l.vx) < MOBILE_STOP_VEL) {
              l.vx = 0;
              l.angularVel = 0;
              l.settled = true;
              // Snap angle to nearest upright
              l.angle = Math.round(l.angle / (Math.PI / 2)) * (Math.PI / 2);
            }
          }
        }
      }

      // ── Anvil platform ──
      if (anvilRect && l.vy >= 0) {
        const withinX = l.x >= (anvilRect.left + HALF_W) && l.x <= (anvilRect.right - HALF_W);
        const footY = l.y + HALF_H;
        const nearTop = footY >= anvilRect.top && footY <= anvilRect.top + 18;
        if (withinX && nearTop) {
          l.y = anvilRect.top - HALF_H;
          l.vx *= 0.82;

          if (Math.abs(l.vy) <= 90) {
            l.vy = 0;
            l.vx *= 0.6;
            if (Math.abs(l.vx) < MOBILE_STOP_VEL) {
              l.vx = 0;
              l.angularVel = 0;
              l.settled = true;
              l.angle = Math.round(l.angle / (Math.PI / 2)) * (Math.PI / 2);
            }
          } else {
            l.vy = -l.vy * 0.18;
            l.angularVel *= 0.75;
          }

          if (!l.hasAnvilLanded) {
            l.hasAnvilLanded = true;
            if (this.onAnvilClick) this.onAnvilClick(l.x, l.y);
          }
        }
      }

      // ── Ceiling ──
      if (l.y - HALF_H < 0) {
        l.y = HALF_H;
        if (l.vy < 0) l.vy = -l.vy * RESTITUTION;
      }

      // ── Left wall ──
      if (l.x - HALF_W < 0) {
        l.x = HALF_W;
        if (l.vx < 0) {
          l.vx = -l.vx * RESTITUTION;
          l.vy *= FLOOR_FRICTION;
        }
      }

      // ── Right wall ──
      if (l.x + HALF_W > w) {
        l.x = w - HALF_W;
        if (l.vx > 0) {
          l.vx = -l.vx * RESTITUTION;
          l.vy *= FLOOR_FRICTION;
        }
      }
    }

    this.hasActiveLetters = hasActive;
    this.hasMovingLetters = hasMoving;

    // Purge consumed (in-place to avoid allocating a new array every frame)
    let writeIdx = 0;
    for (let i = 0; i < this.letters.length; i++) {
      if (!this.letters[i].consumed) {
        this.letters[writeIdx++] = this.letters[i];
      }
    }
    this.letters.length = writeIdx;
  }

  // ─── Mold-slot auto-fill ─────────────────────────────────

  /**
   * Check every in-flight letter against visible mold slots.
   * If the letter's character matches an open slot it overlaps, fill it.
   */
  checkMoldSlots() {
    if (!gameState.currentLine || !gameState.currentLine.molds) return;

    const now = performance.now();
    const shouldRefresh = !this._slotCache ||
      now - this._slotCacheTime > this._slotCacheInterval ||
      this._slotCacheLineRef !== gameState.currentLine;

    if (shouldRefresh) {
      const slots = document.querySelectorAll('.slot');
      if (!slots.length) {
        this._slotCache = null;
        return;
      }

      // Batch-read all slot rects ONCE, then check letters against cached rects
      const slotData = [];
      for (const slotEl of slots) {
        const moldId  = Number(slotEl.dataset.moldId);
        const slotIdx = Number(slotEl.dataset.slotIndex);
        const mold = gameState.currentLine.molds.find(m => m.id === moldId);
        if (!mold) continue;
        if (mold.runtime?.consumed) continue;
        if (mold.slots[slotIdx]) continue; // already filled
        const neededChar = mold.pattern[slotIdx];
        if (!neededChar) continue;
        const sr = slotEl.getBoundingClientRect();
        slotData.push({ slotEl, mold, slotIdx, neededChar, left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom });
      }

      this._slotCache = slotData;
      this._slotCacheTime = now;
      this._slotCacheLineRef = gameState.currentLine;
    }

    let slotData = this._slotCache;
    if (!slotData || !slotData.length) return;
    if (slotData.some(sd => !sd.slotEl?.isConnected)) {
      slotData = slotData.filter(sd => sd.slotEl?.isConnected);
      this._slotCache = slotData;
    }

    const tolerance = 6;
    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      const speed = Math.hypot(l.vx, l.vy);
      if (speed < 30 && !l.settled) continue;

      for (const sd of slotData) {
        if (!sd.mold || sd.mold.slots[sd.slotIdx]) continue;
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
    if (!canPlaceInHearth()) return;
    const now = performance.now();
        if (!this._hearthCollisionRef || !this._hearthCollisionRef.isConnected) {
      // Use the opening chamber for collisions so the hitbox matches the visible fire area,
      // not the full decorative hearth structure.
      this._hearthCollisionRef = document.querySelector('#hearth .hearth-opening') || document.getElementById('hearth');
    }
    if (!this._hearthRectCache || now - this._hearthCacheTime > this._hearthCacheInterval) {
      if (!this._hearthCollisionRef) return;
      const rect = this._hearthCollisionRef.getBoundingClientRect();
      // Adjust bounds so letters entering the hearth are easier to consume.
      // Reduce the inset to enlarge the effective consumption area.
      const insetX = Math.max(4, rect.width * 0.08);
      const insetTop = Math.max(2, rect.height * 0.02);
      const insetBottom = Math.max(4, rect.height * 0.12);
      this._hearthRectCache = {
        left: rect.left + insetX,
        right: rect.right - insetX,
        top: rect.top + insetTop,
        bottom: rect.bottom - insetBottom,
      };
      this._hearthCacheTime = now;
    }
    const hr = this._hearthRectCache;
    if (!hr || hr.left >= hr.right || hr.top >= hr.bottom) return;
    const floorBottom = window.innerHeight - FLOOR_MARGIN;
    const hearthBottom = Math.min(hr.bottom, floorBottom);

    for (const l of this.letters) {
      if (l.consumed || l.isHeld) continue;
      if (l.x >= hr.left && l.x <= hr.right && l.y >= hr.top && l.y <= hearthBottom) {
        l.consumed = true;
        heatHearth(1);
        spawnHearthSpark(l.x, l.y, 4);
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
    if (!this._letterPoolRef || !this._letterPoolRef.isConnected) {
      this._letterPoolRef = document.getElementById('letterPool');
    }
    const letterPool = this._letterPoolRef;
    if (!letterPool) return;
    if (!this._basketRef || !this._basketRef.isConnected) {
      this._basketRef = document.querySelector('.letter-basket');
    }

    const now = performance.now();
    if (!this._basketRectCache || now - this._basketCacheTime > this._basketCacheInterval) {
      // Use the pool element rect, clamped to the basket's inner padding.
      const poolRect = letterPool.getBoundingClientRect();
      const margin = 6;
      let left = poolRect.left - margin;
      let top = poolRect.top - margin;
      let right = poolRect.right + margin;
      let bottom = poolRect.bottom + margin;

      if (this._basketRef) {
        const basketRect = this._basketRef.getBoundingClientRect();
        // Cache computed padding to avoid forcing layout with getComputedStyle every refresh
        if (!this._basketPadding) {
          const basketStyles = getComputedStyle(this._basketRef);
          this._basketPadding = {
            left: parseFloat(basketStyles.paddingLeft) || 0,
            right: parseFloat(basketStyles.paddingRight) || 0,
            top: parseFloat(basketStyles.paddingTop) || 0,
            bottom: parseFloat(basketStyles.paddingBottom) || 0,
          };
        }
        const pad = this._basketPadding;

        left = Math.max(left, basketRect.left + pad.left - margin);
        right = Math.min(right, basketRect.right - pad.right + margin);
        top = Math.max(top, basketRect.top + pad.top - margin);
        bottom = Math.min(bottom, basketRect.bottom - pad.bottom + margin);
      }

      this._basketRectCache = { left, top, right, bottom };
      this._basketCacheTime = now;
    }

    const { left, top, right, bottom } = this._basketRectCache;

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
        if (l.x + HALF_W >= left && l.x - HALF_W <= right &&
          l.y + HALF_H >= top  && l.y - HALF_H <= bottom) {
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
      if (dist < radius + MAX_HALF && dist > 0) {
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

  /**
   * Return settled physics letters that are currently sitting on the anvil.
   * Useful for word discovery checks during red-hot hits.
   * @returns {Array<{id:number,char:string,x:number,y:number}>}
   */
  getAnvilLetters() {
    const anvilRect = typeof window.getAnvilViewportRect === 'function'
      ? window.getAnvilViewportRect()
      : null;
    if (!anvilRect) return [];

    return this.letters
      .filter((l) => {
        if (l.consumed || l.isHeld) return false;
        const onTopBand = (l.y + HALF_H) >= (anvilRect.top - 2) && (l.y + HALF_H) <= (anvilRect.top + 20);
        const withinX = l.x >= anvilRect.left && l.x <= anvilRect.right;
        return onTopBand && withinX;
      })
      .map((l) => ({ id: l.id, char: l.char, x: l.x, y: l.y }));
  }

  /**
   * Consume physics letters by id.
   * @param {number[]} ids
   */
  consumeLettersByIds(ids) {
    if (!ids || !ids.length) return;
    const idSet = new Set(ids);
    this.letters.forEach((l) => {
      if (idSet.has(l.id)) l.consumed = true;
    });
  }

  // ─── Render ──────────────────────────────────────────────

  /**
   * Draw all physics letters onto a canvas 2D context.
   * Assumes the context is in viewport-coordinate space.
   */
  render(ctx) {
    const tileW = LETTER_WIDTH;
    const tileH = LETTER_HEIGHT;
    // Set shared text properties once outside the loop
    ctx.font = 'bold 18px "Noto Sans Hebrew", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Reuse a single gradient for all tiles (origin-relative, applied via translate)
    if (!this._tileGradient) {
      this._tileGradient = ctx.createLinearGradient(-tileW / 2, -tileH / 2, tileW / 2, tileH / 2);
      this._tileGradient.addColorStop(0, '#0f0f10');
      this._tileGradient.addColorStop(1, '#1b1b1d');
    }

    for (const l of this.letters) {
      if (l.consumed) continue;

      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.angle);

      // Tile background — match DOM basket tile visuals
      roundRect(ctx, -tileW / 2, -tileH / 2, tileW, tileH, 6);
      ctx.fillStyle = this._tileGradient;
      ctx.fill();

      // Border: use basket gold color; on mobile keep previous behavior of skipping stroke for settled
      if (!IS_MOBILE || !l.settled) {
        ctx.strokeStyle = '#d1a640';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Letter character: match basket text color
      ctx.fillStyle = '#f3d27a';
      ctx.fillText(l.char, 0, 0);

      ctx.restore();
    }
  }

  /** Number of active (non-consumed) letters */
  get count() {
    let n = 0;
    for (let i = 0; i < this.letters.length; i++) {
      if (!this.letters[i].consumed) n++;
    }
    return n;
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
