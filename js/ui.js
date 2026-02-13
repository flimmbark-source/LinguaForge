/**
 * LINGUA FORGE - UI RENDERING
 * Handles all UI updates and rendering logic
 */

import { getScribeCost, SCRIBE_GHOST_LIFETIME, GRAMMAR_LEXICON, SOLUTION_HEBREW_ORDER } from './config.js?v=9';
import { gameState } from './state.js?v=9';
import { setupWordChipDrag, sellWord, renderMoldsInViewport } from './molds.js?v=9';
import { toggleScribePaused } from './scribes.js?v=9';
import { evaluateVerse, setupVerseWordChipDrag } from './grammar.js?v=9';
import { updateSidebarToolVisibility } from './bookAndSidebar.js?v=9';

// DOM element cache
const elements = {};

// Track last rendered verse state to avoid unnecessary recreations
let lastRenderedVerseWords = [];

// Track last rendered scribe state to avoid unnecessary recreations
let lastRenderedScribes = [];

// Track last rendered mold state to avoid unnecessary recreations
let lastRenderedMoldIndex = -1;
let lastRenderedMoldSlots = '';

/**
 * Initialize DOM element references
 */
export function initializeElements() {
  elements.lettersDisplay = document.getElementById('lettersDisplay');
  elements.inkDisplay = document.getElementById('inkDisplay');
  elements.clickGainSpan = document.getElementById('clickGain');
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
  elements.shovel = document.getElementById('selectShovel');
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
  // Update shovel visibility based on unlock state
  updateShovelVisibility();

  // Update sidebar tool visibility
  updateSidebarToolVisibility(gameState.pestleUnlocked, gameState.shovelUnlocked);
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
    elements.pestle.style.display = 'inline-flex';
  } else {
    elements.pestle.style.display = 'none';
  }
}

/*
 * Update pestle visibility based on unlock state
 */
function updateShovelVisibility() {
  if (!elements.shovel) return;

  if (gameState.shovelUnlocked) {
    elements.shovel.style.display = 'inline-flex';
  } else {
    elements.shovel.style.display = 'none';
  }
}

/**
 * Update scribe purchase button
 */
export function updateScribePurchaseButton() {
  renderScribeHireBlocksInline();
}

function renderScribeHireBlocksInline() {
  if (!elements.scribeBlocksContainer) return;
  const container = elements.scribeBlocksContainer;
  container.querySelectorAll('.scribe-hire-block').forEach(block => block.remove());

  const owned = gameState.scribeList.length;
  const cost = getScribeCost(owned);
  const block = document.createElement('button');
  block.type = 'button';
  block.className = 'scribe-block scribe-hire-block';
  block.dataset.tooltip = `Cost: ${cost} ⭐`;
  block.dataset.cost = String(cost);
  const icon = document.createElement('span');
  icon.className = 'scribe-icon';
  icon.textContent = '✒️';
  block.appendChild(icon);

  const canAfford = gameState.scribesUnlocked && gameState.letters >= cost;
  block.classList.add('is-active');
  block.dataset.disabled = canAfford ? 'false' : 'true';
  block.setAttribute('aria-disabled', canAfford ? 'false' : 'true');
  block.setAttribute('aria-label', `Hire scribe for ${cost} renown`);
  if (!canAfford) {
    block.classList.add('is-disabled');
  }

  container.appendChild(block);
}

/**
 * Render mold display (current mold with slots)
 */
export function renderMolds() {
  if (!elements.moldListDiv) return;
  renderMoldsInViewport(elements.moldListDiv);

  if (elements.moldIndexLabel) {
    const storedMolds = gameState.currentLine.molds.filter(m => m.runtime?.inViewport && !m.runtime?.consumed);
    if (!storedMolds.length) {
      elements.moldIndexLabel.textContent = 'No molds stored';
    } else {
      const current = Math.min(gameState.currentMoldIndex + 1, storedMolds.length);
      elements.moldIndexLabel.textContent = `${current} / ${storedMolds.length}`;
    }
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
        renderScribeGhosts(block, scribe);
      }
    });
    renderScribeHireBlocksInline();
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

    renderScribeGhosts(block, scribe);

    // Click to toggle pause
    block.addEventListener('click', (e) => {
      console.log('Scribe block clicked! ID:', scribe.id, 'Paused:', scribe.paused);
      toggleScribePaused(scribe.id);
      console.log('After toggle, paused:', gameState.scribeList.find(s => s.id === scribe.id)?.paused);
      renderScribeBlocks(true); // Force re-render after pause toggle
    });

    elements.scribeBlocksContainer.appendChild(block);
  });
  renderScribeHireBlocksInline();

  // Update our tracking state
  lastRenderedScribes = gameState.scribeList.map(s => ({ id: s.id, paused: s.paused }));
}

/**
 * Render floating resource ghosts for a scribe block.
 * @param {HTMLElement} block - Scribe block element
 * @param {Object} scribe - Scribe data
 */
function renderScribeGhosts(block, scribe) {
  block.querySelectorAll('.scribe-ghost').forEach(el => el.remove());
  const ghosts = gameState.scribeGhosts.filter(g => g.scribeId === scribe.id);
  ghosts.forEach((ghost, index) => {
    const ghostEl = document.createElement('div');
    ghostEl.className = `scribe-ghost scribe-ghost--${ghost.type}`;
    const ratio = Math.max(0, Math.min(1, ghost.t / SCRIBE_GHOST_LIFETIME));
    const opacity = 1 - ratio;
    const offset = -6 - 10 * ratio - index * 10;
    ghostEl.style.opacity = opacity.toFixed(2);
    ghostEl.style.transform = 'translate(-50%, ' + offset + 'px)';
    if (ghost.type === 'letter') {
      const tile = document.createElement('div');
      tile.className = 'letter-tile scribe-ghost-tile';
      tile.innerHTML = `<span>${ghost.label}</span>`;
      ghostEl.appendChild(tile);
    } else {
      ghostEl.textContent = ghost.label;
    }
    block.appendChild(ghostEl);
  });
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

  // Keep hidden elements updated for internal use
  if (elements.grammarTranslitDiv) {
    elements.grammarTranslitDiv.textContent = translit || '';
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
  if (elements.enscribeBtn) {
    elements.enscribeBtn.disabled = true;
    elements.enscribeBtn.textContent = gameState.enscribeModeActive
      ? `Selecting words (${gameState.enscribeSelectedWords.length}/${SOLUTION_HEBREW_ORDER.length})`
      : 'Click the anvil glyph to enscribe';
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
 * Render glossary entries on the left page of the book
 */
let lastRenderedGlossaryCount = -1;
let lastRenderedSpread = -1;

const GLOSSARY_PAGE_SIZE = 4;

function getGlossaryPages() {
  const history = gameState.forgedWordsHistory;
  if (history.length === 0) return [[]];
  const pages = [];
  for (let i = 0; i < history.length; i += GLOSSARY_PAGE_SIZE) {
    pages.push(history.slice(i, i + GLOSSARY_PAGE_SIZE));
  }
  return pages;
}

export function turnGlossarySpread(direction) {
  const pages = getGlossaryPages();
  const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));
  const next = Math.max(0, Math.min(totalSpreads - 1, gameState.glossarySpreadIndex + direction));
  if (next !== gameState.glossarySpreadIndex) {
    gameState.glossarySpreadIndex = next;
    renderGlossary();
  }
}

function handleGlossaryWordSelect(wordText, entryEl) {
  if (!gameState.enscribeModeActive) return;

  gameState.enscribeSelectedWords.push(wordText);
  entryEl.classList.add('is-selected');

  if (gameState.enscribeSelectedWords.length >= SOLUTION_HEBREW_ORDER.length) {
    document.dispatchEvent(new CustomEvent('enscribe-attempt', {
      detail: { words: [...gameState.enscribeSelectedWords] }
    }));
  }
}

export function clearEnscribeSelection() {
  gameState.enscribeSelectedWords = [];
  document.querySelectorAll('.glossary-entry.is-selected').forEach(el => el.classList.remove('is-selected'));
}

export function renderGlossary() {
  const container = document.getElementById('glossaryEntries');
  const indicator = document.getElementById('glossaryPageIndicator');
  if (!container) return;

  const history = gameState.forgedWordsHistory;
  const pages = getGlossaryPages();
  const totalPages = pages.length;
  const totalSpreads = Math.max(1, Math.ceil(totalPages / 2));
  gameState.glossarySpreadIndex = Math.min(gameState.glossarySpreadIndex, totalSpreads - 1);

  if (history.length === lastRenderedGlossaryCount && gameState.glossarySpreadIndex === lastRenderedSpread) return;
  lastRenderedGlossaryCount = history.length;
  lastRenderedSpread = gameState.glossarySpreadIndex;

  const leftPageIndex = gameState.glossarySpreadIndex * 2;
  const leftPageWords = pages[leftPageIndex] || [];

  container.innerHTML = '';

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'glossary-empty';
    empty.style.opacity = '0.6';
    empty.style.fontSize = '12px';
    empty.textContent = 'No words forged yet.';
    container.appendChild(empty);
  }

  leftPageWords.forEach(word => {
    const entry = document.createElement('button');
    entry.type = 'button';
    entry.className = 'glossary-entry';

    const lexicon = GRAMMAR_LEXICON[word.text];

    const hebrewEl = document.createElement('div');
    hebrewEl.className = 'glossary-hebrew';
    hebrewEl.textContent = word.text;

    const infoEl = document.createElement('div');
    infoEl.className = 'glossary-info';

    const romanEl = document.createElement('div');
    romanEl.className = 'glossary-romanization';
    romanEl.textContent = lexicon ? lexicon.translit : word.text;

    const englishEl = document.createElement('div');
    englishEl.className = 'glossary-english';
    englishEl.textContent = word.english;

    infoEl.appendChild(romanEl);
    infoEl.appendChild(englishEl);

    entry.appendChild(hebrewEl);
    entry.appendChild(infoEl);
    entry.addEventListener('click', () => handleGlossaryWordSelect(word.text, entry));
    container.appendChild(entry);
  });

  if (indicator) {
    const leftNum = Math.min(totalPages, leftPageIndex + 1);
    const rightNum = Math.min(totalPages, leftPageIndex + 2);
    indicator.textContent = `Pages ${leftNum}-${rightNum}`;
  }
}

/**
 * Initialize versebook interactions
 */
export function initWordSelector() {
  const prevPageBtn = document.getElementById('bookPrevPageBtn');
  const nextPageBtn = document.getElementById('bookNextPageBtn');

  if (prevPageBtn) prevPageBtn.addEventListener('click', (e) => { e.stopPropagation(); turnGlossarySpread(-1); });
  if (nextPageBtn) nextPageBtn.addEventListener('click', (e) => { e.stopPropagation(); turnGlossarySpread(1); });
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
  renderGlossary();
}
