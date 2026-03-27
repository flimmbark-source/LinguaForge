import { gameState } from './state.js?v=9';
import { handleToolDragNearSidebar, shouldPutToolAway, cleanupToolDragSidebar } from './toolSidebarHelpers.js?v=9';

export class SpyglassSystem {
  constructor() {
    this.active = false;
    this.dragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.position = {
      x: Math.round(window.innerWidth * 0.7),
      y: Math.round(window.innerHeight * 0.35),
    };

    this.el = null;
    this.labelEl = null;
    this.onPutAway = null;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
  }

  ensureElement() {
    if (this.el && this.el.isConnected) return;

    const lens = document.createElement('div');
    lens.className = 'spyglass-lens';

    const label = document.createElement('div');
    label.className = 'spyglass-word';
    label.textContent = '—';

    lens.appendChild(label);
    document.body.appendChild(lens);

    this.el = lens;
    this.labelEl = label;
    this.updateLensPosition();
  }

  startAt(clientX, clientY) {
    this.ensureElement();
    this.active = true;

    if (typeof clientX === 'number' && typeof clientY === 'number') {
      this.position.x = clientX;
      this.position.y = clientY;
      this.updateLensPosition();
    }

    this.el.classList.add('active');
    this.el.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);

    this.revealWordAtCurrentPosition();
  }

  stop() {
    this.active = false;
    this.dragging = false;
    if (this.el) {
      this.el.classList.remove('active');
      this.el.removeEventListener('pointerdown', this.onPointerDown);
    }
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
    cleanupToolDragSidebar();
  }

  onPointerDown(e) {
    if (!this.active) return;
    e.preventDefault();
    this.dragging = true;
    const rect = this.el.getBoundingClientRect();
    this.offsetX = e.clientX - (rect.left + rect.width / 2);
    this.offsetY = e.clientY - (rect.top + rect.height / 2);
    this.el.setPointerCapture?.(e.pointerId);
  }

  onPointerMove(e) {
    if (!this.active || !this.dragging) return;
    this.position.x = e.clientX - this.offsetX;
    this.position.y = e.clientY - this.offsetY;
    this.updateLensPosition();
    this.revealWordAtCurrentPosition();
    handleToolDragNearSidebar(e.clientX);
  }

  onPointerUp(e) {
    if (!this.dragging) return;

    const sidebar = document.getElementById('toolsSidebar');
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
    const droppedInSidebarRect = Boolean(
      e && sidebarRect &&
      e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right &&
      e.clientY >= sidebarRect.top && e.clientY <= sidebarRect.bottom
    );
    const droppedNearRightEdge = Boolean(e && e.clientX >= window.innerWidth - 110);

    if (e && (shouldPutToolAway(e.clientX, e.clientY) || droppedInSidebarRect || droppedNearRightEdge)) {
      if (this.onPutAway) {
        this.onPutAway();
      } else {
        this.stop();
      }
      return;
    }
    cleanupToolDragSidebar();
    this.dragging = false;
  }

  updateLensPosition() {
    if (!this.el) return;
    this.el.style.left = `${this.position.x}px`;
    this.el.style.top = `${this.position.y}px`;
  }

  /** Helper: check if a word is used in the current mold line */
  _wordInMolds(word) {
  if (gameState.currentLine?.molds?.some((m) => m.pattern === word)) return true;

    const bucketIds = ['bucketFirst', 'bucketSecond'];
    return bucketIds.some((id) => document.getElementById(id)?.dataset?.verseWord === word);
  }

  /** Helper: show a word (or dash) based on whether it's in the current molds */
  _showWord(word) {
    const usedInLine = this._wordInMolds(word);
    this.labelEl.textContent = usedInLine ? word : '—';
  }

  revealWordAtCurrentPosition() {
    if (!this.labelEl) return;

    const pointInRect = (rect) => Boolean(
      rect &&
      this.position.x >= rect.left && this.position.x <= rect.right &&
      this.position.y >= rect.top && this.position.y <= rect.bottom
    );

    // Check anvil glyph (Power)
    const glyphRect = document.getElementById('anvilGlyph')?.getBoundingClientRect?.() || null;
    if (glyphRect && glyphRect.width > 0 && pointInRect(glyphRect)) {
      this._showWord('כוח');
      return;
    }

    const anvilRect = typeof window.getAnvilViewportRect === 'function'
      ? window.getAnvilViewportRect()
      : null;
    const overAnvil = Boolean(
      anvilRect &&
      this.position.x >= anvilRect.left && this.position.x <= anvilRect.right &&
      this.position.y >= anvilRect.top && this.position.y <= anvilRect.bottom
    );

    if (overAnvil) {
      this._showWord('כוח');
      return;
    }

    // Expanded fire detection: use the entire hearth-opening as the fire zone
    const hearthOpeningRect = document.querySelector('.hearth-opening')?.getBoundingClientRect?.() || null;
    const hearthFireRect = document.getElementById('hearthFire')?.getBoundingClientRect?.() || null;
    if (pointInRect(hearthOpeningRect) || pointInRect(hearthFireRect)) {
      this._showWord('אש');
      return;
    }

    // Steam plume + breath → Breath word
    const steamPlumeRect = document.getElementById('hearthSteamPlume')?.getBoundingClientRect?.() || null;
    const hearthBreathRect = document.getElementById('hearthBreath')?.getBoundingClientRect?.() || null;
    if (pointInRect(steamPlumeRect) || pointInRect(hearthBreathRect)) {
      this._showWord('נשמת');
      return;
    }

    // Show each bucket's configured verse word so it flows through molds/glossary/anvil.
    const worldBuckets = [
      document.getElementById('bucketFirst'),
      document.getElementById('bucketSecond'),
    ];
    for (const bucket of worldBuckets) {
      if (!bucket) continue;
      const r = bucket.getBoundingClientRect();
      if (r.width > 0 && pointInRect(r)) {
        this._showWord(bucket.dataset.verseWord || '—');
        return;
      }
    }

    const hoverElements = document.elementsFromPoint(this.position.x, this.position.y);
    const target = hoverElements.find((el) => el?.dataset?.verseWord);
    const word = target?.dataset?.verseWord;

    if (!word) {
      this.labelEl.textContent = '—';
      return;
    }

    const usedInLine = this._wordInMolds(word);
    this.labelEl.textContent = usedInLine ? word : '—';
  }

  registerWorldTargets() {
    const hearthFire = document.getElementById('hearthFire');
    if (hearthFire) hearthFire.dataset.verseWord = 'אש';

    const hearthBreath = document.getElementById('hearthBreath');
    if (hearthBreath) hearthBreath.dataset.verseWord = 'נשמת';

    const steamPuffs = document.querySelectorAll('.hearth-steam');
    steamPuffs.forEach((el) => {
      el.dataset.verseWord = 'נשמת';
    });

    // Steam plume wisps
    const steamWisps = document.querySelectorAll('.steam-wisp');
    steamWisps.forEach((el) => {
      el.dataset.verseWord = 'נשמת';
    });

    const steamPlume = document.getElementById('hearthSteamPlume');
    if (steamPlume) steamPlume.dataset.verseWord = 'נשמת';

    // Anvil glyph
    const glyph = document.getElementById('anvilGlyph');
    if (glyph) glyph.dataset.verseWord = 'כוח';
  }
}

export const spyglassSystem = new SpyglassSystem();
