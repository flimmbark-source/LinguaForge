/**
 * LINGUA FORGE - HAMMER & ANVIL SYSTEM
 * Physics-based hammer striking mechanic for letter generation
 */

export class HammerSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Callbacks set by app
    this.onLetterForged = null;
    this.onLetterLanded = null;

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
      length: 160,
      width: 90,
      handleThickness: 20,
      angle: 0,
      headVx: 0,
      headVy: 0,
      isHeld: false,
      strikeCooldown: 0
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

    // Position anvil in center of canvas
    this.anvil.width = Math.min(260, this.width * 0.35);
    this.anvil.height = 70;
    this.anvil.x = this.width * 0.5 - this.anvil.width / 2;
    this.anvil.y = this.height * 0.5 - this.anvil.height / 2 + 10;

    // Position hammer pivot above anvil
    const pivotX = this.width * 0.5;
    const pivotY = this.anvil.y - 120;
    this.hammer.pivotX = pivotX;
    this.hammer.pivotY = pivotY;
    this.hammer.length = 160;

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
    this.canvas.addEventListener('mousedown', this.onPointerDown);
    this.canvas.addEventListener('mousemove', this.onPointerMove);
    window.addEventListener('mouseup', this.onPointerUp);
    this.canvas.addEventListener('touchstart', this.onPointerDown);
    this.canvas.addEventListener('touchmove', this.onPointerMove);
    window.addEventListener('touchend', this.onPointerUp);
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
    return dist < 40;
  }

  /**
   * Handle pointer down event
   */
  onPointerDown(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;
    this.input.isDown = true;

    if (this.isPointNearHammer(this.input.mouseX, this.input.mouseY)) {
      const hammer = this.hammer;
      const hx = hammer.headX;
      const hy = hammer.headY;
      const dx = hx - this.input.mouseX;
      const dy = hy - this.input.mouseY;
      const newLength = Math.hypot(dx, dy);

      if (newLength > 10) {
        hammer.length = newLength;
      }

      hammer.isHeld = true;
      hammer.pivotX = this.input.mouseX;
      hammer.pivotY = this.input.mouseY;
    }
  }

  /**
   * Handle pointer move event
   */
  onPointerMove(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;

    if (this.hammer.isHeld && this.input.isDown) {
      this.hammer.pivotX = this.input.mouseX;
      this.hammer.pivotY = this.input.mouseY;
    }
  }

  /**
   * Handle pointer up event
   */
  onPointerUp() {
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
    const targetY = poolPos.y - canvasRect.top;

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
   */
  spawnSparks(x, y, power) {
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
        age: 0
      });
    }
  }

  /**
   * Update hammer physics
   */
  updateHammer(dt) {
    const hammer = this.hammer;
    const g = this.gravity;
    const friction = this.airFriction;

    hammer.strikeCooldown = Math.max(0, hammer.strikeCooldown - dt);

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
    hammer.angle = Math.atan2(hammer.headY - hammer.pivotY, hammer.headX - hammer.pivotX) + Math.PI / 2;
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

    const isOverAnvil =
      headX > anvil.x &&
      headX < anvil.x + anvil.width &&
      headY > anvil.y - 20 &&
      headY < anvil.y + anvil.height * 0.6;

    if (isOverAnvil && downwardSpeed > impactThreshold) {
      const power = Math.min(1.5, downwardSpeed / (impactThreshold * 1.3));
      const baseBounce = 0.35;
      const extraBounce = 0.35 * power;
      const bounceFactor = Math.min(0.9, baseBounce + extraBounce);
      const newVy = -downwardSpeed * bounceFactor;
      const tangentDamping = 0.8;
      const newVx = hammer.headVx * tangentDamping;

      hammer.headY = anvil.y - 18;
      hammer.headX = headX;
      hammer.headVx = newVx;
      hammer.headVy = newVy;
      hammer.prevHeadX = hammer.headX - newVx * dt;
      hammer.prevHeadY = hammer.headY - newVy * dt;

      if (hammer.strikeCooldown <= 0) {
        hammer.strikeCooldown = 0.25;
        const impactX = headX;
        const impactY = anvil.y;
        this.spawnSparks(impactX, impactY, power);

        // Trigger letter forging with canvas position and velocity
        if (this.onLetterForged) {
          this.onLetterForged(impactX, impactY, power, hammer.headVx);
        }
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

      // Callback to spawn DOM letter tiles for landed letters
      if (this.onLetterLanded) {
        for (const letter of landedLetters) {
          this.onLetterLanded(letter.letter);
        }
      }
    }
  }

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

    // Handle
    const handleWidth = hammer.handleThickness;
    const handleLength = length;
    const handleGradient = ctx.createLinearGradient(0, -handleLength, 0, 0);
    handleGradient.addColorStop(0, '#fbbf24');
    handleGradient.addColorStop(1, '#92400e');
    ctx.fillStyle = handleGradient;
    ctx.fillRect(-handleWidth / 2, -handleLength, handleWidth, handleLength);

    // Head
    const headWidth = hammer.width;
    const headHeight = 42;
    ctx.translate(0, -handleLength);
    const headGradient = ctx.createLinearGradient(-headWidth / 2, -headHeight, headWidth / 2, 0);
    headGradient.addColorStop(0, '#e5e7eb');
    headGradient.addColorStop(1, '#475569');
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.roundRect(-headWidth / 2, -headHeight, headWidth, headHeight, 10);
    ctx.fill();

    // Shine on head
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#f9fafb';
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

  /**
   * Draw sparks
   */
  drawSparks(ctx, sparks) {
    ctx.save();
    for (const s of sparks) {
      const t = s.age / s.life;
      const alpha = Math.max(0, 1 - t);
      const size = 2 + (1 - t) * 2;
      const hue = 35 + Math.random() * 20;
      ctx.fillStyle = `hsla(${hue}, 95%, ${60 + Math.random() * 15}%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
      ctx.fill();
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
    this.canvas.removeEventListener('mousedown', this.onPointerDown);
    this.canvas.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('mouseup', this.onPointerUp);
    this.canvas.removeEventListener('touchstart', this.onPointerDown);
    this.canvas.removeEventListener('touchmove', this.onPointerMove);
    window.removeEventListener('touchend', this.onPointerUp);
    window.removeEventListener('resize', this.resize);
  }
}
