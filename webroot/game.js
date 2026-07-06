/* ═══════════════════════════════════════════════════════════
   THREAD CRAWLER — Undertale-style Dungeon Crawler
   Math-driven procedural generation + polished 2D gameplay
   ═══════════════════════════════════════════════════════════ */

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

const T = { FLOOR: 0, WALL: 1, EXIT: 2, SPAWN: 3, TRAP: 4, HEAL: 5, POWER: 6, WATER: 7, DEEP: 8 };

// ─── GAME STATE ──────────────────────────────────────────────
let state = {
  phase: 'title',
  player: { hp: 100, maxHp: 100, atk: 14, def: 5, level: 1, xp: 0, xpNext: 60, gold: 0, title: 'Newbie', invincible: 0 },
  dungeon: null,
  depth: 0,
  totalFloors: 7,
  kills: 0,
  log: [],
  visited: new Set(),
  keys: 0,
  hasShield: false,
  floorTheme: 0,
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

  // Room carving
  const rooms = [];
  for (let i = 0; i < 8 + depth * 2; i++) {
    const rw = 5 + Math.floor(Math.random() * 7);
    const rh = 5 + Math.floor(Math.random() * 6);
    const rx = 2 + Math.floor(Math.random() * (MAP_W - rw - 4));
    const ry = 2 + Math.floor(Math.random() * (MAP_H - rh - 4));
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) map[y][x] = T.FLOOR;
  }

  // Connect rooms
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let x = a.cx, y = a.cy;
    while (x !== b.cx) { if (x > 1 && x < MAP_W - 2 && y > 1 && y < MAP_H - 2) { map[y][x] = T.FLOOR; } x += x < b.cx ? 1 : -1; }
    while (y !== b.cy) { if (x > 1 && x < MAP_W - 2 && y > 1 && y < MAP_H - 2) { map[y][x] = T.FLOOR; } y += y < b.cy ? 1 : -1; }
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

  // Hazards & items
  rooms.forEach((room, idx) => {
    if (idx === 0) return;
    for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
      if (map[y][x] !== T.FLOOR) continue;
      const r = Math.random();
      if (r < 0.05) map[y][x] = T.TRAP;
      else if (r < 0.10) map[y][x] = T.HEAL;
      else if (r < 0.14) map[y][x] = T.POWER;
    }
  });

  // Decorations (floor details)
  const decorations = [];
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) {
    if (map[y][x] === T.FLOOR && Math.random() < 0.03) {
      decorations.push({ x, y, type: Math.floor(Math.random() * 4) });
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
  }

  create() {
    const dungeon = generateDungeon(Date.now() + state.depth * 7919, state.depth);
    state.dungeon = dungeon;
    const theme = THEMES[state.floorTheme % THEMES.length];

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    // ─── TILEMAP RENDERING ───
    const g = this.add.graphics();
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = dungeon.map[y][x];
      const px = x * TILE, py = y * TILE;

      if (t === T.WALL) {
        const shade = Phaser.Display.Color.ValueToColor(theme.wallColor);
        const variation = Math.floor(Math.random() * 0x0a0a14);
        g.fillStyle(Phaser.Display.Color.GetColor(
          Math.min(255, shade.red + (variation & 0xff)),
          Math.min(255, shade.green + ((variation >> 8) & 0xff)),
          Math.min(255, shade.blue + ((variation >> 16) & 0xff))
        ), 1);
        g.fillRect(px, py, TILE, TILE);
        // Wall top highlight
        g.fillStyle(0xffffff, 0.03);
        g.fillRect(px, py, TILE, 2);
      } else if (t === T.FLOOR) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        // Floor detail
        if ((x + y) % 7 === 0) { g.fillStyle(0xffffff, 0.015); g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); }
        if ((x * 3 + y * 7) % 11 === 0) { g.fillStyle(theme.accent, 0.02); g.fillRect(px + 8, py + 8, 2, 2); }
      } else if (t === T.WATER) {
        g.fillStyle(0x1a3a5c, 0.6);
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle(0x22D3EE, 0.08);
        g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if (t === T.EXIT) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle(theme.accent, 0.2);
        g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        g.lineStyle(2, theme.accent, 0.4);
        g.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
      } else if (t === T.SPAWN) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle(0x3B82F6, 0.15);
        g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      } else if (t === T.TRAP) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle(0xEF4444, 0.12);
        g.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        // Trap warning marks
        g.lineStyle(1, 0xEF4444, 0.2);
        g.lineBetween(px + 8, py + 8, px + TILE - 8, py + TILE - 8);
        g.lineBetween(px + TILE - 8, py + 8, px + 8, py + TILE - 8);
      } else if (t === T.HEAL) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle(0x34D399, 0.12);
        g.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        g.fillStyle(0x34D399, 0.25);
        g.fillRect(px + TILE/2 - 1, py + 8, 2, TILE - 16);
        g.fillRect(px + 8, py + TILE/2 - 1, TILE - 16, 2);
      } else if (t === T.POWER) {
        g.fillStyle(theme.floorColor, 1);
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle(0xFBBF24, 0.12);
        g.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        // Star shape
        g.fillStyle(0xFBBF24, 0.3);
        g.fillRect(px + TILE/2 - 1, py + 6, 2, TILE - 12);
        g.fillRect(px + 6, py + TILE/2 - 1, TILE - 12, 2);
      }
    }

    // Decorations
    dungeon.decorations.forEach(d => {
      const px = d.x * TILE + TILE / 2, py = d.y * TILE + TILE / 2;
      if (d.type === 0) { g.fillStyle(0xffffff, 0.04); g.fillCircle(px, py, 2); }
      else if (d.type === 1) { g.lineStyle(1, 0xffffff, 0.03); g.lineBetween(px - 3, py, px + 3, py); }
      else if (d.type === 2) { g.fillStyle(theme.accent, 0.04); g.fillCircle(px, py, 1.5); }
      else { g.fillStyle(0xffffff, 0.02); g.fillRect(px - 2, py - 2, 4, 4); }
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

    // ─── PLAYER ───
    this.player = this.add.container(dungeon.spawn.x * TILE + TILE/2, dungeon.spawn.y * TILE + TILE/2);
    // Player body (Undertale-style heart)
    this.playerBody = this.add.graphics();
    this.drawPlayerHeart(this.playerBody, 0xA882F7);
    this.player.add(this.playerBody);
    // Player glow
    this.playerGlow = this.add.circle(0, 0, TILE * 1.5, 0xA882F7, 0.08);
    this.player.add(this.playerGlow);
    this.player.setSize(18, 18);
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
    this.cameras.main.setZoom(1.4);

    // ─── CONTROLS ───
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey('SPACE');
    this.eKey = this.input.keyboard.addKey('E');

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

  drawPlayerHeart(g, color) {
    g.clear();
    g.fillStyle(color, 0.9);
    // Draw heart shape using circles
    g.fillCircle(-4, -3, 5);
    g.fillCircle(4, -3, 5);
    g.fillCircle(0, 2, 6);
    // Highlight
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(-3, -4, 2);
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

    this.player.body.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

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
      else if (tile === T.WATER) {
        // Slow in water
        this.player.body.setVelocity(vx * PLAYER_SPEED * 0.5, vy * PLAYER_SPEED * 0.5);
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

    // Hit flash
    monster.setTint(0xffffff);
    this.time.delayedCall(80, () => { if (monster.active) monster.clearTint(); });

    // Hit particles
    for (let i = 0; i < 8; i++) {
      this.spawnParticle(monster.x, monster.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, theme.accent, 0.7);
    }

    this.screenShake = 6;

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
      }
    }
  }

  damagePlayer(amount) {
    if (state.player.invincible > 0) return;
    const dmg = Math.max(1, amount - state.player.def);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.player.invincible = 1.0;
    this.screenShake = 8;

    this.cameras.main.flash(200, 239, 68, 68);
    this.addLog(`Took ${dmg} damage!`);

    // Damage particles
    for (let i = 0; i < 6; i++) {
      this.spawnParticle(this.player.x, this.player.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0xEF4444, 0.8);
    }

    if (state.player.hp <= 0) {
      state.phase = 'gameover';
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
    this.addLog('TRAP! Took damage!');
    // Red flash on tile
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xEF4444, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 5; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 50, -Math.random() * 40, 0xEF4444, 0.7);
  }

  triggerHeal(x, y) {
    state.dungeon.map[y][x] = T.FLOOR;
    const heal = 25 + Math.floor(Math.random() * 20);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    this.addLog(`HEAL! Recovered ${heal} HP`);
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
    const flash = this.add.rectangle(x * TILE + TILE/2, y * TILE + TILE/2, TILE, TILE, 0xFBBF24, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    for (let i = 0; i < 8; i++) this.spawnParticle(x * TILE + TILE/2, y * TILE + TILE/2, (Math.random() - 0.5) * 60, -Math.random() * 60, 0xFBBF24, 0.8);
  }

  spawnMonster() {
    const x = 3 + Math.floor(Math.random() * (MAP_W - 6));
    const y = 3 + Math.floor(Math.random() * (MAP_H - 6));
    if (state.dungeon.map[y][x] !== T.FLOOR) return;

    const theme = THEMES[state.floorTheme % THEMES.length];
    const monsterTypes = [
      { name: 'Shadow', color: 0x6B21A8, hp: 25, speed: 45, damage: 8 },
      { name: 'Wraith', color: 0x7C3AED, hp: 35, speed: 55, damage: 12 },
      { name: 'Stalker', color: 0xA855F7, hp: 45, speed: 40, damage: 15 },
      { name: 'Void', color: 0x4C1D95, hp: 55, speed: 50, damage: 18 },
    ];
    const type = monsterTypes[Math.min(Math.floor(state.depth / 2), monsterTypes.length - 1)];

    const monster = this.add.container(x * TILE + TILE/2, y * TILE + TILE/2);
    const body = this.add.graphics();
    body.fillStyle(type.color, 0.8);
    body.fillCircle(0, 0, 10);
    body.fillStyle(0xffffff, 0.3);
    body.fillCircle(-2, -3, 3);
    monster.add(body);

    // Monster glow
    const glow = this.add.circle(0, 0, 18, type.color, 0.1);
    monster.add(glow);

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

    if (state.depth >= state.totalFloors) {
      state.phase = 'victory';
      document.getElementById('gameover-screen').style.display = 'flex';
      document.getElementById('go-stats').innerHTML = `
        FLOOR CLEARED!<br>
        Kills: ${state.kills}<br>
        Gold: ${state.player.gold}<br>
        Level: ${state.player.level} (${state.player.title})
      `;
      document.querySelector('#gameover-screen h2').textContent = 'VICTORY';
      document.querySelector('#gameover-screen h2').style.color = '#FBBF24';
      return;
    }

    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 20);
    this.addLog(`Descending to floor ${state.depth + 1}...`);
    this.time.delayedCall(500, () => this.scene.restart());
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

function startGame() {
  state = {
    phase: 'explore',
    player: { hp: 100, maxHp: 100, atk: 14, def: 5, level: 1, xp: 0, xpNext: 60, gold: 0, title: 'Newbie', invincible: 0 },
    dungeon: null, depth: 0, totalFloors: 7, kills: 0, log: [], visited: new Set(), keys: 0, hasShield: false, floorTheme: 0,
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
