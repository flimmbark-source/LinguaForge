/**
 * LINGUA FORGE - SHOVEL SYSTEM
 * Simple shovel tool for scooping letters from the letter basket and dumping into the hearth
 */

import { canPlaceInHearth, getHearthBounds, heatHearth, spawnHearthSpark } from './RuneHearth.js?v=9';
import { createLetterTile, consumeLetterTile } from './letters.js?v=9';
import { spawnResourceGain } from './resourceGainFeedback.js?v=9';
import { gameState } from './state.js?v=9';
import { playShovelScoop, playShovelDump } from './audio.js?v=9';
import { handleToolDragNearSidebar, shouldPutToolAway, cleanupToolDragSidebar } from './toolSidebarHelpers.js?v=9';

const MOBILE_BREAKPOINT = 900;
function setScreenLocked(locked) {
  if (window.innerWidth > MOBILE_BREAKPOINT) return;
  if (!document.body) return;
  document.body.classList.toggle('screen-locked', locked);
}

function getLetterFromTile(tile) {
  if (!tile) return '';

  // Try common dataset keys
  const ds = tile.dataset || {};
  const byData =
    ds.letterChar ||
    ds.letter ||
    ds.char ||
    ds.symbol ||
    '';

  if (byData) return byData;

  // Fallback: use visible text (first non-whitespace char)
  const text = tile.textContent || '';
  const trimmed = text.trim();
  if (trimmed.length > 0) {
    return trimmed[0];
  }

  return '';
}

export class ShovelSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.collected = []; // array of letter chars
    this.hasCenteredOnStart = false;
    this.overlayRenderer = null; // Optional renderer (e.g., word chips) drawn after the tool

    // world physics constants (mirroring hammer semantics)
    this.gravity = 2600;      // px/s^2 (optional if you want sag)
    this.airFriction = 0.7;   // 0–1, lower = more drag

    // basic shovel state
    this.shovel = {
      pivotX: 100,
      pivotY: 100,
      headX: 100,
      headY: 220,
      length: 120,
      angle: Math.PI / 2, // resting pointing LEFT
      isHeld: false,
      headMass: 1.0
    };

    // input
    this.input = { mouseX: 0, mouseY: 0, isDown: false };

    this.lastTime = 0;
    this.isRunning = false;

    // internal
    this.prevHeadX = this.shovel.headX;
    this.prevHeadY = this.shovel.headY;
    this._angleVel = 0;
    this._headVelX = 0;
    this._headVelY = 0;

    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.loop = this.loop.bind(this);
    this.resize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.resize();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.addEventListener('mousedown', this.onPointerDown);
    document.addEventListener('mousemove', this.onPointerMove);
    document.addEventListener('mouseup', this.onPointerUp);
    document.addEventListener('touchstart', this.onPointerDown, { passive: false });
    document.addEventListener('touchmove', this.onPointerMove, { passive: false });
    document.addEventListener('touchend', this.onPointerUp);
    window.addEventListener('resize', this.resize);
  }

resize() {
  const rect = this.canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  this.canvas.width = rect.width * dpr;
  this.canvas.height = rect.height * dpr;
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.width = rect.width;
  this.height = rect.height;

  const s = this.shovel;

  // Try to align the shovel vertically relative to the letter pool,
  // so it works on both mobile and desktop.
  const letterPool = document.getElementById('letterPool');
  if (letterPool) {
    const poolRect = letterPool.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();

    // pool's top, in canvas coordinates
    const poolTopInCanvas = poolRect.top - canvasRect.top;

    s.pivotX = this.width * 0.18;
    // put the shovel so the head naturally passes through the pool area
    s.pivotY = poolTopInCanvas - 140; // tweak 140 as needed
  } else {
    // fallback if pool not found
    s.pivotX = this.width * 0.18;
    s.pivotY = this.height - 180;
  }

  s.length = 120;
  s.angle = Math.PI / 2;
  s.headX = s.pivotX - Math.sin(s.angle) * s.length;
  s.headY = s.pivotY + Math.cos(s.angle) * s.length;
  this.prevHeadX = s.headX;
  this.prevHeadY = s.headY;
}

  onPointerDown(e) {
    if (!this.isRunning) return;
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;

    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;

    const s = this.shovel;

    // Transform pointer into shovel local coordinates
    const dx = this.input.mouseX - s.pivotX;
    const dy = this.input.mouseY - s.pivotY;
    const angle = -s.angle;
    const localX = Math.cos(angle) * dx - Math.sin(angle) * dy;
    const localY = Math.sin(angle) * dx + Math.cos(angle) * dy;

    // Dimensions that mirror drawShovel
    const handleW = 10;
    const handleL = s.length;
    const headW = 48;
    const headH = 148;

    // Padding for grab area — tighter on mobile
    const PAD = this.width <= MOBILE_BREAKPOINT ? 14 : 26;

    const withinHandle =
      localX > -handleW / 2 - PAD &&
      localX < handleW / 2 + PAD &&
      localY > -PAD &&
      localY < handleL + PAD;

    const withinHead =
      localX > -headW / 2 - PAD &&
      localX < headW / 2 + PAD &&
      localY > handleL - PAD &&
      localY < handleL + headH + PAD;

    const clickedCanvas = e.target === this.canvas;

    if (withinHandle || withinHead || clickedCanvas) {
      this.input.isDown = true;
      this.shovel.isHeld = true;
      if (e.cancelable) e.preventDefault();
      setScreenLocked(true);
    }
    // Else: ignore clicks not on shovel
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
    this.input.isDown = false;

    // Only put tool away if released over the open sidebar content
    const client = e.changedTouches ? e.changedTouches[0] : e;
    if (shouldPutToolAway(client.clientX, client.clientY) && this.onPutAway) {
      // Return any collected letters before putting away
      const pool = document.getElementById('letterPool');
      if (pool) {
        for (const ch of this.collected) {
          const tile = createLetterTile(ch, null);
          pool.appendChild(tile);
        }
      }
      this.collected = [];
      this.shovel.isHeld = false;
      cleanupToolDragSidebar();
      setScreenLocked(false);
      this.onPutAway();
      return;
    }
    cleanupToolDragSidebar();
    setScreenLocked(false);

    // on release, drop collected letters into hearth if over hearth, else return to basket
    const { bounds: headBounds } = this.computeHeadGeometry();

    const hearthRect = getHearthBounds();
    const hearthEnabled = canPlaceInHearth();

    const overlapsHearth =
      hearthRect &&
      headBounds.right >= hearthRect.left &&
      headBounds.left <= hearthRect.right &&
      headBounds.bottom >= hearthRect.top &&
      headBounds.top <= hearthRect.bottom;

    if (hearthEnabled && overlapsHearth) {
      // dump into hearth
      if (this.collected.length > 0) {
        playShovelDump();
        heatHearth(this.collected.length);
        spawnHearthSpark(
          hearthRect.left + hearthRect.width / 2,
          hearthRect.top + hearthRect.height / 2,
          Math.min(12, this.collected.length * 3)
        );
        // spawn resource feedback
        spawnResourceGain(
          hearthRect.left + hearthRect.width / 2,
          hearthRect.top + hearthRect.height / 2,
          this.collected.length,
          'renown'
        );
      }
      this.collected = [];
    } else {
      // return letters to basket DOM
      const pool = document.getElementById('letterPool');
      if (pool) {
        for (const ch of this.collected) {
          const tile = createLetterTile(ch, null);
          pool.appendChild(tile);
        }
      }
      this.collected = [];
    }

    this.shovel.isHeld = false;
  }

  start() {
    if (!this.isRunning) {
      if (!this.hasCenteredOnStart) {
        this.hasCenteredOnStart = true;
        const s = this.shovel;
        const headCenterOffset = s.length + 148 / 2 - 6;
        s.pivotX = this.width / 2 + Math.sin(s.angle) * headCenterOffset;
        s.pivotY = this.height / 2 - Math.cos(s.angle) * headCenterOffset;
        s.headX = s.pivotX - Math.sin(s.angle) * s.length;
        s.headY = s.pivotY + Math.cos(s.angle) * s.length;
        this.prevHeadX = s.headX;
        this.prevHeadY = s.headY;
      }
      this.isRunning = true;
      this.lastTime = 0;
      // Keep the canvas non-interactive so it doesn't block UI buttons; we listen on document instead
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.cursor = 'grab';
      requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.isRunning = false;
    this.input.isDown = false;
    this.shovel.isHeld = false;
    this.collected = []; // clear shovel on tool switch
    this.canvas.style.pointerEvents = 'none';
    // Clear the canvas so the shovel doesn't remain visible when put away
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Set a renderer to draw after the shovel (e.g., word chips)
  setOverlayRenderer(renderer) {
    this.overlayRenderer = renderer;
  }

  loop(timestamp) {
    if (!this.isRunning) return; // Don't render after stop()
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min(0.04, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    if (this.isRunning) requestAnimationFrame(this.loop);
  }

  // simple helper to check proximity to letter tiles and pick them up
  computeHeadGeometry() {

    const headWidth = 48;
    const headHeight = 148;
    const halfHeadW = headWidth / 2;
    const halfHeadH = headHeight / 2;
    const canvasRect = this.canvas.getBoundingClientRect();
    const cosA = Math.cos(this.shovel.angle);
    const sinA = Math.sin(this.shovel.angle);

    // Anchor the pickup box at the visual center of the shovel head instead of
    // pivoting around an arbitrary point. The ellipse in drawShovel is centered
    // at y = headH / 2 - 6 relative to the top of the head, so add that offset
    // to the handle length to find the world position of the head center.
    const headCenterOffset = this.shovel.length + halfHeadH - 6;
    const centerX = canvasRect.left + this.shovel.pivotX - sinA * headCenterOffset;
    const centerY = canvasRect.top + this.shovel.pivotY + cosA * headCenterOffset;

    return {
      centerX,
      centerY,
      bounds: {
        left: centerX - halfHeadW,
        right: centerX + halfHeadW,
        top: centerY - halfHeadH,
        bottom: centerY + halfHeadH,
      },
    };
      }

  tryPickupLetterIfPassing() {
    // prevent overfilling the shovel
    if (this.collected.length >= 5) return;

    const letterPool = document.getElementById('letterPool');
    if (!letterPool) return;

    const { bounds: headBounds } = this.computeHeadGeometry();

    // Use simple class check instead of expensive compound selector
    const children = letterPool.children;
    for (let i = 0; i < children.length; i++) {
      const tile = children[i];
      if (!tile.classList || !tile.classList.contains('letter-tile')) continue;
      const r = tile.getBoundingClientRect();
      const overlapsHead =
        r.left <= headBounds.right &&
        r.right >= headBounds.left &&
        r.top <= headBounds.bottom &&
        r.bottom >= headBounds.top;

      if (overlapsHead) {
        const ch = getLetterFromTile(tile);
        if (!ch) continue;

        consumeLetterTile(tile);
        this.collected.push(ch);
        playShovelScoop();
        return;
      }
    }

    // Also pick up physics letters (thrown blocks on screen)
    if (window.letterPhysics && this.collected.length < 5) {
      const physLetters = window.letterPhysics.pickupInRect(
        headBounds.left, headBounds.top, headBounds.right, headBounds.bottom
      );
      for (const pl of physLetters) {
        if (this.collected.length >= 5) break;
        this.collected.push(pl.char);
        pl.consumed = true;
      }
    }
  }

  update(dt) {
    const s = this.shovel;
    const friction = this.airFriction; // mirror hammer airFriction

    const REST_ANGLE = Math.PI / 2; // shovel points LEFT when at rest

    // --- ANGLE / SWING LOGIC ---------------------------------
    if (this.input.isDown && s.isHeld) {
      // Compute desired angle from pivot → mouse
      const dx = this.input.mouseX - s.pivotX;
      const dy = this.input.mouseY - s.pivotY;

      // Move the shovel with the mouse
      s.pivotX = this.input.mouseX;
      s.pivotY = this.input.mouseY;

      // We want the handle (local +Y) to point at the mouse, so:
      let desiredAngle = Math.atan2(dy, dx) + Math.PI / 2;

      // Optional: clamp how far from rest we can swing (±45° here)
      const MAX_DELTA = Math.PI / 4;
      const MIN_ANGLE = REST_ANGLE - MAX_DELTA;
      const MAX_ANGLE = REST_ANGLE + MAX_DELTA;
      if (desiredAngle < MIN_ANGLE) desiredAngle = MIN_ANGLE;
      if (desiredAngle > MAX_ANGLE) desiredAngle = MAX_ANGLE;

      const stiffness = 18;      // how strongly we chase the mouse
      this._angleVel += (desiredAngle - s.angle) * stiffness * dt;
    } else {
      // When not held, let "gravity" pull back to REST_ANGLE
      const gravityStrength = 10;
      this._angleVel += (REST_ANGLE - s.angle) * gravityStrength * dt;
    }

    // Angular damping (friction in rotation)
    this._angleVel *= friction;
    s.angle += this._angleVel * dt;

    // --- HEAD POSITION / PICKUP LOGIC ------------------------
    const targetHeadX = s.pivotX - Math.sin(s.angle) * s.length;
    const targetHeadY = s.pivotY + Math.cos(s.angle) * s.length;

    const massFactor = Math.max(2, s.headMass || 2);
    const followFactor = 1 / Math.sqrt(massFactor);

    const prevX = this.prevHeadX;
    const prevY = this.prevHeadY;

    // spring-like follow
    this._headVelX += (targetHeadX - s.headX) * 10 * dt * followFactor;
    this._headVelY += (targetHeadY - s.headY) * 10 * dt * followFactor;

    // Optional: vertical gravity to make the head sag a bit
    // this._headVelY += this.gravity * dt * (s.headMass || 1);

    // linear damping (air friction on head motion)
    this._headVelX *= friction;
    this._headVelY *= friction;

    s.headX += this._headVelX * dt;
    s.headY += this._headVelY * dt;

    const vx = (s.headX - prevX) / Math.max(dt, 1e-6);
    const vy = (s.headY - prevY) / Math.max(dt, 1e-6);
    const speed = Math.hypot(vx, vy);

    // try to pick up letters when moving quickly
    if (s.isHeld) {
      this.tryPickupLetterIfPassing();
    }

    this.prevHeadX = s.headX;
    this.prevHeadY = s.headY;
  }

  drawShovel(ctx) {
    const s = this.shovel;
    ctx.save();
    ctx.translate(s.pivotX, s.pivotY);
    ctx.rotate(s.angle);

    // handle
    const handleW = 10;
    const handleL = s.length;
    const grad = ctx.createLinearGradient(0, 0, 0, handleL);
    grad.addColorStop(0, '#75533fff');
    grad.addColorStop(1, '#0b0b0b');
    ctx.fillStyle = grad;
    ctx.fillRect(-handleW / 2, 0, handleW, handleL);

    // shovel head (ash shovel look) - black metal scoop
    ctx.translate(0, handleL);
    const headW = 48;
    const headH = 148;
    ctx.fillStyle = '#131416ff';
    ctx.beginPath();
    ctx.ellipse(0, headH / 2 - 6, headW / 2, headH / 2, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 52, 52, 0.76)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // draw collected letters on head
    if (this.collected.length > 0) {
      const startX = -(this.collected.length - 1) * 10 / 2;
      for (let i = 0; i < this.collected.length; i++) {
        const ch = this.collected[i];
        ctx.save();
        ctx.translate(startX + i * 10, headH / 2 - 6 - 4);
        // small tile
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.fillStyle = '#ecfdf5';
        ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawShovel(this.ctx);

    // Draw overlay content like word chips after the tool
    if (this.overlayRenderer) {
      this.overlayRenderer();
    }
  }
}
