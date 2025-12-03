/**
 * LINGUA FORGE - PESTLE & MORTAR SYSTEM
 * Physics-based pestle grinding mechanic for ink production
 */

export class PestleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Callbacks set by app
    this.onInkProduced = null;

    // World physics constants
    this.gravity = 2600; // px/s^2
    this.airFriction = 0.9;

    // Pestle state
    this.pestle = {
      pivotX: 0,
      pivotY: 0,
      headX: 0,
      headY: 0,
      prevHeadX: 0,
      prevHeadY: 0,
      length: 140,
      width: 30,
      handleThickness: 12,
      angle: 0,
      headVx: 0,
      headVy: 0,
      isHeld: false,
      attachedLetters: [], // Letters picked up by pestle
      churnCooldown: 0,
    };

    // Mortar state
    this.mortar = {
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      innerRadius: 70,
    };

    // Rotation tracking for churning
    this.rotationTracker = {
      prevAngle: 0,
      totalRotation: 0,
      rotationsCompleted: 0,
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

    // Position mortar in same place as anvil (160px from bottom)
    const letterPoolBarHeight = 160;
    this.mortar.width = Math.min(200, this.width * 0.3);
    this.mortar.height = 80;
    this.mortar.x = this.width * 0.5 - this.mortar.width / 2;
    this.mortar.y = this.height - letterPoolBarHeight - this.mortar.height - 10;

    // Position pestle pivot above mortar
    const pivotX = this.width * 0.5;
    const pivotY = this.mortar.y - 100;
    this.pestle.pivotX = pivotX;
    this.pestle.pivotY = pivotY;
    this.pestle.length = 140;

    // Start with pestle hanging down
    this.pestle.headX = pivotX;
    this.pestle.headY = pivotY + this.pestle.length;
    this.pestle.prevHeadX = this.pestle.headX;
    this.pestle.prevHeadY = this.pestle.headY;
    this.pestle.angle = Math.PI / 2;
    this.pestle.headVx = 0;
    this.pestle.headVy = 0;
  }

  /**
   * Setup event listeners for pestle interaction
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
    return dist < 40;
  }

  /**
   * Handle pointer down event
   */
  onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;

    // Only handle if near pestle
    if (this.isPointNearPestle(this.input.mouseX, this.input.mouseY)) {
      e.preventDefault();
      e.stopPropagation();

      this.input.isDown = true;
      const pestle = this.pestle;
      const hx = pestle.headX;
      const hy = pestle.headY;
      const dx = hx - this.input.mouseX;
      const dy = hy - this.input.mouseY;
      const newLength = Math.hypot(dx, dy);

      if (newLength > 10) {
        pestle.length = newLength;
      }

      pestle.isHeld = true;
      pestle.pivotX = this.input.mouseX;
      pestle.pivotY = this.input.mouseY;
    }
  }

  /**
   * Handle pointer move event
   */
  onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;

    if (this.pestle.isHeld && this.input.isDown) {
      e.preventDefault();
      e.stopPropagation();
      this.pestle.pivotX = this.input.mouseX;
      this.pestle.pivotY = this.input.mouseY;
    }
  }

  /**
   * Handle pointer up event
   */
  onPointerUp(e) {
    if (this.pestle.isHeld) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.input.isDown = false;
    this.pestle.isHeld = false;
  }

  /**
   * Check if pestle head is inside mortar
   */
  isPestleInMortar() {
    const pestle = this.pestle;
    const mortar = this.mortar;
    const headX = pestle.headX;
    const headY = pestle.headY;

    // Check if head is within mortar bounds
    const centerX = mortar.x + mortar.width / 2;
    const centerY = mortar.y + mortar.height / 2;
    const dist = Math.hypot(headX - centerX, headY - centerY);

    return dist < mortar.innerRadius && headY > mortar.y && headY < mortar.y + mortar.height;
  }

  /**
   * Check for letter pickup collision
   */
  checkLetterPickup() {
    const letterPoolDiv = document.getElementById('letterPool');
    if (!letterPoolDiv) return;

    const tiles = Array.from(letterPoolDiv.querySelectorAll('.letter-tile'));
    const canvasRect = this.canvas.getBoundingClientRect();
    const pestleHeadX = canvasRect.left + this.pestle.headX;
    const pestleHeadY = canvasRect.top + this.pestle.headY;

    for (const tile of tiles) {
      const tileRect = tile.getBoundingClientRect();
      const tileCenterX = tileRect.left + tileRect.width / 2;
      const tileCenterY = tileRect.top + tileRect.height / 2;
      const dist = Math.hypot(pestleHeadX - tileCenterX, pestleHeadY - tileCenterY);

      // If pestle head is near tile (within 30px)
      if (dist < 30) {
        const char = tile.dataset.letterChar || '';
        const count = parseInt(tile.dataset.count || '1', 10);

        // Pick up one instance
        this.pestle.attachedLetters.push(char);

        // Update or remove tile
        if (count > 1) {
          tile.dataset.count = String(count - 1);
          // Update label
          tile.innerHTML = '<span>' + char + '</span>';
          const badge = document.createElement('span');
          badge.className = 'letter-count';
          badge.textContent = 'x' + (count - 1);
          tile.appendChild(badge);
        } else {
          tile.remove();
        }

        // Only pick up one per frame
        break;
      }
    }
  }

  /**
   * Update rotation tracking for churning
   */
  updateRotationTracking(dt) {
    if (!this.isPestleInMortar()) {
      this.rotationTracker.totalRotation = 0;
      this.rotationTracker.rotationsCompleted = 0;
      return;
    }

    const pestle = this.pestle;
    const mortar = this.mortar;
    const centerX = mortar.x + mortar.width / 2;
    const centerY = mortar.y + mortar.height / 2;

    // Calculate angle from mortar center to pestle head
    const dx = pestle.headX - centerX;
    const dy = pestle.headY - centerY;
    const currentAngle = Math.atan2(dy, dx);

    // Calculate rotation delta
    let angleDelta = currentAngle - this.rotationTracker.prevAngle;

    // Normalize angle delta to [-π, π]
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;

    // Accumulate rotation
    this.rotationTracker.totalRotation += angleDelta;
    this.rotationTracker.prevAngle = currentAngle;

    // Check for complete rotation (2π radians)
    const fullRotation = Math.PI * 2;
    if (Math.abs(this.rotationTracker.totalRotation) >= fullRotation) {
      this.rotationTracker.rotationsCompleted++;
      this.rotationTracker.totalRotation = 0;

      // Produce ink if we have letters attached
      if (this.pestle.attachedLetters.length > 0 && pestle.churnCooldown <= 0) {
        pestle.churnCooldown = 0.3;
        const letter = this.pestle.attachedLetters.pop();

        // Spawn ink drop effect
        this.spawnInkDrop(pestle.headX, pestle.headY);

        // Callback for ink production
        if (this.onInkProduced) {
          this.onInkProduced(letter);
        }
      }
    }
  }

  /**
   * Spawn ink drop visual effect
   */
  spawnInkDrop(x, y) {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      this.inkDrops.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 0.6,
        age: 0,
      });
    }
  }

  /**
   * Update pestle physics
   */
  updatePestle(dt) {
    const pestle = this.pestle;
    const g = this.gravity;
    const friction = this.airFriction;

    pestle.churnCooldown = Math.max(0, pestle.churnCooldown - dt);

    const x = pestle.headX;
    const y = pestle.headY;
    const prevX = pestle.prevHeadX;
    const prevY = pestle.prevHeadY;
    const safeDt = Math.max(dt, 0.0001);

    let vx = (x - prevX) / safeDt;
    let vy = (y - prevY) / safeDt;

    vx *= friction;
    vy *= friction;

    pestle.prevHeadX = x;
    pestle.prevHeadY = y;

    vy += g * safeDt;

    pestle.headX += vx * safeDt;
    pestle.headY += vy * safeDt;

    const px = pestle.pivotX;
    const py = pestle.pivotY;
    let dx = pestle.headX - px;
    let dy = pestle.headY - py;
    let dist = Math.hypot(dx, dy) || 1;
    const desired = pestle.length;
    const diff = (desired - dist) / dist;

    pestle.headX += dx * diff;
    pestle.headY += dy * diff;

    pestle.headVx = (pestle.headX - pestle.prevHeadX) / safeDt;
    pestle.headVy = (pestle.headY - pestle.prevHeadY) / safeDt;
    pestle.angle = Math.atan2(pestle.headY - pestle.pivotY, pestle.headX - pestle.pivotX) + Math.PI / 2;
  }

  /**
   * Update physics simulation
   */
  update(dt) {
    this.updatePestle(dt);

    // Check for letter pickup
    if (this.pestle.attachedLetters.length < 10) {
      this.checkLetterPickup();
    }

    // Update rotation tracking for churning
    this.updateRotationTracking(dt);

    // Update ink drops
    this.inkDrops = this.inkDrops.filter(d => d.age < d.life);
    for (const d of this.inkDrops) {
      d.age += dt;
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 15 * dt;
    }
  }

  /**
   * Draw pestle
   */
  drawPestle(ctx, pestle) {
    ctx.save();
    const pivotX = pestle.pivotX;
    const pivotY = pestle.pivotY;
    const dx = pestle.headX - pivotX;
    const dy = pestle.headY - pivotY;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    const length = Math.hypot(dx, dy) || pestle.length;

    ctx.translate(pivotX, pivotY);
    ctx.rotate(angle);

    // Handle
    const handleWidth = pestle.handleThickness;
    const handleLength = length * 0.7;
    const handleGradient = ctx.createLinearGradient(0, -length, 0, -handleLength);
    handleGradient.addColorStop(0, '#fbbf24');
    handleGradient.addColorStop(1, '#92400e');
    ctx.fillStyle = handleGradient;
    ctx.fillRect(-handleWidth / 2, -length, handleWidth, handleLength);

    // Pestle head (rounded bottom)
    const headWidth = pestle.width;
    const headHeight = length * 0.3;
    ctx.translate(0, -length + handleLength);

    const headGradient = ctx.createLinearGradient(-headWidth / 2, 0, headWidth / 2, headHeight);
    headGradient.addColorStop(0, '#d1d5db');
    headGradient.addColorStop(1, '#6b7280');
    ctx.fillStyle = headGradient;

    // Draw rounded pestle head
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

      // Show count if more than 3
      if (letterCount > 3) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px system-ui';
        ctx.fillText(`+${letterCount - 3}`, 0, headHeight + 10);
      }
    }

    ctx.restore();
  }

  /**
   * Draw mortar
   */
  drawMortar(ctx, mortar) {
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

    // Highlight on rim
    ctx.strokeStyle = 'rgba(248,250,252,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mortar.width * 0.2, 5);
    ctx.lineTo(mortar.width * 0.8, 5);
    ctx.stroke();

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

  /**
   * Render frame
   */
  render() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw mortar
    this.drawMortar(this.ctx, this.mortar);

    // Draw pestle
    this.drawPestle(this.ctx, this.pestle);

    // Draw ink drops
    this.drawInkDrops(this.ctx, this.inkDrops);
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
   * Start the pestle system
   */
  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = 0;
      requestAnimationFrame(this.loop);
    }
  }

  /**
   * Stop the pestle system
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
