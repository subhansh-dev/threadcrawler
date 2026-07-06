/* ═══════════════════════════════════════════════════════════
   THREAD CRAWLER — Reddit Dungeon Crawler
   Each comment is a room. Each reply is a path deeper.
   ═══════════════════════════════════════════════════════════ */

const app = document.getElementById('app');

// ─── GAME STATE ──────────────────────────────────────────────
let state = {
  phase: 'start', // start, explore, combat, victory, dead
  player: {
    hp: 100, maxHp: 100,
    atk: 12, def: 5,
    level: 1, xp: 0, xpNext: 50,
    gold: 0, items: [],
    title: 'Newbie',
  },
  dungeon: null,
  currentRoom: null,
  combat: null,
  log: [],
  depth: 0,
  roomsCleared: 0,
  kills: 0,
  visited: new Set(),
};

// ─── MOCK DUNGEON (simulates Reddit thread structure) ────────
function generateMockDungeon() {
  const vibes = ['horror', 'strategy', 'zen', 'chaos', 'mystery'];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];

  const authors = ['QuantumLeap42', 'NightOwlDev', 'PixelDreamer', 'CodeNinja42', 'VoidWalker',
    'RedditUser99', 'TechWizard', 'CosmicDust', 'NeonRider', 'ShadowPulse',
    'DataMonk', 'GlitchHunter', 'ByteRunner', 'CloudSurfer', 'DeepDiver'];

  const horrorRooms = [
    'I heard footsteps behind me. Then silence. Then the breathing started again.',
    'The lights flickered. In the darkness, something moved.',
    'Has anyone else noticed the figure standing in the corner of room 3?',
    'DO NOT OPEN THE THIRD DOOR. Trust me on this one.',
    'The walls are closing in. I can feel them.',
    'Something is wrong with the mirrors. Don\'t look at them after midnight.',
    'I found a journal. The last entry just says "it\'s behind you" over and over.',
    'The elevator only goes down. It hasn\'t stopped on floor 13 yet.',
  ];

  const strategyRooms = [
    'If you stockpile supplies early, you can survive the later waves.',
    'The boss has a 3-second vulnerability window after its charge attack.',
    'Always keep at least one heal for the final room. Trust me.',
    'The optimal path is left, right, right, left. Gets you the best loot.',
    'Group up for the boss fight. Solo is suicide past depth 5.',
    'Stock up on shields before entering the facility section.',
    'The pattern repeats every 7 rooms. Memorize it.',
    'Turrets can be disabled with the red switch on the ceiling.',
  ];

  const zenRooms = [
    'Take a moment. Breathe. The dungeon will still be here.',
    'Sometimes the best strategy is patience.',
    'I found a quiet room with no enemies. Just vibes.',
    'The ambient music in this section is actually really nice.',
    'Sit and listen. The dungeon tells stories if you pay attention.',
    'Not every room needs to be cleared. Some are just... peaceful.',
    'The sunlight filtering through the cracks is beautiful.',
    'I left some supplies here for the next traveler.',
  ];

  const chaosRooms = [
    'WHAT IS HAPPENING THE FLOOR IS LAVA NO WAIT NOW IT\'S ICE',
    'THE ROOM IS SPINNING IS ANYONE ELSE SEEING THIS',
    'I pressed a button and now there are 47 bats everywhere',
    'THE RULES CHANGED MID-FIGHT WHAT KIND OF GAME IS THIS',
    'Something exploded. I think it was me.',
    'THE walls are breathing again. Or maybe that was me.',
    'I found a room that doesn\'t follow any known physics.',
    'THE EXIT MOVED. THE EXIT LITERALLY MOVED.',
  ];

  const mysteryRooms = [
    'There\'s a locked door here. No keyhole. No handle. Just... locked.',
    'The inscription reads: "Only the worthy may pass." What does that mean?',
    'I found a note: "The truth is in the pattern." What pattern?',
    'This room looks exactly like the first one. Déjà vu or something else?',
    'There\'s a painting here. The eyes seem to follow you.',
    'The numbers on the wall: 3, 7, 12, 19. What do they mean?',
    'A voice whispers: "You\'re not the first to come here."',
    'The exit is here, but something feels wrong about it.',
  ];

  const roomSets = { horror: horrorRooms, strategy: strategyRooms, zen: zenRooms, chaos: chaosRooms, mystery: mysteryRooms };

  function makeRoom(depth, parentId) {
    const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pool = roomSets[vibe];
    const body = pool[Math.floor(Math.random() * pool.length)];
    const score = Math.floor(Math.random() * 40) - 5;
    const hasTrap = score < -2 || Math.random() < 0.12;
    const hasHeal = score > 5 || Math.random() < 0.15;
    const hasPower = Math.random() < 0.08;
    const hasMonster = depth > 0 && Math.random() < 0.25 + depth * 0.05;

    const monsters = ['Shadow Lurker', 'Void Walker', 'Fear Eater', 'Thread Beast',
      'Comment Ghoul', 'Reply Phantom', 'Upvote Golem', 'Downvote Wraith',
      'Spoiler Spider', 'Locked Door Guardian', 'Thread Necromancer'];

    return {
      id, depth, parentId,
      author: authors[Math.floor(Math.random() * authors.length)],
      body, score,
      children: [],
      hasTrap, hasHeal, hasPower,
      monster: hasMonster ? {
        name: monsters[Math.floor(Math.random() * monsters.length)],
        hp: 20 + depth * 12 + Math.floor(Math.random() * 20),
        maxHp: 20 + depth * 12 + Math.floor(Math.random() * 20),
      } : null,
      isDeadEnd: Math.random() < 0.3 || depth > 4,
    };
  }

  // Build tree
  const rooms = {};
  const queue = [];
  const root = makeRoom(0, null);
  rooms[root.id] = root;
  queue.push(root);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth >= 5 || current.isDeadEnd) continue;

    const childCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < childCount; i++) {
      const child = makeRoom(current.depth + 1, current.id);
      current.children.push(child.id);
      rooms[child.id] = child;
      queue.push(child);
    }
  }

  return { rooms, rootId: root.id, vibe, totalRooms: Object.keys(rooms).length };
}

// ─── RENDER ──────────────────────────────────────────────────
function render() {
  if (state.phase === 'start') renderStart();
  else if (state.phase === 'explore') renderExplore();
  else if (state.phase === 'combat') renderCombat();
  else if (state.phase === 'dead') renderDead();
  else if (state.phase === 'victory') renderVictory();
}

function renderStart() {
  app.innerHTML = `
    <div class="header glass glass-pill" style="margin-bottom:12px;">
      <div class="logo">
        <div class="logo-icon">🕳️</div>
        THREAD CRAWLER
      </div>
      <div class="stats-bar">
        <span style="opacity:0.4;font-size:10px;">v1.0</span>
      </div>
    </div>
    <div class="start-screen">
      <div class="start-icon">🕳️</div>
      <h1 class="start-title">Dive Into Threads</h1>
      <p class="start-desc">
        Every comment is a room. Every reply is a path deeper.
        Traps lurk in downvoted comments. Heals hide in upvoted ones.
        Monsters guard the deepest threads.
      </p>
      <button class="btn btn-start" onclick="startGame()">Crawl a Thread</button>
      <p class="start-hint">Based on real Reddit thread structure</p>
    </div>
  `;
}

function renderExplore() {
  const room = state.currentRoom;
  const dungeon = state.dungeon;
  if (!room || !dungeon) return;

  const p = state.player;
  const depthPips = Array.from({ length: 6 }, (_, i) => {
    let cls = 'depth-pip';
    if (i === room.depth) cls += ' active';
    else if (i < room.depth) cls += ' visited';
    return `<div class="${cls}"></div>`;
  }).join('');

  const indicators = [];
  if (room.hasTrap) indicators.push('<span class="indicator ind-trap">⚠ TRAP</span>');
  if (room.hasHeal) indicators.push('<span class="indicator ind-heal">♥ HEAL</span>');
  if (room.hasPower) indicators.push('<span class="indicator ind-power">★ POWER</span>');
  if (room.monster) indicators.push('<span class="indicator ind-monster">👾 MONSTER</span>');

  const exits = room.children.map(id => {
    const child = dungeon.rooms[id];
    if (!child) return '';
    return `
      <button class="exit-btn fade-in" onclick="moveTo('${id}')">
        <span class="exit-arrow">→</span>
        <div style="flex:1;min-width:0;">
          <span class="exit-author">u/${child.author}</span>
          <div class="exit-preview">${child.body.slice(0, 55)}...</div>
        </div>
        <span class="exit-score">⬆ ${child.score}</span>
      </button>
    `;
  }).join('');

  app.innerHTML = `
    <div class="header glass glass-pill" style="margin-bottom:10px;">
      <div class="logo">
        <div class="logo-icon">🕳️</div>
        THREAD CRAWLER
      </div>
      <div class="stats-bar">
        <div class="stat stat-hp"><div class="stat-dot"></div>${p.hp}/${p.maxHp}</div>
        <div class="stat stat-gold"><div class="stat-dot"></div>${p.gold}</div>
        <div class="stat stat-xp"><div class="stat-dot"></div>Lv.${p.level}</div>
      </div>
    </div>

    <div class="thread-card glass fade-in">
      <div class="thread-title">"${dungeon.threadTitle.slice(0, 70)}${dungeon.threadTitle.length > 70 ? '...' : ''}"</div>
      <div class="thread-meta">
        <span>by u/${dungeon.threadAuthor}</span>
        <span>${dungeon.totalRooms} rooms</span>
        <span class="vibe-badge vibe-${dungeon.vibe}">● ${dungeon.vibe}</span>
      </div>
      <div class="depth-bar">${depthPips}</div>
    </div>

    <div class="thread-card glass fade-in">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="color:var(--accent);font-weight:600;font-size:12px;">u/${room.author}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);">Score: ${room.score}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);">Depth: ${room.depth}</span>
      </div>
      <div class="thread-body">${room.body}</div>
      ${indicators.length > 0 ? `<div class="indicators">${indicators.join('')}</div>` : ''}
    </div>

    ${room.children.length > 0 ? `
      <div class="thread-card glass fade-in">
        <div class="exits-label">REPLY PATHS (${room.children.length})</div>
        <div class="exits">${exits}</div>
      </div>
    ` : `
      <div class="thread-card glass fade-in" style="text-align:center;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Dead end. No more replies.</div>
        <button class="btn btn-secondary" onclick="goBack()">← Back up</button>
      </div>
    `}

    <div class="log-card glass fade-in">
      ${state.log.slice(-15).map(l => `<div class="log-entry ${l.cls || ''}">${l.text}</div>`).join('')}
    </div>
  `;
}

function renderCombat() {
  const p = state.player;
  const c = state.combat;
  if (!c) return;

  const hpPercent = (c.hp / c.maxHp) * 100;

  app.innerHTML = `
    <div class="header glass glass-pill" style="margin-bottom:10px;">
      <div class="logo">
        <div class="logo-icon">🕳️</div>
        THREAD CRAWLER
      </div>
      <div class="stats-bar">
        <div class="stat stat-hp"><div class="stat-dot"></div>${p.hp}/${p.maxHp}</div>
        <div class="stat stat-gold"><div class="stat-dot"></div>${p.gold}</div>
        <div class="stat stat-xp"><div class="stat-dot"></div>Lv.${p.level}</div>
      </div>
    </div>

    <div class="combat-card glass fade-in">
      <div class="combat-title">
        <div class="combat-monster-icon">👾</div>
        ${c.name}
      </div>
      <div class="health-bar"><div class="health-fill" style="width:${hpPercent}%"></div></div>
      <div class="health-text">${c.hp}/${c.maxHp} HP</div>
      <div class="combat-actions">
        <button class="btn btn-primary" onclick="attack()">⚔ Attack (${p.atk} ATK)</button>
        <button class="btn btn-secondary" onclick="flee()">🏃 Flee</button>
      </div>
    </div>

    <div class="log-card glass fade-in">
      ${state.log.slice(-15).map(l => `<div class="log-entry ${l.cls || ''}">${l.text}</div>`).join('')}
    </div>
  `;
}

function renderDead() {
  const p = state.player;
  app.innerHTML = `
    <div class="header glass glass-pill" style="margin-bottom:10px;">
      <div class="logo">
        <div class="logo-icon">🕳️</div>
        THREAD CRAWLER
      </div>
    </div>
    <div class="game-over glass fade-in">
      <div class="game-over-icon">💀</div>
      <h2>YOU DIED</h2>
      <div class="game-over-stats">
        Depth reached: ${state.depth}<br>
        Rooms cleared: ${state.roomsCleared}<br>
        Monsters slain: ${state.kills}<br>
        Gold collected: ${p.gold}<br>
        Level: ${p.level} (${p.title})
      </div>
      <button class="btn btn-start" onclick="startGame()">Try Again</button>
    </div>
  `;
}

function renderVictory() {
  const p = state.player;
  app.innerHTML = `
    <div class="header glass glass-pill" style="margin-bottom:10px;">
      <div class="logo">
        <div class="logo-icon">🕳️</div>
        THREAD CRAWLER
      </div>
    </div>
    <div class="game-over glass fade-in">
      <div class="game-over-icon">🏆</div>
      <h2 style="color:var(--peach);">THREAD CLEARED</h2>
      <div class="game-over-stats">
        Max depth: ${state.depth}<br>
        Rooms cleared: ${state.roomsCleared}<br>
        Monsters slain: ${state.kills}<br>
        Gold collected: ${p.gold}<br>
        Level: ${p.level} (${p.title})
      </div>
      <button class="btn btn-start" onclick="startGame()">Crawl Another</button>
    </div>
  `;
}

// ─── GAME ACTIONS ────────────────────────────────────────────
function startGame() {
  const dungeon = generateMockDungeon();
  state = {
    phase: 'explore',
    player: { hp: 100, maxHp: 100, atk: 12, def: 5, level: 1, xp: 0, xpNext: 50, gold: 0, items: [], title: 'Newbie' },
    dungeon,
    currentRoom: dungeon.rooms[dungeon.rootId],
    combat: null,
    log: [{ text: `Dungeon loaded: "${dungeon.threadTitle.slice(0, 50)}..."`, cls: '' }],
    depth: 0,
    roomsCleared: 0,
    kills: 0,
    visited: new Set([dungeon.rootId]),
  };
  render();
}

function moveTo(roomId) {
  const room = state.dungeon.rooms[roomId];
  if (!room) return;

  state.currentRoom = room;
  state.roomsCleared++;
  state.visited.add(roomId);
  state.depth = Math.max(state.depth, room.depth);

  state.log.push({ text: `→ Moved to u/${room.author}'s comment (depth ${room.depth})` });

  // Traps
  if (room.hasTrap) {
    const dmg = 10 + Math.floor(Math.random() * 15);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.log.push({ text: `⚠️ TRAP! Took ${dmg} damage!`, cls: 'log-trap' });
    if (state.player.hp <= 0) { state.phase = 'dead'; render(); return; }
  }

  // Heals
  if (room.hasHeal) {
    const heal = 15 + Math.floor(Math.random() * 20);
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
    state.log.push({ text: `💚 HEAL! Recovered ${heal} HP from upvotes!`, cls: 'log-heal' });
  }

  // Power-ups
  if (room.hasPower) {
    const roll = Math.random();
    if (roll < 0.3) { state.player.atk += 2; state.log.push({ text: '⭐ Sharp Wit! +2 ATK', cls: 'log-power' }); }
    else if (roll < 0.6) { state.player.def += 2; state.log.push({ text: '⭐ Thick Skin! +2 DEF', cls: 'log-power' }); }
    else { state.player.gold += 15; state.log.push({ text: '⭐ Golden Reply! +15 Gold', cls: 'log-power' }); }
  }

  // XP
  state.player.xp += 5 + room.depth * 3;
  if (state.player.xp >= state.player.xpNext) {
    state.player.level++;
    state.player.xp -= state.player.xpNext;
    state.player.xpNext = Math.floor(state.player.xpNext * 1.5);
    state.player.maxHp += 10;
    state.player.hp = Math.min(state.player.hp + 25, state.player.maxHp);
    state.player.atk += 1;
    state.player.def += 1;
    state.player.title = getTitle(state.player.level);
    state.log.push({ text: `🎉 LEVEL UP! Now Level ${state.player.level} — ${state.player.title}`, cls: 'log-level' });
  }

  // Monster
  if (room.monster) {
    state.combat = { ...room.monster };
    state.phase = 'combat';
    state.log.push({ text: `👾 ${room.monster.name} appears!`, cls: 'log-combat' });
    render();
    return;
  }

  render();
}

function goBack() {
  const room = state.currentRoom;
  if (!room || !room.parentId) return;
  state.currentRoom = state.dungeon.rooms[room.parentId];
  state.log.push({ text: `← Back to u/${state.currentRoom.author}'s comment` });
  render();
}

function attack() {
  if (!state.combat) return;
  const dmg = Math.max(1, state.player.atk + Math.floor(Math.random() * 6) - 3);
  state.combat.hp -= dmg;
  state.log.push({ text: `⚔️ You deal ${dmg} damage!`, cls: '' });

  if (state.combat.hp <= 0) {
    state.log.push({ text: `🏆 ${state.combat.name} defeated! +${10 + state.player.level * 3} gold`, cls: 'log-level' });
    state.player.gold += 10 + state.player.level * 3;
    state.kills++;
    state.combat = null;
    state.phase = 'explore';
    render();
    return;
  }

  // Monster attacks back
  const monsterDmg = Math.max(1, 8 + Math.floor(Math.random() * 8) - state.player.def);
  state.player.hp = Math.max(0, state.player.hp - monsterDmg);
  state.log.push({ text: `👾 ${state.combat.name} hits for ${monsterDmg}!`, cls: 'log-trap' });

  if (state.player.hp <= 0) {
    state.phase = 'dead';
    render();
    return;
  }

  render();
}

function flee() {
  if (Math.random() < 0.6) {
    state.log.push({ text: '🏃 Escaped successfully!', cls: '' });
    state.combat = null;
    state.phase = 'explore';
  } else {
    const dmg = 5 + Math.floor(Math.random() * 5);
    state.player.hp = Math.max(0, state.player.hp - dmg);
    state.log.push({ text: `🏃 Failed to flee! ${state.combat.name} hits for ${dmg}!`, cls: 'log-trap' });
    if (state.player.hp <= 0) { state.phase = 'dead'; }
  }
  render();
}

function getTitle(level) {
  if (level >= 20) return 'Thread Lord';
  if (level >= 15) return 'Depth Diver';
  if (level >= 10) return 'Reply Warrior';
  if (level >= 7) return 'Thread Surfer';
  if (level >= 5) return 'Comment Knight';
  if (level >= 3) return 'Post Pilgrim';
  return 'Newbie';
}

// ─── INIT ────────────────────────────────────────────────────
render();
