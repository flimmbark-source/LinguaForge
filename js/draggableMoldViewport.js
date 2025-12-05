/**
 * LINGUA FORGE - DRAGGABLE MOLD VIEWPORT SYSTEM
 * Makes the mold viewport draggable around the screen
 */

export class DraggableMoldViewport {
  constructor() {
    this.viewport = null;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartTime = 0;
    this.hasMoved = false;

    // Current position
    this.x = 0;
    this.y = 0;

    // Bind methods
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  /**
   * Initialize the draggable viewport
   */
  initialize() {
    this.viewport = document.querySelector('.mold-viewport-bar');
    if (!this.viewport) {
      console.warn('Mold viewport not found');
      return;
    }

    // Make viewport position: fixed so it can move freely
    this.viewport.style.position = 'fixed';

    // Get initial position
    const rect = this.viewport.getBoundingClientRect();
    this.x = rect.left;
    this.y = rect.top;

    // Set initial position
    this.updatePosition();

    // Add cursor style
    this.viewport.style.cursor = 'grab';

    // Setup event listeners on the viewport bar itself
    this.viewport.addEventListener('mousedown', this.onPointerDown);
    this.viewport.addEventListener('touchstart', this.onPointerDown, { passive: false });
    document.addEventListener('mousemove', this.onPointerMove);
    document.addEventListener('touchmove', this.onPointerMove, { passive: false });
    document.addEventListener('mouseup', this.onPointerUp);
    document.addEventListener('touchend', this.onPointerUp);

    console.log('Draggable mold viewport initialized');
  }

  /**
   * Update viewport position
   */
  updatePosition() {
    if (!this.viewport) return;
    this.viewport.style.left = this.x + 'px';
    this.viewport.style.top = this.y + 'px';
  }

  /**
   * Handle pointer down
   */
  onPointerDown(e) {
    // Only drag if clicking on the viewport bar itself, not buttons or mold slots
    if (e.target.tagName === 'BUTTON' ||
        e.target.classList.contains('mold-slot') ||
        e.target.closest('.mold-viewport')) {
      return;
    }

    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    this.isDragging = true;
    this.dragOffsetX = clientX - this.x;
    this.dragOffsetY = clientY - this.y;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.dragStartTime = performance.now();
    this.hasMoved = false;

    if (this.viewport) {
      this.viewport.style.cursor = 'grabbing';
    }

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle pointer move
   */
  onPointerMove(e) {
    if (!this.isDragging) return;

    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    // Check if pointer has moved significantly
    const dx = clientX - this.dragStartX;
    const dy = clientY - this.dragStartY;
    const distSq = dx * dx + dy * dy;
    if (distSq > 25) {
      this.hasMoved = true;
    }

    // Update position
    this.x = clientX - this.dragOffsetX;
    this.y = clientY - this.dragOffsetY;

    // Constrain to screen bounds
    if (this.viewport) {
      const rect = this.viewport.getBoundingClientRect();
      const margin = 10;
      this.x = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, this.x));
      this.y = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, this.y));
    }

    this.updatePosition();

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle pointer up
   */
  onPointerUp(e) {
    if (!this.isDragging) return;

    this.isDragging = false;

    if (this.viewport) {
      this.viewport.style.cursor = 'grab';
    }

    e.preventDefault();
    e.stopPropagation();
  }
}
