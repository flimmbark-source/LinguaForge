/**
 * LINGUA FORGE - CONFIGURATION & CONSTANTS
 * Central configuration for game constants and data
 */

// Scribe configuration
export const SCRIBE_CYCLE_SECONDS = 5;
export const SCRIBE_GHOST_LIFETIME = 0.8;
export const SCRIBE_BASE_COST = 10;
export const SCRIBE_COST_MULTIPLIER = 1.15;
export const SCRIBE_LETTERS_PER_BATCH = 5;
export const SCRIBE_INK_PER_BATCH = 1;

// Letter configuration
export const STARTING_LETTERS = 5;
export const INK_PER_LETTER = 1;
export const INK_PER_WORD_LETTER = 5;
export const VERSE_COMPLETION_REWARD = 100;

// Hebrew grammar lexicon
export const GRAMMAR_LEXICON = {
  'אש':      { translit: 'esh',      gloss: 'fire', meaning: 'fire', example: 'אש בוערת · fire burns' },
  'היא':     { translit: 'hi',       gloss: 'is', meaning: 'is / she is', example: 'היא אור · she is light' },
  'ה':       { translit: 'ha',       gloss: 'the', meaning: 'the (prefix)', example: 'ה + אש → האש', type: 'morpheme', attachesTo: 'nouns' },
  'ראשונה':  { translit: 'rishona',  gloss: 'first', meaning: 'first', example: 'הראשונה · the first' },
  'שנייה':  { translit: 'shniya',    gloss: 'second', meaning: 'second', example: 'השנייה · the second' },
  'נשמת':    { translit: 'nishmat',  gloss: 'breath of', meaning: 'breath of', example: 'נשמת כוח · breath of power' },
  'של':      { translit: 'shel',     gloss: 'of', meaning: 'of / belonging to', example: 'של אש · of fire' },
  'כוח':     { translit: 'koach',    gloss: 'power', meaning: 'power', example: 'כוח קדום · ancient power' },
};

// Current line/verse configuration
export const CURRENT_LINE = {
  id: 1,
  english: 'Fire is the first breath of power.',
  molds: [
    { id: 1, english: 'fire',    hebrew: 'אש',      pattern: 'אש',      slots: [] },
    { id: 2, english: 'is',      hebrew: 'היא',     pattern: 'היא',     slots: [] },
    { id: 3, english: 'the',     hebrew: 'ה',       pattern: 'ה',       slots: [] },
    { id: 4, english: 'first',   hebrew: 'ראשונה',  pattern: 'ראשונה',  slots: [] },
    { id: 5, english: 'breath',  hebrew: 'נשמת',    pattern: 'נשמת',    slots: [] },
    { id: 6, english: 'of',      hebrew: 'של',      pattern: 'של',      slots: [] },
    { id: 7, english: 'power',   hebrew: 'כוח',     pattern: 'כוח',     slots: [] },
  ],
};

// Solution for the verse (correct Hebrew word order)
export const SOLUTION_HEBREW_ORDER = ['אש', 'היא', 'ה', 'ראשונה', 'נשמת', 'של', 'כוח'];

/**
 * Get all unique letters from the current line's molds
 * @returns {string[]} Array of unique Hebrew letters
 */
export function getAllowedLetters() {
  return Array.from(
    new Set(
      CURRENT_LINE.molds
        .map(m => m.pattern.split(''))
        .flat()
    )
  );
}

/**
 * Initialize mold slots with empty arrays
 */
export function initializeMoldSlots() {
  CURRENT_LINE.molds.forEach(mold => {
    mold.slots = new Array(mold.pattern.length).fill(false);
  });
}

/**
 * Calculate scribe cost based on number owned
 * @param {number} numScribes - Current number of scribes
 * @returns {number} Cost in letters
 */
export function getScribeCost(numScribes) {
  return Math.floor(SCRIBE_BASE_COST * Math.pow(SCRIBE_COST_MULTIPLIER, numScribes));
}

/**
 * Calculate word power (currently unused, for future upgrades)
 * @param {number} length - Word length
 * @returns {number} Power value
 */
export function computeWordPower(length) {
  return Math.sqrt(length) * 5;
}
