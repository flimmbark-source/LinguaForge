/**
 * Versebook layout manager with normalized zone definitions.
 */

const ZONES = {
  verbZone: { id: 'verbZone', x0: 0.06, x1: 0.4, y0: 0.16, y1: 0.4, layout: 'arc' },
  nounZone: { id: 'nounZone', x0: 0.06, x1: 0.4, y0: 0.56, y1: 0.86, layout: 'grid' },
  particlePrefixZone: { id: 'particlePrefixZone', x0: 0.58, x1: 0.82, y0: 0.2, y1: 0.82, layout: 'strip' },
  modifierZone: { id: 'modifierZone', x0: 0.74, x1: 0.92, y0: 0.08, y1: 0.28, layout: 'cluster' },
  verseLineZone: { id: 'verseLineZone', x0: 0.2, x1: 0.8, y0: 0.46, y1: 0.62, layout: 'line' },
};

const CATEGORY_TO_ZONE = {
  verb: 'verbZone',
  noun: 'nounZone',
  particle: 'particlePrefixZone',
  prefix: 'particlePrefixZone',
  modifier: 'modifierZone',
  unknown: 'nounZone',
};

export function getVerseLayoutZones() {
  return ZONES;
}

export function zoneForCategory(category) {
  return CATEGORY_TO_ZONE[category] || CATEGORY_TO_ZONE.unknown;
}

function zoneRect(zone, width, height) {
  return {
    left: zone.x0 * width,
    right: zone.x1 * width,
    top: zone.y0 * height,
    bottom: zone.y1 * height,
    width: (zone.x1 - zone.x0) * width,
    height: (zone.y1 - zone.y0) * height,
  };
}

function arcSlots(rect, count) {
  if (count <= 0) return [];
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.76;
  const rx = Math.max(30, rect.width * 0.43);
  const ry = Math.max(20, rect.height * 0.48);
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const ang = Math.PI * (0.12 + 0.76 * t);
    return {
      x: (cx - Math.cos(ang) * rx),
      y: (cy - Math.sin(ang) * ry),
    };
  });
}

function gridSlots(rect, count) {
  const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(count || 1))));
  const rowGap = Math.max(32, rect.height / 3.2);
  const colGap = Math.max(58, rect.width / Math.max(2, cols + 0.1));
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      x: rect.left + colGap * (0.8 + col),
      y: rect.top + rowGap * (0.65 + row),
    };
  });
}

function stripSlots(rect, count) {
  const gap = Math.max(34, rect.height / Math.max(1.5, count));
  return Array.from({ length: count }, (_, i) => ({
    x: rect.left + rect.width * (0.5 + (i % 2 ? 0.06 : -0.06)),
    y: rect.top + gap * (0.6 + i),
  }));
}

function clusterSlots(rect, count) {
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    return {
      x: rect.left + rect.width * (0.35 + col * 0.35),
      y: rect.top + rect.height * (0.35 + row * 0.35),
    };
  });
}

export function computeZoneSlots(zoneId, chipIds, overlayRect) {
  const zone = ZONES[zoneId] || ZONES.nounZone;
  const rect = zoneRect(zone, overlayRect.width, overlayRect.height);
  const count = chipIds.length;
  let slots = [];
  if (zone.layout === 'arc') slots = arcSlots(rect, count);
  else if (zone.layout === 'grid') slots = gridSlots(rect, count);
  else if (zone.layout === 'strip') slots = stripSlots(rect, count);
  else if (zone.layout === 'cluster') slots = clusterSlots(rect, count);

  const positions = {};
  slots.forEach((slot, idx) => {
    const id = chipIds[idx];
    positions[id] = {
      leftPct: Math.max(2, Math.min(98, (slot.x / overlayRect.width) * 100)),
      topPct: Math.max(2, Math.min(98, (slot.y / overlayRect.height) * 100)),
    };
  });
  return positions;
}

export function verseLineSlots(totalSlots, rtl = true) {
  const start = 0.23;
  const end = 0.77;
  const gap = (end - start) / Math.max(1, totalSlots - 1);
  const seq = Array.from({ length: totalSlots }, (_, i) => start + gap * i);
  if (rtl) seq.reverse();
  return seq.map((x, i) => ({ x, index: i }));
}
