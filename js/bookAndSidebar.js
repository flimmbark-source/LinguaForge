/**
 * LINGUA FORGE - MAGIC BOOK & TOOLS SIDEBAR
 * Handles book open/close toggle, dragging, and
 * right-side tools sidebar with drag-out behavior.
 */

// ===============================================
// MAGIC BOOK - Draggable & Toggleable
// ===============================================

let bookDragging = false;
let bookOffsetX = 0;
let bookOffsetY = 0;

/** Check if we're on a mobile-sized screen */
function isMobileScreen() {
  return window.innerWidth <= 768;
}

/**
 * Show the book as a full-screen overlay on mobile.
 * Always opens it (no toggle-close from this function).
 */
function showBookMobile() {
  const book = document.getElementById('magicBook');
  if (!book) return;
  book.style.display = '';
  document.body.classList.add('book-overlay-active');
  // Always open the book interior on mobile
  book.classList.remove('closed');
  book.classList.add('open');
  // Clear any leftover drag positioning
  book.style.left = '';
  book.style.top = '';
  book.style.right = '';
  book.style.bottom = '';
  book.style.width = '';
  book.style.height = '';
  book.style.maxWidth = '';
  book.style.maxHeight = '';
  book.style.minWidth = '';
  book.style.minHeight = '';
  book.style.transform = '';
  delete book.dataset.wasDragged;
}

/** Hide the book on mobile (dismiss the overlay) */
function hideBookMobile() {
  const book = document.getElementById('magicBook');
  if (!book) return;
  book.style.display = 'none';
  document.body.classList.remove('book-overlay-active');
}

/**
 * Initialize the magic book: toggle button + dragging
 */
export function initMagicBook() {
  const book = document.getElementById('magicBook');
  const toggleBtn = document.getElementById('bookToggleBtn');
  const closeBtn = document.getElementById('bookCloseBtn');
  if (!book || !toggleBtn) return;

  // Toggle open/close
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = book.classList.contains('open');
    if (isOpen) {
      book.classList.remove('open');
      book.classList.add('closed');
      toggleBtn.textContent = '📖';
      toggleBtn.title = 'Open Book';
    } else {
      book.classList.remove('closed');
      book.classList.add('open');
      toggleBtn.textContent = '📕';
      toggleBtn.title = 'Close Book';
    }
  });

  // Mobile close button
  if (closeBtn) {
    const closeOverlay = (e) => {
      if (e?.preventDefault) e.preventDefault();
      if (e?.stopPropagation) e.stopPropagation();
      hideBookMobile();
    };
    closeBtn.addEventListener('click', closeOverlay);
    closeBtn.addEventListener('touchend', closeOverlay);
    closeBtn.addEventListener('pointerup', closeOverlay);
  }

  // Tap the backdrop (the .magic-book overlay itself) to close on mobile
  book.addEventListener('click', (e) => {
    if (!isMobileScreen()) return;
    // Only close if the click was on the dark backdrop, not on book content
    if (e.target === book) {
      hideBookMobile();
    }
  });

  // Start book drag on mousedown — desktop only
  book.addEventListener('mousedown', (e) => {
    if (isMobileScreen()) return;
    onBookMouseDown(e);
  });
  document.addEventListener('mousemove', onBookMouseMove);
  document.addEventListener('mouseup', onBookMouseUp);

  // Touch support for mobile book dragging — disabled on mobile
  book.addEventListener('touchstart', (e) => {
    if (isMobileScreen()) return;
    const touch = e.touches[0];
    onBookMouseDown({ target: e.target, clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (!bookDragging) return;
    const touch = e.touches[0];
    onBookMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!bookDragging) return;
    const touch = e.changedTouches[0];
    onBookMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
  });
}

function isInteractiveElement(el) {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.classList.contains('letter-board')) return true;
  if (el.classList.contains('line-word-chip')) return true;
  if (el.classList.contains('book-toggle-btn')) return true;
  if (el.id === 'grammarHebrewLine') return true;
  // Check if inside the letter-board area (verse drop zone)
  if (el.closest('#grammarHebrewLine')) return true;
  if (el.closest('.line-word-chip')) return true;
  return false;
}

function onBookMouseDown(e) {
  if (isMobileScreen()) return;
  // Don't drag from interactive elements
  if (isInteractiveElement(e.target)) return;
  // If an active tool (hammer/pestle/shovel) is under the pointer, let the
  // tool handle the click instead of starting a book drag.
  if (window.isPointOnActiveTool && window.isPointOnActiveTool(e.clientX, e.clientY)) return;
  // Only drag from book headers, pages background, or cover
  const book = document.getElementById('magicBook');
  if (!book) return;

  e.preventDefault();
  bookDragging = true;
  book.classList.add('dragging');

  // Pin the sidebar open so user can drag the book back into it
  const sidebar = document.getElementById('toolsSidebar');
  if (sidebar) sidebar.classList.add('pinned');

  const rect = book.getBoundingClientRect();
  bookOffsetX = e.clientX - rect.left;
  bookOffsetY = e.clientY - rect.top;

  // Remove the centering transform on first drag and mark as dragged
  book.style.transform = 'none';
  book.dataset.wasDragged = 'true';
}

function onBookMouseMove(e) {
  if (!bookDragging) return;
  const book = document.getElementById('magicBook');
  if (!book) return;

  const newLeft = e.clientX - bookOffsetX;
  const newTop = e.clientY - bookOffsetY;

  book.style.left = newLeft + 'px';
  book.style.top = newTop + 'px';
}

function onBookMouseUp(e) {
  if (!bookDragging) return;
  bookDragging = false;
  const book = document.getElementById('magicBook');
  if (!book) return;

  book.classList.remove('dragging');

  // Check drop zone BEFORE unpinning (so bounding rect is still fully visible)
  const sidebar = document.getElementById('toolsSidebar');
  const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
  const nearRightEdge = e.clientX >= (window.innerWidth - 100);
  const inSidebarRect = sidebarRect &&
    e.clientX >= sidebarRect.left &&
    e.clientX <= sidebarRect.right &&
    e.clientY >= sidebarRect.top &&
    e.clientY <= sidebarRect.bottom;

  // Unpin the sidebar
  if (sidebar) sidebar.classList.remove('pinned');

  // If the book was dropped near the right edge / sidebar, put it away
  if (nearRightEdge || inSidebarRect) {
    book.style.display = 'none';
  }
}

// ===============================================
// TOOLS SIDEBAR - Drag-out / Put-back behavior
// ===============================================

let toolDragging = false;
let toolDragGhost = null;
let toolDragSource = null;
let toolDragStartX = 0;
let toolDragStartY = 0;
const MIN_DRAG_DISTANCE = 15; // px before treating as a real drag

/**
 * Initialize the tools sidebar: tool slots with drag behavior
 * @param {Function} onToolSelected - callback(toolName) when a tool is pulled out
 * @param {Function} onToolPutAway - callback(toolName) when a tool is dropped back
 */
export function initToolsSidebar(onToolSelected, onToolPutAway) {
  const sidebar = document.getElementById('toolsSidebar');
  if (!sidebar) return;

  // Stop all mousedown on sidebar from reaching canvas tool listeners
  sidebar.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // Tab: tap to toggle sidebar, drag to reposition vertically
  const tab = sidebar.querySelector('.tools-sidebar-tab');
  if (tab) {
    makeVerticallyDraggable(sidebar, tab, {
      onTap() {
        sidebar.classList.toggle('open');
      },
      side: 'right'
    });
  }

  // Close sidebar when tapping outside of it (mobile)
  document.addEventListener('touchstart', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }, { passive: true });

  const slots = sidebar.querySelectorAll('.tool-slot');
  slots.forEach(slot => {
    slot.addEventListener('mousedown', (e) => onToolSlotMouseDown(e, slot, onToolSelected));
    // Mobile: tap a tool slot to activate it
    slot.addEventListener('touchend', (e) => {
      if (slot.classList.contains('locked-hidden')) return;
      e.preventDefault();
      e.stopPropagation();
      const tool = slot.dataset.tool;
      const isActive = slot.classList.contains('active') ||
        (tool === 'book' && document.getElementById('magicBook')?.style.display !== 'none');
      if (isActive) {
        putToolAway(tool, slot, onToolPutAway);
      } else {
        activateTool(tool, e, onToolSelected);
      }
      // Close the sidebar after selecting a tool on mobile
      sidebar.classList.remove('open');
    });
  });

  document.addEventListener('mousemove', onToolSlotMouseMove);
  document.addEventListener('mouseup', (e) => onToolSlotMouseUp(e, onToolSelected, onToolPutAway));
}

function onToolSlotMouseDown(e, slot, onToolSelected) {
  if (slot.classList.contains('locked-hidden')) return;
  e.preventDefault();

  toolDragging = true;
  toolDragSource = slot;
  toolDragStartX = e.clientX;
  toolDragStartY = e.clientY;

  // Don't show ghost or dragging-out state yet — wait until mouse moves enough
  // (handled in onToolSlotMouseMove)
}

function onToolSlotMouseMove(e) {
  if (!toolDragging || !toolDragSource) return;

  const dx = e.clientX - toolDragStartX;
  const dy = e.clientY - toolDragStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Create ghost once we've moved past the threshold
  if (!toolDragGhost && dist >= MIN_DRAG_DISTANCE) {
    toolDragSource.classList.add('dragging-out');

    // Pin the sidebar open so the user can drop back into it
    const sidebar = document.getElementById('toolsSidebar');
    if (sidebar) sidebar.classList.add('pinned');

    toolDragGhost = document.createElement('div');
    toolDragGhost.className = 'tool-drag-ghost';
    toolDragGhost.innerHTML = `
      <div class="tool-slot-icon">${toolDragSource.querySelector('.tool-slot-icon').textContent}</div>
      <div class="tool-slot-label">${toolDragSource.querySelector('.tool-slot-label').textContent}</div>
    `;
    document.body.appendChild(toolDragGhost);
  }

  if (toolDragGhost) {
    toolDragGhost.style.left = e.clientX + 'px';
    toolDragGhost.style.top = e.clientY + 'px';
  }
}

function putToolAway(tool, source, onToolPutAway) {
  console.log('putToolAway called for:', tool);
  if (tool === 'book') {
    if (isMobileScreen()) {
      hideBookMobile();
    } else {
      const book = document.getElementById('magicBook');
      if (book) {
        book.style.display = 'none';
      }
    }
  } else {
    if (onToolPutAway) onToolPutAway(tool);
    if (source) source.classList.remove('active');
  }
}

function onToolSlotMouseUp(e, onToolSelected, onToolPutAway) {
  if (!toolDragging) return;
  toolDragging = false;

  const wasDragged = toolDragGhost !== null; // ghost only exists after threshold

  // Check drop zone BEFORE unpinning (so bounding rect is still fully visible)
  const sidebar = document.getElementById('toolsSidebar');
  let droppedInSidebar = false;

  if (wasDragged) {
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
    droppedInSidebar = sidebarRect &&
      e.clientX >= sidebarRect.left &&
      e.clientX <= sidebarRect.right &&
      e.clientY >= sidebarRect.top &&
      e.clientY <= sidebarRect.bottom;
  }

  // Unpin the sidebar
  if (sidebar) sidebar.classList.remove('pinned');

  // Remove ghost
  if (toolDragGhost) {
    toolDragGhost.remove();
    toolDragGhost = null;
  }

  if (!toolDragSource) return;

  const tool = toolDragSource.dataset.tool;
  toolDragSource.classList.remove('dragging-out');

  if (!wasDragged) {
    // Click (no real drag) — toggle: if already active, put it away; otherwise activate
    const isActive = toolDragSource.classList.contains('active') ||
      (tool === 'book' && document.getElementById('magicBook')?.style.display !== 'none');
    console.log('Sidebar click on', tool, '| isActive:', isActive, '| hasActiveClass:', toolDragSource.classList.contains('active'));
    if (isActive) {
      putToolAway(tool, toolDragSource, onToolPutAway);
    } else {
      activateTool(tool, e, onToolSelected);
    }
  } else if (!droppedInSidebar) {
    // Dragged out of sidebar — activate at drop location
    console.log('Sidebar drag-out for', tool);
    activateTool(tool, e, onToolSelected);
  } else {
    // Dragged back into sidebar — put it away
    console.log('Sidebar drag-back for', tool);
    putToolAway(tool, toolDragSource, onToolPutAway);
  }

  toolDragSource = null;
}

/**
 * Activate a tool (shared by click and drag-out)
 */
function activateTool(tool, e, onToolSelected) {
  if (tool === 'book') {
    const book = document.getElementById('magicBook');
    if (book && book.style.display === 'none') {
      if (isMobileScreen()) {
        showBookMobile();
      } else {
        book.style.display = '';
        book.classList.remove('open');
        book.classList.add('closed');
        book.style.transform = 'none';
        book.style.left = (e.clientX - 90) + 'px';
        book.style.top = (e.clientY - 120) + 'px';
        const btn = document.getElementById('bookToggleBtn');
        if (btn) {
          btn.textContent = '📖';
          btn.title = 'Open Book';
        }
      }
    }
  } else {
    if (onToolSelected) onToolSelected(tool, e.clientX, e.clientY);

    // Update active states on sidebar slots
    const allSlots = document.querySelectorAll('.tool-slot[data-tool]');
    allSlots.forEach(s => {
      if (s.dataset.tool === tool && s.dataset.tool !== 'book') {
        s.classList.add('active');
      } else if (s.dataset.tool !== 'book') {
        s.classList.remove('active');
      }
    });
  }
}

// ===============================================
// VERTICAL DRAG REPOSITIONING for sidebar panels
// ===============================================

/**
 * Make a fixed-position element draggable vertically by its tab handle.
 * The element's CSS `top` is updated; `transform: translateY(-50%)` is
 * removed while dragging so the position tracks the pointer accurately.
 *
 * @param {HTMLElement} container - The fixed-position wrapper element
 * @param {HTMLElement} handle   - The tab the user grabs to drag
 * @param {Object} opts
 *   opts.onTap   - called when the handle is tapped (no drag)
 *   opts.side    - 'left' or 'right' (used for cursor style)
 */
function makeVerticallyDraggable(container, handle, opts = {}) {
  let dragging = false;
  let startY = 0;
  let startTop = 0;
  let moved = false;
  const DRAG_THRESHOLD = 6; // px before we treat as drag

  function pointerDown(e) {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragging = true;
    moved = false;
    startY = clientY;
    // Resolve current top from computed style (handles translateY centering)
    const rect = container.getBoundingClientRect();
    startTop = rect.top + rect.height / 2; // track center
    container.classList.add('sidebar-dragging');
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }

  function pointerMove(e) {
    if (!dragging) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = clientY - startY;
    if (!moved && Math.abs(dy) < DRAG_THRESHOLD) return;
    moved = true;
    // Clamp so container stays on screen
    const h = container.getBoundingClientRect().height;
    const minTop = h / 2 + 8;
    const maxTop = window.innerHeight - h / 2 - 8;
    const newCenter = Math.max(minTop, Math.min(maxTop, startTop + dy));
    container.style.top = newCenter + 'px';
    // Use a class so CSS rules can compose translateY with their own translateX
    container.classList.add('sidebar-repositioned');
  }

  function pointerUp(e) {
    if (!dragging) return;
    dragging = false;
    container.classList.remove('sidebar-dragging');
    if (!moved && opts.onTap) {
      opts.onTap(e);
    }
  }

  // Mouse
  handle.addEventListener('mousedown', pointerDown);
  document.addEventListener('mousemove', pointerMove);
  document.addEventListener('mouseup', pointerUp);

  // Touch
  handle.addEventListener('touchstart', pointerDown, { passive: false });
  document.addEventListener('touchmove', pointerMove, { passive: false });
  document.addEventListener('touchend', pointerUp);
}

/**
 * Initialize the mold viewport tab for mobile: tap to toggle open/closed
 * and drag to reposition vertically.
 */
export function initMoldSidebarTab() {
  const wrapper = document.querySelector('.mold-viewport-wrapper');
  if (!wrapper) return;

  const tab = wrapper.querySelector('.mold-sidebar-tab');
  if (!tab) return;

  makeVerticallyDraggable(wrapper, tab, {
    onTap() {
      wrapper.classList.toggle('open');
    },
    side: 'left'
  });

  // Stop mousedown from reaching canvas
  wrapper.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
}

/**
 * Update sidebar tool visibility based on unlock state
 */
export function updateSidebarToolVisibility(pestleUnlocked, shovelUnlocked) {
  const pestleSlot = document.getElementById('toolSlotPestle');
  const shovelSlot = document.getElementById('toolSlotShovel');

  if (pestleSlot) {
    if (pestleUnlocked) {
      pestleSlot.classList.remove('locked-hidden');
    } else {
      pestleSlot.classList.add('locked-hidden');
    }
  }

  if (shovelSlot) {
    if (shovelUnlocked) {
      shovelSlot.classList.remove('locked-hidden');
    } else {
      shovelSlot.classList.add('locked-hidden');
    }
  }
}
