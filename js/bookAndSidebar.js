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

function setBookToggleState(toggleBtn, isOpen) {
  if (!toggleBtn) return;
  toggleBtn.textContent = isOpen ? '📕' : '📖';
  toggleBtn.title = isOpen ? 'Close Book' : 'Open Book';
  toggleBtn.classList.toggle('book-toggle-btn-open', isOpen);
  toggleBtn.classList.toggle('book-toggle-btn-closed', !isOpen);
}

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

    setBookToggleState(toggleBtn, book.classList.contains('open'));

  // Toggle open/close
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = book.classList.contains('open');
    if (isOpen) {
      book.classList.remove('open');
      book.classList.add('closed');
      setBookToggleState(toggleBtn, false);
    } else {
      book.classList.remove('closed');
      book.classList.add('open');
      setBookToggleState(toggleBtn, false);
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
  if (el.classList.contains('verse-orbit-chip')) return true;
  if (el.classList.contains('word-bank-tab')) return true;
  if (el.classList.contains('verse-action-btn')) return true;
  if (el.id === 'grammarHebrewLine') return true;
  if (el.closest('#grammarHebrewLine')) return true;
  if (el.closest('.line-word-chip')) return true;
  if (el.closest('.verse-word-bank')) return true;
  if (el.closest('.word-bank-tabs')) return true;
  if (el.closest('.verse-action-buttons')) return true;
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
let toolDragActivated = false;
let toolSelectedCallback = null;
const MIN_DRAG_DISTANCE = 15; // px before treating as a real drag
let sidebarRecenterListenerAdded = false;

function recenterSidebarTabs() {
  const elements = [
    document.getElementById('toolsSidebar'),
    document.querySelector('.mold-viewport-wrapper')
  ];
  elements.forEach((el) => {
    if (!el) return;
    el.classList.remove('sidebar-repositioned');
    el.style.top = '';
  });
}

function ensureSidebarRecenterListener() {
  if (sidebarRecenterListenerAdded) return;
  sidebarRecenterListenerAdded = true;
  const handler = () => {
    recenterSidebarTabs();
  };
  window.addEventListener('resize', handler);
  window.addEventListener('orientationchange', handler);
}

/**
 * Initialize the tools sidebar: tool slots with drag behavior
 * @param {Function} onToolSelected - callback(toolName) when a tool is pulled out
 * @param {Function} onToolPutAway - callback(toolName) when a tool is dropped back
 */
export function initToolsSidebar(onToolSelected, onToolPutAway) {
  toolSelectedCallback = onToolSelected || null;
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
  ensureSidebarRecenterListener();

  // Close sidebar when tapping outside of it (mobile)
  document.addEventListener('touchstart', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }, { passive: true });

  const slots = sidebar.querySelectorAll('.tool-slot');
  slots.forEach(slot => {
    slot.addEventListener('mousedown', (e) => onToolSlotMouseDown(e, slot));
    // Touch: drag-out support (mirrors mouse drag behavior)
    slot.addEventListener('touchstart', (e) => {
      if (slot.classList.contains('locked-hidden')) return;
      const touch = e.touches[0];
      onToolSlotMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => { if (e.cancelable) e.preventDefault(); },
        stopPropagation: () => e.stopPropagation()
      }, slot);
    }, { passive: false });
  });

  document.addEventListener('mousemove', onToolSlotMouseMove);
  document.addEventListener('mouseup', (e) => onToolSlotMouseUp(e, onToolSelected, onToolPutAway));
  // Touch move/end for tool slot drag
  document.addEventListener('touchmove', (e) => {
    if (!toolDragging || !toolDragSource) return;
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    onToolSlotMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (!toolDragging) return;
    const touch = e.changedTouches[0];
    onToolSlotMouseUp({ clientX: touch.clientX, clientY: touch.clientY }, onToolSelected, onToolPutAway);
    // Close the sidebar after a touch interaction
    sidebar.classList.remove('open');
  });
}

function onToolSlotMouseDown(e, slot) {
  if (slot.classList.contains('locked-hidden')) return;
  e.preventDefault();

  toolDragging = true;
  toolDragSource = slot;
  toolDragStartX = e.clientX;
  toolDragStartY = e.clientY;
  toolDragActivated = false;

  // Don't show ghost or dragging-out state yet — wait until mouse moves enough
  // (handled in onToolSlotMouseMove)
}

function onToolSlotMouseMove(e) {
  if (!toolDragging || !toolDragSource) return;

  const dx = e.clientX - toolDragStartX;
  const dy = e.clientY - toolDragStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Once drag threshold is crossed, immediately spawn/pull out the real tool.
  if (!toolDragActivated && dist >= MIN_DRAG_DISTANCE) {
    toolDragActivated = true;
    toolDragSource.classList.add('dragging-out');

    // Pin the sidebar open so the user can drop back into it
    const sidebar = document.getElementById('toolsSidebar');
    if (sidebar) sidebar.classList.add('pinned');

    activateTool(toolDragSource.dataset.tool, e, toolSelectedCallback);
  }

  if (toolDragActivated && toolSelectedCallback) {
    toolSelectedCallback(toolDragSource.dataset.tool, e.clientX, e.clientY);
  }

  if (toolDragActivated && toolDragSource.dataset.tool === 'book') {
    moveBookToPointer(e.clientX, e.clientY);
  }
}

function moveBookToPointer(clientX, clientY) {
  const book = document.getElementById('magicBook');
  if (!book || isMobileScreen()) return;

  book.style.display = '';
  book.classList.remove('open');
  book.classList.add('closed');
  book.style.transform = 'none';
  book.style.left = (clientX - 90) + 'px';
  book.style.top = (clientY - 120) + 'px';

  const btn = document.getElementById('bookToggleBtn');
  if (btn) {
  setBookToggleState(btn, false);
  }
}



function putToolAway(tool, source, onToolPutAway) {
  if (tool === 'book') {
    if (isMobileScreen()) {
      hideBookMobile();
    } else {
      const book = document.getElementById('magicBook');
      if (book) {
        book.style.display = 'none';
      }
    }
    if (source) source.classList.remove('active');
  } else {
    if (onToolPutAway) onToolPutAway(tool);
    if (source) source.classList.remove('active');
  }
}

function onToolSlotMouseUp(e, onToolSelected, onToolPutAway) {
  if (!toolDragging) return;
  toolDragging = false;

  const wasDragged = toolDragActivated;

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

  if (!toolDragSource) return;

  const tool = toolDragSource.dataset.tool;
  toolDragSource.classList.remove('dragging-out');

  if (!wasDragged) {
    // Click (no real drag) — toggle: if already active, put it away; otherwise activate
    const isActive = toolDragSource.classList.contains('active') ||
      (tool === 'book' && document.getElementById('magicBook')?.style.display !== 'none');
    if (isActive) {
      putToolAway(tool, toolDragSource, onToolPutAway);
    } else {
      activateTool(tool, e, onToolSelected);
    }
  } else if (!droppedInSidebar) {
    // Dragged out of sidebar — tool already active and being moved.
  } else {
    // Dragged back into sidebar — put it away
    putToolAway(tool, toolDragSource, onToolPutAway);
  }

  toolDragSource = null;
  toolDragActivated = false;
}

/**
 * Activate a tool (shared by click and drag-out)
 */
function activateTool(tool, e, onToolSelected) {
  if (tool === 'book') {
        if (isMobileScreen()) {
      showBookMobile();
    } else {
      moveBookToPointer(e.clientX, e.clientY);
      const bookSlot = document.querySelector('.tool-slot[data-tool="book"]');
      if (bookSlot) bookSlot.classList.add('active');
    }
  } else {
    if (onToolSelected) onToolSelected(tool, e.clientX, e.clientY);

    // Update active states on sidebar slots
    const slot = document.querySelector(`.tool-slot[data-tool="${tool}"]`);
    if (slot && slot.dataset.tool !== 'book') {
      slot.classList.add('active');
    }
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
 * Make a fixed-position element draggable in both axes by its handle.
 * Updates left/top and clears right/bottom so it can move freely.
 */
function makeFreeDraggable(container, handle) {
  if (!container || !handle) return;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let moved = false;
  let width = 0;
  let height = 0;
  const DRAG_THRESHOLD = 6;

  function pointerDown(e) {
    if (isMobileScreen()) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = container.getBoundingClientRect();
    dragging = true;
    moved = false;
    startX = clientX;
    startY = clientY;
    startLeft = rect.left;
    startTop = rect.top;
    width = rect.width;
    height = rect.height;
    container.classList.add('floating-dragging');
    container.style.left = `${rect.left}px`;
    container.style.top = `${rect.top}px`;
    container.style.right = 'auto';
    container.style.bottom = 'auto';
    container.style.transform = 'none';
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  }

  function pointerMove(e) {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved = true;
    const maxLeft = window.innerWidth - width - 8;
    const maxTop = window.innerHeight - height - 8;
    const nextLeft = Math.max(8, Math.min(maxLeft, startLeft + dx));
    const nextTop = Math.max(8, Math.min(maxTop, startTop + dy));
    container.style.left = `${nextLeft}px`;
    container.style.top = `${nextTop}px`;
  }

  function pointerUp() {
    if (!dragging) return;
    dragging = false;
    container.classList.remove('floating-dragging');
  }

  handle.addEventListener('mousedown', pointerDown);
  document.addEventListener('mousemove', pointerMove);
  document.addEventListener('mouseup', pointerUp);
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
  ensureSidebarRecenterListener();

  // Stop mousedown from reaching canvas
  wrapper.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
}

/**
 * Initialize draggable behavior for desktop-floating panels.
 */
export function initFloatingPanels() {
  if (isMobileScreen()) return;
  const moldWrapper = document.querySelector('.mold-viewport-wrapper');
  const moldTab = moldWrapper ? moldWrapper.querySelector('.mold-sidebar-tab') : null;
  makeFreeDraggable(moldWrapper, moldTab);

  const letterBasket = document.querySelector('.letter-basket');
  const basketHandle = letterBasket ? letterBasket.querySelector('.letter-basket-header') : null;
  makeFreeDraggable(letterBasket, basketHandle);
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
