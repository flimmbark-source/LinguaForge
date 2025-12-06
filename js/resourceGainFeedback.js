/**
 * resourceGainFeedback.js
 *
 * Visual feedback system for resource gains.
 * Creates floating "+X 🌟" or "+X 💧" ghosts that float up and fade out.
 */

export class ResourceGainFeedbackSystem {
  constructor() {
    this.ghosts = [];
    this.containerDiv = null;
    this.init();
  }

  init() {
    // Create container for floating ghosts
    this.containerDiv = document.createElement('div');
    this.containerDiv.id = 'resource-gain-container';
    this.containerDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(this.containerDiv);
  }

  /**
   * Spawn a floating resource gain ghost
   * @param {number} x - Screen x position in pixels
   * @param {number} y - Screen y position in pixels
   * @param {number} amount - Amount of resource gained
   * @param {'renown'|'ink'} type - Type of resource
   */
  spawnGain(x, y, amount, type) {
    const icon = type === 'renown' ? '⭐' : '💧';
    const color = type === 'renown' ? '#fbbf24' : '#3b82f6'; // Yellow for renown, blue for ink

    const ghostEl = document.createElement('div');
    ghostEl.className = 'resource-gain-ghost';
    ghostEl.textContent = `+${amount} ${icon}`;
    ghostEl.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      color: ${color};
      font-size: 24px;
      font-weight: bold;
      text-shadow:
        0 0 10px rgba(0, 0, 0, 0.8),
        0 0 20px ${color}40,
        2px 2px 4px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      white-space: nowrap;
      transform: translate(-50%, -50%);
      z-index: 10000;
    `;

    this.containerDiv.appendChild(ghostEl);

    const ghost = {
      el: ghostEl,
      startY: y,
      age: 0,
      lifetime: 1.5, // 1.5 seconds total
      floatDistance: 80, // Float up 80px
    };

    this.ghosts.push(ghost);
  }

  /**
   * Update all ghosts (call this in game loop)
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Update each ghost
    this.ghosts.forEach(ghost => {
      ghost.age += dt;

      const progress = Math.min(ghost.age / ghost.lifetime, 1);

      // Ease out cubic for smooth deceleration
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Float upward
      const newY = ghost.startY - (ghost.floatDistance * easeProgress);
      ghost.el.style.top = `${newY}px`;

      // Fade out in last 50% of lifetime
      const fadeStart = 0.5;
      let opacity = 1;
      if (progress > fadeStart) {
        const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
        opacity = 1 - fadeProgress;
      }
      ghost.el.style.opacity = opacity;

      // Scale up slightly then down
      const scale = 1 + Math.sin(progress * Math.PI) * 0.2;
      const currentTransform = ghost.el.style.transform.match(/translate\([^)]+\)/)?.[0] || 'translate(-50%, -50%)';
      ghost.el.style.transform = `${currentTransform} scale(${scale})`;
    });

    // Remove dead ghosts
    this.ghosts = this.ghosts.filter(ghost => {
      if (ghost.age >= ghost.lifetime) {
        ghost.el.remove();
        return false;
      }
      return true;
    });
  }

  /**
   * Clean up all ghosts (for reset or cleanup)
   */
  clear() {
    this.ghosts.forEach(ghost => ghost.el.remove());
    this.ghosts = [];
  }
}

// Singleton instance
let feedbackSystem = null;

/**
 * Get or create the global feedback system instance
 */
export function getResourceFeedbackSystem() {
  if (!feedbackSystem) {
    feedbackSystem = new ResourceGainFeedbackSystem();
  }
  return feedbackSystem;
}

/**
 * Convenience function to spawn a resource gain ghost
 */
export function spawnResourceGain(x, y, amount, type) {
  const system = getResourceFeedbackSystem();
  system.spawnGain(x, y, amount, type);
}

/**
 * Update the feedback system (call in game loop)
 */
export function updateResourceFeedback(dt) {
  if (feedbackSystem) {
    feedbackSystem.update(dt);
  }
}
