/**
 * LINGUA FORGE - TOOL SIDEBAR HELPERS
 * Shared logic for opening the sidebar when a tool is dragged near it,
 * and detecting a valid "put-away" drop over the open sidebar.
 */

const SIDEBAR_PROXIMITY_PX = 48; // how close to the tab before it auto-opens

/**
 * Call during pointer-move while a tool is held.
 * Opens the sidebar when the pointer gets close to the tab.
 */
export function handleToolDragNearSidebar(clientX) {
  const sidebar = document.getElementById('toolsSidebar');
  if (!sidebar) return;

  const tab = sidebar.querySelector('.tools-sidebar-tab');
  if (!tab) return;

  const tabRect = tab.getBoundingClientRect();
  const isNearTab = clientX >= tabRect.left - SIDEBAR_PROXIMITY_PX;

  if (isNearTab) {
    sidebar.classList.add('open');
    sidebar.dataset.toolHover = '1';
  } else if (sidebar.dataset.toolHover === '1') {
    sidebar.classList.remove('open');
    delete sidebar.dataset.toolHover;
  }
}

/**
 * Call on pointer-up to check whether the tool should be put away.
 * Returns true only when the sidebar is open AND the pointer is
 * inside the sidebar content area (not just near the edge).
 */
export function shouldPutToolAway(clientX, clientY) {
  const sidebar = document.getElementById('toolsSidebar');
  if (!sidebar) return false;

  const isOpen = sidebar.classList.contains('open') || sidebar.classList.contains('pinned');
  if (!isOpen) return false;

  const content = sidebar.querySelector('.tools-sidebar-content');
  if (!content) return false;

  const contentRect = content.getBoundingClientRect();
  // Content must have actual width (it collapses to 0 when closed)
  if (contentRect.width < 5) return false;

  const inContent = clientX >= contentRect.left &&
    clientX <= contentRect.right &&
    clientY >= contentRect.top &&
    clientY <= contentRect.bottom;

  return inContent;
}

/**
 * Clean up sidebar state after a tool drag ends (put-away or not).
 */
export function cleanupToolDragSidebar() {
  const sidebar = document.getElementById('toolsSidebar');
  if (sidebar && sidebar.dataset.toolHover === '1') {
    sidebar.classList.remove('open');
    delete sidebar.dataset.toolHover;
  }
}
