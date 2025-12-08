/**
 * LINGUA FORGE - SHOVEL SYSTEM
 * Simple shovel tool for scooping letters from the letter basket and dumping into the hearth
 */

import { getHearthBounds, heatHearth } from './hearth.js';
import { createLetterTile, consumeLetterTile } from './letters.js';
import { spawnResourceGain } from './resourceGainFeedback.js';
import { gameState } from './state.js';

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

    // position shovel near the anvil/letter basket area
    this.shovel.pivotX = this.width * 0.18;
    this.shovel.pivotY = this.height - 180;
    this.shovel.length = 120;
    this.shovel.angle = Math.PI / 2; // rest LEFT
    this.shovel.headX = this.shovel.pivotX;
    this.shovel.headY = this.shovel.pivotY + this.shovel.length;
    this.prevHeadX = this.shovel.headX;
    this.prevHeadY = this.shovel.headY;
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

    const handleW = 10, handleL = s.length;
    const headW = 48, headH = 28;

    const onHandle =
      localX > -handleW / 2 &&
      localX < handleW / 2 &&
      localY > 0 &&
      localY < handleL;

    const onHead =
      localY > handleL &&
      localX > -headW / 2 &&
      localX < headW / 2 &&
      localY < handleL + headH;

    if (onHandle || onHead) {
      this.input.isDown = true;
      this.shovel.isHeld = true;
      if (e.cancelable) e.preventDefault();
    }
    // Else: ignore clicks not on shovel
  }

  onPointerMove(e) {
    if (!this.isRunning) return;
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;
  }

  onPointerUp(e) {
    if (!this.isRunning) return;
    this.input.isDown = false;
    // on release, drop collected letters into hearth if over hearth, else return to basket
    const rect = this.canvas.getBoundingClientRect();
    const clientX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX) || 0;
    const clientY = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY) || 0;
    const releaseX = clientX;
    const releaseY = clientY;

    const hearthRect = getHearthBounds();
    if (hearthRect && releaseX >= hearthRect.left && releaseX <= hearthRect.right && releaseY >= hearthRect.top && releaseY <= hearthRect.bottom) {
      // dump into hearth
      if (this.collected.length > 0) {
        heatHearth(this.collected.length);
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
      this.isRunning = true;
      this.lastTime = 0;
      // Enable pointer interaction when shovel is the active tool
      this.canvas.style.pointerEvents = 'auto';
      this.canvas.style.cursor = 'grab';
      requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.isRunning = false;
    this.input.isDown = false;
    this.shovel.isHeld = false;
    // Restore default non-interactive canvas so other UI remains clickable
    this.canvas.style.pointerEvents = 'none';
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min(0.04, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    if (this.isRunning) requestAnimationFrame(this.loop);
  }

  // simple helper to check proximity to letter tiles and pick them up
  tryPickupLetterIfPassing() {
    // prevent overfilling the shovel
    if (this.collected.length >= 5) return;

    const letterPool = document.getElementById('letterPool');
    if (!letterPool) return;

    const canvasRect = this.canvas.getBoundingClientRect();
    const headWorldX = canvasRect.left + this.shovel.headX;
    const headWorldY = canvasRect.top + this.shovel.headY;

    const tiles = Array.from(
      letterPool.querySelectorAll(
        '.letter-tile, [data-letter-char], [data-letter], [data-char], [data-symbol]'
      )
    );

    for (const tile of tiles) {
      const r = tile.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const pickupRadius = Math.max(r.width, r.height) / 2 + 28;
      const dist = Math.hypot(headWorldX - cx, headWorldY - cy);

      if (dist < pickupRadius) {
        const ch = getLetterFromTile(tile);
        if (!ch) continue;

        consumeLetterTile(tile);
        this.collected.push(ch);
        spawnResourceGain(headWorldX, headWorldY, 1, 'renown');
        return;
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
    const targetHeadX = s.pivotX + Math.cos(s.angle) * s.length;
    const targetHeadY = s.pivotY + Math.sin(s.angle) * s.length;

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
      this.tryPickupLetterIfPassing(speed);
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
    grad.addColorStop(0, '#2b2b2b');
    grad.addColorStop(1, '#0b0b0b');
    ctx.fillStyle = grad;
    ctx.fillRect(-handleW / 2, 0, handleW, handleL);

    // shovel head (ash shovel look) - black metal scoop
    ctx.translate(0, handleL);
    const headW = 48;
    const headH = 148;
    ctx.fillStyle = '#111214';
    ctx.beginPath();
    ctx.ellipse(0, headH / 2 - 6, headW / 2, headH / 2, 0, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
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
  }
}
