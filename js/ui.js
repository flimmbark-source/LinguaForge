/**
 * LINGUA FORGE - UI RENDERING
 * Handles all UI updates and rendering logic
 */

import { getScribeCost, SCRIBE_GHOST_LIFETIME, GRAMMAR_LEXICON, SOLUTION_HEBREW_ORDER } from './config.js?v=9';
import { gameState, addWord, removeVerseWord, getNextWordId, clearVerseWords } from './state.js?v=9';
import { setupWordChipDrag, sellWord, renderMoldsInViewport } from './molds.js?v=9';
import { toggleScribePaused } from './scribes.js?v=9';
import { evaluateVerse, setupVerseWordChipDrag, placeWordInVerse } from './grammar.js?v=9';
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
  elements.verseMeterFill = document.getElementById('verseMeterFill');
  elements.verseHint = document.getElementById('verseHint');
  elements.verseTranslationReveal = document.getElementById('verseTranslationReveal');
  elements.verseWordOrbit = document.getElementById('verseWordOrbit');
  elements.verseWorkMatLeft = document.getElementById('verseWorkMatLeft');
  elements.verseWorkMatRight = document.getElementById('verseWorkMatRight');
  elements.wordInfoSheet = document.getElementById('wordInfoSheet');
  elements.wordInfoCard = document.getElementById('wordInfoCard');
  elements.wordInfoHebrew = document.getElementById('wordInfoHebrew');
  elements.wordInfoTranslit = document.getElementById('wordInfoTranslit');
  elements.wordInfoMeaning = document.getElementById('wordInfoMeaning');
  elements.wordInfoExample = document.getElementById('wordInfoExample');
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

// Cache visibility-toggle elements to avoid querySelector on every UI update
let _cachedHearthWrapper = null;
let _cachedScribeSection = null;

/**
 * Update hearth visibility based on unlock state
 */
function updateHearthVisibility() {
  if (!_cachedHearthWrapper || !_cachedHearthWrapper.isConnected) {
    _cachedHearthWrapper = document.querySelector('.hearth-wrapper');
  }
  if (_cachedHearthWrapper) {
    _cachedHearthWrapper.style.display = gameState.hearthUnlocked ? 'block' : 'none';
  }
}

/**
 * Update scribe section visibility based on unlock state
 */
function updateScribeVisibility() {
  if (!_cachedScribeSection || !_cachedScribeSection.isConnected) {
    _cachedScribeSection = document.querySelector('.section:has(#scribeBlocks)');
  }
  if (_cachedScribeSection) {
    _cachedScribeSection.style.display = gameState.scribesUnlocked ? 'block' : 'none';
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
      toggleScribePaused(scribe.id);
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
    setupVerseWordChipDrag(chip, wordInstance.instanceId, () => updateGrammarUI(true), (instanceId, clientX, clientY) => {
      moveVerseWordBackToOrbit(instanceId, clientX, clientY);
    });

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



function isPointInsideRect(x, y, rect) {
  return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function clampPercent(value) {
  return Math.max(2, Math.min(98, value));
}

function getOrbitRelativePercent(clientX, clientY) {
  const orbitRect = elements.verseWordOrbit?.getBoundingClientRect();
  if (orbitRect && orbitRect.width > 0 && orbitRect.height > 0) {
    const localX = clientX - orbitRect.left;
    const localY = clientY - orbitRect.top;
    return {
      left: clampPercent((localX / orbitRect.width) * 100),
      top: clampPercent((localY / orbitRect.height) * 100),
    };
  }

  return {
    left: clampPercent((clientX / window.innerWidth) * 100),
    top: clampPercent((clientY / window.innerHeight) * 100),
  };
}

function setWordContainerPosition(wordId, clientX, clientY) {
  const safeX = Number.isFinite(clientX) ? clientX : window.innerWidth / 2;
  const safeY = Number.isFinite(clientY) ? clientY : window.innerHeight / 2;
  const { left, top } = getOrbitRelativePercent(safeX, safeY);
  gameState.wordContainerPositions = gameState.wordContainerPositions || {};
  gameState.wordContainerPositions[wordId] = { left, top };
}

function separateOverlappingWordContainers(wordIds) {
  const orbitRect = elements.verseWordOrbit?.getBoundingClientRect();
  const width = orbitRect?.width || window.innerWidth;
  const height = orbitRect?.height || window.innerHeight;
  if (width <= 0 || height <= 0) return;

  gameState.wordContainerPositions = gameState.wordContainerPositions || {};

  const horizontalGapPercent = (50 / width) * 100;
  const verticalGapPercent = (22 / height) * 100;
  const maxPasses = 8;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false;

    for (let i = 0; i < wordIds.length; i += 1) {
      const idA = wordIds[i];
      const posA = gameState.wordContainerPositions[idA];
      if (!posA) continue;

      for (let j = i + 1; j < wordIds.length; j += 1) {
        const idB = wordIds[j];
        const posB = gameState.wordContainerPositions[idB];
        if (!posB) continue;

        const dx = posB.left - posA.left;
        const dy = posB.top - posA.top;
        const overlapX = horizontalGapPercent - Math.abs(dx);
        const overlapY = verticalGapPercent - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        const pushX = Math.max(0.6, overlapX / 2);
        const pushY = Math.max(0.4, overlapY / 2);

        const dirX = dx === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dx);
        const dirY = dy === 0 ? (j % 2 === 0 ? -1 : 1) : Math.sign(dy);

        posA.left = clampPercent(posA.left - dirX * pushX);
        posB.left = clampPercent(posB.left + dirX * pushX);
        posA.top = clampPercent(posA.top - dirY * pushY);
        posB.top = clampPercent(posB.top + dirY * pushY);
      }
    }

    if (!moved) break;
  }
}

function moveVerseWordBackToOrbit(instanceId, clientX, clientY) {
  const removed = removeVerseWord(instanceId);
  if (!removed) return;

  const newWordId = getNextWordId();
  const lex = GRAMMAR_LEXICON[removed.hebrew];
  addWord({
    id: newWordId,
    text: removed.hebrew,
    english: lex?.gloss || removed.hebrew,
    length: removed.hebrew.length,
    power: 0,
    heated: true,
  });

  setWordContainerPosition(newWordId, clientX, clientY);

  const leftMat = elements.verseWorkMatLeft?.getBoundingClientRect();
  const rightMat = elements.verseWorkMatRight?.getBoundingClientRect();
  const inMat = isPointInsideRect(clientX, clientY, leftMat) || isPointInsideRect(clientX, clientY, rightMat);
  if (inMat) {
    gameState.parkedWordIds = [...new Set([...(gameState.parkedWordIds || []), newWordId])];
  }

  lastRenderedVerseWords = [];
  orbitSnapshotKey = '';
  updateUI();
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
  if (elements.verseMeterFill) {
    const prev = gameState.verseLastScore || 0;
    elements.verseMeterFill.style.width = Math.round(score * 100) + '%';
    if (score > prev) {
      elements.verseMeterFill.classList.remove('pulse');
      void elements.verseMeterFill.offsetWidth;
      elements.verseMeterFill.classList.add('pulse');
    }
    gameState.verseLastScore = score;
  }

  const solved = gameState.verseWords.length === SOLUTION_HEBREW_ORDER.length
    && gameState.verseWords.every((w, i) => w.hebrew === SOLUTION_HEBREW_ORDER[i]);

  elements.grammarHebrewLineDiv.classList.toggle('is-solved', solved);
  if (elements.verseTranslationReveal) {
    elements.verseTranslationReveal.textContent = solved ? gameState.currentLine.english : '';
    elements.verseTranslationReveal.classList.toggle('visible', solved);
  }

  if (!solved && gameState.verseWords.length > 0) {
    const mismatch = gameState.verseWords.findIndex((w, i) => w.hebrew !== SOLUTION_HEBREW_ORDER[i]);
    if (mismatch >= 0) {
      const chips = elements.grammarHebrewLineDiv.querySelectorAll('.line-word-chip');
      chips.forEach(c => c.classList.remove('wrong-order'));
      const target = chips[mismatch];
      if (target) target.classList.add('wrong-order');
    }
    elements.grammarHebrewLineDiv.classList.add('is-unstable');
  } else {
    elements.grammarHebrewLineDiv.classList.remove('is-unstable');
  }

  if (!solved && gameState.verseWords.length === SOLUTION_HEBREW_ORDER.length) {
    const signature = gameState.verseWords.map((w) => w.hebrew).join(' ');
    if (gameState.verseLastTriedSignature !== signature) {
      gameState.verseFailedAttempts = (gameState.verseFailedAttempts || 0) + 1;
      gameState.verseLastTriedSignature = signature;
    }
  }

  if (elements.verseHint) {
    const showHint = !solved && gameState.verseFailedAttempts >= 2;
    elements.verseHint.textContent = showHint ? 'Something about “of” placement feels off…' : '';
  }
}

/**
 * Update enscribe button state
 */
export function updateEnscribeButton() {
  if (!elements.enscribeBtn) return;
  const solved = gameState.verseWords.length === SOLUTION_HEBREW_ORDER.length
    && gameState.verseWords.every((w, i) => w.hebrew === SOLUTION_HEBREW_ORDER[i]);
  elements.enscribeBtn.disabled = !solved;
  elements.enscribeBtn.style.display = solved ? 'inline-flex' : 'none';
  elements.enscribeBtn.textContent = 'Enscribe';
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


let orbitDragState = null;
let orbitSnapshotKey = "";

function getVerseLayoutZones() {
  return {
    // Normalized percentages in the verse spread overlay.
    // Left side is split into upper (verb) and lower (noun) homes.
    verbZone: { left: 8, top: 14, width: 40, height: 24 },
    nounZone: { left: 8, top: 58, width: 40, height: 30 },
    // Function words sit in a deterministic inner strip on the right.
    particlePrefixZone: { left: 60, top: 20, width: 30, height: 62 },
    // Reference-only zone for line intent; actual line behavior remains unchanged.
    verseLineZone: { left: 26, top: 42, width: 48, height: 14 },
  };
}

function getWordZoneKey(word, parked) {
  if (parked) return 'nounZone';

  const mold = gameState.currentLine?.molds?.find((m) => m.pattern === word.text);
  const english = (mold?.english || '').toLowerCase();
  const gloss = (GRAMMAR_LEXICON[word.text]?.gloss || '').toLowerCase();

  // Function words / prefixes / particles -> right strip.
  const isFunctionWord =
    english === 'the' || english === 'of' ||
    gloss === 'the' || gloss === 'of' || gloss === 'breath of';
  if (isFunctionWord) return 'particlePrefixZone';

  // Verb-ish (copula in current data) -> upper-left verb zone.
  const isVerbWord = english === 'is' || gloss === 'is';
  if (isVerbWord) return 'verbZone';

  // Safe fallback: content words stay on the left side.
  return 'nounZone';
}

function getDeterministicZonePosition(zone, zoneIndex, orbitRect) {
  const rectWidth = Math.max(orbitRect?.width || 0, 1);
  const zoneWidthPx = (zone.width / 100) * rectWidth;

  // Wrap cleanly based on available zone width.
  const minSlotWidthPx = 84;
  const columns = Math.max(1, Math.floor(zoneWidthPx / minSlotWidthPx));
  const row = Math.floor(zoneIndex / columns);
  const col = zoneIndex % columns;

  const xStep = zone.width / columns;
  const yStep = 11;
  const yPad = 7;

  const left = zone.left + xStep * (col + 0.5);
  const unclampedTop = zone.top + yPad + row * yStep;
  const maxTop = zone.top + zone.height - 4;
  const top = Math.max(zone.top + 4, Math.min(maxTop, unclampedTop));

  return {
    left: clampPercent(left),
    top: clampPercent(top),
  };
}

function getWordHomePosition(word, words, parkedSet) {
  const zones = getVerseLayoutZones();
  const orbitRect = elements.verseWordOrbit?.getBoundingClientRect();
  const zoneKey = getWordZoneKey(word, parkedSet.has(word.id));
  const zone = zones[zoneKey] || zones.nounZone;

  const zoneWords = words.filter((w) => getWordZoneKey(w, parkedSet.has(w.id)) === zoneKey);
  const zoneIndex = Math.max(0, zoneWords.findIndex((w) => w.id === word.id));
  const pos = getDeterministicZonePosition(zone, zoneIndex, orbitRect);

  return { ...pos, parked: parkedSet.has(word.id), zoneKey };
}

let wordInfoDismissListenerActive = false;

function positionWordInfoAtPoint(clientX, clientY) {
  if (!elements.wordInfoCard) return;
  const card = elements.wordInfoCard;

  card.style.left = '-9999px';
  card.style.top = '-9999px';
  card.style.visibility = 'hidden';
  elements.wordInfoSheet.classList.add('open');

  const rect = card.getBoundingClientRect();
  const width = rect.width || 220;
  const height = rect.height || 120;

  // In landscape mobile, the book is a full-screen overlay and the interior
  // is a centred panel (min(70vw,500px)). Clamp the card within that panel
  // so it doesn't land on the dark backdrop outside the book.
  const bookInterior = document.querySelector('.book-interior');
  const isLandscapeOverlay = bookInterior &&
    (window.matchMedia('(max-width: 768px) and (orientation: landscape)').matches ||
     window.matchMedia('(max-height: 540px) and (orientation: landscape)').matches);

  let minX, maxX, minY, maxY;
  if (isLandscapeOverlay) {
    const interiorRect = bookInterior.getBoundingClientRect();
    const pad = 6;
    minX = interiorRect.left + pad;
    maxX = interiorRect.right - pad;
    minY = interiorRect.top + pad;
    maxY = interiorRect.bottom - pad;
  } else {
    minX = 8;
    maxX = window.innerWidth - 8;
    minY = 8;
    maxY = window.innerHeight - 8;
  }

  // Position card directly at the click point, preferring below-right,
  // flipping above or left if it would overflow the bounds.
  let left = clientX + 8;
  let top = clientY + 8;

  if (left + width > maxX) left = clientX - width - 8;
  if (top + height > maxY) top = clientY - height - 8;

  left = Math.max(minX, Math.min(maxX - width, left));
  top = Math.max(minY, Math.min(maxY - height, top));

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.visibility = 'visible';
}

function openWordInfo(wordText, clientX, clientY) {
  if (!elements.wordInfoSheet) return;
  const lex = GRAMMAR_LEXICON[wordText] || {};
  elements.wordInfoHebrew.textContent = wordText;
  elements.wordInfoTranslit.textContent = lex.translit || '';
  elements.wordInfoMeaning.textContent = lex.gloss || '';
  elements.wordInfoExample.textContent = lex.gloss ? `${wordText} (${lex.gloss})` : wordText;
  elements.wordInfoSheet.setAttribute('aria-hidden', 'false');
  positionWordInfoAtPoint(clientX ?? window.innerWidth / 2, clientY ?? window.innerHeight / 2);

  if (!wordInfoDismissListenerActive) {
    wordInfoDismissListenerActive = true;
    setTimeout(() => {
      const dismiss = () => {
        closeWordInfo();
        document.removeEventListener('pointerdown', dismiss, true);
        wordInfoDismissListenerActive = false;
      };
      document.addEventListener('pointerdown', dismiss, true);
    }, 0);
  }
}

function closeWordInfo() {
  if (!elements.wordInfoSheet) return;
  elements.wordInfoSheet.classList.remove('open');
  elements.wordInfoSheet.setAttribute('aria-hidden', 'true');
}

function setupWordInfoHandlers() {
  if (setupWordInfoHandlers._done) return;
  setupWordInfoHandlers._done = true;
}

function renderVerseWordOrbit() {
  if (!elements.verseWordOrbit) return;
  const words = gameState.words.slice();
  const parkedSet = new Set(gameState.parkedWordIds || []);
  const snapshotKey = words.map((w) => {
    const pos = gameState.wordContainerPositions?.[w.id];
    const posKey = pos ? `${Math.round(pos.left*10)/10},${Math.round(pos.top*10)/10}` : 'auto';
    return `${w.id}:${parkedSet.has(w.id) ? 1 : 0}:${posKey}`;
  }).join('|');

  separateOverlappingWordContainers(words.map((w) => w.id));

  // Prevent chips from blinking/rebuilding while dragging.
  if (!orbitDragState && snapshotKey !== orbitSnapshotKey) {
    elements.verseWordOrbit.innerHTML = '';
    orbitSnapshotKey = snapshotKey;

    words.forEach((word, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'line-word-chip verse-orbit-chip';
      chip.textContent = word.text;
      chip.dataset.wordId = String(word.id);
      const savedPos = gameState.wordContainerPositions?.[word.id];
      const pos = savedPos || getWordHomePosition(word, words, parkedSet);
      chip.style.left = pos.left + '%';
      chip.style.top = pos.top + '%';
      if (!savedPos && !pos.parked) chip.style.animationDelay = `${(i % 7) * 0.3}s`;
      if (parkedSet.has(word.id)) chip.classList.add('is-parked');
      gameState.wordContainerPositions = gameState.wordContainerPositions || {};
      if (!savedPos) gameState.wordContainerPositions[word.id] = { left: pos.left, top: pos.top };

      let moved = false;
      chip.addEventListener('pointerdown', (e) => {
        moved = false;
        const rect = chip.getBoundingClientRect();
        orbitDragState = { wordId: word.id, chip, width: rect.width, height: rect.height, startX: e.clientX, startY: e.clientY, lastClientX: e.clientX, lastClientY: e.clientY };
        chip.classList.add('dragging');
        elements.grammarHebrewLineDiv?.classList.add('compose-active');
        chip.style.position = 'fixed';
        chip.style.left = (e.clientX - rect.width / 2) + 'px';
        chip.style.top = (e.clientY - rect.height / 2) + 'px';
        chip.style.transform = 'none';
        chip.style.zIndex = '1200';
        chip.setPointerCapture(e.pointerId);
      });

      chip.addEventListener('pointermove', (e) => {
        if (!orbitDragState || orbitDragState.wordId !== word.id) return;
        const dx = e.clientX - orbitDragState.startX;
        const dy = e.clientY - orbitDragState.startY;
        // Only count as a drag once the pointer has moved more than 8px —
        // this prevents touch jitter from suppressing the tap/info-popup path.
        if (!moved && dx * dx + dy * dy < 64) return;
        moved = true;
        orbitDragState.lastClientX = e.clientX;
        orbitDragState.lastClientY = e.clientY;
        chip.style.left = (e.clientX - orbitDragState.width / 2) + 'px';
        chip.style.top = (e.clientY - orbitDragState.height / 2) + 'px';
      });

      chip.addEventListener('pointerup', (e) => {
        if (!orbitDragState || orbitDragState.wordId !== word.id) return;
        chip.releasePointerCapture(e.pointerId);
        chip.classList.remove('dragging');
        chip.style.visibility = 'hidden';
        chip.style.position = '';
        chip.style.left = '';
        chip.style.top = '';
        chip.style.transform = '';
        chip.style.zIndex = '';
        elements.grammarHebrewLineDiv?.classList.remove('compose-active');

        const dropX = Number.isFinite(e.clientX) && e.clientX > 0 ? e.clientX : orbitDragState.lastClientX;
        const dropY = Number.isFinite(e.clientY) && e.clientY > 0 ? e.clientY : orbitDragState.lastClientY;
        const lineRect = elements.grammarHebrewLineDiv?.getBoundingClientRect();
        const matRectLeft = elements.verseWorkMatLeft?.getBoundingClientRect();
        const matRectRight = elements.verseWorkMatRight?.getBoundingClientRect();
        const orbitRect = elements.verseWordOrbit?.getBoundingClientRect();
        const inLine = lineRect && dropX >= lineRect.left && dropX <= lineRect.right && dropY >= lineRect.top && dropY <= lineRect.bottom;
        const inMatLeft = matRectLeft && dropX >= matRectLeft.left && dropX <= matRectLeft.right && dropY >= matRectLeft.top && dropY <= matRectLeft.bottom;
        const inMatRight = matRectRight && dropX >= matRectRight.left && dropX <= matRectRight.right && dropY >= matRectRight.top && dropY <= matRectRight.bottom;
        const inMat = inMatLeft || inMatRight;
        const inOrbit = isPointInsideRect(dropX, dropY, orbitRect);

        if (inLine) {
          placeWordInVerse(word.id, gameState.verseWords.length);
          gameState.parkedWordIds = (gameState.parkedWordIds || []).filter(id => id !== word.id);
          if (gameState.wordContainerPositions) delete gameState.wordContainerPositions[word.id];
          orbitSnapshotKey = '';
          orbitDragState = null;
          updateUI();
        } else if (inMat || (moved && inOrbit)) {
          setWordContainerPosition(word.id, dropX, dropY);
          if (inMat) {
            if (!parkedSet.has(word.id)) gameState.parkedWordIds = [...(gameState.parkedWordIds || []), word.id];
          } else {
            gameState.parkedWordIds = (gameState.parkedWordIds || []).filter(id => id !== word.id);
          }
          orbitSnapshotKey = '';
          orbitDragState = null;
          updateUI();
        } else if (moved) {
          // If dropped outside the verse spread, restore chip to its stored position.
          const savedPos = gameState.wordContainerPositions?.[word.id];
          if (savedPos) {
            chip.style.left = savedPos.left + '%';
            chip.style.top = savedPos.top + '%';
          }
          chip.style.visibility = '';
        } else {
          // Simple tap/click — restore position and show word info.
          const savedPos = gameState.wordContainerPositions?.[word.id];
          if (savedPos) {
            chip.style.left = savedPos.left + '%';
            chip.style.top = savedPos.top + '%';
          }
          chip.style.visibility = '';
          openWordInfo(word.text, dropX, dropY);
        }
        orbitDragState = null;
      });

      elements.verseWordOrbit.appendChild(chip);
    });
  }

  const matActive = (gameState.parkedWordIds || []).length > 0 || words.length > 3;
  if (elements.verseWorkMatLeft) elements.verseWorkMatLeft.classList.toggle('active', matActive);
  if (elements.verseWorkMatRight) elements.verseWorkMatRight.classList.toggle('active', matActive);
  }


/**
 * Initialize versebook interactions
 */
export function initWordSelector() {
  // Legacy glossary controls removed for Verse Book spread redesign.
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
  setupWordInfoHandlers();
  renderVerseWordOrbit();
}
