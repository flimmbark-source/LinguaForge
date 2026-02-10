/**
 * LINGUA FORGE - HAMMER & ANVIL SYSTEM
 * Physics-based hammer striking mechanic for letter generation
 */

import { isHearthHeated, getHearthBounds, getHearthLevel } from './RuneHearth.js?v=9';
import { gameState } from './state.js?v=9';
import { playHammerClank } from './audio.js?v=9';
import { handleToolDragNearSidebar, shouldPutToolAway, cleanupToolDragSidebar } from './toolSidebarHelpers.js?v=9';
import { getUpgradeLevel } from './upgrades.js?v=9';

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

export class HammerSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Callbacks set by app
    this.onLetterForged = null;
    this.onLetterLanded = null;
    this.onForgeTriggered = null; // Called when red-hot hammer hits mold viewport
    this.overlayRenderer = null; // Optional renderer (e.g., word chips) drawn after the tool

    // World physics constants
    this.gravity = 6600; // px/s^2
    this.airFriction = 0.9;

    // Hammer state
    this.hammer = {
      pivotX: 0,
      pivotY: 0,
      headX: 0,
      headY: 0,
      prevHeadX: 0,
      prevHeadY: 0,
      length: 180,
      width: 90,
      handleThickness: 20,
      angle: 0,
      prevAngle: 0, // Previous angle for calculating angular velocity during swings
      headVx: 0,
      headVy: 0,
      isHeld: false,
      strikeCooldown: 0,
      reboundLock: 0,
      anvilExitReady: true,
      heatLevel: 0, // Current heat level (0 = not heated, 1+ = red hot levels)
      heatingTimer: 0, // Time spent over heated hearth
      heatingRequired: 5, // Seconds needed to reach next heat level
      baseLength: 180, // visual "original" handle length that never changes
      maxLength: 180, // maximum length when the handle is stretched by the player
      isFree: false,
      regrabCooldown: 0,
      headMass: 3.0, // 1.0 = default mass; increase to make the head heavier/sluggish
      angularVelocity: 0, // rad/s - spin speed when thrown
      visualRotation: 0, // Current visual rotation for drawing
      throwingAxeMode: false, // True for player throws (pivot rotation), false for rips
      throwOrbitRadius: 0 // Distance from throw pivot to head during spinning throw
    };

    // Anvil state
    this.anvil = {
      x: 0,
      y: 0,
      width: 220,
      height: 70
    };

    // Visual effects
    this.sparks = [];
    this.flyingLetters = [];
    this.clankWords = []; // Comic-style impact words

    // Input state
    this.input = {
      mouseX: 0,
      mouseY: 0,
      isDown: false
    };

    // Animation state
    this.lastTime = 0;
    this.isRunning = false;

    // Precompute valid length caps
    this.refreshHandleCaps(true);

    // Bind methods
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.loop = this.loop.bind(this);
    this.resize = this.resize.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    // Cached gradients (rebuilt on resize)
    this._cachedGradients = {};
    this.useBackgroundAnvil = false;

    // Load hammer PNG image
    this._hammerImg = new Image();
    this._hammerImg.src = 'Public/Hammer.png';
    this.anvilAnchor = null;

    // Mobile detection for performance tuning
    this._isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= MOBILE_BREAKPOINT;

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
    this._isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    // Position anvil just above the hearth so they visually stack
    const isMobile = this.width <= MOBILE_BREAKPOINT;
    const isMobileLandscape = window.innerWidth <= MOBILE_BREAKPOINT && window.innerWidth > window.innerHeight;
    const hammerScale = isMobileLandscape ? 0.75 : 1;
    const baseHammerLength = (isMobile ? 140 : 180) * hammerScale;
    this.hammer.length = baseHammerLength;
    this.hammer.baseLength = baseHammerLength;
    this.hammer.maxLength = baseHammerLength;
    this.hammer.width = 90 * hammerScale;
    this.hammer.handleThickness = 20 * hammerScale;
    this.refreshHandleCaps(true);

    // Read the hearth's actual top position so the anvil sits right on it
    const hearthEl = document.getElementById('hearth');
    const canvasRect = this.canvas.getBoundingClientRect();
    let anvilBottom;
    if (hearthEl) {
      const hearthRect = hearthEl.getBoundingClientRect();
      // anvil bottom = hearth top in canvas coordinates
      anvilBottom = hearthRect.top - canvasRect.top;
    } else {
      // fallback
      const letterPoolBarHeight = isMobile ? 110 : 160;
      anvilBottom = this.height - letterPoolBarHeight;
    }

    // Position anvil just above the hearth
    // Canvas now covers full viewport, so position relative to bottom
    const letterPoolBarHeight = 160;
    this.anvil.width = Math.min(260, this.width * 0.35);
    this.anvil.height = 70;
    this.anvil.x = this.width * 0.5 - this.anvil.width / 2;
    if (!this._isMobile) {
      this.anvil.x -= 300;
    }

    // On mobile portrait (<=768px), sit the anvil directly on top of the hearth
    const isMobilePortrait = window.innerWidth <= MOBILE_BREAKPOINT && window.innerHeight > window.innerWidth;
    if (isMobilePortrait) {
      // Hearth top is at 100vh - 164px; overlap anvil base onto hearth mantle
      this.anvil.y = this.height - 164 - this.anvil.height + 4;
    } else if (isMobileLandscape && typeof anvilBottom === 'number') {
      // Sit the anvil directly on the hearth in landscape
      this.anvil.y = anvilBottom - this.anvil.height;
    } else {
      this.anvil.y = this.height - letterPoolBarHeight - this.anvil.height - 10;
    }

    this.applyAnvilAnchor();

    // Position hammer pivot above anvil with enough clearance to swing
    const pivotX = this.anvil.x + this.anvil.width / 2;
    const pivotClearance = (isMobile ? 100 : 140) * hammerScale;
    const pivotY = this.anvil.y - pivotClearance;
    this.hammer.pivotX = pivotX;
    this.hammer.pivotY = pivotY;
    this.hammer.length = baseHammerLength;

    // Start with hammer hanging down
    this.hammer.headX = pivotX;
    this.hammer.headY = pivotY + this.hammer.length;
    this.hammer.prevHeadX = this.hammer.headX;
    this.hammer.prevHeadY = this.hammer.headY;
    this.hammer.angle = Math.PI / 2;
    this.hammer.headVx = 0;
    this.hammer.headVy = 0;

    // Invalidate cached canvas rect on resize
    this._cachedCanvasRect = null;
    this._canvasRectAge = 0;

    // Rebuild cached gradients for the anvil (dimensions are stable per resize)
    this._rebuildAnvilGradients();
  }

  setUseBackgroundAnvil(shouldUse) {
    this.useBackgroundAnvil = Boolean(shouldUse);
  }

  setAnvilAnchor(anchor) {
    this.anvilAnchor = anchor;
    this.applyAnvilAnchor();
  }

  applyAnvilAnchor() {
    if (!this.anvilAnchor || !this._isMobile) return;
    const canvasRect = this.canvas.getBoundingClientRect();

    // Remember old anvil center so we can compute the delta
    const oldCenterX = this.anvil.x + this.anvil.width / 2;
    const oldCenterY = this.anvil.y + this.anvil.height / 2;

    this.anvil.width = this.anvilAnchor.width;
    this.anvil.height = this.anvilAnchor.height;
    this.anvil.x = this.anvilAnchor.x - canvasRect.left - this.anvil.width / 2;
    this.anvil.y = this.anvilAnchor.y - canvasRect.top - this.anvil.height / 2;

    const newCenterX = this.anvil.x + this.anvil.width / 2;
    const newCenterY = this.anvil.y + this.anvil.height / 2;

    const isMobileLandscape = window.innerWidth <= MOBILE_BREAKPOINT && window.innerWidth > window.innerHeight;
    const hammerScale = isMobileLandscape ? 0.75 : 1;
    const pivotClearance = (this._isMobile ? 100 : 140) * hammerScale;

    if (this._anvilAnchorInitialized) {
      // Subsequent updates: translate hammer by the anvil's movement delta
      // so the hammer stays in place relative to the scrolling background
      const dx = newCenterX - oldCenterX;
      const dy = newCenterY - oldCenterY;
      this.hammer.pivotX += dx;
      this.hammer.pivotY += dy;
      this.hammer.headX += dx;
      this.hammer.headY += dy;
      this.hammer.prevHeadX += dx;
      this.hammer.prevHeadY += dy;
    } else {
      // First call: place hammer in default rest position above the anvil
      this._anvilAnchorInitialized = true;
      this.hammer.pivotX = this.anvil.x + this.anvil.width / 2;
      this.hammer.pivotY = this.anvil.y - pivotClearance;
      this.hammer.headX = this.hammer.pivotX;
      this.hammer.headY = this.hammer.pivotY + this.hammer.length;
      this.hammer.prevHeadX = this.hammer.headX;
      this.hammer.prevHeadY = this.hammer.headY;
    }
  }

  /** Pre-build anvil gradients so we don't recreate them every frame */
  _rebuildAnvilGradients() {
    const ctx = this.ctx;
    const anvil = this.anvil;
    const g = ctx.createLinearGradient(0, 0, 0, anvil.height);
    g.addColorStop(0, '#e5e7eb');
    g.addColorStop(0.3, '#64748b');
    g.addColorStop(1, '#020617');
    this._cachedGradients.anvilBody = g;
  }

 /**
   * Resolve a safe maximum handle length using the configured cap or a base-derived fallback
   */
  getMaxHandleLength() {
    const hammer = this.hammer;
    const base = Number.isFinite(hammer.baseLength) && hammer.baseLength > 0
      ? hammer.baseLength
      : 180;

    const configuredMax = hammer.maxLength;

    if (Number.isFinite(configuredMax) && configuredMax > 0) {
      return configuredMax;
    }

    return base * 1.25;
  }

  /**
   * Refresh cached handle caps and optionally clamp the stored length to prevent runaway growth
   */
  refreshHandleCaps(clampLength = false) {
    const hammer = this.hammer;
    const safeMax = this.getMaxHandleLength();
    const base = Number.isFinite(hammer.baseLength) && hammer.baseLength > 0
      ? hammer.baseLength
      : 180;

    hammer.maxLength = safeMax;

    if (clampLength) {
      const currentLength = Number.isFinite(hammer.length) && hammer.length > 0
        ? hammer.length
        : base;
      hammer.length = Math.min(currentLength, safeMax);
    }

    return safeMax;
  }


  /**
   * Setup event listeners for hammer interaction
   */
  setupEventListeners() {
    // Listen on document to capture events even when canvas has pointer-events: none
    document.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('pointermove', this.onPointerMove, true);
    document.addEventListener('pointerup', this.onPointerUp, true);
    document.addEventListener('pointercancel', this.onPointerUp, true);

    // Fallbacks for browsers that do not support Pointer Events.
    document.addEventListener('mousedown', this.onPointerDown, true);
    document.addEventListener('mousemove', this.onPointerMove, true);
    document.addEventListener('mouseup', this.onPointerUp, true);
    document.addEventListener('touchstart', this.onPointerDown, { passive: false, capture: true });
    document.addEventListener('touchmove', this.onPointerMove, { passive: false, capture: true });
    document.addEventListener('touchend', this.onPointerUp, true);
    window.addEventListener('resize', this.resize);
  }

  /**
   * Check if point is near hammer (for grabbing)
   */
  isPointNearHammer(px, py) {
    const h = this.hammer;
    const x1 = h.pivotX;
    const y1 = h.pivotY;
    const x2 = h.headX;
    const y2 = h.headY;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const dist = Math.hypot(px - cx, py - cy);

    // Base grab distance
    let grabDist = this.width <= MOBILE_BREAKPOINT ? 70 : 140;

    // Increase grab radius for falling hammers in bottom zone
    const isInBottomZone = py > this.height * 0.8;
    const isFalling = h.isFree && h.headVy > 0;

    if (isInBottomZone || (isFalling && h.isFree)) {
      // Make it 1.5x easier to grab falling hammers
      grabDist *= 1.5;
    }

    return dist < grabDist;
  }

  /**
   * Handle pointer down event
   */
onPointerDown(e) {
  if (!this.isRunning) return;
  if (window.PointerEvent && (e.type === 'mousedown' || e.type === 'touchstart')) return;
  // Refresh cached rect on pointer down
  this._cachedCanvasRect = this.canvas.getBoundingClientRect();
  this._canvasRectAge = 0;
  const rect = this._cachedCanvasRect;
  const client = e.touches ? e.touches[0] : e;
  this.input.mouseX = client.clientX - rect.left;
  this.input.mouseY = client.clientY - rect.top;

  if (!this.isPointNearHammer(this.input.mouseX, this.input.mouseY)) {
    return;
  }

  const hammer = this.hammer;

  // If hammer is still on its tether (normal rebound), respect reboundLock
  if (!hammer.isFree && hammer.reboundLock > 0) {
    return;
  }

  // If hammer is flying free, use the dedicated regrab cooldown
  if (hammer.isFree && hammer.regrabCooldown > 0) {
    return;
  }

  // Free-flying hammer grab logic with special handling for falling hammers
  if (hammer.isFree) {
    // Check if hammer is in the bottom portion of the screen (bottom 20%)
    const isInBottomZone = this.input.mouseY > this.height * 0.8;

    // Allow grabbing if:
    // 1. In bottom zone (always allow grab)
    // 2. Hammer is falling (positive downward velocity)
    // 3. Not spinning too fast (increased threshold from 0.1 to 3.0 rad/s for falling hammers)
    const isFalling = hammer.headVy > 0;
    const spinThreshold = isFalling ? 3.0 : 0.1; // More lenient for falling hammers

    // Only prevent grab if not in bottom zone AND spinning too fast
    if (!isInBottomZone && Math.abs(hammer.angularVelocity) > spinThreshold) {
      return;
    }
  }

  e.preventDefault();
  e.stopPropagation();

  this.input.isDown = true;

  const hx = hammer.headX;
  const hy = hammer.headY;
  const dx = hx - this.input.mouseX;
  const dy = hy - this.input.mouseY;
  const newLength = Math.hypot(dx, dy);
  const maxLength = this.getMaxHandleLength();
  const clampedLength = Math.min(newLength, maxLength);

  if (clampedLength > 10) {
    hammer.length = clampedLength;
  }

  // Check if hammer was spinning fast BEFORE we reset it
  // This prevents screen lock when catching fast-spinning hammers
  const spinLockThreshold = 2.0; // rad/s - don't lock screen if was spinning faster
  const wasSpinningFast = Math.abs(hammer.angularVelocity) > spinLockThreshold;

  // Player is grabbing it again → leave free-flight mode
  hammer.isFree = false;
  hammer.isHeld = true;
  hammer.throwingAxeMode = false; // Exit throwing axe mode when grabbed
  hammer.pivotX = this.input.mouseX;
  hammer.pivotY = this.input.mouseY;
  // Reset spinning when grabbed
  hammer.angularVelocity = 0;
  hammer.visualRotation = 0;

  // Only lock screen/background if hammer wasn't spinning too fast
  if (!wasSpinningFast) {
    setScreenLocked(true);
    setBackgroundDragLocked(true);
  }
}



  /**
   * Handle pointer move event
   */
  onPointerMove(e) {
    if (window.PointerEvent && (e.type === 'mousemove' || e.type === 'touchmove')) return;
     // Cache canvas rect to avoid layout thrashing on every pointermove
     if (!this._cachedCanvasRect || this._canvasRectAge++ > 10) {
       this._cachedCanvasRect = this.canvas.getBoundingClientRect();
       this._canvasRectAge = 0;
     }
     const rect = this._cachedCanvasRect;
     const client = e.touches ? e.touches[0] : e;
      this.input.mouseX = client.clientX - rect.left;
      this.input.mouseY = client.clientY - rect.top;
    if (this.hammer.isHeld && this.input.isDown) {
       e.preventDefault();
       e.stopPropagation();
       this.hammer.pivotX = this.input.mouseX;
       this.hammer.pivotY = this.input.mouseY;
       // Open sidebar when dragging near the tab
       handleToolDragNearSidebar(client.clientX);
      }
    }


  /**
   * Handle pointer up event
   */
  onPointerUp(e) {
    if (window.PointerEvent && (e.type === 'mouseup' || e.type === 'touchend')) return;
    if (this.hammer.isHeld) {
      e.preventDefault();
      e.stopPropagation();

      // Only put tool away if released over the open sidebar content
      const client = e.changedTouches ? e.changedTouches[0] : e;
      if (shouldPutToolAway(client.clientX, client.clientY) && this.onPutAway) {
        cleanupToolDragSidebar();
        this.input.isDown = false;
        this.hammer.isHeld = false;
        setScreenLocked(false);
        setBackgroundDragLocked(false);
        this.onPutAway();
        return;
      }
      cleanupToolDragSidebar();

      // SPINNING THROW: When player releases, enter free-flight mode
      const hammer = this.hammer;
      const spinningThrowLevel = getUpgradeLevel('spinningThrow');

      // SPINNING THROW: Activate if upgrade is purchased
      if (spinningThrowLevel > 0) {
        // Enter free-flight mode
        hammer.isFree = true;
        hammer.regrabCooldown = 0.05; // Short cooldown before re-grab

        // Shift pivot down the handle so the hammer spins like a thrown hand axe.
        // This keeps the head path continuous while moving the rotation center closer
        // to the hammer's center of mass instead of the end of the handle.
        const dx = hammer.headX - hammer.pivotX;
        const dy = hammer.headY - hammer.pivotY;
        const currentLength = Math.hypot(dx, dy) || hammer.length || 180;
        const axisX = dx / currentLength;
        const axisY = dy / currentLength;
        hammer.throwOrbitRadius = Math.max(58, currentLength * 0.5);
        const pivotShift = currentLength - hammer.throwOrbitRadius;
        hammer.pivotX += axisX * pivotShift;
        hammer.pivotY += axisY * pivotShift;

        // Check if hammer is already spinning significantly
        const existingSpin = Math.abs(hammer.angularVelocity);
        const spinThreshold = 2.0; // rad/s - use throwing axe mode above this
        const swingSpinMultiplier = Math.max(1, gameState.powerSwingMultiplier || 1);

        if (existingSpin >= spinThreshold) {
          // Already spinning from Power Swing - snap to a rapid throw spin floor.
          // This ensures a high-speed thrown spin when releasing above threshold.
          const spinDirection = Math.sign(hammer.angularVelocity) || (hammer.headVx >= 0 ? 1 : -1);
          const rapidThrowSpin = (12 + spinningThrowLevel * 2.5) * swingSpinMultiplier;
          hammer.angularVelocity = spinDirection * Math.max(existingSpin * 1.2 * swingSpinMultiplier, rapidThrowSpin);
        } else {
          // Not spinning enough - apply new spin based on Spinning Throw upgrade
          // Base spin: 9 rad/s, +2.2 rad/s per level
          // Tuned for fast thrown-axe style spinning.
          const baseSpinBoost = 25;
          const spinBoostPerLevel = 2.2;
          const totalSpinBoost = baseSpinBoost + (spinningThrowLevel * spinBoostPerLevel);

          // Spin direction based on horizontal velocity direction
          const spinDirection = hammer.headVx >= 0 ? 1 : -1;

          // Scale spins-per-second directly from swing multiplier so upgrades
          // affect rotational frequency, not translational throw speed.
          hammer.angularVelocity = spinDirection * totalSpinBoost * swingSpinMultiplier;
        }

        // Enable throwing axe mode and initialize rotation
        hammer.throwingAxeMode = true;
        hammer.visualRotation = Math.atan2(hammer.headX - hammer.pivotX, -(hammer.headY - hammer.pivotY));

        // Hammer retains its current velocity (from headVx, headVy)
        // Physics and gravity will be applied in updateFreeHammer()
      }
    }
    this.input.isDown = false;
    this.hammer.isHeld = false;
    setScreenLocked(false);
    setBackgroundDragLocked(false);
  }

  /**
   * Get anvil world position for letter spawning
   */
  getAnvilWorldPosition() {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + this.anvil.x + this.anvil.width / 2,
      y: rect.top + this.anvil.y
    };
  }

  /**
   * Get letter pool world position
   */
  getLetterPoolWorldPosition() {
    const letterPoolDiv = document.getElementById('letterPool');
    if (!letterPoolDiv) return { x: 100, y: window.innerHeight - 100 };

    const rect = letterPoolDiv.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  /**
   * Spawn a flying letter with physics
   */
  spawnFlyingLetter(impactX, impactY, power, strikeVx, letterChar) {
    const poolPos = this.getLetterPoolWorldPosition();
    const canvasRect = this.canvas.getBoundingClientRect();

    // Convert world positions to canvas positions
    const targetX = poolPos.x - canvasRect.left;
    // Letters fall to the bottom of the screen
    const targetY = this.height - 10; // Bottom of canvas minus small margin

    // Launch the letter from the anvil impact point with an upward arc
    const launchSpeed = 200 + power * 500; // px/s upward
    const baseVx = (strikeVx || 0) * 0.25;
    const biasVx = (targetX - impactX) * 0.8 / Math.max(1, this.width);
    const vx = baseVx + biasVx * launchSpeed * 0.2;
    const vy = -launchSpeed;

    // Spin based on strike power and direction
    const spinBase = 6; // rad/s
    const spinFromStrike = Math.abs(strikeVx || 0) * 0.01 * power;
    const angularVel = (strikeVx >= 0 ? 1 : -1) * (spinBase + spinFromStrike);

    // Cap flying letters to prevent accumulation on mobile
    const MAX_FLYING = this._isMobile ? 8 : 30;
    if (this.flyingLetters.length >= MAX_FLYING) return;

    this.flyingLetters.push({
      x: impactX,
      y: impactY - 24,
      letter: letterChar,
      targetX,
      targetY,
      vx,
      vy,
      angle: 0,
      angularVel,
      isFlying: true
    });
  }

  /**
 * Spawn sparks at impact point
 * @param {number} x
 * @param {number} y
 * @param {number} power
 * @param {Object} [options]
 *   - isRip: if true, use red-tinted "ripped" sparks
 */
spawnSparks(x, y, power, options = {}) {
  const isRip = !!options.isRip;
  // Cap sparks: limit total active to avoid buildup on mobile
  const isMobile = this._isMobile;
  const MAX_SPARKS = isMobile ? 12 : 40;
  const base = isMobile ? 3 + Math.floor(power * 1.5) : 8 + Math.floor(power * 4);
  const count = Math.min(base, MAX_SPARKS - this.sparks.length);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI - Math.PI;
    const speed = 0.5 + Math.random() * 2 * power;

    // Pre-compute color at spawn time (avoids HSL string-build per frame)
    const hueBase = isRip ? 17 : 40;
    const hue = hueBase + Math.random() * (isRip ? 8 : 20);
    const light = (isRip ? 55 : 60) + Math.random() * (isRip ? 8 : 15);
    const sat = isRip ? 100 : 95;

    this.sparks.push({
      x,
      y: (y + 15),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - power * 2,
      life: 0.4 + Math.random() * 0.2,
      age: 0,
      color: `hsl(${hue|0}, ${sat}%, ${light|0}%)`
    });
  }
}

  /**
   * Spawn a comic-style "clank" word at impact point
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} power - Impact power (affects size)
   */
  spawnClankWord(x, y, power, options = {}) {
    // Normal pool (exclude "Clonk!" so it only appears on ripped hits)
    const words = ["Clank", "Clink!", "Clunk"];

    // Debounce duplicate spawns (some code paths may call this multiple times per impact)
    const now = performance.now();
    if (this._lastClankTime && now - this._lastClankTime < 180) {
      return; // skip if we spawned very recently
    }
    this._lastClankTime = now;

    // Choose word: allow forcing (used for ripped hits)
    let wordText = options.force || words[Math.floor(Math.random() * words.length)];

    // Random lateral pop direction and angle
    const side = Math.random() < 0.5 ? -1 : 1;

    // Increase velocity a bit for snappier pop; rip hits may be stronger
    const speedBias = options.isRip ? 1.2 : 1.0;
    const vx = side * (100 + Math.random() * 180) * (0.9 + (power || 0)) * speedBias;
    const vy = -(100 + Math.random() * 120) - (power || 0) * 160 * speedBias;

    // Visual sizes: start small, grow to target. Make 'Clonk!' larger than the others.
    const startSize = 4;
    let targetSize = 6 + (power || 0) * 6;
    if (wordText === 'Clonk!') {
      targetSize *= 2; // Clonk is bigger
    }
    if (options.sizeMultiplier) {
      targetSize *= options.sizeMultiplier;
    }

    this.clankWords.push({
      x,
      y,
      word: wordText,
      startSize,
      size: startSize,
      targetSize,
      vx,
      vy,
      rot: (Math.random() * 0.6 - 0.3) * side, // small initial tilt
      angularVel: (Math.random() * 6 - 3) * side,
      friction: 4.0, // horizontal friction (per second)
      life: 1.0, // seconds
      age: 0,
      alpha: 1.0
    });
  }

  /**
   * Check if hammer head is over hearth
   */
  isHammerOverHearth() {
    const hearthBounds = getHearthBounds();
    if (!hearthBounds) return false;

    const headX = this.hammer.headX;
    const headY = this.hammer.headY;

    // Convert canvas coordinates to viewport coordinates
    const canvasRect = this.canvas.getBoundingClientRect();
    const viewportX = canvasRect.left + headX;
    const viewportY = canvasRect.top + headY;

    return (
      viewportX > hearthBounds.left &&
      viewportX < hearthBounds.right &&
      viewportY > hearthBounds.top &&
      viewportY < hearthBounds.bottom
    );
  }

  /**
   * Check if hammer head is over mold viewport
   */
  isHammerOverMoldViewport() {
    const moldViewport = document.querySelector('.mold-viewport');
    if (!moldViewport) return false;

    const moldBounds = moldViewport.getBoundingClientRect();
    const headX = this.hammer.headX;
    const headY = this.hammer.headY;

    // Convert canvas coordinates to viewport coordinates
    const canvasRect = this.canvas.getBoundingClientRect();
    const viewportX = canvasRect.left + headX;
    const viewportY = canvasRect.top + headY;

    return (
      viewportX > moldBounds.left &&
      viewportX < moldBounds.right &&
      viewportY > moldBounds.top &&
      viewportY < moldBounds.bottom
    );
  }

  /**
   * Update hammer physics
   */
updateHammer(dt) {
  const hammer = this.hammer;
  const g = this.gravity;
  const friction = this.airFriction;

  hammer.strikeCooldown  = Math.max(0, hammer.strikeCooldown  - dt);
  hammer.reboundLock     = Math.max(0, hammer.reboundLock     - dt);
  hammer.regrabCooldown  = Math.max(0, hammer.regrabCooldown  - dt);

  // If flying free, use different physics
  if (hammer.isFree) {
    this.updateFreeHammer(dt);
    return;
  }


// -------------------------
// HEATING / COOLING LOGIC
// -------------------------
// Apply Fast Heat upgrade to reduce heating time
const baseHeatingTime = 5; // base seconds per heat level
const fastHeatReduction = gameState.fastHeatLevel || 0;
const heatingRequired = Math.max(2, baseHeatingTime - fastHeatReduction); // minimum 2 seconds
hammer.heatingRequired = heatingRequired;

if (isHearthHeated() && this.isHammerOverHearth()) {
  // Over heated hearth → accumulate heat
  hammer.heatingTimer += dt;

  const maxHeatLevel = Math.max(1, gameState.heatLevels || 0);
  const hearthLevel  = getHearthLevel() || 0;
  const effectiveMax = Math.min(maxHeatLevel, hearthLevel);

  // Compute desired heat level from total time in hearth
  const targetLevel = Math.min(
    effectiveMax,
    Math.floor(hammer.heatingTimer / heatingRequired)
  );

  // Prevent timer from storing progress beyond the unlocked cap
  hammer.heatingTimer = Math.min(
    hammer.heatingTimer,
    effectiveMax * heatingRequired
  );

  // Only ever go UP in level here
  if (targetLevel > hammer.heatLevel) {
    hammer.heatLevel = targetLevel;
    hammer.isHeated  = hammer.heatLevel > 0;
    console.log(`Hammer heat level increased to ${hammer.heatLevel}!`);
  }
} else {
  // Not over hearth:
  // - Heat LEVEL stays as-is (hammer remains red-hot)
  // - Only the PROGRESS TOWARD THE NEXT LEVEL cools down

  if (hammer.heatLevel > 0) {
    const currentLevelTime = hammer.heatLevel * heatingRequired;
    const extra = hammer.heatingTimer - currentLevelTime;

    if (extra > 0) {
      const cooledExtra = Math.max(0, extra - dt * 0.5);
      hammer.heatingTimer = currentLevelTime + cooledExtra;
    }

    // Don't touch hammer.heatLevel here; it will be cleared only on impact
    hammer.isHeated = true; // already hot; stay hot
  } else {
    // Level 0: we can cool the bar all the way back to zero
    if (hammer.heatingTimer > 0) {
      hammer.heatingTimer = Math.max(0, hammer.heatingTimer - dt * 0.5);
    }
    hammer.isHeated = false;
  }
}

  const x = hammer.headX;
  const y = hammer.headY;
  const prevX = hammer.prevHeadX;
  const prevY = hammer.prevHeadY;
  const safeDt = Math.max(dt, 0.0001);

  let vx = (x - prevX) / safeDt;
  let vy = (y - prevY) / safeDt;

  vx *= friction;
  vy *= friction;

  hammer.prevHeadX = x;
  hammer.prevHeadY = y;

  // Apply gravity scaled by head mass while the player is swinging the hammer.
  // Heavier heads feel heavier (fall faster) during player-controlled swings.
  vy += g * safeDt * (hammer.headMass || 1);

  hammer.headX += vx * safeDt;
  hammer.headY += vy * safeDt;

  const px = hammer.pivotX;
  const py = hammer.pivotY;
  let dx = hammer.headX - px;
  let dy = hammer.headY - py;
  let dist = Math.hypot(dx, dy) || 1;
  const desired = Math.min(hammer.length, this.getMaxHandleLength());
  const diff = (desired - dist) / dist;

  // Apply constraint correction.
  // When the player is holding the hammer, scale the correction by mass so
  // heavier heads lag behind the pivot and are harder to lift.
  const mass = Math.max(1, hammer.headMass || 1);
  const massSwingFactor = hammer.isHeld ? 1 / Math.sqrt(mass) : 1;
  hammer.headX += dx * diff * massSwingFactor;
  hammer.headY += dy * diff * massSwingFactor;

  hammer.headVx = (hammer.headX - hammer.prevHeadX) / safeDt;
  hammer.headVy = (hammer.headY - hammer.prevHeadY) / safeDt;
  hammer.angle = Math.atan2(
    hammer.headY - hammer.pivotY,
    hammer.headX - hammer.pivotX
  ) + Math.PI / 2;

  // POWER SWING: Build up angular velocity while swinging
  if (hammer.isHeld && !hammer.isFree) {
    const powerSwingLevel = getUpgradeLevel('powerSwing');
    if (powerSwingLevel > 0) {
      // Calculate angular velocity from change in angle
      let angleDelta = hammer.angle - hammer.prevAngle;

      // Normalize angle delta to [-PI, PI] range to handle wraparound
      while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
      while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;

      // Calculate instantaneous angular velocity (rad/s)
      const instantAngularVel = angleDelta / safeDt;

      // Build up spin gradually based on swing speed
      // Base acceleration: 2 rad/s² per level
      const spinAcceleration = powerSwingLevel * 2.0;
      const swingSpeed = Math.abs(instantAngularVel);

      // Only build spin if swinging fast enough (> 1 rad/s)
      if (swingSpeed > 1.0) {
        // Accumulate angular velocity in the direction of swing
        const spinDirection = Math.sign(instantAngularVel);
        hammer.angularVelocity += spinDirection * spinAcceleration * safeDt;

        // Cap maximum spin during swing at 15 rad/s
        hammer.angularVelocity = Math.max(-15, Math.min(15, hammer.angularVelocity));
      } else {
        // Decay spin if not swinging hard
        hammer.angularVelocity *= 0.95;
      }
    }
  }

  // Store current angle for next frame
  hammer.prevAngle = hammer.angle;
}

normalizeAngle(angle) {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

endThrowingAxeModeSmoothly() {
  const hammer = this.hammer;
  if (!hammer.throwingAxeMode) return;

  // Throwing-axe mode encodes orientation directly in pivot/head geometry.
  // Normal free mode uses a vertical base + visualRotation, so remap by -PI/2
  // to prevent an abrupt apparent angle jump when transitioning modes.
  hammer.visualRotation = this.normalizeAngle(hammer.visualRotation - (Math.PI / 2));
  hammer.throwingAxeMode = false;
}


updateFreeHammer(dt) {
  const hammer = this.hammer;
  const g = this.gravity;
  const frictionAir = this.airFriction * 1.033;
  const rotationSettleSpeed = 1.15; // 1/s - lower value for a heavier, slower return to resting orientation
  const maxSettleRate = 1.2; // rad/s - cap settle velocity so the final shift never looks snappy

  // --- Update spinning rotation ---
  if (hammer.angularVelocity !== 0) {
    hammer.visualRotation += hammer.angularVelocity * dt;

    // Reduced air friction for spinning hammers with Spinning Throw
    const spinningThrowLevel = getUpgradeLevel('spinningThrow');
    if (spinningThrowLevel > 0) {
      // Much lower friction for spinning hammers (0.995 vs 0.93)
      // This allows the hammer to spin continuously until hitting ground
      hammer.angularVelocity *= 0.995;
    } else {
      // Normal air friction for non-upgraded spinning
      hammer.angularVelocity *= frictionAir;
    }

    // Stop spinning if speed is too low
    if (Math.abs(hammer.angularVelocity) < 0.1) {
      hammer.angularVelocity = 0;
      this.endThrowingAxeModeSmoothly(); // Exit throwing axe mode when spin stops
    }
  } else if (!hammer.throwingAxeMode && Math.abs(hammer.visualRotation) > 0.001) {
    // Smoothly settle the spin-only visual twist so the hammer does not freeze at a random angle.
    // Normalize to [-PI, PI] first so it always settles via the shortest route (no extra full spins).
    hammer.visualRotation = this.normalizeAngle(hammer.visualRotation);

    // We cap settle speed to keep the final orientation shift feeling heavy and deliberate.
    const settleStep = Math.min(1, rotationSettleSpeed * dt);
    const desiredDelta = (0 - hammer.visualRotation) * settleStep;
    const maxDelta = maxSettleRate * dt;
    const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, desiredDelta));
    hammer.visualRotation += clampedDelta;

    if (Math.abs(hammer.visualRotation) < 0.001) {
      hammer.visualRotation = 0;
    }
  }

  // THROWING AXE PHYSICS: Use flag set during player throw
  // Disable if spin drops below threshold
  const spinThreshold = 2.0; // rad/s
  if (hammer.throwingAxeMode && Math.abs(hammer.angularVelocity) < spinThreshold) {
    this.endThrowingAxeModeSmoothly(); // Exit throwing axe mode when spin decays
  }

  if (hammer.throwingAxeMode) {
    // THROWING AXE MODE: Pivot flies through air, head rotates around it
    // Apply gravity and minimal air drag to pivot velocity
    hammer.headVy += g * dt; // Using headVx/headVy as pivot velocity
    // Much lower friction for thrown hammers (matches spin friction)
    hammer.headVx *= 0.995;
    hammer.headVy *= 0.995;

    // Update pivot position
    hammer.pivotX += hammer.headVx * dt;
    hammer.pivotY += hammer.headVy * dt;

    // Calculate head position relative to pivot based on rotation angle
    const angle = hammer.visualRotation;
    const orbitRadius = hammer.throwOrbitRadius || Math.max(58, (hammer.length || 180) * 0.5);
    hammer.headX = hammer.pivotX + Math.sin(angle) * orbitRadius;
    hammer.headY = hammer.pivotY - Math.cos(angle) * orbitRadius;

  } else {
    // NORMAL FREE-FLIGHT: Head flies through air (original behavior)
    // --- Integrate velocity with gravity + air drag ---
    hammer.headVy += g * dt;
    hammer.headVx *= frictionAir;
    hammer.headVy *= frictionAir;

    hammer.headX += hammer.headVx * dt;
    hammer.headY += hammer.headVy * dt;
  }

  // --- Collision params ---
  const radius = hammer.width * 0.5;     // approximate hammer-head radius
  const floorY = this.height - 10;
  const ceilingY = 10;
  const left = radius;
  const right = this.width - radius;

  const restitution = 0.7;   // 1.0 = perfectly bouncy, <1 loses energy
  const tangentialDamp = 0.85; // reduce sideways motion on impacts
  const stopThreshold = 40;    // below this speed we just stop bouncing

  // ----- FLOOR -----
  if (hammer.headY + radius > floorY) {
    const penetration = hammer.headY + radius - floorY;

    if (hammer.throwingAxeMode) {
      // THROWING AXE MODE: Adjust pivot position when head hits floor
      hammer.pivotY -= penetration;
      // Recalculate head position after pivot adjustment
      const angle = hammer.visualRotation;
      const orbitRadius = hammer.throwOrbitRadius || Math.max(58, (hammer.length || 180) * 0.5);
      hammer.headX = hammer.pivotX + Math.sin(angle) * orbitRadius;
      hammer.headY = hammer.pivotY - Math.cos(angle) * orbitRadius;
    } else {
      // NORMAL MODE: Just push head back above floor
      hammer.headY -= penetration;
    }

    if (hammer.headVy > 0) {
      // reflect vertical velocity, damp it and account for head mass
      const massFactor = hammer.headMass || 1;
      hammer.headVy = -hammer.headVy * restitution / massFactor;
      // lose a bit of sideways speed
      hammer.headVx *= tangentialDamp;

      // kill tiny bounces
      if (Math.abs(hammer.headVy) < stopThreshold) {
        hammer.headVy = 0;
      }

      // If spinning above threshold when hitting floor, keep spinning
      const spinThreshold = gameState.spinRetentionThreshold || 5; // rad/s
      if (Math.abs(hammer.angularVelocity) >= spinThreshold) {
        // Retain spin, just dampen it slightly
        hammer.angularVelocity *= 0.9;
      } else {
        // Below threshold, stop spinning
        hammer.angularVelocity = 0;
      }
    }
  }

  // ----- CEILING -----
  if (hammer.headY - radius < ceilingY) {
    const penetration = ceilingY - (hammer.headY - radius);

    if (hammer.throwingAxeMode) {
      // THROWING AXE MODE: Adjust pivot position
      hammer.pivotY += penetration;
      const angle = hammer.visualRotation;
      const orbitRadius = hammer.throwOrbitRadius || Math.max(58, (hammer.length || 180) * 0.5);
      hammer.headX = hammer.pivotX + Math.sin(angle) * orbitRadius;
      hammer.headY = hammer.pivotY - Math.cos(angle) * orbitRadius;
    } else {
      hammer.headY += penetration;
    }

    if (hammer.headVy < 0) {
      const massFactor = hammer.headMass || 1;
      hammer.headVy = -hammer.headVy * restitution / massFactor;
      hammer.headVx *= tangentialDamp;

      if (Math.abs(hammer.headVy) < stopThreshold) {
        hammer.headVy = 0;
      }
    }
  }

  // ----- LEFT WALL -----
  if (hammer.headX - radius < left) {
    const penetration = left - (hammer.headX - radius);

    if (hammer.throwingAxeMode) {
      // THROWING AXE MODE: Adjust pivot position
      hammer.pivotX += penetration;
      const angle = hammer.visualRotation;
      const orbitRadius = hammer.throwOrbitRadius || Math.max(58, (hammer.length || 180) * 0.5);
      hammer.headX = hammer.pivotX + Math.sin(angle) * orbitRadius;
      hammer.headY = hammer.pivotY - Math.cos(angle) * orbitRadius;
    } else {
      hammer.headX += penetration;
    }

    if (hammer.headVx < 0) {
      const massFactor = hammer.headMass || 1;
      hammer.headVx = -hammer.headVx * restitution / massFactor;
      hammer.headVy *= tangentialDamp;

      if (Math.abs(hammer.headVx) < stopThreshold) {
        hammer.headVx = 0;
      }
    }
  }

  // ----- RIGHT WALL -----
  if (hammer.headX + radius > right) {
    const penetration = hammer.headX + radius - right;

    if (hammer.throwingAxeMode) {
      // THROWING AXE MODE: Adjust pivot position
      hammer.pivotX -= penetration;
      const angle = hammer.visualRotation;
      const orbitRadius = hammer.throwOrbitRadius || Math.max(58, (hammer.length || 180) * 0.5);
      hammer.headX = hammer.pivotX + Math.sin(angle) * orbitRadius;
      hammer.headY = hammer.pivotY - Math.cos(angle) * orbitRadius;
    } else {
      hammer.headX -= penetration;
    }

    if (hammer.headVx > 0) {
      const massFactor = hammer.headMass || 1;
      hammer.headVx = -hammer.headVx * restitution / massFactor;
      hammer.headVy *= tangentialDamp;

      if (Math.abs(hammer.headVx) < stopThreshold) {
        hammer.headVx = 0;
      }
    }
  }

  // Update pivot position for normal mode (not throwing axe mode)
  if (!hammer.throwingAxeMode) {
    // Keep pivot a fixed distance above the head so drawing still works nicely
    const freeLength = Math.min(hammer.length, this.getMaxHandleLength());
    hammer.pivotX = hammer.headX;
    hammer.pivotY = hammer.headY - freeLength;
  }

  // Keep prevHead* coherent for other code using a verlet-ish scheme
  hammer.prevHeadX = hammer.headX - hammer.headVx * dt;
  hammer.prevHeadY = hammer.headY - hammer.headVy * dt;

  // Angle for drawing
  hammer.angle = Math.atan2(
    hammer.headY - hammer.pivotY,
    hammer.headX - hammer.pivotX
  ) + Math.PI / 2;
}
  /**
   * Update physics simulation
   */
  update(dt) {
    const { hammer, anvil } = this;

    this.updateHammer(dt);

    const headX = hammer.headX;
    const headY = hammer.headY;
    const downwardSpeed = hammer.headVy;
    const impactThreshold = 900;

    // Track when the hammer has cleared the anvil so the next strike can arm
    const anvilTop = anvil.y - 20;
    const anvilBottom = anvil.y + anvil.height * 0.6;

    if (headY < anvilTop) {
      hammer.anvilExitReady = true;
    }

    const isOverAnvil =
      headX > anvil.x &&
      headX < anvil.x + anvil.width &&
      headY > anvilTop &&
      headY < anvilBottom;

    const spinRetentionThreshold = gameState.spinRetentionThreshold || 5;
    const isSpinningThrowPass =
      hammer.isFree &&
      hammer.throwingAxeMode &&
      isOverAnvil &&
      Math.abs(hammer.angularVelocity) >= spinRetentionThreshold;

    // Spinning throw: bounce off the anvil and allow repeated multi-hits.
    // Keep spin rate effectively intact while only slightly damping travel speed.
    if (isSpinningThrowPass && hammer.strikeCooldown <= 0) {
      const spinImpactPower = Math.min(1.5, Math.max(0.6, Math.abs(hammer.angularVelocity) / 10));
      hammer.strikeCooldown = 0.07;

      // Bounce vertically off the anvil face while preserving orbiting spin.
      if (hammer.headVy > 0) {
        hammer.headVy = -Math.abs(hammer.headVy) * 0.92;
        hammer.headY = anvil.y - 18;
      } else {
        hammer.headVy = Math.abs(hammer.headVy) * 0.92;
        hammer.headY = anvilBottom;
      }
      hammer.headVx *= 0.99;

      // Keep rotational speed through impacts (tiny loss to avoid runaway energy).
      hammer.angularVelocity *= 0.998;

      this.spawnSparks(headX, anvil.y, spinImpactPower);
      this.spawnClankWord(headX, anvil.y, spinImpactPower);
      playHammerClank();

      if (this.onLetterForged) {
        this.onLetterForged(headX, anvil.y, spinImpactPower, hammer.headVx, 1);
      }
    }

    // Non-throwing free-flight hammer hitting anvil (bounce behavior)
    if (hammer.isFree && !hammer.throwingAxeMode && isOverAnvil && downwardSpeed > impactThreshold && hammer.anvilExitReady) {
      const spinThreshold = spinRetentionThreshold; // rad/s
      const isSpinning = Math.abs(hammer.angularVelocity) >= spinThreshold;

      if (isSpinning) {
        // Spinning hammer hits anvil - bounce and retain spin
        const massFactor = hammer.headMass || 1;
        hammer.headVy = -downwardSpeed * 0.7 / massFactor;
        hammer.headVx *= 0.8;
        hammer.headY = anvil.y - 18;
        hammer.anvilExitReady = false;

        // Retain spin, dampen it slightly
        hammer.angularVelocity *= 0.95;

        // Produce letters/sparks from spinning hit
        if (hammer.strikeCooldown <= 0) {
          hammer.strikeCooldown = 0.07;
          const power = Math.min(1.5, downwardSpeed / (impactThreshold * 1.3));
          this.spawnSparks(headX, anvil.y, power);
          this.spawnClankWord(headX, anvil.y, power);
          playHammerClank();

          if (this.onLetterForged) {
            this.onLetterForged(headX, anvil.y, power, hammer.headVx, 1);
          }
        }
      } else {
        // Not spinning enough - normal bounce and stop spinning
        const massFactor = hammer.headMass || 1;
        hammer.headVy = -downwardSpeed * 0.7 / massFactor;
        hammer.headVx *= 0.8;
        hammer.headY = anvil.y - 18;
        hammer.anvilExitReady = false;
        hammer.angularVelocity = 0;
        // Keep current visualRotation and let the settle logic ease it down smoothly.
      }
    }

    if (!hammer.throwingAxeMode && isOverAnvil && downwardSpeed > impactThreshold && hammer.anvilExitReady) {
      const power = Math.min(1.5, downwardSpeed / (impactThreshold * 1.3));
      const ripThreshold = gameState.ripSpeedThreshold;

      // --- Was this a huge hit that rips the hammer free? ---
      if (hammer.isHeld && downwardSpeed > ripThreshold) {
        // Capture incoming velocity (direction of swing)
        const incomingVx = hammer.headVx;
        const incomingVy = hammer.headVy;
        const incomingSpeed = Math.hypot(incomingVx, incomingVy) || downwardSpeed;

        // Decide how hard the hammer should fly back
        // Heavier heads should be harder to fling back, scale by mass
        const backSpeed = incomingSpeed * 1.1 / (hammer.headMass || 1);

        // Reverse the direction (opposite of swing)
        let dirX = -incomingVx;
        let dirY = -incomingVy;
        const len = Math.hypot(dirX, dirY) || 1;
        dirX /= len;
        dirY /= len;

        // Optionally bias a bit more "upwards" so it feels cartoony
        const upBias = 0.3; // 0 = pure opposite, 1 = more vertical
        dirY = dirY - upBias;
        const len2 = Math.hypot(dirX, dirY) || 1;
        dirX /= len2;
        dirY /= len2;

        // Release the hammer from the hand + switch to free-flight
        hammer.isHeld = false;
        this.input.isDown = false;
        hammer.isFree = true;
        hammer.throwingAxeMode = false; // Rips use normal physics, not throwing axe
        hammer.regrabCooldown = 0.25;

        // Place the head just above the anvil face
        hammer.headX = headX;
        hammer.headY = anvil.y - 18;

        // Give it the "flung back" velocity
        hammer.headVx = dirX * backSpeed;
        hammer.headVy = dirY * backSpeed;

        // Add angular velocity based on the impact power (spinning hammer throw)
        const spinPower = Math.min(1, downwardSpeed / ripThreshold);
        hammer.angularVelocity = (incomingVx >= 0 ? 1 : -1) * (8 + spinPower * 12); // rad/s

        // Encode that into prevHead* for the verlet integrator
        hammer.prevHeadX = hammer.headX - hammer.headVx * dt;
        hammer.prevHeadY = hammer.headY - hammer.headVy * dt;

        // Optional: still do effects / letters on a ripped hit
        if (hammer.strikeCooldown <= 0) {
          hammer.strikeCooldown = 0.25;
          hammer.anvilExitReady = false;
          const impactX = headX;
          const impactY = anvil.y;
          this.spawnSparks(impactX, impactY, power, { isRip: true });
          this.spawnClankWord(impactX, impactY, power, { isRip: true, force: 'Clonk!' }); // Add clank word (ripped)
          playHammerClank();

          if (this.onLetterForged) {
            this.onLetterForged(impactX, impactY, power, hammer.headVx, 1);
          }
        }

        // Important: skip the normal bounce logic when ripped
        return;
      }

      const baseBounce = 0.85;
      const extraBounce = 0.35 * power;
      const bounceFactor = Math.min(0.9, baseBounce + extraBounce);
      // Heavier heads reduce the outgoing velocity
      const newVy = -downwardSpeed * bounceFactor / (hammer.headMass || 1);
      const tangentDamping = 0.3;
      const newVx = (hammer.headVx * tangentDamping) / (hammer.headMass || 1);

      hammer.headY = anvil.y - 18;
      // Lift slightly higher so the hammer must leave the strike zone
      hammer.headY -= 6;
      hammer.headX = headX;
      hammer.headVx = newVx;
      hammer.headVy = newVy;
      hammer.prevHeadX = hammer.headX - newVx * dt;
      hammer.prevHeadY = hammer.headY - newVy * dt;

      hammer.reboundLock = 0.18;

      if (hammer.strikeCooldown <= 0) {
        hammer.strikeCooldown = 0.25;
        hammer.anvilExitReady = false;
        const impactX = headX;
        const impactY = anvil.y;
        this.spawnSparks(impactX, impactY, power);
        this.spawnClankWord(impactX, impactY, power); // Add clank word
        playHammerClank();

        // Calculate multiplier based on heat level
        // Heat level 0 = 1x, level 1 = 2x, level 2 = 3x, level 3 = 4x, etc.
        const multiplier = 1 + (4 * hammer.heatLevel);

        if (hammer.heatLevel > 0) {
          console.log(`Heat level ${hammer.heatLevel} hammer struck anvil! ${multiplier}x letters produced. Cooling down.`);
          // Cool down completely after striking
          hammer.heatLevel = 0;
          hammer.heatingTimer = 0;
        }

        // Produce letters with calculated multiplier
        if (this.onLetterForged) {
          this.onLetterForged(impactX, impactY, power, hammer.headVx, multiplier);
        }
      }
    }

    // Check for mold viewport collision (only when hammer is heated and moving down)
    if (hammer.heatLevel > 0 && this.isHammerOverMoldViewport() && downwardSpeed > impactThreshold) {
      if (hammer.strikeCooldown <= 0) {
        hammer.strikeCooldown = 0.25;
        const impactX = headX;
        const impactY = headY;
        const multiplier = 1 + (4 * hammer.heatLevel);

        // Cool down the hammer
        hammer.heatLevel = 0;
        hammer.heatingTimer = 0;

        // Spawn sparks at impact point
        this.spawnSparks(impactX, impactY, 1.2);

        // Trigger forge functionality (no letter spawning on forge strikes)
        if (this.onForgeTriggered) {
          this.onForgeTriggered();
          console.log('Red-hot hammer struck mold viewport! Forging words...');
        }

        // Bounce the hammer back
        const bounceFactor = 0.6;
        hammer.headVy = -downwardSpeed * bounceFactor;
        hammer.headVx = hammer.headVx * 0.8;
        hammer.prevHeadX = hammer.headX - hammer.headVx * dt;
        hammer.prevHeadY = hammer.headY - hammer.headVy * dt;
      }
    }

    // Update sparks
    this.sparks = this.sparks.filter(s => s.age < s.life);
    for (const s of this.sparks) {
      s.age += dt;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 18 * dt;
    }

    // Update clank words (physics: gravity, friction, rotation)
    const clankGravity = 900; // px/s^2 downward for words
    for (const word of this.clankWords) {
      word.age += dt;

      // Grow size (fast at first, then slow down with easing)
      const growthProgress = Math.min(1, word.age / 0.22); // Grow over ~0.22s
      const eased = 1 - Math.pow(1 - growthProgress, 3); // Cubic ease-out
      const baseSize = (word.startSize != null) ? word.startSize : (word.size || 0);
      word.size = baseSize * (1 - eased) + word.targetSize * eased;

      // Integrate physics
      // gravity
      word.vy += clankGravity * dt;

      // horizontal friction (simple linear damping)
      const frictionFactor = Math.max(0, 1 - word.friction * dt);
      word.vx *= frictionFactor;

      // integrate position
      word.x += word.vx * dt;
      word.y += word.vy * dt;

      // rotation
      word.rot += (word.angularVel || 0) * dt;

      // Fade out near the end
      const fadeStart = 0.6; // Start fading at 60% of lifetime
      if (word.age > word.life * fadeStart) {
        const fadeProgress = (word.age - word.life * fadeStart) / (word.life * (1 - fadeStart));
        word.alpha = Math.max(0, 1 - fadeProgress);
      }
    }

    // Remove expired clank words
    this.clankWords = this.clankWords.filter(w => w.age < w.life && w.alpha > 0.02);

    // Update flying letters with physics
    const blockGravity = this.gravity * 0.8;
    const landedLetters = [];

    for (const letter of this.flyingLetters) {
      if (!letter.isFlying) continue;

      // Apply gravity
      letter.vy += blockGravity * dt;

      // Update position
      letter.x += letter.vx * dt;
      letter.y += letter.vy * dt;

      // Update rotation
      letter.angle += letter.angularVel * dt;

      // Check if letter has fallen to target Y (letter pool level)
      if (letter.vy > 0 && letter.y >= letter.targetY) {
        letter.isFlying = false;
        landedLetters.push(letter);
      }
    }

    // Remove landed letters and trigger DOM spawning
    if (landedLetters.length > 0) {
      this.flyingLetters = this.flyingLetters.filter(l => l.isFlying);

      if (this.onLetterLanded) {
        for (const letter of landedLetters) {
          this.onLetterLanded(letter.letter, letter.x, letter.y);
        }
      }
    }
  }


  /**
   * Draw hammer using PNG image
   */
drawHammer(ctx, hammer) {
  ctx.save();
  const pivotX = hammer.pivotX;
  const pivotY = hammer.pivotY;
  const dx = hammer.headX - pivotX;
  const dy = hammer.headY - pivotY;
  const angle = Math.atan2(dy, dx) + Math.PI / 2;
  const length = Math.hypot(dx, dy) || hammer.length;

  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);

  // Apply additional rotation if hammer is spinning (but NOT in throwing axe mode)
  // In throwing axe mode, the positions already encode the rotation
  if (hammer.isFree && hammer.visualRotation !== 0 && !hammer.throwingAxeMode) {
    // Rotate around the handle-to-head axis
    const headOffsetY = -(length + 21); // Approximate center of hammer head
    ctx.translate(0, headOffsetY);
    ctx.rotate(hammer.visualRotation);
    ctx.translate(0, -headOffsetY);
  }

  const handleLength = Math.min(length, this.getMaxHandleLength());
  const headHeight = 42;
  const headWidth = hammer.width;

  // Draw subtle ambient glow behind hammer head (always on for visibility)
  const headCenterY = -(handleLength + headHeight - 30);
  const baseGlowRadius = 36;
  const baseGlow = ctx.createRadialGradient(0, headCenterY, 4, 0, headCenterY, baseGlowRadius);
  baseGlow.addColorStop(0, 'rgba(255, 245, 230, 0.22)');
  baseGlow.addColorStop(1, 'rgba(255, 220, 180, 0)');
  ctx.fillStyle = baseGlow;
  ctx.beginPath();
  ctx.arc(0, headCenterY, baseGlowRadius, 0, Math.PI * 3);
  ctx.fill();

  // Draw heat glow behind hammer head
  if (hammer.heatLevel > 0) {
    const glowRadius = 60 + hammer.heatLevel * 30;
    const gradient = ctx.createRadialGradient(0, headCenterY, 4, 0, headCenterY, glowRadius);
    if (hammer.heatLevel >= 3) {
      gradient.addColorStop(0, 'rgba(255, 240, 210, 0.75)');
      gradient.addColorStop(0.35, 'rgba(255, 120, 60, 0.45)');
      gradient.addColorStop(1, 'rgba(255, 60, 0, 0)');
    } else if (hammer.heatLevel >= 2) {
      gradient.addColorStop(0, 'rgba(255, 190, 120, 0.6)');
      gradient.addColorStop(0.4, 'rgba(255, 90, 40, 0.35)');
      gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 150, 90, 0.45)');
      gradient.addColorStop(0.45, 'rgba(255, 70, 30, 0.25)');
      gradient.addColorStop(1, 'rgba(255, 40, 0, 0)');
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, headCenterY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw hammer PNG image (fixed size regardless of grab point)
  if (this._hammerImg && this._hammerImg.complete && this._hammerImg.naturalWidth > 0) {
    const imgAspect = this._hammerImg.naturalWidth / this._hammerImg.naturalHeight;
    const baseLength = hammer.baseLength || 180;
    const imgHeight = baseLength + headHeight;
    const imgWidth = imgHeight * imgAspect;
    // Head (top of image) anchored to physics head position;
    // handle extends past the grip point when grabbing mid-haft
    ctx.drawImage(this._hammerImg, -imgWidth / 2, -(handleLength + headHeight), imgWidth, imgHeight);
  }

  // Show progress indicator for heating to next level
  if (hammer.heatingTimer > 0) {
    // Use dynamic heating required time
    const baseHeatingTime = 5;
    const fastHeatReduction = gameState.fastHeatLevel || 0;
    const heatingRequired = Math.max(2, baseHeatingTime - fastHeatReduction);

    const currentLevelTime = hammer.heatLevel * heatingRequired;
    const progressToNextLevel = (hammer.heatingTimer - currentLevelTime) / heatingRequired;

    if (progressToNextLevel > 0 && progressToNextLevel < 1) {
      const barHeight = 4;
      const barY = -(handleLength + headHeight) - 8;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-headWidth / 2, barY, headWidth, barHeight);

      const nextLevel = hammer.heatLevel + 1;
      const progressColor = nextLevel >= 3 ? '#fef3c7' : nextLevel >= 2 ? '#fbbf24' : '#f97316';
      ctx.fillStyle = progressColor;
      ctx.fillRect(-headWidth / 2, barY, headWidth * progressToNextLevel, barHeight);
    }
  }

  ctx.restore();
  }

  /**
   * Draw anvil
   */
  drawAnvil(ctx, anvil) {
    if (this.useBackgroundAnvil) {
      return;
    }
    ctx.save();
    ctx.translate(anvil.x, anvil.y);

    // Use cached body gradient
    ctx.fillStyle = this._cachedGradients.anvilBody || '#64748b';

    // Top surface
    const topHeight = anvil.height * 0.35;
    ctx.beginPath();
    ctx.roundRect(0, 0, anvil.width, topHeight, 8);
    ctx.fill();

    // Middle section
    const midHeight = anvil.height * 0.4;
    const waistWidth = anvil.width * 0.55;
    const waistX = (anvil.width - waistWidth) / 2;
    ctx.beginPath();
    ctx.moveTo(waistX, topHeight);
    ctx.lineTo(waistX + waistWidth, topHeight);
    ctx.lineTo(waistX + waistWidth * 0.85, topHeight + midHeight);
    ctx.lineTo(waistX + waistWidth * 0.15, topHeight + midHeight);
    ctx.closePath();
    ctx.fill();

    // Base
    const baseHeight = anvil.height * 0.25;
    ctx.beginPath();
    ctx.roundRect(waistX - 28, topHeight + midHeight - 10, waistWidth + 56, baseHeight, 10);
    ctx.fill();

    // Highlight on top
    ctx.strokeStyle = 'rgba(248,250,252,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 6);
    ctx.lineTo(anvil.width - 8, 6);
    ctx.stroke();

    ctx.restore();
  }

  drawSparks(ctx, sparks) {
  ctx.save();
  for (const s of sparks) {
    const t = s.age / s.life;
    const alpha = Math.max(0, 1 - t);
    const size = 2 + (1 - t) * 2;

    // Use color baked at spawn time (s.color) for perf; fall back to orange
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.color || '#f97316';
    ctx.fillRect(s.x - size, s.y - size, size * 2, size * 2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

  /**
   * Draw comic-style clank words
   */
  drawClankWords(ctx, words) {
    ctx.save();
    for (const word of words) {
      const fontSize = Math.max(9, Math.round(word.size));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.save();
      ctx.translate(word.x, word.y);
      ctx.rotate(word.rot || 0);

      // Simple outline + fill (no gradient, no shadow, no composite blend)
      ctx.lineWidth = Math.max(1, fontSize * 0.06);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(12,14,18,${Math.min(0.9, word.alpha)})`;
      ctx.strokeText(word.word, 0, 0);

      ctx.fillStyle = `rgba(220,220,230,${0.95 * word.alpha})`;
      ctx.fillText(word.word, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Draw flying letters
   */
  drawFlyingLetters(ctx, letters) {
    ctx.save();
    const isMobile = this.width <= MOBILE_BREAKPOINT;
    const size = 28;

    // On mobile, skip per-letter gradients and use flat fill for perf
    if (isMobile) {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
    }

    for (const letter of letters) {
      ctx.save();
      ctx.translate(letter.x, letter.y);
      ctx.rotate(letter.angle);

      if (isMobile) {
        // Flat fill — no gradient, no stroke
        ctx.fillStyle = '#0b0b0c';
        ctx.beginPath();
        ctx.roundRect(-size / 2, -size / 2, size, size, 6);
        ctx.fill();
        ctx.strokeStyle = '#d1a640';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Letter tile background
        const grad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
        grad.addColorStop(0, '#0f0f10');
        grad.addColorStop(1, '#1b1b1d');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(-size / 2, -size / 2, size, size, 6);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#d1a640';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Hebrew letter
      ctx.fillStyle = '#f3d27a';
      if (!isMobile) {
        ctx.font = 'bold 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
      ctx.fillText(letter.letter, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Render frame
   */
  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw anvil
    this.drawAnvil(this.ctx, this.anvil);

    // Draw flying letters (behind hammer)
    this.drawFlyingLetters(this.ctx, this.flyingLetters);

    // Draw hammer
    this.drawHammer(this.ctx, this.hammer);

    // Draw sparks
    this.drawSparks(this.ctx, this.sparks);

    // Draw clank words (on top of everything)
    this.drawClankWords(this.ctx, this.clankWords);

    // Draw overlay content like word chips after the tool
    if (this.overlayRenderer) {
      this.overlayRenderer();
    }
  }

  /**
   * Main game loop
   */
  loop(timestamp) {
    if (!this.isRunning) return; // Don't render after stop()
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min(0.04, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    if (this.isRunning) {
      requestAnimationFrame(this.loop);
    }
  }

  /**
   * Set a renderer to draw after the hammer (e.g., word chips)
   */
  setOverlayRenderer(renderer) {
    this.overlayRenderer = renderer;
  }

  /**
   * Start the hammer system
   */
  start() {
    // Ensure handle caps and current length are valid when resuming
    this.refreshHandleCaps(true);

    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = 0;
      requestAnimationFrame(this.loop);
    }
  }

  /**
   * Stop the hammer system
   */
  stop() {
    this.isRunning = false;
    // Clear the canvas so the hammer doesn't remain visible when put away
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('pointermove', this.onPointerMove, true);
    document.removeEventListener('pointerup', this.onPointerUp, true);
    document.removeEventListener('pointercancel', this.onPointerUp, true);

    document.removeEventListener('mousedown', this.onPointerDown, true);
    document.removeEventListener('mousemove', this.onPointerMove, true);
    document.removeEventListener('mouseup', this.onPointerUp, true);
    document.removeEventListener('touchstart', this.onPointerDown, true);
    document.removeEventListener('touchmove', this.onPointerMove, true);
    document.removeEventListener('touchend', this.onPointerUp, true);
    window.removeEventListener('resize', this.resize);
  }
}
