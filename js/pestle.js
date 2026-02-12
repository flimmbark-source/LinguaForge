/**
 * LINGUA FORGE - PESTLE & MORTAR SYSTEM
 * Physics-based pestle grinding mechanic for ink production.
 * The player holds the pestle and physically moves it into the mortar
 * through the top opening, then grinds against the bottom to produce ink.
 */

import { playPestleGrind, playPestleSquelch } from './audio.js?v=9';
import { handleToolDragNearSidebar, shouldPutToolAway, cleanupToolDragSidebar } from './toolSidebarHelpers.js?v=9';

const MOBILE_BREAKPOINT = 900;
function setScreenLocked(locked) {
  if (window.setScreenLocked) {
    window.setScreenLocked(locked);
  }
}

function setBackgroundDragLocked(locked) {
  if (window.setBackgroundDragLocked) {
    window.setBackgroundDragLocked(locked);
  }
}

export class PestleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Callbacks set by app
    this.onInkProduced = null;
    this.onPutAway = null;
    this.overlayRenderer = null;

    // Load pestle and mortar PNG images
    this._pestleImg = new Image();
    this._pestleImg.src = 'Public/Pestle.png';
    this._mortarImg = new Image();
    this._mortarImg.src = 'Public/Mortar.png';

    // World physics constants
    this.gravity = 3400;
    this.mortarGravity = 12000; // Dramatically increased gravity inside mortar
    this.airFriction = 0.9;

    // Pestle state
    this.pestle = {
      pivotX: 0,   // handle end (top)
      pivotY: 0,
      headX: 0,    // grinding end (bottom)
      headY: 0,
      prevHeadX: 0,
      prevHeadY: 0,
      constantLength: 140,
      width: 30,
      handleThickness: 12,
      angle: 0,
      attachedLetters: [],
    };

    // Mortar state
    this.mortar = {
      x: 0,
      y: 0,
      width: 200,
      height: 80,
    };

    // Whether the pestle tip is currently inside the mortar bowl
    this.insideMortar = false;

    // Grinding tracker
    this.grindTracker = {
      lastX: 0,
      distance: 0,
      threshold: 50, // pixels of horizontal movement to produce ink
      cooldown: 0,
    };

    this.pressTracker = {
      holdTime: 0,
      holdThreshold: 0.65, // seconds pressing at the bottom before release can produce ink
      liftDistance: 18,
      armed: false,
    };

    // Visual effects
    this.inkDrops = [];

    // Input state
    this.input = {
      mouseX: 0,
      mouseY: 0,
      isDown: false,
    };

    // Animation state
    this.lastTime = 0;
    this.isRunning = false;

    // Bind methods
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.loop = this.loop.bind(this);
    this.resize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);

    this.mortarAnchor = null;

    // Initialize
    this.resize();
    this.setupEventListeners();
  }

  /**
   * Resize canvas to fit container
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this._cachedCanvasRect = null; // invalidate rect cache

    // Position mortar just above the hearth so they visually stack
    const isMobile = this.width <= 768;

    // Read the hearth's actual top position so the mortar sits right on it
    const hearthEl = document.getElementById('hearth');
    const canvasRect = this.canvas.getBoundingClientRect();
    let mortarBottom;
      const basketEl = document.querySelector('.letter-basket');
      if (basketEl) {
        const basketRect = basketEl.getBoundingClientRect();
        mortarBottom = basketRect.top - canvasRect.top - 2;
      }

    if (mortarBottom === undefined) {
      if (hearthEl) {
        const hearthRect = hearthEl.getBoundingClientRect();
        mortarBottom = hearthRect.top - canvasRect.top - 4;
      } else {
        const letterPoolBarHeight = isMobile ? 110 : 160;
        mortarBottom = this.height - letterPoolBarHeight;
      }
    }

    const mortarOffsetX = isMobile ? 0 : 400;
    this.mortar.width = Math.min(isMobile ? 160 : 200, this.width * 0.3);
    this.mortar.height = isMobile ? 60 : 80;
    this.mortar.x = this.width * 0.5 - this.mortar.width / 2 + mortarOffsetX;
    this.mortar.y = mortarBottom - this.mortar.height;

    // Position pestle above mortar
    const pivotX = this.width * 0.5 + mortarOffsetX;
    const pivotY = this.mortar.y - (isMobile ? 70 : 100);
    this.pestle.pivotX = pivotX;
    this.pestle.pivotY = pivotY;
    this.pestle.headX = pivotX;
    this.pestle.headY = pivotY + this.pestle.constantLength;
    this.pestle.prevHeadX = this.pestle.headX;
    this.pestle.prevHeadY = this.pestle.headY;
    this.pestle.angle = -Math.PI / 2;

    this.insideMortar = false;
    this.pressTracker.holdTime = 0;
    this.pressTracker.armed = false;

    // Keep mobile mortar anchored to the background after viewport/orientation changes.
    this.applyMortarAnchor();
  }

  onViewportChange() {
    this.resize();
  }

  setMortarAnchor(anchor) {
    this.mortarAnchor = anchor;
    this.applyMortarAnchor();
  }

  applyMortarAnchor() {
    if (!this.mortarAnchor || window.innerWidth > MOBILE_BREAKPOINT) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const oldCenterX = this.mortar.x + this.mortar.width / 2;
    const oldCenterY = this.mortar.y + this.mortar.height / 2;

    this.mortar.width = this.mortarAnchor.width;
    this.mortar.height = this.mortarAnchor.height;
    this.mortar.x = this.mortarAnchor.x - canvasRect.left - this.mortar.width / 2;
    this.mortar.y = this.mortarAnchor.y - canvasRect.top - this.mortar.height / 2;

    const newCenterX = this.mortar.x + this.mortar.width / 2;
    const newCenterY = this.mortar.y + this.mortar.height / 2;

    const isMobileLandscape = window.innerWidth <= MOBILE_BREAKPOINT && window.innerWidth > window.innerHeight;
    this.pestle.constantLength = isMobileLandscape ? 120 : 140;

    if (this._mortarAnchorInitialized) {
      // Keep current interaction state by translating existing pestle positions.
      const dx = newCenterX - oldCenterX;
      const dy = newCenterY - oldCenterY;
      this.pestle.pivotX += dx;
      this.pestle.pivotY += dy;
      this.pestle.headX += dx;
      this.pestle.headY += dy;
      this.pestle.prevHeadX += dx;
      this.pestle.prevHeadY += dy;
      return;
    }

    this._mortarAnchorInitialized = true;
    const pivotX = this.mortar.x + this.mortar.width / 2;
    const pivotY = this.mortar.y - (isMobileLandscape ? 64 : 76);
    this.pestle.pivotX = pivotX;
    this.pestle.pivotY = pivotY;
    this.pestle.headX = pivotX;
    this.pestle.headY = pivotY + this.pestle.constantLength;
    this.pestle.prevHeadX = this.pestle.headX;
    this.pestle.prevHeadY = this.pestle.headY;
    this.pestle.angle = -Math.PI / 2;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.addEventListener('mousedown', this.onPointerDown);
    document.addEventListener('mousemove', this.onPointerMove);
    document.addEventListener('mouseup', this.onPointerUp);
    document.addEventListener('touchstart', this.onPointerDown, { passive: false });
    document.addEventListener('touchmove', this.onPointerMove, { passive: false });
    document.addEventListener('touchend', this.onPointerUp);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.onViewportChange);
      window.visualViewport.addEventListener('scroll', this.onViewportChange);
    }
  }

  /**
   * Check if point is near pestle (for grabbing)
   */
  isPointNearPestle(px, py) {
    const p = this.pestle;
    const x1 = p.pivotX;
    const y1 = p.pivotY;
    const x2 = p.headX;
    const y2 = p.headY;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const dist = Math.hypot(px - cx, py - cy);
    const grabDist = this.width <= 768 ? 25 : 40;
    return dist < grabDist;
  }

  /**
   * Get the mortar interior left and right wall x-positions at a given y.
   * Returns null if y is outside the mortar.
   */
  getMortarBoundsAtY(y) {
    const m = this.mortar;
    if (y < m.y || y > m.y + m.height) return null;

    const t = (y - m.y) / m.height; // 0 at top, 1 at bottom
    // Mortar widens from opening to bowl bottom, matching the drawn shape
    const leftFrac = 0.2 - 0.1 * t;
    const rightFrac = 0.8 + 0.1 * t;

    return {
      left: m.x + m.width * leftFrac,
      right: m.x + m.width * rightFrac,
    };
  }

  /**
   * Get the mortar opening (top edge) bounds
   */
  getMortarOpening() {
    const m = this.mortar;
    return {
      left: m.x + m.width * 0.2,
      right: m.x + m.width * 0.8,
      y: m.y,
    };
  }

  // ─── Event Handlers ───────────────────────────────────

  onPointerDown(e) {
    if (!this.isRunning) return;
    // Refresh cached rect on pointer down
    this._cachedCanvasRect = this.canvas.getBoundingClientRect();
    this._canvasRectAge = 0;
    const rect = this._cachedCanvasRect;
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;
    this.input.isDown = true;
    setScreenLocked(true);
    setBackgroundDragLocked(true);
  }

  onPointerMove(e) {
    if (!this.isRunning) return;
    // Cache canvas rect to avoid layout thrashing on every pointermove
    if (!this._cachedCanvasRect || this._canvasRectAge++ > 10) {
      this._cachedCanvasRect = this.canvas.getBoundingClientRect();
      this._canvasRectAge = 0;
    }
    const rect = this._cachedCanvasRect;
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;
    // Open sidebar when dragging near the tab
    if (this.input.isDown) {
      handleToolDragNearSidebar(client.clientX);
    }
  }

  onPointerUp(e) {
    if (!this.isRunning) return;

    // Only put tool away if released over the open sidebar content
    const client = e.changedTouches ? e.changedTouches[0] : e;
    if (shouldPutToolAway(client.clientX, client.clientY) && this.onPutAway) {
      cleanupToolDragSidebar();
      setScreenLocked(false);
      setBackgroundDragLocked(false);
      this.onPutAway();
      return;
    }
    cleanupToolDragSidebar();

    this.input.isDown = false;
    setScreenLocked(false);
    setBackgroundDragLocked(false);
  }

  // ─── Physics ──────────────────────────────────────────

  /**
   * Constrain pestle tip to mortar interior walls.
   * Returns the corrected position and contact info.
   */
  constrainToMortarInterior(tipX, tipY, radius) {
    const m = this.mortar;
    const mBottom = m.y + m.height - radius;
    let x = tipX;
    let y = tipY;
    let atBottom = false;
    let touchingWall = false;

    // Clamp to bottom
    if (y > mBottom) {
      y = mBottom;
      atBottom = true;
    }

    // Get wall bounds at this y
    const bounds = this.getMortarBoundsAtY(Math.min(Math.max(y, m.y), m.y + m.height));
    if (bounds) {
      const left = bounds.left + radius;
      const right = bounds.right - radius;
      if (x < left) {
        x = left;
        touchingWall = true;
      } else if (x > right) {
        x = right;
        touchingWall = true;
      }
    }

    return { x, y, atBottom, touchingWall };
  }

  /**
   * Keep the entire pestle shaft from penetrating the mortar.
   * Inside: shaft stays within inner walls and above bottom.
   * Outside: shaft is pushed out of the mortar solid.
   * Returns true if an adjustment was applied.
   */
  constrainPestleShaft() {
    const pestle = this.pestle;
    const m = this.mortar;
    const headRadius = pestle.width / 2;
    const handleRadius = pestle.handleThickness / 2;

    // Quick AABB rejection
    const minX = Math.min(pestle.pivotX, pestle.headX) - headRadius;
    const maxX = Math.max(pestle.pivotX, pestle.headX) + headRadius;
    const minY = Math.min(pestle.pivotY, pestle.headY) - headRadius;
    const maxY = Math.max(pestle.pivotY, pestle.headY) + headRadius;
    if (maxY < m.y || minY > m.y + m.height) return false;
    if (maxX < m.x || minX > m.x + m.width) return false;

    let shiftX = 0;
    let shiftY = 0;
    let collided = false;
    const samples = 6;

    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const sampleX = pestle.pivotX + (pestle.headX - pestle.pivotX) * t;
      const sampleY = pestle.pivotY + (pestle.headY - pestle.pivotY) * t;
      if (sampleY < m.y || sampleY > m.y + m.height) continue;

      const radius = handleRadius + (headRadius - handleRadius) * t;

      if (this.insideMortar) {
        // Inside: constrain to interior walls and bottom
        const bounds = this.getMortarBoundsAtY(sampleY);
        if (!bounds) continue;
        const left = bounds.left + radius;
        const right = bounds.right - radius;
        if (sampleX < left) {
          shiftX = Math.max(shiftX, left - sampleX);
          collided = true;
        } else if (sampleX > right) {
          shiftX = Math.min(shiftX, right - sampleX);
          collided = true;
        }
        const bottom = m.y + m.height - radius;
        if (sampleY > bottom) {
          shiftY = Math.min(shiftY, bottom - sampleY);
          collided = true;
        }
      } else {
        // Outside: push shaft out of mortar bounding box
        if (sampleX + radius > m.x && sampleX - radius < m.x + m.width &&
            sampleY + radius > m.y && sampleY - radius < m.y + m.height) {
          collided = true;
          const pushUp = (sampleY + radius) - m.y;
          const pushDown = (m.y + m.height) - (sampleY - radius);
          const pushLeft = (sampleX + radius) - m.x;
          const pushRight = (m.x + m.width) - (sampleX - radius);
          const minPush = Math.min(pushUp, pushDown, pushLeft, pushRight);
          if (minPush === pushUp) {
            shiftY = Math.min(shiftY, -pushUp);
          } else if (minPush === pushDown) {
            shiftY = Math.max(shiftY, pushDown);
          } else if (minPush === pushLeft) {
            shiftX = Math.min(shiftX, -pushLeft);
          } else {
            shiftX = Math.max(shiftX, pushRight);
          }
        }
      }
    }

    if (!collided) return false;

    pestle.headX += shiftX;
    pestle.headY += shiftY;
    pestle.pivotX += shiftX;
    pestle.pivotY += shiftY;

    // Re-constrain head after shifting
    if (this.insideMortar) {
      const corrected = this.constrainToMortarInterior(pestle.headX, pestle.headY, headRadius);
      pestle.headX = corrected.x;
      pestle.headY = corrected.y;
    }

    return true;
  }

  /**
   * Update pestle physics
   */
  updatePestle(dt) {
    const pestle = this.pestle;
    const m = this.mortar;
    const opening = this.getMortarOpening();
    const safeDt = Math.max(dt, 0.0001);
    const headRadius = pestle.width / 2;

    // ── Pivot (handle end) snaps directly to mouse ──
    pestle.pivotX = this.input.mouseX;
    pestle.pivotY = this.input.mouseY;

    // ── Head (grinding end) swings below pivot with gravity (Verlet) ──
    const g = this.insideMortar ? this.mortarGravity : this.gravity;
    const friction = this.airFriction;

    const x = pestle.headX;
    const y = pestle.headY;
    const prevX = pestle.prevHeadX;
    const prevY = pestle.prevHeadY;

    let vx = (x - prevX) / safeDt;
    let vy = (y - prevY) / safeDt;

    vx *= friction;
    vy *= friction;
    vy += g * safeDt;

    pestle.prevHeadX = x;
    pestle.prevHeadY = y;

    let newX = x + vx * safeDt;
    let newY = y + vy * safeDt;

    // ── Enforce constant length from pivot (adjust head) ──
    let dx = newX - pestle.pivotX;
    let dy = newY - pestle.pivotY;
    let dist = Math.hypot(dx, dy);
    if (dist > 0) {
      const scale = pestle.constantLength / dist;
      newX = pestle.pivotX + dx * scale;
      newY = pestle.pivotY + dy * scale;
    } else {
      newX = pestle.pivotX;
      newY = pestle.pivotY + pestle.constantLength;
    }

    // ── Mortar collision on the head ──
    // Simple collision: pestle head edges collide with mortar outer walls,
    // inner walls, and bottom. Nothing fancy.
    let collided = false;

    if (this.insideMortar) {
      // Allow exiting through the top opening
      if (newY < m.y - headRadius) {
        const openingLeft = opening.left + headRadius;
        const openingRight = opening.right - headRadius;
        if (newX >= openingLeft && newX <= openingRight) {
          this.insideMortar = false;
        } else {
          // Blocked by inner rim — push back inside
          newX = Math.max(openingLeft, Math.min(openingRight, newX));
          newY = Math.max(newY, m.y - headRadius);
          collided = true;
        }
      }

      // Constrain to inner walls and bottom
      if (this.insideMortar) {
        const result = this.constrainToMortarInterior(newX, newY, headRadius);
        if (result.x !== newX || result.y !== newY) {
          collided = true;
        }
        newX = result.x;
        newY = result.y;
      }
    } else {
      // Outside — check collision with outer mortar edges
      const headTop = newY - headRadius;
      const headBottom = newY + headRadius;
      const headLeft = newX - headRadius;
      const headRight = newX + headRadius;

      const hitsVertically = headBottom >= m.y && headTop <= m.y + m.height;
      const hitsHorizontally = headRight >= m.x && headLeft <= m.x + m.width;

      if (hitsVertically && hitsHorizontally) {
        // Check if entering through the top opening
        const openingLeft = opening.left + headRadius;
        const openingRight = opening.right - headRadius;
        const comingFromAbove = headTop <= m.y;

        if (comingFromAbove && newX >= openingLeft && newX <= openingRight) {
          // Enter the mortar
          this.insideMortar = true;
          const result = this.constrainToMortarInterior(newX, newY, headRadius);
          if (result.x !== newX || result.y !== newY) {
            collided = true;
          }
          newX = result.x;
          newY = result.y;
        } else {
          // Collide with outer mortar walls — push head out
          collided = true;
          // Find shortest push-out direction
          const pushUp = headBottom - m.y;
          const pushDown = (m.y + m.height) - headTop;
          const pushLeft = headRight - m.x;
          const pushRight = (m.x + m.width) - headLeft;
          const minPush = Math.min(pushUp, pushDown, pushLeft, pushRight);

          if (minPush === pushUp) {
            newY = m.y - headRadius;
          } else if (minPush === pushDown) {
            newY = m.y + m.height + headRadius;
          } else if (minPush === pushLeft) {
            newX = m.x - headRadius;
          } else {
            newX = m.x + m.width + headRadius;
          }
        }
      }
    }

    pestle.headX = newX;
    pestle.headY = newY;

    // Shaft collision — entire pestle length vs mortar edges
    if (this.constrainPestleShaft()) {
      collided = true;
    }

    if (collided) {
      // Re-enforce constant length from constrained head
      dx = pestle.pivotX - pestle.headX;
      dy = pestle.pivotY - pestle.headY;
      dist = Math.hypot(dx, dy);
      if (dist > 0) {
        const scale = pestle.constantLength / dist;
        pestle.pivotX = pestle.headX + dx * scale;
        pestle.pivotY = pestle.headY + dy * scale;
      }

      // Kill head velocity on collision
      pestle.prevHeadX = pestle.headX;
      pestle.prevHeadY = pestle.headY;
    }

    // Update angle
    pestle.angle = Math.atan2(
      pestle.headY - pestle.pivotY,
      pestle.headX - pestle.pivotX
    ) - Math.PI / 2;
  }

  consumeLetterForInk(reason = 'grind') {
    const pestle = this.pestle;
    if (pestle.attachedLetters.length <= 0) return false;

    const letter = pestle.attachedLetters.pop();
    this.spawnInkDrop(pestle.headX, pestle.headY);
    if (Math.random() < 0.6) playPestleGrind(); else playPestleSquelch();

    if (this.onInkProduced) {
      this.onInkProduced(letter, pestle.headX, pestle.headY);
    }

    console.log(`${reason} ink from letter:`, letter, '| remaining:', pestle.attachedLetters.length);
    return true;
  }

  /**
   * Check and produce ink when grinding the mortar bottom
   */
  updateGrinding(dt) {
    const pestle = this.pestle;
    const m = this.mortar;
    const gt = this.grindTracker;
    const pt = this.pressTracker;
    const headRadius = pestle.width / 2;

    gt.cooldown = Math.max(0, gt.cooldown - dt);

    // Only grind/press when held, inside mortar, and near the bottom
    const mBottom = m.y + m.height;
    const nearBottom = this.insideMortar && pestle.headY >= mBottom - headRadius - 6;

    if (!this.insideMortar) {
      gt.lastX = pestle.headX;
      gt.distance = 0;
      pt.holdTime = 0;
      pt.armed = false;
      return;
    }

    if (!nearBottom) {
      gt.lastX = pestle.headX;
      gt.distance = 0;
    } else {
      // Accumulate horizontal movement for existing grind behavior
      const moved = Math.abs(pestle.headX - gt.lastX);
      gt.distance += moved;
      gt.lastX = pestle.headX;

      // Build press charge while held against mortar bottom
      pt.holdTime += dt;
      if (pt.holdTime >= pt.holdThreshold) {
        pt.armed = true;
      }
    }

    // Existing grinding ink behavior
    if (nearBottom && gt.distance >= gt.threshold && gt.cooldown <= 0) {
      if (this.consumeLetterForInk('Ground')) {
        gt.distance = 0;
        gt.cooldown = 0.2;
        pt.holdTime = 0;
        pt.armed = false;
      }
      return;
    }

    // New mobile-friendly "smoosh" behavior:
    // hold against bottom briefly, then lift to release ink.
    const liftedAfterPress = pestle.headY <= mBottom - headRadius - pt.liftDistance;
    if (pt.armed && liftedAfterPress && gt.cooldown <= 0) {
      if (this.consumeLetterForInk('Pressed')) {
        gt.cooldown = 0.2;
      }
      pt.holdTime = 0;
      pt.armed = false;
    }
  }

  /**
   * Check for letter pickup collision (pestle tip picks up letters)
   */
  checkLetterPickup() {
    const letterPoolDiv = document.getElementById('letterPool');
    if (!letterPoolDiv) return;

    // Use children directly instead of querySelectorAll (faster, no selector matching)
    const children = letterPoolDiv.children;
    if (!children.length) return;

    // Cache canvas rect (only re-read if not set; resize handler updates it)
    if (!this._cachedCanvasRect || this._canvasRectAge++ > 12) {
      this._cachedCanvasRect = this.canvas.getBoundingClientRect();
      this._canvasRectAge = 0;
    }
    const canvasRect = this._cachedCanvasRect;
    const tipX = canvasRect.left + this.pestle.headX;
    const tipY = canvasRect.top + this.pestle.headY;

    for (let i = 0; i < children.length; i++) {
      const tile = children[i];
      if (!tile.classList || !tile.classList.contains('letter-tile')) continue;
      const tileRect = tile.getBoundingClientRect();
      const tileCenterX = tileRect.left + tileRect.width / 2;
      const tileCenterY = tileRect.top + tileRect.height / 2;
      const dist = Math.hypot(tipX - tileCenterX, tipY - tileCenterY);

      if (dist < 30) {
        const char = tile.dataset.letterChar || '';
        const count = parseInt(tile.dataset.count || '1', 10);

        this.pestle.attachedLetters.push(char);

        if (count > 1) {
          tile.dataset.count = String(count - 1);
          tile.innerHTML = '<span>' + char + '</span>';
          const badge = document.createElement('span');
          badge.className = 'letter-count';
          badge.textContent = 'x' + (count - 1);
          tile.appendChild(badge);
        } else {
          tile.remove();
        }

        return; // One per frame
      }
    }

    // Also pick up physics letters (thrown blocks on screen)
    if (window.letterPhysics) {
      const physLetter = window.letterPhysics.pickupNearest(tipX, tipY, 30);
      if (physLetter) {
        this.pestle.attachedLetters.push(physLetter.char);
        physLetter.consumed = true;
      }
    }
  }

  /**
   * Spawn ink drop visual effect
   */
  spawnInkDrop(x, y) {
    const isMobile = this.width <= 768;
    const MAX_INK_DROPS = isMobile ? 8 : 30;
    const base = isMobile ? 2 + Math.floor(Math.random() * 2) : 5 + Math.floor(Math.random() * 3);
    const burstCount = Math.min(base, MAX_INK_DROPS - this.inkDrops.length);
    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 80;
      this.inkDrops.push({
        x, y,
        vx: Math.cos(angle) * speed * 0.015,
        vy: Math.sin(angle) * speed * 0.015 - 0.4,
        life: 0.5 + Math.random() * 0.3,
        age: 0,
      });
    }
  }

  // ─── Update ───────────────────────────────────────────

  update(dt) {
    this.updatePestle(dt);

    // Letter pickup when not inside mortar
    if (!this.insideMortar && this.pestle.attachedLetters.length < 10) {
      this.checkLetterPickup();
    }

    // Grinding ink production
    this.updateGrinding(dt);

    // Update ink drops
    this.inkDrops = this.inkDrops.filter(d => d.age < d.life);
    for (const d of this.inkDrops) {
      d.age += dt;
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 15 * dt;
    }
  }

  // ─── Drawing ──────────────────────────────────────────

  /**
   * Draw the pestle using PNG image
   */
  drawPestle(ctx, pestle) {
    ctx.save();
    const pivotX = pestle.pivotX;
    const pivotY = pestle.pivotY;
    const dx = pestle.headX - pivotX;
    const dy = pestle.headY - pivotY;
    const angle = Math.atan2(dy, dx) - Math.PI / 2;
    const length = pestle.constantLength;

    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);

    // Draw pestle PNG image
    if (this._pestleImg && this._pestleImg.complete && this._pestleImg.naturalWidth > 0) {
      const imgAspect = this._pestleImg.naturalWidth / this._pestleImg.naturalHeight;
      const imgHeight = length;
      const imgWidth = imgHeight * imgAspect;
      // Knob (top of image) at y=0 (pivot), grinding end (bottom) extends toward head
      ctx.drawImage(this._pestleImg, -imgWidth / 2, 0, imgWidth, imgHeight);
    }

    // Draw attached letters on pestle head
    if (pestle.attachedLetters.length > 0) {
      const handleLength = length * 0.7;
      const headHeight = length * 0.3;
      ctx.translate(0, handleLength);

      const letterCount = pestle.attachedLetters.length;
      const displayCount = Math.min(3, letterCount);

      // Tile styling constants to match letter tiles
      const tileWidth = 18;
      const tileHeight = 20;
      const tileRadius = 4;
      const tileOverlap = 8; // Tiles overlap by 8px

      for (let i = 0; i < displayCount; i++) {
        const offsetY = headHeight / 2 + tileHeight + i * (tileHeight - tileOverlap);
        const char = pestle.attachedLetters[pestle.attachedLetters.length - 1 - i];

        // Draw tile background (dark gradient approximation)
        this._drawRoundRect(ctx, -tileWidth / 2, offsetY - tileHeight / 2, tileWidth, tileHeight, tileRadius);

        // Fill with dark background
        const gradient = ctx.createLinearGradient(-tileWidth / 2, offsetY - tileHeight / 2,
                                                  tileWidth / 2, offsetY + tileHeight / 2);
        gradient.addColorStop(0, '#0f0f10');
        gradient.addColorStop(1, '#1b1b1d');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw gold border
        ctx.strokeStyle = '#d1a640';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw letter in gold color
        ctx.fillStyle = '#f3d27a';
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, 0, offsetY);
      }

      if (letterCount > 3) {
        const indicatorY = headHeight / 2 + tileHeight + displayCount * (tileHeight - tileOverlap);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`+${letterCount - 3}`, 0, indicatorY);
      }
    }

    ctx.restore();
  }

  /**
   * Helper function to draw a rounded rectangle path
   */
  _drawRoundRect(ctx, x, y, w, h, r) {
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

  /**
   * Draw the mortar bowl using PNG image (back layer, behind the pestle)
   */
  drawMortarBack(ctx, mortar) {
    ctx.save();

    // Draw mortar PNG image
    if (this._mortarImg && this._mortarImg.complete && this._mortarImg.naturalWidth > 0) {
      const imgAspect = this._mortarImg.naturalWidth / this._mortarImg.naturalHeight;
      const imgWidth = mortar.width * 1.15;
      const imgHeight = imgWidth / imgAspect;
      const imgX = mortar.x + mortar.width / 2 - imgWidth / 2;
      // Align bottom of image with bottom of mortar
      const imgY = mortar.y + mortar.height - imgHeight;
      ctx.drawImage(this._mortarImg, imgX, imgY, imgWidth, imgHeight);
    }

    ctx.restore();
  }

  /**
   * Draw the mortar front walls using PNG image (over the pestle, for depth illusion)
   */
  drawMortarFront(ctx, mortar) {
    if (!this._mortarImg || !this._mortarImg.complete || !this._mortarImg.naturalWidth) return;

    ctx.save();
    const imgAspect = this._mortarImg.naturalWidth / this._mortarImg.naturalHeight;
    const imgWidth = mortar.width * 1.15;
    const imgHeight = imgWidth / imgAspect;
    const imgX = mortar.x + mortar.width / 2 - imgWidth / 2;
    const imgY = mortar.y + mortar.height - imgHeight;

    // Clip to only show the left and right wall regions (front edges)
    ctx.beginPath();
    ctx.rect(imgX, imgY, imgWidth * 0.23, imgHeight);
    ctx.rect(imgX + imgWidth * 0.77, imgY, imgWidth * 0.23, imgHeight);
    ctx.clip();

    // Redraw the mortar image clipped to the wall edges
    ctx.drawImage(this._mortarImg, imgX, imgY, imgWidth, imgHeight);

    ctx.restore();
  }

  /**
   * Draw ink drops
   */
  drawInkDrops(ctx, inkDrops) {
    ctx.save();
    const isMobile = this.width <= 768;
    for (const d of inkDrops) {
      const t = d.age / d.life;
      const alpha = Math.max(0, 1 - t);
      const size = 2 + (1 - t) * 1.5;
      ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
      if (isMobile) {
        // Use cheaper fillRect on mobile instead of arc
        ctx.fillRect(d.x - size, d.y - size, size * 2, size * 2);
      } else {
        ctx.beginPath();
        ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ─── Render ───────────────────────────────────────────

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Layer order: mortar back → pestle → mortar front rim → ink drops
    this.drawMortarBack(this.ctx, this.mortar);
    this.drawPestle(this.ctx, this.pestle);
    this.drawMortarFront(this.ctx, this.mortar);
    this.drawInkDrops(this.ctx, this.inkDrops);

    if (this.overlayRenderer) {
      this.overlayRenderer();
    }
  }

  // ─── Lifecycle ────────────────────────────────────────

  loop(timestamp) {
    if (!this.isRunning) return;
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min(0.04, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    if (this.isRunning) {
      requestAnimationFrame(this.loop);
    }
  }

  setOverlayRenderer(renderer) {
    this.overlayRenderer = renderer;
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = 0;
      requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.isRunning = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.stop();
    document.removeEventListener('mousedown', this.onPointerDown);
    document.removeEventListener('mousemove', this.onPointerMove);
    document.removeEventListener('mouseup', this.onPointerUp);
    document.removeEventListener('touchstart', this.onPointerDown);
    document.removeEventListener('touchmove', this.onPointerMove);
    document.removeEventListener('touchend', this.onPointerUp);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.onViewportChange);
      window.visualViewport.removeEventListener('scroll', this.onViewportChange);
    }
  }
}
