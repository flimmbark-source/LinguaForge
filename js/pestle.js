/**
 * LINGUA FORGE - PESTLE & MORTAR SYSTEM
 * Physics-based pestle grinding mechanic for ink production.
 * The player holds the pestle and physically moves it into the mortar
 * through the top opening, then grinds against the bottom to produce ink.
 */

import { playPestleGrind, playPestleSquelch } from './audio.js?v=9';
import { handleToolDragNearSidebar, shouldPutToolAway, cleanupToolDragSidebar } from './toolSidebarHelpers.js?v=9';

export class PestleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Callbacks set by app
    this.onInkProduced = null;
    this.onPutAway = null;
    this.overlayRenderer = null;

    // World physics constants
    this.gravity = 2600;
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
    if (hearthEl) {
      const hearthRect = hearthEl.getBoundingClientRect();
      mortarBottom = hearthRect.top - canvasRect.top - 4;
    } else {
      const letterPoolBarHeight = isMobile ? 110 : 160;
      mortarBottom = this.height - letterPoolBarHeight;
    }

    this.mortar.width = Math.min(isMobile ? 160 : 200, this.width * 0.3);
    this.mortar.height = isMobile ? 60 : 80;
    this.mortar.x = this.width * 0.5 - this.mortar.width / 2;
    this.mortar.y = mortarBottom - this.mortar.height;

    // Position pestle above mortar
    const pivotX = this.width * 0.5;
    const pivotY = this.mortar.y - (isMobile ? 70 : 100);
    this.pestle.pivotX = pivotX;
    this.pestle.pivotY = pivotY;
    this.pestle.headX = pivotX;
    this.pestle.headY = pivotY + this.pestle.constantLength;
    this.pestle.prevHeadX = this.pestle.headX;
    this.pestle.prevHeadY = this.pestle.headY;
    this.pestle.angle = -Math.PI / 2;

    this.insideMortar = false;
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
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;
    this.input.isDown = true;
  }

  onPointerMove(e) {
    if (!this.isRunning) return;
    const rect = this.canvas.getBoundingClientRect();
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
      this.onPutAway();
      return;
    }
    cleanupToolDragSidebar();

    this.input.isDown = false;
  }

  // ─── Physics ──────────────────────────────────────────

  /**
   * Constrain pestle tip to mortar interior walls.
   * Returns the corrected position and contact info.
   */
  constrainToMortarInterior(tipX, tipY) {
    const m = this.mortar;
    const mBottom = m.y + m.height;
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
    const bounds = this.getMortarBoundsAtY(y);
    if (bounds) {
      if (x < bounds.left) {
        x = bounds.left;
        touchingWall = true;
      } else if (x > bounds.right) {
        x = bounds.right;
        touchingWall = true;
      }
    }

    return { x, y, atBottom, touchingWall };
  }

  /**
   * Update pestle physics
   */
  updatePestle(dt) {
    const pestle = this.pestle;
    const m = this.mortar;
    const opening = this.getMortarOpening();
    const safeDt = Math.max(dt, 0.0001);

    // ── Pivot (handle end) snaps directly to mouse ──
    pestle.pivotX = this.input.mouseX;
    pestle.pivotY = this.input.mouseY;

    // ── Head (grinding end) swings below pivot with gravity (Verlet) ──
    const g = this.gravity;
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
    // When the grinding end hits the mortar, the head is pinned at the
    // collision surface and the pivot is adjusted instead — this blocks
    // mouse movement into the wall while allowing all other directions.
    // The head can only exit the mortar through the top opening.
    let collided = false;

    if (this.insideMortar) {
      if (newY < m.y) {
        // Head is being pulled above the mortar top
        if (newX >= opening.left && newX <= opening.right) {
          // Exiting through the top opening — allow it
          this.insideMortar = false;
        } else {
          // Being pulled through the wall by length constraint — block it
          collided = true;
          newY = m.y + 1;
          const bounds = this.getMortarBoundsAtY(newY);
          if (bounds) {
            newX = Math.max(bounds.left, Math.min(bounds.right, newX));
          }
        }
      } else {
        // Inside mortar, constrain to walls and bottom
        const result = this.constrainToMortarInterior(newX, newY);
        if (result.x !== newX || result.y !== newY) {
          collided = true;
          newX = result.x;
          newY = result.y;
        }
      }
    } else {
      const nearMortarX = newX >= m.x && newX <= m.x + m.width;
      if (newY >= m.y && nearMortarX) {
        if (newX >= opening.left && newX <= opening.right) {
          // Entering through the top opening — allowed
          this.insideMortar = true;
          const result = this.constrainToMortarInterior(newX, newY);
          if (result.x !== newX || result.y !== newY) {
            collided = true;
            newX = result.x;
            newY = result.y;
          }
        } else {
          // Hitting mortar rim/wall from outside — block
          collided = true;
          newY = m.y - 1;
        }
      }
    }

    pestle.headX = newX;
    pestle.headY = newY;

    if (collided) {
      // Adjust pivot to maintain constant length from the constrained
      // head. The pivot moves toward the mouse but stays at a fixed
      // distance from the head. This blocks mouse movement into the
      // wall while still allowing movement in other directions.
      dx = pestle.pivotX - newX;
      dy = pestle.pivotY - newY;
      dist = Math.hypot(dx, dy);
      if (dist > 0) {
        const scale = pestle.constantLength / dist;
        pestle.pivotX = newX + dx * scale;
        pestle.pivotY = newY + dy * scale;
      }

      // Kill head velocity on collision to prevent bouncing
      pestle.prevHeadX = newX;
      pestle.prevHeadY = newY;
    }

    // Update angle
    pestle.angle = Math.atan2(
      pestle.headY - pestle.pivotY,
      pestle.headX - pestle.pivotX
    ) - Math.PI / 2;
  }

  /**
   * Check and produce ink when grinding the mortar bottom
   */
  updateGrinding(dt) {
    const pestle = this.pestle;
    const m = this.mortar;
    const gt = this.grindTracker;

    gt.cooldown = Math.max(0, gt.cooldown - dt);

    // Only grind when held, inside mortar, and near the bottom
    const mBottom = m.y + m.height;
    const nearBottom = pestle.headY >= mBottom - 6;

    if (!this.insideMortar || !nearBottom) {
      gt.lastX = pestle.headX;
      gt.distance = 0;
      return;
    }

    // Accumulate horizontal movement
    const moved = Math.abs(pestle.headX - gt.lastX);
    gt.distance += moved;
    gt.lastX = pestle.headX;

    // Produce ink when enough grinding has occurred
    if (gt.distance >= gt.threshold && gt.cooldown <= 0 && pestle.attachedLetters.length > 0) {
      gt.distance = 0;
      gt.cooldown = 0.2;

      const letter = pestle.attachedLetters.pop();
      this.spawnInkDrop(pestle.headX, pestle.headY);
      if (Math.random() < 0.6) playPestleGrind(); else playPestleSquelch();

      if (this.onInkProduced) {
        this.onInkProduced(letter, pestle.headX, pestle.headY);
      }

      console.log('Ground ink from letter:', letter, '| remaining:', pestle.attachedLetters.length);
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
    const MAX_INK_DROPS = isMobile ? 15 : 30;
    const base = isMobile ? 3 + Math.floor(Math.random() * 2) : 5 + Math.floor(Math.random() * 3);
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
   * Draw the pestle at its current position
   */
  drawPestle(ctx, pestle) {
    ctx.save();
    const pivotX = pestle.pivotX;
    const pivotY = pestle.pivotY;
    const dx = pestle.headX - pivotX;
    const dy = pestle.headY - pivotY;
    // Rotate so +y axis points from pivot toward head (grinding end)
    const angle = Math.atan2(dy, dx) - Math.PI / 2;
    const length = pestle.constantLength;

    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);

    // Handle (near pivot / mouse - player holds this end)
    const handleWidth = pestle.handleThickness;
    const handleLength = length * 0.7;
    const handleGradient = ctx.createLinearGradient(0, 0, 0, handleLength);
    handleGradient.addColorStop(0, '#fbbf24');
    handleGradient.addColorStop(1, '#92400e');
    ctx.fillStyle = handleGradient;
    ctx.fillRect(-handleWidth / 2, 0, handleWidth, handleLength);

    // Pestle head (far end - the grinding end, toward physics head)
    const headWidth = pestle.width;
    const headHeight = length * 0.3;
    ctx.translate(0, handleLength);

    const headGradient = ctx.createLinearGradient(-headWidth / 2, 0, headWidth / 2, headHeight);
    headGradient.addColorStop(0, '#d1d5db');
    headGradient.addColorStop(1, '#6b7280');
    ctx.fillStyle = headGradient;

    ctx.beginPath();
    ctx.roundRect(-headWidth / 2, 0, headWidth, headHeight, 8);
    ctx.fill();

    // Draw attached letters on pestle head
    if (pestle.attachedLetters.length > 0) {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const letterCount = pestle.attachedLetters.length;
      const displayCount = Math.min(3, letterCount);

      for (let i = 0; i < displayCount; i++) {
        const offsetY = headHeight / 2 + i * 8;
        ctx.fillText(pestle.attachedLetters[pestle.attachedLetters.length - 1 - i], 0, offsetY);
      }

      if (letterCount > 3) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px system-ui';
        ctx.fillText(`+${letterCount - 3}`, 0, headHeight + 10);
      }
    }

    ctx.restore();
  }

  /**
   * Draw the mortar bowl (back layer, behind the pestle)
   */
  drawMortarBack(ctx, mortar) {
    ctx.save();
    ctx.translate(mortar.x + mortar.width / 2, mortar.y + mortar.height);

    // Glow effect
    const glowGradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 100);
    glowGradient.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
    glowGradient.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.ellipse(0, 4, mortar.width * 0.6, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(-mortar.width / 2, -mortar.height);

    // Mortar bowl gradient
    const g = ctx.createLinearGradient(0, 0, 0, mortar.height);
    g.addColorStop(0, '#9ca3af');
    g.addColorStop(0.5, '#6b7280');
    g.addColorStop(1, '#374151');
    ctx.fillStyle = g;

    // Draw mortar bowl shape
    ctx.beginPath();
    ctx.moveTo(mortar.width * 0.2, 0);
    ctx.quadraticCurveTo(0, mortar.height * 0.3, mortar.width * 0.1, mortar.height);
    ctx.lineTo(mortar.width * 0.9, mortar.height);
    ctx.quadraticCurveTo(mortar.width, mortar.height * 0.3, mortar.width * 0.8, 0);
    ctx.closePath();
    ctx.fill();

    // Inner shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(mortar.width / 2, mortar.height * 0.4, mortar.width * 0.3, mortar.height * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw the mortar front rim (over the pestle, to create depth illusion)
   */
  drawMortarFront(ctx, mortar) {
    ctx.save();
    ctx.translate(mortar.x + mortar.width / 2, mortar.y + mortar.height);
    ctx.translate(-mortar.width / 2, -mortar.height);

    // Front rim highlight
    ctx.strokeStyle = 'rgba(248,250,252,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mortar.width * 0.2, 5);
    ctx.lineTo(mortar.width * 0.8, 5);
    ctx.stroke();

    // Front edge of the left and right walls (thicker, to overlap the pestle)
    const wallGradient = ctx.createLinearGradient(0, 0, 0, mortar.height * 0.5);
    wallGradient.addColorStop(0, '#9ca3af');
    wallGradient.addColorStop(1, 'rgba(107, 114, 128, 0)');

    ctx.fillStyle = wallGradient;

    // Left wall front edge
    ctx.beginPath();
    ctx.moveTo(mortar.width * 0.2, 0);
    ctx.quadraticCurveTo(mortar.width * 0.05, mortar.height * 0.3, mortar.width * 0.1, mortar.height * 0.6);
    ctx.lineTo(mortar.width * 0.15, mortar.height * 0.6);
    ctx.quadraticCurveTo(mortar.width * 0.1, mortar.height * 0.3, mortar.width * 0.25, 0);
    ctx.closePath();
    ctx.fill();

    // Right wall front edge
    ctx.beginPath();
    ctx.moveTo(mortar.width * 0.8, 0);
    ctx.quadraticCurveTo(mortar.width * 0.95, mortar.height * 0.3, mortar.width * 0.9, mortar.height * 0.6);
    ctx.lineTo(mortar.width * 0.85, mortar.height * 0.6);
    ctx.quadraticCurveTo(mortar.width * 0.9, mortar.height * 0.3, mortar.width * 0.75, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw ink drops
   */
  drawInkDrops(ctx, inkDrops) {
    ctx.save();
    for (const d of inkDrops) {
      const t = d.age / d.life;
      const alpha = Math.max(0, 1 - t);
      const size = 2 + (1 - t) * 1.5;
      ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, size, 0, Math.PI * 2);
      ctx.fill();
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
  }
}
