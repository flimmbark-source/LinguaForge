/**
 * LINGUA FORGE - UI RENDERING
 * Handles all UI updates and rendering logic
 */

import { getScribeCost, SCRIBE_GHOST_LIFETIME, GRAMMAR_LEXICON } from './config.js';
import { gameState } from './state.js';
import { setupWordChipDrag, sellWord } from './molds.js';
import { toggleScribePaused } from './scribes.js';
import { evaluateVerse, setupVerseWordChipDrag, isVerseSolved } from './grammar.js';

// DOM element cache
const elements = {};

// Track last rendered verse state to avoid unnecessary recreations
let lastRenderedVerseWords = [];

// Track last rendered scribe state to avoid unnecessary recreations
let lastRenderedScribes = [];

/**
 * Initialize DOM element references
 */
export function initializeElements() {
  elements.lettersDisplay = document.getElementById('lettersDisplay');
  elements.inkDisplay = document.getElementById('inkDisplay');
  elements.clickGainSpan = document.getElementById('clickGain');
  elements.scribeCostSpan = document.getElementById('scribeCost');
  elements.buyScribeBtn = document.getElementById('buyScribeBtn');
  elements.scribeBlocksContainer = document.getElementById('scribeBlocks');
  elements.moldListDiv = document.getElementById('moldList');
  elements.moldIndexLabel = document.getElementById('moldIndexLabel');
  elements.wordListDiv = document.getElementById('wordList');
  elements.enscribeBtn = document.getElementById('enscribeBtn');
  elements.linesCompletedSpan = document.getElementById('linesCompleted');
  elements.grammarHebrewLineDiv = document.getElementById('grammarHebrewLine');
  elements.grammarTranslitDiv = document.getElementById('grammarTranslit');
  elements.grammarLiteralDiv = document.getElementById('grammarLiteral');
  elements.grammarNaturalDiv = document.getElementById('grammarNatural');
  elements.grammarScoreDiv = document.getElementById('grammarScore');
  elements.pestle = document.getElementById('selectPestle');
}

/**
 * Update core stats display (letters, ink)
 */
export function updateStatsDisplay() {
  if (elements.lettersDisplay) {
    elements.lettersDisplay.textContent = Math.floor(gameState.letters);
  }
  if (elements.inkDisplay) {
    elements.inkDisplay.textContent = Math.floor(gameState.ink);
  }
  if (elements.clickGainSpan) {
    elements.clickGainSpan.textContent = gameState.lettersPerClick;
  }

  // Update hearth visibility based on unlock state
  updateHearthVisibility();
  // Update scribe visibility based on unlock state
  updateScribeVisibility();
  // Update pestle visibility based on unlock state
  updatePestleVisibility();

}

/**
 * Update hearth visibility based on unlock state
 */
function updateHearthVisibility() {
  const hearthWrapper = document.querySelector('.hearth-wrapper');
  if (hearthWrapper) {
    if (gameState.hearthUnlocked) {
      hearthWrapper.style.display = 'block';
    } else {
      hearthWrapper.style.display = 'none';
    }
  }
}

/**
 * Update scribe section visibility based on unlock state
 */
function updateScribeVisibility() {
  const scribeSection = document.querySelector('.section:has(#scribeBlocks)');
  if (scribeSection) {
    if (gameState.scribesUnlocked) {
      scribeSection.style.display = 'block';
    } else {
      scribeSection.style.display = 'none';
    }
  }
}

/*
 * Update pestle visibility based on unlock state
 */
function updatePestleVisibility() {
  if (!elements.pestle) return;

  if (gameState.pestleUnlocked) {
    elements.pestle.style.display = '';
  } else {
    elements.pestle.style.display = 'none';
  }
}


/**
 * Update scribe purchase button
 */
export function updateScribePurchaseButton() {
  const cost = getScribeCost(gameState.scribeList.length);
  if (elements.scribeCostSpan) {
    elements.scribeCostSpan.textContent = cost;
  }
  if (elements.buyScribeBtn) {
    // Disable if not unlocked or can't afford
    elements.buyScribeBtn.disabled = !gameState.scribesUnlocked || gameState.letters < cost;
  }
}

/**
 * Render mold display (current mold with slots)
 */
export function renderMolds() {
  if (!elements.moldListDiv) return;
  elements.moldListDiv.innerHTML = '';
  if (!gameState.currentLine.molds.length) return;

  // Ensure index is valid
  if (gameState.currentMoldIndex < 0) gameState.currentMoldIndex = 0;
  if (gameState.currentMoldIndex >= gameState.currentLine.molds.length) {
    gameState.currentMoldIndex = gameState.currentLine.molds.length - 1;
  }

  const mold = gameState.currentLine.molds[gameState.currentMoldIndex];

  // Create mold card
  const card = document.createElement('div');
  card.className = 'mold-card';
  card.dataset.moldId = String(mold.id);

  // Header
  const header = document.createElement('div');
  header.className = 'mold-header';
  const left = document.createElement('div');
  left.textContent = mold.english;
  const right = document.createElement('div');
  right.style.fontSize = '11px';
  right.style.opacity = '0.8';
  const filledCount = mold.slots.filter(x => x).length;
  right.textContent = filledCount + '/' + mold.slots.length + ' letters';
  header.appendChild(left);
  header.appendChild(right);

  // Slots
  const slotsRow = document.createElement('div');
  slotsRow.className = 'mold-slots';

  const chars = mold.pattern.split('');
  chars.forEach((ch, idx) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.moldId = String(mold.id);
    slot.dataset.slotIndex = String(idx);
    slot.textContent = ch;

    if (mold.slots[idx]) {
      slot.classList.add('filled');
      slot.style.opacity = '1';
    } else {
      slot.style.opacity = '0.4';
    }

    slotsRow.appendChild(slot);
  });

  card.appendChild(header);
  card.appendChild(slotsRow);
  elements.moldListDiv.appendChild(card);

  // Update index label
  if (elements.moldIndexLabel) {
    elements.moldIndexLabel.textContent = (gameState.currentMoldIndex + 1) + ' / ' + gameState.currentLine.molds.length;
  }
}

/**
 * Render word inventory list
 */
export function renderWordList() {
  if (!elements.wordListDiv) return;
  elements.wordListDiv.innerHTML = '';

  if (gameState.words.length === 0) {
    const empty = document.createElement('div');
    empty.style.opacity = '0.6';
    empty.style.fontSize = '12px';
    empty.textContent = 'No words forged yet.';
    elements.wordListDiv.appendChild(empty);
    return;
  }

  gameState.words.forEach(word => {
    const card = document.createElement('div');
    card.className = 'word-card';

    // Left side: word chip + gloss
    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '6px';

    const chip = document.createElement('div');
    chip.className = 'line-word-chip';
    chip.style.direction = 'rtl';
    chip.textContent = word.text;
    chip.dataset.wordId = String(word.id);
    setupWordChipDrag(chip, word.id);
    left.appendChild(chip);

    const gloss = document.createElement('span');
    gloss.style.fontSize = '11px';
    gloss.style.opacity = '0.8';
    // Show transliteration from lexicon, or fall back to Hebrew text
    const lexiconEntry = GRAMMAR_LEXICON[word.text];
    gloss.textContent = lexiconEntry ? lexiconEntry.translit : word.text;
    left.appendChild(gloss);

    // Right side: sell button
    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '4px';

    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Sell';
    sellBtn.className = 'sell-btn';
    sellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const success = sellWord(word.id);
      if (success) {
        updateUI();
      }
    });
    right.appendChild(sellBtn);

    card.appendChild(left);
    card.appendChild(right);
    elements.wordListDiv.appendChild(card);
  });
}

/**
 * Check if scribe list has changed since last render
 * @returns {boolean} True if scribes changed
 */
function scribesChanged() {
  if (gameState.scribeList.length !== lastRenderedScribes.length) return true;

  for (let i = 0; i < gameState.scribeList.length; i++) {
    const current = gameState.scribeList[i];
    const last = lastRenderedScribes[i];
    if (current.id !== last.id || current.paused !== last.paused) return true;
  }

  return false;
}

/**
 * Render scribe blocks with progress bars
 * @param {boolean} force - Force re-render even if scribes haven't changed
 */
export function renderScribeBlocks(force = false) {
  if (!elements.scribeBlocksContainer) return;

  // Only recreate blocks if scribes actually changed (unless forced)
  if (!force && !scribesChanged()) {
    // Update progress bars and paused state without recreating blocks
    gameState.scribeList.forEach((scribe, index) => {
      const block = elements.scribeBlocksContainer.children[index];
      if (block) {
        // Update progress bar
        const progress = block.querySelector('.scribe-progress');
        if (progress) {
          const clamped = Math.max(0, Math.min(1, scribe.progress));
          progress.style.height = (clamped * 100).toFixed(1) + '%';
        }
        // Update paused class
        if (scribe.paused) {
          block.classList.add('paused');
        } else {
          block.classList.remove('paused');
        }
      }
    });
    return;
  }

  elements.scribeBlocksContainer.innerHTML = '';

  gameState.scribeList.forEach(scribe => {
    const block = document.createElement('div');
    block.className = 'scribe-block';
    if (scribe.paused) {
      block.classList.add('paused');
    }

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'scribe-progress';
    const clamped = Math.max(0, Math.min(1, scribe.progress));
    progress.style.height = (clamped * 100).toFixed(1) + '%';
    block.appendChild(progress);

    // Icon
    const icon = document.createElement('div');
    icon.className = 'scribe-icon';
    icon.textContent = '✒️';
    block.appendChild(icon);

    // Ghost (floating "+1 Letter" animation)
    const ghost = gameState.scribeGhosts.find(g => g.scribeId === scribe.id);
    if (ghost) {
      const ghostEl = document.createElement('div');
      ghostEl.className = 'scribe-ghost';
      const ratio = Math.max(0, Math.min(1, ghost.t / SCRIBE_GHOST_LIFETIME));
      const opacity = 1 - ratio;
      const offset = -6 - 10 * ratio;
      ghostEl.style.opacity = opacity.toFixed(2);
      ghostEl.style.transform = 'translate(-50%, ' + offset + 'px)';
      ghostEl.textContent = '+1 Letter';
      block.appendChild(ghostEl);
    }

    // Click to toggle pause
    block.addEventListener('click', (e) => {
      console.log('Scribe block clicked! ID:', scribe.id, 'Paused:', scribe.paused);
      toggleScribePaused(scribe.id);
      console.log('After toggle, paused:', gameState.scribeList.find(s => s.id === scribe.id)?.paused);
      renderScribeBlocks(true); // Force re-render after pause toggle
    });

    elements.scribeBlocksContainer.appendChild(block);
  });

  // Update our tracking state
  lastRenderedScribes = gameState.scribeList.map(s => ({ id: s.id, paused: s.paused }));
}

/**
 * Check if verse words have changed since last render
 * @returns {boolean} True if verse words changed
 */
function verseWordsChanged() {
  if (gameState.verseWords.length !== lastRenderedVerseWords.length) return true;

  for (let i = 0; i < gameState.verseWords.length; i++) {
    if (gameState.verseWords[i].instanceId !== lastRenderedVerseWords[i].instanceId) return true;
  }

  return false;
}

/**
 * Render verse word chips (only when verse changes)
 * @param {boolean} force - Force re-render even if verse hasn't changed
 */
function renderVerseChips(force = false) {
  if (!elements.grammarHebrewLineDiv) return;

  // Only recreate chips if verse actually changed (unless forced)
  if (!force && !verseWordsChanged()) return;

  elements.grammarHebrewLineDiv.innerHTML = '';

  // Render verse word chips
  gameState.verseWords.forEach(wordInstance => {
    const chip = document.createElement('div');
    chip.className = 'line-word-chip';
    chip.style.direction = 'rtl';
    chip.textContent = wordInstance.hebrew;
    chip.dataset.instanceId = wordInstance.instanceId;
    setupVerseWordChipDrag(chip, wordInstance.instanceId, () => updateGrammarUI(true));

    // Allow dragover for inventory words to be dropped between existing chips
    // This makes chips valid drop targets so position detection works correctly
    chip.addEventListener('dragover', e => {
      e.preventDefault();
    });

    elements.grammarHebrewLineDiv.appendChild(chip);
  });

  // Update our tracking state
  lastRenderedVerseWords = gameState.verseWords.map(w => ({ instanceId: w.instanceId }));
}

/**
 * Update grammar/verse UI
 * @param {boolean} force - Force chip re-render (used after drag operations)
 */
export function updateGrammarUI(force = false) {
  if (!elements.grammarHebrewLineDiv) return;

  // Only recreate chips when needed (or forced after drag)
  renderVerseChips(force);

  // Always evaluate and update text (this is cheap)
  const { translit, literal, score } = evaluateVerse(gameState.verseWords);

  if (elements.grammarTranslitDiv) {
    elements.grammarTranslitDiv.textContent = translit || '(drop words here)';
  }
  if (elements.grammarLiteralDiv) {
    elements.grammarLiteralDiv.textContent = literal || '';
  }
  if (elements.grammarNaturalDiv) {
    elements.grammarNaturalDiv.textContent = gameState.currentLine.english;
  }
  if (elements.grammarScoreDiv) {
    elements.grammarScoreDiv.textContent = 'Grammar match: ' + Math.round(score * 100) + '%';
  }
}

/**
 * Update enscribe button state
 */
export function updateEnscribeButton() {
  const solved = isVerseSolved();
  if (elements.enscribeBtn) {
    elements.enscribeBtn.disabled = !solved;
  }
}

/**
 * Update lines completed display
 */
export function updateLinesCompletedDisplay() {
  if (elements.linesCompletedSpan) {
    elements.linesCompletedSpan.textContent = gameState.linesCompleted;
  }
}

/**
 * Master UI update function (called every frame and on events)
 */
export function updateUI() {
  updateStatsDisplay();
  updateScribePurchaseButton();
  renderMolds();
  // renderWordList(); // Disabled - chips now appear on screen with physics
  renderScribeBlocks();
  updateGrammarUI();
  updateEnscribeButton();
  updateLinesCompletedDisplay();
}
