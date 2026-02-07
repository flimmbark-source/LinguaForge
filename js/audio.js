/**
 * LINGUA FORGE - AUDIO SYSTEM
 * Manages background music and tool sound effects.
 *
 * Placeholder sounds are generated via the Web Audio API.
 * To use real audio files, place them in /audio/ and update the
 * SOUND_FILES map below; the system will prefer files over procedural sounds.
 */

// ─── Sound file paths (swap in real files when available) ────
// Set a path to `null` to fall back to the procedural placeholder.
const SOUND_FILES = {
  // Background
  bgMusic1: null, // e.g. './audio/bg-ambient.mp3'
  bgMusic2: null,
  bgMusic3: null,

  // Hammer / anvil
  hammerClank1: null, // e.g. './audio/hammer-clank-1.mp3'
  hammerClank2: null,
  hammerClank3: null,

  // Mortar & pestle
  pestleGrind1: null, // e.g. './audio/pestle-grind-1.mp3'
  pestleGrind2: null,
  pestleSquelch1: null,

  // Shovel
  shovelScoop: null,  // e.g. './audio/shovel-scoop.mp3'
  shovelDump: null,

  // Hearth
  hearthIgnite: null, // e.g. './audio/hearth-ignite.mp3'
  hearthCrackle: null,
};

// ─── State ───────────────────────────────────────────────────
let audioCtx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let bgSource = null;
let isInitialized = false;

// Pre-decoded audio buffers keyed by SOUND_FILES key
const bufferCache = {};

// ─── Public volume controls (0-1) ───────────────────────────
let musicVolume = 0.3;
let sfxVolume = 0.5;

// ─── Initialise on first user gesture ───────────────────────
export function initAudio() {
  if (isInitialized) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);

  musicGain = audioCtx.createGain();
  musicGain.gain.value = musicVolume;
  musicGain.connect(masterGain);

  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = sfxVolume;
  sfxGain.connect(masterGain);

  isInitialized = true;

  // Pre-load any real audio files
  Object.entries(SOUND_FILES).forEach(([key, path]) => {
    if (path) preloadSound(key, path);
  });
}

async function preloadSound(key, path) {
  try {
    const res = await fetch(path);
    const buf = await res.arrayBuffer();
    bufferCache[key] = await audioCtx.decodeAudioData(buf);
  } catch (e) {
    console.warn(`Audio: could not load ${path}`, e);
  }
}

function ensureCtx() {
  if (!isInitialized) initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ─── Play a cached buffer ────────────────────────────────────
function playBuffer(key, dest) {
  const buf = bufferCache[key];
  if (!buf) return false;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(dest);
  src.start();
  return true;
}

// ═══════════════════════════════════════════════════════════════
// PROCEDURAL PLACEHOLDER SOUNDS  (Web Audio API synthesis)
// ═══════════════════════════════════════════════════════════════

function metalClank(pitch) {
  ensureCtx();
  const t = audioCtx.currentTime;
  // Filtered noise burst + sine ping = metallic clank
  const osc = audioCtx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(pitch, t);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, t + 0.15);

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.35, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = pitch * 1.5;
  filter.Q.value = 8;

  osc.connect(filter);
  filter.connect(env);
  env.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.2);
}

function grindNoise(duration) {
  ensureCtx();
  const t = audioCtx.currentTime;
  const len = duration || 0.25;
  // Brown-ish noise through a low-pass for a gritty grind
  const bufSize = audioCtx.sampleRate * len;
  const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + (0.02 * white)) / 1.02;
    data[i] = last * 3.5;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;

  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.3, t);
  env.gain.linearRampToValueAtTime(0.15, t + len * 0.5);
  env.gain.exponentialRampToValueAtTime(0.001, t + len);

  src.connect(lp);
  lp.connect(env);
  env.connect(sfxGain);
  src.start(t);
  src.stop(t + len);
}

function squelchSound() {
  ensureCtx();
  const t = audioCtx.currentTime;
  // Low-freq wobble + filtered noise = wet squelch
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.25, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

  osc.connect(env);
  env.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.22);
}

function scoopSound() {
  ensureCtx();
  const t = audioCtx.currentTime;
  // Quick filtered noise sweep = digging / scraping
  const bufSize = audioCtx.sampleRate * 0.2;
  const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2000, t);
  bp.frequency.exponentialRampToValueAtTime(400, t + 0.18);
  bp.Q.value = 2;

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.25, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

  src.connect(bp);
  bp.connect(env);
  env.connect(sfxGain);
  src.start(t);
  src.stop(t + 0.22);
}

function dumpSound() {
  ensureCtx();
  const t = audioCtx.currentTime;
  // Soft thud + scatter
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.3, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

  osc.connect(env);
  env.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.17);
}

function fireIgniteSound() {
  ensureCtx();
  const t = audioCtx.currentTime;
  // Whoosh + crackle
  const bufSize = audioCtx.sampleRate * 0.4;
  const noiseBuf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
  bp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
  bp.Q.value = 1;

  const env = audioCtx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.3, t + 0.05);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

  src.connect(bp);
  bp.connect(env);
  env.connect(sfxGain);
  src.start(t);
  src.stop(t + 0.42);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API  — call these from tool systems
// ═══════════════════════════════════════════════════════════════

/** Hammer strikes the anvil (randomly picks one of 3 variants) */
export function playHammerClank() {
  ensureCtx();
  const variant = Math.floor(Math.random() * 3) + 1;
  const key = `hammerClank${variant}`;
  if (!playBuffer(key, sfxGain)) {
    // Procedural fallback – vary pitch for variety
    const pitches = [800, 1000, 1200];
    metalClank(pitches[variant - 1] + (Math.random() * 100 - 50));
  }
}

/** Pestle grinding in mortar */
export function playPestleGrind() {
  ensureCtx();
  const keys = ['pestleGrind1', 'pestleGrind2'];
  const key = keys[Math.floor(Math.random() * keys.length)];
  if (!playBuffer(key, sfxGain)) {
    grindNoise(0.2 + Math.random() * 0.1);
  }
}

/** Pestle squelch / squish */
export function playPestleSquelch() {
  ensureCtx();
  if (!playBuffer('pestleSquelch1', sfxGain)) {
    squelchSound();
  }
}

/** Shovel scoops letters */
export function playShovelScoop() {
  ensureCtx();
  if (!playBuffer('shovelScoop', sfxGain)) {
    scoopSound();
  }
}

/** Shovel dumps letters into hearth */
export function playShovelDump() {
  ensureCtx();
  if (!playBuffer('shovelDump', sfxGain)) {
    dumpSound();
  }
}

/** Hearth ignites / letters consumed */
export function playHearthIgnite() {
  ensureCtx();
  if (!playBuffer('hearthIgnite', sfxGain)) {
    fireIgniteSound();
  }
}

// ─── Background music ────────────────────────────────────────

/** Start looping background ambient track */
export function startBackgroundMusic() {
  ensureCtx();
  if (bgSource) return; // already playing

  if (bufferCache.bgMusic) {
    bgSource = audioCtx.createBufferSource();
    bgSource.buffer = bufferCache.bgMusic;
    bgSource.loop = true;
    bgSource.connect(musicGain);
    bgSource.start();
    return;
  }

  // Procedural placeholder: gentle ambient drone
  startProceduralAmbient();
}

let ambientOscillators = [];

function startProceduralAmbient() {
  // Layered low drones with slow LFO modulation
  const t = audioCtx.currentTime;

  const notes = [65.41, 98.0, 130.81]; // C2, G2, C3
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.value = freq;

    // Slow vibrato
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.15 + i * 0.1;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 2;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const env = audioCtx.createGain();
    env.gain.value = 0.06 - i * 0.015;

    osc.connect(env);
    env.connect(musicGain);

    osc.start(t);
    lfo.start(t);

    ambientOscillators.push({ osc, lfo, env });
  });

  bgSource = true; // mark as playing
}

/** Stop background music */
export function stopBackgroundMusic() {
  if (ambientOscillators.length) {
    ambientOscillators.forEach(({ osc, lfo, env }) => {
      env.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
      osc.stop(audioCtx.currentTime + 1.1);
      lfo.stop(audioCtx.currentTime + 1.1);
    });
    ambientOscillators = [];
  }
  if (bgSource && bgSource !== true) {
    bgSource.stop();
  }
  bgSource = null;
}

// ─── Volume controls ─────────────────────────────────────────

export function setMusicVolume(v) {
  musicVolume = Math.max(0, Math.min(1, v));
  if (musicGain) musicGain.gain.value = musicVolume;
}

export function setSfxVolume(v) {
  sfxVolume = Math.max(0, Math.min(1, v));
  if (sfxGain) sfxGain.gain.value = sfxVolume;
}

export function getMusicVolume() { return musicVolume; }
export function getSfxVolume() { return sfxVolume; }

export function toggleMute() {
  if (!masterGain) return;
  masterGain.gain.value = masterGain.gain.value > 0 ? 0 : 1;
}

export function isMuted() {
  return masterGain ? masterGain.gain.value === 0 : false;
}
