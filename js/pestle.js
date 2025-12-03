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
      constantLength: 140, // Fixed length - doesn't change
      width: 30,
      handleThickness: 12,
      angle: 0,
      headVx: 0,
      headVy: 0,
      isHeld: false,
      isInserted: false, // Whether pestle is inserted into mortar
      isFollowingMouse: false, // Whether pestle follows mouse cursor
      attachedLetters: [], // Letters picked up by pestle
      churnCooldown: 0,
      clickStartTime: 0, // Track when click started
    };

    // Mortar state
    this.mortar = {
      x: 0,
      y: 0,
      width: 200,
      height: 80,
      innerRadius: 70,
    };

    // Side-to-side motion tracking for churning
    this.churnTracker = {
      prevX: 0,
      direction: 0, // -1 for left, 1 for right, 0 for stationary
      totalDistance: 0, // Total horizontal distance traveled
      churnThreshold: 60, // Pixels of side-to-side motion needed for 1 ink
    };

    // Visual effects
    this.inkDrops = [];

    // Input state
    this.input = {
      mouseX: 0,
      mouseY: 0,
      isDown: false,
      downTime: 0, // Time when mouse was pressed
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
    this.pestle.constantLength = 140;

    // Start with pestle hanging down
    this.pestle.headX = pivotX;
    this.pestle.headY = pivotY + this.pestle.constantLength;
    this.pestle.prevHeadX = this.pestle.headX;
    this.pestle.prevHeadY = this.pestle.headY;
    this.pestle.angle = Math.PI / 2;
    this.pestle.headVx = 0;
    this.pestle.headVy = 0;
    this.pestle.isInserted = false;
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

    // If pestle is inserted, only allow grabbing the top handle
    if (p.isInserted) {
      const dist = Math.hypot(px - p.pivotX, py - p.pivotY);
      return dist < 40;
    }

    // Otherwise, can grab anywhere along pestle
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
   * Check if point is over mortar
   */
  isPointOverMortar(px, py) {
    const mortar = this.mortar;
    return (
      px > mortar.x &&
      px < mortar.x + mortar.width &&
      py > mortar.y &&
      py < mortar.y + mortar.height
    );
  }

  /**
   * Handle pointer down event
   */
  onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const client = e.touches ? e.touches[0] : e;
    this.input.mouseX = client.clientX - rect.left;
    this.input.mouseY = client.clientY - rect.top;
    this.input.downTime = Date.now();

    const pestle = this.pestle;

    // Check if clicking on mortar while pestle is following mouse
    if (pestle.isFollowingMouse && this.isPointOverMortar(this.input.mouseX, this.input.mouseY)) {
      e.preventDefault();
      e.stopPropagation();

      // Insert pestle into mortar
      pestle.isFollowingMouse = false;
      pestle.isInserted = true;
      const centerX = this.mortar.x + this.mortar.width / 2;
      const mortarTop = this.mortar.y - 40; // Start higher up
      pestle.pivotX = centerX;
      pestle.pivotY = mortarTop;
      pestle.headX = centerX;
      pestle.headY = mortarTop + pestle.constantLength;
      pestle.prevHeadX = pestle.headX;
      pestle.prevHeadY = pestle.headY;
      this.churnTracker.prevX = centerX;
      console.log('Pestle inserted into mortar via click');
      return;
    }

    // Only handle if near pestle
    if (this.isPointNearPestle(this.input.mouseX, this.input.mouseY)) {
      e.preventDefault();
      e.stopPropagation();

      this.input.isDown = true;
      pestle.isHeld = true;
      pestle.clickStartTime = Date.now();

      // If pestle is inserted, track for click vs hold detection
      if (pestle.isInserted) {
        // Will determine if click or hold in onPointerUp
        this.churnTracker.prevX = this.input.mouseX;
      } else if (!pestle.isFollowingMouse) {
        // Free movement - move the pivot point
        pestle.pivotX = this.input.mouseX;
        pestle.pivotY = this.input.mouseY;
      }
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

    const pestle = this.pestle;

    // If pestle is following mouse, update pivot position
    if (pestle.isFollowingMouse) {
      pestle.pivotX = this.input.mouseX;
      pestle.pivotY = this.input.mouseY;
    }

    if (pestle.isHeld && this.input.isDown) {
      e.preventDefault();
      e.stopPropagation();

      const clickDuration = Date.now() - pestle.clickStartTime;

      if (pestle.isInserted) {
        // If held for > 200ms, enable churning mode
        if (clickDuration > 200) {
          // Churning mode - only allow horizontal movement
          pestle.pivotX = this.input.mouseX;
          // Keep pivot Y fixed at mortar level
        }
      } else if (!pestle.isFollowingMouse) {
        // Free movement
        pestle.pivotX = this.input.mouseX;
        pestle.pivotY = this.input.mouseY;
      }
    }
  }

  /**
   * Handle pointer up event
   */
  onPointerUp(e) {
    const pestle = this.pestle;

    if (pestle.isHeld) {
      e.preventDefault();
      e.stopPropagation();

      const clickDuration = Date.now() - pestle.clickStartTime;

      // If inserted and it was a quick click (< 200ms), separate pestle
      if (pestle.isInserted && clickDuration < 200) {
        pestle.isInserted = false;
        pestle.isFollowingMouse = true;
        pestle.pivotX = this.input.mouseX;
        pestle.pivotY = this.input.mouseY;
        console.log('Pestle separated from mortar - now following mouse');
      }
    }

    this.input.isDown = false;
    pestle.isHeld = false;
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
   * Check if pestle is in churn zone (deep enough in mortar)
   */
  isPestleInChurnZone() {
    const pestle = this.pestle;
    const mortar = this.mortar;
    const pivotY = pestle.pivotY;
    const churnZoneTop = mortar.y + mortar.height * 0.3;

    // Pestle must be inserted and pivot must be below churn zone top
    return pestle.isInserted && pivotY >= churnZoneTop;
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
   * Update side-to-side motion tracking for churning
   */
  updateChurnTracking(dt) {
    if (!this.isPestleInChurnZone()) {
      this.churnTracker.totalDistance = 0;
      this.churnTracker.direction = 0;
      return;
    }

    const pestle = this.pestle;
    const currentX = pestle.pivotX;
    const prevX = this.churnTracker.prevX;
    const deltaX = currentX - prevX;

    // Only track significant movement (> 1px)
    if (Math.abs(deltaX) > 1) {
      const newDirection = deltaX > 0 ? 1 : -1;

      // Check for direction change (side-to-side motion)
      if (this.churnTracker.direction !== 0 && newDirection !== this.churnTracker.direction) {
        // Direction changed - add to total distance
        this.churnTracker.totalDistance += Math.abs(deltaX);
      }

      this.churnTracker.direction = newDirection;
      this.churnTracker.prevX = currentX;

      // Check if we've churned enough for ink
      if (this.churnTracker.totalDistance >= this.churnTracker.churnThreshold) {
        // Produce ink if we have letters attached
        if (pestle.attachedLetters.length > 0 && pestle.churnCooldown <= 0) {
          pestle.churnCooldown = 0.3;
          const letter = pestle.attachedLetters.pop();
          this.churnTracker.totalDistance = 0;

          // Spawn ink drop effect
          this.spawnInkDrop(pestle.headX, pestle.headY);

          // Callback for ink production
          if (this.onInkProduced) {
            this.onInkProduced(letter);
          }
        } else {
          this.churnTracker.totalDistance = 0;
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
    const mortar = this.mortar;

    pestle.churnCooldown = Math.max(0, pestle.churnCooldown - dt);

    // Check if pestle should be inserted (only if not following mouse)
    if (!pestle.isInserted && !pestle.isFollowingMouse && this.isPestleInMortar()) {
      // Insert pestle into mortar
      pestle.isInserted = true;
      const centerX = mortar.x + mortar.width / 2;
      const mortarTop = mortar.y - 40; // Start higher up
      pestle.pivotX = centerX;
      pestle.pivotY = mortarTop;
      pestle.headX = centerX;
      pestle.headY = mortarTop + pestle.constantLength;
      pestle.prevHeadX = pestle.headX;
      pestle.prevHeadY = pestle.headY;
      this.churnTracker.prevX = centerX;
      console.log('Pestle inserted into mortar');
    } else if (pestle.isInserted && pestle.isHeld && pestle.pivotY < mortar.y - 50) {
      // Lift pestle out of mortar (needs to go higher now)
      pestle.isInserted = false;
      pestle.isFollowingMouse = true;
      console.log('Pestle removed from mortar via lifting');
    }

    if (pestle.isInserted) {
      // Pestle is inserted - constrain to mortar
      const centerX = mortar.x + mortar.width / 2;
      const mortarTop = mortar.y - 40; // Higher up for extended handle

      // Constrain horizontal movement
      const maxOffset = 40;
      pestle.pivotX = Math.max(centerX - maxOffset, Math.min(centerX + maxOffset, pestle.pivotX));

      // Keep vertical position at mortar top unless being lifted
      if (pestle.isHeld) {
        pestle.pivotY = pestle.pivotY; // Can be moved up/down when held
      } else {
        pestle.pivotY = mortarTop;
      }

      // Head position is directly below pivot at constant length
      pestle.headX = pestle.pivotX;
      pestle.headY = pestle.pivotY + pestle.constantLength;
      pestle.prevHeadX = pestle.headX;
      pestle.prevHeadY = pestle.headY;
    } else if (pestle.isFollowingMouse) {
      // Following mouse - maintain constant length vertically
      pestle.headX = pestle.pivotX;
      pestle.headY = pestle.pivotY + pestle.constantLength;
      pestle.prevHeadX = pestle.headX;
      pestle.prevHeadY = pestle.headY;
    } else {
      // Free movement with physics
      if (!pestle.isHeld) {
        const g = this.gravity;
        const friction = this.airFriction;
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
      }

      // Maintain constant length constraint
      const px = pestle.pivotX;
      const py = pestle.pivotY;
      const dx = pestle.headX - px;
      const dy = pestle.headY - py;
      const dist = Math.hypot(dx, dy);

      if (dist > 0) {
        const scale = pestle.constantLength / dist;
        pestle.headX = px + dx * scale;
        pestle.headY = py + dy * scale;
      }
    }

    pestle.angle = Math.atan2(pestle.headY - pestle.pivotY, pestle.headX - pestle.pivotX) + Math.PI / 2;
  }

  /**
   * Update physics simulation
   */
  update(dt) {
    this.updatePestle(dt);

    // Check for letter pickup (only when not inserted)
    if (!this.pestle.isInserted && this.pestle.attachedLetters.length < 10) {
      this.checkLetterPickup();
    }

    // Update side-to-side motion tracking for churning
    this.updateChurnTracking(dt);

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
    // Don't draw pestle separately if it's inserted (will be drawn with mortar)
    if (pestle.isInserted) return;

    ctx.save();
    const pivotX = pestle.pivotX;
    const pivotY = pestle.pivotY;
    const dx = pestle.headX - pivotX;
    const dy = pestle.headY - pivotY;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    const length = pestle.constantLength;

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
   * Draw mortar (and pestle if inserted)
   */
  drawMortar(ctx, mortar) {
    const pestle = this.pestle;

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

    // If pestle is inserted, draw it inside the mortar
    if (pestle.isInserted) {
      const centerX = mortar.width / 2;
      const pestleOffsetX = pestle.pivotX - (mortar.x + centerX);
      const pestleTop = pestle.pivotY - mortar.y;

      // Draw pestle handle sticking out (extended more)
      const handleWidth = pestle.handleThickness;
      const visibleHandleLength = Math.max(50, pestleTop); // Minimum 50px visible

      ctx.fillStyle = '#92400e';
      ctx.fillRect(centerX + pestleOffsetX - handleWidth / 2, 0, handleWidth, visibleHandleLength);

      // Draw handle top (grab point)
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(centerX + pestleOffsetX, 0, handleWidth * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

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
