import { GRAMMAR_WORD_META } from './config.js?v=9';

const ZONES = {
  verseLineZone: { id: 'verseLineZone', x0: 0.26, x1: 0.74, y0: 0.44, y1: 0.62 },
  particlePrefixZone: { id: 'particlePrefixZone', x0: 0.60, x1: 0.84, y0: 0.22, y1: 0.78 },
  verbZone: { id: 'verbZone', x0: 0.08, x1: 0.42, y0: 0.18, y1: 0.42 },
  nounZone: { id: 'nounZone', x0: 0.08, x1: 0.42, y0: 0.58, y1: 0.86 },
  modifierZone: { id: 'modifierZone', x0: 0.72, x1: 0.92, y0: 0.08, y1: 0.28 },
  contentWordZone: { id: 'contentWordZone', x0: 0.10, x1: 0.42, y0: 0.36, y1: 0.74 },
};

const CATEGORY_TO_ZONE = {
  noun: 'nounZone',
  verb: 'verbZone',
  particle: 'particlePrefixZone',
  prefix: 'particlePrefixZone',
  modifier: 'modifierZone',
  contentWord: 'contentWordZone',
};

export function getChipCategory(wordText) {
  return GRAMMAR_WORD_META[wordText]?.category || 'contentWord';
}

export function getHomeZoneId(category) {
  return CATEGORY_TO_ZONE[category] || 'contentWordZone';
}

export function buildChipModel(word) {
  const category = getChipCategory(word.text);
  return {
    id: word.id,
    text: word.text,
    category,
    isPlaced: false,
    isLockedCorrect: false,
    homeZoneId: getHomeZoneId(category),
  };
}

export function getZoneSlots(zoneId, chips, spreadRect) {
  const zone = ZONES[zoneId] || ZONES.contentWordZone;
  if (!spreadRect || chips.length === 0) return [];

  const zoneWidth = (zone.x1 - zone.x0) * spreadRect.width;
  const zoneHeight = (zone.y1 - zone.y0) * spreadRect.height;
  const minGap = 8;
  const avgWidth = Math.max(64, chips.reduce((s, c) => s + (c.width || 76), 0) / chips.length);
  const perRow = Math.max(1, Math.floor((zoneWidth - minGap) / (avgWidth + minGap)));

  return chips.map((chip, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = Math.max(1, Math.ceil(chips.length / perRow));
    const yStep = rowCount <= 1 ? 0 : row / (rowCount - 1);
    const xStep = perRow <= 1 ? 0.5 : col / (perRow - 1);
    return {
      left: (zone.x0 + (zone.x1 - zone.x0) * xStep) * 100,
      top: (zone.y0 + (zone.y1 - zone.y0) * yStep) * 100,
    };
  });
}

export function getZoneAnchorMap() {
  return {
    nounZone: { left: '14%', top: '72%' },
    verbZone: { left: '14%', top: '25%' },
    particlePrefixZone: { left: '76%', top: '45%' },
    modifierZone: { left: '86%', top: '14%' },
  };
}

export function getZones() {
  return ZONES;
}
