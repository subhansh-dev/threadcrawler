/* ═══════════════════════════════════════════════════════════
   THREAD CRAWLER — Pokemon Gameboy-style Dungeon Crawler
   Procedural generation + polished 2D top-down gameplay
   ═══════════════════════════════════════════════════════════ */

// ─── SOUND ENGINE ────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

function cellularAutomata(w, h, fill = 0.42, iters = 5) {
  let g = Array.from({ length: h }, () => Array.from({ length: w }, () => Math.random() < fill ? 1 : 0));
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
const MAP_W = 80;
const MAP_H = 60;
const PLAYER_SPEED = 100;
const BULLET_SPEED = 200;
const VIEW_RADIUS = 12;
const INTERACTION_COOLDOWN = 0.4;

const T = {
  FLOOR: 0, WALL: 1, EXIT: 2, SPAWN: 3, TRAP: 4, HEAL: 5, POWER: 6,
  WATER: 7, GRASS_TALL: 8, PATH: 9, FENCE: 10, TREE: 11,
  FLOOR_ALT: 12, CARPET: 13, STAIRS: 14, CHEST: 15,
  LAVA: 16, ICE: 17, SAND: 18, BRIDGE: 19, FLOWER: 20,
};

const SOLID_TILES = new Set([T.WALL, T.FENCE, T.TREE, T.LAVA]);
const SLOW_TILES = new Set([T.WATER, T.GRASS_TALL, T.ICE]);

// ─── ITEM DEFINITIONS ────────────────────────────────────────
const ITEMS = {
  health_potion: { name: 'Health Potion', desc: 'Restore 40 HP', type: 'consumable', icon: '♥', color: 0x34D399, effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + 40); } },
  mega_potion: { name: 'Mega Potion', desc: 'Restore 80 HP', type: 'consumable', icon: '♥+', color: 0x22C55E, effect: (p) => { p.hp = Math.min(p.maxHp, p.hp + 80); } },
  bomb: { name: 'Bomb', desc: 'Deal 50 damage to all nearby enemies', type: 'consumable', icon: '●', color: 0xEF4444, effect: null },
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
  { id: 'floor_7', name: 'Thread Master', desc: 'Clear all 7 floors', check: () => state.depth >= 7 },
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

let persistentGold = 0;
let upgradeLevels = {};

function loadPersistentData() {
  try {
    const d = JSON.parse(localStorage.getItem('threadcrawler_save') || '{}');
    persistentGold = d.gold || 0;
    upgradeLevels = d.upgrades || {};
    unlockedAchievements = new Set(d.achievements || []);
  } catch(e) {}
}

function savePersistentData() {
  try {
    localStorage.setItem('threadcrawler_save', JSON.stringify({
      gold: persistentGold,
      upgrades: upgradeLevels,
      achievements: [...unlockedAchievements],
    }));
  } catch(e) {}
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

// ─── DEVVIT CONNECTION ────────────────────────────────────────
let devvitDungeon = null;
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
let state = {
  phase: 'title',
  player: {
    hp: 100, maxHp: 100, atk: 14, def: 5, level: 1, xp: 0, xpNext: 60,
    gold: 0, title: 'Newbie', invincible: 0,
    inventory: [], maxInventory: 12, equipped: null,
    speedMult: 1, shield: 0,
    statusEffects: [],
  },
  dungeon: null,
  depth: 0,
  totalFloors: 7,
  kills: 0,
  log: [],
  visited: new Set(),
  keys: 0,
  floorTheme: 0,
  transitionAlpha: 0,
  isTransitioning: false,
};

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
  const cave = cellularAutomata(MAP_W, MAP_H, 0.40 + depth * 0.012, 6);
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
  map[spawn.cy][spawn.cx] = T.SPAWN;
  map[exit.cy][exit.cx] = T.EXIT;

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

      // General decoration
      if (r < 0.025) { map[y][x] = T.TRAP; continue; }
      if (r < 0.045) { map[y][x] = T.HEAL; continue; }
      if (r < 0.060) { map[y][x] = T.POWER; continue; }
      if (r < 0.075) { map[y][x] = T.GRASS_TALL; continue; }
      if (r < 0.085) { map[y][x] = T.FLOWER; continue; }

      // Floor variation
      if (rng() < 0.08) map[y][x] = T.FLOOR_ALT;
    }

    // Save point in some rooms
    if (idx % 3 === 0 && room.w >= 5 && room.h >= 5) {
      map[room.cy][room.cx] = T.STAIRS;
    }

    // Treasure chests
    if (idx > 0 && rng() < 0.3) {
      const cx = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
      const cy = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
      if (cx >= 0 && cx < MAP_W && cy >= 0 && cy < MAP_H && map[cy][cx] === T.FLOOR) {
        map[cy][cx] = T.CHEST;
      }
    }
  });

  // ─── STEP 6: Water pools (Perlin-based) ───
  for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
    if (map[y][x] !== T.FLOOR) continue;
    const w = fbm(perlin, x * 0.12, y * 0.12, 2);
    if (w > 0.35) map[y][x] = T.WATER;
  }

  // ─── STEP 7: Border walls (ensure edges are solid) ───
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
      // Pulsing glow
      const glow = 0.15 + Math.sin(time * 0.003) * 0.1;
      g.fillStyle(theme.accent, glow);
      g.fillRect(px + 1, py + 1, 14, 14);
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
      // Lava flow
      const lavaWave = Math.sin(time * 0.004 + x * 1.2 + y * 0.8) * 0.15;
      g.fillStyle(0xFF6600, 0.5 + lavaWave);
      g.fillRect(px + 2, py + 2, 12, 12);
      // Bright spots
      g.fillStyle(0xFFAA00, 0.4 + lavaWave);
      g.fillRect(px + 4, py + 4, 4, 4);
      g.fillRect(px + 9, py + 8, 3, 3);
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
    this.particles = [];
    this.fogGraphics = null;
    this.minimapGraphics = null;
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
  }

  create() {
    const dungeon = generateDungeon(Date.now() + state.depth * 7919, state.depth);
    state.dungeon = dungeon;
    const theme = THEMES[state.floorTheme % THEMES.length];

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
    this.player.setSize(12, 12);
    this.player.setDepth(10);
    this.physics.world.enable(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setOffset(-6, -6);
    this.physics.add.collider(this.player, this.walls);

    // ─── BULLETS ───
    this.bullets = this.physics.add.group();

    // ─── MONSTERS ───
    const monsterCount = Math.min(3 + state.depth, 8);
    for (let i = 0; i < monsterCount; i++) this.spawnMonster();

    // Spawn boss on specific floors
    const bossData = BOSSES.find(b => b.floor === state.depth);
    if (bossData) this.spawnBoss(bossData);

    // ─── FOG OF WAR ───
    this.fogGraphics = this.add.graphics();
    this.fogGraphics.setDepth(20);

    // ─── MINIMAP ───
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setDepth(25);

    // ─── CAMERA ───
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);
    // Use theme fog color for background
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
    // Initial force
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

    this.iKey.on('down', () => {
      const panel = document.getElementById('inventory-panel');
      if (panel) {
        panel.classList.toggle('show');
        document.getElementById('inv-count').textContent = state.player.inventory.length;
        updateInventoryUI();
      }
    });

    // ─── UI ───
    this.updateUI();
    this.addLog(`Floor ${state.depth + 1}: ${theme.name}`);
    this.addLog(`${dungeon.rooms.length} rooms found`);
    document.getElementById('controls-hint').classList.add('show');
  }

  // ─── CC (CODE GEASS) CHARACTER SPRITE ───
  drawCatPlayer(g, frame, facing) {
    g.clear();
    const ps = 1;

    // CC colors (Code Geass)
    const hair = 0x7CFC00;        // lime green hair
    const hairDark = 0x4CAF00;    // darker green
    const hairLight = 0x98FB98;   // light green highlights
    const skin = 0xFDE8D0;        // fair skin
    const skinShadow = 0xE8C8A8;  // skin shadow
    const eyes = 0xDAA520;        // golden eyes
    const eyeWhite = 0xFFFFFF;
    const outfit = 0xF0F0F0;      // white outfit
    const outfitShadow = 0xC8C8C8;
    const outfitDark = 0xA0A0A0;
    const outline = 0x282020;     // dark outline
    const lips = 0xE88088;        // soft pink lips

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
    if (state.phase !== 'explore' || !this.player || this.transitioning) return;
    const dt = delta / 1000;
    const dungeon = state.dungeon;
    const theme = THEMES[state.floorTheme % THEMES.length];

    // ─── COOLDOWNS ───
    if (this.interactionCooldown > 0) this.interactionCooldown -= dt;
    if (this.stepTimer > 0) this.stepTimer -= dt;

    // ─── PLAYER MOVEMENT ───
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707; vy *= 0.707;
    }

    // Get tile position early (needed for speed + interactions)
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);

    let speedMult = state.player.speedMult;

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
      this.playerBody.y = 0;
      // Idle animation — redraw facing direction
      this.drawCatPlayer(this.playerBody, 0, this.playerFacing);
    }

    this.player.body.setVelocity(vx * PLAYER_SPEED * speedMult, vy * PLAYER_SPEED * speedMult);

    // ─── SHOOTING ───
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.shoot();

    // ─── TILE INTERACTIONS (with cooldown) ───
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H && this.interactionCooldown <= 0) {
      const tile = dungeon.map[ty][tx];
      if (tile === T.TRAP) {
        this.triggerTrap(tx, ty);
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
        if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
          this.nextFloor();
        }
        // Show exit hint
        if (!this.exitHint) {
          this.exitHint = this.add.text(
            dungeon.exit.x * TILE + TILE/2, dungeon.exit.y * TILE - 8,
            'Press E', {
              fontFamily: 'Press Start 2P', fontSize: '5px', color: '#F8F8F0',
              stroke: '#000', strokeThickness: 2, align: 'center',
            }
          ).setOrigin(0.5).setDepth(22);
          this.tweens.add({ targets: this.exitHint, alpha: 0.5, yoyo: true, repeat: -1, duration: 600 });
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

    // ─── MONSTER AI ───
    this.monsters.forEach(m => {
      if (!m.active) return;
      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        // Chase player
        const spd = m.getData('speed') || 50;
        m.body.setVelocity((dx / dist) * spd, (dy / dist) * spd);
        m.setAlpha(0.9);
      } else if (dist < 250) {
        // Wander
        const angle = time * 0.001 + m.getData('offset');
        m.body.setVelocity(Math.cos(angle) * 15, Math.sin(angle) * 15);
        m.setAlpha(0.7);
      } else {
        // Idle
        m.body.setVelocity(0, 0);
        m.setAlpha(0.5);
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
      const dust = this.add.circle(px, py, 1 + Math.random() * 2, 0xFFFFFF, 0.03 + Math.random() * 0.04);
      dust.setDepth(12);
      this.particles.push({ gfx: dust, vx: (Math.random() - 0.5) * 8, vy: -5 - Math.random() * 10, life: 2 + Math.random() * 2, maxLife: 4 });
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
      this.player.setAlpha(Math.sin(time * 0.02) > 0 ? 1 : 0.3);
    } else {
      this.player.setAlpha(1);
    }

    // ─── BULLET CLEANUP ───
    this.bullets.getChildren().forEach(b => {
      if (b.active && (b.x < 0 || b.x > MAP_W * TILE || b.y < 0 || b.y > MAP_H * TILE)) {
        this.cleanupBullet(b);
        b.destroy();
      }
    });

    // ─── FOG OF WAR ───
    this.drawFog(dungeon, tx, ty);

    // ─── MINIMAP ───
    this.drawMinimap(dungeon, tx, ty);

    // ─── SCREEN SHAKE (gentle, doesn't fight camera) ───
    if (this.screenShake > 0) {
      this.screenShake *= 0.92;
      this.cameras.main.shake(this.screenShake * 0.001, 50);
      if (this.screenShake < 0.3) this.screenShake = 0;
    }

    // ─── PARTICLES ───
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      if (p.life <= 0) { p.gfx.destroy(); return false; }
      p.gfx.setAlpha(p.life / p.maxLife);
      p.gfx.setPosition(p.gfx.x + p.vx * dt, p.gfx.y + p.vy * dt);
      p.vy += 30 * dt;
      return true;
    });

    // ─── RE-RENDER MAP (for animated tiles like water, lava) ───
    // Only re-render every few frames for performance
    if (Math.floor(time / 200) !== Math.floor((time - delta) / 200)) {
      this.renderMap(dungeon, theme, time);
    }

    this.updateUI();
  }

  drawFog(dungeon, px, py) {
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
  }

  drawMinimap(dungeon, px, py) {
    const g = this.minimapGraphics;
    g.clear();
    if (typeof minimapVisible !== 'undefined' && !minimapVisible) return;
    const mmScale = 1;
    const mmW = MAP_W * mmScale;
    const mmH = MAP_H * mmScale;
    // Position relative to camera viewport (stays on screen)
    const cam = this.cameras.main;
    const mmX = cam.scrollX + cam.width / cam.zoom - mmW - 8;
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

    // Player dot
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(mmX + px * mmScale + mmScale / 2, mmY + py * mmScale + mmScale / 2, 2);

    // Monsters
    this.monsters.forEach(m => {
      if (!m.active) return;
      const mx = Math.floor(m.x / TILE), my = Math.floor(m.y / TILE);
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (dist < VIEW_RADIUS) {
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

    // Attack animation (frame 10+ = sword slash)
    this.drawCatPlayer(this.playerBody, 10, this.playerFacing);
    this.time.delayedCall(200, () => {
      if (this.playerBody && this.playerBody.active) {
        this.drawCatPlayer(this.playerBody, 0, this.playerFacing);
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
    const theme = THEMES[state.floorTheme % THEMES.length];
    let damage = state.player.atk;

    // Weapon bonus
    if (state.player.weapon) {
      damage += state.player.weapon.atk || 0;
    }

    // Combo multiplier
    addCombo();
    damage = Math.floor(damage * combo.multiplier);

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

    // Hit flash
    monster.setAlpha(0.3);
    this.time.delayedCall(80, () => { if (monster.active) monster.setAlpha(0.9); });

    // Hit particles
    for (let i = 0; i < 6; i++) {
      this.spawnParticle(monster.x, monster.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, theme.accent, 0.7);
    }

    this.screenShake = 4;
    SFX.hit();

    // Show combo + damage number
    const comboText = combo.count > 1 ? ` (${combo.count}x)` : '';
    this.spawnDamageNumber(monster.x, monster.y, `-${damage}${comboText}`, combo.count >= 5 ? 0xFBBF24 : 0xFFFFFF);

    // Weapon special effects
    if (state.player.weapon) {
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
      // Death explosion
      for (let i = 0; i < 10; i++) {
        this.spawnParticle(monster.x, monster.y, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, 0xEF4444, 0.9);
      }
      monster.destroy();
      state.kills++;

      // Combo bonus XP
      const comboXpBonus = Math.floor((15 + state.depth * 5) * (combo.multiplier - 1));
      const baseXp = 15 + state.depth * 5;
      state.player.xp += baseXp + comboXpBonus;
      state.player.gold += 8 + state.depth * 3;

      // Holy lance heal on kill
      if (state.player.weapon && state.player.weapon.id === 'holy_lance') {
        const heal = 5;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
        this.spawnDamageNumber(this.player.x, this.player.y, `+${heal}`, 0x34D399);
      }

      this.addLog(`Monster defeated! +${baseXp + comboXpBonus} XP${comboXpBonus > 0 ? ` (${combo.multiplier}x combo!)` : ''}`);
      this.screenShake = 6;
      SFX.kill();

      // Boss drops weapon
      if (monster.getData('isBoss')) {
        const weapon = getRandomWeapon(state.depth);
        state.player.weapon = weapon;
        this.addLog(`🗡 Boss dropped: ${weapon.name}! (${weapon.desc})`);
        SFX.chest();
      }

      // Random weapon drop from normal monsters (5% chance)
      if (!monster.getData('isBoss') && Math.random() < 0.05) {
        const weapon = getRandomWeapon(state.depth);
        if (!state.player.weapon || WEAPONS[weapon.id].atk > WEAPONS[state.player.weapon.id].atk) {
          state.player.weapon = weapon;
          this.addLog(`Found: ${weapon.name}! (${weapon.desc})`);
          SFX.power();
        }
      }

      checkAchievements();

      // Level up
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
        SFX.levelup();
      }
    }
  }

  damagePlayer(amount) {
    if (state.player.invincible > 0) return;

    // Reset combo on taking damage
    resetCombo();
    floorDamageTaken++;

    // Shield check
    if (state.player.shield > 0) {
      state.player.shield--;
      state.player.invincible = 0.5;
      this.addLog(`Shield blocked! (${state.player.shield} left)`);
      SFX.power();
      for (let i = 0; i < 4; i++) this.spawnParticle(this.player.x, this.player.y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0x3B82F6, 0.8);
      return;
    }

    const dmg = Math.max(1, amount - state.player.def);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.player.invincible = 0.8;
    this.screenShake = 5;
    SFX.hurt();

    this.cameras.main.flash(150, 239, 68, 68);
    this.addLog(`Took ${dmg} damage!`);
    this.spawnDamageNumber(this.player.x, this.player.y, `-${dmg}`, 0xEF4444);

    for (let i = 0; i < 4; i++) {
      this.spawnParticle(this.player.x, this.player.y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0xEF4444, 0.8);
    }

    if (state.player.hp <= 0) {
      state.phase = 'gameover';
      SFX.death();
      document.getElementById('gameover-screen').classList.add('show');
      document.getElementById('go-title').textContent = 'GAME OVER';
      document.getElementById('go-title').style.color = '#E83838';
      document.getElementById('go-stats').innerHTML = `
        Floor: ${state.depth + 1} / ${state.totalFloors}<br>
        Kills: ${state.kills}<br>
        Gold: ${state.player.gold}<br>
        Level: ${state.player.level} (${state.player.title})
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
    const lootTable = ['health_potion', 'bomb', 'atk_gem', 'def_gem', 'shield_item', 'speed_boots', 'mega_potion', 'compass'];
    const goldAmount = 15 + Math.floor(Math.random() * 25) + state.depth * 5;
    state.player.gold += goldAmount;

    if (Math.random() < 0.6) {
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

  spawnMonster() {
    // Retry up to 20 times to find a valid spawn
    let x, y, tries = 0;
    do {
      x = 3 + Math.floor(Math.random() * (MAP_W - 6));
      y = 3 + Math.floor(Math.random() * (MAP_H - 6));
      tries++;
    } while (SOLID_TILES.has(state.dungeon.map[y][x]) && tries < 20);
    if (SOLID_TILES.has(state.dungeon.map[y][x])) return;

    const theme = THEMES[state.floorTheme % THEMES.length];
    const monsterTypes = [
      { name: 'Shadow Crawler', color: 0x4A2A4A, hp: 25, speed: 40, damage: 8 },
      { name: 'Lost Soul', color: 0x3A3A5A, hp: 30, speed: 45, damage: 10 },
      { name: 'Flesh Golem', color: 0x5A2A2A, hp: 40, speed: 35, damage: 14 },
      { name: 'Void Stalker', color: 0x2A1A3A, hp: 50, speed: 50, damage: 18 },
      { name: 'Bone Horror', color: 0x6A5A3A, hp: 65, speed: 45, damage: 22 },
    ];
    const typeIdx = Math.min(Math.floor(state.depth / 2), monsterTypes.length - 1);
    const type = monsterTypes[typeIdx];

    const monster = this.add.container(x * TILE + TILE/2, y * TILE + TILE/2);

    // Pokemon-style monster sprite
    const body = this.add.graphics();
    const ps = 1;
    const mc = type.color;
    // Derive dark/light variants
    const r = (mc >> 16) & 0xff, g = (mc >> 8) & 0xff, b = mc & 0xff;
    const dark = Phaser.Display.Color.GetColor(Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40));
    const light = Phaser.Display.Color.GetColor(Math.min(255, r + 50), Math.min(255, g + 50), Math.min(255, b + 50));

    // Simple Pokemon-style monster body
    body.fillStyle(mc, 0.9);
    body.fillRect(3 * ps, 2 * ps, 10 * ps, 10 * ps);
    body.fillRect(2 * ps, 4 * ps, 12 * ps, 6 * ps);
    // Highlight
    body.fillStyle(light, 0.5);
    body.fillRect(4 * ps, 2 * ps, 4 * ps, 3 * ps);
    // Shadow
    body.fillStyle(dark, 0.4);
    body.fillRect(3 * ps, 10 * ps, 10 * ps, 3 * ps);
    // Eyes (angry)
    body.fillStyle(0xFFFFFF, 0.9);
    body.fillRect(4 * ps, 5 * ps, 3 * ps, 2 * ps);
    body.fillRect(9 * ps, 5 * ps, 3 * ps, 2 * ps);
    body.fillStyle(0xFF0000, 0.8);
    body.fillRect(5 * ps, 5 * ps, 2 * ps, 2 * ps);
    body.fillRect(10 * ps, 5 * ps, 2 * ps, 2 * ps);
    // Mouth
    body.fillStyle(0x000000, 0.5);
    body.fillRect(6 * ps, 9 * ps, 4 * ps, 1 * ps);

    body.setPosition(-8, -8);
    monster.add(body);

    // HP bar
    const hpBg = this.add.rectangle(0, -12, 14, 2, 0x000000, 0.5);
    const hpFill = this.add.rectangle(0, -12, 14, 2, 0xEF4444, 0.8);
    hpFill.setOrigin(0.5);
    monster.add(hpBg);
    monster.add(hpFill);
    monster.setData('hpFill', hpFill);

    monster.setSize(12, 12);
    monster.setData('hp', type.hp + state.depth * 8);
    monster.setData('maxHp', type.hp + state.depth * 8);
    monster.setData('speed', type.speed + state.depth * 2);
    monster.setData('damage', type.damage + state.depth * 2);
    monster.setData('offset', Math.random() * Math.PI * 2);
    monster.setData('name', type.name);
    monster.setDepth(8);

    this.physics.world.enable(monster);
    monster.body.setCollideWorldBounds(true);
    monster.body.setOffset(-6, -6);
    this.physics.add.collider(monster, this.walls);
    this.monsters.push(monster);
  }

  spawnMonsterAt(tileX, tileY) {
    // Spawn monster at specific tile (for grass encounters)
    const theme = THEMES[state.floorTheme % THEMES.length];
    const monsterTypes = [
      { name: 'Shadow Crawler', color: 0x4A2A4A, hp: 25, speed: 40, damage: 8 },
      { name: 'Lost Soul', color: 0x3A3A5A, hp: 30, speed: 45, damage: 10 },
      { name: 'Flesh Golem', color: 0x5A2A2A, hp: 40, speed: 35, damage: 14 },
      { name: 'Void Stalker', color: 0x2A1A3A, hp: 50, speed: 50, damage: 18 },
      { name: 'Bone Horror', color: 0x6A5A3A, hp: 65, speed: 45, damage: 22 },
    ];
    const typeIdx = Math.min(Math.floor(state.depth / 2), monsterTypes.length - 1);
    const type = monsterTypes[typeIdx];

    const monster = this.add.container(tileX * TILE + TILE/2, tileY * TILE + TILE/2);
    const body = this.add.graphics();
    const mc = type.color;
    const r = (mc >> 16) & 0xff, g = (mc >> 8) & 0xff, b = mc & 0xff;
    const dark = Phaser.Display.Color.GetColor(Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40));
    const light = Phaser.Display.Color.GetColor(Math.min(255, r + 50), Math.min(255, g + 50), Math.min(255, b + 50));

    body.fillStyle(mc, 0.9);
    body.fillRect(-5, -6, 10, 10);
    body.fillRect(-6, -4, 12, 6);
    body.fillStyle(light, 0.5);
    body.fillRect(-4, -6, 4, 3);
    body.fillStyle(dark, 0.4);
    body.fillRect(-5, 2, 10, 3);
    body.fillStyle(0xFFFFFF, 0.9);
    body.fillRect(-4, -3, 3, 2);
    body.fillRect(1, -3, 3, 2);
    body.fillStyle(0xFF0000, 0.8);
    body.fillRect(-3, -3, 2, 2);
    body.fillRect(2, -3, 2, 2);
    body.fillStyle(0x000000, 0.5);
    body.fillRect(-2, 1, 4, 1);
    monster.add(body);

    const hpBg = this.add.rectangle(0, -12, 14, 2, 0x000000, 0.5);
    const hpFill = this.add.rectangle(0, -12, 14, 2, 0xEF4444, 0.8);
    hpFill.setOrigin(0.5);
    monster.add(hpBg);
    monster.add(hpFill);
    monster.setData('hpFill', hpFill);

    monster.setSize(12, 12);
    const hp = type.hp + state.depth * 8;
    monster.setData('hp', hp);
    monster.setData('maxHp', hp);
    monster.setData('speed', type.speed + state.depth * 2 + 10); // slightly faster for encounters
    monster.setData('damage', type.damage + state.depth * 2);
    monster.setData('offset', Math.random() * Math.PI * 2);
    monster.setData('name', type.name);
    monster.setDepth(8);

    this.physics.world.enable(monster);
    monster.body.setCollideWorldBounds(true);
    monster.body.setOffset(-6, -6);
    this.physics.add.collider(monster, this.walls);
    this.monsters.push(monster);
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
    monster.setData('hp', bossData.hp);
    monster.setData('maxHp', bossData.hp);
    monster.setData('speed', bossData.speed);
    monster.setData('damage', bossData.damage);
    monster.setData('offset', Math.random() * Math.PI * 2);
    monster.setData('name', bossData.name);
    monster.setData('isBoss', true);
    monster.setDepth(8);

    this.physics.world.enable(monster);
    monster.body.setCollideWorldBounds(true);
    monster.body.setOffset(-s/2, -s/2);
    this.physics.add.collider(monster, this.walls);
    this.monsters.push(monster);

    this.addLog(`⚠ BOSS: ${bossData.name} appeared!`);
  }

  spawnParticle(x, y, vx, vy, color, alpha) {
    const p = this.add.circle(x, y, 1 + Math.random() * 1.5, color, alpha);
    p.setDepth(15);
    this.particles.push({ gfx: p, vx, vy, life: 0.3 + Math.random() * 0.2, maxLife: 0.5 });
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

    // Save gold to persistent storage
    persistentGold += state.player.gold;
    savePersistentData();

    state.depth++;
    state.floorTheme = (state.floorTheme + 1) % THEMES.length;
    floorDamageTaken = 0;
    resetCombo();
    SFX.exit();

    // Floor clear celebration
    this.addLog(`✨ Floor ${state.depth} cleared!`);

    if (state.depth >= state.totalFloors) {
      state.phase = 'victory';
      persistentGold += 100; // bonus for clearing
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
        Achievements: ${unlockedAchievements.size}/${ACHIEVEMENTS.length}
      `;
      return;
    }

    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    state.visited.clear();
    this.addLog(`Descending to floor ${state.depth + 1}...`);
    startTransition(() => this.scene.restart());
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
    const p = state.player;
    const hpBar = document.getElementById('hp-fill');
    const goldText = document.getElementById('hud-gold');
    const levelText = document.getElementById('hud-level');
    const floorText = document.getElementById('hud-floor');
    const depthText = document.getElementById('depth-text');
    const logEl = document.getElementById('game-log');

    if (hpBar) hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
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

    // Combo display
    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
      if (combo.count >= 3) {
        comboEl.textContent = `${combo.count}x COMBO`;
        comboEl.style.display = 'block';
        comboEl.style.color = combo.count >= 12 ? '#F8D838' : combo.count >= 5 ? '#E87898' : '#A882F7';
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
  scale: { mode: Phaser.Scale.NONE },
  pixelArt: true,
  antialias: false,
};

let game = null;

// ─── INVENTORY SYSTEM ────────────────────────────────────────
function addToInventory(itemId) {
  if (state.player.inventory.length >= state.player.maxInventory) {
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
  return true;
}

function useItem(index) {
  const item = state.player.inventory[index];
  if (!item) return;
  if (item.type === 'consumable') {
    if (item.effect) item.effect(state.player);
    state.log.push(`Used: ${item.name}`);
    SFX.heal();
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
    if (e.remaining <= 0) {
      state.log.push(`${effect.name} wore off`);
      return false;
    }
    e.tickTimer += dt;
    if (e.tickTimer >= 1) {
      e.tickTimer = 0;
      e.remaining--;
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
function startTransition(callback) {
  state.isTransitioning = true;
  const transition = document.getElementById('gb-transition');
  if (!transition) { callback(); return; }

  transition.classList.add('active');
  setTimeout(() => {
    callback();
    setTimeout(() => {
      transition.classList.remove('active');
      state.isTransitioning = false;
    }, 300);
  }, 350);
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
        <div class="inv-item ${p.equipped === item.id ? 'equipped' : ''}" onclick="useItem(${i})" title="${item.desc}">
          <span class="inv-icon">${item.icon}</span>
          <span>${item.name}</span>
          ${p.equipped === item.id ? '<span class="inv-equipped-tag">EQUIPPED</span>' : ''}
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
  loadPersistentData();

  state = {
    phase: 'explore',
    player: {
      hp: 100, maxHp: 100, atk: 14, def: 5, level: 1, xp: 0, xpNext: 60,
      gold: 0, title: 'Youngster', invincible: 0,
      inventory: [], maxInventory: 12, equipped: null,
      speedMult: 1, shield: 0, statusEffects: [],
      weapon: null,
    },
    dungeon: null, depth: 0, totalFloors: 7, kills: 0, log: [],
    visited: new Set(), keys: 0, floorTheme: 0,
    transitionAlpha: 0, isTransitioning: false,
  };

  // Apply persistent upgrades
  applyPersistentUpgrades();

  // Reset combo
  combo = { count: 0, timer: 0, multiplier: 1, maxCombo: 0 };
  floorDamageTaken = 0;

  document.getElementById('title-screen').classList.remove('show');
  document.getElementById('gameover-screen').classList.remove('show');
  document.getElementById('power-led').classList.add('on');
  document.getElementById('controls-hint').classList.add('show');
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
