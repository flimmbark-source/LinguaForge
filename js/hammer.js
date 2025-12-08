/**
 * LINGUA FORGE - HAMMER & ANVIL SYSTEM
 * Physics-based hammer striking mechanic for letter generation
 */

import { isHearthHeated, getHearthBounds, getHearthLevel } from './hearth.js';
import { gameState } from './state.js';

export class HammerSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Callbacks set by app
    this.onLetterForged = null;
    this.onLetterLanded = null;
    this.onForgeTriggered = null; // Called when red-hot hammer hits mold viewport

    // World physics constants
    this.gravity = 2600; // px/s^2
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
      isFree: false,
      regrabCooldown: 0
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
    this.impactWords = [];
    this.flyingLetters = [];
    this.impactWordChance = 0.65; // Probability that a strike shows an impact onomatopoeia

    // Input state
    this.input = {
      mouseX: 0,
      mouseY: 0,
      isDown: false
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
    this.hammer.length = 180;
    this.hammer.baseLength = 180; // keep original handle length for the static overlay


    // Position anvil just above the letter pool bar (160px from bottom)
    // Canvas now covers full viewport, so position relative to bottom
    const letterPoolBarHeight = 160;
    this.anvil.width = Math.min(260, this.width * 0.35);
    this.anvil.height = 70;
    this.anvil.x = this.width * 0.5 - this.anvil.width / 2;
    this.anvil.y = this.height - letterPoolBarHeight - this.anvil.height - 10;

    // Position hammer pivot above anvil with enough clearance to swing
    const pivotX = this.width * 0.5;
    const pivotY = this.anvil.y - 140; // More space for swinging
    this.hammer.pivotX = pivotX;
    this.hammer.pivotY = pivotY;
    this.hammer.length = 180; // Slightly longer hammer for better reach

    // Start with hammer hanging down
    this.hammer.headX = pivotX;
    this.hammer.headY = pivotY + this.hammer.length;
    this.hammer.prevHeadX = this.hammer.headX;
    this.hammer.prevHeadY = this.hammer.headY;
    this.hammer.angle = Math.PI / 2;
    this.hammer.headVx = 0;
    this.hammer.headVy = 0;
  }

  /**
   * Setup event listeners for hammer interaction
   */
  setupEventListeners() {
    // Listen on document to capture events even when canvas has pointer-events: none
    document.addEventListener('mousedown', this.onPointerDown);
    document.addEventListener('mousemove', this.onPointerMove);
    document.addEventListener('mouseup', this.onPointerUp);
    document.addEventListener('touchstart', this.onPointerDown, { passive: false });
    document.addEventListener('touchmove', this.onPointerMove, { passive: false });
    document.addEventListener('touchend', this.onPointerUp);
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
    return dist < 140;
  }

  /**
   * Handle pointer down event
   */
onPointerDown(e) {
  const rect = this.canvas.getBoundingClientRect();
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

  e.preventDefault();
  e.stopPropagation();

  this.input.isDown = true;

  const hx = hammer.headX;
  const hy = hammer.headY;
  const dx = hx - this.input.mouseX;
  const dy = hy - this.input.mouseY;
  const newLength = Math.hypot(dx, dy);

  if (newLength > 10) {
    hammer.length = newLength;
  }

  // Player is grabbing it again → leave free-flight mode
  hammer.isFree = false;
  hammer.isHeld = true;
  hammer.pivotX = this.input.mouseX;
  hammer.pivotY = this.input.mouseY;
}


  /**
   * Handle pointer move event
   */
  onPointerMove(e) {
     const rect = this.canvas.getBoundingClientRect(); 
     const client = e.touches ? e.touches[0] : e; 
      this.input.mouseX = client.clientX - rect.left; 
      this.input.mouseY = client.clientY - rect.top; 
    if (this.hammer.isHeld && this.input.isDown) {
       e.preventDefault(); 
       e.stopPropagation(); 
       this.hammer.pivotX = this.input.mouseX; 
       this.hammer.pivotY = this.input.mouseY; 
      }
    }


  /**
   * Handle pointer up event
   */
  onPointerUp(e) {
    if (this.hammer.isHeld) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.input.isDown = false;
    this.hammer.isHeld = false;
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
    const launchSpeed = 900 + power * 500; // px/s upward
    const baseVx = (strikeVx || 0) * 0.25;
    const biasVx = (targetX - impactX) * 0.8 / Math.max(1, this.width);
    const vx = baseVx + biasVx * launchSpeed * 0.2;
    const vy = -launchSpeed;

    // Spin based on strike power and direction
    const spinBase = 6; // rad/s
    const spinFromStrike = Math.abs(strikeVx || 0) * 0.01 * power;
    const angularVel = (strikeVx >= 0 ? 1 : -1) * (spinBase + spinFromStrike);

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
   *   - isRip: if true, use red-tinted “ripped” sparks
   */
  spawnSparks(x, y, power, options = {}) {
    const isRip = !!options.isRip;
    const count = 16 + Math.floor(power * 8);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = 3 + Math.random() * 6 * power;

      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - power * 2,
        life: 0.4 + Math.random() * 0.3,
        age: 0,

        // NEW: color hint
        isRip,
        hueBase: isRip ? 17 : 40,          // 0 = red, 35 = warm yellow/orange
        hueSpread: isRip ? 8 : 20,
        sat: isRip ? 100 : 95,
        lightBase: isRip ? 55 : 60,
        lightSpread: isRip ? 8 : 15
      });
    }
  }

  /**
   * Spawn an onomatopoeia ghost at the impact point.
   * The word starts small, grows, and floats upward before fading.
   */
  spawnImpactWord(x, y) {
    // Only spawn the word ghost part of the time to keep the effect special
    if (Math.random() > this.impactWordChance) {
      return;
    }

    const options = ['Clank', 'Clink!', 'Clunk', 'Clonk!'];
    const word = options[Math.floor(Math.random() * options.length)];

    this.impactWords.push({
      text: word,
      x,
      y,
      age: 0,
      lifetime: 0.9,
      floatDistance: 46 + Math.random() * 12,
      startScale: 0.6,
      endScale: 1.5
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
if (isHearthHeated() && this.isHammerOverHearth()) {
  // Over heated hearth → accumulate heat
  hammer.heatingTimer += dt;

  const maxHeatLevel = Math.max(1, gameState.heatLevels || 0);
  const hearthLevel  = getHearthLevel() || 0;
  const effectiveMax = Math.min(maxHeatLevel, hearthLevel);

  // Compute desired heat level from total time in hearth
  const targetLevel = Math.min(
    effectiveMax,
    Math.floor(hammer.heatingTimer / hammer.heatingRequired)
  );

  // Prevent timer from storing progress beyond the unlocked cap
  hammer.heatingTimer = Math.min(
    hammer.heatingTimer,
    effectiveMax * hammer.heatingRequired
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
    const currentLevelTime = hammer.heatLevel * hammer.heatingRequired;
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

  vy += g * safeDt;

  hammer.headX += vx * safeDt;
  hammer.headY += vy * safeDt;

  const px = hammer.pivotX;
  const py = hammer.pivotY;
  let dx = hammer.headX - px;
  let dy = hammer.headY - py;
  let dist = Math.hypot(dx, dy) || 1;
  const desired = hammer.length;
  const diff = (desired - dist) / dist;

  hammer.headX += dx * diff;
  hammer.headY += dy * diff;

  hammer.headVx = (hammer.headX - hammer.prevHeadX) / safeDt;
  hammer.headVy = (hammer.headY - hammer.prevHeadY) / safeDt;
  hammer.angle = Math.atan2(
    hammer.headY - hammer.pivotY,
    hammer.headX - hammer.pivotX
  ) + Math.PI / 2;
}


updateFreeHammer(dt) {
  const hammer = this.hammer;
  const g = this.gravity;
  const frictionAir = this.airFriction * 1.033;

  // --- Integrate velocity with gravity + air drag ---
  hammer.headVy += g * dt;
  hammer.headVx *= frictionAir;
  hammer.headVy *= frictionAir;

  hammer.headX += hammer.headVx * dt;
  hammer.headY += hammer.headVy * dt;

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
    hammer.headY -= penetration; // push back above floor

    if (hammer.headVy > 0) {
      // reflect vertical velocity, damp it
      hammer.headVy = -hammer.headVy * restitution;
      // lose a bit of sideways speed
      hammer.headVx *= tangentialDamp;

      // kill tiny bounces
      if (Math.abs(hammer.headVy) < stopThreshold) {
        hammer.headVy = 0;
      }
    }
  }

  // ----- CEILING -----
  if (hammer.headY - radius < ceilingY) {
    const penetration = ceilingY - (hammer.headY - radius);
    hammer.headY += penetration;

    if (hammer.headVy < 0) {
      hammer.headVy = -hammer.headVy * restitution;
      hammer.headVx *= tangentialDamp;

      if (Math.abs(hammer.headVy) < stopThreshold) {
        hammer.headVy = 0;
      }
    }
  }

  // ----- LEFT WALL -----
  if (hammer.headX - radius < left) {
    const penetration = left - (hammer.headX - radius);
    hammer.headX += penetration;

    if (hammer.headVx < 0) {
      hammer.headVx = -hammer.headVx * restitution;
      hammer.headVy *= tangentialDamp;

      if (Math.abs(hammer.headVx) < stopThreshold) {
        hammer.headVx = 0;
      }
    }
  }

  // ----- RIGHT WALL -----
  if (hammer.headX + radius > right) {
    const penetration = hammer.headX + radius - right;
    hammer.headX -= penetration;

    if (hammer.headVx > 0) {
      hammer.headVx = -hammer.headVx * restitution;
      hammer.headVy *= tangentialDamp;

      if (Math.abs(hammer.headVx) < stopThreshold) {
        hammer.headVx = 0;
      }
    }
  }

  // Keep pivot a fixed distance above the head so drawing still works nicely
  hammer.pivotX = hammer.headX;
  hammer.pivotY = hammer.headY - hammer.length;

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

    if (isOverAnvil && downwardSpeed > impactThreshold && hammer.anvilExitReady) {
      const power = Math.min(1.5, downwardSpeed / (impactThreshold * 1.3));
      const ripThreshold = gameState.ripSpeedThreshold;

      // --- Was this a huge hit that rips the hammer free? ---
      if (hammer.isHeld && downwardSpeed > ripThreshold) {
        // Capture incoming velocity (direction of swing)
        const incomingVx = hammer.headVx;
        const incomingVy = hammer.headVy;
        const incomingSpeed = Math.hypot(incomingVx, incomingVy) || downwardSpeed;

        // Decide how hard the hammer should fly back
        const backSpeed = incomingSpeed * 1.1; // tweak for feel

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
        hammer.regrabCooldown = 0.25;

        // Place the head just above the anvil face
        hammer.headX = headX;
        hammer.headY = anvil.y - 18;

        // Give it the "flung back" velocity
        hammer.headVx = dirX * backSpeed;
        hammer.headVy = dirY * backSpeed;

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
          this.spawnImpactWord(impactX, impactY);

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
      const newVy = -downwardSpeed * bounceFactor;
      const tangentDamping = 0.3;
      const newVx = hammer.headVx * tangentDamping;

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
        this.spawnImpactWord(impactX, impactY);

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

        // Cool down the hammer
        hammer.heatLevel = 0;
        hammer.heatingTimer = 0;

        // Spawn sparks at impact point
        this.spawnSparks(impactX, impactY, 1.2);

        // Trigger forge functionality
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

    // Update impact words
    this.impactWords = this.impactWords.filter(word => word.age < word.lifetime);
    for (const word of this.impactWords) {
      word.age += dt;
    }

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
   * Draw hammer
   */
  /**
 * Draw hammer
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

  const handleWidth = hammer.handleThickness;
  const handleLength = length;

  // 1) Dynamic handle (physics-based) from PIVOT → HEAD
  const handleGradient = ctx.createLinearGradient(0, -handleLength, 0, 0);
  handleGradient.addColorStop(0, '#fbbf24');
  handleGradient.addColorStop(1, '#92400e');
  ctx.fillStyle = handleGradient;
  ctx.fillRect(-handleWidth / 2, -handleLength, handleWidth, handleLength);

  // 2) Move origin to the HEAD position
  ctx.translate(0, -handleLength);

  // 3) Static handle UNDER the head (anchored at the head, not the click)
  //    If you stored an original length, use that; otherwise fall back to 160.
  const staticHandleLength = hammer.baseLength || 160;
  const staticGradient = ctx.createLinearGradient(0, 0, 0, staticHandleLength);
  staticGradient.addColorStop(0, '#fbbf24');
  staticGradient.addColorStop(1, '#92400e');
  ctx.fillStyle = staticGradient;
  // This now starts AT THE HEAD (y = 0) and goes *downward*
  ctx.fillRect(-handleWidth / 2, 0, handleWidth, staticHandleLength);

  // 4) Head (still drawn above the head origin, in negative Y)
  const headWidth = hammer.width;
  const headHeight = 42;

  // Draw hammer head with heat level effects
  if (hammer.heatLevel > 0) {
    // Red-hot glow - intensity increases with heat level
    const glowIntensity = 20 + (hammer.heatLevel * 10);
    ctx.shadowColor = hammer.heatLevel >= 3 ? '#fef3c7' : hammer.heatLevel >= 2 ? '#f97316' : '#dc2626';
    ctx.shadowBlur = glowIntensity;

    const headGradient = ctx.createLinearGradient(-headWidth / 2, -headHeight, headWidth / 2, 0);

    // More intense colors for higher heat levels
    if (hammer.heatLevel >= 3) {
      // Level 3: White-hot
      headGradient.addColorStop(0, '#ffffff');
      headGradient.addColorStop(0.3, '#fef3c7');
      headGradient.addColorStop(1, '#f97316');
    } else if (hammer.heatLevel >= 2) {
      // Level 2: Yellow-orange
      headGradient.addColorStop(0, '#fef3c7');
      headGradient.addColorStop(0.3, '#fbbf24');
      headGradient.addColorStop(1, '#f97316');
    } else {
      // Level 1: Orange-red
      headGradient.addColorStop(0, '#fef3c7');
      headGradient.addColorStop(0.3, '#f97316');
      headGradient.addColorStop(1, '#dc2626');
    }
    ctx.fillStyle = headGradient;
  } else {
    // Normal silver head
    const headGradient = ctx.createLinearGradient(-headWidth / 2, -headHeight, headWidth / 2, 0);
    headGradient.addColorStop(0, '#e5e7eb');
    headGradient.addColorStop(1, '#475569');
    ctx.fillStyle = headGradient;
  }

  ctx.beginPath();
  ctx.roundRect(-headWidth / 2, -headHeight, headWidth, headHeight, 10);
  ctx.fill();

  // Reset shadow
  ctx.shadowBlur = 0;

    // If hammer is heated, draw red-hot effect
    if (hammer.isHeated) {
      // Red-hot glow
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 20;
      
    if (!hammer.isHeated && hammer.heatingTimer > 0) {
      const progress = Math.min(1, hammer.heatingTimer / hammer.heatingRequired);
      ctx.fillStyle = `rgba(249, 115, 22, ${progress * 0.5})`;
      ctx.fillRect(-headWidth / 2, -headHeight, headWidth * progress, headHeight);
}
      const headGradient = ctx.createLinearGradient(-headWidth / 2, -headHeight, headWidth / 2, 0);
      headGradient.addColorStop(0, '#fef3c7'); // Hot yellow-white
      headGradient.addColorStop(0.3, '#f97316'); // Orange
      headGradient.addColorStop(1, '#dc2626'); // Red
      ctx.fillStyle = headGradient;
    } else {
      // Normal silver head
      const headGradient = ctx.createLinearGradient(-headWidth / 2, -headHeight, headWidth / 2, 0);
      headGradient.addColorStop(0, '#e5e7eb');
      headGradient.addColorStop(1, '#475569');
      ctx.fillStyle = headGradient;
    }

    ctx.beginPath();
    ctx.roundRect(-headWidth / 2, -headHeight, headWidth, headHeight, 10);
    ctx.fill();
  // Show progress indicator for heating to next level
  if (hammer.heatingTimer > 0) {
    const currentLevelTime = hammer.heatLevel * hammer.heatingRequired;
    const progressToNextLevel = (hammer.heatingTimer - currentLevelTime) / hammer.heatingRequired;

    if (progressToNextLevel > 0 && progressToNextLevel < 1) {
      // Show progress bar for next heat level
      const barHeight = 4;
      const barY = -headHeight - 8;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-headWidth / 2, barY, headWidth, barHeight);

      // Progress (color based on next level)
      const nextLevel = hammer.heatLevel + 1;
      const progressColor = nextLevel >= 3 ? '#fef3c7' : nextLevel >= 2 ? '#fbbf24' : '#f97316';
      ctx.fillStyle = progressColor;
      ctx.fillRect(-headWidth / 2, barY, headWidth * progressToNextLevel, barHeight);
    }
  }

  // Shine on head (brighter if heated)
  if (hammer.heatLevel > 0) {
    ctx.globalAlpha = 0.5 + (hammer.heatLevel * 0.1);
    ctx.fillStyle = '#ffffff';
  } else {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#f9fafb';
  }
  ctx.fillRect(-headWidth / 2 + 4, -headHeight + 6, headWidth - 8, 10);
  ctx.globalAlpha = 1;

  ctx.restore();
  }

  /**
   * Draw anvil
   */
  drawAnvil(ctx, anvil) {
    ctx.save();
    ctx.translate(anvil.x + anvil.width / 2, anvil.y + anvil.height);

    // Glow effect
    const glowGradient = ctx.createRadialGradient(0, 4, 8, 0, 0, 120);
    glowGradient.addColorStop(0, 'rgba(251, 113, 133, 0.28)');
    glowGradient.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.ellipse(0, 6, anvil.width * 0.7, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(-anvil.width / 2, -anvil.height);

    // Anvil body gradient
    const g = ctx.createLinearGradient(0, 0, 0, anvil.height);
    g.addColorStop(0, '#e5e7eb');
    g.addColorStop(0.3, '#64748b');
    g.addColorStop(1, '#020617');
    ctx.fillStyle = g;

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

    const hueBase   = s.hueBase   ?? 35;
    const hueSpread = s.hueSpread ?? 20;
    const sat       = s.sat       ?? 95;
    const lightBase = s.lightBase ?? 60;
    const lightSpread = s.lightSpread ?? 15;

    const hue = hueBase + Math.random() * hueSpread;
    const light = lightBase + Math.random() * lightSpread;

    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

  drawImpactWords(ctx, words) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const word of words) {
      const progress = Math.min(word.age / word.lifetime, 1);
      const rise = word.floatDistance * progress;
      const scale = word.startScale + (word.endScale - word.startScale) * progress;
      const opacity = 1 - progress;

      ctx.save();
      ctx.translate(word.x, word.y - rise);
      ctx.scale(scale, scale);
      ctx.fillStyle = `rgba(229, 231, 235, ${opacity})`;
      ctx.strokeStyle = `rgba(15, 23, 42, ${opacity * 0.9})`;
      ctx.shadowColor = `rgba(31, 41, 55, ${opacity * 0.65})`;
      ctx.shadowBlur = 10;
      ctx.font = '700 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.lineWidth = 1.5 / scale;
      ctx.strokeText(word.text, 0, 0);
      ctx.fillText(word.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Draw flying letters
   */
  drawFlyingLetters(ctx, letters) {
    ctx.save();
    for (const letter of letters) {
      ctx.save();
      ctx.translate(letter.x, letter.y);
      ctx.rotate(letter.angle);

      const size = 28;

      // Letter tile background
      const grad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
      grad.addColorStop(0, '#22c55e');
      grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2, size, size, 6);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hebrew letter
      ctx.fillStyle = '#ecfdf5';
      ctx.font = 'bold 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
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

    // Draw impact onomatopoeia
    this.drawImpactWords(this.ctx, this.impactWords);
  }

  /**
   * Main game loop
   */
  loop(timestamp) {
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
   * Start the hammer system
   */
  start() {
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
  }

  /**
   * Cleanup
   */
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
