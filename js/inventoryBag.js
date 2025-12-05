/**
 * LINGUA FORGE - INVENTORY BAG SYSTEM
 * Manages the draggable inventory bag and letter pool pop-up
 */

import { gameState } from './state.js';
import { createLetterTile, updateLetterTileLabel } from './letters.js';

export class InventoryBagSystem {
  constructor() {
    // Bag state
    this.bag = {
      x: 50, // Start position in left of bottom bar
      y: 0, // Will be set based on window height
      width: 80,
      height: 80,
      isDragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      dragStartX: 0,
      dragStartY: 0,
      dragStartTime: 0,
      hasMoved: false
    };

    // Pop-up state
    this.popupOpen = false;
    this.popupElement = null;

    // DOM elements
    this.containerElement = null;
    this.bagElement = null;
    this.labelElement = null;

    // Callbacks
    this.onUpdate = null;

    // Bind methods
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.closePopup = this.closePopup.bind(this);
  }

  /**
   * Initialize the inventory bag
   */
  initialize() {
    // Position bag at left of bottom bar
    this.bag.y = window.innerHeight - 160 - this.bag.height / 2;

    // Create container
    this.containerElement = document.createElement('div');
    this.containerElement.id = 'inventoryBagContainer';
    this.containerElement.style.position = 'fixed';
    this.containerElement.style.zIndex = '200';
    this.updateBagPosition();
    document.body.appendChild(this.containerElement);

    // Create label
    this.labelElement = document.createElement('div');
    this.labelElement.textContent = 'Letter Blocks';
    this.labelElement.style.position = 'absolute';
    this.labelElement.style.top = '-10px';
    this.labelElement.style.left = '50%';
    this.labelElement.style.transform = 'translateX(-50%)';
    this.labelElement.style.fontSize = '12px';
    this.labelElement.style.fontWeight = 'bold';
    this.labelElement.style.color = '#f3f4f6';
    this.labelElement.style.textAlign = 'center';
    this.labelElement.style.whiteSpace = 'nowrap';
    this.labelElement.style.pointerEvents = 'none';
    this.containerElement.appendChild(this.labelElement);

    // Create bag image
    this.bagElement = document.createElement('img');
    this.bagElement.src = '/Public/InventoryBag.png';
    this.bagElement.style.width = this.bag.width + 'px';
    this.bagElement.style.height = this.bag.height + 'px';
    this.bagElement.style.cursor = 'pointer';
    this.bagElement.style.userSelect = 'none';
    this.bagElement.style.display = 'block';
    this.containerElement.appendChild(this.bagElement);

    // Setup event listeners
    this.setupEventListeners();

    console.log('Inventory bag system initialized');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.bagElement.addEventListener('mousedown', this.onPointerDown);
    this.bagElement.addEventListener('touchstart', this.onPointerDown, { passive: false });
    document.addEventListener('mousemove', this.onPointerMove);
    document.addEventListener('touchmove', this.onPointerMove, { passive: false });
    document.addEventListener('mouseup', this.onPointerUp);
    document.addEventListener('touchend', this.onPointerUp);
  }

  /**
   * Update bag position
   */
  updateBagPosition() {
    if (!this.containerElement) return;
    this.containerElement.style.left = (this.bag.x - this.bag.width / 2) + 'px';
    this.containerElement.style.top = (this.bag.y - this.bag.height / 2) + 'px';
  }

  /**
   * Handle pointer down
   */
  onPointerDown(e) {
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    this.bag.isDragging = true;
    this.bag.dragOffsetX = clientX - this.bag.x;
    this.bag.dragOffsetY = clientY - this.bag.y;
    this.bag.dragStartX = clientX;
    this.bag.dragStartY = clientY;
    this.bag.dragStartTime = performance.now();
    this.bag.hasMoved = false;

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle pointer move
   */
  onPointerMove(e) {
    if (!this.bag.isDragging) return;

    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    // Check if pointer has moved significantly
    const dx = clientX - this.bag.dragStartX;
    const dy = clientY - this.bag.dragStartY;
    const distSq = dx * dx + dy * dy;
    if (distSq > 25) {
      this.bag.hasMoved = true;
    }

    // Update bag position
    this.bag.x = clientX - this.bag.dragOffsetX;
    this.bag.y = clientY - this.bag.dragOffsetY;

    // Constrain to screen bounds
    const margin = 10;
    this.bag.x = Math.max(this.bag.width / 2 + margin, Math.min(window.innerWidth - this.bag.width / 2 - margin, this.bag.x));
    this.bag.y = Math.max(this.bag.height / 2 + margin, Math.min(window.innerHeight - this.bag.height / 2 - margin, this.bag.y));

    this.updateBagPosition();

    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle pointer up
   */
  onPointerUp(e) {
    if (!this.bag.isDragging) return;

    const timeDiff = performance.now() - this.bag.dragStartTime;

    // Check if this was a click (not a drag)
    if (!this.bag.hasMoved && timeDiff < 300) {
      // Toggle popup
      if (this.popupOpen) {
        this.closePopup();
      } else {
        this.openPopup();
      }
    }

    this.bag.isDragging = false;
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Open letter pool popup
   */
  openPopup() {
    if (this.popupOpen) return;

    // Create popup element
    this.popupElement = document.createElement('div');
    this.popupElement.id = 'letterPoolPopup';
    this.popupElement.style.position = 'fixed';
    this.popupElement.style.width = '300px';
    this.popupElement.style.maxHeight = '400px';
    this.popupElement.style.background = 'linear-gradient(135deg, #3a2817 0%, #2d1f13 100%)';
    this.popupElement.style.border = '3px solid #92400e';
    this.popupElement.style.borderRadius = '12px';
    this.popupElement.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 2px 8px rgba(255, 255, 255, 0.1)';
    this.popupElement.style.padding = '16px';
    this.popupElement.style.zIndex = '1000';
    this.popupElement.style.overflowY = 'auto';

    // Position popup - bottom right corner aligned with bottom right of bag
    const bagRight = this.bag.x + this.bag.width / 2;
    const bagBottom = this.bag.y + this.bag.height / 2;
    let popupLeft = bagRight; // Bottom right corner of popup at bottom right of bag
    let popupTop = bagBottom;

    // Ensure popup stays on screen
    const margin = 10;
    popupLeft = Math.max(margin, Math.min(window.innerWidth - 300 - margin, popupLeft));
    popupTop = Math.max(margin, Math.min(window.innerHeight - 400 - margin, popupTop));

    this.popupElement.style.left = popupLeft + 'px';
    this.popupElement.style.top = popupTop + 'px';

    // Create header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '12px';

    const title = document.createElement('h3');
    title.textContent = 'Letter Blocks';
    title.style.margin = '0';
    title.style.color = '#fbbf24';
    title.style.fontSize = '16px';
    header.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#f3f4f6';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.width = '24px';
    closeBtn.style.height = '24px';
    closeBtn.style.lineHeight = '24px';
    closeBtn.addEventListener('click', this.closePopup);
    header.appendChild(closeBtn);

    this.popupElement.appendChild(header);

    // Create letter pool container
    const letterPoolContainer = document.createElement('div');
    letterPoolContainer.id = 'letterPoolPopupContainer';
    letterPoolContainer.style.display = 'flex';
    letterPoolContainer.style.flexWrap = 'wrap';
    letterPoolContainer.style.gap = '8px';
    letterPoolContainer.style.minHeight = '100px';
    this.popupElement.appendChild(letterPoolContainer);

    // Render current letters
    this.renderLetterPool(letterPoolContainer);

    document.body.appendChild(this.popupElement);
    this.popupOpen = true;

    console.log('Letter pool popup opened');
  }

  /**
   * Close letter pool popup
   */
  closePopup() {
    if (!this.popupOpen || !this.popupElement) return;

    this.popupElement.remove();
    this.popupElement = null;
    this.popupOpen = false;

    console.log('Letter pool popup closed');
  }

  /**
   * Render letter pool contents
   */
  renderLetterPool(container) {
    if (!container) return;

    container.innerHTML = '';

    // Get letter pool div from DOM
    const letterPoolDiv = document.getElementById('letterPool');
    if (!letterPoolDiv) return;

    // Clone letter tiles into popup
    const tiles = letterPoolDiv.querySelectorAll('.letter-tile');
    if (tiles.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = '#9ca3af';
      empty.style.fontSize = '12px';
      empty.textContent = 'No letters yet. Strike the anvil to forge letters!';
      container.appendChild(empty);
      return;
    }

    tiles.forEach(tile => {
      const char = tile.dataset.letterChar;
      const count = tile.dataset.count || '1';

      if (char) {
        const newTile = createLetterTile(char, this.onUpdate);
        // Set the count and update the label to show the badge
        newTile.dataset.count = count;
        updateLetterTileLabel(newTile);
        container.appendChild(newTile);
      }
    });
  }

  /**
   * Update popup if open
   */
  updatePopup() {
    if (this.popupOpen && this.popupElement) {
      const container = this.popupElement.querySelector('#letterPoolPopupContainer');
      if (container) {
        this.renderLetterPool(container);
      }
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.containerElement) {
      this.containerElement.remove();
    }
    this.closePopup();
  }
}
