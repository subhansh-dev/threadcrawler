import { Devvit, useState, useInterval } from '@devvit/public-api';

Devvit.configure({ redditAPI: true });

// ─── THREAD → DUNGEON CONVERTER ─────────────────────────────
// Each comment becomes a room. Reply depth = dungeon depth.
// Upvotes = health packs. Downvotes = traps. Awards = power-ups.

interface Room {
  id: string;
  author: string;
  body: string;
  score: number;
  depth: number;
  children: string[];
  hasTrap: boolean;
  hasPowerUp: boolean;
  hasHeal: boolean;
  isDeadEnd: boolean;
  monsterType: string | null;
  lore: string | null;
}

interface DungeonData {
  rooms: Record<string, Room>;
  rootIds: string[];
  totalDepth: number;
  threadTitle: string;
  threadAuthor: string;
  commentCount: number;
  avgScore: number;
  vibe: string;
}

function classifyVibe(comments: any[]): string {
  let panic = 0, tactical = 0, chill = 0, hype = 0;

  const panicWords = ['scary','terrified','help','run','dead','monster','creepy','nightmare','dark','alone'];
  const tacticalWords = ['strategy','plan','attack','defend','weapon','shield','coordinate','flank'];
  const chillWords = ['nice','cool','awesome','love','beautiful','calm','peace','chill','vibes'];
  const hypeWords = ['omg','wow','insane','crazy','lit','fire','goated','bussin','no way'];

  comments.forEach(c => {
    const text = c.body.toLowerCase();
    panicWords.forEach(w => { if (text.includes(w)) panic++; });
    tacticalWords.forEach(w => { if (text.includes(w)) tactical++; });
    chillWords.forEach(w => { if (text.includes(w)) chill++; });
    hypeWords.forEach(w => { if (text.includes(w)) hype++; });
  });

  const max = Math.max(panic, tactical, chill, hype);
  if (max === panic) return 'horror';
  if (max === tactical) return 'strategy';
  if (max === chill) return 'zen';
  if (max === hype) return 'chaos';
  return 'mystery';
}

function generateMonster(vibe: string, depth: number, score: number): string | null {
  if (Math.random() > 0.3 + depth * 0.05) return null;

  const monsters: Record<string, string[]> = {
    horror: ['Shadow Lurker', 'Void Walker', 'Fear Eater', 'Nightmare Shade'],
    strategy: ['Tactician', 'Puzzle Master', 'Trap Setter', 'Gate Keeper'],
    zen: ['Doubt Spirit', 'Negativity Cloud', 'Cynicism Golem', 'Boredom Slime'],
    chaos: ['Wild Card', 'Chaos Imp', 'Random Event', 'Glitch Monster'],
    mystery: ['Secret Keeper', 'Hidden Truth', 'Mystery Box', 'Unknown Entity'],
  };

  const pool = monsters[vibe] || monsters.mystery;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildDungeon(thread: any, comments: any[]): DungeonData {
  const rooms: Record<string, Room> = {};
  const rootIds: string[] = [];
  let totalDepth = 0;
  let scoreSum = 0;

  // Build room for each comment
  comments.forEach(c => {
    const depth = c.depth || 0;
    totalDepth = Math.max(totalDepth, depth);
    scoreSum += Math.abs(c.score);

    const hasTrap = c.score < -2 || Math.random() < 0.08;
    const hasPowerUp = c.awards && c.awards.length > 0 || Math.random() < 0.05;
    const hasHeal = c.score > 5 || Math.random() < 0.12;
    const isDeadEnd = !c.replies || c.replies.length === 0;

    const room: Room = {
      id: c.id,
      author: c.author,
      body: c.body.slice(0, 200),
      score: c.score,
      depth,
      children: (c.replies || []).map((r: any) => r.id),
      hasTrap,
      hasPowerUp,
      hasHeal,
      isDeadEnd,
      monsterType: generateMonster(classifyVibe(comments), depth, c.score),
      lore: depth > 3 ? `Comment by u/${c.author} — a deep thread secret` : null,
    };

    rooms[c.id] = room;
    if (depth === 0) rootIds.push(c.id);
  });

  return {
    rooms,
    rootIds,
    totalDepth,
    threadTitle: thread.title,
    threadAuthor: thread.author,
    commentCount: comments.length,
    avgScore: Math.round(scoreSum / Math.max(1, comments.length)),
    vibe: classifyVibe(comments),
  };
}

// ─── PLAYER STATE (stored in Redis via Devvit) ───────────────
interface PlayerState {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  items: string[];
  currentRoomId: string | null;
  dungeonDepth: number;
  roomsCleared: number;
  monstersSlain: number;
  threadsCrawled: number;
  streak: number;
  lastPlayDate: string;
  achievements: string[];
  title: string;
}

function freshPlayer(): PlayerState {
  return {
    health: 100, maxHealth: 100, attack: 10, defense: 5,
    level: 1, xp: 0, xpToNext: 50, gold: 0, items: [],
    currentRoomId: null, dungeonDepth: 0, roomsCleared: 0,
    monstersSlain: 0, threadsCrawled: 0, streak: 0,
    lastPlayDate: '', achievements: [], title: 'Newbie',
  };
}

function titles(level: number): string {
  if (level >= 20) return 'Thread Lord';
  if (level >= 15) return 'Depth Diver';
  if (level >= 10) return 'Reply Warrior';
  if (level >= 7) return 'Thread Surfer';
  if (level >= 5) return 'Comment Knight';
  if (level >= 3) return 'Post Pilgrim';
  return 'Newbie';
}

// ─── DEVVIT APP ──────────────────────────────────────────────
Devvit.addCustomPostType({
  name: 'Thread Crawler',
  render: (context) => {
    const [started, setStarted] = useState(false);
    const [dungeon, setDungeon] = useState<DungeonData | null>(null);
    const [player, setPlayer] = useState<PlayerState>(freshPlayer());
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [combat, setCombat] = useState<{ active: boolean; monster: string; monsterHp: number; monsterMaxHp: number } | null>(null);
    const [showInventory, setShowInventory] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [gameOver, setGameOver] = useState(false);

    const addLog = (msg: string) => setLog(prev => [...prev.slice(-20), msg]);

    // Load a thread and build dungeon
    const loadDungeon = async () => {
      try {
        // Get hot posts from the current subreddit
        const subreddit = await context.reddit.getSubredditById(context.subredditId);
        const posts = await subreddit.getHotPosts({ limit: 10 });
        const post = posts[Math.floor(Math.random() * posts.length)];

        // Get comments
        const comments = await context.reddit.getComments({
          postId: post.id,
          limit: 50,
          sort: 'best',
        });

        // Build dungeon from thread structure
        const threadData = {
          title: post.title,
          author: post.author,
        };

        const commentData = comments.map(c => ({
          id: c.id,
          author: c.author,
          body: c.body,
          score: c.score,
          depth: 0,
          replies: [],
          awards: [],
        }));

        const dungeonData = buildDungeon(threadData, commentData);
        setDungeon(dungeonData);
        addLog(`Dungeon loaded: "${dungeonData.threadTitle}"`);
        addLog(`Vibe: ${dungeonData.vibe} | ${dungeonData.commentCount} rooms | Depth: ${dungeonData.totalDepth}`);

        // Start at first root room
        if (dungeonData.rootIds.length > 0) {
          const firstRoom = dungeonData.rooms[dungeonData.rootIds[0]];
          setCurrentRoom(firstRoom);
          addLog(`You enter: "${firstRoom.body.slice(0, 60)}..."`);
        }
      } catch (err) {
        addLog('Failed to load dungeon. Try again.');
        console.error(err);
      }
    };

    const startGame = async () => {
      setStarted(true);
      setPlayer(freshPlayer());
      setLog([]);
      await loadDungeon();
    };

    // Movement — pick a child room
    const moveToRoom = (roomId: string) => {
      if (!dungeon) return;
      const room = dungeon.rooms[roomId];
      if (!room) return;

      setCurrentRoom(room);
      setPlayer(prev => ({ ...prev, currentRoomId: roomId, dungeonDepth: Math.max(prev.dungeonDepth, room.depth), roomsCleared: prev.roomsCleared + 1 }));

      addLog(`You move to u/${room.author}'s comment (depth ${room.depth})`);

      // Check for traps
      if (room.hasTrap) {
        const damage = 10 + Math.floor(Math.random() * 15);
        setPlayer(prev => ({ ...prev, health: Math.max(0, prev.health - damage) }));
        addLog(`TRAP! You took ${damage} damage.`);
        if (player.health - damage <= 0) setGameOver(true);
      }

      // Check for heals
      if (room.hasHeal) {
        const heal = 15 + Math.floor(Math.random() * 20);
        setPlayer(prev => ({ ...prev, health: Math.min(prev.maxHealth, prev.health + heal) }));
        addLog(`HEAL! You recovered ${heal} HP from the upvotes.`);
      }

      // Check for power-ups
      if (room.hasPowerUp) {
        const powerUps = ['Sharp Wit (+2 ATK)', 'Thick Skin (+2 DEF)', 'Golden Reply (+10 Gold)', 'Comment Shield (Block next trap)'];
        const powerUp = powerUps[Math.floor(Math.random() * powerUps.length)];
        setPlayer(prev => ({
          ...prev,
          attack: powerUp.includes('ATK') ? prev.attack + 2 : prev.attack,
          defense: powerUp.includes('DEF') ? prev.defense + 2 : prev.defense,
          gold: powerUp.includes('Gold') ? prev.gold + 10 : prev.gold,
          items: powerUp.includes('Shield') ? [...prev.items, 'Comment Shield'] : prev.items,
        }));
        addLog(`POWER-UP: ${powerUp}`);
      }

      // Check for monsters
      if (room.monsterType) {
        const monsterHp = 20 + room.depth * 10 + Math.floor(Math.random() * 15);
        setCombat({ active: true, monster: room.monsterType, monsterHp, monsterMaxHp: monsterHp });
        addLog(`A ${room.monsterType} appears!`);
      }

      // XP for exploring
      setPlayer(prev => {
        const newXp = prev.xp + 5 + room.depth * 2;
        if (newXp >= prev.xpToNext) {
          const newLevel = prev.level + 1;
          addLog(`LEVEL UP! You are now level ${newLevel} — ${titles(newLevel)}`);
          return {
            ...prev,
            level: newLevel,
            xp: newXp - prev.xpToNext,
            xpToNext: Math.floor(prev.xpToNext * 1.5),
            maxHealth: prev.maxHealth + 10,
            health: Math.min(prev.health + 20, prev.maxHealth + 10),
            attack: prev.attack + 1,
            defense: prev.defense + 1,
            title: titles(newLevel),
          };
        }
        return { ...prev, xp: newXp };
      });
    };

    // Combat
    const attack = () => {
      if (!combat) return;
      const damage = Math.max(1, player.attack + Math.floor(Math.random() * 5) - 2);
      const newMonsterHp = combat.monsterHp - damage;
      addLog(`You deal ${damage} damage to ${combat.monster}!`);

      if (newMonsterHp <= 0) {
        setCombat(null);
        setPlayer(prev => ({
          ...prev,
          monstersSlain: prev.monstersSlain + 1,
          xp: prev.xp + 15,
          gold: prev.gold + 5 + Math.floor(Math.random() * 10),
        }));
        addLog(`${combat.monster} defeated! +${5 + Math.floor(Math.random() * 10)} gold`);
      } else {
        // Monster attacks back
        const monsterDamage = Math.max(1, 8 + Math.floor(Math.random() * 8) - player.defense);
        setPlayer(prev => {
          const newHp = Math.max(0, prev.health - monsterDamage)
          if (newHp <= 0) setGameOver(true);
          return { ...prev, health: newHp };
        });
        addLog(`${combat.monster} hits you for ${monsterDamage}!`);
        setCombat({ ...combat, monsterHp: newMonsterHp });
      }
    };

    const flee = () => {
      if (Math.random() < 0.6) {
        setCombat(null);
        addLog('You fled from combat!');
      } else {
        const monsterDamage = 5 + Math.floor(Math.random() * 5);
        setPlayer(prev => {
          const newHp = Math.max(0, prev.health - monsterDamage);
          if (newHp <= 0) setGameOver(true);
          return { ...prev, health: newHp };
        });
        addLog(`Failed to flee! ${combat?.monster} hits you for ${monsterDamage}!`);
      }
    };

    // Check streak
    const today = new Date().toDateString();
    if (player.lastPlayDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const newStreak = player.lastPlayDate === yesterday ? player.streak + 1 : 1;
      setPlayer(prev => ({ ...prev, lastPlayDate: today, streak: newStreak }));
    }

    return (
      <vstack grow padding="small" gap="small">
        {/* Title */}
        <hstack alignment="center middle" gap="small" padding="small">
          <text size="large" weight="bold" color="StarterPrimary">THREAD CRAWLER</text>
          {player.streak > 1 && (
            <text size="small" color="Caution">🔥 {player.streak} day streak</text>
          )}
        </hstack>

        {/* Start screen */}
        {!started && (
          <vstack gap="medium" padding="medium" alignment="center middle" grow>
            <text size="xlarge" weight="bold" color="StarterPrimary">DIVE INTO THREADS</text>
            <text size="medium" alignment="center" color="StarterSecondary">
              Every comment is a room. Every reply is a path deeper.
              Traps lurk in downvoted comments. Heals hide in upvoted ones.
              Monsters guard the deepest threads.
            </text>
            <text size="small" alignment="center" color="StarterTertiary">
              Click rooms to move | Fight monsters | Collect loot | Go deep
            </text>
            <button onPress={startGame} appearance="primary">
              Crawl a Thread
            </button>
          </vstack>
        )}

        {/* Player stats */}
        {started && !gameOver && (
          <hstack gap="small" padding="small" alignment="center middle" wrap>
            <text size="small" color="Danger">HP: {player.health}/{player.maxHealth}</text>
            <text size="small" color="StarterPrimary">ATK: {player.attack}</text>
            <text size="small" color="StarterSecondary">DEF: {player.defense}</text>
            <text size="small" color="Caution">Gold: {player.gold}</text>
            <text size="small" color="StarterTertiary">Lvl: {player.level} ({player.title})</text>
            <text size="small" color="StarterSecondary">XP: {player.xp}/{player.xpToNext}</text>
            <text size="small" color="StarterTertiary">Depth: {player.dungeonDepth}</text>
            <text size="small" color="StarterTertiary">Kills: {player.monstersSlain}</text>
          </hstack>
        )}

        {/* Dungeon header */}
        {started && dungeon && !gameOver && (
          <vstack gap="tiny" padding="small">
            <text size="small" weight="bold" color="StarterPrimary">
              "{dungeon.threadTitle.slice(0, 60)}{dungeon.threadTitle.length > 60 ? '...' : ''}"
            </text>
            <text size="tiny" color="StarterTertiary">
              by u/{dungeon.threadAuthor} | {dungeon.commentCount} rooms | Vibe: {dungeon.vibe} | Avg score: {dungeon.avgScore}
            </text>
          </vstack>
        )}

        {/* Combat */}
        {combat?.active && (
          <vstack gap="small" padding="medium" style={{ background: 'rgba(255,0,0,0.1)', borderRadius: 8 }}>
            <text size="medium" weight="bold" color="Danger">COMBAT: {combat.monster}</text>
            <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
              <div style={{ width: `${(combat.monsterHp / combat.monsterMaxHp) * 100}%`, height: '100%', background: '#ff4444', borderRadius: 4 }} />
            </div>
            <text size="small" color="Danger">{combat.monsterHp}/{combat.monsterMaxHp} HP</text>
            <hstack gap="small">
              <button onPress={attack} appearance="primary">Attack</button>
              <button onPress={flee}>Flee</button>
            </hstack>
          </vstack>
        )}

        {/* Current room + exits */}
        {started && currentRoom && !gameOver && !combat?.active && (
          <vstack gap="small" padding="medium" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <text size="small" weight="bold" color="StarterPrimary">
              Room by u/{currentRoom.author} (depth {currentRoom.depth})
            </text>
            <text size="small" color="StarterSecondary">
              {currentRoom.body}
            </text>
            {currentRoom.hasTrap && <text size="tiny" color="Danger">⚠️ This room has a trap!</text>}
            {currentRoom.hasHeal && <text size="tiny" color="Success">💚 Upvote healing detected</text>}
            {currentRoom.hasPowerUp && <text size="tiny" color="Caution">⭐ Power-up available</text>}
            {currentRoom.monsterType && <text size="tiny" color="Danger">👾 Monster lurking nearby</text>}
            {currentRoom.lore && <text size="tiny" color="StarterTertiary">📜 {currentRoom.lore}</text>}

            {/* Exits */}
            {currentRoom.children.length > 0 ? (
              <vstack gap="tiny">
                <text size="tiny" color="StarterTertiary">EXITS ({currentRoom.children.length} replies):</text>
                {currentRoom.children.slice(0, 5).map(childId => {
                  const child = dungeon!.rooms[childId];
                  if (!child) return null;
                  return (
                    <button key={childId} onPress={() => moveToRoom(childId)} appearance="secondary">
                      → u/{child.author} (score: {child.score})
                    </button>
                  );
                })}
                {currentRoom.children.length > 5 && (
                  <text size="tiny" color="StarterTertiary">...and {currentRoom.children.length - 5} more paths</text>
                )}
              </vstack>
            ) : (
              <text size="tiny" color="StarterTertiary">Dead end. No more replies.</text>
            )}
          </vstack>
        )}

        {/* Game log */}
        {started && (
          <vstack gap="tiny" padding="small" style={{ maxHeight: 120, overflowY: 'auto' }}>
            {log.map((entry, i) => (
              <text key={i} size="tiny" color="StarterTertiary">{entry}</text>
            ))}
          </vstack>
        )}

        {/* Game Over */}
        {gameOver && (
          <vstack gap="small" padding="medium" alignment="center middle">
            <text size="xlarge" weight="bold" color="Danger">YOU DIED</text>
            <text size="medium" color="StarterSecondary">
              Depth: {player.dungeonDepth} | Rooms: {player.roomsCleared} | 
              Kills: {player.monstersSlain} | Gold: {player.gold}
            </text>
            <button onPress={startGame} appearance="primary">Try Again</button>
          </vstack>
        )}
      </vstack>
    );
  },
});

export default Devvit;
