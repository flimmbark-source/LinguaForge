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

/**
 * Initialize the magic book: toggle button + dragging
 */
export function initMagicBook() {
  const book = document.getElementById('magicBook');
  const toggleBtn = document.getElementById('bookToggleBtn');
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

  // Stop all mousedown events on the book from reaching document-level listeners
  // (prevents canvas tools like hammer/pestle from activating through the book)
  book.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    onBookMouseDown(e);
  });
  document.addEventListener('mousemove', onBookMouseMove);
  document.addEventListener('mouseup', onBookMouseUp);
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
  // Don't drag from interactive elements
  if (isInteractiveElement(e.target)) return;
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

  const slots = sidebar.querySelectorAll('.tool-slot');
  slots.forEach(slot => {
    slot.addEventListener('mousedown', (e) => onToolSlotMouseDown(e, slot, onToolSelected));
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
    const book = document.getElementById('magicBook');
    if (book) {
      book.style.display = 'none';
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
    const nearRightEdge = e.clientX >= (window.innerWidth - 100);
    const inSidebarRect = sidebarRect &&
      e.clientX >= sidebarRect.left &&
      e.clientX <= sidebarRect.right &&
      e.clientY >= sidebarRect.top &&
      e.clientY <= sidebarRect.bottom;
    droppedInSidebar = nearRightEdge || inSidebarRect;
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
  } else {
    if (onToolSelected) onToolSelected(tool);

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
