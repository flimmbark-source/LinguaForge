/**
 * LINGUA FORGE - CHIP PHYSICS SYSTEM
 * Physics-based word chips that pop out of molds and settle on screen
 */

import { isHearthHeated, getHearthBounds } from './RuneHearth.js?v=9';
import { gameState, addLetters } from './state.js?v=9';
import { placeWordInVerse } from './grammar.js?v=9';
import { spawnResourceGain } from './resourceGainFeedback.js?v=9';

export class ChipSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Array of chip objects
    this.chips = [];
    this.nextChipId = 1;

    // Physics constants
    this.friction = 0.9; // Friction coefficient (no gravity)
    this.wallBounceDamping = 0.6; // Energy loss on wall collisions
    this.chipCollisionDamping = 0.95; // Energy loss on chip-to-chip collisions
    this.maxSpeed = 100

    // Drag state
    this.draggedChip = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartTime = 0;
    this.hasMoved = false;
    this.setScreenLocked = (locked) => {
      if (window.innerWidth > 900) return;
      if (!document.body) return;
      document.body.classList.toggle('screen-locked', locked);
    };

    // Callbacks
    this.onChipHeated = null; // Called when chip is heated
    this.onUpdate = null; // Called when state changes

    // Ghost preview for verse placement
    this.ghostPreview = null;

    // Bind methods
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for chip dragging
   */
  setupEventListeners() {
    // Listen on document to capture events even when canvas has pointer-events: none
    document.addEventListener('mousedown', this.onPointerDown);
    document.addEventListener('mousemove', this.onPointerMove);
    document.addEventListener('mouseup', this.onPointerUp);
    document.addEventListener('touchstart', this.onPointerDown, { passive: false });
    document.addEventListener('touchmove', this.onPointerMove, { passive: false });
    document.addEventListener('touchend', this.onPointerUp);
  }

  /**
   * Spawn a new chip from the mold viewport
   */
  spawnChip(word, moldViewportBounds) {
    // Get mold viewport position
    const canvasRect = this.canvas.getBoundingClientRect();
    const moldCenterX = moldViewportBounds.left + moldViewportBounds.width / 2 - canvasRect.left;
    const moldTopY = moldViewportBounds.top - canvasRect.top;

    // Launch chip upward from mold viewport
    const launchSpeed = 400; // px/s upward
    const spreadX = (Math.random() - 0.5) * 200; // Random horizontal spread

    const chip = {
      id: this.nextChipId++,
      word: word, // { id, text, english, length, power }
      x: moldCenterX,
      y: moldTopY,
      vx: spreadX,
      vy: -launchSpeed,
      width: 80,
      height: 32,
      angle: 0,
      angularVel: (Math.random() - 0.5) * 8, // rad/s
      isSettled: false,
      heatLevel: 0, // 0 = not heated, 1 = heated (ready for verse)
      heatingProgress: 0, // 0 to 1 (0% to 100%)
      heatingTime: 0, // Time spent heating (in seconds)
      heatingDuration: 4, // Total time to heat up (4 seconds)
      sparks: [], // Array of spark objects
      isDraggable: true
    };

    this.chips.push(chip);

    // Grant renown equal to 2x letters used
    const renownGained = word.length * 2;
    addLetters(renownGained);

    // Spawn resource gain feedback at mold viewport position
    const screenX = canvasRect.left + moldCenterX;
    const screenY = canvasRect.top + moldTopY;
    spawnResourceGain(screenX, screenY, renownGained, 'renown');

    console.log(`Chip created: "${word.text}" - Gained ${renownGained} renown (${word.length} letters × 2)`);
  }

  /**
   * Update chip physics
   */
  update(dt) {
    const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);

    for (const chip of this.chips) {
      if (this.draggedChip === chip) {
        // Chip is being dragged, no physics
        continue;
      }

      // Apply friction (no gravity)
      chip.vx *= this.friction;
      chip.vy *= this.friction;

      // Keep speed within cap before integrating position so the limit is perceptible
      this.clampChipVelocity(chip);

      // Stop if velocity is very small
      const speedSq = chip.vx * chip.vx + chip.vy * chip.vy;
      if (speedSq < 1) {
        chip.vx = 0;
        chip.vy = 0;
        chip.angularVel = 0;
        chip.isSettled = true;
      }

      // Update position
      chip.x += chip.vx * dt;
      chip.y += chip.vy * dt;

      // Update rotation
      chip.angle += chip.angularVel * dt;

      // Wall collisions with bounce
      const halfWidth = chip.width / 2;
      const halfHeight = chip.height / 2;

      // Left wall
      if (chip.x - halfWidth < 0) {
        chip.x = halfWidth;
        chip.vx = Math.abs(chip.vx) * this.wallBounceDamping;
      }

      // Right wall
      if (chip.x + halfWidth > canvasWidth) {
        chip.x = canvasWidth - halfWidth;
        chip.vx = -Math.abs(chip.vx) * this.wallBounceDamping;
      }

      // Top wall
      if (chip.y - halfHeight < 0) {
        chip.y = halfHeight;
        chip.vy = Math.abs(chip.vy) * this.wallBounceDamping;
      }

      // Bottom wall
      if (chip.y + halfHeight > canvasHeight) {
        chip.y = canvasHeight - halfHeight;
        chip.vy = -Math.abs(chip.vy) * this.wallBounceDamping;
      }

      // Check if chip is over hearth and update heating
      this.updateChipHeating(chip, dt);

      // Update sparks on chip
      this.updateChipSparks(chip, dt);
    }

    // Simple chip-to-chip collision detection
    for (let i = 0; i < this.chips.length; i++) {
      for (let j = i + 1; j < this.chips.length; j++) {
        const a = this.chips[i];
        const b = this.chips[j];

        // Skip if either is being dragged
        if (this.draggedChip === a || this.draggedChip === b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (a.width + b.width) / 2;

        if (dist < minDist && dist > 0) {
          // Collision! Push apart and exchange some velocity
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate chips
          const maxSeparationPerFrame = 18; // limit in px to keep motion sane even in deep overlap
          const separation = Math.min(overlap, maxSeparationPerFrame);
          a.x -= nx * separation * 0.5;
          a.y -= ny * separation * 0.5;
          b.x += nx * separation * 0.5;
          b.y += ny * separation * 0.5;

          // Exchange velocity
          const relVx = b.vx - a.vx;
          const relVy = b.vy - a.vy;
          const relSpeed = relVx * nx + relVy * ny;

          if (relSpeed < 0) {
            const impulse = relSpeed * this.chipCollisionDamping;
            a.vx -= nx * impulse;
            a.vy -= ny * impulse;
            b.vx += nx * impulse;
            b.vy += ny * impulse;
            a.vx *= 0.9;
            a.vy *= 0.9;
            b.vx *= 0.9;
            b.vy *= 0.9;
          }

          this.clampChipVelocity(a);
          this.clampChipVelocity(b);
        }
      }
    }

    // Final velocity clamp to prevent runaway speeds
    for (const chip of this.chips) {
      this.clampChipVelocity(chip);
    }
  }

  /**
   * Prevent chips from exceeding maximum speed
   */
  clampChipVelocity(chip) {
    const speed = Math.sqrt(chip.vx * chip.vx + chip.vy * chip.vy);
    if (speed > this.maxSpeed) {
      const scale = this.maxSpeed / speed;
      chip.vx *= scale;
      chip.vy *= scale;
    }
  }

  /**
   * Check if point is inside chip
   */
  isPointInChip(chip, px, py) {
    // Simple rectangular hit test (could be improved with rotation)
    const dx = px - chip.x;
    const dy = py - chip.y;
    return Math.abs(dx) < chip.width / 2 && Math.abs(dy) < chip.height / 2;
  }

  /**
   * Update chip heating progress when over hearth
   */
  updateChipHeating(chip, dt) {
    if (chip.heatLevel >= 1) return; // Already fully heated

    // Check if chip is over hearth
    const canvasRect = this.canvas.getBoundingClientRect();
    const chipViewportX = canvasRect.left + chip.x;
    const chipViewportY = canvasRect.top + chip.y;

    const hearthBounds = getHearthBounds();
    if (!hearthBounds) return;

    const isOverHearth =
      chipViewportX > hearthBounds.left &&
      chipViewportX < hearthBounds.right &&
      chipViewportY > hearthBounds.top &&
      chipViewportY < hearthBounds.bottom;

    if (isOverHearth && isHearthHeated()) {
      const previousProgress = chip.heatingProgress;

      // Increment heating time
      chip.heatingTime += dt;
      chip.heatingProgress = Math.min(1, chip.heatingTime / chip.heatingDuration);

      // Check for spark thresholds (25%, 50%, 75%, 100%)
      const thresholds = [0.25, 0.5, 0.75, 1.0];
      for (const threshold of thresholds) {
        if (previousProgress < threshold && chip.heatingProgress >= threshold) {
          // Add a spark at this threshold
          this.addSparkToChip(chip);
        }
      }

      // If fully heated, set heat level
      if (chip.heatingProgress >= 1) {
        chip.heatLevel = 1;
        console.log(`Chip "${chip.word.text}" fully heated - ready for verse!`);
        if (this.onChipHeated) {
          this.onChipHeated(chip);
        }
        if (this.onUpdate) {
          this.onUpdate();
        }
      }
    }
  }

  /**
   * Add a spark to a chip
   */
  addSparkToChip(chip) {
    const spark = {
      x: (Math.random() - 0.5) * chip.width * 0.6,
      y: (Math.random() - 0.5) * chip.height * 0.6,
      age: 0,
      lifetime: 4, // Fade over 4 seconds
      size: 3 + Math.random() * 2
    };
    chip.sparks.push(spark);
  }

  /**
   * Update sparks on a chip (age and remove old ones)
   */
  updateChipSparks(chip, dt) {
    // Age all sparks
    for (const spark of chip.sparks) {
      spark.age += dt;
    }

    // Remove sparks that have exceeded their lifetime
    chip.sparks = chip.sparks.filter(spark => spark.age < spark.lifetime);
  }

  /**
   * Handle pointer down
   */
  onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Find chip under pointer (reverse order to get top chip)
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const chip = this.chips[i];
      if (this.isPointInChip(chip, canvasX, canvasY)) {
        this.draggedChip = chip;
        this.dragOffsetX = canvasX - chip.x;
        this.dragOffsetY = canvasY - chip.y;
        this.isDragging = true;
        this.dragStartX = canvasX;
        this.dragStartY = canvasY;
        this.dragStartTime = performance.now();
        this.hasMoved = false;

        // Stop chip motion when grabbed
        chip.vx = 0;
        chip.vy = 0;
        chip.angularVel = 0;
        this.setScreenLocked(true);

        e.preventDefault();
        return;
      }
    }
  }

  /**
   * Handle pointer move
   */
  onPointerMove(e) {
    if (!this.isDragging || !this.draggedChip) return;

    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Check if pointer has moved significantly (more than 5 pixels)
    const dx = canvasX - this.dragStartX;
    const dy = canvasY - this.dragStartY;
    const distSq = dx * dx + dy * dy;
    if (distSq > 25) { // 5 pixels
      this.hasMoved = true;
    }

    this.draggedChip.x = canvasX - this.dragOffsetX;
    this.draggedChip.y = canvasY - this.dragOffsetY;

    // Show ghost preview if dragging a heated chip over verse area
    if (this.draggedChip.heatLevel >= 1) {
      this.updateGhostPreview(clientX, clientY);
    } else {
      this.removeGhostPreview();
    }

    e.preventDefault();
  }

  /**
   * Handle pointer up
   */
  onPointerUp(e) {
    if (!this.isDragging || !this.draggedChip) return;

    const chip = this.draggedChip;
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
    const clientY = e.clientY || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : 0);

    // Check if this was a click (not a drag)
    const timeDiff = performance.now() - this.dragStartTime;
    if (!this.hasMoved && timeDiff < 300) {
      // It was a click! Align chip to horizontal
      chip.angle = 0;
      chip.angularVel = 0;
      console.log(`Chip "${chip.word.text}" aligned to horizontal`);
      this.isDragging = false;
      this.draggedChip = null;
      this.setScreenLocked(false);
      e.preventDefault();
      return;
    }

    // Check if dropped over hearth
    if (this.checkHearthDrop(clientX, clientY, chip)) {
      // Chip was dropped in hearth for heating
      this.isDragging = false;
      this.draggedChip = null;
      this.setScreenLocked(false);
      e.preventDefault();
      return;
    }

    // Check if trying to drop in verse area
    const verseArea = document.getElementById('grammarHebrewLine');
    if (verseArea) {
      const verseBounds = verseArea.getBoundingClientRect();
      const isOverVerse =
        clientX > verseBounds.left &&
        clientX < verseBounds.right &&
        clientY > verseBounds.top &&
        clientY < verseBounds.bottom;

      if (isOverVerse) {
        if (chip.heatLevel >= 1) {
          // Chip is heated, place in verse
          if (this.checkVerseDrop(clientX, clientY, chip)) {
            // Chip was placed in verse, remove from chips
            this.removeChip(chip.id);
            this.isDragging = false;
            this.draggedChip = null;
            this.setScreenLocked(false);
            e.preventDefault();
            return;
          }
        } else {
          // Chip is not heated, bounce it back with feedback
          console.log(`Chip "${chip.word.text}" must be heated before placing in verse!`);
          chip.vx = (Math.random() - 0.5) * 300;
          chip.vy = -200; // Bounce upward
          chip.angularVel = (Math.random() - 0.5) * 6;
          this.isDragging = false;
          this.draggedChip = null;
          this.setScreenLocked(false);
          e.preventDefault();
          return;
        }
      }
    }

    // Otherwise, let chip settle with small velocity
    chip.vx = (Math.random() - 0.5) * 50;
    chip.vy = (Math.random() - 0.5) * 50;
    chip.angularVel = (Math.random() - 0.5) * 2;

    this.isDragging = false;
    this.draggedChip = null;
    this.setScreenLocked(false);

    // Remove ghost preview
    this.removeGhostPreview();

    e.preventDefault();
  }

  /**
   * Update ghost preview when dragging heated chip over verse
   */
  updateGhostPreview(clientX, clientY) {
    const verseArea = document.getElementById('grammarHebrewLine');
    if (!verseArea) {
      this.removeGhostPreview();
      return;
    }

    const verseBounds = verseArea.getBoundingClientRect();
    const isOverVerse =
      clientX > verseBounds.left &&
      clientX < verseBounds.right &&
      clientY > verseBounds.top &&
      clientY < verseBounds.bottom;

    if (!isOverVerse) {
      this.removeGhostPreview();
      return;
    }

    // Calculate insertion index
    const chips = Array.from(verseArea.children).filter(el =>
      el.classList.contains('line-word-chip') && !el.classList.contains('ghost-preview')
    );

    chips.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    let insertIndex = 0;
    for (const existingChip of chips) {
      const rect = existingChip.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (clientX < midX) {
        break;
      }
      insertIndex++;
    }

    // Create or update ghost preview
    if (!this.ghostPreview) {
      this.ghostPreview = document.createElement('div');
      this.ghostPreview.className = 'line-word-chip ghost-preview';
      this.ghostPreview.style.opacity = '0.4';
      this.ghostPreview.style.pointerEvents = 'none';
      this.ghostPreview.style.border = '2px dashed #f59e0b';
      this.ghostPreview.style.background = '#fef3c7';
    }

    this.ghostPreview.textContent = this.draggedChip.word.text;
    this.ghostPreview.style.direction = 'rtl';

    // Insert ghost at calculated position
    if (this.ghostPreview.parentElement !== verseArea) {
      if (insertIndex >= chips.length) {
        verseArea.appendChild(this.ghostPreview);
      } else {
        verseArea.insertBefore(this.ghostPreview, chips[insertIndex]);
      }
    } else {
      // Move ghost to correct position if needed
      const currentIndex = Array.from(verseArea.children).indexOf(this.ghostPreview);
      if (currentIndex !== insertIndex) {
        if (insertIndex >= chips.length) {
          verseArea.appendChild(this.ghostPreview);
        } else {
          verseArea.insertBefore(this.ghostPreview, chips[insertIndex]);
        }
      }
    }
  }

  /**
   * Remove ghost preview
   */
  removeGhostPreview() {
    if (this.ghostPreview && this.ghostPreview.parentElement) {
      this.ghostPreview.parentElement.removeChild(this.ghostPreview);
    }
    this.ghostPreview = null;
  }

  /**
   * Check if chip was dropped over hearth for heating
   */
  checkHearthDrop(clientX, clientY, chip) {
    const hearthBounds = getHearthBounds();
    if (!hearthBounds) return false;

    const isOverHearth =
      clientX > hearthBounds.left &&
      clientX < hearthBounds.right &&
      clientY > hearthBounds.top &&
      clientY < hearthBounds.bottom;

    if (isOverHearth && isHearthHeated()) {
      // Heat the chip to level 1
      if (chip.heatLevel < 1) {
        chip.heatLevel = 1;
        console.log(`Chip "${chip.word.text}" heated to level 1 - ready for verse!`);
        if (this.onChipHeated) {
          this.onChipHeated(chip);
        }
        if (this.onUpdate) {
          this.onUpdate();
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Check if chip was dropped in verse area
   */
  checkVerseDrop(clientX, clientY, chip) {
    const verseArea = document.getElementById('grammarHebrewLine');
    if (!verseArea) return false;

    const verseBounds = verseArea.getBoundingClientRect();
    const isOverVerse =
      clientX > verseBounds.left &&
      clientX < verseBounds.right &&
      clientY > verseBounds.top &&
      clientY < verseBounds.bottom;

    if (isOverVerse) {
      // Calculate insertion index based on drop position (RTL layout)
      const chips = Array.from(verseArea.children).filter(el =>
        el.classList.contains('line-word-chip')
      );

      // Sort chips by visual position (left to right on screen)
      chips.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

      let insertIndex = 0;

      for (const existingChip of chips) {
        const rect = existingChip.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;

        if (clientX < midX) {
          break;
        }

        insertIndex++;
      }

      // In RTL, state array order is right-to-left but we calculated index left-to-right
      const isRTL = getComputedStyle(verseArea).direction === 'rtl';
      if (isRTL) {
        insertIndex = chips.length - insertIndex;
      }

      // Place word in verse at calculated position
      const success = placeWordInVerse(chip.word.id, insertIndex);
      console.log(`Placed heated chip "${chip.word.text}" in verse at index ${insertIndex}`);
      return success;
    }

    return false;
  }

  /**
   * Remove a chip by ID
   */
  removeChip(chipId) {
    const index = this.chips.findIndex(c => c.id === chipId);
    if (index !== -1) {
      this.chips.splice(index, 1);
      if (this.onUpdate) {
        this.onUpdate();
      }
    }
  }

  /**
   * Render all chips
   */
  render() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    this.ctx.clearRect(0, 0, width, height);

    for (const chip of this.chips) {
      this.renderChip(chip);
    }
  }

  /**
   * Render a single chip
   */
  renderChip(chip) {
    const ctx = this.ctx;
    ctx.save();

    // Translate to chip position
    ctx.translate(chip.x, chip.y);
    ctx.rotate(chip.angle);

    // Determine chip color based on heat level
    let bgColor = '#f3f4f6'; // Gray (unheated)
    let borderColor = '#9ca3af';

    if (chip.heatLevel >= 1) {
      bgColor = '#fef3c7'; // Warm yellow (heated, ready for verse)
      borderColor = '#f59e0b';
    }

    // Draw chip background
    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;

    const halfWidth = chip.width / 2;
    const halfHeight = chip.height / 2;
    const radius = 6;

    // Rounded rectangle
    ctx.beginPath();
    ctx.moveTo(-halfWidth + radius, -halfHeight);
    ctx.lineTo(halfWidth - radius, -halfHeight);
    ctx.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
    ctx.lineTo(halfWidth, halfHeight - radius);
    ctx.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
    ctx.lineTo(-halfWidth + radius, halfHeight);
    ctx.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
    ctx.lineTo(-halfWidth, -halfHeight + radius);
    ctx.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw Hebrew text
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px "Noto Sans Hebrew", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(chip.word.text, 0, 0);

    // Draw sparks
    for (const spark of chip.sparks) {
      const opacity = 1 - (spark.age / spark.lifetime);
      ctx.fillStyle = `rgba(251, 191, 36, ${opacity})`;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow
      ctx.fillStyle = `rgba(254, 243, 199, ${opacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Get chip by word ID
   */
  getChipByWordId(wordId) {
    return this.chips.find(c => c.word.id === wordId);
  }
}
