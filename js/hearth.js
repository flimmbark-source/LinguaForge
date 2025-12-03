/**
 * LINGUA FORGE - HEARTH SYSTEM
 * Manages the hearth state, heating mechanics, and fire animations
 */

/**
 * Hearth state
 */
export const hearthState = {
  isHeated: false,
  heatTimer: 0, // Seconds remaining
  maxHeatTime: 0, // Maximum heat time based on letters
};

/**
 * Heat up the hearth when letters are placed
 * @param {number} letterCount - Number of letters placed (5 seconds per letter)
 */
export function heatHearth(letterCount = 1) {
  const secondsPerLetter = 5;
  const additionalHeat = letterCount * secondsPerLetter;

  hearthState.heatTimer += additionalHeat;
  hearthState.maxHeatTime = Math.max(hearthState.maxHeatTime, hearthState.heatTimer);
  hearthState.isHeated = true;

  updateHearthVisuals();
}

/**
 * Update hearth state (called every frame)
 * @param {number} dt - Delta time in seconds
 */
export function updateHearth(dt) {
  if (hearthState.isHeated && hearthState.heatTimer > 0) {
    hearthState.heatTimer = Math.max(0, hearthState.heatTimer - dt);

    if (hearthState.heatTimer <= 0) {
      hearthState.isHeated = false;
      hearthState.maxHeatTime = 0;
    }

    updateHearthVisuals();
  }
}

/**
 * Check if hearth is heated
 * @returns {boolean} True if hearth is heated
 */
export function isHearthHeated() {
  return hearthState.isHeated && hearthState.heatTimer > 0;
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
  const hearthDiv = document.getElementById('hearth');
  const fireDiv = document.getElementById('hearthFire');

  if (!hearthDiv || !fireDiv) return;

  if (hearthState.isHeated) {
    const intensity = getHearthIntensity();
    hearthDiv.classList.add('heated');
    fireDiv.style.opacity = Math.max(0.3, intensity);

    // Scale fire based on intensity
    const scale = 0.5 + (intensity * 0.5);
    fireDiv.style.transform = `scale(${scale})`;
  } else {
    hearthDiv.classList.remove('heated');
    fireDiv.style.opacity = '0.1';
    fireDiv.style.transform = 'scale(0.3)';
  }
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
      <!-- Main flame -->
      <path d="M50 10 C40 30, 35 50, 35 70 C35 85, 40 95, 50 100 C60 95, 65 85, 65 70 C65 50, 60 30, 50 10 Z"
            fill="url(#flameGradient1)" opacity="0.9">
        <animate attributeName="d"
                 values="M50 10 C40 30, 35 50, 35 70 C35 85, 40 95, 50 100 C60 95, 65 85, 65 70 C65 50, 60 30, 50 10 Z;
                         M50 5 C42 28, 38 48, 38 68 C38 83, 42 93, 50 98 C58 93, 62 83, 62 68 C62 48, 58 28, 50 5 Z;
                         M50 10 C40 30, 35 50, 35 70 C35 85, 40 95, 50 100 C60 95, 65 85, 65 70 C65 50, 60 30, 50 10 Z"
                 dur="1.5s" repeatCount="indefinite" />
      </path>

      <!-- Inner flame -->
      <path d="M50 25 C45 40, 42 55, 42 70 C42 80, 45 88, 50 92 C55 88, 58 80, 58 70 C58 55, 55 40, 50 25 Z"
            fill="url(#flameGradient2)" opacity="0.85">
        <animate attributeName="d"
                 values="M50 25 C45 40, 42 55, 42 70 C42 80, 45 88, 50 92 C55 88, 58 80, 58 70 C58 55, 55 40, 50 25 Z;
                         M50 22 C46 38, 44 53, 44 68 C44 78, 46 86, 50 90 C54 86, 56 78, 56 68 C56 53, 54 38, 50 22 Z;
                         M50 25 C45 40, 42 55, 42 70 C42 80, 45 88, 50 92 C55 88, 58 80, 58 70 C58 55, 55 40, 50 25 Z"
                 dur="1.2s" repeatCount="indefinite" />
      </path>

      <!-- Core flame -->
      <path d="M50 40 C47 50, 46 60, 46 70 C46 76, 47 82, 50 85 C53 82, 54 76, 54 70 C54 60, 53 50, 50 40 Z"
            fill="url(#flameGradient3)" opacity="0.95">
        <animate attributeName="d"
                 values="M50 40 C47 50, 46 60, 46 70 C46 76, 47 82, 50 85 C53 82, 54 76, 54 70 C54 60, 53 50, 50 40 Z;
                         M50 38 C48 48, 47 58, 47 68 C47 74, 48 80, 50 83 C52 80, 53 74, 53 68 C53 58, 52 48, 50 38 Z;
                         M50 40 C47 50, 46 60, 46 70 C46 76, 47 82, 50 85 C53 82, 54 76, 54 70 C54 60, 53 50, 50 40 Z"
                 dur="0.9s" repeatCount="indefinite" />
      </path>

      <!-- Gradients -->
      <defs>
        <radialGradient id="flameGradient1" cx="50%" cy="50%">
          <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#f97316;stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:#dc2626;stop-opacity:0.7" />
        </radialGradient>
        <radialGradient id="flameGradient2" cx="50%" cy="40%">
          <stop offset="0%" style="stop-color:#fef3c7;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#fbbf24;stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:#f97316;stop-opacity:0.7" />
        </radialGradient>
        <radialGradient id="flameGradient3" cx="50%" cy="30%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
          <stop offset="40%" style="stop-color:#fef3c7;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#fbbf24;stop-opacity:0.8" />
        </radialGradient>
      </defs>

      <!-- Embers/sparks -->
      <circle cx="50" cy="80" r="2" fill="#fbbf24" opacity="0.8">
        <animate attributeName="cy" values="80;20;80" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="45" cy="75" r="1.5" fill="#f97316" opacity="0.7">
        <animate attributeName="cy" values="75;15;75" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0;0.7" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="55" cy="75" r="1.5" fill="#f97316" opacity="0.7">
        <animate attributeName="cy" values="75;15;75" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
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
