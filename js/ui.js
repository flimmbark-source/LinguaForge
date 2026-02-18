/**
 * LINGUA FORGE - UI RENDERING
 * Handles all UI updates and rendering logic
 */

import { getScribeCost, SCRIBE_GHOST_LIFETIME, GRAMMAR_LEXICON, SOLUTION_HEBREW_ORDER } from './config.js?v=9';
import { gameState } from './state.js?v=9';
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
  elements.verseSpread = document.getElementById('verseSpread');
  elements.verseWordOrbit = document.getElementById('verseWordOrbit');
  elements.verseHint = document.getElementById('verseHint');
  elements.verseReleaseParkedBtn = document.getElementById('verseReleaseParked');
  elements.wordInfoSheet = document.getElementById('wordInfoSheet');
  elements.wordInfoHebrew = document.getElementById('wordInfoHebrew');
  elements.wordInfoTranslit = document.getElementById('wordInfoTranslit');
  elements.wordInfoMeaning = document.getElementById('wordInfoMeaning');
  elements.wordInfoExample = document.getElementById('wordInfoExample');
  elements.wordInfoAttach = document.getElementById('wordInfoAttach');
  elements.wordInfoClose = document.getElementById('wordInfoClose');
  elements.wordInfoSelect = document.getElementById('wordInfoSelect');
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


function getVerseWordsInPlay() {
  const placed = gameState.verseWords.map(w => w.hebrew);
  const parked = (gameState.verseParkedWords || []).map(w => w.text);
  return new Set([...placed, ...parked]);
}

function openWordInfo(word, fromOrbit = true) {
  if (!word || !elements.wordInfoSheet) return;
  const lex = GRAMMAR_LEXICON[word.text] || {};
  elements.wordInfoHebrew.textContent = word.text;
  elements.wordInfoTranslit.textContent = lex.translit ? `Transliteration: ${lex.translit}` : '';
  elements.wordInfoMeaning.textContent = lex.meaning ? `Meaning: ${lex.meaning}` : '';
  elements.wordInfoExample.textContent = lex.example ? `Example: ${lex.example}` : '';
  elements.wordInfoAttach.textContent = lex.type === 'morpheme'
    ? `Attaches to: ${lex.attachesTo || 'nearby words'} (grammar rune)`
    : '';
  elements.wordInfoSheet.classList.add('open');
  elements.wordInfoSheet.setAttribute('aria-hidden', 'false');
  if (elements.wordInfoSelect) {
    elements.wordInfoSelect.onclick = () => {
      gameState.verseSelectedWordId = word.id;
      elements.wordInfoSheet.classList.remove('open');
      if (fromOrbit) updateGrammarUI(true);
    };
  }
}

function closeWordInfo() {
  if (!elements.wordInfoSheet) return;
  elements.wordInfoSheet.classList.remove('open');
  elements.wordInfoSheet.setAttribute('aria-hidden', 'true');
}

function renderVerseOrbitWords() {
  if (!elements.verseWordOrbit) return;
  const used = getVerseWordsInPlay();
  elements.verseWordOrbit.innerHTML = '';
  const available = gameState.words.filter(w => !used.has(w.text));

  available.forEach((word, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'line-word-chip verse-orbit-chip';
    chip.textContent = word.text;
    chip.dataset.wordId = String(word.id);
    chip.style.setProperty('--orbit-index', String(index));
    if (gameState.verseSelectedWordId === word.id) chip.classList.add('is-selected');

    chip.addEventListener('click', e => {
      e.stopPropagation();
      openWordInfo(word);
    });

    chip.addEventListener('pointerdown', e => {
      chip.dataset.dragStartX = String(e.clientX);
      chip.dataset.dragStartY = String(e.clientY);
      elements.verseSpread?.classList.add('compose-active');
    });

    chip.addEventListener('pointerup', e => {
      const sx = Number(chip.dataset.dragStartX || e.clientX);
      const sy = Number(chip.dataset.dragStartY || e.clientY);
      const moved = Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10;
      if (moved) {
        const lineRect = elements.grammarHebrewLineDiv?.getBoundingClientRect();
        if (lineRect && e.clientX >= lineRect.left - 24 && e.clientX <= lineRect.right + 24 && e.clientY >= lineRect.top - 24 && e.clientY <= lineRect.bottom + 24) {
          const insertIndex = gameState.verseWords.length;
          const success = placeWordInVerse(word.id, insertIndex);
          if (success) {
            gameState.verseSelectedWordId = null;
            updateGrammarUI(true);
          }
        } else {
          const spreadRect = elements.verseSpread?.getBoundingClientRect();
          if (spreadRect && e.clientX > spreadRect.left && e.clientX < spreadRect.right && e.clientY > spreadRect.top && e.clientY < spreadRect.bottom) {
            gameState.verseParkedWords = gameState.verseParkedWords || [];
            gameState.verseParkedWords.push({ id: word.id, text: word.text, x: e.clientX - spreadRect.left, y: e.clientY - spreadRect.top });
          }
        }
      }
      elements.verseSpread?.classList.remove('compose-active');
    });

    elements.verseWordOrbit.appendChild(chip);
  });

  (gameState.verseParkedWords || []).forEach(parked => {
    const parkedChip = document.createElement('button');
    parkedChip.type = 'button';
    parkedChip.className = 'line-word-chip verse-orbit-chip is-parked';
    parkedChip.textContent = parked.text;
    parkedChip.style.left = `${parked.x}px`;
    parkedChip.style.top = `${parked.y}px`;
    parkedChip.style.position = 'absolute';
    parkedChip.addEventListener('click', () => {
      const word = gameState.words.find(w => w.id === parked.id);
      if (word) openWordInfo(word, false);
    });
    elements.verseWordOrbit.appendChild(parkedChip);
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
    chip.addEventListener('click', () => {
      if (!gameState.verseSelectedWordId) {
        gameState.verseHintFailures += 1;
        if (elements.verseHint && gameState.verseHintFailures > 2) {
          elements.verseHint.textContent = "Something about 'of' placement feels off…";
        }
      }
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

/**
 * Update grammar/verse UI
 * @param {boolean} force - Force chip re-render (used after drag operations)
 */
export function updateGrammarUI(force = false) {
  if (!elements.grammarHebrewLineDiv) return;

  renderVerseChips(force);
  renderVerseOrbitWords();

  const { translit, literal, score } = evaluateVerse(gameState.verseWords);
  const solved = score === 1 && gameState.verseWords.length === SOLUTION_HEBREW_ORDER.length;

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
    elements.grammarScoreDiv.textContent = `Grammar match: ${Math.round(score * 100)}%`;
  }
  if (elements.verseMeterFill) {
    elements.verseMeterFill.style.width = `${Math.round(score * 100)}%`;
  }
  if (elements.verseSpread) {
    elements.verseSpread.classList.toggle('lock-in', solved);
    elements.verseSpread.classList.toggle('browse-state', gameState.verseWords.length === 0);
  }
  if (elements.enscribeBtn) {
    elements.enscribeBtn.disabled = !solved;
    elements.enscribeBtn.textContent = solved ? 'Enscribe Verse' : 'Arrange words to enscribe';
  }
}

/**
 * Update enscribe button state
 */
export function updateEnscribeButton() {
  if (!elements.enscribeBtn) return;
  if (gameState.enscribeModeActive) {
    elements.enscribeBtn.textContent = `Selecting words (${gameState.enscribeSelectedWords.length}/${SOLUTION_HEBREW_ORDER.length})`;
    return;
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

  if (elements.wordInfoClose) {
    elements.wordInfoClose.addEventListener('click', closeWordInfo);
  }
  if (elements.wordInfoSheet) {
    elements.wordInfoSheet.addEventListener('click', (e) => {
      if (e.target === elements.wordInfoSheet) closeWordInfo();
    });
  }
  if (elements.grammarHebrewLineDiv) {
    elements.grammarHebrewLineDiv.addEventListener('click', () => {
      if (!gameState.verseSelectedWordId) return;
      const success = placeWordInVerse(gameState.verseSelectedWordId, gameState.verseWords.length);
      if (success) {
        gameState.verseSelectedWordId = null;
        updateGrammarUI(true);
      }
    });
  }
  if (elements.verseReleaseParkedBtn) {
    elements.verseReleaseParkedBtn.addEventListener('click', () => {
      gameState.verseParkedWords = [];
      updateGrammarUI(true);
    });
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
  renderGlossary();
}
