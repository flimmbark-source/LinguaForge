/**
 * LINGUA FORGE - MAIN APPLICATION
 * Entry point that initializes the game and manages the game loop
 */


import { initializeMoldSlots, STARTING_LETTERS, VERSE_COMPLETION_REWARD } from './config.js?v=9';
import { spawnLetter, randomAllowedLetter, createLetterTile } from './letters.js?v=9';
import { setMoldViewportWidth, navigatePreviousMold, navigateNextMold } from './molds.js?v=9';
import { hireScribe, updateScribes } from './scribes.js?v=9';
import { setupVerseAreaDrop, completeVerse } from './grammar.js?v=9';
import { initializeElements, updateUI } from './ui.js?v=9';
import { gameState } from './state.js?v=9';
import { addLetters } from './state.js?v=9';
import { HammerSystem } from './hammer.js?v=9';
import { PestleSystem } from './pestle.js?v=9';
import { ShovelSystem } from './shovel.js?v=9';
import { initializeHearth, updateHearth } from './RuneHearth.js?v=9';
import { initAudio, startBackgroundMusic, getMusicVolume, getSfxVolume, setMusicVolume, setSfxVolume, unlockAudio } from './audio.js?v=9';
import { addInk, addVerseWord /*, whatever else you need */ } from './state.js?v=9';
import { showUpgradeScreen, hideUpgradeScreen, updateUpgradeHeaderStats } from './upgrades.js?v=9';
import { getResourceFeedbackSystem, updateResourceFeedback, spawnResourceGain } from './resourceGainFeedback.js?v=9';
import { initMagicBook, initToolsSidebar, initMoldSidebarTab, updateSidebarToolVisibility } from './bookAndSidebar.js?v=9';
import { LetterPhysicsSystem } from './letterPhysics.js?v=9';

// Global crafting system references
let hammerSystem = null;
let pestleSystem = null;
let shovelSystem = null;
let letterPhysics = null;
let craftingCanvasRef = null;
let letterBlocksCanvasRef = null;
let activeTool = 'hammer'; // 'hammer' or 'pestle'

/**
 * Handle mold slot being filled by a letter drop.
 * Spawns renown feedback at the slot location, then updates UI.
 * @param {HTMLElement} slotEl
 */
function handleMoldSlotFilled(slotEl) {
  if (slotEl) {
    const rect = slotEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    spawnResourceGain(centerX, centerY, 2, 'renown');
  }

  updateUI();
}

function resizeLetterBlocksCanvas() {
  if (!letterBlocksCanvasRef || !craftingCanvasRef) return;
  const rect = craftingCanvasRef.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  letterBlocksCanvasRef.width = rect.width * dpr;
  letterBlocksCanvasRef.height = rect.height * dpr;
  const ctx = letterBlocksCanvasRef.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Find the fly-to target for the magical text based on the book's current state.
 *  - Book open & visible  → verse assembly area (#grammarHebrewLine)
 *  - Book out but closed   → the closed book cover
 *  - Book stowed / hidden  → the book's tool-sidebar slot (#toolSlotBook)
 * Returns { x, y } in viewport coordinates.
 */
function getMagicalTextTarget() {
  const book = document.getElementById('magicBook');
  const isHidden = !book || book.style.display === 'none';

  if (isHidden) {
    // Book is stowed — fly to the sidebar slot
    const slot = document.getElementById('toolSlotBook');
    if (slot) {
      const r = slot.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    // Last resort: top-right corner
    return { x: window.innerWidth - 40, y: window.innerHeight / 2 };
  }

  // Book is visible — if open, target the verse area; if closed, target the cover
  if (book.classList.contains('open')) {
    const verseArea = document.getElementById('grammarHebrewLine');
    if (verseArea && verseArea.offsetParent !== null) {
      const r = verseArea.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }

  // Closed or fallback — target the book element itself
  const r = book.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Spawn a "Magical Text" element that pops up above the mold, sparkles and glitters,
 * expands slightly, then shrinks and zooms into the verse book (or its sidebar slot).
 * The word is placed directly into the verse upon arrival (bypasses inventory).
 * @param {Object} word - The forged word object { text, english, length }
 * @param {DOMRect} moldBounds - Bounding rect of the mold viewport
 * @param {number} delay - Stagger delay in ms
 */
function spawnMagicalText(word, moldBounds, delay) {
  setTimeout(() => {
    // Create a wrapper to handle centering (so the animation transform doesn't fight it)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;z-index:200;pointer-events:none;';
    // Start above the mold viewport so the text pops up from it
    const startX = moldBounds.left + moldBounds.width / 2;
    const startY = moldBounds.top - 10;
    wrapper.style.left = startX + 'px';
    wrapper.style.top = startY + 'px';

    const el = document.createElement('div');
    el.className = 'magical-text phase-emerge';
    el.textContent = word.text;

    wrapper.appendChild(el);

    // Spawn sparkle particles around the text (fewer on mobile)
    const sparkleCount = isMobileDevice ? 3 + Math.floor(Math.random() * 2) : 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'magical-sparkle';
      const angle = (Math.PI * 2 * i) / sparkleCount + (Math.random() - 0.5) * 0.5;
      const dist = 20 + Math.random() * 30;
      sparkle.style.setProperty('--sparkle-dx', Math.cos(angle) * dist + 'px');
      sparkle.style.setProperty('--sparkle-dy', Math.sin(angle) * dist + 'px');
      sparkle.style.setProperty('--sparkle-duration', (0.6 + Math.random() * 0.5) + 's');
      sparkle.style.left = '50%';
      sparkle.style.top = '50%';
      sparkle.style.animationDelay = (Math.random() * 0.3) + 's';
      el.appendChild(sparkle);
    }

    document.body.appendChild(wrapper);

    // Phase 2: After emerge animation ends, shrink and zoom to target
    const emergeTime = 800;
    setTimeout(() => {
      const target = getMagicalTextTarget();

      // Switch to zoom animation and move wrapper to target
      el.classList.remove('phase-emerge');
      el.classList.add('phase-zoom');
      wrapper.style.transition = 'left 0.7s cubic-bezier(0.5, 0, 0.75, 0), top 0.7s cubic-bezier(0.5, 0, 0.75, 0)';
      wrapper.style.left = target.x + 'px';
      wrapper.style.top = target.y + 'px';

      // Spawn a second burst of sparkles for the zoom trail (fewer on mobile)
      const zoomSparkleCount = isMobileDevice ? 2 : 6;
      for (let i = 0; i < zoomSparkleCount; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'magical-sparkle';
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 25;
        sparkle.style.setProperty('--sparkle-dx', Math.cos(angle) * dist + 'px');
        sparkle.style.setProperty('--sparkle-dy', Math.sin(angle) * dist + 'px');
        sparkle.style.setProperty('--sparkle-duration', (0.4 + Math.random() * 0.3) + 's');
        sparkle.style.left = '50%';
        sparkle.style.top = '50%';
        el.appendChild(sparkle);
      }

      // On arrival: place word directly into verse (bypass inventory)
      const zoomTime = 700;
      setTimeout(() => {
        // If this word is already in the verse, skip it
        const alreadyInVerse = gameState.verseWords.some(w => w.hebrew === word.text);
        if (alreadyInVerse) {
          wrapper.remove();
          return;
        }

        const instanceId = 'vw-' + Date.now() + '-' + Math.random();
        addVerseWord({ instanceId, hebrew: word.text }, gameState.verseWords.length);
        updateUI();

        // Add a flash effect to the newly added verse chip
        const freshVerseArea = document.getElementById('grammarHebrewLine');
        if (freshVerseArea) {
          const verseChips = freshVerseArea.querySelectorAll('.line-word-chip');
          const lastChip = verseChips[verseChips.length - 1];
          if (lastChip) {
            lastChip.classList.add('verse-arrival-flash');
            lastChip.addEventListener('animationend', () => {
              lastChip.classList.remove('verse-arrival-flash');
            }, { once: true });
          }
        }

        wrapper.remove();
      }, zoomTime);
    }, emergeTime);
  }, delay);
}

/**
 * Initialize the game
 */
function initializeGame() {
  console.log('Initializing Lingua Forge...');
  // Initialize DOM element references
  initializeElements();

  // Initialize mold slots
  initializeMoldSlots();

  // Setup event handlers
  setupEventHandlers();

  // Setup drag-and-drop for verse area
  const grammarHebrewLineDiv = document.getElementById('grammarHebrewLine');
  if (grammarHebrewLineDiv) {
    setupVerseAreaDrop(grammarHebrewLineDiv, updateUI);
  }

  // Initialize crafting systems
  initializeCraftingSystems();

  // Initialize hearth system
  initializeHearth();

  // Initialize audio on first user gesture (Web Audio API requirement)
  const startAudio = async () => {
    initAudio();
    const unlocked = await unlockAudio();
    if (unlocked) {
      startBackgroundMusic();
    }
    document.removeEventListener('pointerdown', startAudio);
    document.removeEventListener('touchstart', startAudio);
    document.removeEventListener('keydown', startAudio);
  };
  document.addEventListener('pointerdown', startAudio, { once: true });
  document.addEventListener('touchstart', startAudio, { once: true });
  document.addEventListener('keydown', startAudio, { once: true });

  // Setup tool selection
  setupToolSelection();

  // Initialize magic book, tools sidebar, and mold tab
  initMagicBook();
  initMoldSidebarTab();
  initToolsSidebar(
    // onToolSelected: pull a tool out to use it
    (toolName, dropX, dropY) => {
      const btnMap = {
        hammer: document.getElementById('selectHammer'),
        pestle: document.getElementById('selectPestle'),
        shovel: document.getElementById('selectShovel')
      };
      const btn = btnMap[toolName];
      if (btn) btn.click();

      // Position the tool at the drop location (convert screen coords to canvas coords)
      const craftingCanvas = document.getElementById('craftingCanvas');
      if (craftingCanvas && dropX != null && dropY != null) {
        const rect = craftingCanvas.getBoundingClientRect();
        const canvasX = dropX - rect.left;
        const canvasY = dropY - rect.top;

        if (toolName === 'hammer' && hammerSystem) {
          hammerSystem.hammer.pivotX = canvasX;
          hammerSystem.hammer.pivotY = canvasY;
          hammerSystem.hammer.headX = canvasX;
          hammerSystem.hammer.headY = canvasY + hammerSystem.hammer.length;
          hammerSystem.hammer.prevHeadX = hammerSystem.hammer.headX;
          hammerSystem.hammer.prevHeadY = hammerSystem.hammer.headY;
        }
        if (toolName === 'pestle' && pestleSystem) {
          pestleSystem.pestle.pivotX = canvasX;
          pestleSystem.pestle.pivotY = canvasY;
          pestleSystem.pestle.headX = canvasX;
          pestleSystem.pestle.headY = canvasY + pestleSystem.pestle.constantLength;
          pestleSystem.pestle.prevHeadX = pestleSystem.pestle.headX;
          pestleSystem.pestle.prevHeadY = pestleSystem.pestle.headY;
        }
        if (toolName === 'shovel' && shovelSystem) {
          shovelSystem.shovel.pivotX = canvasX;
          shovelSystem.shovel.pivotY = canvasY;
          shovelSystem.shovel.headX = canvasX;
          shovelSystem.shovel.headY = canvasY + (shovelSystem.shovel.length || 120);
        }
      }
    },
    // onToolPutAway: drop a tool back in the sidebar to stow it
    (toolName) => {
      if (toolName === 'hammer' && hammerSystem) hammerSystem.stop();
      if (toolName === 'pestle' && pestleSystem) pestleSystem.stop();
      if (toolName === 'shovel' && shovelSystem) shovelSystem.stop();

      // Clear the active tool if we just put away the one that was active
      if (activeTool === toolName) {
        activeTool = null;
      }

      // Also clear active state on hidden tool buttons
      const btn = document.getElementById(
        toolName === 'hammer' ? 'selectHammer' :
        toolName === 'pestle' ? 'selectPestle' :
        toolName === 'shovel' ? 'selectShovel' : ''
      );
      if (btn) btn.classList.remove('active');

      console.log('Put away tool:', toolName);
    }
  );

  // Spawn starting letters
  for (let i = 0; i < STARTING_LETTERS; i++) {
    spawnLetter(handleMoldSlotFilled);
  }

  // Set mold viewport width
  setMoldViewportWidth();

  // Initial UI update
  updateUI();
  console.log('Lingua Forge initialization complete!');
}

/**
 * Initialize crafting systems (hammer and pestle)
 */
function initializeCraftingSystems() {
  const craftingCanvas = document.getElementById('craftingCanvas');
  if (!craftingCanvas) {
    console.warn('Crafting canvas not found');
    return;
  }
  craftingCanvasRef = craftingCanvas;
  letterBlocksCanvasRef = document.getElementById('letterBlocksCanvas');
  if (!letterBlocksCanvasRef) {
    console.warn('Letter blocks canvas not found');
  } else {
    resizeLetterBlocksCanvas();
    window.addEventListener('resize', resizeLetterBlocksCanvas);
  }

  // Create hammer system with callbacks
  hammerSystem = new HammerSystem(craftingCanvas);

  // Callback when hammer strikes anvil - spawn flying physics letters
  hammerSystem.onLetterForged = (impactX, impactY, power, strikeVx, multiplier = 1) => {
    // Spawn letters based on lettersPerClick and multiplier
    // On mobile, cap total spawned per strike to keep framerate smooth
    const rawTotal = gameState.lettersPerClick * multiplier;
    const totalLetters = isMobileDevice ? Math.min(rawTotal, 6) : rawTotal;
    for (let i = 0; i < totalLetters; i++) {
      // Get random Hebrew letter
      const letterChar = randomAllowedLetter();

      // Slight delay between multiple letters for visual effect (shorter on mobile)
      const delay = isMobileDevice ? i * 30 : i * 50;
      setTimeout(() => {
        hammerSystem.spawnFlyingLetter(impactX, impactY, power, strikeVx, letterChar);
      }, delay);
    }

    // Hide hint after first strike
    const hint = document.getElementById('craftingHint');
    if (hint && !hint.classList.contains('hidden')) {
      hint.classList.add('hidden');
    }
  };

  // Callback when letter lands in pool - create DOM tile
  hammerSystem.onLetterLanded = (letterChar, canvasX, canvasY) => {
    addLetters(1);

    // Spawn resource gain feedback at letter position
    const craftingCanvas = document.getElementById('craftingCanvas');
    if (craftingCanvas) {
      const rect = craftingCanvas.getBoundingClientRect();
      const screenX = rect.left + canvasX;
      const screenY = rect.top + canvasY;
      spawnResourceGain(screenX, screenY, 1, 'renown');
    }

    const letterPoolDiv = document.getElementById('letterPool');
    if (!letterPoolDiv) return;

    // Check if we already have a tile with this character (stack them)
    const existing = Array.from(letterPoolDiv.children).find(
      el => el.classList && el.classList.contains('letter-tile') && el.dataset.letterChar === letterChar
    );

    if (existing) {
      const current = parseInt(existing.dataset.count || '1', 10);
      existing.dataset.count = String(current + 1);
      // Update the label to show new count
      const char = existing.dataset.letterChar || '';
      existing.innerHTML = '<span>' + char + '</span>';
      if (current + 1 > 1) {
        const badge = document.createElement('span');
        badge.className = 'letter-count';
        badge.textContent = 'x' + (current + 1);
        existing.appendChild(badge);
      }

      // Briefly highlight the existing tile
      existing.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
      existing.style.transform = 'scale(1.3)';
      existing.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.6)';
      setTimeout(() => {
        existing.style.transform = '';
        existing.style.boxShadow = '';
      }, 200);
    } else {
      // Create new tile
      const tile = createLetterTile(letterChar, handleMoldSlotFilled);
      letterPoolDiv.appendChild(tile);

      // Brief entrance animation
      tile.style.transition = 'transform 0.2s ease';
      tile.style.transform = 'scale(0)';
      setTimeout(() => {
        tile.style.transform = 'scale(1)';
      }, 10);
      setTimeout(() => {
        tile.style.transition = '';
      }, 210);
    }

    updateUI();
  };

  // Callback when red-hot hammer strikes mold viewport - forge words as magical text
  hammerSystem.onForgeTriggered = () => {
    // Forge completed molds but DON'T add words to inventory — they go
    // straight to the verse via the magical text animation instead.
    const forgedWords = [];
    gameState.currentLine.molds.forEach(mold => {
      if (mold.slots.every(slot => slot)) {
        forgedWords.push({ text: mold.pattern, english: mold.english, length: mold.pattern.length });
        mold.slots = new Array(mold.pattern.length).fill(false);
      }
    });

    // Spawn magical text animations that fly into the verse book
    if (forgedWords.length > 0) {
      const moldViewport = document.querySelector('.mold-viewport');
      if (moldViewport) {
        const moldBounds = moldViewport.getBoundingClientRect();
        forgedWords.forEach((word, index) => {
          // Grant renown (same as chip system did)
          const renownGained = word.length * 2;
          addLetters(renownGained);
          const screenX = moldBounds.left + moldBounds.width / 2;
          const screenY = moldBounds.top + moldBounds.height / 2;
          spawnResourceGain(screenX, screenY, renownGained, 'renown');

          // Spawn magical text with stagger
          spawnMagicalText(word, moldBounds, index * 300);
        });
      }
    }

    updateUI();
  };

  // Initialize letter physics system (thrown letter blocks)
  letterPhysics = new LetterPhysicsSystem();
  window.letterPhysics = letterPhysics;
  letterPhysics.onSlotFilled = handleMoldSlotFilled;

  // Overlay renderer: draw physics letters on the letter blocks canvas
  const renderPhysicsLetters = () => {
    if (!letterBlocksCanvasRef) return;
    const ctx = letterBlocksCanvasRef.getContext('2d');
    ctx.clearRect(0, 0, letterBlocksCanvasRef.width, letterBlocksCanvasRef.height);
    if (!letterPhysics || letterPhysics.letters.length === 0) return;
    try {
      ctx.save();
      letterPhysics.render(ctx);
      ctx.restore();
    } catch (e) {
      console.warn('Physics letter render error:', e);
    }
  };

  // Create pestle system with callbacks
  pestleSystem = new PestleSystem(craftingCanvas);
  if (typeof pestleSystem.setOverlayRenderer === 'function') {
    pestleSystem.setOverlayRenderer(renderPhysicsLetters);
  } else {
    pestleSystem.overlayRenderer = renderPhysicsLetters;
  }

  // Callback when ink is produced
  pestleSystem.onInkProduced = (letter, canvasX, canvasY) => {
    const inkAmount = gameState.inkPerChurn;
    addInk(inkAmount);

    // Spawn resource gain feedback at pestle tip position
    const craftingCanvas = document.getElementById('craftingCanvas');
    if (craftingCanvas) {
      const rect = craftingCanvas.getBoundingClientRect();
      const screenX = rect.left + canvasX;
      const screenY = rect.top + canvasY;
      spawnResourceGain(screenX, screenY, inkAmount, 'ink');
    }

    updateUI();
    console.log('Produced', inkAmount, 'ink from letter:', letter);
  };

  // Start with hammer active
  hammerSystem.setOverlayRenderer(renderPhysicsLetters);
  hammerSystem.start();
  // Create and start shovel (initialized but not active by default)
  shovelSystem = new ShovelSystem(craftingCanvas);
  shovelSystem.setOverlayRenderer(renderPhysicsLetters);
  // do not start shovel until selected

  // Wire up put-away callbacks: when a tool is released near the sidebar, stow it
  function makePutAwayHandler(toolName) {
    return () => {
      console.log('Tool put away via canvas drag:', toolName);
      if (toolName === 'hammer' && hammerSystem) hammerSystem.stop();
      if (toolName === 'pestle' && pestleSystem) pestleSystem.stop();
      if (toolName === 'shovel' && shovelSystem) shovelSystem.stop();
      if (activeTool === toolName) activeTool = null;
      // Update sidebar slot
      const slotId = toolName === 'hammer' ? 'toolSlotHammer' :
                     toolName === 'pestle' ? 'toolSlotPestle' :
                     toolName === 'shovel' ? 'toolSlotShovel' : '';
      const slot = document.getElementById(slotId);
      if (slot) slot.classList.remove('active');
      // Update hidden button
      const btnId = toolName === 'hammer' ? 'selectHammer' :
                    toolName === 'pestle' ? 'selectPestle' :
                    toolName === 'shovel' ? 'selectShovel' : '';
      const btn = document.getElementById(btnId);
      if (btn) btn.classList.remove('active');
    };
  }
  hammerSystem.onPutAway = makePutAwayHandler('hammer');
  pestleSystem.onPutAway = makePutAwayHandler('pestle');
  shovelSystem.onPutAway = makePutAwayHandler('shovel');

  console.log('Crafting systems initialized');
}

/**
 * Setup tool selection handlers
 */
function setupToolSelection() {
  const hammerBtn = document.getElementById('selectHammer');
  const pestleBtn = document.getElementById('selectPestle');
  const shovelBtn = document.getElementById('selectShovel');
  const craftingHint = document.getElementById('craftingHint');
  if (!hammerBtn || !pestleBtn || !shovelBtn) return;

  hammerBtn.addEventListener('click', () => {
    if (activeTool === 'hammer') return;

    activeTool = 'hammer';
    hammerBtn.classList.add('active');
    pestleBtn.classList.remove('active');
    shovelBtn.classList.remove('active');

    // Switch systems
    if (shovelSystem) shovelSystem.stop();
    if (pestleSystem) pestleSystem.stop();
    if (hammerSystem) hammerSystem.start();

    // Update hint text
    if (craftingHint) {
      craftingHint.textContent = '';
      craftingHint.classList.remove('hidden');
    }

    console.log('Switched to Hammer');
  });

  pestleBtn.addEventListener('click', () => {
    if (activeTool === 'pestle') return;

    activeTool = 'pestle';
    shovelBtn.classList.remove('active');
    pestleBtn.classList.add('active');
    hammerBtn.classList.remove('active');

    // Switch systems
    if (hammerSystem) hammerSystem.stop();
    if (shovelSystem) shovelSystem.stop();
    if (pestleSystem) pestleSystem.start();

    // Update hint text
    if (craftingHint) {
      craftingHint.textContent = '';
      craftingHint.classList.remove('hidden');
    }

    console.log('Switched to Pestle & Mortar');
  });

  shovelBtn.addEventListener('click', () => {
    if (activeTool === 'shovel') return;

    activeTool = 'shovel';
    shovelBtn.classList.add('active');
    hammerBtn.classList.remove('active');
    pestleBtn.classList.remove('active');

    // Switch systems
    if (hammerSystem) hammerSystem.stop();
    if (pestleSystem) pestleSystem.stop();
    if (shovelSystem) shovelSystem.start();

    // Update hint text
    if (craftingHint) {
      craftingHint.textContent = '';
      craftingHint.classList.remove('hidden');
    }

    console.log('Switched to Shovel');
  });
}

/**
 * Setup all event handlers for buttons and interactions
 */
function setupEventHandlers() {
  // Hammer system replaces the strike button (initialized separately)

  // Buy scribe button
  const buyScribeBtn = document.getElementById('buyScribeBtn');
  if (buyScribeBtn) {
    buyScribeBtn.addEventListener('click', () => {
      if (hireScribe()) {
        updateUI();
      }
    });
  }

  // Mold navigation buttons
  const prevMoldBtn = document.getElementById('prevMoldBtn');
  const nextMoldBtn = document.getElementById('nextMoldBtn');
  if (prevMoldBtn && nextMoldBtn) {
    prevMoldBtn.addEventListener('click', () => {
      navigatePreviousMold();
      updateUI();
    });
    nextMoldBtn.addEventListener('click', () => {
      navigateNextMold();
      updateUI();
    });
  }

  // Audio controls
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const audioControls = document.getElementById('audioControls');
  const musicVolumeSlider = document.getElementById('musicVolumeSlider');
  const sfxVolumeSlider = document.getElementById('sfxVolumeSlider');
  const musicVolumeValue = document.getElementById('musicVolumeValue');
  const sfxVolumeValue = document.getElementById('sfxVolumeValue');
  if (audioToggleBtn && audioControls) {
    const stopAudioPanelClick = (event) => {
      event.stopPropagation();
    };
    const stopAudioPanelPointer = (event) => {
      event.stopPropagation();
    };
    const stopAudioTogglePointer = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    const updateVolumeDisplay = (slider, valueEl) => {
      if (!slider || !valueEl) return;
      valueEl.textContent = `${Math.round(parseFloat(slider.value) * 100)}%`;
    };

    const syncVolumeSliders = () => {
      if (musicVolumeSlider) musicVolumeSlider.value = getMusicVolume();
      if (sfxVolumeSlider) sfxVolumeSlider.value = getSfxVolume();
      updateVolumeDisplay(musicVolumeSlider, musicVolumeValue);
      updateVolumeDisplay(sfxVolumeSlider, sfxVolumeValue);
    };

    syncVolumeSliders();

    audioToggleBtn.addEventListener('pointerdown', stopAudioTogglePointer);
    audioToggleBtn.addEventListener('mousedown', stopAudioTogglePointer);
    audioToggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      audioControls.classList.toggle('hidden');
      if (!audioControls.classList.contains('hidden')) {
        syncVolumeSliders();
      }
    });

    audioControls.addEventListener('pointerdown', stopAudioPanelPointer);
    audioControls.addEventListener('mousedown', stopAudioPanelPointer);
    audioControls.addEventListener('click', stopAudioPanelClick);

    document.addEventListener('click', (event) => {
      if (audioControls.classList.contains('hidden')) return;
      if (!audioControls.contains(event.target) && !audioToggleBtn.contains(event.target)) {
        audioControls.classList.add('hidden');
      }
    });

    if (musicVolumeSlider) {
      musicVolumeSlider.addEventListener('input', () => {
        const value = parseFloat(musicVolumeSlider.value);
        setMusicVolume(value);
        updateVolumeDisplay(musicVolumeSlider, musicVolumeValue);
      });
    }

    if (sfxVolumeSlider) {
      sfxVolumeSlider.addEventListener('input', () => {
        const value = parseFloat(sfxVolumeSlider.value);
        setSfxVolume(value);
        updateVolumeDisplay(sfxVolumeSlider, sfxVolumeValue);
      });
    }
  }

  // Fullscreen toggle (mobile)
  const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');
  if (fullscreenToggleBtn) {
    const iconEl = fullscreenToggleBtn.querySelector('.fullscreen-toggle-icon');
    const supportsFullscreen = !!document.documentElement.requestFullscreen && !!document.exitFullscreen;

    const updateFullscreenLabel = () => {
      const isFullscreen = !!document.fullscreenElement;
      fullscreenToggleBtn.classList.toggle('is-active', isFullscreen);
      if (iconEl) {
        iconEl.textContent = isFullscreen ? '⤢' : '⛶';
      }
    };

    if (!supportsFullscreen) {
      fullscreenToggleBtn.disabled = true;
      fullscreenToggleBtn.classList.add('disabled');
    } else {
      fullscreenToggleBtn.addEventListener('click', async () => {
        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen();
          } else {
            await document.documentElement.requestFullscreen();
          }
        } catch (error) {
          console.warn('Fullscreen toggle failed', error);
        }
      });
      document.addEventListener('fullscreenchange', updateFullscreenLabel);
      updateFullscreenLabel();
    }
  }

  // Forge words button removed - now triggered by red-hot hammer hitting mold viewport

  // Enscribe button - complete verse
  const enscribeBtn = document.getElementById('enscribeBtn');
  if (enscribeBtn) {
    enscribeBtn.addEventListener('click', () => {
      if (completeVerse()) {
        // Spawn resource gain feedback at verse area center
        const grammarHebrewLineDiv = document.getElementById('grammarHebrewLine');
        if (grammarHebrewLineDiv) {
          const rect = grammarHebrewLineDiv.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          spawnResourceGain(centerX, centerY, VERSE_COMPLETION_REWARD, 'ink');
        }

        alert('Verse completed! You gain ' + VERSE_COMPLETION_REWARD + ' Ink (prototype value).');
        updateUI();
      }
    });
  }

  // Upgrades button
  const upgradesBtn = document.getElementById('upgradesBtn');
  if (upgradesBtn) {
    upgradesBtn.addEventListener('click', () => {
      showUpgradeScreen();
    });
  }

  // Close upgrade modal button
  const closeUpgradeBtn = document.getElementById('closeUpgradeBtn');
  if (closeUpgradeBtn) {
    closeUpgradeBtn.addEventListener('click', () => {
      hideUpgradeScreen();
    });
  }

  // Close modal when clicking outside
  const upgradeModal = document.getElementById('upgradeModal');
  if (upgradeModal) {
    upgradeModal.addEventListener('click', (e) => {
      if (e.target === upgradeModal) {
        hideUpgradeScreen();
      }
    });
  }
}

/**
 * Game loop - runs every frame
 */
let lastTime = performance.now();
let uiThrottleAcc = 0;       // accumulate time between UI updates
const UI_INTERVAL = 0.25;    // update UI at most 4×/sec
let cachedCanvasRect = null;
let canvasRectAge = 0;
const RECT_CACHE_MS = 200;   // refresh canvas rect every 200ms

// ── Mobile performance helpers ──────────────────────────────
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

// On mobile, skip expensive collision checks every other frame
let physicsFrameCount = 0;

// Throttle mold-slot and hearth collision checks on mobile (every 3rd frame)
const COLLISION_SKIP = isMobileDevice ? 3 : 1;

// Cache letterPool element reference to avoid repeated getElementById
let _letterPoolRef = null;
function getLetterPool() {
  if (!_letterPoolRef || !_letterPoolRef.isConnected) {
    _letterPoolRef = document.getElementById('letterPool');
  }
  return _letterPoolRef;
}

function gameLoop(timestamp) {
  const rawDt = (timestamp - lastTime) / 1000;
  // Clamp dt to avoid spiral-of-death on slow devices
  const dt = Math.min(rawDt, 0.05);
  lastTime = timestamp;

  physicsFrameCount++;

  // Update hearth
  updateHearth(dt);

  // Update scribes
  if (gameState.scribeList.length > 0) {
    updateScribes(dt, handleMoldSlotFilled);
  }

  // Update physics letters
  if (letterPhysics) {
    try {
      letterPhysics.update(dt, window.innerWidth, window.innerHeight);

      // On mobile, run expensive collision checks less frequently
      if (physicsFrameCount % COLLISION_SKIP === 0) {
        letterPhysics.checkMoldSlots();
        letterPhysics.checkHearth();
      }

      letterPhysics.checkBasket((char) => {
        // Return the letter to the basket DOM as a tile
        addLetters(1);
        const letterPoolDiv = getLetterPool();
        if (!letterPoolDiv) return;
        const existing = Array.from(letterPoolDiv.children).find(
          el => el.classList && el.classList.contains('letter-tile') && el.dataset.letterChar === char
        );
        if (existing) {
          const current = parseInt(existing.dataset.count || '1', 10);
          existing.dataset.count = String(current + 1);
          existing.innerHTML = '<span>' + (existing.dataset.letterChar || '') + '</span>';
          if (current + 1 > 1) {
            const badge = document.createElement('span');
            badge.className = 'letter-count';
            badge.textContent = 'x' + (current + 1);
            existing.appendChild(badge);
          }
        } else {
          const tile = createLetterTile(char, handleMoldSlotFilled);
          letterPoolDiv.appendChild(tile);
        }
      });

      // Cache canvas rect (avoid per-frame getBoundingClientRect)
      // On mobile, refresh less frequently (400ms)
      const rectCacheInterval = isMobileDevice ? 400 : RECT_CACHE_MS;
      canvasRectAge += dt * 1000;
      if (!cachedCanvasRect || canvasRectAge > rectCacheInterval) {
        if (craftingCanvasRef) cachedCanvasRect = craftingCanvasRef.getBoundingClientRect();
        canvasRectAge = 0;
      }

      // Hammer pushes nearby physics letters
      if (hammerSystem && hammerSystem.isRunning && cachedCanvasRect) {
        const hx = cachedCanvasRect.left + hammerSystem.hammer.headX;
        const hy = cachedCanvasRect.top + hammerSystem.hammer.headY;
        letterPhysics.pushFrom(hx, hy, 45, hammerSystem.hammer.headVx || 0, hammerSystem.hammer.headVy || 0);
      }

      // Render physics letters when no tool is active
      if (letterBlocksCanvasRef) {
        const anyToolRunning = hammerSystem?.isRunning || pestleSystem?.isRunning || shovelSystem?.isRunning;
        if (!anyToolRunning) {
          const ctx = letterBlocksCanvasRef.getContext('2d');
          ctx.clearRect(0, 0, letterBlocksCanvasRef.width, letterBlocksCanvasRef.height);
          if (letterPhysics.letters.length > 0) {
            letterPhysics.render(ctx);
          }
        }
      }
    } catch (e) {
      console.warn('Physics update error:', e);
    }
  }

  // Update resource gain feedback
  updateResourceFeedback(dt);

  // Throttle UI updates (expensive DOM reads) - slower on mobile (~3×/sec)
  const uiInterval = isMobileDevice ? 0.33 : UI_INTERVAL;
  uiThrottleAcc += dt;
  if (uiThrottleAcc >= uiInterval) {
    uiThrottleAcc = 0;
    updateUI();
    updateUpgradeHeaderStats();
  }

  // Continue loop
  requestAnimationFrame(gameLoop);
}

/**
 * Start the application
 */
function start() {
  initializeGame();
  requestAnimationFrame(gameLoop);
}

// Expose updateUI globally for upgrade system
window.updateUI = updateUI;

// Expose a helper so the book drag can yield to active tools
window.isPointOnActiveTool = function(clientX, clientY) {
  const canvas = document.getElementById('craftingCanvas');
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;

  if (hammerSystem && hammerSystem.isRunning) {
    if (hammerSystem.isPointNearHammer(cx, cy)) return true;
  }
  if (pestleSystem && pestleSystem.isRunning) {
    if (pestleSystem.isPointNearPestle(cx, cy)) return true;
  }
  if (shovelSystem && shovelSystem.isRunning) {
    // Use a simple distance check to the shovel pivot/head area
    const s = shovelSystem.shovel;
    const dx = cx - s.headX;
    const dy = cy - s.headY;
    if (Math.hypot(dx, dy) < 100) return true;
    const dp = cx - s.pivotX;
    const dq = cy - s.pivotY;
    if (Math.hypot(dp, dq) < 100) return true;
  }
  return false;
};

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
