/* ═══════════════════════════════════════════════════════════
   THREAD CRAWLER — Undertale-style Dungeon Crawler
   Math-driven procedural generation + polished 2D gameplay
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
const TILE = 32;
const MAP_W = 50;
const MAP_H = 40;
const PLAYER_SPEED = 160;
const BULLET_SPEED = 280;
const VIEW_RADIUS = 8;

const T = {
  FLOOR: 0, WALL: 1, EXIT: 2, SPAWN: 3, TRAP: 4, HEAL: 5, POWER: 6,
  WATER: 7, DEEP: 8, CRACK: 9, MOSS: 10, RUBBLE: 11, BONES: 12,
  TORCH: 13, CHEST: 14, SAVE: 15, DOOR_FRAME: 16, BLOOD: 17, WRITING: 18,
  FLOOR_ALT: 19, CARPET: 20, RUG: 21,
};

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
  FREEZE: { name: 'Freeze', color: 0x22D3EE, duration: 3, speedMult: 0.3 },
  BURN: { name: 'Burn', color: 0xEF4444, duration: 4, tickDamage: 3 },
  SHIELD: { name: 'Shield', color: 0x3B82F6, duration: -1, blocks: 3 },
  HASTE: { name: 'Haste', color: 0xFBBF24, duration: 5, speedMult: 1.5 },
  REGEN: { name: 'Regen', color: 0x34D399, duration: 8, healPerTick: 2 },
};

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

const THEMES = [
  { name: 'Thread Depths', wallColor: 0x1a1a2e, floorColor: 0x0d0d1a, accent: 0xA882F7, ambient: 0.03 },
  { name: 'Void Corridor', wallColor: 0x0f0a1a, floorColor: 0x0a0714, accent: 0x7C3AED, ambient: 0.02 },
  { name: 'Emerald Cavern', wallColor: 0x0a1a14, floorColor: 0x061210, accent: 0x34D399, ambient: 0.04 },
  { name: 'Crimson Depths', wallColor: 0x1a0a0a, floorColor: 0x140808, accent: 0xEF4444, ambient: 0.03 },
  { name: 'Golden Halls', wallColor: 0x1a1a0a, floorColor: 0x141408, accent: 0xFBBF24, ambient: 0.05 },
  { name: 'Frozen Abyss', wallColor: 0x0a1a1a, floorColor: 0x081414, accent: 0x22D3EE, ambient: 0.04 },
  { name: 'Shadow Realm', wallColor: 0x050508, floorColor: 0x030305, accent: 0xA882F7, ambient: 0.01 },
];

// ─── DUNGEON GENERATOR ───────────────────────────────────────
function generateDungeon(seed, depth) {
  const perlin = new PerlinNoise(seed);
  const map = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(T.WALL));
  const cave = cellularAutomata(MAP_W, MAP_H, 0.40 + depth * 0.015, 6);

  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const n = fbm(perlin, x * 0.07, y * 0.07, 3);
    if (cave[y][x] === 0 && n > -0.15) map[y][x] = T.FLOOR;
  }

  // Room carving with themed variants
  const rooms = [];
  const roomTypes = ['empty', 'rubble', 'bones', 'torches', 'carpet', 'blood', 'writing'];
  for (let i = 0; i < 8 + depth * 2; i++) {
    const rw = 5 + Math.floor(Math.random() * 7);
    const rh = 5 + Math.floor(Math.random() * 6);
    const rx = 2 + Math.floor(Math.random() * (MAP_W - rw - 4));
    const ry = 2 + Math.floor(Math.random() * (MAP_H - rh - 4));
    const roomType = roomTypes[Math.floor(Math.random() * roomTypes.length)];
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2), type: roomType });
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) map[y][x] = T.FLOOR;
  }

  // Connect rooms with door frames at room entrances
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let x = a.cx, y = a.cy;
    while (x !== b.cx) {
      if (x > 1 && x < MAP_W - 2 && y > 1 && y < MAP_H - 2) {
        map[y][x] = T.FLOOR;
        // Door frame at room boundaries
        if (x === rooms[i].x || x === rooms[i].x + rooms[i].w - 1) {
          if (y > 0 && y < MAP_H - 1) {
            map[y - 1][x] = T.DOOR_FRAME;
            map[y + 1][x] = T.DOOR_FRAME;
          }
        }
      }
      x += x < b.cx ? 1 : -1;
    }
    while (y !== b.cy) {
      if (x > 1 && x < MAP_W - 2 && y > 1 && y < MAP_H - 2) {
        map[y][x] = T.FLOOR;
        if (y === rooms[i].y || y === rooms[i].y + rooms[i].h - 1) {
          if (x > 0 && x < MAP_W - 1) {
            map[y][x - 1] = T.DOOR_FRAME;
            map[y][x + 1] = T.DOOR_FRAME;
          }
        }
      }
      y += y < b.cy ? 1 : -1;
    }
  }

  // Place features
  const spawn = rooms[0], exit = rooms[rooms.length - 1];
  map[spawn.cy][spawn.cx] = T.SPAWN;
  map[exit.cy][exit.cx] = T.EXIT;

  // Water pools (Perlin-based)
  for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
    if (map[y][x] !== T.FLOOR) continue;
    const w = fbm(perlin, x * 0.15, y * 0.15, 2);
    if (w > 0.3) map[y][x] = T.WATER;
  }

  // Room decorations based on room type
  rooms.forEach((room, idx) => {
    if (idx === 0) return;

    // Add room-specific decorations
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      if (map[y][x] !== T.FLOOR) continue;
      const r = Math.random();

      // Room type decorations
      if (room.type === 'rubble' && r < 0.08) { map[y][x] = T.RUBBLE; continue; }
      if (room.type === 'bones' && r < 0.06) { map[y][x] = T.BONES; continue; }
      if (room.type === 'torches' && r < 0.04) { map[y][x] = T.TORCH; continue; }
      if (room.type === 'blood' && r < 0.10) { map[y][x] = T.BLOOD; continue; }
      if (room.type === 'writing' && r < 0.05) { map[y][x] = T.WRITING; continue; }
      if (room.type === 'carpet' && r < 0.30) { map[y][x] = T.CARPET; continue; }

      // General decorations
      if (r < 0.04) { map[y][x] = T.TRAP; continue; }
      if (r < 0.08) { map[y][x] = T.HEAL; continue; }
      if (r < 0.11) { map[y][x] = T.POWER; continue; }
      if (r < 0.13) { map[y][x] = T.CRACK; continue; }
      if (r < 0.15) { map[y][x] = T.MOSS; continue; }

      // Floor variation
      if (Math.random() < 0.06) map[y][x] = T.FLOOR_ALT;
    }

    // Add save point in every 3rd room
    if (idx % 3 === 0 && room.w >= 5 && room.h >= 5) {
      map[room.cy][room.cx] = T.SAVE;
    }

    // Add treasure chest in some rooms
    if (idx > 0 && Math.random() < 0.3) {
      const cx = room.x + 1 + Math.floor(Math.random() * (room.w - 2));
      const cy = room.y + 1 + Math.floor(Math.random() * (room.h - 2));
      if (map[cy][cx] === T.FLOOR) map[cy][cx] = T.CHEST;
    }
  });

  // Decorations array for rendering
  const decorations = [];
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (map[y][x] === T.FLOOR && Math.random() < 0.03) {
      decorations.push({ x, y, type: Math.floor(Math.random() * 6) });
    }
  }

  return { map, spawn: { x: spawn.cx, y: spawn.cy }, exit: { x: exit.cx, y: exit.cy }, rooms, decorations, seed, depth };
}

// ─── PHASER SCENES ───────────────────────────────────────────
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() { this.scene.start('Game'); }
}

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init() {
    this.player = null;
    this.walls = null;
    this.exitZone = null;
    this.monsters = [];
    this.bullets = null;
    this.particles = [];
    this.fogGraphics = null;
    this.minimapGraphics = null;
    this.lightGraphics = null;
    this.playerFacing = { x: 0, y: 1 };
    this.animTimer = 0;
    this.playerFrame = 0;
    this.spawnTimer = 0;
    this.screenShake = 0;
    this.transitioning = false;
    this.shieldGfx = null;
  }

  create() {
    const dungeon = generateDungeon(Date.now() + state.depth * 7919, state.depth);
    state.dungeon = dungeon;
    const theme = THEMES[state.floorTheme % THEMES.length];

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    // ─── TILEMAP RENDERING (Undertale-style detail) ───
    const g = this.add.graphics();
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = dungeon.map[y][x];
      const px = x * TILE, py = y * TILE;
      const shade = Phaser.Display.Color.ValueToColor(theme.wallColor);
      const variation = Math.floor(Math.random() * 0x0a0a14);

      if (t === T.WALL) {
        // Wall with depth shading
        g.fillStyle(Phaser.Display.Color.GetColor(
          Math.min(255, shade.red + (variation & 0xff)),
          Math.min(255, shade.green + ((variation >> 8) & 0xff)),
          Math.min(255, shade.blue + ((variation >> 16) & 0xff))
        ), 1);
        g.fillRect(px, py, TILE, TILE);
        // Top highlight
        g.fillStyle(0xffffff, 0.04);
        g.fillRect(px, py, TILE, 2);
        // Bottom shadow
        g.fillStyle(0x000000, 0.2);
        g.fillRect(px, py + TILE - 2, TILE, 2);
        // Brick pattern
        if ((x + y) % 3 === 0) {
          g.lineStyle(1, 0xffffff, 0.02);
          g.lineBetween(px, py + TILE / 2, px + TILE, py + TILE / 2);
        }
      } else if (t === T.FLOOR || t === T.FLOOR_ALT) {
        g.fillStyle(t === T.FLOOR_ALT ? 0x111122 : theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Floor detail patterns
        if ((x + y) % 7 === 0) { g.fillStyle(0xffffff, 0.015); g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); }
        if ((x * 3 + y * 7) % 11 === 0) { g.fillStyle(theme.accent, 0.02); g.fillRect(px + 8, py + 8, 2, 2); }
        if ((x * 5 + y * 3) % 13 === 0) { g.fillStyle(0xffffff, 0.01); g.fillRect(px + 12, py + 12, 1, 1); }
      } else if (t === T.WATER) {
        g.fillStyle(0x0a1a2e, 0.8);
        g.fillRect(px, py, TILE, TILE);
        // Water ripples
        const ripple = Math.sin(Date.now() * 0.003 + x + y) * 0.03;
        g.fillStyle(0x22D3EE, 0.08 + ripple);
        g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        // Water sparkles
        if ((x + y) % 5 === 0) {
          g.fillStyle(0x22D3EE, 0.15);
          g.fillCircle(px + TILE/2 + Math.sin(Date.now() * 0.002) * 4, py + TILE/2, 1);
        }
      } else if (t === T.EXIT) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Horror exit — ominous portal
        const t2 = Date.now() * 0.001;
        // Outer ring (pulsing)
        const ringPulse = 0.15 + Math.sin(t2 * 2) * 0.1;
        g.lineStyle(2, 0xEF4444, ringPulse);
        g.strokeCircle(px + TILE/2, py + TILE/2, 14);
        // Inner ring
        g.lineStyle(1.5, theme.accent, 0.3 + Math.sin(t2 * 3) * 0.15);
        g.strokeCircle(px + TILE/2, py + TILE/2, 10);
        // Center void
        g.fillStyle(0x000000, 0.6);
        g.fillCircle(px + TILE/2, py + TILE/2, 6);
        g.fillStyle(theme.accent, 0.4);
        g.fillCircle(px + TILE/2, py + TILE/2, 4);
        // Pulsing glow
        const glowAlpha = 0.08 + Math.sin(t2 * 1.5) * 0.05;
        g.fillStyle(0xEF4444, glowAlpha);
        g.fillCircle(px + TILE/2, py + TILE/2, 20);
        // Warning pixels around edge
        g.fillStyle(0xEF4444, 0.15 + Math.sin(t2 * 4) * 0.1);
        g.fillRect(px + 2, py + 2, 3, 3);
        g.fillRect(px + TILE - 5, py + 2, 3, 3);
        g.fillRect(px + 2, py + TILE - 5, 3, 3);
        g.fillRect(px + TILE - 5, py + TILE - 5, 3, 3);
        // Descending arrow
        const arrowY = py + 8 + Math.sin(t2 * 3) * 3;
        g.fillStyle(0xEF4444, 0.4);
        g.fillTriangle(px + TILE/2, arrowY + 6, px + TILE/2 - 4, arrowY, px + TILE/2 + 4, arrowY);
      } else if (t === T.SPAWN) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle(0x3B82F6, 0.15);
        g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        // Spawn marker
        g.lineStyle(1, 0x3B82F6, 0.3);
        g.strokeCircle(px + TILE/2, py + TILE/2, 8);
      } else if (t === T.TRAP) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel art trap — spike pit
        g.fillStyle(0x333344, 0.3);
        g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        // Spike pixels
        g.fillStyle(0xEF4444, 0.35);
        g.fillRect(px + 8, py + 6, 2, 6);
        g.fillRect(px + 14, py + 8, 2, 6);
        g.fillRect(px + 20, py + 6, 2, 6);
        g.fillRect(px + 11, py + 10, 2, 5);
        g.fillRect(px + 17, py + 10, 2, 5);
        // Blood drops
        g.fillStyle(0x8B0000, 0.25);
        g.fillRect(px + 10, py + 14, 2, 2);
        g.fillRect(px + 16, py + 16, 2, 2);
      } else if (t === T.HEAL) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel art heal — heart
        g.fillStyle(0x34D399, 0.4);
        g.fillRect(px + 10, py + 8, 4, 3);
        g.fillRect(px + 16, py + 8, 4, 3);
        g.fillRect(px + 8, py + 10, 16, 4);
        g.fillRect(px + 10, py + 14, 12, 3);
        g.fillRect(px + 12, py + 17, 8, 3);
        g.fillRect(px + 14, py + 20, 4, 2);
        // Glow pixels
        g.fillStyle(0x34D399, 0.15);
        g.fillRect(px + 6, py + 6, 2, 2);
        g.fillRect(px + 22, py + 6, 2, 2);
        g.fillRect(px + 6, py + 22, 2, 2);
        g.fillRect(px + 22, py + 22, 2, 2);
      } else if (t === T.POWER) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel art power — star
        g.fillStyle(0xFBBF24, 0.45);
        g.fillRect(px + 14, py + 6, 4, 4);
        g.fillRect(px + 10, py + 10, 12, 4);
        g.fillRect(px + 8, py + 14, 16, 4);
        g.fillRect(px + 10, py + 18, 4, 3);
        g.fillRect(px + 18, py + 18, 4, 3);
        // Sparkle pixels
        g.fillStyle(0xFBBF24, 0.2);
        g.fillRect(px + 6, py + 8, 2, 2);
        g.fillRect(px + 24, py + 8, 2, 2);
        g.fillRect(px + 14, py + 4, 2, 2);
      } else if (t === T.SAVE) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel art save point — crystal
        const sp = 0.25 + Math.sin(Date.now() * 0.004) * 0.15;
        g.fillStyle(0x22D3EE, sp);
        g.fillRect(px + 12, py + 6, 8, 4);
        g.fillRect(px + 10, py + 10, 12, 6);
        g.fillRect(px + 12, py + 16, 8, 4);
        g.fillRect(px + 14, py + 20, 4, 3);
        // Glow pixels
        g.fillStyle(0x22D3EE, sp * 0.4);
        g.fillRect(px + 8, py + 8, 2, 2);
        g.fillRect(px + 22, py + 8, 2, 2);
        g.fillRect(px + 14, py + 4, 2, 2);
      } else if (t === T.CHEST) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel art chest
        g.fillStyle(0x8B6914, 0.7);
        g.fillRect(px + 6, py + 12, 20, 14);
        g.fillStyle(0xA07818, 0.8);
        g.fillRect(px + 6, py + 8, 20, 6);
        // Lock
        g.fillStyle(0xFBBF24, 0.6);
        g.fillRect(px + 14, py + 12, 4, 4);
        g.fillRect(px + 15, py + 16, 2, 3);
        // Metal bands
        g.fillStyle(0x555555, 0.3);
        g.fillRect(px + 6, py + 14, 20, 1);
        g.fillRect(px + 6, py + 20, 20, 1);
      } else if (t === T.BLOOD) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel blood splatter
        g.fillStyle(0x8B0000, 0.3);
        g.fillRect(px + 8, py + 10, 4, 3);
        g.fillRect(px + 12, py + 12, 3, 2);
        g.fillRect(px + 18, py + 8, 3, 4);
        g.fillRect(px + 10, py + 16, 5, 3);
        g.fillRect(px + 16, py + 18, 3, 2);
        g.fillStyle(0x660000, 0.2);
        g.fillRect(px + 14, py + 14, 2, 2);
        g.fillRect(px + 20, py + 14, 2, 2);
      } else if (t === T.WRITING) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel writing on wall
        g.fillStyle(0xAA0000, 0.3);
        g.fillRect(px + 6, py + 8, 8, 2);
        g.fillRect(px + 8, py + 12, 12, 2);
        g.fillRect(px + 6, py + 16, 10, 2);
        g.fillRect(px + 10, py + 20, 6, 2);
      } else if (t === T.BONES) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel bones
        g.fillStyle(0xd4c5b0, 0.35);
        g.fillRect(px + 8, py + 12, 16, 2);
        g.fillRect(px + 6, py + 10, 2, 6);
        g.fillRect(px + 22, py + 10, 2, 6);
        g.fillRect(px + 18, py + 18, 12, 2);
        g.fillRect(px + 16, py + 16, 2, 6);
        g.fillRect(px + 28, py + 16, 2, 6);
      } else if (t === T.TORCH) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel torch bracket
        g.fillStyle(0x666666, 0.5);
        g.fillRect(px + 14, py + 14, 4, 12);
        g.fillRect(px + 12, py + 24, 8, 2);
        // Flame pixels
        const flicker = Math.sin(Date.now() * 0.012 + x) * 0.12;
        g.fillStyle(0xFF6B35, 0.55 + flicker);
        g.fillRect(px + 13, py + 6, 6, 8);
        g.fillRect(px + 11, py + 8, 2, 4);
        g.fillRect(px + 19, py + 8, 2, 4);
        g.fillStyle(0xFBBF24, 0.4 + flicker);
        g.fillRect(px + 14, py + 4, 4, 4);
        g.fillRect(px + 15, py + 2, 2, 4);
        // Light glow
        g.fillStyle(0xFF6B35, 0.03);
        g.fillCircle(px + TILE/2, py + TILE/2, 24);
      } else if (t === T.MOSS) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel moss
        g.fillStyle(0x2d5a27, 0.35);
        g.fillRect(px + 6, py + 8, 4, 3);
        g.fillRect(px + 10, py + 10, 3, 2);
        g.fillRect(px + 20, py + 6, 4, 4);
        g.fillStyle(0x3a7a33, 0.25);
        g.fillRect(px + 14, py + 14, 5, 3);
        g.fillRect(px + 8, py + 20, 3, 2);
        g.fillRect(px + 22, py + 18, 4, 3);
      } else if (t === T.CRACK) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel crack
        g.fillStyle(0x000000, 0.35);
        g.fillRect(px + 6, py + 4, 2, 2);
        g.fillRect(px + 8, py + 6, 2, 2);
        g.fillRect(px + 10, py + 8, 2, 4);
        g.fillRect(px + 12, py + 12, 2, 2);
        g.fillRect(px + 10, py + 14, 2, 4);
        g.fillRect(px + 8, py + 18, 2, 4);
      } else if (t === T.RUBBLE) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Pixel rubble
        g.fillStyle(0x333344, 0.45);
        g.fillRect(px + 6, py + 10, 5, 4);
        g.fillRect(px + 14, py + 8, 4, 3);
        g.fillRect(px + 10, py + 18, 6, 5);
        g.fillRect(px + 20, py + 16, 3, 3);
        g.fillRect(px + 22, py + 20, 4, 3);
        g.fillStyle(0x222233, 0.3);
        g.fillRect(px + 8, py + 14, 3, 3);
        g.fillRect(px + 18, py + 12, 2, 2);
      }
    }

    // Decorations
    dungeon.decorations.forEach(d => {
      const px = d.x * TILE + TILE / 2, py = d.y * TILE + TILE / 2;
      if (d.type === 0) { g.fillStyle(0xffffff, 0.03); g.fillCircle(px, py, 1.5); }
      else if (d.type === 1) { g.lineStyle(1, 0xffffff, 0.025); g.lineBetween(px - 4, py, px + 4, py); }
      else if (d.type === 2) { g.fillStyle(theme.accent, 0.03); g.fillCircle(px, py, 1); }
      else if (d.type === 3) { g.fillStyle(0xffffff, 0.015); g.fillRect(px - 2, py - 2, 4, 4); }
      else if (d.type === 4) { g.fillStyle(0x333344, 0.2); g.fillCircle(px, py, 2); }
      else { g.lineStyle(1, 0xffffff, 0.015); g.lineBetween(px - 2, py - 2, px + 2, py + 2); }
    });

    // ─── WALLS ───
    this.walls = this.physics.add.staticGroup();
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (dungeon.map[y][x] === T.WALL) {
        const w = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0x000000, 0);
        this.physics.add.existing(w, true);
        this.walls.add(w);
      }
    }

    // ─── EXIT ZONE ───
    this.exitZone = this.add.zone(dungeon.exit.x * TILE + TILE/2, dungeon.exit.y * TILE + TILE/2, TILE * 1.5, TILE * 1.5);
    this.physics.world.enable(this.exitZone);
    this.exitZone.body.setAllowGravity(false);
    this.exitZone.body.moves = false;
    this.exitGlow = this.add.circle(dungeon.exit.x * TILE + TILE/2, dungeon.exit.y * TILE + TILE/2, TILE, theme.accent, 0.1);

    // ─── PIXEL PLAYER (Undertale-style character) ───
    this.player = this.add.container(dungeon.spawn.x * TILE + TILE/2, dungeon.spawn.y * TILE + TILE/2);
    this.playerBody = this.add.graphics();
    this.drawPixelPlayer(this.playerBody, 0xA882F7);
    this.player.add(this.playerBody);
    this.playerGlow = this.add.circle(0, 0, TILE * 1.2, 0xA882F7, 0.06);
    this.player.add(this.playerGlow);
    this.player.setSize(16, 16);
    this.player.setDepth(10);
    this.physics.world.enable(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);

    // ─── BULLETS ───
    this.bullets = this.physics.add.group();

    // ─── MONSTERS ───
    for (let i = 0; i < 3 + state.depth; i++) this.spawnMonster();

    // ─── FOG OF WAR ───
    this.fogGraphics = this.add.graphics();
    this.fogGraphics.setDepth(20);

    // ─── MINIMAP ───
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setDepth(25);

    // ─── LIGHT EFFECTS ───
    this.lightGraphics = this.add.graphics();
    this.lightGraphics.setDepth(5);

    // ─── CAMERA ───
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.8);

    // ─── CONTROLS ───
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey('SPACE');
    this.eKey = this.input.keyboard.addKey('E');
    this.iKey = this.input.keyboard.addKey('I');

    // Inventory toggle
    this.iKey.on('down', () => {
      const panel = document.getElementById('inventory-panel');
      if (panel) {
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
        document.getElementById('inv-count').textContent = state.player.inventory.length;
        updateInventoryUI();
      }
    });

    // ─── UI UPDATE ───
    this.updateUI();
    this.addLog(`Floor ${state.depth + 1}: ${theme.name}`);
    this.addLog(`${dungeon.rooms.length} rooms discovered`);

    // ─── EXIT INTERACTION ───
    this.physics.add.overlap(this.player, this.exitZone, () => {
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.nextFloor();
    });

    // Show controls hint
    document.getElementById('controls-hint').style.display = 'flex';
  }

  // Pixel art player character (Undertale-style)
  drawPixelPlayer(g, color) {
    g.clear();
    const P = { 0: 'transparent', 1: '#1a1a24', 2: '#B8C4D0', 3: '#d0dae6', 4: '#1a1a24', 5: '#8899AA', 6: '#e8c8d4', 7: '#6B7B8D', 8: '#dde4ec' };
    const sprite = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0],
      [0,0,0,0,1,2,7,1,0,0,1,7,2,1,0,0],
      [0,0,0,0,1,3,2,2,1,1,2,2,3,1,0,0],
      [0,0,0,1,3,3,2,2,2,2,2,2,3,3,1,0],
      [0,0,0,1,3,8,4,2,2,2,2,4,8,3,1,0],
      [0,0,0,1,3,6,4,4,2,2,4,4,6,3,1,0],
      [0,0,0,1,3,3,2,2,5,5,2,2,3,3,1,0],
      [0,0,0,1,2,3,8,8,8,8,3,3,2,1,0,0],
      [0,0,0,1,2,3,8,8,8,8,8,3,2,1,0,0],
      [0,0,0,1,2,3,3,8,8,8,3,3,2,1,0,0],
      [0,0,0,1,2,2,3,3,3,3,3,2,2,1,0,0],
      [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0],
      [0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,0,1,1,0,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0],
    ];
    const ps = 2;
    for (let y = 0; y < sprite.length; y++) {
      for (let x = 0; x < sprite[y].length; x++) {
        if (sprite[y][x] === 0) continue;
        const c = P[sprite[y][x]];
        if (c === 'transparent') continue;
        g.fillStyle(Phaser.Display.Color.HexStringToColor(c).color, 1);
        g.fillRect(x * ps - 16, y * ps - 16, ps, ps);
      }
    }
  }

  update(time, delta) {
    if (state.phase !== 'explore' || !this.player || this.transitioning) return;
    const dt = delta / 1000;
    const dungeon = state.dungeon;
    const theme = THEMES[state.floorTheme % THEMES.length];

    // ─── PLAYER MOVEMENT ───
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len; vy /= len;
      this.playerFacing = { x: vx, y: vy };
      // Walk animation
      this.animTimer += dt * 8;
      this.playerFrame = Math.floor(this.animTimer) % 4;
      const bobY = Math.sin(this.animTimer * 2) * 1.5;
      this.playerBody.y = bobY;
    } else {
      this.animTimer = 0;
      this.playerBody.y = 0;
    }

    this.player.body.setVelocity(vx * PLAYER_SPEED * state.player.speedMult, vy * PLAYER_SPEED * state.player.speedMult);

    // ─── SHOOTING ───
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.shoot();

    // ─── TILE INTERACTIONS ───
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H) {
      const tile = dungeon.map[ty][tx];
      if (tile === T.TRAP) this.triggerTrap(tx, ty);
      else if (tile === T.HEAL) this.triggerHeal(tx, ty);
      else if (tile === T.POWER) this.triggerPower(tx, ty);
      else if (tile === T.CHEST) this.triggerChest(tx, ty);
      else if (tile === T.WATER) {
        this.player.body.setVelocity(vx * PLAYER_SPEED * 0.3, vy * PLAYER_SPEED * 0.3);
      }
    }

    // ─── VISITED TRACKING ───
    state.visited.add(`${tx},${ty}`);

    // ─── MONSTER AI ───
    this.monsters.forEach(m => {
      if (!m.active) return;
      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 180) {
        const spd = m.getData('speed') || 50;
        m.body.setVelocity((dx / dist) * spd, (dy / dist) * spd);
        // Monster pulse
        m.setAlpha(0.7 + Math.sin(time * 0.005) * 0.3);
      } else {
        // Patrol
        const angle = time * 0.001 + m.getData('offset');
        m.body.setVelocity(Math.cos(angle) * 20, Math.sin(angle) * 20);
        m.setAlpha(0.5);
      }

      // Melee damage
      if (dist < 26 && state.player.invincible <= 0) {
        this.damagePlayer(m.getData('damage') || 10);
      }
    });

    // ─── STATUS EFFECTS ───
    processStatusEffects(dt);
    updateStatusUI();
    if (hasStatus('FREEZE')) {
      this.player.body.setVelocity(vx * PLAYER_SPEED * 0.3, vy * PLAYER_SPEED * 0.3);
    }

    // ─── SHIELD CHECK ───
    if (state.player.shield > 0) {
      // Visual shield indicator
      if (!this.shieldGfx) {
        this.shieldGfx = this.add.circle(0, 0, 22, 0x3B82F6, 0.15);
        this.shieldGfx.setStrokeStyle(2, 0x3B82F6, 0.4);
        this.player.add(this.shieldGfx);
      }
    } else if (this.shieldGfx) {
      this.shieldGfx.destroy();
      this.shieldGfx = null;
    }

    // ─── INVINCIBILITY FRAMES ───
    if (state.player.invincible > 0) {
      state.player.invincible -= dt;
      this.player.setAlpha(Math.sin(time * 0.02) > 0 ? 1 : 0.3);
    } else {
      this.player.setAlpha(1);
    }

    // ─── BULLET CLEANUP ───
    this.bullets.getChildren().forEach(b => {
      if (b.active && (b.x < 0 || b.x > MAP_W * TILE || b.y < 0 || b.y > MAP_H * TILE)) b.destroy();
    });

    // ─── FOG OF WAR ───
    this.drawFog(dungeon, tx, ty);

    // ─── MINIMAP ───
    this.drawMinimap(dungeon, tx, ty);

    // ─── LIGHT EFFECTS ───
    this.drawLights(dungeon, time);

    // ─── EXIT GLOW ───
    if (this.exitGlow) this.exitGlow.setAlpha(0.08 + Math.sin(time * 0.003) * 0.06);

    // ─── SCREEN SHAKE ───
    if (this.screenShake > 0) {
      this.screenShake *= 0.9;
      this.cameras.main.setScroll(
        this.cameras.main.scrollX + (Math.random() - 0.5) * this.screenShake,
        this.cameras.main.scrollY + (Math.random() - 0.5) * this.screenShake
      );
      if (this.screenShake < 0.3) this.screenShake = 0;
    }

    // ─── PARTICLE UPDATE ───
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      if (p.life <= 0) { p.gfx.destroy(); return false; }
      p.gfx.setAlpha(p.life / p.maxLife);
      p.gfx.setPosition(p.gfx.x + p.vx * dt, p.gfx.y + p.vy * dt);
      p.vy += 40 * dt;
      return true;
    });

    this.updateUI();
  }

  drawFog(dungeon, px, py) {
    this.fogGraphics.clear();
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist > VIEW_RADIUS) {
        const alpha = Math.min(0.85, (dist - VIEW_RADIUS) * 0.08);
        if (state.visited.has(`${x},${y}`)) {
          this.fogGraphics.fillStyle(0x000000, alpha * 0.5);
        } else {
          this.fogGraphics.fillStyle(0x000000, alpha);
        }
        this.fogGraphics.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  drawMinimap(dungeon, px, py) {
    const g = this.minimapGraphics;
    g.clear();
    const mmX = 10, mmY = 10, mmScale = 3;
    const mmW = MAP_W * mmScale, mmH = MAP_H * mmScale;

    // Background
    g.fillStyle(0x000000, 0.7);
    g.fillRoundedRect(mmX - 4, mmY - 4, mmW + 8, mmH + 8, 4);
    g.lineStyle(1, 0xffffff, 0.1);
    g.strokeRoundedRect(mmX - 4, mmY - 4, mmW + 8, mmH + 8, 4);

    // Rooms
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!state.visited.has(`${x},${y}`)) continue;
      const t = dungeon.map[y][x];
      if (t === T.WALL) { g.fillStyle(0x333344, 0.6); }
      else if (t === T.EXIT) { g.fillStyle(0x34D399, 0.8); }
      else { g.fillStyle(0x555566, 0.4); }
      g.fillRect(mmX + x * mmScale, mmY + y * mmScale, mmScale, mmScale);
    }

    // Player dot
    g.fillStyle(0xA882F7, 1);
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

  drawLights(dungeon, time) {
    this.lightGraphics.clear();
    const px = this.player.x, py = this.player.y;
    const theme = THEMES[state.floorTheme % THEMES.length];

    // Player ambient light — concentric circles
    const maxR = TILE * 5 + Math.sin(time * 0.002) * TILE;
    for (let r = maxR; r > 0; r -= TILE * 0.8) {
      const alpha = 0.015 * (1 - r / maxR);
      this.lightGraphics.fillStyle(theme.accent, alpha);
      this.lightGraphics.fillCircle(px, py, r);
    }
  }

  shoot() {
    const dirX = this.playerFacing.x || 0;
    const dirY = this.playerFacing.y || 1;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    const nx = len > 0 ? dirX / len : 0;
    const ny = len > 0 ? dirY / len : 1;

    const bullet = this.add.circle(
      this.player.x + nx * 16, this.player.y + ny * 16,
      4, 0xA882F7
    );
    bullet.setDepth(8);
    this.physics.world.enable(bullet);
    bullet.body.setAllowGravity(false);
    bullet.body.setVelocity(nx * BULLET_SPEED, ny * BULLET_SPEED);
    this.bullets.add(bullet);
    SFX.shoot();

    // Muzzle flash particles
    for (let i = 0; i < 3; i++) {
      this.spawnParticle(
        this.player.x + nx * 12, this.player.y + ny * 12,
        (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60,
        0xA882F7, 0.3
      );
    }

    // Bullet-monster collision
    this.monsters.forEach(m => {
      if (!m.active) return;
      this.physics.add.overlap(bullet, m, () => {
        this.hitMonster(m);
        bullet.destroy();
      });
    });

    this.physics.add.collider(bullet, this.walls, () => bullet.destroy());
    this.time.delayedCall(2500, () => { if (bullet.active) bullet.destroy(); });
  }

  hitMonster(monster) {
    const theme = THEMES[state.floorTheme % THEMES.length];
    const hp = monster.getData('hp') - state.player.atk;
    monster.setData('hp', hp);

    // Hit flash — Container doesn't have setTint, tint the first child
    const child = monster.getAt(0);
    if (child && child.setTint) {
      child.setTint(0xffffff);
      this.time.delayedCall(80, () => { if (child.active) child.clearTint(); });
    } else {
      // Fallback: flash alpha
      monster.setAlpha(0.3);
      this.time.delayedCall(80, () => { if (monster.active) monster.setAlpha(0.8); });
    }

    // Hit particles
    for (let i = 0; i < 8; i++) {
      this.spawnParticle(monster.x, monster.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, theme.accent, 0.7);
    }

    this.screenShake = 6;
    SFX.hit();

    if (hp <= 0) {
      // Death explosion
      for (let i = 0; i < 15; i++) {
        this.spawnParticle(monster.x, monster.y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 0xEF4444, 0.9);
      }
      monster.destroy();
      state.kills++;
      state.player.xp += 15 + state.depth * 5;
      state.player.gold += 8 + state.depth * 3;
      this.addLog(`Monster defeated! +${15 + state.depth * 5} XP`);
      this.screenShake = 10;
      SFX.kill();

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

    // Shield check
    if (state.player.shield > 0) {
      state.player.shield--;
      state.player.invincible = 0.5;
      this.addLog(`Shield blocked! (${state.player.shield} left)`);
      SFX.power();
      // Shield break particles
      for (let i = 0; i < 6; i++) this.spawnParticle(this.player.x, this.player.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0x3B82F6, 0.8);
      return;
    }

    const dmg = Math.max(1, amount - state.player.def);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.player.invincible = 1.0;
    this.screenShake = 8;
    SFX.hurt();

    this.cameras.main.flash(200, 239, 68, 68);
    this.addLog(`Took ${dmg} damage!`);

    // Damage particles
    for (let i = 0; i < 6; i++) {
      this.spawnParticle(this.player.x, this.player.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0xEF4444, 0.8);
    }

    if (state.player.hp <= 0) {
      state.phase = 'gameover';
      SFX.death();
      document.getElementById('gameover-screen').style.display = 'flex';
      document.getElementById('go-stats').innerHTML = `
        Depth: ${state.depth + 1}<br>
        Kills: ${state.kills}<br>
        Gold: ${state.player.gold}<br>
        Level: ${state.player.level} (${state.player.title})
      `;
    }
  }

  triggerTrap(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    this.damagePlayer(18 + state.depth * 3);
    SFX.trap();
    // Random status effect from trap
    const trapEffects = ['POISON', 'BURN', 'FREEZE'];
    if (Math.random() < 0.4) {
      const effect = trapEffects[Math.floor(Math.random() * trapEffects.length)];
      addStatusEffect(effect);
      this.addLog(`TRAP! ${STATUS[effect].name} applied!`);
    } else {
      this.addLog('TRAP! Took damage!');
    }
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xEF4444, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 5; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 50, -Math.random() * 40, 0xEF4444, 0.7);
  }

  triggerHeal(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    const heal = 25 + Math.floor(Math.random() * 20);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    this.addLog(`HEAL! Recovered ${heal} HP`);
    SFX.heal();
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0x34D399, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 5; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 40, -Math.random() * 50, 0x34D399, 0.7);
  }

  triggerPower(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    const roll = Math.random();
    if (roll < 0.35) { state.player.atk += 3; this.addLog('Sharp Wit! +3 ATK'); }
    else if (roll < 0.65) { state.player.def += 2; this.addLog('Thick Skin! +2 DEF'); }
    else if (roll < 0.85) { state.player.gold += 25; this.addLog('Golden Reply! +25 Gold'); }
    else { state.player.maxHp += 15; state.player.hp = Math.min(state.player.hp + 15, state.player.maxHp); this.addLog('Vitality Boost! +15 Max HP'); }
    SFX.power();
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xFBBF24, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 8; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 60, -Math.random() * 60, 0xFBBF24, 0.8);
  }

  triggerChest(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    const lootTable = ['health_potion', 'bomb', 'atk_gem', 'def_gem', 'shield_item', 'speed_boots', 'mega_potion', 'compass'];
    const goldAmount = 15 + Math.floor(Math.random() * 25) + state.depth * 5;
    state.player.gold += goldAmount;

    // Random chance to get an item
    if (Math.random() < 0.6) {
      const itemId = lootTable[Math.floor(Math.random() * lootTable.length)];
      addToInventory(itemId);
    } else {
      state.log.push(`Found ${goldAmount} gold!`);
      SFX.power();
    }

    // Chest open animation
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xFBBF24, 0.5);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    for (let i = 0; i < 12; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 80, -Math.random() * 80, 0xFBBF24, 0.9);
  }

  spawnMonster() {
    const x = 3 + Math.floor(Math.random() * (MAP_W - 6));
    const y = 3 + Math.floor(Math.random() * (MAP_H - 6));
    if (state.dungeon.map[y][x] !== T.FLOOR) return;

    const theme = THEMES[state.floorTheme % THEMES.length];
    const monsterTypes = [
      { name: 'Shadow', color: 0x6B21A8, hp: 25, speed: 45, damage: 8, size: 10 },
      { name: 'Wraith', color: 0x7C3AED, hp: 35, speed: 55, damage: 12, size: 11 },
      { name: 'Stalker', color: 0xA855F7, hp: 45, speed: 40, damage: 15, size: 12 },
      { name: 'Void', color: 0x4C1D95, hp: 55, speed: 50, damage: 18, size: 13 },
      { name: 'Crawler', color: 0x581C87, hp: 65, speed: 35, damage: 20, size: 14 },
    ];
    const type = monsterTypes[Math.min(Math.floor(state.depth / 2), monsterTypes.length - 1)];

    const monster = this.add.container(x * TILE + TILE/2, y * TILE + TILE/2);

    // Monster body — 16x16 pixel sprites like the player
    const body = this.add.graphics();
    const monsterSprites = [
      // Shadow Ghost — floating specter with hollow eyes
      [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
        [0,0,0,1,2,3,3,2,2,3,3,2,1,0,0,0],
        [0,0,1,2,3,8,4,2,2,4,8,3,2,1,0,0],
        [0,0,1,2,3,6,4,4,2,4,6,3,2,1,0,0],
        [0,0,1,2,3,3,2,2,5,2,3,3,2,1,0,0],
        [0,0,1,2,3,3,2,2,3,2,3,3,2,1,0,0],
        [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0],
        [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
        [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
        [0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,1,0,1,0,0,1,0,1,0,0,0,0],
        [0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ],
      // Wraith — armored specter with crown
      [
        [0,0,0,0,1,0,0,1,1,0,0,1,0,0,0,0],
        [0,0,0,1,2,1,0,1,1,0,1,2,1,0,0,0],
        [0,0,0,1,2,2,1,1,1,1,2,2,1,0,0,0],
        [0,0,1,2,3,3,2,2,2,2,3,3,2,1,0,0],
        [0,0,1,2,8,4,2,2,2,2,4,8,2,1,0,0],
        [0,0,1,2,6,4,4,2,2,4,4,6,2,1,0,0],
        [0,0,1,2,3,3,2,5,5,2,3,3,2,1,0,0],
        [0,0,1,2,3,3,2,3,3,2,3,3,2,1,0,0],
        [0,0,1,2,2,3,3,3,3,3,3,2,2,1,0,0],
        [0,0,1,2,2,3,3,3,3,3,3,2,2,1,0,0],
        [0,0,0,1,2,2,3,3,3,3,2,2,1,0,0,0],
        [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
        [0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0],
        [0,0,0,0,1,0,1,1,1,1,0,1,0,0,0,0],
        [0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ],
      // Stalker — one-eyed creature with tentacles
      [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
        [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
        [0,0,0,0,1,2,3,3,3,3,2,1,0,0,0,0],
        [0,0,0,1,2,8,4,8,8,4,8,2,1,0,0,0],
        [0,0,0,1,2,4,5,4,4,5,4,2,1,0,0,0],
        [0,0,0,1,2,3,3,3,3,3,3,2,1,0,0,0],
        [0,0,0,1,2,2,2,3,3,2,2,2,1,0,0,0],
        [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
        [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
        [0,0,0,1,0,1,2,2,2,2,1,0,1,0,0,0],
        [0,0,1,0,0,0,1,1,1,1,0,0,0,1,0,0],
        [0,1,0,0,0,0,0,1,1,0,0,0,0,0,1,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ],
      // Void Blob — amorphous dark mass with glowing eyes
      [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,1,3,3,3,3,3,3,1,0,0,0,0],
        [0,0,0,1,3,3,8,8,8,8,3,3,1,0,0,0],
        [0,0,1,3,3,8,4,3,3,4,8,3,3,1,0,0],
        [0,0,1,3,3,3,3,5,5,3,3,3,3,1,0,0],
        [0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0],
        [0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0],
        [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
        [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
        [0,0,0,0,1,3,3,3,3,3,3,1,0,0,0,0],
        [0,0,0,0,1,1,3,3,3,3,1,1,0,0,0,0],
        [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
        [0,0,0,0,1,0,1,0,0,1,0,1,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ],
      // Crawler — multi-legged insect (floor 5+)
      [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
        [0,0,1,2,3,8,4,2,2,4,8,3,2,1,0,0],
        [0,0,1,2,3,4,5,2,2,5,4,3,2,1,0,0],
        [0,0,1,2,3,3,2,2,2,2,3,3,2,1,0,0],
        [0,0,1,2,2,3,3,2,2,3,3,2,2,1,0,0],
        [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0],
        [0,1,0,1,2,2,2,2,2,2,2,2,1,0,1,0],
        [1,0,0,0,1,2,2,2,2,2,2,1,0,0,0,1],
        [0,0,0,1,0,1,1,1,1,1,1,0,1,0,0,0],
        [0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ],
    ];
    const spriteIdx = Math.min(Math.floor(state.depth / 2), monsterSprites.length - 1);
    const sprite = monsterSprites[spriteIdx];
    const colorMap = { 1: 0x1a1a24, 2: type.color, 3: 0x4C1D95, 4: 0x000000, 5: 0x000000, 8: 0xffffff };
    const ps = 2;

    for (let sy = 0; sy < sprite.length; sy++) {
      for (let sx = 0; sx < sprite[sy].length; sx++) {
        if (sprite[sy][sx] === 0) continue;
        const c = colorMap[sprite[sy][sx]] || type.color;
        body.fillStyle(c, 0.9);
        body.fillRect(sx * ps - 16, sy * ps - 16, ps, ps);
      }
    }
    monster.add(body);

    // Monster glow
    const glow = this.add.circle(0, 0, 16, type.color, 0.06);
    monster.add(glow);

    // Monster name tag
    const nameTag = this.add.text(0, -18, type.name, {
      fontSize: '7px', fontFamily: 'Share Tech Mono', color: '#' + type.color.toString(16).padStart(6, '0'),
      align: 'center', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);
    monster.add(nameTag);

    monster.setSize(16, 16);
    monster.setData('hp', type.hp + state.depth * 8);
    monster.setData('maxHp', type.hp + state.depth * 8);
    monster.setData('speed', type.speed + state.depth * 3);
    monster.setData('damage', type.damage + state.depth * 2);
    monster.setData('offset', Math.random() * Math.PI * 2);
    monster.setDepth(8);

    this.physics.world.enable(monster);
    monster.body.setCollideWorldBounds(true);
    this.physics.add.collider(monster, this.walls);
    this.monsters.push(monster);
  }

  spawnParticle(x, y, vx, vy, color, alpha) {
    const p = this.add.circle(x, y, 2 + Math.random() * 2, color, alpha);
    p.setDepth(15);
    this.particles.push({ gfx: p, vx, vy, life: 0.4 + Math.random() * 0.3, maxLife: 0.7 });
  }

  nextFloor() {
    if (this.transitioning) return;
    this.transitioning = true;
    state.depth++;
    state.floorTheme = (state.floorTheme + 1) % THEMES.length;
    SFX.exit();

    if (state.depth >= state.totalFloors) {
      state.phase = 'victory';
      document.getElementById('gameover-screen').style.display = 'flex';
      document.getElementById('go-stats').innerHTML = `
        FLOOR CLEARED!<br>
        Kills: ${state.kills}<br>
        Gold: ${state.player.gold}<br>
        Level: ${state.player.level} (${state.player.title})<br>
        Items: ${state.player.inventory.length}
      `;
      document.querySelector('#gameover-screen h2').textContent = 'VICTORY';
      document.querySelector('#gameover-screen h2').style.color = '#FBBF24';
      return;
    }

    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    this.addLog(`Descending to floor ${state.depth + 1}...`);
    startTransition(() => this.scene.restart());
  }

  getTitle(level) {
    if (level >= 20) return 'Thread Lord';
    if (level >= 15) return 'Depth Diver';
    if (level >= 10) return 'Reply Warrior';
    if (level >= 7) return 'Thread Surfer';
    if (level >= 5) return 'Comment Knight';
    if (level >= 3) return 'Post Pilgrim';
    return 'Newbie';
  }

  addLog(text) {
    state.log.push(text);
    if (state.log.length > 20) state.log.shift();
  }

  updateUI() {
    const p = state.player;
    const hpBar = document.getElementById('hp-fill');
    const hpText = document.getElementById('hp-text');
    const goldText = document.getElementById('gold-text');
    const levelText = document.getElementById('level-text');
    const depthText = document.getElementById('depth-text');
    const logEl = document.getElementById('game-log');

    if (hpBar) hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
    if (hpText) hpText.textContent = `${p.hp}/${p.maxHp}`;
    if (goldText) goldText.textContent = p.gold;
    if (levelText) levelText.textContent = `Lv.${p.level}`;
    if (depthText) depthText.textContent = `Floor ${state.depth + 1}/${state.totalFloors}`;
    if (logEl) {
      logEl.innerHTML = state.log.slice(-12).map(l => `<div class="log-entry">${l}</div>`).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }
  }
}

// ─── PHASER CONFIG ───────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: MAP_W * TILE,
  height: MAP_H * TILE,
  backgroundColor: '#010103',
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [BootScene, GameScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
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
  state.log.push(`Picked up: ${item.name}`);
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

// ─── ROOM TRANSITION SYSTEM ──────────────────────────────────
function startTransition(callback) {
  state.isTransitioning = true;
  state.transitionAlpha = 0;
  const canvas = document.querySelector('#game-container canvas');
  if (!canvas) { callback(); return; }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'transition-overlay';
  overlay.style.cssText = `
    position: absolute; inset: 0; z-index: 100;
    background: #010103; opacity: 0;
    transition: opacity 0.3s ease-in;
    pointer-events: none;
  `;
  canvas.parentElement.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    setTimeout(() => {
      callback();
      setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          state.isTransitioning = false;
        }, 300);
      }, 200);
    }, 350);
  });
}

// ─── INVENTORY UI UPDATE ─────────────────────────────────────
function updateInventoryUI() {
  const invEl = document.getElementById('inventory-items');
  if (!invEl) return;
  const p = state.player;
  invEl.innerHTML = p.inventory.map((item, i) => `
    <div class="inv-item ${p.equipped === item.id ? 'equipped' : ''}" onclick="useItem(${i})" title="${item.desc}">
      <span class="inv-icon" style="color:${'#' + item.color.toString(16).padStart(6,'0')}">${item.icon}</span>
      <span class="inv-name">${item.name}</span>
      ${p.equipped === item.id ? '<span class="inv-equipped">E</span>' : ''}
    </div>
  `).join('');
}

function updateStatusUI() {
  const statusEl = document.getElementById('status-effects');
  if (!statusEl) return;
  const p = state.player;
  statusEl.innerHTML = p.statusEffects.map(e => {
    const effect = STATUS[e.key];
    return `<span class="status-badge" style="background:${'#' + effect.color.toString(16).padStart(6,'0')}22;color:${'#' + effect.color.toString(16).padStart(6,'0')};border:1px solid ${'#' + effect.color.toString(16).padStart(6,'0')}33;">
      ${effect.name} ${e.remaining > 0 ? e.remaining + 's' : ''}
    </span>`;
  }).join('');
}

let game = null;

function startGame() {
  state = {
    phase: 'explore',
    player: {
      hp: 100, maxHp: 100, atk: 14, def: 5, level: 1, xp: 0, xpNext: 60,
      gold: 0, title: 'Newbie', invincible: 0,
      inventory: [], maxInventory: 12, equipped: null,
      speedMult: 1, shield: 0, statusEffects: [],
    },
    dungeon: null, depth: 0, totalFloors: 7, kills: 0, log: [],
    visited: new Set(), keys: 0, floorTheme: 0,
    transitionAlpha: 0, isTransitioning: false,
  };
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  if (game) game.destroy(true);
  game = new Phaser.Game(config);
}

function restartGame() {
  if (game) game.destroy(true);
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('title-screen').style.display = 'flex';
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('controls-hint').style.display = 'none';
}

document.getElementById('title-screen').style.display = 'flex';
document.getElementById('game-screen').style.display = 'none';
document.getElementById('gameover-screen').style.display = 'none';
