/**
 * LINGUA FORGE - HEARTH SYSTEM
 * Manages the hearth state, heating mechanics, and fire animations
 */

import { gameState } from './state.js?v=9';
import { playHearthIgnite } from './audio.js?v=9';

/**
 * Hearth state
 */
export const hearthState = {
  isHeated: false,
  heatTimer: 0, // Seconds remaining
  maxHeatTime: 0, // Maximum heat time based on letters
  hearthLevel: 0, // Current hearth heat level (0-3)
  totalLettersConsumed: 0, // Total letters fed to hearth since last cooldown
};

let lastForgeEnabledState = null;
let hearthSparkContainer = null;

// Cached DOM refs for updateHearthVisuals to avoid getElementById every frame
let _cachedHearthDiv = null;
let _cachedFireDiv = null;
let _cachedBreathDiv = null;

function getHearthSparkContainer() {
  if (hearthSparkContainer && hearthSparkContainer.isConnected) {
    return hearthSparkContainer;
  }

  hearthSparkContainer = document.createElement('div');
  hearthSparkContainer.id = 'hearth-spark-container';
  document.body.appendChild(hearthSparkContainer);
  return hearthSparkContainer;
}

function getDefaultSparkPosition() {
  const hearthDiv = document.getElementById('hearth');
  if (!hearthDiv) return null;
  const rect = hearthDiv.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// Mobile detection for reduced spark counts
const _isMobileHearth = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

export function spawnHearthSpark(x, y, burstCount = 4) {
  if (!gameState.hearthUnlocked) return;

  let sparkX = x;
  let sparkY = y;
  if (sparkX == null || sparkY == null) {
    const fallback = getDefaultSparkPosition();
    if (!fallback) return;
    sparkX = fallback.x;
    sparkY = fallback.y;
  }

  const container = getHearthSparkContainer();
  // On mobile, reduce spark count to reduce DOM churn
  const count = _isMobileHearth ? Math.max(1, Math.floor(burstCount * 0.5)) : Math.max(1, burstCount);

  // Cap total active sparks in container to avoid DOM bloat
  const maxSparks = _isMobileHearth ? 12 : 40;
  if (container.childElementCount >= maxSparks) return;

  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement('div');
    spark.className = 'hearth-spark';

    const angle = Math.random() * Math.PI * 2;
    const distance = 12 + Math.random() * 20;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 12;
    const scale = 0.7 + Math.random() * 0.6;

    spark.style.left = `${sparkX}px`;
    spark.style.top = `${sparkY}px`;
    spark.style.setProperty('--spark-x', `${dx}px`);
    spark.style.setProperty('--spark-y', `${dy}px`);
    spark.style.setProperty('--spark-scale', scale.toFixed(2));
    spark.style.animationDelay = `${Math.random() * 0.08}s`;
    const isAsh = Math.random() < 0.25;
    spark.style.setProperty(
      '--spark-color',
      isAsh
        ? 'radial-gradient(circle, rgba(226,232,240,0.8) 0%, rgba(148,163,184,0.6) 45%, rgba(71,85,105,0) 70%)'
        : 'radial-gradient(circle, #fef3c7 0%, #f59e0b 45%, rgba(249, 115, 22, 0) 70%)'
    );

    spark.addEventListener('animationend', () => {
      spark.remove();
    }, { once: true });

    container.appendChild(spark);
  }
}

/**
 * Heat up the hearth when letters are placed
 * 
 * @param {number} letterount - Number of letters placed
 */
export function heatHearth(letterCount = 1) {
  // Check if hearth is unlocked and turned on
  if (!gameState.hearthUnlocked || !gameState.hearthTurnedon) {
    return;
  }

  const secondsPerLetter = gameState.secondsPerLetter || 5;
  const additionalHeat = letterCount * secondsPerLetter;

  // Track total letters consumed
  hearthState.totalLettersConsumed += letterCount;

  // Calculate hearth level based on total letters consumed
  // Level thresholds: 1-14 letters = level 1, 15-34 = level 2, 35+ = level 3
  const maxHearthLevel = gameState.heatLevels || 1;
  let newLevel = 1;
  if (hearthState.totalLettersConsumed >= 12) {
    newLevel = 3;
  } else if (hearthState.totalLettersConsumed >= 6) {
    newLevel = 2;
  }

  // Cap at player's unlocked max level
  hearthState.hearthLevel = Math.min(newLevel, maxHearthLevel);

  hearthState.heatTimer += additionalHeat;
  hearthState.maxHeatTime = Math.max(hearthState.maxHeatTime, hearthState.heatTimer);
  hearthState.isHeated = true;
  playHearthIgnite();


  updateHearthVisuals();
}

/**
 * Update hearth state (called every frame)
 * @param {number} dt - Delta time in seconds
 */
// Throttle hearth visual updates to avoid per-frame DOM writes
let _hearthVisualAcc = 0;
const HEARTH_VISUAL_INTERVAL = 0.15; // Update visuals ~7 times/sec instead of 60

export function updateHearth(dt) {
  const forgeEnabled = gameState.hearthUnlocked;

  if (forgeEnabled !== lastForgeEnabledState) {
    updateHearthVisuals();
    lastForgeEnabledState = forgeEnabled;
  }

  if (!forgeEnabled) {
    return;
  }
  if (hearthState.isHeated && hearthState.heatTimer > 0) {
    // Higher hearth levels consume heat faster
    // Level 1: 1x, Level 2: 1.5x, Level 3: 2x consumption rate
    const consumptionMultiplier = 1 + ((hearthState.hearthLevel - 1) * 0.5);
    hearthState.heatTimer = Math.max(0, hearthState.heatTimer - (dt * consumptionMultiplier));

    const justExpired = hearthState.heatTimer <= 0;
    if (justExpired) {
      hearthState.isHeated = false;
      hearthState.maxHeatTime = 0;
      hearthState.hearthLevel = 0;
      hearthState.totalLettersConsumed = 0;
    }

    // Throttle visual updates unless the hearth just expired (need immediate feedback)
    _hearthVisualAcc += dt;
    if (justExpired || _hearthVisualAcc >= HEARTH_VISUAL_INTERVAL) {
      _hearthVisualAcc = 0;
      updateHearthVisuals();
    }
  }
}

export function canPlaceInHearth() {
  return gameState.hearthUnlocked;
}

/**
 * Check if hearth is heated
 * @returns {boolean} True if hearth is heated
 */
export function isHearthHeated() {
  return hearthState.isHeated && hearthState.heatTimer > 0;
}

/**
 * Get current hearth heat level
 * @returns {number} Current hearth level (0-3)
 */
export function getHearthLevel() {
  return hearthState.hearthLevel;
}

/**
 * Get hearth heat intensity (0 to 1)
 * @returns {number} Heat intensity
 */
export function getHearthIntensity() {
  if (!hearthState.isHeated || hearthState.maxHeatTime === 0) return 0;
  return hearthState.heatTimer / hearthState.maxHeatTime;
}

/**
 * Update hearth visuals based on state
 */
export function updateHearthVisuals() {
  // Use cached DOM refs to avoid getElementById on every frame
  if (!_cachedHearthDiv || !_cachedHearthDiv.isConnected) {
    _cachedHearthDiv = document.getElementById('hearth');
  }
  if (!_cachedFireDiv || !_cachedFireDiv.isConnected) {
    _cachedFireDiv = document.getElementById('hearthFire');
  }
  if (!_cachedBreathDiv || !_cachedBreathDiv.isConnected) {
    _cachedBreathDiv = document.getElementById('hearthBreath');
  }
  const hearthDiv = _cachedHearthDiv;
  const fireDiv = _cachedFireDiv;
  const breathDiv = _cachedBreathDiv;

  const forgeEnabled = gameState.hearthUnlocked && gameState.hearthTurnedon;

  if (!hearthDiv || !fireDiv) return;

  if (!forgeEnabled) {
    hearthDiv.classList.remove('heated');
    hearthDiv.classList.remove('fading');
    hearthDiv.removeAttribute('data-hearth-level');
    fireDiv.style.opacity = '0';
    fireDiv.style.transform = 'scale(0)';
    if (breathDiv) breathDiv.style.opacity = '0';
    fireDiv.classList.add('disabled');
    lastForgeEnabledState = forgeEnabled;
    return;
  }

  // Ensure fire is visible when the hearth is enabled
  fireDiv.classList.remove('disabled');

  if (hearthState.isHeated) {
    const intensity = getHearthIntensity();
    const level = hearthState.hearthLevel;

    const isLowHeat = intensity > 0 && intensity <= 0.25;

    hearthDiv.classList.add('heated');
    hearthDiv.classList.toggle('fading', isLowHeat);
    fireDiv.classList.toggle('fading', isLowHeat);

    // Base scale increases with hearth level
    // Level 1: 0.5-1.0, Level 2: 0.7-1.2, Level 3: 0.9-1.4
    const baseScale = 0.3 + (level * 0.2);
    const scale = baseScale + (intensity * 0.5);
    fireDiv.style.transform = `scale(${scale})`;

    // Opacity increases with level
    const baseOpacity = 0.3 + (level * 0.15);
    fireDiv.style.opacity = Math.max(baseOpacity, intensity);
    if (breathDiv) breathDiv.style.opacity = String(0.3 + (intensity * 0.5));

    // Add data attribute for CSS styling based on level
    hearthDiv.setAttribute('data-hearth-level', level);
  } else {
    // Not heated - show visible but dim fire
    hearthDiv.classList.remove('heated');
    hearthDiv.classList.remove('fading');
    hearthDiv.removeAttribute('data-hearth-level');
    fireDiv.style.opacity = '0.4';
    fireDiv.style.transform = 'scale(0.5)';
    fireDiv.classList.remove('fading');
    if (breathDiv) breathDiv.style.opacity = '0.35';
  }

  lastForgeEnabledState = forgeEnabled;

}

/**
 * Get hearth bounds for collision detection
 * @returns {DOMRect|null} Hearth bounding rectangle
 */
export function getHearthBounds() {
  const hearthDiv = document.getElementById('hearth');
  return hearthDiv ? hearthDiv.getBoundingClientRect() : null;
}

/**
 * Create fire SVG element
 * @returns {string} SVG markup for fire
 */
export function createFireSVG() {
  return `
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" class="hearth-fire-svg">
      <defs>
        <radialGradient id="glowOuter" cx="50%" cy="70%">
          <stop offset="0%" style="stop-color:#fef3c7;stop-opacity:0.95" />
          <stop offset="45%" style="stop-color:#f59e0b;stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:#b45309;stop-opacity:0" />
        </radialGradient>
        <radialGradient id="glowCore" cx="50%" cy="65%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="40%" style="stop-color:#fde68a;stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:0" />
        </radialGradient>
      </defs>

      <!-- Soft fiery glow -->
      <circle cx="50" cy="72" r="36" fill="url(#glowOuter)" opacity="0.9">
        <animate attributeName="r" values="34;38;34" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.75;0.95;0.75" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="50" cy="72" r="20" fill="url(#glowCore)" opacity="0.9">
        <animate attributeName="r" values="18;22;18" dur="1.6s" repeatCount="indefinite" />
      </circle>

      <!-- Wispy flame tongue -->
      <path d="M50 28 C44 40, 42 54, 46 68 C48 76, 52 78, 54 68 C58 52, 56 38, 50 28 Z"
            fill="url(#glowCore)" opacity="0.75">
        <animate attributeName="d"
                 values="M50 28 C44 40, 42 54, 46 68 C48 76, 52 78, 54 68 C58 52, 56 38, 50 28 Z;
                         M50 24 C45 36, 44 52, 47 66 C49 74, 53 76, 55 66 C58 50, 56 34, 50 24 Z;
                         M50 28 C44 40, 42 54, 46 68 C48 76, 52 78, 54 68 C58 52, 56 38, 50 28 Z"
                 dur="1.8s" repeatCount="indefinite" />
      </path>

      <!-- Ash particles -->
      <circle cx="46" cy="78" r="2" fill="rgba(226,232,240,0.8)">
        <animate attributeName="cy" values="78;20" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="56" cy="80" r="1.6" fill="rgba(148,163,184,0.7)">
        <animate attributeName="cy" values="80;24" dur="2.1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="2.1s" repeatCount="indefinite" />
      </circle>
      <circle cx="52" cy="84" r="1.2" fill="rgba(203,213,225,0.7)">
        <animate attributeName="cy" values="84;30" dur="1.9s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="1.9s" repeatCount="indefinite" />
      </circle>
    </svg>
  `;
}

/**
 * Initialize hearth UI
 */
export function initializeHearth() {
  const hearthDiv = document.getElementById('hearth');
  const hearthFireDiv = document.getElementById('hearthFire');

  if (!hearthDiv || !hearthFireDiv) {
    console.warn('Hearth elements not found');
    return;
  }

  // Insert fire SVG
  hearthFireDiv.innerHTML = createFireSVG();

  // Initialize visuals
  updateHearthVisuals();

  console.log('Hearth system initialized');
}
