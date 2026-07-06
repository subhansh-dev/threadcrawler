/* ═══════════════════════════════════════════════════════════
   THREAD CRAWLER — Phaser 3 Game Engine
   Math-driven procedural dungeon generation
   ═══════════════════════════════════════════════════════════ */

// ─── MATH UTILITIES ──────────────────────────────────────────
// Perlin noise for organic terrain generation
class PerlinNoise {
  constructor(seed = 42) {
    this.perm = new Uint8Array(512);
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  dot(g, x, y) { return g[0] * x + g[1] * y; }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const aa = this.perm[this.perm[X] + Y] % 12;
    const ab = this.perm[this.perm[X] + Y + 1] % 12;
    const ba = this.perm[this.perm[X + 1] + Y] % 12;
    const bb = this.perm[this.perm[X + 1] + Y + 1] % 12;
    const x1 = this.lerp(this.dot(this.grad3[aa], xf, yf), this.dot(this.grad3[ba], xf - 1, yf), u);
    const x2 = this.lerp(this.dot(this.grad3[ab], xf, yf - 1), this.dot(this.grad3[bb], xf - 1, yf - 1), u);
    return this.lerp(x1, x2, v);
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(a, b, t) { return a + t * (b - a); }
}

// Fractal Brownian Motion for layered noise
function fbm(perlin, x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * perlin.noise2D(x * frequency, y * frequency);
    maxVal += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / maxVal;
}

// Cellular automata for cave-like structures
function cellularAutomata(width, height, fillProb = 0.45, iterations = 5) {
  let grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => Math.random() < fillProb ? 1 : 0)
  );

  for (let iter = 0; iter < iterations; iter++) {
    const newGrid = grid.map(row => [...row]);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            neighbors += grid[y + dy][x + dx];
          }
        }
        newGrid[y][x] = neighbors >= 5 ? 1 : 0;
      }
    }
    grid = newGrid;
  }
  return grid;
}

// ─── GAME CONSTANTS ──────────────────────────────────────────
const TILE = 24;
const MAP_W = 40;
const MAP_H = 30;
const PLAYER_SPEED = 150;
const BULLET_SPEED = 250;

const TILES = {
  FLOOR: 0,
  WALL: 1,
  EXIT: 2,
  SPAWN: 3,
  TRAP: 4,
  HEAL: 5,
  POWER: 6,
};

const TILE_COLORS = {
  [TILES.FLOOR]: 0x1a1a2e,
  [TILES.WALL]: 0x0d0d1a,
  [TILES.EXIT]: 0x22c55e,
  [TILES.SPAWN]: 0x3b82f6,
  [TILES.TRAP]: 0xef4444,
  [TILES.HEAL]: 0x22c55e,
  [TILES.POWER]: 0xfbbf24,
};

// ─── DUNGEON GENERATOR ───────────────────────────────────────
function generateDungeon(seed, depth = 0) {
  const perlin = new PerlinNoise(seed);
  const map = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(TILES.WALL));

  // Phase 1: Cellular automata for cave structure
  const cave = cellularAutomata(MAP_W, MAP_H, 0.42 + depth * 0.02, 5);

  // Phase 2: Perlin noise for organic variation
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const n = fbm(perlin, x * 0.08, y * 0.08, 3);
      if (cave[y][x] === 0 && n > -0.1) {
        map[y][x] = TILES.FLOOR;
      }
    }
  }

  // Phase 3: Ensure connectivity with BSP-like carving
  const rooms = [];
  for (let i = 0; i < 6 + depth * 2; i++) {
    const rw = 4 + Math.floor(Math.random() * 6);
    const rh = 4 + Math.floor(Math.random() * 5);
    const rx = 2 + Math.floor(Math.random() * (MAP_W - rw - 4));
    const ry = 2 + Math.floor(Math.random() * (MAP_H - rh - 4));

    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });

    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        map[y][x] = TILES.FLOOR;
      }
    }
  }

  // Phase 4: Connect rooms with corridors (A* inspired)
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    let x = a.cx, y = a.cy;

    while (x !== b.cx) {
      if (x >= 1 && x < MAP_W - 1 && y >= 1 && y < MAP_H - 1) {
        map[y][x] = TILES.FLOOR;
        if (y + 1 < MAP_H) map[y + 1][x] = TILES.FLOOR;
      }
      x += x < b.cx ? 1 : -1;
    }
    while (y !== b.cy) {
      if (x >= 1 && x < MAP_W - 1 && y >= 1 && y < MAP_H - 1) {
        map[y][x] = TILES.FLOOR;
        if (x + 1 < MAP_W) map[y][x + 1] = TILES.FLOOR;
      }
      y += y < b.cy ? 1 : -1;
    }
  }

  // Phase 5: Place spawn, exit, traps, heals, powers
  const spawnRoom = rooms[0];
  const exitRoom = rooms[rooms.length - 1];
  map[spawnRoom.cy][spawnRoom.cx] = TILES.SPAWN;
  map[exitRoom.cy][exitRoom.cx] = TILES.EXIT;

  // Place hazards in rooms
  rooms.forEach((room, idx) => {
    if (idx === 0) return;
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (map[y][x] !== TILES.FLOOR) continue;
        const r = Math.random();
        if (r < 0.06) map[y][x] = TILES.TRAP;
        else if (r < 0.12) map[y][x] = TILES.HEAL;
        else if (r < 0.16) map[y][x] = TILES.POWER;
      }
    }
  });

  return {
    map,
    spawn: { x: spawnRoom.cx, y: spawnRoom.cy },
    exit: { x: exitRoom.cx, y: exitRoom.cy },
    rooms,
    seed,
    depth,
  };
}

// ─── GAME STATE ──────────────────────────────────────────────
let state = {
  phase: 'title', // title, explore, combat, gameover, victory
  player: { hp: 100, maxHp: 100, atk: 12, def: 5, level: 1, xp: 0, xpNext: 50, gold: 0, title: 'Newbie' },
  dungeon: null,
  currentRoom: 0,
  totalRooms: 5,
  depth: 0,
  kills: 0,
  combat: null,
  log: [],
};

// ─── PHASER SCENES ───────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.scene.start('Game');
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init() {
    this.player = null;
    this.walls = null;
    this.items = null;
    this.exitZone = null;
    this.monster = null;
    this.monsters = [];
    this.bullets = null;
    this.dungeonGraphics = null;
    this.lightMask = null;
    this.camTarget = { x: 0, y: 0 };
    this.smoothCamX = 0;
    this.smoothCamY = 0;
    this.ambientTimer = 0;
    this.spawnMonsterTimer = 0;
    this.screenShake = 0;
  }

  create() {
    // Generate dungeon
    const dungeon = generateDungeon(Date.now(), state.depth);
    state.dungeon = dungeon;

    // Set world bounds
    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    // Draw tilemap
    this.dungeonGraphics = this.add.graphics();
    this.drawMap(dungeon.map);

    // Create walls for collision
    this.walls = this.physics.add.staticGroup();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (dungeon.map[y][x] === TILES.WALL) {
          const wall = this.add.rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE, 0x000000, 0);
          this.physics.add.existing(wall, true);
          this.walls.add(wall);
        }
      }
    }

    // Create exit zone
    this.exitZone = this.add.zone(
      dungeon.exit.x * TILE + TILE / 2,
      dungeon.exit.y * TILE + TILE / 2,
      TILE * 1.5, TILE * 1.5
    );
    this.physics.world.enable(this.exitZone);
    this.exitZone.body.setAllowGravity(false);
    this.exitZone.body.moves = false;

    // Exit glow
    this.exitGlow = this.add.circle(
      dungeon.exit.x * TILE + TILE / 2,
      dungeon.exit.y * TILE + TILE / 2,
      TILE * 0.8, 0x22c55e, 0.15
    );

    // Create player
    this.player = this.add.rectangle(
      dungeon.spawn.x * TILE + TILE / 2,
      dungeon.spawn.y * TILE + TILE / 2,
      TILE * 0.7, TILE * 0.7, 0xa882f7
    );
    this.player.setStrokeStyle(2, 0xc4b5fd);
    this.physics.world.enable(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.walls);

    // Player glow
    this.playerGlow = this.add.circle(0, 0, TILE * 2, 0xa882f7, 0.08);

    // Bullets
    this.bullets = this.physics.add.group();

    // Camera
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.5);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.spaceKey = this.input.keyboard.addKey('SPACE');
    this.eKey = this.input.keyboard.addKey('E');

    // Spawn initial monsters
    for (let i = 0; i < 2 + state.depth; i++) {
      this.spawnMonster();
    }

    // Update UI
    this.updateUI();
    this.addLog(`Entering depth ${state.depth}...`);
    this.addLog(`Seed: ${dungeon.seed} | Rooms: ${dungeon.rooms.length}`);

    // Exit interaction
    this.physics.add.overlap(this.player, this.exitZone, () => {
      if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
        this.nextRoom();
      }
    });
  }

  drawMap(map) {
    const g = this.dungeonGraphics;
    g.clear();

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = map[y][x];
        const px = x * TILE;
        const py = y * TILE;

        if (tile === TILES.WALL) {
          // Wall with noise-based shading
          const shade = 0x0d0d1a + Math.floor(Math.random() * 0x050510);
          g.fillStyle(shade, 1);
          g.fillRect(px, py, TILE, TILE);
          g.lineStyle(1, 0x1a1a2e, 0.3);
          g.strokeRect(px, py, TILE, TILE);
        } else if (tile === TILES.FLOOR) {
          g.fillStyle(0x1a1a2e, 1);
          g.fillRect(px, py, TILE, TILE);
          // Floor detail
          if (Math.random() < 0.1) {
            g.fillStyle(0x1f1f3a, 0.5);
            g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          }
        } else if (tile === TILES.EXIT) {
          g.fillStyle(0x1a1a2e, 1);
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle(0x22c55e, 0.3);
          g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        } else if (tile === TILES.SPAWN) {
          g.fillStyle(0x1a1a2e, 1);
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle(0x3b82f6, 0.2);
          g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        } else if (tile === TILES.TRAP) {
          g.fillStyle(0x1a1a2e, 1);
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle(0xef4444, 0.15);
          g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        } else if (tile === TILES.HEAL) {
          g.fillStyle(0x1a1a2e, 1);
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle(0x22c55e, 0.15);
          g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        } else if (tile === TILES.POWER) {
          g.fillStyle(0x1a1a2e, 1);
          g.fillRect(px, py, TILE, TILE);
          g.fillStyle(0xfbbf24, 0.15);
          g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        }
      }
    }
  }

  update(time, delta) {
    if (state.phase !== 'explore' || !this.player) return;

    const dt = delta / 1000;

    // Player movement
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

    if (vx !== 0 || vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx /= len; vy /= len;
    }

    this.player.body.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    // Update player glow
    this.playerGlow.setPosition(this.player.x, this.player.y);

    // Shooting
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && state.player.atk > 0) {
      this.shoot(vx || 1, vy || 0);
    }

    // Check tile interactions
    const tileX = Math.floor(this.player.x / TILE);
    const tileY = Math.floor(this.player.y / TILE);
    if (tileX >= 0 && tileX < MAP_W && tileY >= 0 && tileY < MAP_H) {
      const tile = state.dungeon.map[tileY][tileX];
      if (tile === TILES.TRAP) {
        this.triggerTrap(tileX, tileY);
      } else if (tile === TILES.HEAL) {
        this.triggerHeal(tileX, tileY);
      } else if (tile === TILES.POWER) {
        this.triggerPower(tileX, tileY);
      }
    }

    // Monster AI
    this.monsters.forEach(m => {
      if (!m.active) return;
      const dx = this.player.x - m.x;
      const dy = this.player.y - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 200) {
        const speed = 60 + state.depth * 10;
        m.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);

        if (dist < 28) {
          this.damagePlayer(8 + state.depth * 2);
          m.destroy();
        }
      } else {
        m.body.setVelocity(0, 0);
      }
    });

    // Monster spawn timer
    this.spawnMonsterTimer += dt;
    if (this.spawnMonsterTimer > 8 && this.monsters.filter(m => m.active).length < 3 + state.depth) {
      this.spawnMonster();
      this.spawnMonsterTimer = 0;
    }

    // Bullet cleanup
    this.bullets.getChildren().forEach(b => {
      if (b.active && (b.x < 0 || b.x > MAP_W * TILE || b.y < 0 || b.y > MAP_H * TILE)) {
        b.destroy();
      }
    });

    // Screen shake
    if (this.screenShake > 0) {
      this.screenShake *= 0.9;
      this.cameras.main.setScroll(
        this.cameras.main.scrollX + (Math.random() - 0.5) * this.screenShake,
        this.cameras.main.scrollY + (Math.random() - 0.5) * this.screenShake
      );
      if (this.screenShake < 0.3) this.screenShake = 0;
    }

    // Exit glow pulse
    if (this.exitGlow) {
      this.exitGlow.setAlpha(0.1 + Math.sin(time * 0.003) * 0.08);
    }

    this.updateUI();
  }

  shoot(dirX, dirY) {
    if (dirX === 0 && dirY === 0) dirX = 1;

    const bullet = this.add.circle(
      this.player.x + dirX * 15,
      this.player.y + dirY * 15,
      3, 0xa882f7
    );
    this.physics.world.enable(bullet);
    bullet.body.setAllowGravity(false);
    bullet.body.setVelocity(dirX * BULLET_SPEED, dirY * BULLET_SPEED);
    this.bullets.add(bullet);

    // Bullet-monster collision
    this.monsters.forEach(m => {
      if (!m.active) return;
      this.physics.add.overlap(bullet, m, () => {
        this.hitMonster(m, 1);
        bullet.destroy();
      });
    });

    // Bullet-wall collision
    this.physics.add.collider(bullet, this.walls, () => bullet.destroy());

    // Auto-destroy after 2s
    this.time.delayedCall(2000, () => { if (bullet.active) bullet.destroy(); });
  }

  hitMonster(monster, damage) {
    state.player.xp += 10;
    state.kills++;

    // Hit effect
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(
        monster.x + (Math.random() - 0.5) * 20,
        monster.y + (Math.random() - 0.5) * 20,
        2, 0xef4444, 0.8
      );
      this.tweens.add({
        targets: p,
        x: p.x + (Math.random() - 0.5) * 40,
        y: p.y + (Math.random() - 0.5) * 40,
        alpha: 0, scale: 0,
        duration: 300,
        onComplete: () => p.destroy()
      });
    }

    monster.destroy();
    this.screenShake = 5;
    this.addLog(`Monster slain! +${10 + state.depth * 2} XP`);
    state.player.gold += 5 + state.depth * 2;

    // Level up check
    if (state.player.xp >= state.player.xpNext) {
      state.player.level++;
      state.player.xp -= state.player.xpNext;
      state.player.xpNext = Math.floor(state.player.xpNext * 1.5);
      state.player.maxHp += 10;
      state.player.hp = Math.min(state.player.hp + 25, state.player.maxHp);
      state.player.atk += 2;
      state.player.def += 1;
      state.player.title = this.getTitle(state.player.level);
      this.addLog(`LEVEL UP! Now ${state.player.title}`);
    }
  }

  damagePlayer(amount) {
    const dmg = Math.max(1, amount - state.player.def);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    this.screenShake = 8;

    this.cameras.main.flash(200, 239, 68, 68);
    this.addLog(`Took ${dmg} damage!`);

    if (state.player.hp <= 0) {
      state.phase = 'gameover';
      this.addLog('You died...');
      this.updateUI();
    }
  }

  triggerTrap(x, y) {
    state.dungeon.map[y][x] = TILES.FLOOR;
    const dmg = 15 + Math.floor(Math.random() * 10);
    this.damagePlayer(dmg);
    this.addLog(`TRAP! Took ${dmg} damage!`);

    // Red flash on tile
    const flash = this.add.rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE, 0xef4444, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  }

  triggerHeal(x, y) {
    state.dungeon.map[y][x] = TILES.FLOOR;
    const heal = 20 + Math.floor(Math.random() * 15);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    this.addLog(`HEAL! Recovered ${heal} HP`);

    const flash = this.add.rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE, 0x22c55e, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  }

  triggerPower(x, y) {
    state.dungeon.map[y][x] = TILES.FLOOR;
    const roll = Math.random();
    if (roll < 0.4) { state.player.atk += 2; this.addLog('Sharp Wit! +2 ATK'); }
    else if (roll < 0.7) { state.player.def += 1; this.addLog('Thick Skin! +1 DEF'); }
    else { state.player.gold += 20; this.addLog('Golden Reply! +20 Gold'); }

    const flash = this.add.rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE, TILE, 0xfbbf24, 0.4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  }

  spawnMonster() {
    const x = 3 + Math.floor(Math.random() * (MAP_W - 6));
    const y = 3 + Math.floor(Math.random() * (MAP_H - 6));
    if (state.dungeon.map[y][x] !== TILES.FLOOR) return;

    const monster = this.add.rectangle(
      x * TILE + TILE / 2,
      y * TILE + TILE / 2,
      TILE * 0.6, TILE * 0.6,
      0xef4444
    );
    monster.setStrokeStyle(1, 0xf87171);
    this.physics.world.enable(monster);
    monster.body.setCollideWorldBounds(true);
    this.physics.add.collider(monster, this.walls);
    this.monsters.push(monster);
  }

  nextRoom() {
    state.currentRoom++;
    state.depth++;

    if (state.currentRoom >= state.totalRooms) {
      state.phase = 'victory';
      this.addLog('THREAD CLEARED!');
      this.updateUI();
      return;
    }

    // Regen some HP
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 15);

    // Restart with new dungeon
    this.scene.restart();
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

    // Update HTML UI elements
    const hpBar = document.getElementById('hp-fill');
    const goldText = document.getElementById('gold-text');
    const levelText = document.getElementById('level-text');
    const depthText = document.getElementById('depth-text');
    const logEl = document.getElementById('game-log');

    if (hpBar) hpBar.style.width = `${(p.hp / p.maxHp) * 100}%`;
    if (goldText) goldText.textContent = p.gold;
    if (levelText) levelText.textContent = `Lv.${p.level}`;
    if (depthText) depthText.textContent = `Depth ${state.depth}`;
    if (logEl) {
      logEl.innerHTML = state.log.slice(-10).map(l => `<div class="log-entry">${l}</div>`).join('');
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
  backgroundColor: '#08080f',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  pixelArt: true,
  antialias: false,
};

let game = null;

// ─── UI FUNCTIONS ────────────────────────────────────────────
function startGame() {
  state = {
    phase: 'explore',
    player: { hp: 100, maxHp: 100, atk: 12, def: 5, level: 1, xp: 0, xpNext: 50, gold: 0, title: 'Newbie' },
    dungeon: null,
    currentRoom: 0,
    totalRooms: 5,
    depth: 0,
    kills: 0,
    combat: null,
    log: [],
  };

  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';

  if (game) {
    game.destroy(true);
  }
  game = new Phaser.Game(config);
}

function restartGame() {
  if (game) game.destroy(true);
  document.getElementById('gameover-screen').style.display = 'none';
  document.getElementById('title-screen').style.display = 'flex';
}

// ─── INIT ────────────────────────────────────────────────────
document.getElementById('title-screen').style.display = 'flex';
document.getElementById('game-screen').style.display = 'none';
document.getElementById('gameover-screen').style.display = 'none';
