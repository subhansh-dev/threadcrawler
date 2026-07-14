/* ═══════════════════════════════════════════════════════════
   THREAD CRAWLER — Pokemon Gameboy-style Dungeon Crawler
   Procedural generation + polished 2D top-down gameplay
   ═══════════════════════════════════════════════════════════ */

// ─── VIRTUAL INPUT (for on-screen console buttons) ──────────
const virtualBtn = {
  up: false, down: false, left: false, right: false,
  a: false, b: false, start: false, select: false,
  // Edge detection: true on the frame a button is first pressed
  _prevA: false, _prevB: false, _prevStart: false,
  aDown: false, bDown: false, startDown: false,
};

function isVirtualDown(dir) { return virtualBtn[dir] || false; }
function isVirtualA() { return virtualBtn.aDown; }
function isVirtualB() { return virtualBtn.bDown; }
function isVirtualStart() { return virtualBtn.startDown; }

// Called every frame after reading input
function updateVirtualInput() {
  virtualBtn.aDown = virtualBtn.a && !virtualBtn._prevA;
  virtualBtn.bDown = virtualBtn.b && !virtualBtn._prevB;
  virtualBtn.startDown = virtualBtn.start && !virtualBtn._prevStart;
  virtualBtn._prevA = virtualBtn.a;
  virtualBtn._prevB = virtualBtn.b;
  virtualBtn._prevStart = virtualBtn.start;
}

// ─── SOUND ENGINE ────────────────────────────────────────────
let audioCtx = null;
let musicPlaying = false;
let musicNodes = [];
let masterMusicGain = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSound(freq, duration, type = 'square', volume = 0.08) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

// ─── PROCEDURAL MUSIC ENGINE ─────────────────────────────────
const MUSIC_PATTERNS = {
  0: { // Thread Depths - mysterious ambient
    bpm: 90, bass: [110,0,110,0,130,0,110,0,146,0,130,0,110,0,98,0],
    melody: [440,0,0,523,0,0,440,0,392,0,0,349,0,440,0,0],
    pad: [220, 261, 293, 261],
  },
  1: { // Void Corridor - dark drone
    bpm: 75, bass: [82,0,82,0,0,82,0,0,92,0,92,0,0,82,0,0],
    melody: [330,0,0,0,294,0,0,0,262,0,0,0,294,0,0,0],
    pad: [165, 196, 220, 196],
  },
  2: { // Emerald Cavern - flowing water
    bpm: 100, bass: [146,0,164,0,146,0,130,0,146,0,164,0,196,0,164,0],
    melody: [587,0,659,0,587,0,0,523,587,0,659,0,784,0,659,0],
    pad: [293, 330, 392, 330],
  },
  3: { // Crimson Depths - tense chase
    bpm: 120, bass: [146,146,0,146,164,0,146,0,130,130,0,130,146,0,130,0],
    melody: [587,0,698,0,587,0,523,0,494,0,587,0,523,0,440,0],
    pad: [293, 349, 392, 349],
  },
  4: { // Golden Halls - regal fanfare
    bpm: 110, bass: [164,0,196,0,220,0,196,0,164,0,220,0,261,0,220,0],
    melody: [659,0,784,0,880,0,784,0,659,0,880,0,1046,0,880,0],
    pad: [330, 392, 440, 392],
  },
  5: { // Frozen Abyss - crystalline
    bpm: 85, bass: [116,0,0,116,0,0,130,0,0,130,0,0,146,0,0,146],
    melody: [466,0,0,523,0,0,466,0,0,392,0,0,466,0,0,0],
    pad: [233, 261, 293, 261],
  },
  6: { // Shadow Realm - eerie whispers
    bpm: 70, bass: [87,0,0,0,98,0,0,0,87,0,0,0,73,0,0,0],
    melody: [349,0,0,0,0,330,0,0,294,0,0,0,0,262,0,0],
    pad: [174, 196, 220, 174],
  },
};

function startMusic(floorTheme) {
  try {
    const ctx = getAudioCtx();
    if (musicPlaying) stopMusic();

    masterMusicGain = ctx.createGain();
    masterMusicGain.gain.setValueAtTime(0.12, ctx.currentTime);
    masterMusicGain.connect(ctx.destination);

    const pattern = MUSIC_PATTERNS[floorTheme % 7];
    const beatLen = 60 / pattern.bpm;
    const loopLen = pattern.bass.length * beatLen;

    // Bass line
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'square';
    bassGain.gain.setValueAtTime(0.3, ctx.currentTime);
    bassOsc.connect(bassGain);
    bassGain.connect(masterMusicGain);
    bassOsc.start(ctx.currentTime);
    musicNodes.push(bassOsc, bassGain);

    // Schedule bass notes in a loop
    function scheduleBass() {
      const now = ctx.currentTime;
      pattern.bass.forEach((note, i) => {
        if (note > 0) {
          bassOsc.frequency.setValueAtTime(note, now + i * beatLen);
          bassGain.gain.setValueAtTime(0.3, now + i * beatLen);
          bassGain.gain.exponentialRampToValueAtTime(0.05, now + i * beatLen + beatLen * 0.8);
        } else {
          bassGain.gain.setValueAtTime(0.001, now + i * beatLen);
        }
      });
    }
    scheduleBass();
    const bassLoop = setInterval(scheduleBass, loopLen * 1000);
    musicNodes.push({ stop: () => clearInterval(bassLoop) });

    // Melody line
    const melOsc = ctx.createOscillator();
    const melGain = ctx.createGain();
    melOsc.type = 'sine';
    melGain.gain.setValueAtTime(0.15, ctx.currentTime);
    melOsc.connect(melGain);
    melGain.connect(masterMusicGain);
    melOsc.start(ctx.currentTime);
    musicNodes.push(melOsc, melGain);

    function scheduleMelody() {
      const now = ctx.currentTime;
      pattern.melody.forEach((note, i) => {
        if (note > 0) {
          melOsc.frequency.setValueAtTime(note, now + i * beatLen);
          melGain.gain.setValueAtTime(0.15, now + i * beatLen);
          melGain.gain.exponentialRampToValueAtTime(0.01, now + i * beatLen + beatLen * 1.5);
        } else {
          melGain.gain.setValueAtTime(0.001, now + i * beatLen);
        }
      });
    }
    scheduleMelody();
    const melLoop = setInterval(scheduleMelody, loopLen * 1000);
    musicNodes.push({ stop: () => clearInterval(melLoop) });

    // Pad (sustained chords)
    const padOsc = ctx.createOscillator();
    const padGain = ctx.createGain();
    padOsc.type = 'triangle';
    padGain.gain.setValueAtTime(0.06, ctx.currentTime);
    padOsc.connect(padGain);
    padGain.connect(masterMusicGain);
    padOsc.start(ctx.currentTime);
    musicNodes.push(padOsc, padGain);

    let padIdx = 0;
    function cyclePad() {
      padOsc.frequency.setValueAtTime(pattern.pad[padIdx % pattern.pad.length], ctx.currentTime);
      padIdx++;
    }
    cyclePad();
    const padLoop = setInterval(cyclePad, loopLen * 1000 / 4);
    musicNodes.push({ stop: () => clearInterval(padLoop) });

    // Noise layer (atmosphere)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(200, ctx.currentTime);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.03, ctx.currentTime);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterMusicGain);
    noiseSource.start(ctx.currentTime);
    musicNodes.push(noiseSource, noiseFilter, noiseGain);

    musicPlaying = true;
  } catch(e) {}
}

function stopMusic() {
  musicNodes.forEach(n => { try { if (n.stop) n.stop(); else if (n.disconnect) n.disconnect(); } catch(e) {} });
  musicNodes = [];
  musicPlaying = false;
}

function setMusicVolume(vol) {
  if (masterMusicGain) {
    try { masterMusicGain.gain.setValueAtTime(vol, audioCtx.currentTime); } catch(e) {}
  }
}

const SFX = {
  shoot: () => playSound(800, 0.08, 'square', 0.06),
  hit: () => { playSound(200, 0.1, 'sawtooth', 0.07); playSound(150, 0.15, 'square', 0.05); },
  kill: () => { playSound(600, 0.05, 'square', 0.06); playSound(800, 0.08, 'square', 0.05); playSound(1000, 0.1, 'sine', 0.04); },
  hurt: () => { playSound(150, 0.2, 'sawtooth', 0.08); playSound(100, 0.3, 'square', 0.06); },
  heal: () => { playSound(523, 0.1, 'sine', 0.06); playSound(659, 0.1, 'sine', 0.05); playSound(784, 0.15, 'sine', 0.04); },
  power: () => { playSound(440, 0.08, 'sine', 0.06); playSound(660, 0.12, 'sine', 0.05); },
  trap: () => { playSound(100, 0.15, 'sawtooth', 0.08); playSound(80, 0.2, 'square', 0.06); },
  exit: () => { playSound(330, 0.15, 'sine', 0.05); playSound(440, 0.15, 'sine', 0.04); playSound(550, 0.2, 'sine', 0.03); },
  levelup: () => { playSound(523, 0.1, 'sine', 0.06); playSound(659, 0.1, 'sine', 0.05); playSound(784, 0.1, 'sine', 0.05); playSound(1047, 0.2, 'sine', 0.04); },
  death: () => { playSound(200, 0.3, 'sawtooth', 0.08); playSound(100, 0.5, 'square', 0.06); },
  step: () => playSound(120, 0.03, 'square', 0.02),
  chest: () => { playSound(523, 0.08, 'sine', 0.05); playSound(659, 0.08, 'sine', 0.04); playSound(784, 0.12, 'sine', 0.04); },
  // Horror ambient sounds
  drip: () => { playSound(800 + Math.random() * 400, 0.15, 'sine', 0.03); },
  wind: () => { playSound(80 + Math.random() * 40, 0.8, 'sawtooth', 0.015); },
  creak: () => { playSound(120 + Math.random() * 60, 0.3, 'sawtooth', 0.02); },
  whisper: () => { playSound(200 + Math.random() * 100, 0.5, 'sine', 0.01); playSound(300 + Math.random() * 100, 0.4, 'sine', 0.008); },
  heartbeat: () => { playSound(60, 0.15, 'sine', 0.04); setTimeout(() => playSound(50, 0.12, 'sine', 0.03), 200); },
  monsterGrowl: () => { playSound(80, 0.4, 'sawtooth', 0.04); playSound(60, 0.5, 'square', 0.02); },
  jumpscare: () => { playSound(1200, 0.05, 'square', 0.12); playSound(800, 0.1, 'sawtooth', 0.08); playSound(400, 0.2, 'sawtooth', 0.06); },
};

// ─── MATH UTILITIES ──────────────────────────────────────────
class PerlinNoise {
  constructor(seed = 42) {
    this.perm = new Uint8Array(512);
    this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  dot(g, x, y) { return g[0] * x + g[1] * y; }
  noise2D(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = this.fade(xf), v = this.fade(yf);
    const aa = this.perm[this.perm[X] + Y] % 12, ab = this.perm[this.perm[X] + Y + 1] % 12;
    const ba = this.perm[this.perm[X + 1] + Y] % 12, bb = this.perm[this.perm[X + 1] + Y + 1] % 12;
    return this.lerp(
      this.lerp(this.dot(this.grad3[aa], xf, yf), this.dot(this.grad3[ba], xf - 1, yf), u),
      this.lerp(this.dot(this.grad3[ab], xf, yf - 1), this.dot(this.grad3[bb], xf - 1, yf - 1), u), v
    );
  }
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + t * (b - a); }
}

function fbm(perlin, x, y, octaves = 4) {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) { v += a * perlin.noise2D(x * f, y * f); m += a; a *= 0.5; f *= 2; }
  return v / m;
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function cellularAutomata(w, h, fill = 0.42, iters = 5, rng = Math.random) {
  let g = Array.from({ length: h }, () => Array.from({ length: w }, () => rng() < fill ? 1 : 0));
  for (let n = 0; n < iters; n++) {
    const ng = g.map(r => [...r]);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx || dy) c += g[y + dy][x + dx]; }
      ng[y][x] = c >= 5 ? 1 : 0;
    }
    g = ng;
  }
  return g;
}

// ─── CONSTANTS ───────────────────────────────────────────────
const TILE = 16;
const MAP_W = 100;
const MAP_H = 80;
const PLAYER_SPEED = 100;
const BULLET_SPEED = 200;
const VIEW_RADIUS = 12;
const INTERACTION_COOLDOWN = 0.4;

const T = {
  FLOOR: 0, WALL: 1, EXIT: 2, SPAWN: 3, TRAP: 4, HEAL: 5, POWER: 6,
  WATER: 7, GRASS_TALL: 8, PATH: 9, FENCE: 10, TREE: 11,
  FLOOR_ALT: 12, CARPET: 13, STAIRS: 14, CHEST: 15,
  LAVA: 16, ICE: 17, SAND: 18, BRIDGE: 19, FLOWER: 20, POISON: 21, SPIKES: 22,
  LOCKED_CHEST: 23, BONUS: 24,
};

const SOLID_TILES = new Set([T.WALL, T.FENCE, T.TREE, T.LAVA]);
const SLOW_TILES = new Set([T.WATER, T.GRASS_TALL, T.ICE]);
const HAZARD_TILES = new Set([T.TRAP, T.LAVA, T.POISON, T.SPIKES]);
const COMMUNITY_LOCKED = new Set([T.LOCKED_CHEST]);

// ─── ITEM DEFINITIONS ────────────────────────────────────────
const ITEMS = {
  health_potion: { name: 'Health Potion', desc: 'Restore 40 HP', type: 'consumable', icon: '♥', color: 0x34D399, effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + 40); } },
  mega_potion: { name: 'Mega Potion', desc: 'Restore 80 HP', type: 'consumable', icon: '♥+', color: 0x22C55E, effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + 80); } },
  bomb: { name: 'Bomb', desc: 'Deal 50 damage to all nearby enemies', type: 'consumable', icon: '●', color: 0xEF4444, effect: (p) => { /* handled in useItem with scene access */ } },
  shield_item: { name: 'Shield', desc: 'Block the next 3 hits', type: 'equipment', icon: '◆', color: 0x93C5FD, effect: (p) => { p.shield = 3; } },
  speed_boots: { name: 'Speed Boots', desc: '+30% movement speed', type: 'equipment', icon: '»', color: 0xFBBF24, effect: (p) => { p.speedMult = 1.3; } },
  atk_gem: { name: 'Attack Gem', desc: '+5 ATK permanently', type: 'consumable', icon: '▲', color: 0xEF4444, effect: (p) => { p.atk += 5; } },
  def_gem: { name: 'Defense Gem', desc: '+3 DEF permanently', type: 'consumable', icon: '▼', color: 0x3B82F6, effect: (p) => { p.def += 3; } },
  key: { name: 'Dungeon Key', desc: 'Opens locked doors', type: 'key', icon: '⚷', color: 0xFBBF24, effect: null },
  compass: { name: 'Compass', desc: 'Reveals exit on minimap', type: 'passive', icon: '◎', color: 0xA882F7, effect: null },
};

// ─── STATUS EFFECTS ──────────────────────────────────────────
const STATUS = {
  POISON: { name: 'Poison', color: 0x34D399, duration: 5, tickDamage: 2 },
  FREEZE: { name: 'Freeze', color: 0x22D3EE, duration: 3, speedMult: 0.5 },
  BURN: { name: 'Burn', color: 0xEF4444, duration: 4, tickDamage: 3 },
  SHIELD: { name: 'Shield', color: 0x3B82F6, duration: -1, blocks: 3 },
  HASTE: { name: 'Haste', color: 0xFBBF24, duration: 5, speedMult: 1.5 },
  REGEN: { name: 'Regen', color: 0x34D399, duration: 8, healPerTick: 2 },
};

// ─── COMBO SYSTEM ────────────────────────────────────────────
let combo = { count: 0, timer: 0, multiplier: 1, maxCombo: 0 };
const COMBO_TIMEOUT = 2.0; // seconds to maintain combo
const COMBO_THRESHOLDS = [3, 5, 8, 12, 20]; // combo milestones

function getComboMultiplier() {
  if (combo.count < 3) return 1;
  if (combo.count < 5) return 1.5;
  if (combo.count < 8) return 2;
  if (combo.count < 12) return 3;
  if (combo.count < 20) return 4;
  return 5;
}

function addCombo() {
  combo.count++;
  combo.timer = COMBO_TIMEOUT;
  combo.multiplier = getComboMultiplier();
  combo.maxCombo = Math.max(combo.maxCombo, combo.count);
  // Milestone effects
  if (COMBO_THRESHOLDS.includes(combo.count)) {
    SFX.levelup();
    state.log.push(`⚡ ${combo.count}x COMBO!`);
    // Visual flash at milestones
    if (combo.count >= 8) {
      const screenFlash = document.getElementById('screen-flash');
      if (screenFlash) {
        screenFlash.style.background = combo.count >= 12 ? '#F8D838' : '#A882F7';
        screenFlash.style.opacity = '0.3';
        setTimeout(() => { screenFlash.style.opacity = '0'; }, 150);
      }
    }
  }
}

function resetCombo() {
  combo.count = 0;
  combo.multiplier = 1;
}

// ─── WEAPON SYSTEM ────────────────────────────────────────────
const WEAPONS = {
  rusty_sword: { name: 'Rusty Sword', atk: 3, icon: '🗡', color: 0x888888, desc: 'ATK +3' },
  iron_blade: { name: 'Iron Blade', atk: 6, icon: '⚔', color: 0xBBBBBB, desc: 'ATK +6' },
  fire_staff: { name: 'Fire Staff', atk: 8, icon: '🔥', color: 0xEF4444, desc: 'ATK +8, burn chance' },
  ice_bow: { name: 'Ice Bow', atk: 5, icon: '❄', color: 0x22D3EE, desc: 'ATK +5, slow chance' },
  shadow_dagger: { name: 'Shadow Dagger', atk: 10, icon: '🌑', color: 0x6B21A8, desc: 'ATK +10, crit chance' },
  holy_lance: { name: 'Holy Lance', atk: 12, icon: '✦', color: 0xFBBF24, desc: 'ATK +12, heal on kill' },
};

function getRandomWeapon(depth) {
  const pool = Object.keys(WEAPONS);
  const maxIdx = Math.min(pool.length - 1, Math.floor(depth / 2) + 2);
  const idx = Math.floor(Math.random() * (maxIdx + 1));
  const id = pool[idx];
  return { id, ...WEAPONS[id] };
}

// ─── BOSS SYSTEM ──────────────────────────────────────────────
const BOSSES = [
  { name: 'The Thread Wraith', color: 0xEF4444, hp: 150, speed: 30, damage: 20, size: 20, floor: 3 },
  { name: 'Hydra of Forgotten Replies', color: 0xA855F7, hp: 250, speed: 35, damage: 25, size: 24, floor: 5 },
  { name: 'The Original Poster', color: 0xFBBF24, hp: 400, speed: 40, damage: 35, size: 28, floor: 7 },
];

// ─── RANDOM EVENTS ────────────────────────────────────────────
const RANDOM_EVENTS = [
  { id: 'merchant', name: 'Mysterious Merchant', chance: 0.08,
    apply: (p) => { const cost = 20 + state.depth * 10; if (p.gold >= cost) { p.gold -= cost; p.atk += 3; state.log.push(`Merchant: +3 ATK for ${cost}G`); } else { const gift = Math.floor(Math.random() * 10) + 5; p.gold += gift; state.log.push(`Merchant: Free sample! +${gift}G`); } } },
  { id: 'fountain', name: 'Healing Fountain', chance: 0.06,
    apply: (p) => { const heal = Math.floor(p.maxHp * 0.5); p.hp = Math.min(p.maxHp, p.hp + heal); state.log.push(`Fountain: +${heal} HP!`); SFX.heal(); } },
  { id: 'altar', name: 'Cursed Altar', chance: 0.05,
    apply: (p) => { if (Math.random() < 0.5) { p.atk += 8; state.log.push('Altar: +8 ATK!'); } else { p.hp = Math.max(1, p.hp - 30); state.log.push('Altar: -30 HP!'); SFX.hurt(); } } },
  { id: 'shrine', name: 'Ancient Shrine', chance: 0.04,
    apply: (p) => { p.maxHp += 20; p.hp += 20; state.log.push('Shrine: +20 Max HP!'); SFX.power(); } },
  { id: 'trap_room', name: 'Trapped Chest', chance: 0.07,
    apply: (p) => { if (Math.random() < 0.6) { p.gold += 50; state.log.push('Chest: +50 Gold!'); } else { p.hp = Math.max(1, p.hp - 20); state.log.push('Trapped! -20 HP'); SFX.trap(); } } },
  // Horror events
  { id: 'whispers', name: 'Whispers in the Dark', chance: 0.06,
    apply: (p) => { SFX.whisper(); state.log.push('You hear whispers... nothing happens. Or does it?'); } },
  { id: 'blood_pool', name: 'Blood Pool', chance: 0.04,
    apply: (p) => { if (Math.random() < 0.7) { p.atk += 5; state.log.push('Blood ritual: +5 ATK!'); } else { p.hp = Math.max(1, p.hp - 15); state.log.push('Blood curse: -15 HP!'); SFX.hurt(); } } },
  { id: 'shadow_figure', name: 'Shadow Figure', chance: 0.03,
    apply: (p) => { SFX.monsterGrowl(); state.log.push('A shadow watches you...'); p.def += 2; state.log.push('Fear boosts defense: +2 DEF'); } },
  { id: 'creaking_door', name: 'Creaking Door', chance: 0.05,
    apply: (p) => { SFX.creak(); const gold = 15 + state.depth * 5; p.gold += gold; state.log.push(`Found gold behind the door: +${gold}G`); } },
  { id: 'ghostly_touch', name: 'Ghostly Touch', chance: 0.03,
    apply: (p) => { SFX.jumpscare(); if (Math.random() < 0.5) { const heal = 30; p.hp = Math.min(p.maxHp, p.hp + heal); state.log.push(`Ghost heals you: +${heal} HP`); } else { p.hp = Math.max(1, p.hp - 25); state.log.push(`Ghost attacks: -25 HP!`); } } },
];

// ─── ACHIEVEMENTS ─────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Kill your first monster', check: () => state.kills >= 1 },
  { id: 'combo_5', name: 'Combo King', desc: 'Reach 5x combo', check: () => combo.maxCombo >= 5 },
  { id: 'floor_3', name: 'Deep Diver', desc: 'Reach floor 3', check: () => state.depth >= 3 },
    { id: 'floor_7', name: 'Thread Master', desc: 'Clear all floors', check: () => state.depth >= state.totalFloors },
  { id: 'kills_50', name: 'Monster Slayer', desc: 'Kill 50 monsters total', check: () => state.kills >= 50 },
  { id: 'gold_500', name: 'Gold Hoarder', desc: 'Collect 500 gold', check: () => state.player.gold >= 500 },
  { id: 'level_10', name: 'Veteran', desc: 'Reach level 10', check: () => state.player.level >= 10 },
  { id: 'no_damage_floor', name: 'Untouchable', desc: 'Clear a floor without taking damage', check: () => false }, // checked manually
];

let unlockedAchievements = new Set();
let floorDamageTaken = 0;

function checkAchievements() {
  ACHIEVEMENTS.forEach(a => {
    if (!unlockedAchievements.has(a.id) && a.check()) {
      unlockedAchievements.add(a.id);
      state.log.push(`🏆 Achievement: ${a.name}!`);
      SFX.levelup();
    }
  });
}

// ─── PERSISTENT UPGRADES (localStorage) ───────────────────────
const UPGRADES = {
  max_hp: { name: 'Max HP', desc: '+10 HP per level', baseCost: 30, costMult: 1.5, apply: (p) => { p.maxHp += 10; p.hp += 10; } },
  attack: { name: 'Attack', desc: '+2 ATK per level', baseCost: 40, costMult: 1.5, apply: (p) => { p.atk += 2; } },
  defense: { name: 'Defense', desc: '+1 DEF per level', baseCost: 35, costMult: 1.5, apply: (p) => { p.def += 1; } },
  speed: { name: 'Speed', desc: '+10% speed', baseCost: 50, costMult: 1.8, apply: (p) => { p.speedMult += 0.1; } },
  inv_size: { name: 'Bag Size', desc: '+2 inventory slots', baseCost: 25, costMult: 1.3, apply: (p) => { p.maxInventory += 2; } },
};

// ─── CHARACTER SYSTEM (Reddit Meme Characters) ─────────────────────
const CHARACTERS = {
  cc: {
    name: 'C.C.',
    origin: 'Code Geass',
    desc: 'The Immortal Witch',
    color: 0x90EE90,
    specialQuote: '"I am C.C., the Geass user!"',
    bossQuotes: [
      '"This world shall know pain!"',
      '"All the world\'s a stage, and we are merely players."',
      '"Justice will prevail, you say? But of course it will!"',
    ],
    pixelArt: [
      // 12x18 — C.C. from Code Geass: long green hair, golden eyes, pale skin, white bodysuit
      [0,0,0,4,4,4,4,4,4,0,0,0],
      [0,0,4,4,9,9,9,9,4,4,0,0],
      [0,4,4,9,9,9,9,9,9,4,4,0],
      [0,4,9,9,9,9,9,9,9,9,4,0],
      [0,4,9,3,6,9,9,6,3,9,4,0],
      [0,4,9,9,9,5,5,9,9,9,4,0],
      [0,0,4,9,9,9,9,9,9,4,0,0],
      [0,0,0,4,9,8,8,9,4,0,0,0],
      [0,0,0,0,8,8,8,8,0,0,0,0],
      [0,0,0,8,8,8,8,8,8,0,0,0],
      [0,0,8,9,8,8,8,8,9,8,0,0],
      [0,0,8,9,8,8,8,8,9,8,0,0],
      [0,4,9,9,8,8,8,8,9,9,4,0],
      [0,4,9,9,8,8,8,8,9,9,4,0],
      [0,0,4,4,8,8,8,8,4,4,0,0],
      [0,0,0,4,4,0,0,4,4,0,0,0],
      [0,0,0,4,0,0,0,0,4,0,0,0],
      [0,0,4,4,0,0,0,0,4,4,0,0],
    ],
    palette: {3: 0x111111, 4: 0x2E8B2E, 5: 0xFFAAAA, 6: 0xDAA520, 8: 0xFFF0E0, 9: 0x90EE90}
  },
  tungtung: {
    name: 'Tung Tung Sahur',
    origin: 'Indonesian Meme',
    desc: 'The Wooden Warrior',
    color: 0x8B4513,
    specialQuote: '"TUNG TUNG TUNG TUNG TUNG SAHur!"',
    bossQuotes: [
      '"Bangun! Bangun! Sudah sahur!"',
      '"Tung tung tung! Wake up!"',
      '"No more sleep, only sahur!"',
    ],
    pixelArt: [
      // 12x18 — Tung Tung Sahur: wooden drum figure with sticks
      [0,0,0,0,7,7,7,7,0,0,0,0],
      [0,0,0,7,6,6,6,6,7,0,0,0],
      [0,0,7,6,6,6,6,6,6,7,0,0],
      [0,0,7,6,3,6,6,3,6,7,0,0],
      [0,0,7,6,6,6,6,6,6,7,0,0],
      [0,0,7,6,5,5,5,5,6,7,0,0],
      [0,0,0,7,6,6,6,6,7,0,0,0],
      [0,0,0,0,7,1,1,7,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,1,6,1,1,1,1,1,1,6,1,0],
      [0,1,6,1,1,1,1,1,1,6,1,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,0,0,1,0,0,0,0],
      [0,0,0,1,1,0,0,1,1,0,0,0],
      [0,0,0,1,0,0,0,0,1,0,0,0],
    ],
    palette: {1: 0x6B3410, 3: 0x000000, 5: 0xD4A060, 6: 0xA0522D, 7: 0x8B4513}
  },
  chungus: {
    name: 'Big Chungus',
    origin: 'Reddit Meme',
    desc: 'The Chungus Supreme',
    color: 0xCCCCCC,
    specialQuote: '"He is the big chungus."',
    bossQuotes: [
      '"What\'s up, doc?"',
      '"I\'m the big chungus, baby!"',
      '"Such meme. Very wow."',
    ],
    pixelArt: [
      // 12x18 — Big Chungus: fat bunny, tall ears, round belly, pink nose
      [0,0,1,1,0,0,0,0,1,1,0,0],
      [0,1,1,7,0,0,0,0,7,1,1,0],
      [0,1,1,7,0,0,0,0,7,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,3,1,1,1,1,3,1,0,0],
      [0,0,1,1,1,5,5,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,7,1,1,1,1,1,1,7,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,1,0,0,0,0,1,1,0,0],
      [0,0,0,1,1,0,0,1,1,0,0,0],
      [0,0,0,1,0,0,0,0,1,0,0,0],
    ],
    palette: {1: 0xD0D0D0, 3: 0xCC0000, 5: 0xFFAAAA, 7: 0xBBBBBB}
  },
  doge: {
    name: 'Doge',
    origin: 'Reddit Meme',
    desc: 'Such Wow, Much Adventure',
    color: 0xDEB887,
    specialQuote: '"Much wow. Very dungeon. So crawl. Amaze."',
    bossQuotes: [
      '"Such boss, very defeat, wow!"',
      '"Much victory, so amaze!"',
      '"Very dungeon, such crawler!"',
    ],
    pixelArt: [
      // 12x18 — Doge Shiba Inu: pointed ears, tan fur, white muzzle, smug eyes
      [0,0,4,4,0,0,0,0,4,4,0,0],
      [0,4,4,4,0,0,0,0,4,4,4,0],
      [0,4,1,4,4,4,4,4,4,1,4,0],
      [0,0,4,1,1,1,1,1,1,4,0,0],
      [0,0,0,1,3,1,1,3,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,2,2,1,0,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,1,8,1,1,8,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,1,8,1,1,1,1,8,1,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,0,0,1,0,0,0,0],
      [0,0,0,1,1,0,0,1,1,0,0,0],
      [0,0,0,1,0,0,0,0,1,0,0,0],
    ],
    palette: {1: 0xDEB887, 2: 0x222222, 3: 0x111111, 4: 0xC4A060, 8: 0xFFF8DC}
  },
  datboi: {
    name: 'Dat Boi',
    origin: 'Reddit Meme',
    desc: 'Here He Comes!',
    color: 0x228B22,
    specialQuote: '"O sh*t, waddup!"',
    bossQuotes: [
      '"Here comes dat boi!"',
      '"O sh*t, waddup!"',
      '"Dat boi always delivers!"',
    ],
    pixelArt: [
      // 12x18 — Dat Boi: green frog on unicycle with big white eyes
      [0,0,0,0,6,6,6,6,0,0,0,0],
      [0,0,0,6,6,6,6,6,6,0,0,0],
      [0,0,6,6,6,6,6,6,6,6,0,0],
      [0,0,6,3,3,6,6,3,3,6,0,0],
      [0,0,6,3,3,6,6,3,3,6,0,0],
      [0,0,0,6,6,6,6,6,6,0,0,0],
      [0,0,0,0,6,5,5,6,0,0,0,0],
      [0,0,0,0,0,6,6,0,0,0,0,0],
      [0,0,0,0,6,6,6,6,0,0,0,0],
      [0,0,0,0,6,6,6,6,0,0,0,0],
      [0,0,0,0,0,6,6,0,0,0,0,0],
      [0,0,0,0,0,7,7,0,0,0,0,0],
      [0,0,0,0,7,0,0,7,0,0,0,0],
      [0,0,0,7,0,0,0,0,7,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,0,0,0],
    ],
    palette: {1: 0x888888, 3: 0xFFFFFF, 5: 0x333333, 6: 0x2D8B2D, 7: 0x666666}
  },
  trollface: {
    name: 'Trollface',
    origin: 'Reddit Classic',
    desc: 'Problem, Adventurer?',
    color: 0xFFFFFF,
    specialQuote: '"U mad, bro?"',
    bossQuotes: [
      '"Problem, boss?"',
      '"Problem? I don\'t see any problem here!"',
      '"Problem, adventurer?"',
    ],
    pixelArt: [
      // 12x18 — Trollface: white face, huge creepy grin, squinty eyes, wrinkled
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,3,3,1,1,3,3,1,1,0],
      [0,1,1,3,1,1,1,1,3,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,1,5,5,5,5,1,0,0,0],
      [0,0,1,5,1,5,5,1,5,1,0,0],
      [0,0,1,5,1,1,1,1,5,1,0,0],
      [0,1,1,1,5,1,1,5,1,1,1,0],
      [0,1,1,1,1,5,5,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,0,0,1,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0],
    ],
    palette: {1: 0xF0EDE8, 3: 0x111111, 5: 0xDD4444}
  },
};

let selectedCharacter = 'cc';
let characterSelectionOpen = false;

function loadCharacterSelection() {
  try {
    const saved = localStorage.getItem('threadcrawler_character');
    console.log('Loading character from storage:', saved);
    if (saved && CHARACTERS[saved]) {
      selectedCharacter = saved;
      console.log('Character loaded:', selectedCharacter);
    } else {
      console.log('No valid character saved, using default:', selectedCharacter);
    }
  } catch(e) { console.error('Load failed:', e); }
}

function saveCharacterSelection() {
  try {
    localStorage.setItem('threadcrawler_character', selectedCharacter);
    console.log('Saved character:', selectedCharacter);
  } catch(e) { console.error('Save failed:', e); }
}

function openCharacterSelect() {
  characterSelectionOpen = true;
  renderCharacterSelect();
  const titleScreen = document.getElementById('title-screen');
  const charScreen = document.getElementById('character-select-screen');
  if (titleScreen) titleScreen.classList.remove('show');
  if (charScreen) {
    charScreen.style.display = 'flex';
    charScreen.classList.add('show');
  }
}

function closeCharacterSelect() {
  characterSelectionOpen = false;
  const charScreen = document.getElementById('character-select-screen');
  const titleScreen = document.getElementById('title-screen');
  if (charScreen) {
    charScreen.classList.remove('show');
    charScreen.style.display = '';
  }
  if (titleScreen) titleScreen.classList.add('show');
}

function startGameFromCharSelect() {
  // Character is already saved by the click handler, just start
  console.log('Starting game with character:', selectedCharacter);
  startGame();
}

function renderCharacterSelect() {
  const grid = document.getElementById('character-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(CHARACTERS).forEach(([id, char]) => {
    const isSelected = id === selectedCharacter;
    const el = document.createElement('div');
    el.className = `character-card ${isSelected ? 'selected' : ''}`;
    el.innerHTML = `
      <div class="character-portrait" style="border-color: #${char.color.toString(16).padStart(6, '0')}">
        <canvas id="char-canvas-${id}" width="80" height="108"></canvas>
      </div>
      <div class="character-name">${char.name}${isSelected ? ' ✓' : ''}</div>
      <div class="character-origin">${char.origin}</div>
      <div class="character-desc">${char.desc}</div>
      <div class="character-quote">${char.specialQuote}</div>
    `;
    // Use onclick directly on the element
    el.onclick = function() {
      selectedCharacter = id;
      saveCharacterSelection();
      renderCharacterSelect();
      showToast('Selected: ' + CHARACTERS[selectedCharacter].name + '!', 'success', 1500, '🎮');
      try { SFX.power(); } catch(ex) {}
    };
    grid.appendChild(el);

    // Draw pixel art on canvas
    setTimeout(function() { drawCharacterPixelArt(id, char); }, 10);
  });
}

function drawCharacterPixelArt(id, char) {
  const canvas = document.getElementById(`char-canvas-${id}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rows = char.pixelArt.length;
  const cols = char.pixelArt[0].length;
  const scale = Math.min(Math.floor(canvas.width / cols), Math.floor(canvas.height / rows));
  const offsetX = Math.floor((canvas.width - cols * scale) / 2);
  const offsetY = Math.floor((canvas.height - rows * scale) / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  char.pixelArt.forEach((row, y) => {
    row.forEach((pixel, x) => {
      if (pixel === 0) return;
      ctx.fillStyle = '#' + (char.palette[pixel] || 0x000000).toString(16).padStart(6, '0');
      ctx.fillRect(x * scale + offsetX, y * scale + offsetY, scale, scale);
    });
  });
}

function getCharacterData() {
  return CHARACTERS[selectedCharacter] || CHARACTERS.cc;
}

function getBossDefeatQuote() {
  const char = getCharacterData();
  return char.bossQuotes[Math.floor(Math.random() * char.bossQuotes.length)];
}

function loadPersistentData() {
  try {
    const d = JSON.parse(localStorage.getItem('threadcrawler_save') || '{}');
    persistentGold = d.gold || 0;
    upgradeLevels = d.upgrades || {};
    unlockedAchievements = new Set(d.achievements || []);
    // Restore weapon from save
    if (d.weapon) {
      state.player.weapon = d.weapon;
    }
    // Restore best floor
    if (d.bestFloor) {
      localStorage.setItem('threadcrawler_best_floor', d.bestFloor);
    }
    // Boss rush unlock
    if (d.bossRushUnlocked) {
      state.bossRushUnlocked = true;
    }
    updateBossRushButton();
  } catch(e) {}
}

function savePersistentData() {
  try {
    localStorage.setItem('threadcrawler_save', JSON.stringify({
      gold: persistentGold,
      upgrades: upgradeLevels,
      achievements: [...unlockedAchievements],
      hasCompass: state.player.hasCompass || false,
      weapon: state.player.weapon || null,
      bestFloor: Math.max(state.depth + 1, parseInt(localStorage.getItem('threadcrawler_best_floor') || '1')),
      bossRushUnlocked: state.bossRushUnlocked,
    }));
  } catch(e) {}
}

function updateBossRushButton() {
  const btn = document.getElementById('boss-rush-btn');
  if (btn) {
    btn.style.display = state.bossRushUnlocked ? 'block' : 'none';
  }
}

function buyUpgrade(id) {
  const upg = UPGRADES[id];
  if (!upg) return;
  const level = upgradeLevels[id] || 0;
  const cost = Math.floor(upg.baseCost * Math.pow(upg.costMult, level));
  if (persistentGold < cost) { state.log.push('Not enough gold!'); return; }
  persistentGold -= cost;
  upgradeLevels[id] = level + 1;
  upg.apply(state.player);
  state.log.push(`Upgraded ${upg.name} to Lv.${level + 1}!`);
  SFX.power();
  savePersistentData();
}

function applyPersistentUpgrades() {
  Object.entries(upgradeLevels).forEach(([id, level]) => {
    const upg = UPGRADES[id];
    if (!upg) return;
    for (let i = 0; i < level; i++) upg.apply(state.player);
  });
}

// ─── THE VAULT (META-PROGRESSION SHOP) ──────────────────────
const VAULT_ITEMS = [
  { id: 'max_hp', icon: '♥', color: '#34D399' },
  { id: 'attack', icon: '⚔', color: '#EF4444' },
  { id: 'defense', icon: '🛡', color: '#3B82F6' },
  { id: 'speed', icon: '»', color: '#FBBF24' },
  { id: 'inv_size', icon: '◇', color: '#A882F7' },
];

function openVault() {
  loadPersistentData();
  renderVault();
  document.getElementById('title-screen').classList.remove('show');
  document.getElementById('vault-screen').classList.add('show');
}

function renderVault() {
  const goldEl = document.getElementById('vault-gold-amount');
  const gridEl = document.getElementById('vault-grid');
  const statsEl = document.getElementById('vault-stats');
  if (!goldEl || !gridEl) return;

  goldEl.textContent = persistentGold;

  // Stats
  if (statsEl) {
    const totalLevels = Object.values(upgradeLevels).reduce((a, b) => a + b, 0);
    statsEl.innerHTML = `Total upgrades: ${totalLevels} | Best run: Floor ${localStorage.getItem('threadcrawler_best_floor') || 1}`;
  }

  gridEl.innerHTML = '';
  VAULT_ITEMS.forEach(vi => {
    const upg = UPGRADES[vi.id];
    if (!upg) return;
    const level = upgradeLevels[vi.id] || 0;
    const cost = Math.floor(upg.baseCost * Math.pow(upg.costMult, level));
    const canAfford = persistentGold >= cost;

    const item = document.createElement('div');
    item.className = `vault-item ${canAfford ? '' : 'cant-afford'}`;
    item.innerHTML = `
      <div class="vault-item-name">${upg.name}</div>
      <div class="vault-item-desc">${upg.desc}</div>
      <div class="vault-item-level">Lv.${level}</div>
      <div class="vault-item-cost ${canAfford ? '' : 'too-expensive'}">${cost}G</div>
    `;
    if (canAfford) {
      item.onclick = () => {
        persistentGold -= cost;
        upgradeLevels[vi.id] = level + 1;
        savePersistentData();
        SFX.power();
        renderVault();
      };
    }
    gridEl.appendChild(item);
  });
}

function vaultStartGame() {
  document.getElementById('vault-screen').classList.remove('show');
  startGame();
}

function openVaultFromGameover() {
  document.getElementById('gameover-screen').classList.remove('show');
  openVault();
}

// ─── MID-RUN SHOP ──────────────────────────────────────────────
const RUN_SHOP_ITEMS = [
  { id: 'atk_boost', name: 'ATK Boost', desc: '+5 ATK for 60s', cost: 30, icon: '⚔', color: '#EF4444',
    buy: () => { addTempBuff('atk', 5, 60, 'ATK Boost'); } },
  { id: 'def_boost', name: 'DEF Boost', desc: '+3 DEF for 60s', cost: 25, icon: '🛡', color: '#3B82F6',
    buy: () => { addTempBuff('def', 3, 60, 'DEF Boost'); } },
  { id: 'speed_boost', name: 'Speed Boost', desc: '+30% speed for 45s', cost: 20, icon: '⚡', color: '#22D3EE',
    buy: () => { addTempBuff('speed', 0.3, 45, 'Speed Boost'); } },
  { id: 'crit_boost', name: 'Crit Boost', desc: '+15% crit for 60s', cost: 35, icon: '💥', color: '#F8B800',
    buy: () => { addTempBuff('crit', 0.15, 60, 'Crit Boost'); } },
  { id: 'heal_full', name: 'Full Heal', desc: 'Restore all HP', cost: 50, icon: '♥', color: '#34D399',
    buy: () => { state.player.hp = state.player.maxHp; } },
  { id: 'max_hp_up', name: 'Max HP +20', desc: 'Permanent +20 Max HP', cost: 80, icon: '♥+', color: '#22C55E',
    buy: () => { state.player.maxHp += 20; state.player.hp += 20; } },
  { id: 'bomb', name: 'Bomb', desc: 'AoE damage to all nearby', cost: 40, icon: '●', color: '#EF4444',
    buy: () => { addToInventory('bomb'); } },
  { id: 'mega_potion', name: 'Mega Potion', desc: 'Restore 80 HP item', cost: 30, icon: '♥', color: '#22C55E',
    buy: () => { addToInventory('mega_potion'); } },
];

function openRunShop() {
  const goldEl = document.getElementById('run-shop-gold');
  const gridEl = document.getElementById('run-shop-items');
  if (!goldEl || !gridEl) return;
  goldEl.textContent = state.player.gold;
  gridEl.innerHTML = '';
  RUN_SHOP_ITEMS.forEach(item => {
    const canAfford = state.player.gold >= item.cost;
    const el = document.createElement('div');
    el.className = `vault-item ${canAfford ? '' : 'cant-afford'}`;
    el.innerHTML = `
      <div class="vault-item-name">${item.icon} ${item.name}</div>
      <div class="vault-item-desc">${item.desc}</div>
      <div class="vault-item-cost ${canAfford ? '' : 'too-expensive'}">${item.cost}G</div>
    `;
    if (canAfford) {
      el.onclick = () => {
        state.player.gold -= item.cost;
        item.buy();
        SFX.chest();
        state.log.push(`Bought: ${item.name}`);
        showToast(`Bought ${item.name}!`, 'success', 1500, item.icon);
        openRunShop(); // refresh
      };
    }
    gridEl.appendChild(el);
  });
  document.getElementById('shop-overlay').classList.add('show');
}

function closeRunShop() {
  document.getElementById('shop-overlay').classList.remove('show');
}

// Spawn merchant on random floors
function checkMerchantSpawn() {
  // 15% chance per floor after floor 2
  if (state.depth >= 2 && Math.random() < 0.15) {
    state.log.push('🏪 A Wandering Merchant appears!');
    showToast('Merchant nearby! Press K to shop', 'info', 3000, '🏪');
    return true;
  }
  return false;
}

// ─── FLOOR MODIFIERS ──────────────────────────────────────────
const FLOOR_MODIFIERS = [
  { id: 'glass_cannon', name: 'Glass Cannon', desc: '2x ATK, -30% Max HP', icon: '⚔', color: '#EF4444',
    apply: (p) => { p.atk *= 2; p.maxHp = Math.floor(p.maxHp * 0.7); p.hp = Math.min(p.hp, p.maxHp); } },
  { id: 'gold_rush', name: 'Gold Rush', desc: '2x Gold drops', icon: '💰', color: '#F8B800',
    apply: () => {} }, // handled in gold calculation
  { id: 'monster_surge', name: 'Monster Surge', desc: '2x Enemies, +100% XP', icon: '☠', color: '#E83838',
    apply: () => {} }, // handled in spawn count
  { id: 'no_heal', name: 'Cursed Floor', desc: 'Healing items disabled', icon: '💀', color: '#6B21A8',
    apply: () => {} }, // handled in triggerHeal
  { id: 'speed_demon', name: 'Speed Demon', desc: '+50% speed, +20% ATK', icon: '⚡', color: '#22D3EE',
    apply: (p) => { p.speedMult += 0.5; p.atk = Math.floor(p.atk * 1.2); } },
  { id: 'tank', name: 'Iron Wall', desc: '+3 DEF, -20% speed', icon: '🛡', color: '#3B82F6',
    apply: (p) => { p.def += 3; p.speedMult = Math.max(0.5, p.speedMult - 0.2); } },
  { id: 'greed', name: 'Greed Floor', desc: '2x chest gold, +50% enemies', icon: '💎', color: '#FBBF24',
    apply: () => {} }, // handled in spawn + gold
  { id: 'glass', name: 'Fragile', desc: '-40% Max HP, +40% ATK', icon: '💔', color: '#E87898',
    apply: (p) => { p.maxHp = Math.floor(p.maxHp * 0.6); p.hp = Math.min(p.hp, p.maxHp); p.atk = Math.floor(p.atk * 1.4); } },
];

function rollFloorModifier() {
  return FLOOR_MODIFIERS[Math.floor(Math.random() * FLOOR_MODIFIERS.length)];
}

function applyFloorModifier(modifier) {
  if (!modifier) return;
  modifier.apply(state.player);
}

function getFloorGoldMultiplier() {
  if (!state.floorModifier) return 1;
  if (state.floorModifier.id === 'gold_rush' || state.floorModifier.id === 'greed') return 2;
  return 1;
}

function getFloorXpMultiplier() {
  if (!state.floorModifier) return 1;
  if (state.floorModifier.id === 'monster_surge') return 2;
  return 1;
}

function getFloorEnemyMultiplier() {
  if (!state.floorModifier) return 1;
  if (state.floorModifier.id === 'monster_surge' || state.floorModifier.id === 'greed') return 2;
  return 1;
}

function isFloorHealDisabled() {
  return state.floorModifier && state.floorModifier.id === 'no_heal';
}

// ─── SYNERGY SYSTEM ────────────────────────────────────────────
const SYNERGIES = [
  { id: 'inferno', name: 'Inferno', requires: ['fire_staff', 'bomb'], desc: 'Bombs leave fire trails',
    apply: (scene) => { state.player._inferno = true; } },
  { id: 'frost_sprint', name: 'Frost Sprint', requires: ['ice_bow', 'speed_boots'], desc: 'Leave ice trail that slows',
    apply: (scene) => { state.player._frostSprint = true; } },
  { id: 'shadow_step', name: 'Shadow Step', requires: ['shadow_dagger', 'compass'], desc: 'Teleport to exit (SHIFT+E)',
    apply: (scene) => { state.player._shadowStep = true; } },
  { id: 'holy_guardian', name: 'Holy Guardian', requires: ['holy_lance', 'shield_item'], desc: 'Shield regenerates 1 block per kill',
    apply: (scene) => { state.player._holyGuardian = true; } },
];

function checkSynergies() {
  if (!state.player) return;
  const weaponId = state.player.weapon?.id;
  const hasItem = (id) => (state.player.inventory || []).some(inv => inv?.id === id);
  SYNERGIES.forEach(s => {
    const hasWeapon = weaponId === s.requires[0] || weaponId === s.requires[1];
    const hasOther = hasItem(s.requires[0]) || hasItem(s.requires[1]);
    if (hasWeapon && hasOther && !state.player['_' + s.id]) {
      s.apply(this);
      state.synergies.push(s.id);
      state.log.push(`⚡ SYNERGY: ${s.name}! ${s.desc}`);
      showToast(`${s.name} Synergy!`, 'legendary', 3000, '⚡');
      SFX.levelup();
    }
  });
}

// ─── TEMP BUFFS (from mid-run shop) ────────────────────────────
function addTempBuff(type, value, duration, name) {
  state.tempBuffs.push({ type, value, remaining: duration, name });
  switch(type) {
    case 'atk': state.player.atk += value; break;
    case 'def': state.player.def += value; break;
    case 'speed': state.player.speedMult += value; break;
    case 'crit': state.player._critBonus = (state.player._critBonus || 0) + value; break;
  }
}

function updateTempBuffs(dt) {
  if (!state.tempBuffs || !state.player) return;
  for (let i = state.tempBuffs.length - 1; i >= 0; i--) {
    const buff = state.tempBuffs[i];
    buff.remaining -= dt;
    if (buff.remaining <= 0) {
      switch(buff.type) {
        case 'atk': state.player.atk -= buff.value; break;
        case 'def': state.player.def -= buff.value; break;
        case 'speed': state.player.speedMult -= buff.value; break;
        case 'crit': state.player._critBonus = Math.max(0, (state.player._critBonus || 0) - buff.value); break;
      }
      state.log.push(`Buff expired: ${buff.name}`);
      state.tempBuffs.splice(i, 1);
    }
  }
}

// ─── BOSS RUSH MODE ────────────────────────────────────────────
const BOSS_RUSH_BOSSES = [
  { name: 'The Thread Wraith', color: 0xEF4444, hp: 200, speed: 35, damage: 22, size: 20 },
  { name: 'Hydra of Forgotten Replies', color: 0xA855F7, hp: 350, speed: 40, damage: 28, size: 24 },
  { name: 'The Original Poster', color: 0xFBBF24, hp: 500, speed: 45, damage: 38, size: 28 },
];

function startBossRush() {
  state.bossRushMode = true;
  state.bossRushUnlocked = true;
  savePersistentData();
  startGame();
}

function getBossRushBoss(floorIndex) {
  const boss = BOSS_RUSH_BOSSES[Math.min(floorIndex, BOSS_RUSH_BOSSES.length - 1)];
  const scale = Math.pow(1.5, floorIndex);
  return {
    ...boss,
    hp: Math.floor(boss.hp * scale),
    damage: Math.floor(boss.damage * (1 + floorIndex * 0.2)),
    speed: boss.speed + floorIndex * 5,
  };
}
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'devvit_dungeon') {
    devvitDungeon = e.data.dungeon;
    state.log.push('Reddit thread loaded!');
  }
});

// Send ready signal to parent (Devvit)
if (window.parent !== window) {
  window.parent.postMessage({ type: 'game_ready' }, '*');
}

// ─── GAME STATE ──────────────────────────────────────────────
// commentCount can be set via URL: ?comments=50
const urlParams = new URLSearchParams(window.location.search);
const commentCountFromUrl = parseInt(urlParams.get('comments') || '0', 10);

let state = {
  phase: 'title',
  player: {
    hp: 100, maxHp: 100, atk: 14, def: 5, level: 1, xp: 0, xpNext: 60,
    gold: 0, title: 'Newbie', invincible: 0,
    inventory: [], maxInventory: 12, equipped: null,
    speedMult: 1, shield: 0,
    statusEffects: [],
    weapon: null, hasCompass: false, keys: 0,
  },
  dungeon: null,
  depth: 0,
  commentCount: commentCountFromUrl,
  totalFloors: 10 + Math.floor(commentCountFromUrl / 20),
  kills: 0,
  log: [],
  visited: new Set(),
  keys: 0,
  floorTheme: 0,
  transitionAlpha: 0,
  isTransitioning: false,
  floorEnemiesTotal: 0,
  floorEnemiesKilled: 0,
  riskTokens: 0,
  riskMultiplier: 1,
  floorModifier: null,
  synergies: [],
  tempBuffs: [],
  bossRushUnlocked: false,
  bossRushMode: false,
  // Floor pressure system
  floorTimer: 0,           // seconds remaining on current floor
  floorTimerMax: 0,        // max timer for this floor
  collapsing: false,       // floor is collapsing — damage over time
  exitLocked: true,        // exit locked until 70% enemies killed
  exitUnlockThreshold: 0.7,
  waveNumber: 0,           // current enemy wave number
  waveTimer: 0,            // time until next wave spawns
  waveInterval: 15,        // seconds between waves
  waveStrength: 1,         // multiplier for wave enemy stats
};

// Community multiplier: scales rewards based on comment engagement
// 0 comments = 1x, 20 = 1.2x, 40 = 1.4x, 100 = 2x, 200 = 3x
function getCommunityMultiplier() {
  return 1 + (state.commentCount / 20) * 0.2;
}

// Risk multiplier from refusing heals
function getRiskMultiplier() {
  return 1 + state.riskTokens * 0.15; // +15% per risk token, max ~3.5x at 16 tokens
}

// ─── POKEMON GAMEBOY THEMES ─────────────────────────────────
// Bright, colorful palettes inspired by Pokemon RBY/GSC
const THEMES = [
  {
    name: 'Viridian Dungeon',
    wallColor: 0x1A3A1A, wallTop: 0x2A4A2A, wallHighlight: 0x3A5A3A,
    floorColor: 0x8A9870, floorAlt: 0x7A8860, floorAccent: 0x6A7850,
    waterColor: 0x2A5838, waterLight: 0x3A6848, waterDeep: 0x1A4828,
    accent: 0x34D399, ambient: 0.03,
    pathColor: 0x9A8870, pathAlt: 0x8A7860,
    grassColor: 0x2A5828, grassLight: 0x3A6838,
    fogColor: 0x0A1A0A, ambientSound: 'drip',
  },
  {
    name: 'Cerulean Catacombs',
    wallColor: 0x1A2A3B, wallTop: 0x2A3A4B, wallHighlight: 0x3A4A5B,
    floorColor: 0x708090, floorAlt: 0x607080, floorAccent: 0x506070,
    waterColor: 0x2A3A5A, waterLight: 0x3A4A6A, waterDeep: 0x1A2A4A,
    accent: 0x60A0F0, ambient: 0.02,
    pathColor: 0x808898, pathAlt: 0x707888,
    grassColor: 0x2A3838, grassLight: 0x3A4848,
    fogColor: 0x0A0A1A, ambientSound: 'wind',
  },
  {
    name: 'Goldenrod Crypt',
    wallColor: 0x3B2A1D, wallTop: 0x4B3A2D, wallHighlight: 0x5B4A3D,
    floorColor: 0xA89878, floorAlt: 0x988868, floorAccent: 0x887858,
    waterColor: 0x3A2A1A, waterLight: 0x4A3A2A, waterDeep: 0x2A1A0A,
    accent: 0xFBBF24, ambient: 0.025,
    pathColor: 0xA89870, pathAlt: 0x988860,
    grassColor: 0x3A4828, grassLight: 0x4A5838,
    fogColor: 0x0A0A05, ambientSound: 'creak',
  },
  {
    name: 'Cinnabar Depths',
    wallColor: 0x3B1A1A, wallTop: 0x4B2A2A, wallHighlight: 0x5B3A3A,
    floorColor: 0x987070, floorAlt: 0x886060, floorAccent: 0x785050,
    waterColor: 0x5A2020, waterLight: 0x6A3030, waterDeep: 0x4A1010,
    accent: 0xEF4444, ambient: 0.02,
    pathColor: 0x988078, pathAlt: 0x887068,
    grassColor: 0x3A2828, grassLight: 0x4A3838,
    fogColor: 0x0A0505, ambientSound: 'heartbeat',
  },
  {
    name: 'Lavender Mausoleum',
    wallColor: 0x2A1A3B, wallTop: 0x3A2A4B, wallHighlight: 0x4A3A5B,
    floorColor: 0x807098, floorAlt: 0x706088, floorAccent: 0x605078,
    waterColor: 0x3A2A5A, waterLight: 0x4A3A6A, waterDeep: 0x2A1A4A,
    accent: 0xA882F7, ambient: 0.015,
    pathColor: 0x888098, pathAlt: 0x787088,
    grassColor: 0x2A2838, grassLight: 0x3A3848,
    fogColor: 0x05050A, ambientSound: 'whisper',
  },
  {
    name: 'Seafoam Abyss',
    wallColor: 0x1A2A2B, wallTop: 0x2A3A3B, wallHighlight: 0x3A4A4B,
    floorColor: 0x708888, floorAlt: 0x607878, floorAccent: 0x506868,
    waterColor: 0x2A4A5A, waterLight: 0x3A5A6A, waterDeep: 0x1A3A4A,
    accent: 0x22D3EE, ambient: 0.02,
    pathColor: 0x809098, pathAlt: 0x708088,
    grassColor: 0x2A3A38, grassLight: 0x3A4A48,
    fogColor: 0x050A0A, ambientSound: 'drip',
  },
  {
    name: 'Victory Graveyard',
    wallColor: 0x1A1A15, wallTop: 0x2A2A25, wallHighlight: 0x3A3A35,
    floorColor: 0x888870, floorAlt: 0x787860, floorAccent: 0x686850,
    waterColor: 0x2A2A1A, waterLight: 0x3A3A2A, waterDeep: 0x1A1A0A,
    accent: 0xFBBF24, ambient: 0.01,
    pathColor: 0x888870, pathAlt: 0x787860,
    grassColor: 0x2A2A18, grassLight: 0x3A3A28,
    fogColor: 0x050505, ambientSound: 'heartbeat',
  },
];

// ═══════════════════════════════════════════════════════════
// DUNGEON GENERATOR — single clean implementation
// ═══════════════════════════════════════════════════════════

function generateDungeon(seed, depth) {
  const rng = mulberry32(seed);
  const perlin = new PerlinNoise(seed);
  const map = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(T.WALL));

  // ─── STEP 1: Cellular automata for base cave ───
  const cave = cellularAutomata(MAP_W, MAP_H, 0.40 + depth * 0.012, 6, rng);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const n = fbm(perlin, x * 0.07, y * 0.07, 3);
    if (cave[y][x] === 0 && n > -0.15) map[y][x] = T.FLOOR;
  }

  // ─── STEP 2: Room carving ───
  const rooms = [];
  const roomTypes = ['empty', 'grass', 'flowers', 'fence', 'path', 'water_feature'];
  const roomCount = 8 + Math.floor(rng() * 4) + depth * 2;

  for (let i = 0; i < roomCount; i++) {
    const rw = 5 + Math.floor(rng() * 8);
    const rh = 5 + Math.floor(rng() * 7);
    const rx = 2 + Math.floor(rng() * (MAP_W - rw - 4));
    const ry = 2 + Math.floor(rng() * (MAP_H - rh - 4));
    const roomType = roomTypes[Math.floor(rng() * roomTypes.length)];
    const cx = Math.floor(rx + rw / 2);
    const cy = Math.floor(ry + rh / 2);
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx, cy, type: roomType });

    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
      if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) map[y][x] = T.FLOOR;
    }

    // Paths along room edges (Pokemon-style)
    if (roomType === 'path') {
      for (let x = rx; x < rx + rw; x++) {
        if (ry + 1 >= 0 && ry + 1 < MAP_H && x >= 0 && x < MAP_W) map[ry + 1][x] = T.PATH;
        if (ry + rh - 2 >= 0 && ry + rh - 2 < MAP_H && x >= 0 && x < MAP_W) map[ry + rh - 2][x] = T.PATH;
      }
    }
  }

  // ─── STEP 3: Connect rooms with corridors ───
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let x = a.cx, y = a.cy;

    // Horizontal corridor
    while (x !== b.cx) {
      if (x > 1 && x < MAP_W - 2 && y > 1 && y < MAP_H - 2) {
        map[y][x] = T.PATH;
        // Widen corridor for Pokemon feel
        if (y > 0) map[y - 1][x] = T.PATH;
        if (y < MAP_H - 1) map[y + 1][x] = T.PATH;
      }
      x += x < b.cx ? 1 : -1;
    }
    // Vertical corridor
    while (y !== b.cy) {
      if (x > 1 && x < MAP_W - 2 && y > 1 && y < MAP_H - 2) {
        map[y][x] = T.PATH;
        if (x > 0) map[y][x - 1] = T.PATH;
        if (x < MAP_W - 1) map[y][x + 1] = T.PATH;
      }
      y += y < b.cy ? 1 : -1;
    }
  }

  // ─── STEP 4: Place features ───
  const spawn = rooms[0];
  const exit = rooms[rooms.length - 1];
  // Spawn and exit placed in STEP 8 (after all decorations)

  // ─── STEP 5: Room decoration ───
  rooms.forEach((room, idx) => {
    if (idx === 0) return;

    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      if (y < 0 || y >= MAP_H || x < 0 || x >= MAP_W) continue;
      if (map[y][x] !== T.FLOOR) continue;
      const r = rng();

      // Room type decoration
      if (room.type === 'grass' && r < 0.18) { map[y][x] = T.GRASS_TALL; continue; }
      if (room.type === 'flowers' && r < 0.12) { map[y][x] = T.FLOWER; continue; }
      if (room.type === 'fence' && (x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1)) {
        if (r < 0.6) { map[y][x] = T.FENCE; continue; }
      }
      if (room.type === 'water_feature' && r < 0.15) { map[y][x] = T.WATER; continue; }

      // General decoration + hazards (scaled by community engagement)
      const cm = getCommunityMultiplier();
      if (r < 0.025) { map[y][x] = T.TRAP; continue; }
      if (r < 0.035) { map[y][x] = T.SPIKES; continue; }
      if (r < 0.045) { map[y][x] = T.POISON; continue; }
      if (r < 0.075 * cm) { map[y][x] = T.HEAL; continue; }
      if (r < 0.095 * cm) { map[y][x] = T.POWER; continue; }
      if (r < 0.11) { map[y][x] = T.GRASS_TALL; continue; }
      if (r < 0.12) { map[y][x] = T.FLOWER; continue; }

      // Floor variation
      if (rng() < 0.08) map[y][x] = T.FLOOR_ALT;
    }

    // Save point in some rooms
    if (idx % 3 === 0 && room.w >= 5 && room.h >= 5) {
      map[room.cy][room.cx] = T.STAIRS;
    }

    // Treasure chests (scaled by community engagement)
    const cm = getCommunityMultiplier();
    if (idx > 0 && rng() < 0.3 * cm) {
      const cx = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
      const cy = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
      if (cx >= 0 && cx < MAP_W && cy >= 0 && cy < MAP_H && map[cy][cx] === T.FLOOR) {
        map[cy][cx] = T.CHEST;
      }
    }

    // Community-locked chests (need 20+ comments to unlock)
    if (state.commentCount >= 20 && idx > 2 && rng() < 0.15) {
      const cx = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
      const cy = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
      if (cx >= 0 && cx < MAP_W && cy >= 0 && cy < MAP_H && map[cy][cx] === T.FLOOR) {
        map[cy][cx] = T.LOCKED_CHEST;
      }
    }
  });

  // ─── STEP 6: Water pools (Perlin-based) ───
  for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
    if (map[y][x] !== T.FLOOR) continue;
    const w = fbm(perlin, x * 0.12, y * 0.12, 2);
    if (w > 0.35) map[y][x] = T.WATER;
  }

  // ─── STEP 7: Secret rooms (hidden treasure rooms) ───
  if (depth > 0 && rng() < 0.6) {
    const secretW = 4 + Math.floor(rng() * 3);
    const secretH = 4 + Math.floor(rng() * 3);
    // Find a spot near a wall
    for (let attempt = 0; attempt < 30; attempt++) {
      const sx = 3 + Math.floor(rng() * (MAP_W - secretW - 6));
      const sy = 3 + Math.floor(rng() * (MAP_H - secretH - 6));
      // Check if adjacent to wall
      let adjacentToWall = false;
      for (let dy = -1; dy <= secretH; dy++) for (let dx = -1; dx <= secretW; dx++) {
        const ny = sy + dy, nx = sx + dx;
        if (ny >= 0 && ny < MAP_H && nx >= 0 && nx < MAP_W && map[ny][nx] === T.WALL) adjacentToWall = true;
      }
      if (!adjacentToWall) continue;
      // Check if area is mostly wall (hidden)
      let wallCount = 0;
      for (let dy = 0; dy < secretH; dy++) for (let dx = 0; dx < secretW; dx++) {
        if (map[sy + dy][sx + dx] === T.WALL) wallCount++;
      }
      if (wallCount < secretW * secretH * 0.5) continue;
      // Carve secret room
      for (let dy = 0; dy < secretH; dy++) for (let dx = 0; dx < secretW; dx++) {
        map[sy + dy][sx + dx] = T.FLOOR_ALT;
      }
      // Place treasure (heals, power-ups, chest)
      const cx = Math.floor(sx + secretW / 2);
      const cy = Math.floor(sy + secretH / 2);
      map[cy][cx] = T.CHEST;
      if (secretW > 3) { map[cy - 1][cx] = T.HEAL; map[cy + 1][cx] = T.POWER; }
      // Hidden entrance — one wall tile becomes a path
      const entranceX = sx + Math.floor(rng() * secretW);
      const entranceY = sy - 1;
      if (entranceY >= 0 && map[entranceY][entranceX] === T.WALL) {
        map[entranceY][entranceX] = T.FLOOR;
      }
      break;
    }
  }

  // ─── STEP 7b: Community bonus rooms (every 20 comments = bonus room) ───
  const bonusRooms = Math.floor(state.commentCount / 20);
  for (let b = 0; b < bonusRooms; b++) {
    const bw = 5 + Math.floor(rng() * 3);
    const bh = 5 + Math.floor(rng() * 3);
    for (let attempt = 0; attempt < 30; attempt++) {
      const bx = 3 + Math.floor(rng() * (MAP_W - bw - 6));
      const by = 3 + Math.floor(rng() * (MAP_H - bh - 6));
      let wallCount = 0;
      for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) {
        if (map[by + dy][bx + dx] === T.WALL) wallCount++;
      }
      if (wallCount < bw * bh * 0.7) continue;
      // Carve bonus room
      for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) {
        map[by + dy][bx + dx] = T.BONUS;
      }
      // Fill with loot
      map[by + Math.floor(bh / 2)][bx + Math.floor(bw / 2)] = T.CHEST;
      map[by + 1][bx + 1] = T.HEAL;
      map[by + 1][bx + bw - 2] = T.POWER;
      map[by + bh - 2][bx + 1] = T.HEAL;
      map[by + bh - 2][bx + bw - 2] = T.POWER;
      // Hidden entrance
      const entranceX = bx + Math.floor(rng() * bw);
      const entranceY = by - 1;
      if (entranceY >= 0 && map[entranceY][entranceX] === T.WALL) {
        map[entranceY][entranceX] = T.FLOOR;
      }
      break;
    }
  }

  // ─── STEP 8: Place exit and spawn (AFTER all decorations/rooms) ───
  // Ensures nothing overwrites these critical tiles
  map[exit.cy][exit.cx] = T.EXIT;

  // Safety: if exit was overwritten by decoration/water, find nearby walkable tile
  if (map[exit.cy][exit.cx] !== T.EXIT) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const ny = exit.cy + dy, nx = exit.cx + dx;
      if (ny > 0 && ny < MAP_H - 1 && nx > 0 && nx < MAP_W - 1) {
        const t = map[ny][nx];
        if (t === T.FLOOR || t === T.FLOOR_ALT || t === T.PATH) {
          map[ny][nx] = T.EXIT;
          exit.cx = nx; exit.cy = ny;
          break;
        }
      }
    }
  }

  // Final guarantee: exit MUST be walkable
  if (map[exit.cy][exit.cx] !== T.EXIT) {
    const lastRoom = rooms[rooms.length - 1];
    for (let ry = lastRoom.y; ry < lastRoom.y + lastRoom.h; ry++) {
      for (let rx = lastRoom.x; rx < lastRoom.x + lastRoom.w; rx++) {
        if (ry > 0 && ry < MAP_H - 1 && rx > 0 && rx < MAP_W - 1) {
          const t = map[ry][rx];
          if (t === T.FLOOR || t === T.FLOOR_ALT || t === T.PATH) {
            map[ry][rx] = T.EXIT;
            exit.cx = rx; exit.cy = ry;
            break;
          }
        }
      }
      if (map[exit.cy][exit.cx] === T.EXIT) break;
    }
  }

  // Spawn safety — ensure spawn is walkable
  map[spawn.cy][spawn.cx] = T.SPAWN;
  if (map[spawn.cy][spawn.cx] !== T.SPAWN) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const ny = spawn.cy + dy, nx = spawn.cx + dx;
      if (ny > 0 && ny < MAP_H - 1 && nx > 0 && nx < MAP_W - 1) {
        const t = map[ny][nx];
        if (t === T.FLOOR || t === T.FLOOR_ALT || t === T.PATH) {
          map[ny][nx] = T.SPAWN;
          spawn.cx = nx; spawn.cy = ny;
          break;
        }
      }
    }
  }

  // ─── STEP 9: Border walls (ensure edges are solid) ───
  for (let x = 0; x < MAP_W; x++) { map[0][x] = T.WALL; map[MAP_H - 1][x] = T.WALL; }
  for (let y = 0; y < MAP_H; y++) { map[y][0] = T.WALL; map[y][MAP_W - 1] = T.WALL; }

  // Decorations for rendering
  const decorations = [];
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (map[y][x] === T.FLOOR && rng() < 0.02) {
      decorations.push({ x, y, type: Math.floor(rng() * 4) });
    }
  }

  return {
    map, spawn: { x: spawn.cx, y: spawn.cy }, exit: { x: exit.cx, y: exit.cy },
    rooms, decorations, seed, depth,
  };
}

// ═══════════════════════════════════════════════════════════
// POKEMON-STYLE TILE RENDERER
// ═══════════════════════════════════════════════════════════

function drawTile(g, tileType, px, py, theme, x, y, time) {
  const T16 = TILE; // 16px

  switch (tileType) {
    case T.WALL: {
      // Pokemon-style wall: blocky with top highlight
      g.fillStyle(theme.wallColor, 1);
      g.fillRect(px, py, T16, T16);
      // Top face (lighter)
      g.fillStyle(theme.wallTop, 1);
      g.fillRect(px, py, T16, 6);
      // Top edge highlight
      g.fillStyle(theme.wallHighlight, 1);
      g.fillRect(px, py, T16, 2);
      // Left edge highlight
      g.fillRect(px, py, 2, T16);
      // Bottom-right shadow
      g.fillStyle(0x000000, 0.15);
      g.fillRect(px + T16 - 1, py, 1, T16);
      g.fillRect(px, py + T16 - 1, T16, 1);
      // Brick pattern (subtle)
      if ((x + y) % 2 === 0) {
        g.fillStyle(0x000000, 0.04);
        g.fillRect(px, py + 7, T16, 1);
      }
      if (x % 2 === 0) {
        g.fillStyle(0x000000, 0.03);
        g.fillRect(px + 7, py, 1, T16);
      }
      break;
    }
    case T.FLOOR:
    case T.FLOOR_ALT: {
      const base = tileType === T.FLOOR_ALT ? theme.floorAlt : theme.floorColor;
      g.fillStyle(base, 1);
      g.fillRect(px, py, T16, T16);
      // Checkerboard pattern
      if ((x + y) % 2 === 0) {
        g.fillStyle(theme.floorAccent, 0.3);
        g.fillRect(px, py, T16, T16);
      }
      // Subtle grid lines
      g.fillStyle(0x000000, 0.04);
      g.fillRect(px + T16 - 1, py, 1, T16);
      g.fillRect(px, py + T16 - 1, T16, 1);
      // Horror: blood stains (hash-based, deterministic)
      const hash = (x * 7 + y * 13 + x * y * 3) % 100;
      if (hash < 3) {
        g.fillStyle(0x8B0000, 0.2 + (hash * 0.01));
        g.fillRect(px + 3, py + 4, 5, 4);
        g.fillRect(px + 6, py + 7, 3, 3);
        g.fillRect(px + 8, py + 5, 2, 2);
      }
      // Horror: cracks
      if (hash > 85 && hash < 92) {
        g.fillStyle(0x000000, 0.2);
        g.fillRect(px + 4, py + 2, 1, 6);
        g.fillRect(px + 5, py + 7, 3, 1);
        g.fillRect(px + 8, py + 4, 1, 4);
      }
      // Horror: cobwebs in corners
      if (hash > 92 && hash < 96) {
        g.fillStyle(0xCCCCCC, 0.08);
        g.fillRect(px, py, 6, 1);
        g.fillRect(px, py, 1, 6);
        g.fillRect(px + 1, py + 1, 4, 1);
        g.fillRect(px + 1, py + 1, 1, 4);
        g.fillRect(px + 2, py + 2, 2, 1);
        g.fillRect(px + 2, py + 2, 1, 2);
      }
      break;
    }
    case T.PATH: {
      g.fillStyle(theme.pathColor, 1);
      g.fillRect(px, py, T16, T16);
      // Path texture — small dots
      if ((x * 3 + y * 7) % 5 === 0) {
        g.fillStyle(theme.pathAlt, 0.5);
        g.fillRect(px + 4, py + 4, 2, 2);
      }
      if ((x * 7 + y * 3) % 7 === 0) {
        g.fillStyle(theme.pathAlt, 0.4);
        g.fillRect(px + 10, py + 8, 2, 2);
      }
      // Edge darkening
      g.fillStyle(0x000000, 0.04);
      g.fillRect(px + T16 - 1, py, 1, T16);
      g.fillRect(px, py + T16 - 1, T16, 1);
      break;
    }
    case T.WATER: {
      // Pokemon water: bright blue with wave pattern
      g.fillStyle(theme.waterColor, 1);
      g.fillRect(px, py, T16, T16);
      // Wave lines
      const waveOff = Math.sin(time * 0.003 + x * 0.8) * 2;
      g.fillStyle(theme.waterLight, 0.5);
      g.fillRect(px + 2, py + 4 + waveOff, 5, 2);
      g.fillRect(px + 9, py + 10 + waveOff, 5, 2);
      // Sparkle
      if ((x + y) % 4 === 0) {
        const sparkle = 0.3 + Math.sin(time * 0.005 + x + y) * 0.2;
        g.fillStyle(0xFFFFFF, sparkle);
        g.fillRect(px + 6, py + 6, 2, 2);
      }
      // Dark edge
      g.fillStyle(theme.waterDeep, 0.3);
      g.fillRect(px, py + T16 - 2, T16, 2);
      g.fillRect(px + T16 - 2, py, 2, T16);
      break;
    }
    case T.GRASS_TALL: {
      // Floor first
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      if ((x + y) % 2 === 0) {
        g.fillStyle(theme.floorAccent, 0.3);
        g.fillRect(px, py, T16, T16);
      }
      // Tall grass tufts (Pokemon-style)
      g.fillStyle(theme.grassColor, 0.9);
      g.fillRect(px + 2, py + 4, 3, 6);
      g.fillRect(px + 6, py + 2, 3, 8);
      g.fillRect(px + 10, py + 5, 3, 5);
      g.fillRect(px + 4, py + 8, 2, 4);
      g.fillRect(px + 12, py + 3, 2, 5);
      // Light tips
      g.fillStyle(theme.grassLight, 0.7);
      g.fillRect(px + 2, py + 2, 3, 3);
      g.fillRect(px + 6, py + 1, 3, 3);
      g.fillRect(px + 10, py + 3, 3, 3);
      break;
    }
    case T.FLOWER: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Flowers (Pokemon overworld style)
      const flowerColors = [0xFF6B6B, 0xFFD93D, 0xFF8FD8, 0x6BCB77, 0x4D96FF];
      const fc = flowerColors[(x * 3 + y * 7) % flowerColors.length];
      // Stem
      g.fillStyle(0x2D8A2D, 0.7);
      g.fillRect(px + 6, py + 8, 2, 6);
      // Petals
      g.fillStyle(fc, 0.8);
      g.fillRect(px + 4, py + 4, 3, 3);
      g.fillRect(px + 8, py + 4, 3, 3);
      g.fillRect(px + 4, py + 8, 3, 3);
      g.fillRect(px + 8, py + 8, 3, 3);
      // Center
      g.fillStyle(0xFFD93D, 0.9);
      g.fillRect(px + 6, py + 6, 3, 3);
      break;
    }
    case T.FENCE: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Pokemon-style wooden fence
      g.fillStyle(0x8B6914, 0.9);
      g.fillRect(px + 1, py + 3, 14, 4);
      g.fillRect(px + 1, py + 9, 14, 4);
      // Posts
      g.fillStyle(0x6B4904, 0.9);
      g.fillRect(px + 1, py + 1, 3, 13);
      g.fillRect(px + 12, py + 1, 3, 13);
      // Highlight
      g.fillStyle(0xAB8934, 0.5);
      g.fillRect(px + 2, py + 3, 1, 4);
      g.fillRect(px + 13, py + 3, 1, 4);
      break;
    }
    case T.TREE: {
      // Tree trunk + canopy (Pokemon overworld)
      g.fillStyle(theme.wallColor, 1);
      g.fillRect(px, py, T16, T16);
      // Canopy (dark green circle-ish)
      g.fillStyle(0x1A6B1A, 0.95);
      g.fillRect(px + 1, py + 1, 14, 10);
      g.fillRect(px + 3, py + 11, 10, 3);
      // Canopy highlight
      g.fillStyle(0x2D8A2D, 0.6);
      g.fillRect(px + 3, py + 2, 6, 4);
      // Trunk
      g.fillStyle(0x6B4400, 0.9);
      g.fillRect(px + 6, py + 11, 4, 5);
      // Trunk detail
      g.fillStyle(0x5A3300, 0.5);
      g.fillRect(px + 7, py + 12, 1, 3);
      break;
    }
    case T.SPAWN: {
      g.fillStyle(theme.pathColor, 1);
      g.fillRect(px, py, T16, T16);
      // Spawn marker — Pokemon heal point style
      const pulse = 0.4 + Math.sin(time * 0.004) * 0.2;
      g.fillStyle(0x3B82F6, pulse * 0.3);
      g.fillRect(px + 2, py + 2, 12, 12);
      g.fillStyle(0x3B82F6, pulse);
      g.fillRect(px + 5, py + 5, 6, 6);
      // Cross pattern
      g.fillStyle(0xFFFFFF, pulse * 0.6);
      g.fillRect(px + 7, py + 4, 2, 8);
      g.fillRect(px + 4, py + 7, 8, 2);
      break;
    }
    case T.EXIT: {
      g.fillStyle(theme.pathColor, 1);
      g.fillRect(px, py, T16, T16);
      // Stairs down (Pokemon dungeon exit style)
      g.fillStyle(0x000000, 0.4);
      g.fillRect(px + 2, py + 2, 12, 12);
      // Steps
      g.fillStyle(0x333333, 0.8);
      g.fillRect(px + 3, py + 3, 10, 3);
      g.fillRect(px + 4, py + 6, 8, 3);
      g.fillRect(px + 5, py + 9, 6, 3);
      g.fillRect(px + 6, py + 12, 4, 2);
      // Highlight on top step
      g.fillStyle(0x555555, 0.6);
      g.fillRect(px + 3, py + 3, 10, 1);
      // Pulsing glow - big and visible
      const glow = 0.3 + Math.sin(time * 0.003) * 0.2;
      g.fillStyle(theme.accent || 0x34D399, glow);
      g.fillRect(px - 4, py - 4, 24, 24);
      g.fillStyle(0x34D399, glow * 0.5);
      g.fillRect(px - 8, py - 8, 32, 32);
      break;
    }
    case T.TRAP: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      if ((x + y) % 2 === 0) { g.fillStyle(theme.floorAccent, 0.3); g.fillRect(px, py, T16, T16); }
      // Pokemon-style trap — cracked floor with red tint
      g.fillStyle(0xEF4444, 0.15);
      g.fillRect(px, py, T16, T16);
      // Crack pattern
      g.fillStyle(0x000000, 0.25);
      g.fillRect(px + 4, py + 3, 1, 4);
      g.fillRect(px + 5, py + 7, 2, 1);
      g.fillRect(px + 7, py + 5, 1, 3);
      g.fillRect(px + 9, py + 8, 3, 1);
      g.fillRect(px + 10, py + 6, 1, 3);
      // Warning pixels
      g.fillStyle(0xEF4444, 0.3);
      g.fillRect(px + 6, py + 4, 2, 2);
      g.fillRect(px + 10, py + 10, 2, 2);
      break;
    }
    case T.HEAL: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Pokemon heal tile — green cross
      g.fillStyle(0x34D399, 0.15);
      g.fillRect(px, py, T16, T16);
      // Cross
      g.fillStyle(0x34D399, 0.7);
      g.fillRect(px + 6, py + 3, 4, 10);
      g.fillRect(px + 3, py + 6, 10, 4);
      // Highlight
      g.fillStyle(0x6EE7B7, 0.5);
      g.fillRect(px + 6, py + 3, 4, 2);
      g.fillRect(px + 3, py + 6, 2, 4);
      // Glow
      const healGlow = 0.08 + Math.sin(time * 0.004 + x + y) * 0.05;
      g.fillStyle(0x34D399, healGlow);
      g.fillRect(px + 1, py + 1, 14, 14);
      break;
    }
    case T.POWER: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Pokemon power-up — star
      g.fillStyle(0xFBBF24, 0.15);
      g.fillRect(px, py, T16, T16);
      // Star shape
      g.fillStyle(0xFBBF24, 0.8);
      g.fillRect(px + 6, py + 2, 4, 3);
      g.fillRect(px + 3, py + 5, 10, 3);
      g.fillRect(px + 5, py + 8, 6, 3);
      g.fillRect(px + 6, py + 11, 4, 3);
      // Tips
      g.fillRect(px + 2, py + 6, 2, 2);
      g.fillRect(px + 12, py + 6, 2, 2);
      // Center highlight
      g.fillStyle(0xFDE68A, 0.7);
      g.fillRect(px + 6, py + 5, 4, 4);
      break;
    }
    case T.STAIRS: {
      g.fillStyle(theme.pathColor, 1);
      g.fillRect(px, py, T16, T16);
      // Save point — Pokemon PC/heal machine style
      const sp = 0.5 + Math.sin(time * 0.004) * 0.2;
      g.fillStyle(0x22D3EE, sp * 0.3);
      g.fillRect(px + 2, py + 2, 12, 12);
      // Machine body
      g.fillStyle(0x334155, 0.8);
      g.fillRect(px + 4, py + 3, 8, 10);
      // Screen
      g.fillStyle(0x22D3EE, sp);
      g.fillRect(px + 5, py + 4, 6, 5);
      // Screen highlight
      g.fillStyle(0x67E8F9, sp * 0.5);
      g.fillRect(px + 5, py + 4, 6, 2);
      // Base
      g.fillStyle(0x1E293B, 0.8);
      g.fillRect(px + 3, py + 12, 10, 2);
      break;
    }
    case T.CHEST: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Pokemon treasure chest
      g.fillStyle(0x8B6914, 0.9);
      g.fillRect(px + 3, py + 6, 10, 7);
      // Lid
      g.fillStyle(0xA07818, 0.95);
      g.fillRect(px + 3, py + 4, 10, 4);
      // Lid highlight
      g.fillStyle(0xC09828, 0.6);
      g.fillRect(px + 3, py + 4, 10, 2);
      // Lock
      g.fillStyle(0xFBBF24, 0.8);
      g.fillRect(px + 7, py + 7, 2, 3);
      // Metal bands
      g.fillStyle(0x555555, 0.4);
      g.fillRect(px + 3, py + 9, 10, 1);
      break;
    }
    case T.LAVA: {
      g.fillStyle(0xCC2200, 1);
      g.fillRect(px, py, T16, T16);
      const lavaWave = Math.sin(time * 0.004 + x * 1.2 + y * 0.8) * 0.15;
      g.fillStyle(0xFF6600, 0.5 + lavaWave);
      g.fillRect(px + 2, py + 2, 12, 12);
      g.fillStyle(0xFFAA00, 0.4 + lavaWave);
      g.fillRect(px + 4, py + 4, 4, 4);
      g.fillRect(px + 9, py + 8, 3, 3);
      break;
    }
    case T.POISON: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Poison pool — bubbling green
      const poisonWave = Math.sin(time * 0.003 + x * 2 + y * 1.5) * 0.15;
      g.fillStyle(0x1A4A1A, 0.6);
      g.fillRect(px + 2, py + 2, 12, 12);
      g.fillStyle(0x34D399, 0.3 + poisonWave);
      g.fillRect(px + 3, py + 3, 10, 10);
      // Bubbles
      const bubblePhase = (time * 0.005 + x * 7 + y * 13) % 3;
      if (bubblePhase < 1) {
        g.fillStyle(0x4ADE80, 0.5);
        g.fillRect(px + 5, py + 4 + bubblePhase * 3, 2, 2);
      }
      if (bubblePhase > 1.5 && bubblePhase < 2.5) {
        g.fillStyle(0x4ADE80, 0.4);
        g.fillRect(px + 9, py + 6 + (bubblePhase - 1.5) * 3, 2, 2);
      }
      // Skull warning
      g.fillStyle(0xFFFFFF, 0.15);
      g.fillRect(px + 6, py + 5, 4, 3);
      g.fillRect(px + 7, py + 4, 2, 1);
      break;
    }
    case T.SPIKES: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Spike trap — retractable metal spikes
      const spikePhase = Math.sin(time * 0.004 + x + y) > 0.3 ? 1 : 0;
      if (spikePhase) {
        // Spikes extended
        g.fillStyle(0x888888, 0.8);
        g.fillRect(px + 3, py + 2, 2, 6);
        g.fillRect(px + 7, py + 3, 2, 5);
        g.fillRect(px + 11, py + 2, 2, 6);
        g.fillRect(px + 5, py + 7, 2, 5);
        g.fillRect(px + 9, py + 8, 2, 4);
        // Spike tips
        g.fillStyle(0xCCCCCC, 0.9);
        g.fillRect(px + 3, py + 1, 2, 2);
        g.fillRect(px + 7, py + 2, 2, 2);
        g.fillRect(px + 11, py + 1, 2, 2);
        // Blood on tips
        g.fillStyle(0xEF4444, 0.4);
        g.fillRect(px + 3, py + 3, 2, 1);
        g.fillRect(px + 11, py + 3, 2, 1);
      } else {
        // Spikes retracted — warning pattern
        g.fillStyle(0x555555, 0.3);
        g.fillRect(px + 3, py + 6, 2, 3);
        g.fillRect(px + 7, py + 7, 2, 2);
        g.fillRect(px + 11, py + 6, 2, 3);
      }
      // Warning glow
      g.fillStyle(0xEF4444, 0.1 + Math.sin(time * 0.006) * 0.05);
      g.fillRect(px, py, T16, T16);
      break;
    }
    case T.ICE: {
      g.fillStyle(0xC8E8FF, 1);
      g.fillRect(px, py, T16, T16);
      // Ice shine
      g.fillStyle(0xFFFFFF, 0.3);
      g.fillRect(px + 2, py + 2, 4, 2);
      g.fillRect(px + 8, py + 6, 3, 2);
      // Crack
      g.fillStyle(0x88BBDD, 0.4);
      g.fillRect(px + 6, py + 4, 1, 6);
      g.fillRect(px + 7, py + 8, 3, 1);
      break;
    }
    case T.SAND: {
      g.fillStyle(0xE8D8A0, 1);
      g.fillRect(px, py, T16, T16);
      // Sand dots
      g.fillStyle(0xD8C890, 0.5);
      if ((x + y) % 3 === 0) g.fillRect(px + 4, py + 4, 2, 2);
      if ((x * 2 + y) % 5 === 0) g.fillRect(px + 10, py + 8, 2, 2);
      break;
    }
    case T.BRIDGE: {
      // Water underneath
      g.fillStyle(theme.waterColor, 0.6);
      g.fillRect(px, py, T16, T16);
      // Bridge planks
      g.fillStyle(0x8B6914, 0.9);
      g.fillRect(px + 1, py + 2, 14, 12);
      // Plank lines
      g.fillStyle(0x6B4904, 0.4);
      g.fillRect(px + 1, py + 5, 14, 1);
      g.fillRect(px + 1, py + 9, 14, 1);
      // Railings
      g.fillStyle(0x6B4904, 0.7);
      g.fillRect(px + 1, py + 1, 14, 2);
      g.fillRect(px + 1, py + 13, 14, 2);
      break;
    }
    case T.LOCKED_CHEST: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
      // Locked chest — community requires 20+ comments to open
      g.fillStyle(0x8B4513, 0.9);
      g.fillRect(px + 2, py + 4, 12, 10);
      // Lock
      g.fillStyle(0xFFD700, 0.9);
      g.fillRect(px + 6, py + 6, 4, 4);
      g.fillStyle(0x000000, 0.8);
      g.fillRect(px + 7, py + 8, 2, 2);
      // Lock glow
      const lockGlow = 0.15 + Math.sin(time * 0.003) * 0.1;
      g.fillStyle(0xFFD700, lockGlow);
      g.fillRect(px + 1, py + 3, 14, 12);
      // Community label
      if (state.commentCount < 20) {
        g.fillStyle(0xFF4444, 0.6);
        g.fillRect(px + 3, py + 2, 10, 2);
      }
      break;
    }
    case T.BONUS: {
      g.fillStyle(0x1a0a2e, 1);
      g.fillRect(px, py, T16, T16);
      // Bonus room — community reward room
      const bonusGlow = 0.1 + Math.sin(time * 0.005 + x * 0.5 + y * 0.5) * 0.08;
      g.fillStyle(0xA882F7, bonusGlow);
      g.fillRect(px, py, T16, T16);
      // Sparkle
      const sparkle = Math.sin(time * 0.007 + x * 3 + y * 7) > 0.7;
      if (sparkle) {
        g.fillStyle(0xFFFFFF, 0.6);
        g.fillRect(px + 7, py + 7, 2, 2);
      }
      break;
    }
    default: {
      g.fillStyle(theme.floorColor, 1);
      g.fillRect(px, py, T16, T16);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// PHASER SCENES
// ═══════════════════════════════════════════════════════════

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() { this.scene.start('Game'); }
}

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init() {
    this.player = null;
    this.walls = null;
    this.monsters = [];
    this.bullets = null;
    this.particles = null; // will be ParticlePool
    this.screenFX = null; // will be ScreenFX
    this.fogGraphics = null;
    this.minimapGraphics = null;
    this.compassGraphics = null;
    this.playerFacing = { x: 0, y: 1 };
    this.animTimer = 0;
    this.playerFrame = 0;
    this.screenShake = 0;
    this.transitioning = false;
    this.shieldGfx = null;
    this.interactionCooldown = 0;
    this.bulletOverlaps = [];
    this.stepTimer = 0;
    this.mapGraphics = null;
    this.exitHint = null;
    this.hitFreezeTimer = 0;
    this.dynamicGlowTiles = []; // torch/furnace positions
  }

  create() {
    const dungeon = generateDungeon(Date.now() + state.depth * 7919, state.depth);
    state.dungeon = dungeon;
    const theme = THEMES[state.floorTheme % THEMES.length];

    // Start music for this floor
    startMusic(state.floorTheme);

    // Hide boss health bar until boss spawns
    const bossBar = document.getElementById('boss-health-bar');
    if (bossBar) bossBar.style.display = 'none';

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    // ─── RENDER TILEMAP (Pokemon Gameboy style) ───
    this.mapGraphics = this.add.graphics();
    this.mapGraphics.setDepth(0);
    this.renderMap(dungeon, theme, 0);

    // ─── WALLS (physics) ───
    this.walls = this.physics.add.staticGroup();
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (SOLID_TILES.has(dungeon.map[y][x])) {
        const w = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0x000000, 0);
        this.physics.add.existing(w, true);
        this.walls.add(w);
      }
    }

    // ─── EXIT MARKER ───
    this.exitZone = null; // exit detection uses tile check now

    // ─── PLAYER (Pokemon-style top-down sprite) ───
    this.player = this.add.container(dungeon.spawn.x * TILE + TILE/2, dungeon.spawn.y * TILE + TILE/2);
    this.playerBody = this.add.graphics();
    this.drawCatPlayer(this.playerBody, 0, { x: 0, y: 1 });
    this.player.add(this.playerBody);
    // Hurt flash overlay (red rectangle, hidden by default)
    this.playerHurtOverlay = this.add.rectangle(0, 0, 16, 16, 0xFF0000, 0.5);
    this.playerHurtOverlay.setVisible(false);
    this.playerHurtOverlay.setDepth(1);
    this.player.add(this.playerHurtOverlay);
    this.player.setSize(12, 12);
    this.player.setDepth(10);
    this.physics.world.enable(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setOffset(-6, -6);
    this.physics.add.collider(this.player, this.walls);

    // ─── BULLETS ───
    this.bullets = this.physics.add.group();

    // ─── MONSTERS ───
    const cm = getCommunityMultiplier();
    const em = getFloorEnemyMultiplier();
    const monsterCount = Math.min(Math.floor((4 + state.depth * 1.5) * Math.sqrt(cm) * em), 20);
    for (let i = 0; i < monsterCount; i++) this.spawnMonster();

    // ─── PARTICLE POOL ───
    this.particles = new ParticlePool(this, 400);

    // ─── SCREEN EFFECTS ───
    this.screenFX = new ScreenFX(this);

    // ─── SPAWN BOSS (after screenFX is initialized) ───
    if (state.bossRushMode) {
      const rushBoss = getBossRushBoss(state.depth);
      this.spawnBoss(rushBoss);
    } else {
      const bossData = BOSSES.find(b => b.floor === state.depth);
      if (bossData) this.spawnBoss(bossData);
    }

    // ─── FOG OF WAR ───
    this.fogGraphics = this.add.graphics();
    this.fogGraphics.setDepth(20);

    // ─── ABILITY KEYS (1-4) ───
    this.input.keyboard.on('keydown-ONE', () => useAbility('fireball'));
    this.input.keyboard.on('keydown-TWO', () => useAbility('heal'));
    this.input.keyboard.on('keydown-THREE', () => useAbility('dash'));
    this.input.keyboard.on('keydown-FOUR', () => useAbility('shield'));
    initAbilities();

    // ─── DODGE KEY (SHIFT) ───
    this.shiftKey = this.input.keyboard.addKey('SHIFT');

    // ─── DYNAMIC GLOW TILES (torches, furnaces) ───
    this.dynamicGlowTiles = [];
    dungeon.rooms.forEach((room, idx) => {
      if (idx % 2 === 0 && room.w >= 4 && room.h >= 4) {
        // Place torches at room corners
        const corners = [
          { x: room.x + 1, y: room.y + 1 },
          { x: room.x + room.w - 2, y: room.y + 1 },
        ];
        corners.forEach(c => {
          if (c.x >= 0 && c.x < MAP_W && c.y >= 0 && c.y < MAP_H && dungeon.map[c.y][c.x] === T.FLOOR) {
            this.dynamicGlowTiles.push({ x: c.x, y: c.y, type: 'torch', intensity: 0.5 + Math.random() * 0.3 });
          }
        });
      }
    });

    // ─── LOADING COMPLETE TOAST ───
    showToast(`Floor ${state.depth + 1}: ${theme.name}`, 'info', 2500, '⚔');

    // ─── MINIMAP ───
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setDepth(25);

    // ─── CAMERA ───
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    const fogColor = theme.fogColor || 0x000000;
    this.cameras.main.setBackgroundColor(fogColor);

    // Force canvas to fill container
    this.scale.on('resize', (gameSize) => {
      const canvas = this.game.canvas;
      if (canvas) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }
    });
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
    }

    // ─── CONTROLS ───
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey('SPACE');
    this.eKey = this.input.keyboard.addKey('E');
    this.iKey = this.input.keyboard.addKey('I');
    this.pKey = this.input.keyboard.addKey('P');
    this.mKey = this.input.keyboard.addKey('M');
    this.kKey = this.input.keyboard.addKey('K');

    this.pKey.on('down', () => {
      gamePaused = !gamePaused;
      if (gamePaused) {
        this.physics.pause();
        this.addLog('PAUSED — Press P to resume');
      } else {
        this.physics.resume();
        this.addLog('Resumed');
      }
    });

    this.mKey.on('down', () => {
      minimapVisible = !minimapVisible;
      this.addLog(minimapVisible ? 'Minimap: ON' : 'Minimap: OFF');
    });

    this.iKey.on('down', () => {
      const panel = document.getElementById('inventory-panel');
      if (panel) {
        panel.classList.toggle('show');
        document.getElementById('inv-count').textContent = state.player.inventory.length;
        updateInventoryUI();
      }
    });

    this.kKey.on('down', () => {
      const shopEl = document.getElementById('shop-overlay');
      if (shopEl && shopEl.classList.contains('show')) {
        closeRunShop();
      } else {
        openRunShop();
      }
    });

    // ─── UI ───
    this.updateUI();
    this.addLog(`Floor ${state.depth + 1}: ${theme.name}`);
    this.addLog(`${dungeon.rooms.length} rooms found`);

    // Floor name splash — appears briefly on screen
    const splashTitle = this.add.text(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2 - 20,
      `FLOOR ${state.depth + 1}`,
      { fontFamily: 'Press Start 2P', fontSize: '14px', color: '#E87898', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5).setDepth(30).setAlpha(0);
    const modifierText = state.floorModifier ? ` ${state.floorModifier.icon} ${state.floorModifier.name}` : '';
    const splashSub = this.add.text(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2 + 2,
      `${theme.name}${modifierText}`,
      { fontFamily: 'VT323', fontSize: '16px', color: state.floorModifier ? state.floorModifier.color : '#C8C8A8', stroke: '#000', strokeThickness: 2 }
    ).setOrigin(0.5).setDepth(30).setAlpha(0);

    // Fade in, hold, fade out
    this.tweens.add({ targets: [splashTitle, splashSub], alpha: 1, duration: 400, yoyo: true, hold: 1200, delay: 200,
      onComplete: () => { splashTitle.destroy(); splashSub.destroy(); }
    });
    document.getElementById('controls-hint').classList.add('show');
  }

  // ─── CHARACTER SPRITE ───
  drawCatPlayer(g, frame, facing) {
    g.clear();
    const ps = 1;
    const char = getCharacterData();

    // If character has pixel art, draw it centered
    if (char.pixelArt && char.palette) {
      const scale = 2;
      const rows = char.pixelArt.length;
      const cols = char.pixelArt[0].length;
      const offsetX = -(cols * scale) / 2;
      const offsetY = -(rows * scale) / 2;
      char.pixelArt.forEach((row, y) => {
        row.forEach((pixel, x) => {
          if (pixel === 0) return;
          g.fillStyle(char.palette[pixel] || 0x000000, 1);
          g.fillRect(x * scale + offsetX, y * scale + offsetY, scale, scale);
        });
      });
      return;
    }

    // Frame offsets for walk animation
    const walkCycle = frame % 4;
    const legOffset = walkCycle < 2 ? 0 : 1;
    const bobY = walkCycle === 1 || walkCycle === 3 ? -1 : 0;

    // ─── HAIR (long, flowing green) ───
    g.fillStyle(hair, 1);
    // Hair back (long, flows down)
    g.fillRect(3 * ps, (0 + bobY) * ps, 10 * ps, 3 * ps); // top
    g.fillRect(2 * ps, (3 + bobY) * ps, 12 * ps, 4 * ps); // upper
    g.fillRect(2 * ps, (7 + bobY) * ps, 3 * ps, 6 * ps); // left tail
    g.fillRect(11 * ps, (7 + bobY) * ps, 3 * ps, 6 * ps); // right tail
    g.fillRect(1 * ps, (10 + bobY) * ps, 2 * ps, 5 * ps); // far left
    g.fillRect(13 * ps, (10 + bobY) * ps, 2 * ps, 5 * ps); // far right
    // Hair highlights
    g.fillStyle(hairLight, 0.6);
    g.fillRect(5 * ps, (1 + bobY) * ps, 3 * ps, 2 * ps);
    g.fillRect(4 * ps, (5 + bobY) * ps, 2 * ps, 3 * ps);
    // Hair dark strands
    g.fillStyle(hairDark, 0.7);
    g.fillRect(2 * ps, (8 + bobY) * ps, 1 * ps, 5 * ps);
    g.fillRect(13 * ps, (8 + bobY) * ps, 1 * ps, 5 * ps);
    // Bangs (framing face)
    g.fillStyle(hair, 1);
    g.fillRect(4 * ps, (2 + bobY) * ps, 8 * ps, 2 * ps);
    g.fillRect(3 * ps, (3 + bobY) * ps, 2 * ps, 3 * ps); // left bang
    g.fillRect(11 * ps, (3 + bobY) * ps, 2 * ps, 3 * ps); // right bang
    g.fillRect(5 * ps, (4 + bobY) * ps, 1 * ps, 2 * ps); // center strand

    // ─── FACE ───
    g.fillStyle(skin, 1);
    g.fillRect(5 * ps, (4 + bobY) * ps, 6 * ps, 4 * ps);
    g.fillRect(4 * ps, (5 + bobY) * ps, 8 * ps, 2 * ps);
    // Face shadow
    g.fillStyle(skinShadow, 0.3);
    g.fillRect(4 * ps, (7 + bobY) * ps, 8 * ps, 1 * ps);

    // Eyes (golden, large anime style)
    g.fillStyle(eyeWhite, 1);
    g.fillRect(5 * ps, (5 + bobY) * ps, 3 * ps, 2 * ps);
    g.fillRect(9 * ps, (5 + bobY) * ps, 3 * ps, 2 * ps);
    g.fillStyle(eyes, 1);
    g.fillRect(6 * ps, (5 + bobY) * ps, 2 * ps, 2 * ps);
    g.fillRect(10 * ps, (5 + bobY) * ps, 2 * ps, 2 * ps);
    // Pupils
    g.fillStyle(outline, 1);
    g.fillRect(7 * ps, (5 + bobY) * ps, 1 * ps, 2 * ps);
    g.fillRect(11 * ps, (5 + bobY) * ps, 1 * ps, 2 * ps);
    // Eye highlights (anime sparkle)
    g.fillStyle(0xFFFFFF, 0.9);
    g.fillRect(6 * ps, (5 + bobY) * ps, 1 * ps, 1 * ps);
    g.fillRect(10 * ps, (5 + bobY) * ps, 1 * ps, 1 * ps);
    // Eyebrows
    g.fillStyle(outline, 0.6);
    g.fillRect(5 * ps, (4 + bobY) * ps, 3 * ps, 1 * ps);
    g.fillRect(9 * ps, (4 + bobY) * ps, 3 * ps, 1 * ps);
    // Nose (subtle)
    g.fillStyle(skinShadow, 0.4);
    g.fillRect(7 * ps, (6 + bobY) * ps, 2 * ps, 1 * ps);
    // Lips
    g.fillStyle(lips, 0.7);
    g.fillRect(7 * ps, (7 + bobY) * ps, 2 * ps, 1 * ps);

    // ─── OUTFIT (white bodysuit, CC style) ───
    g.fillStyle(outfit, 1);
    g.fillRect(4 * ps, (8 + bobY) * ps, 8 * ps, 5 * ps);
    g.fillRect(3 * ps, (9 + bobY) * ps, 10 * ps, 3 * ps);
    // Outfit details — collar and zipper
    g.fillStyle(outfitShadow, 0.6);
    g.fillRect(7 * ps, (8 + bobY) * ps, 2 * ps, 5 * ps); // zipper line
    g.fillRect(5 * ps, (8 + bobY) * ps, 6 * ps, 1 * ps); // collar
    // Outfit shading
    g.fillStyle(outfitDark, 0.3);
    g.fillRect(3 * ps, (11 + bobY) * ps, 2 * ps, 2 * ps);
    g.fillRect(11 * ps, (11 + bobY) * ps, 2 * ps, 2 * ps);
    // Black accents (belt area)
    g.fillStyle(outline, 0.5);
    g.fillRect(4 * ps, (12 + bobY) * ps, 8 * ps, 1 * ps);

    // ─── ARMS ───
    g.fillStyle(outfit, 1);
    if (legOffset === 0) {
      g.fillRect(2 * ps, (9 + bobY) * ps, 2 * ps, 3 * ps);
      g.fillRect(12 * ps, (10 + bobY) * ps, 2 * ps, 2 * ps);
    } else {
      g.fillRect(2 * ps, (10 + bobY) * ps, 2 * ps, 2 * ps);
      g.fillRect(12 * ps, (9 + bobY) * ps, 2 * ps, 3 * ps);
    }
    // Hands
    g.fillStyle(skin, 1);
    g.fillRect(2 * ps, (12 + bobY) * ps, 2 * ps, 1 * ps);
    g.fillRect(12 * ps, (12 + bobY) * ps, 2 * ps, 1 * ps);

    // ─── LEGS ───
    g.fillStyle(outfitShadow, 1);
    if (legOffset === 0) {
      g.fillRect(5 * ps, (13 + bobY) * ps, 2 * ps, 2 * ps);
      g.fillRect(9 * ps, (13 + bobY) * ps, 2 * ps, 1 * ps);
    } else {
      g.fillRect(5 * ps, (13 + bobY) * ps, 2 * ps, 1 * ps);
      g.fillRect(9 * ps, (13 + bobY) * ps, 2 * ps, 2 * ps);
    }
    // Boots (dark)
    g.fillStyle(outline, 0.8);
    g.fillRect(5 * ps, (15 + bobY) * ps, 2 * ps, 1 * ps);
    g.fillRect(9 * ps, (15 + bobY) * ps, 2 * ps, 1 * ps);

    // ─── ATTACK FRAME (geass symbol / energy blast) ───
    if (frame >= 10) {
      // Geass energy (red glow)
      g.fillStyle(0xFF0000, 0.8);
      if (facing.x > 0) {
        g.fillRect(14 * ps, (5 + bobY) * ps, 3 * ps, 3 * ps);
        g.fillStyle(0xFF4444, 0.5);
        g.fillRect(15 * ps, (4 + bobY) * ps, 2 * ps, 5 * ps);
        g.fillRect(17 * ps, (6 + bobY) * ps, 2 * ps, 2 * ps);
      } else if (facing.x < 0) {
        g.fillRect(0 * ps, (5 + bobY) * ps, 3 * ps, 3 * ps);
        g.fillStyle(0xFF4444, 0.5);
        g.fillRect(0 * ps, (4 + bobY) * ps, 2 * ps, 5 * ps);
        g.fillRect(-1 * ps, (6 + bobY) * ps, 2 * ps, 2 * ps);
      } else if (facing.y < 0) {
        g.fillRect(6 * ps, (0 + bobY) * ps, 4 * ps, 3 * ps);
        g.fillStyle(0xFF4444, 0.5);
        g.fillRect(5 * ps, (-1 + bobY) * ps, 6 * ps, 2 * ps);
      } else {
        g.fillRect(6 * ps, (14 + bobY) * ps, 4 * ps, 3 * ps);
        g.fillStyle(0xFF4444, 0.5);
        g.fillRect(5 * ps, (16 + bobY) * ps, 6 * ps, 2 * ps);
      }
    }

    g.setPosition(-8, -8);
  }

  renderMap(dungeon, theme, time) {
    const g = this.mapGraphics;
    g.clear();

    // Only render tiles visible in camera + small margin
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    const viewW = cam.width / zoom;
    const viewH = cam.height / zoom;
    const startX = Math.max(0, Math.floor((cam.scrollX - TILE) / TILE));
    const startY = Math.max(0, Math.floor((cam.scrollY - TILE) / TILE));
    const endX = Math.min(MAP_W, Math.ceil((cam.scrollX + viewW + TILE) / TILE));
    const endY = Math.min(MAP_H, Math.ceil((cam.scrollY + viewH + TILE) / TILE));

    for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) {
      const t = dungeon.map[y][x];
      const px = x * TILE, py = y * TILE;
      drawTile(g, t, px, py, theme, x, y, time);
    }
  }

  update(time, delta) {
    if (state.phase !== 'explore' || !this.player || !this.screenFX || this.transitioning || gamePaused) return;
    const dt = delta / 1000;
    const dungeon = state.dungeon;
    const theme = THEMES[state.floorTheme % THEMES.length];

    // ─── HIT FREEZE ───
    if (this.hitFreezeTimer > 0) { this.hitFreezeTimer -= dt; return; }

    // ─── PARTICLE POOL UPDATE ───
    this.particles.update(dt);

    // ─── SCREEN EFFECTS UPDATE ───
    this.screenFX.update(dt);

    // ─── ABILITY COOLDOWNS ───
    updateAbilities(dt);

    // ─── DODGE ROLL ───
    updateDodge(dt);
    updateTempBuffs(dt);
    if (Phaser.Input.Keyboard.JustDown(this.shiftKey) && !dodgeState.rolling && dodgeState.charges > 0) {
      dodgeState.rolling = true;
      dodgeState.rollTimer = dodgeState.rollDuration;
      dodgeState.charges--;
      state.player.invincible = 0.3; // i-frames
      // Trail particles
      for (let i = 0; i < 8; i++) {
        this.particles.get(this.player.x + (Math.random()-0.5)*10, this.player.y + (Math.random()-0.5)*10,
          (Math.random()-0.5)*60, (Math.random()-0.5)*60, 0x3890F8, 2, 0.3);
      }
      SFX.step();
    }

    // ─── COOLDOWNS ───
    if (this.interactionCooldown > 0) this.interactionCooldown -= dt;
    if (this.stepTimer > 0) this.stepTimer -= dt;

    // ─── FLOOR PRESSURE: TIMER ───
    if (!state.bossRushMode) {
      state.floorTimer -= dt;
      if (state.floorTimer <= 0 && !state.collapsing) {
        state.collapsing = true;
        state.floorTimer = 0;
        showToast('FLOOR COLLAPSING!', 'warning', 3000, '💥');
        this.addLog('💀 The floor is collapsing! ESCAPE NOW!');
        SFX.jumpscare();
        this.screenFX.shake(15);
        this.screenFX.flash(0xEF4444, 500);
      }
      // Collapse damage every 0.5s
      if (state.collapsing) {
        this._collapseTimer = (this._collapseTimer || 0) + dt;
        if (this._collapseTimer >= 0.5) {
          this._collapseTimer = 0;
          const collapseDmg = 5 + state.depth * 3;
          this.damagePlayer(collapseDmg);
          const sf = document.getElementById('screen-flash');
          if (sf) {
            sf.style.background = '#EF4444';
            sf.style.opacity = '0.3';
            setTimeout(() => { sf.style.opacity = '0'; }, 200);
          }
          this.screenFX.shake(8 + (1 - state.floorTimer / state.floorTimerMax) * 10);
        }
      }
      // Time warning at 20% remaining
      if (!state.collapsing && state.floorTimer <= state.floorTimerMax * 0.2 && state.floorTimer > 0) {
        if (!this._timeWarned) {
          this._timeWarned = true;
          showToast(`HURRY! ${Math.ceil(state.floorTimer)}s left!`, 'warning', 1500, '⏰');
          SFX.heartbeat();
        }
      }
    }

    // ─── FLOOR PRESSURE: EXIT LOCK ───
    if (!state.bossRushMode && state.dungeon) {
      // Check if this is a boss floor
      const hasBoss = BOSSES.some(b => b.floor === state.depth);
      let exitShouldBeLocked;

      if (state.floorEnemiesTotal === 0) {
        exitShouldBeLocked = false;
      } else if (hasBoss) {
        // Boss floor: exit only unlocks when boss is dead
        const bossAlive = this.monsters.some(m => m.active && m.getData && m.getData('isBoss'));
        exitShouldBeLocked = bossAlive;
      } else {
        // Normal floor: exit unlocks at 70% kills
        const killPct = state.floorEnemiesKilled / state.floorEnemiesTotal;
        exitShouldBeLocked = killPct < state.exitUnlockThreshold;
      }

      const wasLocked = state.exitLocked;
      state.exitLocked = exitShouldBeLocked;

      if (wasLocked && !state.exitLocked) {
        const msg = hasBoss ? 'BOSS DEFEATED! Exit unlocked!' : 'EXIT UNLOCKED! 70% of enemies defeated!';
        showToast(msg, 'success', 2000, '🚪');
        this.addLog(`🚪 ${msg}`);
        SFX.exit();
        this.screenFX.flash(0x48C848, 300);
        if (this.exitHint) { this.exitHint.destroy(); this.exitHint = null; }
        for (let i = 0; i < 15; i++) {
          this.particles.get(state.dungeon.exit.x * TILE + TILE/2, state.dungeon.exit.y * TILE + TILE/2,
            (Math.random()-0.5)*60, (Math.random()-0.5)*60, 0x48C848, 2, 0.6);
        }
      }
    }

    // ─── FLOOR PRESSURE: ENEMY WAVES ───
    if (!state.bossRushMode) {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        state.waveNumber++;
        state.waveStrength += 0.15;
        state.waveTimer = Math.max(8, state.waveInterval - state.depth * 0.5);
        const waveCount = Math.min(2 + Math.floor(state.waveNumber * 0.5), 6);
        for (let i = 0; i < waveCount; i++) {
          this.spawnWaveEnemy();
        }
        this.addLog(`☠ Wave ${state.waveNumber}! ${waveCount} enemies (+${Math.round((state.waveStrength-1)*100)}% stronger)`);
        showToast(`Wave ${state.waveNumber} incoming!`, 'warning', 1200, '☠');
        SFX.monsterGrowl();
        this.screenFX.shake(5);
        this.screenFX.flash(0xEF4444, 150);
      }
    }

    // ─── UPDATE VIRTUAL INPUT ───
    updateVirtualInput();

    // ─── PLAYER MOVEMENT ───
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown || isVirtualDown('left')) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown || isVirtualDown('right')) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown || isVirtualDown('up')) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown || isVirtualDown('down')) vy = 1;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707; vy *= 0.707;
    }

    // Get tile position early (needed for speed + interactions)
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);

    let speedMult = state.player.speedMult;

    // Dodge roll speed boost
    if (dodgeState.rolling) speedMult *= dodgeState.rollSpeed;

    // Tile-based speed: water/grass/ice slow you down
    const currentTile = (ty >= 0 && ty < MAP_H && tx >= 0 && tx < MAP_W) ? dungeon.map[ty][tx] : T.FLOOR;
    if (currentTile === T.WATER) speedMult *= 0.5;
    else if (currentTile === T.GRASS_TALL) speedMult *= 0.7;
    else if (currentTile === T.ICE) speedMult *= 1.4;

    // Status effect: FREEZE (capped, doesn't stack multiplicatively)
    if (hasStatus('FREEZE')) {
      speedMult = Math.max(speedMult * 0.5, 0.35);
    }

    // Status effect: HASTE
    if (hasStatus('HASTE')) {
      speedMult *= 1.3;
    }

    // Walk animation
    if (vx !== 0 || vy !== 0) {
      this.playerFacing = { x: vx, y: vy };
      this.animTimer += dt * 8;
      this.playerFrame = Math.floor(this.animTimer) % 4;
      this.drawCatPlayer(this.playerBody, this.playerFrame, this.playerFacing);
      // Bob animation
      const bobY = Math.sin(this.animTimer * 2) * 0.8;
      this.playerBody.y = bobY;
      // Step sound
      if (this.stepTimer <= 0) {
        SFX.step();
        this.stepTimer = 0.3;
      }
    } else {
      this.animTimer = 0;
      // Idle animation — subtle breathing
      const breathe = Math.sin(time * 0.003) * 0.5;
      this.playerBody.y = breathe;
      this.drawCatPlayer(this.playerBody, 0, this.playerFacing);
    }

    this.player.body.setVelocity(vx * PLAYER_SPEED * speedMult, vy * PLAYER_SPEED * speedMult);

    // ─── SHOOTING ───
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) || isVirtualA()) this.shoot();

    // ─── TILE INTERACTIONS (with cooldown) ───
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H && this.interactionCooldown <= 0) {
      const tile = dungeon.map[ty][tx];
      if (tile === T.TRAP || tile === T.SPIKES) {
        this.triggerTrap(tx, ty);
        this.interactionCooldown = INTERACTION_COOLDOWN;
      } else if (tile === T.POISON) {
        // Poison: apply poison status + damage
        if (!hasStatus('POISON')) {
          addStatusEffect('POISON');
          showToast('Poisoned!', 'error', 1500, '☠');
        }
        this.interactionCooldown = INTERACTION_COOLDOWN;
      } else if (tile === T.LAVA) {
        this.damagePlayer(20 + state.depth * 3);
        addStatusEffect('BURN');
        this.interactionCooldown = INTERACTION_COOLDOWN;
      } else if (tile === T.HEAL) {
        this.triggerHeal(tx, ty);
        this.interactionCooldown = INTERACTION_COOLDOWN;
      } else if (tile === T.POWER) {
        this.triggerPower(tx, ty);
        this.interactionCooldown = INTERACTION_COOLDOWN;
      } else if (tile === T.CHEST) {
        this.triggerChest(tx, ty);
        this.interactionCooldown = INTERACTION_COOLDOWN;
      } else if (tile === T.LOCKED_CHEST) {
        if (state.commentCount >= 20) {
          this.triggerLockedChest(tx, ty);
        } else {
          this.addLog(`Locked! Need 20+ comments to open.`);
          SFX.hit();
        }
        this.interactionCooldown = INTERACTION_COOLDOWN;
      } else if (tile === T.GRASS_TALL) {
        // Pokemon-style grass encounter!
        if (Math.random() < 0.008 && this.monsters.filter(m => m.active).length < 6) {
          this.spawnMonsterAt(tx, ty);
          this.addLog('A wild monster appeared!');
          SFX.hit();
        }
      }
    }

    // ─── EXIT INTERACTION ───
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
      if (dungeon.map[ty][tx] === T.EXIT) {
        // Check exit lock
        if (state.exitLocked && !state.bossRushMode) {
          // Exit is locked — show lock status
          const hasBoss = BOSSES.some(b => b.floor === state.depth);
          let lockText;
          if (hasBoss) {
            lockText = 'DEFEAT BOSS!';
          } else {
            const killPct = state.floorEnemiesTotal > 0 ? Math.floor((state.floorEnemiesKilled / state.floorEnemiesTotal) * 100) : 0;
            lockText = `LOCKED (${killPct}%)`;
          }
          if (!this.exitHint) {
            this.exitHint = this.add.text(
              dungeon.exit.x * TILE + TILE/2, dungeon.exit.y * TILE - 8,
              lockText, {
                fontFamily: 'Press Start 2P', fontSize: '5px', color: '#E83838',
                stroke: '#000', strokeThickness: 2, align: 'center',
              }
            ).setOrigin(0.5).setDepth(22);
            this.tweens.add({ targets: this.exitHint, alpha: 0.5, yoyo: true, repeat: -1, duration: 600 });
          } else {
            this.exitHint.setText(lockText);
          }
        } else {
          // Exit unlocked — allow E/B to proceed
          if (Phaser.Input.Keyboard.JustDown(this.eKey) || isVirtualB()) {
            this.nextFloor();
          }
          if (!this.exitHint) {
            this.exitHint = this.add.text(
              dungeon.exit.x * TILE + TILE/2, dungeon.exit.y * TILE - 8,
              'Press E', {
                fontFamily: 'Press Start 2P', fontSize: '5px', color: '#48C848',
                stroke: '#000', strokeThickness: 2, align: 'center',
              }
            ).setOrigin(0.5).setDepth(22);
            this.tweens.add({ targets: this.exitHint, alpha: 0.5, yoyo: true, repeat: -1, duration: 600 });
          }
        }
      } else if (this.exitHint) {
        this.exitHint.destroy();
        this.exitHint = null;
      }
    }

    // ─── VISITED TRACKING ───
    state.visited.add(`${tx},${ty}`);
    // Reveal nearby tiles
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H) {
        state.visited.add(`${nx},${ny}`);
      }
    }

    // ─── DYNAMIC MUSIC (combat intensity) ───
    const activeThreats = this.monsters.filter(m => m.active && m.getData('hp') > 0).length;
    if (activeThreats > 0 && musicPlaying) {
      // Increase music intensity during combat
      setMusicVolume(Math.min(0.25, 0.12 + activeThreats * 0.02));
    } else if (musicPlaying) {
      setMusicVolume(0.12);
    }

    // ─── MONSTER AI ───
    this.monsters.forEach(m => {
      if (!m.active) return;
      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const spd = m.getData('speed') || 50;
      const behavior = m.getData('behavior') || 'chase';
      const body = m.getAt(0);

      // Boss has its own AI system
      if (m.getData('isBoss')) {
        this.updateBossAI(m, dx, dy, dist, time, dt);
        return;
      }

      // Pulsing glow effect
      if (body && body.active) {
        const pulse = 0.7 + Math.sin(time * 0.005 + m.getData('offset')) * 0.3;
        m.setAlpha(pulse);
      }

      switch (behavior) {
        case 'flank': {
          // Shadow Crawler — tries to circle behind the player
          if (dist < 180) {
            const angle = Math.atan2(dy, dx);
            const flankAngle = angle + Math.PI * 0.6; // offset to the side
            const tx = this.player.x + Math.cos(flankAngle) * 40;
            const ty = this.player.y + Math.sin(flankAngle) * 40;
            const fdx = tx - m.x, fdy = ty - m.y;
            const fdist = Math.sqrt(fdx * fdx + fdy * fdy);
            if (fdist > 2) m.body.setVelocity((fdx / fdist) * spd, (fdy / fdist) * spd);
          } else if (dist < 300) {
            const angle = time * 0.001 + m.getData('offset');
            m.body.setVelocity(Math.cos(angle) * spd * 0.3, Math.sin(angle) * spd * 0.3);
          } else {
            m.body.setVelocity(0, 0);
          }
          break;
        }

        case 'phase': {
          // Lost Soul — phases through walls, teleports when stuck
          if (dist < 200) {
            m.body.setVelocity((dx / dist) * spd * 0.8, (dy / dist) * spd * 0.8);
            m.body.setAllowGravity(false);
            // Teleport closer occasionally
            if (dist > 100 && Math.random() < 0.005) {
              const tAngle = Math.random() * Math.PI * 2;
              m.x = this.player.x + Math.cos(tAngle) * 60;
              m.y = this.player.y + Math.sin(tAngle) * 60;
              for (let i = 0; i < 6; i++) {
                this.spawnParticle(m.x, m.y, (Math.random()-0.5)*60, (Math.random()-0.5)*60, 0x4444FF, 0.6);
              }
              SFX.whisper();
            }
          } else {
            // Float aimlessly
            const angle = time * 0.0008 + m.getData('offset');
            m.body.setVelocity(Math.cos(angle) * spd * 0.2, Math.sin(angle) * 0.001 * spd * 0.2);
          }
          break;
        }

        case 'charge': {
          // Flesh Golem — charges in a straight line, then stops to recover
          const charging = m.getData('charging');
          const chargeCooldown = m.getData('chargeCooldown') || 0;
          const chargeDir = m.getData('chargeDir') || { x: 0, y: 0 };

          if (chargeCooldown > 0) {
            m.setData('chargeCooldown', chargeCooldown - dt);
            m.body.setVelocity(0, 0);
            // Recovery wobble
            if (body) body.y = Math.sin(time * 0.01) * 1;
          } else if (charging) {
            m.body.setVelocity(chargeDir.x * spd * 2.5, chargeDir.y * spd * 2.5);
            // Stop after a short charge
            if (m.getData('chargeTime') > 0) {
              m.setData('chargeTime', m.getData('chargeTime') - dt);
            } else {
              m.setData('charging', false);
              m.setData('chargeCooldown', 2.0);
            }
          } else if (dist < 200 && dist > 30) {
            // Wind up and charge
            const angle = Math.atan2(dy, dx);
            m.setData('chargeDir', { x: Math.cos(angle), y: Math.sin(angle) });
            m.setData('charging', true);
            m.setData('chargeTime', 0.4);
          } else {
            // Slowly approach
            if (dist > 30) m.body.setVelocity((dx / dist) * spd * 0.3, (dy / dist) * spd * 0.3);
            else m.body.setVelocity(0, 0);
          }
          break;
        }

        case 'teleport': {
          // Void Stalker — teleports closer when far, circles when close
          if (dist > 200) {
            // Blink closer
            if (Math.random() < 0.01) {
              const tAngle = Math.atan2(dy, dx);
              m.x = this.player.x - Math.cos(tAngle) * 50;
              m.y = this.player.y - Math.sin(tAngle) * 50;
              for (let i = 0; i < 5; i++) {
                this.spawnParticle(m.x, m.y, (Math.random()-0.5)*50, (Math.random()-0.5)*50, 0xAA00FF, 0.7);
              }
              SFX.power();
            }
            m.body.setVelocity((dx / dist) * spd, (dy / dist) * spd);
          } else if (dist < 80) {
            // Circle the player
            const orbitAngle = time * 0.002 + m.getData('offset');
            const orbitX = this.player.x + Math.cos(orbitAngle) * 60;
            const orbitY = this.player.y + Math.sin(orbitAngle) * 60;
            const odx = orbitX - m.x, ody = orbitY - m.y;
            const odist = Math.sqrt(odx * odx + ody * ody);
            if (odist > 2) m.body.setVelocity((odx / odist) * spd, (ody / odist) * spd);
          } else {
            m.body.setVelocity((dx / dist) * spd * 0.6, (dy / dist) * spd * 0.6);
          }
          break;
        }

        case 'ranged': {
          // Bone Horror — stays at range, fires bone projectiles
          if (dist < 100) {
            // Retreat
            m.body.setVelocity((-dx / dist) * spd, (-dy / dist) * spd);
          } else if (dist < 250) {
            // Strafe
            const strafeAngle = time * 0.001 + m.getData('offset');
            m.body.setVelocity(Math.cos(strafeAngle) * spd * 0.5, Math.sin(strafeAngle) * spd * 0.5);
            // Fire projectile occasionally
            if (Math.random() < 0.015) {
              const angle = Math.atan2(dy, dx);
              const bone = this.add.circle(m.x, m.y, 3, 0xD4C5B0, 0.8);
              bone.setDepth(8);
              this.physics.world.enable(bone);
              bone.body.setAllowGravity(false);
              bone.body.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
              this.time.delayedCall(2000, () => { if (bone.active) bone.destroy(); });
              this.physics.add.overlap(bone, this.player, () => {
                this.damagePlayer(m.getData('damage') * 0.6);
                bone.destroy();
              });
              SFX.creak();
            }
          } else {
            m.body.setVelocity(0, 0);
          }
          break;
        }

        default: {
          // Generic chase
          if (dist < 150) {
            m.body.setVelocity((dx / dist) * spd, (dy / dist) * spd);
          } else if (dist < 250) {
            const angle = time * 0.001 + m.getData('offset');
            m.body.setVelocity(Math.cos(angle) * 15, Math.sin(angle) * 15);
          } else {
            m.body.setVelocity(0, 0);
          }
        }
      }

      // Melee damage
      if (dist < 18 && state.player.invincible <= 0) {
        this.damagePlayer(m.getData('damage') || 10);
      }
    });

    // ─── STATUS EFFECTS ───
    processStatusEffects(dt);
    updateStatusUI();

    // ─── COMBO TIMER ───
    if (combo.timer > 0) {
      combo.timer -= dt;
      if (combo.timer <= 0) {
        resetCombo();
      }
    }

    // ─── RANDOM EVENTS ───
    if (Math.random() < 0.003 * dt) {
      const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
      this.addLog(`✨ ${event.name}!`);
      event.apply(state.player);
      SFX.power();
    }

    // ─── HORROR ATMOSPHERE ───
    // Ambient sounds
    if (Math.random() < 0.002 * dt) {
      const theme = THEMES[state.floorTheme % THEMES.length];
      const sound = theme.ambientSound;
      if (sound && SFX[sound]) SFX[sound]();
    }

    // Floating dust/mist particles
    if (Math.random() < 0.01 * dt) {
      const px = this.player.x + (Math.random() - 0.5) * 200;
      const py = this.player.y + (Math.random() - 0.5) * 200;
      this.particles.get(px, py, (Math.random()-0.5)*8, -5 - Math.random()*10, 0xFFFFFF, 2, 3, { alpha: 0.04 });
    }

    // Flickering torch light (subtle)
    if (Math.random() < 0.005 * dt) {
      const flicker = this.add.circle(
        this.player.x + (Math.random() - 0.5) * 100,
        this.player.y + (Math.random() - 0.5) * 100,
        30 + Math.random() * 20, 0xFF6B35, 0.02 + Math.random() * 0.02
      );
      flicker.setDepth(4);
      this.tweens.add({ targets: flicker, alpha: 0, duration: 500 + Math.random() * 500, onComplete: () => flicker.destroy() });
    }

    // Horror shadow in periphery (rare, creepy)
    if (Math.random() < 0.0005 * dt && state.depth >= 2) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 60;
      const sx = this.player.x + Math.cos(angle) * dist;
      const sy = this.player.y + Math.sin(angle) * dist;
      const shadow = this.add.container(sx, sy);
      const shadowGfx = this.add.graphics();
      shadowGfx.fillStyle(0x000000, 0.6);
      shadowGfx.fillRect(-6, -8, 12, 16);
      shadowGfx.fillStyle(0xFF0000, 0.4);
      shadowGfx.fillRect(-4, -5, 2, 2);
      shadowGfx.fillRect(2, -5, 2, 2);
      shadow.add(shadowGfx);
      shadow.setDepth(6);
      this.tweens.add({
        targets: shadow, alpha: 0, x: sx + (Math.random() - 0.5) * 40, y: sy + (Math.random() - 0.5) * 40,
        duration: 1500 + Math.random() * 1000,
        onComplete: () => shadow.destroy()
      });
      if (Math.random() < 0.3) SFX.whisper();
    }

    // ─── SHIELD VISUAL ───
    if (state.player.shield > 0) {
      if (!this.shieldGfx) {
        this.shieldGfx = this.add.circle(0, 0, 12, 0x3B82F6, 0.15);
        this.shieldGfx.setStrokeStyle(1, 0x3B82F6, 0.4);
        this.player.add(this.shieldGfx);
      }
    } else if (this.shieldGfx) {
      this.shieldGfx.destroy();
      this.shieldGfx = null;
    }

    // ─── INVINCIBILITY ───
    if (state.player.invincible > 0) {
      state.player.invincible -= dt;
      // Flicker between visible and semi-transparent
      const flicker = Math.sin(time * 0.015) > 0;
      this.player.setAlpha(flicker ? 1 : 0.25);
      // Tint flicker during i-frames
      if (this.playerHurtOverlay) {
        this.playerHurtOverlay.setVisible(!flicker);
      }
    } else {
      this.player.setAlpha(1);
      if (this.playerHurtOverlay) this.playerHurtOverlay.setVisible(false);
    }

    // ─── BULLET CLEANUP ───
    this.bullets.getChildren().forEach(b => {
      if (b.active && (b.x < 0 || b.x > MAP_W * TILE || b.y < 0 || b.y > MAP_H * TILE)) {
        this.cleanupBullet(b);
        b.destroy();
      }
    });

    // ─── CAMERA TRACKING ───

    // ─── FOG OF WAR ───
    this.drawFog(dungeon, tx, ty, time);

    // ─── MINIMAP ───
    this.drawMinimap(dungeon, tx, ty);

    // ─── SCREEN SHAKE (gentle, doesn't fight camera) ───
    if (this.screenShake > 0) {
      this.screenShake *= 0.92;
      this.cameras.main.shake(this.screenShake * 0.001, 50);
      if (this.screenShake < 0.3) this.screenShake = 0;
    }

    // ─── PARTICLES ───
    if (this.particles && this.particles.update) {
      this.particles.update(dt);
    }

    // ─── RE-RENDER MAP (for animated tiles like water, lava) ───
    // Only re-render every few frames for performance
    if (Math.floor(time / 200) !== Math.floor((time - delta) / 200)) {
      this.renderMap(dungeon, theme, time);
    }

    // ─── EXIT COMPASS ARROW ───
    if (dungeon.exit && !this.compassGraphics) {
      this.compassGraphics = this.add.graphics().setDepth(30);
    }
    if (this.compassGraphics && dungeon.exit) {
      const cg = this.compassGraphics;
      cg.clear();
      const cam = this.cameras.main;
      const screenCx = cam.width / 2;
      const screenCy = cam.height / 2;
      const exitWorldX = dungeon.exit.x * TILE + TILE / 2;
      const exitWorldY = dungeon.exit.y * TILE + TILE / 2;
      const dx = exitWorldX - this.player.x;
      const dy = exitWorldY - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 100) {
        const angle = Math.atan2(dy, dx);
        const arrowDist = Math.min(80, dist / 4);
        const ax = screenCx + Math.cos(angle) * arrowDist;
        const ay = screenCy + Math.sin(angle) * arrowDist;
        const pulse = 0.4 + Math.sin(time * 0.004) * 0.3;
        cg.fillStyle(0x34D399, pulse);
        const s = 5;
        const tipX = ax + Math.cos(angle) * (s + 3);
        const tipY = ay + Math.sin(angle) * (s + 3);
        const leftX = ax + Math.cos(angle + 2.4) * s;
        const leftY = ay + Math.sin(angle + 2.4) * s;
        const rightX = ax + Math.cos(angle - 2.4) * s;
        const rightY = ay + Math.sin(angle - 2.4) * s;
        cg.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
      }
    }

    this.updateUI();
  }

  drawFog(dungeon, px, py, time) {
    this.fogGraphics.clear();
    const g = this.fogGraphics;

    // Only draw fog for tiles within camera view + margin
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    const viewW = cam.width / zoom;
    const viewH = cam.height / zoom;
    const startX = Math.max(0, Math.floor((cam.scrollX - TILE * 2) / TILE));
    const startY = Math.max(0, Math.floor((cam.scrollY - TILE * 2) / TILE));
    const endX = Math.min(MAP_W, Math.ceil((cam.scrollX + viewW + TILE * 2) / TILE));
    const endY = Math.min(MAP_H, Math.ceil((cam.scrollY + viewH + TILE * 2) / TILE));

    for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) {
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist > VIEW_RADIUS) {
        const visited = state.visited.has(`${x},${y}`);
        if (visited) {
          g.fillStyle(0x000000, 0.4);
        } else {
          const alpha = Math.min(0.85, (dist - VIEW_RADIUS) * 0.1);
          g.fillStyle(0x000000, alpha);
        }
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // ─── TORCH GLOW EFFECTS ───
    this.dynamicGlowTiles.forEach(torch => {
      const dist = Math.sqrt((torch.x - px) ** 2 + (torch.y - py) ** 2);
      if (dist > VIEW_RADIUS + 3) return;
      const flicker = torch.intensity + Math.sin(time * 0.008 + torch.x * 3) * 0.15 + Math.sin(time * 0.013 + torch.y * 5) * 0.1;
      const glowSize = 3 + Math.sin(time * 0.006) * 0.5;
      const px2 = torch.x * TILE + TILE / 2;
      const py2 = torch.y * TILE + TILE / 2;
      // Warm glow circle
      g.fillStyle(0xFF8800, flicker * 0.08);
      g.fillCircle(px2, py2, TILE * glowSize);
      g.fillStyle(0xFFAA00, flicker * 0.15);
      g.fillCircle(px2, py2, TILE * (glowSize * 0.6));
      g.fillStyle(0xFFCC44, flicker * 0.25);
      g.fillCircle(px2, py2, TILE * (glowSize * 0.3));
      // Torch flame pixels
      const flameH = 3 + Math.sin(time * 0.015) * 1.5;
      g.fillStyle(0xFF6600, 0.8);
      g.fillRect(px2 - 2, py2 - flameH, 4, flameH);
      g.fillStyle(0xFFAA00, 0.6);
      g.fillRect(px2 - 1, py2 - flameH - 1, 2, 2);
    });
  }

  drawMinimap(dungeon, px, py) {
    const g = this.minimapGraphics;
    g.clear();
    if (typeof minimapVisible !== 'undefined' && !minimapVisible) return;
    const mmScale = 1;
    const mmW = MAP_W * mmScale;
    const mmH = MAP_H * mmScale;
    // Position at top-right of camera viewport
    const cam = this.cameras.main;
    const mmX = cam.scrollX + (cam.width / cam.zoom) - mmW - 8;
    const mmY = cam.scrollY + 8;

    // Background
    g.fillStyle(0x000000, 0.6);
    g.fillRoundedRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6, 3);
    g.lineStyle(1, 0xffffff, 0.15);
    g.strokeRoundedRect(mmX - 3, mmY - 3, mmW + 6, mmH + 6, 3);

    // Tiles
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!state.visited.has(`${x},${y}`)) continue;
      const t = dungeon.map[y][x];
      if (t === T.WALL || t === T.TREE || t === T.FENCE) {
        g.fillStyle(0x444455, 0.7);
      } else if (t === T.WATER) {
        g.fillStyle(0x3890F8, 0.6);
      } else if (t === T.EXIT) {
        g.fillStyle(0x34D399, 0.9);
      } else if (t === T.TRAP) {
        g.fillStyle(0xEF4444, 0.4);
      } else {
        g.fillStyle(0x889966, 0.3);
      }
      g.fillRect(mmX + x * mmScale, mmY + y * mmScale, mmScale, mmScale);
    }

    // Always show exit location on minimap with pulsing dot
    if (dungeon.exit) {
      const exitPx = mmX + dungeon.exit.x * mmScale;
      const exitPy = mmY + dungeon.exit.y * mmScale;
      const pulse = 0.5 + Math.sin(Date.now() * 0.005) * 0.5;
      // Compass effect: larger, brighter exit indicator + path hint
      if (state.player.hasCompass) {
        g.fillStyle(0x34D399, 0.15);
        g.fillCircle(exitPx + mmScale/2, exitPy + mmScale/2, 6);
        g.fillStyle(0x34D399, 0.3);
        g.fillCircle(exitPx + mmScale/2, exitPy + mmScale/2, 4);
      }
      g.fillStyle(0x34D399, pulse);
      g.fillRect(exitPx - 1, exitPy - 1, mmScale + 2, mmScale + 2);
    }

    // Player dot
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(mmX + px * mmScale + mmScale / 2, mmY + py * mmScale + mmScale / 2, 2);

    // Monsters
    this.monsters.forEach(m => {
      if (!m.active) return;
      const mx = Math.floor(m.x / TILE), my = Math.floor(m.y / TILE);
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (m.getData('isBoss')) {
        // Boss — pulsing skull indicator (always visible on minimap)
        const bossPulse = 0.6 + Math.sin(Date.now() * 0.006) * 0.4;
        g.fillStyle(0xFF4444, bossPulse);
        g.fillCircle(mmX + mx * mmScale + mmScale / 2, mmY + my * mmScale + mmScale / 2, 3);
        g.fillStyle(0xFF8888, bossPulse * 0.5);
        g.fillCircle(mmX + mx * mmScale + mmScale / 2, mmY + my * mmScale + mmScale / 2, 5);
      } else if (dist < VIEW_RADIUS) {
        g.fillStyle(0xEF4444, 0.8);
        g.fillCircle(mmX + mx * mmScale + mmScale / 2, mmY + my * mmScale + mmScale / 2, 1.5);
      }
    });
  }

  shoot() {
    const dirX = this.playerFacing.x || 0;
    const dirY = this.playerFacing.y || 1;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    const nx = len > 0 ? dirX / len : 0;
    const ny = len > 0 ? dirY / len : 1;

    // Attack animation (frame 10+ = energy blast)
    this.drawCatPlayer(this.playerBody, 10, this.playerFacing);
    // Lunge forward
    const lungeX = (this.playerFacing.x || 0) * 3;
    const lungeY = (this.playerFacing.y || 0) * 3;
    this.playerBody.x = lungeX;
    this.playerBody.y = lungeY;
    this.time.delayedCall(80, () => {
      if (this.playerBody && this.playerBody.active) {
        this.playerBody.x = lungeX * 0.5;
        this.playerBody.y = lungeY * 0.5;
      }
    });
    this.time.delayedCall(160, () => {
      if (this.playerBody && this.playerBody.active) {
        this.drawCatPlayer(this.playerBody, 0, this.playerFacing);
        this.playerBody.x = 0;
        this.playerBody.y = 0;
      }
    });

    const bullet = this.add.circle(
      this.player.x + nx * 10, this.player.y + ny * 10,
      3, 0xA882F7
    );
    bullet.setDepth(8);
    this.physics.world.enable(bullet);
    bullet.body.setAllowGravity(false);
    bullet.body.setVelocity(nx * BULLET_SPEED, ny * BULLET_SPEED);
    this.bullets.add(bullet);
    SFX.shoot();

    // Muzzle flash
    for (let i = 0; i < 2; i++) {
      this.spawnParticle(
        this.player.x + nx * 8, this.player.y + ny * 8,
        (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40,
        0xA882F7, 0.3
      );
    }

    // Bullet-monster collision (track for cleanup)
    this.monsters.forEach(m => {
      if (!m.active) return;
      const overlap = this.physics.add.overlap(bullet, m, () => {
        this.hitMonster(m);
        this.cleanupBullet(bullet);
        bullet.destroy();
      });
      this.bulletOverlaps.push({ bullet, overlap });
    });

    // Bullet-wall collision
    const wallCollider = this.physics.add.collider(bullet, this.walls, () => {
      this.cleanupBullet(bullet);
      bullet.destroy();
    });
    this.bulletOverlaps.push({ bullet, overlap: wallCollider });

    // Auto-cleanup after 2s
    this.time.delayedCall(2000, () => {
      if (bullet.active) {
        this.cleanupBullet(bullet);
        bullet.destroy();
      }
    });
  }

  cleanupBullet(bullet) {
    this.bulletOverlaps = this.bulletOverlaps.filter(e => {
      if (e.bullet === bullet) {
        e.overlap.destroy();
        return false;
      }
      return true;
    });
  }

  hitMonster(monster) {
    this.damageMonster(monster, 0, false);
  }

  damageMonster(monster, abilityDmg = 0, isCrit = false) {
    const theme = THEMES[state.floorTheme % THEMES.length];
    let damage = abilityDmg || state.player.atk;

    // Weapon bonus
    if (state.player.weapon && !abilityDmg) {
      damage += state.player.weapon.atk || 0;
    }

    // Combo multiplier
    if (!abilityDmg) addCombo();
    damage = Math.floor(damage * combo.multiplier);

    // Critical hit (15% base chance, +5% per combo tier)
    let crit = isCrit;
    if (!crit) {
      const critChance = 0.15 + (combo.count >= 8 ? 0.15 : combo.count >= 5 ? 0.10 : combo.count >= 3 ? 0.05 : 0);
      crit = Math.random() < critChance;
    }
    if (crit) {
      damage = Math.floor(damage * 2);
      if (this.screenFX) {
        this.screenFX.freeze(0.08); // hit-stop — longer on crit
        this.screenFX.shake(12); // bigger shake on crit
        this.screenFX.flash(0xFFFFFF, 100);
      }
      showToast('CRIT!', 'warning', 800, '💥');
    }

    const hp = monster.getData('hp') - damage;
    const maxHp = monster.getData('maxHp');
    monster.setData('hp', hp);

    // Update HP bar
    const hpFill = monster.getData('hpFill');
    if (hpFill && hpFill.active) {
      const ratio = Math.max(0, hp / maxHp);
      hpFill.setScale(ratio, 1);
      if (ratio > 0.5) hpFill.setFillStyle(0x48C848, 0.8);
      else if (ratio > 0.25) hpFill.setFillStyle(0xF8D838, 0.8);
      else hpFill.setFillStyle(0xEF4444, 0.8);
    }

    // Hit flash — tint body white briefly
    const monsterBody = monster.getAt(0);
    if (monsterBody && monsterBody.setTint) {
      monsterBody.setTint(crit ? 0xFFFF00 : 0xFFFFFF);
      this.time.delayedCall(60, () => { if (monsterBody.active) monsterBody.clearTint(); });
      this.time.delayedCall(120, () => { if (monsterBody.active) monsterBody.setTint(0xFF8888); });
      this.time.delayedCall(180, () => { if (monsterBody.active) monsterBody.clearTint(); });
    } else {
      monster.setAlpha(0.3);
      this.time.delayedCall(80, () => { if (monster.active) monster.setAlpha(0.9); });
    }

    // Enhanced hit particles from pool
    const hitColor = crit ? 0xFBBF24 : theme.accent;
    for (let i = 0; i < (crit ? 12 : 6); i++) {
      this.particles.get(monster.x, monster.y, (Math.random()-0.5)*80, (Math.random()-0.5)*80, hitColor, crit ? 3 : 2, 0.4, { gravity: 30 });
    }

    // Blood splatter on crit
    if (crit) {
      for (let i = 0; i < 8; i++) {
        this.particles.get(monster.x, monster.y, (Math.random()-0.5)*120, (Math.random()-0.5)*120, 0xEF4444, 2, 0.6, { gravity: 60 });
      }
    }

    if (this.screenFX) this.screenFX.shake(crit ? 8 : 4);
    SFX.hit();

    // Show combo + damage number
    const comboText = combo.count > 1 ? ` (${combo.count}x)` : '';
    const critText = crit ? ' CRIT!' : '';
    this.spawnDamageNumber(monster.x, monster.y, `-${damage}${critText}${comboText}`, crit ? 0xFBBF24 : combo.count >= 5 ? 0xA882F7 : 0xFFFFFF);

    // Weapon special effects
    if (state.player.weapon && !abilityDmg) {
      if (state.player.weapon.id === 'fire_staff' && Math.random() < 0.3) {
        addStatusEffect('BURN');
        state.log.push('Weapon: Burn applied!');
      }
      if (state.player.weapon.id === 'ice_bow' && Math.random() < 0.3) {
        addStatusEffect('FREEZE');
        state.log.push('Weapon: Freeze applied!');
      }
    }

    if (hp <= 0) {
      // Death dissolve animation with enhanced particles
      const deathColor = monster.getData('behavior') === 'phase' ? 0x4444FF :
                         monster.getData('behavior') === 'teleport' ? 0xAA00FF : 0xEF4444;
      for (let i = 0; i < 25; i++) {
        this.particles.get(monster.x, monster.y, (Math.random()-0.5)*180, (Math.random()-0.5)*180, deathColor, 3, 0.7, { gravity: 40, friction: 0.96 });
      }
      // Enhanced gold sparkles on every kill
      for (let i = 0; i < 10; i++) {
        this.particles.get(monster.x, monster.y, (Math.random()-0.5)*80, -40 - Math.random()*80, 0xF8B800, 2, 1.0, { gravity: 20 });
      }
      // White flash burst
      for (let i = 0; i < 8; i++) {
        this.particles.get(monster.x, monster.y, (Math.random()-0.5)*100, (Math.random()-0.5)*100, 0xFFFFFF, 1.5, 0.3, { gravity: 0 });
      }
      // Dissolve: shrink and fade over 300ms
      this.tweens.add({
        targets: monster,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => { if (monster.active) monster.destroy(); }
      });
      monster.body.setVelocity(0, 0);
      state.kills++;
      state.floorEnemiesKilled++;
      // Time bonus: +2s per kill (rewards killing enemies)
      if (!state.bossRushMode && !state.collapsing) {
        state.floorTimer = Math.min(state.floorTimerMax, state.floorTimer + 2);
        state._timeWarned = false; // reset warning so it can trigger again
      }

      // Combo bonus XP (scaled by community engagement + floor depth + risk tokens + floor modifier)
      const cm = getCommunityMultiplier();
      const rm = getRiskMultiplier();
      const xm = getFloorXpMultiplier();
      const gm = getFloorGoldMultiplier();
      const comboXpBonus = Math.floor((15 + state.depth * 8) * (combo.multiplier - 1) * cm * rm * xm);
      const baseXp = Math.floor((15 + state.depth * 8) * cm * rm * xm);
      state.player.xp += baseXp + comboXpBonus;
      state.player.gold += Math.floor((8 + state.depth * 5) * cm * rm * gm * (1 + state.depth * 0.05));

      // Holy lance heal on kill
      if (state.player.weapon && state.player.weapon.id === 'holy_lance') {
        const heal = 5;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
        this.particles.get(this.player.x, this.player.y, 0, -30, 0x34D399, 2, 0.5, { gravity: -10 });
      }

      this.addLog(`Monster defeated! +${baseXp + comboXpBonus} XP${comboXpBonus > 0 ? ` (${combo.multiplier}x combo!)` : ''}`);
      // Show gold earned from kill
      const goldEarned = Math.floor((8 + state.depth * 5) * cm * (1 + state.depth * 0.05));
      if (goldEarned > 15) {
        this.spawnDamageNumber(monster.x + 12, monster.y - 4, `+${goldEarned}G`, 0xF8B800);
      }
      if (this.screenFX) this.screenFX.shake(6);
      SFX.kill();

      // Boss drops weapon
      if (monster.getData('isBoss')) {
        const rarity = rollRarity();
        const weapon = getRandomWeapon(state.depth);
        weapon.rarity = rarity;
        state.player.weapon = weapon;
        const rarityInfo = RARITY[rarity];
        this.addLog(`🗡 ${rarityInfo.name} ${weapon.name}! (${weapon.desc})`);
        showToast(`${rarityInfo.name} ${weapon.name}!`, rarity === 'legendary' ? 'legendary' : 'loot', 3000, weapon.icon);
        SFX.chest();
        const bossBar = document.getElementById('boss-health-bar');
        if (bossBar) bossBar.style.display = 'none';
        if (this.screenFX) {
          this.screenFX.shake(12);
          this.screenFX.flash(0xF8B800, 400);
        }
        // Victory particles
        for (let i = 0; i < 30; i++) {
          this.particles.get(monster.x, monster.y, (Math.random()-0.5)*200, -50 - Math.random()*150, 0xF8B800, 3, 1.2, { gravity: 60, friction: 0.97 });
        }
        // Character victory quote
        const victoryQuote = getBossDefeatQuote();
        showToast(victoryQuote, 'legendary', 4000, getCharacterData().name);
        this.addLog(`${getCharacterData().name}: ${victoryQuote}`);
      }

      // Random weapon drop from normal monsters (5% chance)
      if (!monster.getData('isBoss') && Math.random() < 0.05) {
        const rarity = rollRarity();
        const weapon = getRandomWeapon(state.depth);
        weapon.rarity = rarity;
        const currentWeapon = state.player.weapon;
        if (!currentWeapon || WEAPONS[weapon.id].atk > (currentWeapon.atk || WEAPONS[currentWeapon.id]?.atk || 0)) {
          state.player.weapon = weapon;
          const rarityInfo = RARITY[rarity];
          this.addLog(`Found: ${rarityInfo.name} ${weapon.name}! (${weapon.desc})`);
          showToast(`${rarityInfo.name} ${weapon.name}!`, rarity === 'legendary' ? 'legendary' : 'loot', 3000, weapon.icon);
          SFX.power();
        }
      }

      checkAchievements();

      // Level up with celebration
      if (state.player.xp >= state.player.xpNext) {
        state.player.level++;
        state.player.xp -= state.player.xpNext;
        state.player.xpNext = Math.floor(state.player.xpNext * 1.5);
        state.player.maxHp += 12;
        state.player.hp = Math.min(state.player.hp + 30, state.player.maxHp);
        state.player.atk += 3;
        state.player.def += 1;
        state.player.title = this.getTitle(state.player.level);
        this.addLog(`LEVEL UP! Now ${state.player.title}`);
        showToast(`Level ${state.player.level}! ${state.player.title}`, 'success', 2500, '⭐');
        SFX.levelup();
        if (this.screenFX) this.screenFX.flash(0xFBBF24, 200);
        // Level up particles
        for (let i = 0; i < 20; i++) {
          const angle = (Math.PI * 2 * i) / 20;
          this.particles.get(this.player.x + Math.cos(angle)*15, this.player.y + Math.sin(angle)*15,
            Math.cos(angle)*60, Math.sin(angle)*60, 0xFBBF24, 3, 0.6, { friction: 0.95 });
        }
      }
    }
  }

  damagePlayer(amount) {
    if (state.player.invincible > 0 || dodgeState.rolling) return;
    if (!this.screenFX) return; // scene transitioning

    // Reset combo on taking damage
    resetCombo();
    floorDamageTaken++;

    // Shield check
    if (state.player.shield > 0) {
      state.player.shield--;
      state.player.invincible = 0.5;
      this.addLog(`Shield blocked! (${state.player.shield} left)`);
      showToast(`Shield! (${state.player.shield} left)`, 'info', 1200, '🛡');
      SFX.power();
      this.screenFX.flash(0x3B82F6, 100);
      for (let i = 0; i < 8; i++) this.particles.get(this.player.x, this.player.y, (Math.random()-0.5)*60, (Math.random()-0.5)*60, 0x3B82F6, 2, 0.4);
      return;
    }

    const dmg = Math.max(1, amount - state.player.def);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.player.invincible = 1.2;
    // Bigger shake for bigger hits
    const shakeAmount = Math.min(12, 6 + Math.floor(dmg / 10));
    this.screenFX.shake(shakeAmount);
    this.screenFX.flash(0xEF4444, 150);
    this.screenFX.freeze(0.05); // hit-stop on player damage
    SFX.hurt();

    // Hurt animation — flash red overlay on player
    if (this.playerHurtOverlay) {
      this.playerHurtOverlay.setVisible(true);
      this.time.delayedCall(100, () => { if (this.playerHurtOverlay) this.playerHurtOverlay.setVisible(false); });
      this.time.delayedCall(200, () => { if (this.playerHurtOverlay) this.playerHurtOverlay.setVisible(true); });
      this.time.delayedCall(300, () => { if (this.playerHurtOverlay) this.playerHurtOverlay.setVisible(false); });
      this.time.delayedCall(400, () => { if (this.playerHurtOverlay) this.playerHurtOverlay.setVisible(true); });
      this.time.delayedCall(500, () => { if (this.playerHurtOverlay) this.playerHurtOverlay.setVisible(false); });
    }

    this.addLog(`Took ${dmg} damage!`);
    this.spawnDamageNumber(this.player.x, this.player.y, `-${dmg}`, 0xEF4444);

    // Blood particles
    for (let i = 0; i < 8; i++) {
      this.particles.get(this.player.x, this.player.y, (Math.random()-0.5)*80, (Math.random()-0.5)*80, 0xEF4444, 2, 0.5, { gravity: 40 });
    }

    if (state.player.hp <= 0) {
      state.phase = 'gameover';
      stopMusic();
      SFX.death();
      // Save progress before showing game over
      persistentGold += state.player.gold;
      savePersistentData();
      document.getElementById('gameover-screen').classList.add('show');
      document.getElementById('go-title').textContent = 'GAME OVER';
      document.getElementById('go-title').style.color = '#E83838';
      document.getElementById('go-stats').innerHTML = `
        Floor: ${state.depth + 1} / ${state.totalFloors}<br>
        Kills: ${state.kills}<br>
        Gold: ${state.player.gold}<br>
        Level: ${state.player.level} (${state.player.title})<br>
        ${state.commentCount > 0 ? `Community: ${state.commentCount} comments (${getCommunityMultiplier().toFixed(1)}x)` : ''}
      `;
    }
  }

  triggerTrap(x, y) {
    // Don't remove trap — just trigger damage once per visit
    this.damagePlayer(15 + state.depth * 2);
    SFX.trap();
    const trapEffects = ['POISON', 'BURN', 'FREEZE'];
    if (Math.random() < 0.35) {
      const effect = trapEffects[Math.floor(Math.random() * trapEffects.length)];
      addStatusEffect(effect);
      this.addLog(`TRAP! ${STATUS[effect].name} applied!`);
    } else {
      this.addLog('TRAP! Took damage!');
    }
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xEF4444, 0.4);
    flash.setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 4; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 40, -Math.random() * 30, 0xEF4444, 0.7);
  }

  triggerHeal(x, y) {
    // SHIFT + interact = refuse heal, gain risk token (+15% gold/XP multiplier)
    if (this.shiftKey && this.shiftKey.isDown) {
      state.dungeon.map[y][x] = T.FLOOR;
      state.riskTokens++;
      state.riskMultiplier = getRiskMultiplier();
      this.addLog(`⚡ REFUSED HEAL! Risk Token +1 (${state.riskTokens}) | ${Math.round((state.riskMultiplier - 1) * 100)}% bonus`);
      showToast(`Risk Token +1! (${Math.round((state.riskMultiplier-1)*100)}% bonus)`, 'warning', 2000, '⚡');
      SFX.power();
      // Purple risk particles
      for (let i = 0; i < 10; i++) {
        this.particles.get(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 60, -Math.random() * 50, 0xA855F7, 2, 0.6, { gravity: 20 });
      }
      this.spawnDamageNumber(x * TILE + TILE/2, y * TILE + TILE/2, `+RISK`, 0xA855F7);
      return;
    }
    // Cursed floor — healing disabled
    if (isFloorHealDisabled()) {
      state.dungeon.map[y][x] = T.FLOOR;
      this.addLog('💀 Cursed floor — healing disabled!');
      showToast('Cursed Floor — No Healing!', 'warning', 1500, '💀');
      SFX.trap();
      return;
    }
    state.dungeon.map[y][x] = T.FLOOR;
    const heal = 20 + Math.floor(Math.random() * 15);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    this.addLog(`HEAL! +${heal} HP`);
    this.spawnDamageNumber(this.player.x, this.player.y, `+${heal}`, 0x34D399);
    SFX.heal();
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0x34D399, 0.4);
    flash.setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 4; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 30, -Math.random() * 40, 0x34D399, 0.7);
  }

  triggerPower(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    const roll = Math.random();
    if (roll < 0.35) { state.player.atk += 3; this.addLog('Power Up! +3 ATK'); }
    else if (roll < 0.65) { state.player.def += 2; this.addLog('Defense Up! +2 DEF'); }
    else if (roll < 0.85) { state.player.gold += 25; this.addLog('Gold Get! +25 Gold'); }
    else { state.player.maxHp += 15; state.player.hp = Math.min(state.player.hp + 15, state.player.maxHp); this.addLog('Health Up! +15 Max HP'); }
    SFX.power();
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xFBBF24, 0.4);
    flash.setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 6; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 50, -Math.random() * 50, 0xFBBF24, 0.8);
  }

  triggerChest(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    const cm = getCommunityMultiplier();
    const rm = getRiskMultiplier();
    const lootTable = ['health_potion', 'bomb', 'atk_gem', 'def_gem', 'shield_item', 'speed_boots', 'mega_potion', 'compass'];
    const goldAmount = Math.floor((15 + Math.floor(Math.random() * 25) + state.depth * 8) * cm * rm * (1 + state.depth * 0.1));
    state.player.gold += goldAmount;

    if (Math.random() < 0.6 * cm) {
      const itemId = lootTable[Math.floor(Math.random() * lootTable.length)];
      addToInventory(itemId);
    } else {
      this.addLog(`Found ${goldAmount} gold!`);
    }
    SFX.chest();
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xFBBF24, 0.5);
    flash.setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    for (let i = 0; i < 8; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 60, -Math.random() * 60, 0xFBBF24, 0.9);
  }

  triggerLockedChest(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    const cm = getCommunityMultiplier();
    // Community locked chests have 2x better loot
    const lootTable = ['mega_potion', 'compass', 'atk_gem', 'def_gem', 'shield_item', 'speed_boots', 'bomb', 'health_potion'];
    const goldAmount = Math.floor((30 + Math.floor(Math.random() * 50) + state.depth * 15) * cm * (1 + state.depth * 0.15));
    state.player.gold += goldAmount;

    // Always drop an item from community chest
    const itemId = lootTable[Math.floor(Math.random() * lootTable.length)];
    addToInventory(itemId);
    this.addLog(`Community chest opened! +${goldAmount}G, +${ITEMS[itemId].name}`);

    SFX.chest();
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xFFD700, 0.7);
    flash.setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 800, onComplete: () => flash.destroy() });
    for (let i = 0; i < 12; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 80, -Math.random() * 80, 0xFFD700, 1);
  }

  // ─── BOSS AI ────────────────────────────────────────────────
  updateBossAI(boss, dx, dy, dist, time, dt) {
    const spd = boss.getData('speed');
    const bossData = BOSSES.find(b => b.name === boss.getData('name'));
    const abilityCooldown = boss.getData('abilityCooldown') || 0;
    const attackPattern = boss.getData('attackPattern') || 0;

    // Update cooldown
    if (abilityCooldown > 0) boss.setData('abilityCooldown', abilityCooldown - dt);

    // Update boss HP bar in UI
    this.updateBossHPBar(boss);

    // Pulsing scale effect
    const pulseScale = 1 + Math.sin(time * 0.004) * 0.08;
    boss.setScale(pulseScale);

    // Phase 1: Chase + special attacks
    if (dist < 200) {
      // Chase player
      const angle = Math.atan2(dy, dx);
      boss.body.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);

      // Special attack when off cooldown
      if (abilityCooldown <= 0) {
        const pattern = (attackPattern + 1) % 4;
        boss.setData('attackPattern', pattern);
        boss.setData('abilityCooldown', 2.5);

        switch (bossData.name) {
          case 'The Thread Wraith':
            // Fire 3 projectiles in a spread
            for (let i = -1; i <= 1; i++) {
              const a = angle + i * 0.4;
              this.bossFireProjectile(boss.x, boss.y, a, 0xEF4444, 180, 15);
            }
            SFX.shoot();
            break;

          case 'Hydra of Forgotten Replies':
            if (pattern < 2) {
              // Ring of projectiles
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                this.bossFireProjectile(boss.x, boss.y, a, 0xA855F7, 120, 12);
              }
              SFX.monsterGrowl();
            } else {
              // Charge at player
              boss.body.setVelocity(Math.cos(angle) * spd * 3, Math.sin(angle) * spd * 3);
              this.time.delayedCall(400, () => {
                if (boss.active) boss.body.setVelocity(Math.cos(angle) * spd, Math.sin(angle) * spd);
              });
              SFX.jumpscare();
            }
            break;

          case 'The Original Poster':
            if (pattern === 0) {
              // Spiral of projectiles
              for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                this.time.delayedCall(i * 50, () => {
                  if (boss.active) this.bossFireProjectile(boss.x, boss.y, a, 0xFBBF24, 150, 18);
                });
              }
              SFX.jumpscare();
            } else if (pattern === 1) {
              // Summon 2 minions
              for (let i = 0; i < 2; i++) {
                const ma = Math.random() * Math.PI * 2;
                const mx = boss.x + Math.cos(ma) * 60;
                const my = boss.y + Math.sin(ma) * 60;
                const tx = Math.floor(mx / TILE), ty = Math.floor(my / TILE);
                if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H && !SOLID_TILES.has(state.dungeon.map[ty][tx])) {
                  this.spawnMonsterAt(tx, ty);
                }
              }
              this.addLog('The Original Poster summons minions!');
              SFX.monsterGrowl();
            } else {
              // Slam — area damage
              this.damagePlayer(bossData.damage * 1.5);
              for (let i = 0; i < 12; i++) {
                this.spawnParticle(boss.x, boss.y, (Math.random()-0.5)*120, (Math.random()-0.5)*120, 0xFBBF24, 0.9);
              }
              this.screenShake = 10;
              SFX.jumpscare();
            }
            break;
        }
      }
    } else if (dist < 350) {
      // Patrol around the room
      const patrolAngle = time * 0.001 + boss.getData('offset');
      boss.body.setVelocity(Math.cos(patrolAngle) * spd * 0.5, Math.sin(patrolAngle) * spd * 0.5);
    } else {
      // Move toward player slowly
      const angle = Math.atan2(dy, dx);
      boss.body.setVelocity(Math.cos(angle) * spd * 0.3, Math.sin(angle) * spd * 0.3);
    }

    // Melee damage
    if (dist < 30 && state.player.invincible <= 0) {
      this.damagePlayer(boss.getData('damage'));
    }
  }

  bossFireProjectile(x, y, angle, color, speed, damage) {
    // Warning indicator — larger, brighter dot with pulse effect
    const warnX = x + Math.cos(angle) * 20;
    const warnY = y + Math.sin(angle) * 20;
    const warning = this.add.circle(warnX, warnY, 5, color, 0.9);
    warning.setDepth(9);
    // Pulsing ring around the warning
    const ring = this.add.circle(warnX, warnY, 8, color, 0.4);
    ring.setDepth(8);
    // Warning sound — soft two-tone ping
    playSound(660, 0.1, 'sine', 0.04);
    playSound(880, 0.12, 'sine', 0.03);
    // Blink the warning dot rapidly
    this.tweens.add({ targets: warning, alpha: 0.2, duration: 60, yoyo: true, repeat: 3 });
    // Pulse the ring outward
    this.tweens.add({ targets: ring, scaleX: 2, scaleY: 2, alpha: 0, duration: 200, ease: 'Quad.easeOut' });
    this.time.delayedCall(250, () => {
      if (warning.active) warning.destroy();
      if (ring.active) ring.destroy();
      // Fire the actual projectile (slightly slower for dodgeability)
      const bullet = this.add.circle(x, y, 4, color, 0.9);
      bullet.setDepth(8);
      this.physics.world.enable(bullet);
      bullet.body.setAllowGravity(false);
      bullet.body.setVelocity(Math.cos(angle) * speed * 0.8, Math.sin(angle) * speed * 0.8);
      this.time.delayedCall(3000, () => { if (bullet.active) bullet.destroy(); });
      this.physics.add.overlap(bullet, this.player, () => {
        if (state.player.invincible <= 0) {
          this.damagePlayer(damage);
          bullet.destroy();
        }
      });
      this.physics.add.collider(bullet, this.walls, () => bullet.destroy());
    });
  }

  updateBossHPBar(boss) {
    const hpFill = boss.getData('hpFill');
    const hp = Math.max(0, boss.getData('hp'));
    const maxHp = boss.getData('maxHp');

    // If boss is dead (hp <= 0), hide the health bar
    if (hp <= 0) {
      if (hpFill && hpFill.active) {
        hpFill.setScale(0, 1);
      }
      const bossHP = document.getElementById('boss-hp-fill');
      const bossHPText = document.getElementById('boss-hp-text');
      const bossBar = document.getElementById('boss-health-bar');
      if (bossBar) bossBar.style.display = 'none';
      if (bossHP) bossHP.style.width = '0%';
      if (bossHPText) bossHPText.textContent = '0/0';
      return;
    }

    if (hpFill && hpFill.active) {
      const ratio = Math.max(0, hp / maxHp);
      hpFill.setScale(ratio, 1);
      if (ratio > 0.5) hpFill.setFillStyle(0xEF4444, 0.8);
      else if (ratio > 0.25) hpFill.setFillStyle(0xFBBF24, 0.8);
      else hpFill.setFillStyle(0xFF0000, 0.9);
    }

    // Update HTML boss health bar
    const bossHP = document.getElementById('boss-hp-fill');
    const bossHPText = document.getElementById('boss-hp-text');
    const bossBar = document.getElementById('boss-health-bar');
    if (bossBar) bossBar.style.display = 'block';
    if (bossHP) bossHP.style.width = `${(hp / maxHp) * 100}%`;
    if (bossHPText) bossHPText.textContent = `${hp}/${maxHp}`;
  }

  // ─── SHARED MONSTER SPRITE DRAWING ────────────────────────
  drawMonsterSprite(g, typeIdx) {
    g.clear();
    const ps = 1;

    if (typeIdx === 0) {
      // Shadow Crawler — dark amorphous blob with glowing eyes
      g.fillStyle(0x1A0A1A, 0.9);
      g.fillRect(3*ps, 4*ps, 10*ps, 8*ps);
      g.fillRect(2*ps, 6*ps, 12*ps, 4*ps);
      g.fillRect(4*ps, 3*ps, 8*ps, 2*ps);
      g.fillRect(1*ps, 8*ps, 2*ps, 3*ps);
      g.fillRect(13*ps, 7*ps, 2*ps, 4*ps);
      g.fillRect(0*ps, 10*ps, 2*ps, 2*ps);
      g.fillRect(14*ps, 9*ps, 2*ps, 3*ps);
      g.fillStyle(0xFF0000, 0.9);
      g.fillRect(5*ps, 6*ps, 2*ps, 2*ps);
      g.fillRect(9*ps, 6*ps, 2*ps, 2*ps);
      g.fillStyle(0xFF4444, 0.4);
      g.fillRect(5*ps, 5*ps, 2*ps, 1*ps);
      g.fillRect(9*ps, 5*ps, 2*ps, 1*ps);
      g.fillStyle(0xFF0000, 0.3);
      g.fillRect(6*ps, 9*ps, 4*ps, 2*ps);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(7*ps, 10*ps, 2*ps, 1*ps);
    } else if (typeIdx === 1) {
      // Lost Soul — ghostly floating figure
      g.fillStyle(0x8888AA, 0.5);
      g.fillRect(5*ps, 1*ps, 6*ps, 4*ps);
      g.fillRect(4*ps, 3*ps, 8*ps, 6*ps);
      g.fillRect(3*ps, 5*ps, 10*ps, 4*ps);
      g.fillRect(3*ps, 9*ps, 3*ps, 4*ps);
      g.fillRect(7*ps, 10*ps, 2*ps, 3*ps);
      g.fillRect(10*ps, 9*ps, 3*ps, 4*ps);
      g.fillStyle(0x000000, 0.9);
      g.fillRect(5*ps, 3*ps, 3*ps, 3*ps);
      g.fillRect(9*ps, 3*ps, 3*ps, 3*ps);
      g.fillStyle(0x4444FF, 0.3);
      g.fillRect(6*ps, 4*ps, 1*ps, 1*ps);
      g.fillRect(10*ps, 4*ps, 1*ps, 1*ps);
      g.fillStyle(0x000000, 0.8);
      g.fillRect(7*ps, 7*ps, 3*ps, 2*ps);
      g.fillStyle(0xAAAACC, 0.2);
      g.fillRect(5*ps, 2*ps, 2*ps, 2*ps);
    } else if (typeIdx === 2) {
      // Flesh Golem — hulking mass with exposed bone
      g.fillStyle(0x8B4040, 0.9);
      g.fillRect(3*ps, 3*ps, 10*ps, 10*ps);
      g.fillRect(2*ps, 5*ps, 12*ps, 6*ps);
      g.fillRect(1*ps, 7*ps, 14*ps, 4*ps);
      g.fillStyle(0xAA5050, 0.6);
      g.fillRect(4*ps, 4*ps, 3*ps, 3*ps);
      g.fillRect(9*ps, 6*ps, 3*ps, 2*ps);
      g.fillRect(5*ps, 9*ps, 4*ps, 2*ps);
      g.fillStyle(0xD4C5B0, 0.7);
      g.fillRect(7*ps, 5*ps, 2*ps, 4*ps);
      g.fillRect(11*ps, 7*ps, 2*ps, 3*ps);
      g.fillStyle(0x281808, 0.6);
      g.fillRect(6*ps, 7*ps, 4*ps, 1*ps);
      g.fillRect(6*ps, 9*ps, 4*ps, 1*ps);
      g.fillRect(7*ps, 7*ps, 1*ps, 3*ps);
      g.fillRect(9*ps, 7*ps, 1*ps, 3*ps);
      g.fillStyle(0xFFFF00, 0.8);
      g.fillRect(4*ps, 4*ps, 3*ps, 2*ps);
      g.fillRect(10*ps, 5*ps, 2*ps, 2*ps);
      g.fillStyle(0x000000, 0.9);
      g.fillRect(5*ps, 4*ps, 1*ps, 2*ps);
      g.fillRect(10*ps, 5*ps, 1*ps, 2*ps);
    } else if (typeIdx === 3) {
      // Void Stalker — tall dark figure with purple glow
      g.fillStyle(0x1A0A2A, 0.95);
      g.fillRect(6*ps, 0*ps, 4*ps, 3*ps);
      g.fillRect(5*ps, 3*ps, 6*ps, 8*ps);
      g.fillRect(4*ps, 5*ps, 8*ps, 4*ps);
      g.fillRect(3*ps, 7*ps, 10*ps, 5*ps);
      g.fillRect(2*ps, 10*ps, 12*ps, 3*ps);
      g.fillStyle(0x2A1A3A, 0.5);
      g.fillRect(6*ps, 4*ps, 4*ps, 6*ps);
      g.fillStyle(0xAA00FF, 0.9);
      g.fillRect(6*ps, 1*ps, 2*ps, 2*ps);
      g.fillRect(9*ps, 1*ps, 2*ps, 2*ps);
      g.fillStyle(0xDD44FF, 0.4);
      g.fillRect(6*ps, 0*ps, 2*ps, 1*ps);
      g.fillRect(9*ps, 0*ps, 2*ps, 1*ps);
      g.fillStyle(0x8800CC, 0.3);
      g.fillRect(2*ps, 11*ps, 2*ps, 2*ps);
      g.fillRect(12*ps, 12*ps, 2*ps, 1*ps);
    } else {
      // Bone Horror — skeletal with exposed ribcage
      g.fillStyle(0xD4C5B0, 0.9);
      g.fillRect(5*ps, 0*ps, 6*ps, 4*ps);
      g.fillRect(4*ps, 1*ps, 8*ps, 3*ps);
      g.fillStyle(0x000000, 0.9);
      g.fillRect(5*ps, 1*ps, 2*ps, 2*ps);
      g.fillRect(9*ps, 1*ps, 2*ps, 2*ps);
      g.fillStyle(0xFF0000, 0.4);
      g.fillRect(6*ps, 2*ps, 1*ps, 1*ps);
      g.fillRect(10*ps, 2*ps, 1*ps, 1*ps);
      g.fillStyle(0xB8A890, 0.8);
      g.fillRect(5*ps, 3*ps, 6*ps, 1*ps);
      g.fillStyle(0xFFFFFF, 0.7);
      g.fillRect(6*ps, 3*ps, 1*ps, 1*ps);
      g.fillRect(8*ps, 3*ps, 1*ps, 1*ps);
      g.fillRect(10*ps, 3*ps, 1*ps, 1*ps);
      g.fillStyle(0xD4C5B0, 0.8);
      g.fillRect(5*ps, 4*ps, 6*ps, 1*ps);
      g.fillRect(4*ps, 5*ps, 8*ps, 1*ps);
      g.fillRect(5*ps, 6*ps, 6*ps, 1*ps);
      g.fillRect(4*ps, 7*ps, 8*ps, 1*ps);
      g.fillRect(5*ps, 8*ps, 6*ps, 1*ps);
      g.fillRect(7*ps, 4*ps, 2*ps, 6*ps);
      g.fillRect(3*ps, 5*ps, 2*ps, 1*ps);
      g.fillRect(11*ps, 5*ps, 2*ps, 1*ps);
      g.fillRect(2*ps, 6*ps, 2*ps, 1*ps);
      g.fillRect(12*ps, 6*ps, 2*ps, 1*ps);
      g.fillRect(1*ps, 7*ps, 2*ps, 1*ps);
      g.fillRect(13*ps, 7*ps, 2*ps, 1*ps);
      g.fillRect(5*ps, 9*ps, 2*ps, 4*ps);
      g.fillRect(9*ps, 9*ps, 2*ps, 4*ps);
      g.fillRect(4*ps, 13*ps, 3*ps, 1*ps);
      g.fillRect(9*ps, 13*ps, 3*ps, 1*ps);
      g.fillStyle(0x8A7A6A, 0.4);
      g.fillRect(4*ps, 0*ps, 1*ps, 4*ps);
      g.fillRect(11*ps, 0*ps, 1*ps, 4*ps);
    }

    g.setPosition(-8, -8);
  }

  // ─── SHARED MONSTER SETUP ──────────────────────────────────
  setupMonster(monster, body, type, typeIdx, hp, speed, damage) {
    body.setPosition(-8, -8);
    monster.add(body);

    const hpBg = this.add.rectangle(0, -12, 14, 2, 0x000000, 0.5);
    const hpFill = this.add.rectangle(0, -12, 14, 2, 0xEF4444, 0.8);
    hpFill.setOrigin(0.5);
    monster.add(hpBg);
    monster.add(hpFill);
    monster.setData('hpFill', hpFill);

    monster.setSize(12, 12);
    monster.setData('hp', hp);
    monster.setData('maxHp', hp);
    monster.setData('speed', speed);
    monster.setData('damage', damage);
    monster.setData('offset', Math.random() * Math.PI * 2);
    monster.setData('name', type.name);
    monster.setData('behavior', type.behavior);
    monster.setData('charging', false);
    monster.setData('chargeCooldown', 0);
    monster.setDepth(8);

    this.physics.world.enable(monster);
    monster.body.setCollideWorldBounds(true);
    monster.body.setOffset(-6, -6);
    this.physics.add.collider(monster, this.walls);
    this.monsters.push(monster);
  }

  spawnMonster() {
    // Retry up to 20 times to find a valid spawn
    let x, y, tries = 0;
    do {
      x = 3 + Math.floor(Math.random() * (MAP_W - 6));
      y = 3 + Math.floor(Math.random() * (MAP_H - 6));
      tries++;
    } while (SOLID_TILES.has(state.dungeon.map[y][x]) && tries < 20);
    if (SOLID_TILES.has(state.dungeon.map[y][x])) return;

    const monsterTypes = [
      { name: 'Shadow Crawler', color: 0x4A2A4A, hp: 25, speed: 40, damage: 8, behavior: 'flank' },
      { name: 'Lost Soul', color: 0x3A3A5A, hp: 30, speed: 45, damage: 10, behavior: 'phase' },
      { name: 'Flesh Golem', color: 0x5A2A2A, hp: 40, speed: 35, damage: 14, behavior: 'charge' },
      { name: 'Void Stalker', color: 0x2A1A3A, hp: 50, speed: 50, damage: 18, behavior: 'teleport' },
      { name: 'Bone Horror', color: 0x6A5A3A, hp: 65, speed: 45, damage: 22, behavior: 'ranged' },
    ];
    const typeIdx = Math.min(Math.floor(state.depth / 2), monsterTypes.length - 1);
    const type = monsterTypes[typeIdx];

    const monster = this.add.container(x * TILE + TILE/2, y * TILE + TILE/2);
    const body = this.add.graphics();
    this.drawMonsterSprite(body, typeIdx);
    // Aggressive floor scaling: HP doubles every 3 floors, ATK scales faster
    const floorScale = Math.pow(1.35, state.depth);
    this.setupMonster(monster, body, type, typeIdx,
      Math.floor(type.hp * floorScale),
      type.speed + state.depth * 4,
      Math.floor(type.damage * (1 + state.depth * 0.18))
    );
    state.floorEnemiesTotal++;
  }

  spawnMonsterAt(tileX, tileY) {
    const monsterTypes = [
      { name: 'Shadow Crawler', color: 0x4A2A4A, hp: 25, speed: 40, damage: 8, behavior: 'flank' },
      { name: 'Lost Soul', color: 0x3A3A5A, hp: 30, speed: 45, damage: 10, behavior: 'phase' },
      { name: 'Flesh Golem', color: 0x5A2A2A, hp: 40, speed: 35, damage: 14, behavior: 'charge' },
      { name: 'Void Stalker', color: 0x2A1A3A, hp: 50, speed: 50, damage: 18, behavior: 'teleport' },
      { name: 'Bone Horror', color: 0x6A5A3A, hp: 65, speed: 45, damage: 22, behavior: 'ranged' },
    ];
    const typeIdx = Math.min(Math.floor(state.depth / 2), monsterTypes.length - 1);
    const type = monsterTypes[typeIdx];

    const monster = this.add.container(tileX * TILE + TILE/2, tileY * TILE + TILE/2);
    const body = this.add.graphics();
    this.drawMonsterSprite(body, typeIdx);
    const floorScale = Math.pow(1.35, state.depth);
    this.setupMonster(monster, body, type, typeIdx,
      Math.floor(type.hp * floorScale),
      type.speed + state.depth * 4 + 10,
      Math.floor(type.damage * (1 + state.depth * 0.18))
    );
    state.floorEnemiesTotal++;
  }

  spawnWaveEnemy() {
    if (!this.player || !state.dungeon || !state.dungeon.map) return;
    // Spawn near the player but not too close
    let x, y, tries = 0;
    do {
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      x = Math.floor((this.player.x + Math.cos(angle) * dist) / TILE);
      y = Math.floor((this.player.y + Math.sin(angle) * dist) / TILE);
      tries++;
    } while ((SOLID_TILES.has(state.dungeon.map[y]?.[x]) || x < 3 || x >= MAP_W - 3 || y < 3 || y >= MAP_H - 3) && tries < 20);
    if (tries >= 20) return;

    const monsterTypes = [
      { name: 'Shadow Crawler', color: 0x4A2A4A, hp: 25, speed: 40, damage: 8, behavior: 'flank' },
      { name: 'Lost Soul', color: 0x3A3A5A, hp: 30, speed: 45, damage: 10, behavior: 'phase' },
      { name: 'Flesh Golem', color: 0x5A2A2A, hp: 40, speed: 35, damage: 14, behavior: 'charge' },
      { name: 'Void Stalker', color: 0x2A1A3A, hp: 50, speed: 50, damage: 18, behavior: 'teleport' },
      { name: 'Bone Horror', color: 0x6A5A3A, hp: 65, speed: 45, damage: 22, behavior: 'ranged' },
    ];
    const typeIdx = Math.min(Math.floor(state.depth / 2), monsterTypes.length - 1);
    const type = monsterTypes[typeIdx];

    const monster = this.add.container(x * TILE + TILE/2, y * TILE + TILE/2);
    const body = this.add.graphics();
    this.drawMonsterSprite(body, typeIdx);
    const floorScale = Math.pow(1.35, state.depth);
    const waveMult = state.waveStrength;
    this.setupMonster(monster, body, type, typeIdx,
      Math.floor(type.hp * floorScale * waveMult),
      type.speed + state.depth * 4 + 10,
      Math.floor(type.damage * (1 + state.depth * 0.18) * waveMult)
    );
    state.floorEnemiesTotal++;
    // Red spawn flash
    for (let i = 0; i < 6; i++) {
      this.particles.get(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random()-0.5)*40, -Math.random()*30, 0xEF4444, 2, 0.3);
    }
  }

  spawnBoss(bossData) {
    const dungeon = state.dungeon;
    if (!dungeon || !dungeon.rooms || dungeon.rooms.length === 0) return;
    let bestRoom = null;
    let bestArea = 0;
    dungeon.rooms.forEach(room => {
      const area = room.w * room.h;
      if (area > bestArea) { bestArea = area; bestRoom = room; }
    });
    if (!bestRoom) return;

    const bx = (bestRoom.x + Math.floor(bestRoom.w / 2)) * TILE + TILE / 2;
    const by = (bestRoom.y + Math.floor(bestRoom.h / 2)) * TILE + TILE / 2;

    const monster = this.add.container(bx, by);
    const body = this.add.graphics();
    const mc = bossData.color;
    const rv = (mc >> 16) & 0xff, gv = (mc >> 8) & 0xff, bv = mc & 0xff;
    const dark = Phaser.Display.Color.GetColor(Math.max(0, rv - 40), Math.max(0, gv - 40), Math.max(0, bv - 40));
    const light = Phaser.Display.Color.GetColor(Math.min(255, rv + 50), Math.min(255, gv + 50), Math.min(255, bv + 50));

    const s = bossData.size || 20;
    // Boss scaling per floor
    const bossScale = Math.pow(1.3, state.depth);
    const scaledBossHp = Math.floor(bossData.hp * bossScale);
    const scaledBossDmg = Math.floor(bossData.damage * (1 + state.depth * 0.15));
    body.fillStyle(mc, 0.9);
    body.fillRect(-s/2, -s/2, s, s);
    body.fillRect(-s/2 - 3, -s/2 + 4, s + 6, s - 8);
    body.fillStyle(light, 0.5);
    body.fillRect(-s/2 + 2, -s/2 + 2, s/2, s/3);
    body.fillStyle(dark, 0.4);
    body.fillRect(-s/2, s/2 - 4, s, 4);
    body.fillStyle(0xFF0000, 0.9);
    body.fillRect(-s/4, -s/4, 4, 4);
    body.fillRect(s/4 - 4, -s/4, 4, 4);
    body.fillStyle(0xFBBF24, 0.8);
    body.fillRect(-s/2 + 2, -s/2 - 4, 4, 4);
    body.fillRect(s/2 - 6, -s/2 - 4, 4, 4);
    body.fillRect(0, -s/2 - 6, 4, 6);
    monster.add(body);

    const hpBg = this.add.rectangle(0, -s/2 - 10, s + 10, 3, 0x000000, 0.5);
    const hpFill = this.add.rectangle(0, -s/2 - 10, s + 10, 3, 0xEF4444, 0.8);
    hpFill.setOrigin(0.5);
    monster.add(hpBg);
    monster.add(hpFill);
    monster.setData('hpFill', hpFill);

    const nameTag = this.add.text(0, -s/2 - 16, bossData.name, {
      fontFamily: 'Press Start 2P', fontSize: '6px', color: '#E83838',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    monster.add(nameTag);

    monster.setSize(s, s);
    monster.setData('hp', scaledBossHp);
    monster.setData('maxHp', scaledBossHp);
    monster.setData('speed', bossData.speed);
    monster.setData('damage', scaledBossDmg);
    monster.setData('offset', Math.random() * Math.PI * 2);
    monster.setData('name', bossData.name);
    monster.setData('isBoss', true);
    monster.setDepth(8);

    this.physics.world.enable(monster);
    monster.body.setCollideWorldBounds(true);
    monster.body.setOffset(-s/2, -s/2);
    this.physics.add.collider(monster, this.walls);
    this.monsters.push(monster);

    // Boss intro cinematic
    if (this.screenFX) {
      this.screenFX.shake(15);
      this.screenFX.flash(0xEF4444, 300);
    }
    SFX.jumpscare();
    this.addLog(`⚠ BOSS: ${bossData.name} appeared!`);

    // Show boss intro overlay
    const bossIntro = document.getElementById('boss-intro');
    const bossName = document.getElementById('boss-intro-name');
    const bossTitle = document.getElementById('boss-intro-title');
    if (bossIntro && bossName && bossTitle) {
      bossName.textContent = bossData.name;
      bossTitle.textContent = `Floor ${state.depth + 1} Boss`;
      bossIntro.classList.add('show');
      // Pause game during intro
      this.physics.pause();
      setTimeout(() => {
        bossIntro.classList.remove('show');
        this.physics.resume();
      }, 2500);
    }

    // Dramatic particles during intro
    for (let i = 0; i < 30; i++) {
      this.time.delayedCall(i * 50, () => {
        this.particles.get(bx + (Math.random()-0.5)*100, by + (Math.random()-0.5)*100,
          (Math.random()-0.5)*80, -30 - Math.random()*60, 0xEF4444, 3, 0.8, { gravity: 30 });
      });
    }
  }

  spawnParticle(x, y, vx, vy, color, alpha) {
    // Legacy wrapper — routes to particle pool
    this.particles.get(x, y, vx, vy, color, 2, 0.4, { alpha: alpha || 1, gravity: 0 });
  }

  spawnDamageNumber(x, y, text, color = 0xFFFFFF) {
    const txt = this.add.text(x, y - 8, text, {
      fontFamily: 'Press Start 2P', fontSize: '6px', color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({
      targets: txt, y: y - 24, alpha: 0, duration: 800,
      onComplete: () => txt.destroy(),
    });
  }

  nextFloor() {
    if (this.transitioning) return;
    this.transitioning = true;

    // Untouchable achievement check
    if (floorDamageTaken === 0 && state.depth > 0) {
      if (!unlockedAchievements.has('no_damage_floor')) {
        unlockedAchievements.add('no_damage_floor');
        this.addLog('🏆 Achievement: Untouchable!');
        SFX.levelup();
      }
    }

    // Greed bonus: clear all enemies for extra gold
    if (state.floorEnemiesTotal > 0 && state.floorEnemiesKilled >= state.floorEnemiesTotal) {
      const greedBonus = Math.floor((50 + state.depth * 30) * getCommunityMultiplier());
      persistentGold += greedBonus;
      state.player.gold += greedBonus;
      this.addLog(`💰 GREED BONUS! Cleared all enemies! +${greedBonus}G`);
      showToast(`GREED BONUS! +${greedBonus}G`, 'legendary', 3000, '💰');
      SFX.levelup();
      for (let i = 0; i < 20; i++) {
        this.particles.get(this.player.x, this.player.y, (Math.random()-0.5)*120, -40 - Math.random()*80, 0xF8B800, 3, 0.8, { gravity: 40 });
      }
    }
    // Save gold to persistent storage
    persistentGold += state.player.gold;
    savePersistentData();

    state.depth++;
    state.floorTheme = (state.floorTheme + 1) % THEMES.length;
    floorDamageTaken = 0;
    state.floorEnemiesTotal = 0;
    state.floorEnemiesKilled = 0;
    state.floorModifier = rollFloorModifier();
    applyFloorModifier(state.floorModifier);
    resetCombo();
    checkMerchantSpawn();
    // Floor pressure: timer + exit lock + waves
    state.floorTimerMax = Math.max(45, 90 - state.depth * 5); // 90s at floor 0, down to 45s min
    state.floorTimer = state.floorTimerMax;
    state.collapsing = false;
    state.exitLocked = true;
    state.waveNumber = 0;
    state.waveTimer = state.waveInterval;
    state.waveStrength = 1;
    SFX.exit();

    // Floor clear celebration
    this.addLog(`✨ Floor ${state.depth} cleared!`);

    if (state.depth >= state.totalFloors) {
      state.phase = 'victory';
      persistentGold += 100; // bonus for clearing
      if (!state.bossRushMode) {
        state.bossRushUnlocked = true;
        savePersistentData();
        updateBossRushButton();
      }
      savePersistentData();
      checkAchievements();
      document.getElementById('gameover-screen').classList.add('show');
      document.getElementById('go-title').textContent = 'VICTORY!';
      document.getElementById('go-title').style.color = '#F8D838';
      document.getElementById('go-stats').innerHTML = `
        All ${state.totalFloors} Floors Cleared!<br>
        Kills: ${state.kills}<br>
        Gold: ${state.player.gold}<br>
        Level: ${state.player.level} (${state.player.title})<br>
        Max Combo: ${combo.maxCombo}x<br>
        Achievements: ${unlockedAchievements.size}/${ACHIEVEMENTS.length}<br>
        ${state.commentCount > 0 ? `Community: ${state.commentCount} comments (${getCommunityMultiplier().toFixed(1)}x)` : ''}
      `;
      return;
    }

    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    state.visited.clear();
    const nextTheme = THEMES[state.floorTheme % THEMES.length];
    this.addLog(`Descending to floor ${state.depth + 1}...`);
    showToast(`Floor ${state.depth} cleared!`, 'success', 2000, '✨');
    showLoading(() => this.scene.restart());
  }

  getTitle(level) {
    if (level >= 20) return 'Pokemon Master';
    if (level >= 15) return 'Elite Four';
    if (level >= 10) return 'Gym Leader';
    if (level >= 7) return 'Ace Trainer';
    if (level >= 5) return 'Hiker';
    if (level >= 3) return 'Bug Catcher';
    return 'Youngster';
  }

  addLog(text) {
    state.log.push(text);
    if (state.log.length > 20) state.log.shift();
  }

  updateUI() {
    if (!state || !state.player) return;
    const p = state.player;
    const hpBar = document.getElementById('hp-fill');
    const goldText = document.getElementById('hud-gold');
    const levelText = document.getElementById('hud-level');
    const floorText = document.getElementById('hud-floor');
    const depthText = document.getElementById('depth-text');
    const logEl = document.getElementById('game-log');

    if (hpBar) {
      hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
      // Low HP pulse animation
      if (p.hp / p.maxHp < 0.25) {
        hpBar.classList.add('low');
      } else {
        hpBar.classList.remove('low');
      }
    }
    const xpBar = document.getElementById('xp-fill');
    if (xpBar) xpBar.style.width = `${(p.xp / p.xpNext) * 100}%`;
    if (goldText) goldText.textContent = `G:${p.gold}`;
    if (levelText) levelText.textContent = `Lv${p.level}`;
    if (floorText) floorText.textContent = `F${state.depth + 1}`;
    if (depthText) depthText.textContent = `F${state.depth + 1} / ${state.totalFloors}`;

    // Update depth pips
    const pips = document.querySelectorAll('.gb-depth-pip');
    pips.forEach((pip, i) => {
      pip.className = 'gb-depth-pip';
      if (i < state.depth) pip.classList.add('visited');
      if (i === state.depth) pip.classList.add('active');
    });

    if (logEl) {
      logEl.innerHTML = state.log.slice(-4).map(l => `<div class="log-entry">${l}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    // Combo display with pulse animation + multiplier glow
    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
      if (combo.count >= 3) {
        const multText = combo.multiplier > 1 ? ` (${combo.multiplier}x)` : '';
        comboEl.textContent = `${combo.count}x COMBO${multText}`;
        comboEl.style.display = 'block';
        comboEl.style.color = combo.count >= 12 ? '#F8D838' : combo.count >= 5 ? '#E87898' : '#A882F7';
        // Trigger pulse animation
        comboEl.classList.remove('pulse');
        void comboEl.offsetWidth; // force reflow
        comboEl.classList.add('pulse');
        // Scale up text size at high combos
        comboEl.style.fontSize = combo.count >= 12 ? '16px' : combo.count >= 8 ? '14px' : '12px';
      } else {
        comboEl.style.display = 'none';
      }
    }

    // Weapon display
    const weaponEl = document.getElementById('weapon-display');
    if (weaponEl) {
      if (state.player.weapon) {
        weaponEl.textContent = `${state.player.weapon.icon} ${state.player.weapon.name}`;
        weaponEl.style.display = 'block';
      } else {
        weaponEl.style.display = 'none';
      }
    }

    // Sync sidebar
    if (typeof syncSidebarInventory === 'function') syncSidebarInventory();
    if (typeof syncSidebarLog === 'function') syncSidebarLog();

    // Greed counter — show remaining enemies
    const greedEl = document.getElementById('greed-display');
    if (greedEl) {
      const remaining = state.floorEnemiesTotal - state.floorEnemiesKilled;
      if (state.floorEnemiesTotal > 0 && remaining > 0) {
        greedEl.textContent = `☠ ${state.floorEnemiesKilled}/${state.floorEnemiesTotal}`;
        greedEl.style.display = 'block';
        // Color shifts from gray to gold as you kill more
        const progress = state.floorEnemiesKilled / state.floorEnemiesTotal;
        if (progress >= 0.8) greedEl.style.color = '#F8B800';
        else if (progress >= 0.5) greedEl.style.color = '#A882F7';
        else greedEl.style.color = '#888868';
      } else if (state.floorEnemiesTotal > 0 && remaining === 0) {
        greedEl.textContent = '💰 GREED!';
        greedEl.style.display = 'block';
        greedEl.style.color = '#F8B800';
      } else {
        greedEl.style.display = 'none';
      }
    }

    // Floor modifier display
    const modEl = document.getElementById('floor-mod-display');
    if (modEl) {
      if (state.floorModifier) {
        modEl.textContent = `${state.floorModifier.icon} ${state.floorModifier.name}`;
        modEl.style.display = 'block';
        modEl.style.color = state.floorModifier.color;
      } else {
        modEl.style.display = 'none';
      }
    }

    // Risk token display
    const riskEl = document.getElementById('risk-display');
    if (riskEl) {
      if (state.riskTokens > 0) {
        riskEl.textContent = `⚡ ${state.riskTokens} Risk (${Math.round((state.riskMultiplier-1)*100)}%)`;
        riskEl.style.display = 'block';
      } else {
        riskEl.style.display = 'none';
      }
    }

    // Synergy display
    const synEl = document.getElementById('synergy-display');
    if (synEl) {
      const syns = state.synergies || [];
      if (syns.length > 0) {
        synEl.textContent = `⚡ ${syns.length} Synergy${syns.length > 1 ? 's' : ''}`;
        synEl.style.display = 'block';
      } else {
        synEl.style.display = 'none';
      }
    }

    // Temp buffs display
    const buffEl = document.getElementById('temp-buffs-display');
    if (buffEl) {
      const buffs = state.tempBuffs || [];
      if (buffs.length > 0) {
        buffEl.innerHTML = buffs.map(b => {
          const timeLeft = Math.ceil(b.remaining);
          return `<span style="color:${b.type === 'atk' ? '#EF4444' : b.type === 'def' ? '#3B82F6' : '#FBBF24'}">${b.name} (${timeLeft}s)</span>`;
        }).join(' ');
        buffEl.style.display = 'block';
      } else {
        buffEl.style.display = 'none';
      }
    }

    // Floor timer display
    const timerEl = document.getElementById('floor-timer');
    if (timerEl && !state.bossRushMode) {
      const timeLeft = Math.max(0, Math.ceil(state.floorTimer));
      const pct = state.floorTimerMax > 0 ? state.floorTimer / state.floorTimerMax : 1;
      timerEl.style.display = 'block';
      if (state.collapsing) {
        timerEl.textContent = '💀 COLLAPSE!';
        timerEl.style.color = '#EF4444';
        timerEl.style.fontSize = '9px';
      } else if (pct <= 0.2) {
        timerEl.textContent = `⏰ ${timeLeft}s`;
        timerEl.style.color = '#EF4444';
        timerEl.style.fontSize = '8px';
      } else if (pct <= 0.5) {
        timerEl.textContent = `⏰ ${timeLeft}s`;
        timerEl.style.color = '#F8D838';
        timerEl.style.fontSize = '7px';
      } else {
        timerEl.textContent = `⏰ ${timeLeft}s`;
        timerEl.style.color = '#888868';
        timerEl.style.fontSize = '7px';
      }
    } else if (timerEl) {
      timerEl.style.display = 'none';
    }

    // Exit status display
    const exitEl = document.getElementById('exit-status');
    if (exitEl && !state.bossRushMode) {
      if (state.exitLocked && state.floorEnemiesTotal > 0) {
        const killPct = Math.floor((state.floorEnemiesKilled / state.floorEnemiesTotal) * 100);
        exitEl.textContent = `🚪 ${killPct}/70%`;
        exitEl.style.display = 'block';
        exitEl.style.color = killPct >= 60 ? '#F8D838' : '#E83838';
      } else if (!state.exitLocked) {
        exitEl.textContent = '🚪 READY';
        exitEl.style.display = 'block';
        exitEl.style.color = '#48C848';
      } else {
        exitEl.style.display = 'none';
      }
    } else if (exitEl) {
      exitEl.style.display = 'none';
    }

    // Wave display
    const waveEl = document.getElementById('wave-display');
    if (waveEl && !state.bossRushMode) {
      if (state.waveNumber > 0) {
        waveEl.textContent = `☠ Wave ${state.waveNumber}`;
        waveEl.style.display = 'block';
      } else {
        waveEl.style.display = 'none';
      }
    } else if (waveEl) {
      waveEl.style.display = 'none';
    }
  }
}

// ─── PHASER CONFIG ───────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 480,
  height: 340,
  backgroundColor: '#000000',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: 480,
    height: 340,
  },
  pixelArt: true,
  antialias: false,
};

let game = null;
let minimapVisible = true;
let gamePaused = false;

// ═══════════════════════════════════════════════════════════
// PARTICLE SYSTEM (object pool for performance)
// ═══════════════════════════════════════════════════════════
class ParticlePool {
  constructor(scene, maxParticles = 300) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.maxParticles = maxParticles;
  }

  get(x, y, vx, vy, color, size, life, opts = {}) {
    let p;
    if (this.pool.length > 0) {
      p = this.pool.pop();
      p.setPosition(x, y);
      p.setVisible(true);
      p.setAlpha(opts.alpha || 1);
      p.setScale(1);
    } else if (this.active.length < this.maxParticles) {
      p = this.scene.add.circle(0, 0, size || 2, color, opts.alpha || 1);
      p.setDepth(15);
    } else {
      return; // pool exhausted
    }
    p.setFillStyle(color, opts.alpha || 1);
    p.setRadius(size || 2);
    this.active.push({ gfx: p, vx, vy, life, maxLife: life, gravity: opts.gravity || 0, shrink: opts.shrink !== false, friction: opts.friction || 0.98, color });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.gfx.setVisible(false);
        this.pool.push(p.gfx);
        this.active.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      const lifeRatio = p.life / p.maxLife;
      if (p.shrink) p.gfx.setScale(lifeRatio);
      p.gfx.setAlpha(lifeRatio);
    }
  }

  clear() {
    this.active.forEach(p => { p.gfx.setVisible(false); this.pool.push(p.gfx); });
    this.active.length = 0;
  }
}

// ═══════════════════════════════════════════════════════════
// SCREEN EFFECTS MANAGER
// ═══════════════════════════════════════════════════════════
class ScreenFX {
  constructor(scene) {
    this.scene = scene;
    this.shakeIntensity = 0;
    this.shakeDecay = 10;
    this.freezeTimer = 0;
    this.chromaticAmount = 0;
    this.vignetteAlpha = 0;
  }

  shake(intensity) { this.shakeIntensity = Math.max(this.shakeIntensity, intensity); }

  freeze(duration) {
    this.freezeTimer = duration;
    this.scene.physics.pause();
    this.scene.time.delayedCall(duration * 1000, () => {
      this.scene.physics.resume();
      this.freezeTimer = 0;
    });
  }

  flash(color, duration) {
    const el = document.getElementById('screen-flash');
    if (!el) return;
    const hex = '#' + color.toString(16).padStart(6, '0');
    el.style.background = hex;
    el.style.opacity = '0.4';
    setTimeout(() => { el.style.opacity = '0'; }, duration || 100);
  }

  update(dt) {
    if (this.shakeIntensity > 0) {
      this.shakeIntensity -= this.shakeDecay * dt;
      if (this.shakeIntensity < 0) this.shakeIntensity = 0;
      const cam = this.scene.cameras.main;
      cam.setScroll(
        cam.scrollX + (Math.random() - 0.5) * this.shakeIntensity,
        cam.scrollY + (Math.random() - 0.5) * this.shakeIntensity
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════
function showToast(message, type = 'info', duration = 3000, icon = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icon ? `<span class="toast-icon">${icon}</span>` : ''}${message}`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ═══════════════════════════════════════════════════════════
// LOADING SCREEN WITH TIPS
// ═══════════════════════════════════════════════════════════
const LOADING_TIPS = [
  'Dodge roll with SHIFT to avoid damage with i-frames!',
  'Combo kills fast for massive XP multipliers!',
  'Compass items reveal the exit on your minimap!',
  'Bombs deal AoE damage — great for boss fights!',
  'Downvoted comments are traps. Upvoted ones heal you!',
  'Each floor has a unique theme and music!',
  'Secret rooms hide the best loot!',
  'Press P to pause, M to toggle minimap!',
  'Save gold between runs — spend it in the SHOP!',
  'Bosses appear on floors 3, 5, and 7!',
];

function showLoading(callback) {
  const el = document.getElementById('loading-screen');
  const fill = document.getElementById('loading-fill');
  const tip = document.getElementById('loading-tip');
  if (!el) { callback(); return; }
  tip.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  el.classList.add('show');
  let progress = 0;
  const interval = setInterval(() => {
    progress += 5 + Math.random() * 15;
    fill.style.width = Math.min(100, progress) + '%';
    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        el.classList.remove('show');
        fill.style.width = '0%';
        callback();
      }, 300);
    }
  }, 60);
}

// ═══════════════════════════════════════════════════════════
// LOOT RARITY SYSTEM
// ═══════════════════════════════════════════════════════════
const RARITY = {
  common:    { name: 'Common',    color: 0xAAAAAA, glow: 0x666666, mult: 1.0, chance: 0.50 },
  uncommon:  { name: 'Uncommon',  color: 0x34D399, glow: 0x10B981, mult: 1.3, chance: 0.25 },
  rare:      { name: 'Rare',      color: 0x3B82F6, glow: 0x2563EB, mult: 1.6, chance: 0.15 },
  epic:      { name: 'Epic',      color: 0xA855F7, glow: 0x9333EA, mult: 2.0, chance: 0.08 },
  legendary: { name: 'Legendary', color: 0xF8B800, glow: 0xD4A000, mult: 2.5, chance: 0.02 },
};

function rollRarity() {
  const r = Math.random();
  let cumulative = 0;
  for (const [key, rarity] of Object.entries(RARITY)) {
    cumulative += rarity.chance;
    if (r < cumulative) return key;
  }
  return 'common';
}

function getRarityColor(rarityKey) {
  return RARITY[rarityKey]?.color || 0xAAAAAA;
}

// ═══════════════════════════════════════════════════════════
// DODGE ROLL SYSTEM
// ═══════════════════════════════════════════════════════════
let dodgeState = { cooldown: 0, maxCooldown: 1.5, charges: 3, maxCharges: 3, rolling: false, rollTimer: 0, rollDuration: 0.25, rollSpeed: 2.5, regenTimer: 0, regenRate: 0.5 };

function updateDodge(dt) {
  if (dodgeState.rolling) {
    dodgeState.rollTimer -= dt;
    if (dodgeState.rollTimer <= 0) {
      dodgeState.rolling = false;
      state.player.invincible = 0;
    }
  }
  // Regen charges
  if (dodgeState.charges < dodgeState.maxCharges) {
    dodgeState.regenTimer += dt;
    if (dodgeState.regenTimer >= dodgeState.regenRate) {
      dodgeState.regenTimer = 0;
      dodgeState.charges = Math.min(dodgeState.maxCharges, dodgeState.charges + 1);
    }
  }
  // Update UI pips
  const pips = document.getElementById('dodge-pips');
  if (pips) {
    pips.innerHTML = Array.from({length: dodgeState.maxCharges}, (_, i) =>
      `<div class="dodge-pip ${i < dodgeState.charges ? '' : 'empty'}"></div>`
    ).join('');
  }
  const bar = document.getElementById('dodge-bar');
  if (bar) bar.style.display = state.phase === 'explore' ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════════════════
// ABILITY SYSTEM
// ═══════════════════════════════════════════════════════════
const ABILITIES = [
  { id: 'fireball', name: 'Fireball', icon: '🔥', key: '1', cd: 3, desc: 'Launch a piercing fireball',
    execute: (scene) => {
      const facing = scene.playerFacing;
      const b = scene.add.circle(scene.player.x, scene.player.y, 5, 0xFF6600);
      b.setDepth(8);
      scene.physics.world.enable(b);
      b.body.setAllowGravity(false);
      b.body.setSize(10, 10);
      b.body.setVelocity(facing.x * 300, facing.y * 300);
      b.setData('damage', state.player.atk * 2);
      b.setData('isAbility', true);
      b.setData('pierce', true);
      scene.bullets.add(b);
      scene.particles.get(scene.player.x, scene.player.y, facing.x * -50, facing.y * -50, 0xFF4400, 3, 0.3, { gravity: 0 });
      SFX.shoot();
    }
  },
  { id: 'heal', name: 'Heal', icon: '💚', key: '2', cd: 8, desc: 'Restore 30% max HP',
    execute: (scene) => {
      const heal = Math.floor(state.player.maxHp * 0.3);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
      for (let i = 0; i < 15; i++) {
        scene.particles.get(scene.player.x + (Math.random()-0.5)*20, scene.player.y + (Math.random()-0.5)*20,
          (Math.random()-0.5)*30, -40 - Math.random()*40, 0x34D399, 2, 0.6, { gravity: 20 });
      }
      showToast(`+${heal} HP`, 'success', 1500, '💚');
      SFX.heal();
    }
  },
  { id: 'dash', name: 'Dash Strike', icon: '⚡', key: '3', cd: 4, desc: 'Dash forward damaging enemies',
    execute: (scene) => {
      const facing = scene.playerFacing;
      const dist = 100;
      scene.player.x += facing.x * dist;
      scene.player.y += facing.y * dist;
      for (let i = 0; i < 12; i++) {
        scene.particles.get(scene.player.x - facing.x * dist * (i/12), scene.player.y - facing.y * dist * (i/12),
          (Math.random()-0.5)*40, (Math.random()-0.5)*40, 0xF8D838, 2, 0.3);
      }
      scene.monsters.forEach(m => {
        if (!m.active) return;
        const dx = m.x - scene.player.x;
        const dy = m.y - scene.player.y;
        if (Math.sqrt(dx*dx + dy*dy) < 60) {
          const dmg = state.player.atk * 1.5;
          scene.damageMonster(m, dmg, true);
        }
      });
      if (scene.screenFX) scene.screenFX.shake(5);
      SFX.hit();
    }
  },
  { id: 'shield', name: 'Barrier', icon: '🛡', key: '4', cd: 12, desc: 'Block next 3 hits',
    execute: (scene) => {
      addStatusEffect('SHIELD');
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        scene.particles.get(scene.player.x + Math.cos(angle)*20, scene.player.y + Math.sin(angle)*20,
          Math.cos(angle)*20, Math.sin(angle)*20, 0x3B82F6, 2, 0.5, { friction: 0.95 });
      }
      showToast('Shield Active!', 'info', 1500, '🛡');
      SFX.power();
    }
  },
];

let abilityCooldowns = {};

function initAbilities() {
  abilityCooldowns = {};
  ABILITIES.forEach(a => abilityCooldowns[a.id] = 0);
  renderAbilityBar();
}

function renderAbilityBar() {
  const bar = document.getElementById('ability-bar');
  if (!bar) return;
  bar.style.display = state.phase === 'explore' ? 'flex' : 'none';
  bar.innerHTML = ABILITIES.map(a => {
    const cd = abilityCooldowns[a.id] || 0;
    return `<div class="ability-slot ${cd <= 0 ? 'ready' : ''}" onclick="useAbility('${a.id}')" title="${a.desc}">
      <span>${a.icon}</span>
      <span class="ability-key">${a.key}</span>
      ${cd > 0 ? `<span class="ability-cd">${Math.ceil(cd)}</span>` : ''}
    </div>`;
  }).join('');
}

function useAbility(id) {
  const ability = ABILITIES.find(a => a.id === id);
  if (!ability) return;
  if ((abilityCooldowns[id] || 0) > 0) { showToast('On cooldown!', 'warning', 1000); return; }
  if (!game || !game.scene) return;
  const scene = game.scene.getScene('Game');
  if (!scene) return;
  ability.execute(scene);
  abilityCooldowns[id] = ability.cd;
  renderAbilityBar();
}

function updateAbilities(dt) {
  let changed = false;
  for (const id in abilityCooldowns) {
    if (abilityCooldowns[id] > 0) {
      abilityCooldowns[id] = Math.max(0, abilityCooldowns[id] - dt);
      changed = true;
    }
  }
  if (changed) renderAbilityBar();
}

// ═══════════════════════════════════════════════════════════
// STATS SCREEN
// ═══════════════════════════════════════════════════════════
function toggleStats() {
  const el = document.getElementById('stats-screen');
  if (!el) return;
  el.classList.toggle('show');
  if (el.classList.contains('show')) renderStats();
}

function renderStats() {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  const p = state.player;
  const stats = [
    { label: 'Floor', value: `${state.depth + 1} / ${state.totalFloors}` },
    { label: 'Level', value: `${p.level} (${p.title})` },
    { label: 'HP', value: `${p.hp} / ${p.maxHp}` },
    { label: 'ATK', value: p.atk },
    { label: 'DEF', value: p.def },
    { label: 'Gold', value: p.gold },
    { label: 'Kills', value: state.kills },
    { label: 'Max Combo', value: `${combo.maxCombo}x` },
    { label: 'Achievements', value: `${unlockedAchievements.size}/${ACHIEVEMENTS.length}` },
    { label: 'Dodge Charges', value: `${dodgeState.charges}/${dodgeState.maxCharges}` },
    { label: 'Total Gold', value: persistentGold + p.gold },
    { label: 'Weapon', value: p.weapon ? p.weapon.name : 'None' },
  ];
  grid.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-card-label">${s.label}</div>
      <div class="stat-card-value">${s.value}</div>
    </div>
  `).join('');
}

// ─── INVENTORY SYSTEM ────────────────────────────────────────
function addToInventory(itemId) {
  if (!state.player) return false;
  if ((state.player.inventory || []).length >= state.player.maxInventory) {
    state.log.push('Inventory full!');
    SFX.trap();
    return false;
  }
  const item = ITEMS[itemId];
  if (!item) return false;
  state.player.inventory.push({ id: itemId, ...item });
  state.log.push(`Got: ${item.name}`);
  SFX.power();
  updateInventoryUI();
  // Check for synergies
  if (typeof checkSynergies === 'function') checkSynergies();
  return true;
}

function useItem(index) {
  if (!state.player) return;
  const item = (state.player.inventory || [])[index];
  if (!item) return;
  if (item.type === 'consumable') {
    // Special handling for bomb — needs access to scene/monsters
    if (item.id === 'bomb') {
      if (game && game.scene && game.scene.getScene('Game')) {
        const scene = game.scene.getScene('Game');
        let hitCount = 0;
        scene.monsters.forEach(m => {
          if (!m.active) return;
          const dx = scene.player.x - m.x;
          const dy = scene.player.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const hp = m.getData('hp') - 50;
            m.setData('hp', hp);
            if (hp <= 0) {
              scene.hitMonster(m); // triggers death logic
            } else {
              // Update HP bar
              const hpFill = m.getData('hpFill');
              if (hpFill && hpFill.active) {
                const ratio = Math.max(0, hp / m.getData('maxHp'));
                hpFill.setScale(ratio, 1);
              }
            }
            hitCount++;
            // Explosion particles
            for (let i = 0; i < 8; i++) {
              scene.spawnParticle(m.x, m.y, (Math.random()-0.5)*80, (Math.random()-0.5)*80, 0xEF4444, 0.9);
            }
          }
        });
        // Screen shake + flash
        scene.screenShake = 10;
        scene.cameras.main.flash(200, 239, 68, 68);
        state.log.push(`BOOM! Hit ${hitCount} enemies!`);
        SFX.jumpscare();
      } else {
        state.log.push('Bomb: No enemies nearby!');
      }
    } else if (item.id === 'compass') {
      // Compass permanently reveals exit on minimap
      state.player.hasCompass = true;
      state.log.push('Compass: Exit revealed on minimap!');
      SFX.power();
    } else {
      if (item.effect) item.effect(state.player);
      state.log.push(`Used: ${item.name}`);
      SFX.heal();
    }
    state.player.inventory.splice(index, 1);
  } else if (item.type === 'equipment') {
    if (state.player.equipped === item.id) {
      state.player.equipped = null;
      if (item.id === 'speed_boots') state.player.speedMult = 1;
      if (item.id === 'shield_item') state.player.shield = 0;
      state.log.push(`Unequipped: ${item.name}`);
    } else {
      if (state.player.equipped === 'speed_boots') state.player.speedMult = 1;
      if (state.player.equipped === 'shield_item') state.player.shield = 0;
      state.player.equipped = item.id;
      if (item.effect) item.effect(state.player);
      state.log.push(`Equipped: ${item.name}`);
    }
    SFX.power();
  } else if (item.type === 'key') {
    // Key: open nearby chests from a distance + bonus gold
    state.player.keys = (state.player.keys || 0) + 1;
    const bonusGold = 20 + state.depth * 10;
    state.player.gold += bonusGold;
    state.log.push(`Key: Unlocked a secret! +${bonusGold}G`);
    SFX.chest();
    state.player.inventory.splice(index, 1);
  } else if (item.type === 'passive') {
    // Compass is passive — just reveal exit
    state.player.hasCompass = true;
    state.log.push(`${item.name}: Active!`);
    SFX.power();
  }
  updateInventoryUI();
}

function dropItem(index) {
  const item = state.player.inventory[index];
  if (!item) return;
  if (state.player.equipped === item.id) {
    if (item.id === 'speed_boots') state.player.speedMult = 1;
    if (item.id === 'shield_item') state.player.shield = 0;
    state.player.equipped = null;
  }
  state.log.push(`Dropped: ${item.name}`);
  state.player.inventory.splice(index, 1);
  updateInventoryUI();
}

// ─── STATUS EFFECT SYSTEM ────────────────────────────────────
function addStatusEffect(effectKey) {
  const effect = STATUS[effectKey];
  if (!effect) return;
  const existing = state.player.statusEffects.find(e => e.key === effectKey);
  if (existing) {
    existing.remaining = effect.duration;
  } else {
    state.player.statusEffects.push({ key: effectKey, remaining: effect.duration, tickTimer: 0 });
    state.log.push(`${effect.name} applied!`);
    SFX.trap();
  }
}

function processStatusEffects(dt) {
  state.player.statusEffects = state.player.statusEffects.filter(e => {
    const effect = STATUS[e.key];
    e.tickTimer += dt;
    if (e.tickTimer >= 1) {
      e.tickTimer = 0;
      // Only count down positive durations; negative = permanent (e.g. SHIELD)
      if (e.remaining > 0) {
        e.remaining--;
        if (e.remaining <= 0) {
          state.log.push(`${effect.name} wore off`);
          return false;
        }
      }
      if (effect.tickDamage) {
        state.player.hp = Math.max(0, state.player.hp - effect.tickDamage);
        state.log.push(`${effect.name}: -${effect.tickDamage} HP`);
      }
      if (effect.healPerTick) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + effect.healPerTick);
      }
    }
    return true;
  });
}

function hasStatus(effectKey) {
  return state.player.statusEffects.some(e => e.key === effectKey);
}

// ─── ROOM TRANSITION ─────────────────────────────────────────
function startTransition(callback, title, sub) {
  state.isTransitioning = true;
  const transition = document.getElementById('gb-transition');
  const titleEl = document.getElementById('transition-title');
  const subEl = document.getElementById('transition-sub');
  if (!transition) { callback(); return; }

  if (titleEl) titleEl.textContent = title || '';
  if (subEl) subEl.textContent = sub || '';

  transition.classList.add('active');
  setTimeout(() => {
    callback();
    setTimeout(() => {
      transition.classList.remove('active');
      state.isTransitioning = false;
    }, 400);
  }, 450);
}

// ─── INVENTORY UI ────────────────────────────────────────────
function updateInventoryUI() {
  const invEl = document.getElementById('inventory-items');
  if (invEl) {
    const p = state.player;
    if (p.inventory.length === 0) {
      invEl.innerHTML = '<div class="inv-empty">BAG EMPTY</div>';
    } else {
      invEl.innerHTML = p.inventory.map((item, i) => `
        <div class="inv-item ${p.equipped === item.id ? 'equipped' : ''}" title="${item.desc}">
          <span class="inv-icon" onclick="useItem(${i})">${item.icon}</span>
          <span onclick="useItem(${i})" style="flex:1;">${item.name}</span>
          ${p.equipped === item.id ? '<span class="inv-equipped-tag">EQUIPPED</span>' : ''}
          <span onclick="dropItem(${i})" style="font-family:Press Start 2P;font-size:6px;color:#E83838;cursor:pointer;padding:2px 4px;" title="Drop">✕</span>
        </div>
      `).join('');
    }
  }
  if (typeof syncSidebarInventory === 'function') syncSidebarInventory();
}

function updateStatusUI() {
  const statusEl = document.getElementById('status-effects');
  if (!statusEl) return;
  statusEl.innerHTML = state.player.statusEffects.map(e => {
    const effect = STATUS[e.key];
    return `<span class="gb-status-badge" style="background:${'#' + effect.color.toString(16).padStart(6,'0')}22;color:${'#' + effect.color.toString(16).padStart(6,'0')};border:1px solid ${'#' + effect.color.toString(16).padStart(6,'0')}33;">
      ${effect.name} ${e.remaining > 0 ? e.remaining + 's' : ''}
    </span>`;
  }).join('');
}

// ─── GAME LIFECYCLE ──────────────────────────────────────────
function startGame() {
  // Load character selection
  loadCharacterSelection();

  // Capture commentCount before reset
  const savedCommentCount = state.commentCount;

  // Reset state first
  state = {
    phase: 'explore',
    player: {
      hp: 100, maxHp: 100, atk: 14, def: 5, level: 1, xp: 0, xpNext: 60,
      gold: 0, title: 'Youngster', invincible: 0,
      inventory: [], maxInventory: 12, equipped: null,
      speedMult: 1, shield: 0, statusEffects: [],
      weapon: null, hasCompass: false, keys: 0,
    },
    dungeon: null, depth: 0, commentCount: savedCommentCount,
    totalFloors: 10 + Math.floor(savedCommentCount / 20),
    kills: 0, log: [],
    visited: new Set(), keys: 0, floorTheme: 0,
    transitionAlpha: 0, isTransitioning: false,
    floorEnemiesTotal: 0, floorEnemiesKilled: 0,
    riskTokens: 0, synergies: [], tempBuffs: [],
    bossRushMode: false, bossRushUnlocked: false,
    floorModifier: null,
    exitLocked: true, exitUnlockThreshold: 0.7,
    floorTimer: 0, floorTimerMax: 0, collapsing: false,
    waveNumber: 0, waveTimer: 0, waveStrength: 1,
  };

  // Load persistent data (weapon, gold, upgrades) AFTER state reset
  loadPersistentData();

  // Apply persistent upgrades
  applyPersistentUpgrades();

  // Reset combo
  combo = { count: 0, timer: 0, multiplier: 1, maxCombo: 0 };
  floorDamageTaken = 0;
  state.floorModifier = rollFloorModifier();
  applyFloorModifier(state.floorModifier);

  // Boss rush mode settings
  if (state.bossRushMode) {
    state.totalFloors = 3; // 3 bosses
  }

  // Floor pressure init
  state.floorTimerMax = Math.max(45, 90 - state.depth * 5);
  state.floorTimer = state.floorTimerMax;
  state.collapsing = false;
  state.exitLocked = true;
  state.waveNumber = 0;
  state.waveTimer = state.waveInterval;
  state.waveStrength = 1;

  document.getElementById('title-screen').classList.remove('show');
  document.getElementById('gameover-screen').classList.remove('show');
  const charScreen = document.getElementById('character-select-screen');
  if (charScreen) { charScreen.classList.remove('show'); charScreen.style.display = ''; }
  document.getElementById('power-led').classList.add('on');
  document.getElementById('controls-hint').classList.add('show');

  // Generate dynamic depth pips based on totalFloors
  const depthBar = document.querySelector('.gb-depth-bar');
  if (depthBar) {
    depthBar.innerHTML = '';
    for (let i = 0; i < state.totalFloors; i++) {
      const pip = document.createElement('div');
      pip.className = 'gb-depth-pip' + (i === 0 ? ' active' : '');
      depthBar.appendChild(pip);
    }
  }

  // Show community multiplier in HUD
  const logEl = document.getElementById('log');
  if (logEl && state.commentCount > 0) {
    const cm = getCommunityMultiplier();
    state.log.push(`Community: ${state.commentCount} comments (${cm.toFixed(1)}x rewards)`);
  }

  // Character welcome message
  const charData = getCharacterData();
  state.log.push(`${charData.name} enters the dungeon!`);
  state.log.push(`${charData.specialQuote}`);

  if (game) game.destroy(true);
  game = new Phaser.Game(config);

  // Force canvas to fill container after Phaser creates it
  game.events.once('ready', () => {
    const container = document.getElementById('game-container');
    const canvas = game.canvas;
    if (container && canvas) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
    }
  });
}

function restartGame() {
  if (game) game.destroy(true);
  document.getElementById('gameover-screen').classList.remove('show');
  document.getElementById('title-screen').classList.add('show');
  document.getElementById('controls-hint').classList.remove('show');
  document.getElementById('power-led').classList.remove('on');
}