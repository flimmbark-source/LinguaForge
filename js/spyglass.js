import { gameState } from './state.js?v=9';

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
  }

  onPointerUp() {
    this.dragging = false;
  }

  updateLensPosition() {
    if (!this.el) return;
    this.el.style.left = `${this.position.x}px`;
    this.el.style.top = `${this.position.y}px`;
  }

  revealWordAtCurrentPosition() {
    if (!this.labelEl) return;

    const hoverElements = document.elementsFromPoint(this.position.x, this.position.y);
    const target = hoverElements.find((el) => el?.dataset?.verseWord);
    const word = target?.dataset?.verseWord;

    if (!word) {
      this.labelEl.textContent = '—';
      return;
    }

    const usedInLine = gameState.currentLine?.molds?.some((m) => m.pattern === word);
    this.labelEl.textContent = usedInLine ? word : '—';
  }

  registerWorldTargets() {
    const hearthFire = document.getElementById('hearthFire');
    if (hearthFire) hearthFire.dataset.verseWord = 'אש';

    const hearthOpening = document.querySelector('.hearth-opening');
    if (hearthOpening) hearthOpening.dataset.verseWord = 'נשמת';

    const hearthBody = document.querySelector('.hearth-body');
    if (hearthBody) hearthBody.dataset.verseWord = 'כוח';
  }
}

export const spyglassSystem = new SpyglassSystem();
