# Thread Crawler

A Reddit-powered roguelike dungeon crawler built with Phaser.js. Threads become dungeons — comments become loot, floors, and community scaling.

## Quick Start

```bash
# Local play (no Reddit needed)
python -m http.server 3000 --directory webroot
# Open: http://localhost:3000

# With community scaling (simulates 50 comments)
# Open: http://localhost:3000?comments=50
```

## How It Works

1. A Reddit thread is posted as a Devvit Playtest app
2. The thread title + post body generate a procedural dungeon
3. Players explore floors, kill monsters, collect loot
4. Community engagement (comments) scales the dungeon

---

## Community Scaling System

Every thread starts with **10 base floors**. Community comments change everything:

### Floor Count

| Comments | Floors | Effect |
|----------|--------|--------|
| 0 | 10 | Base dungeon |
| 20 | 11 | +1 floor |
| 50 | 12 | +2 floors |
| 100 | 15 | +5 floors |
| 200 | 20 | 10 bonus floors |

Formula: `totalFloors = 10 + floor(comments / 20)`

### Community Multiplier

The multiplier scales ALL rewards. It grows with comments:

```
multiplier = 1 + (comments / 20) * 0.2
```

| Comments | Multiplier |
|----------|------------|
| 0 | 1.0x |
| 20 | 1.2x |
| 40 | 1.4x |
| 100 | 2.0x |
| 200 | 3.0x |

What it scales:
- **XP from kills** — more comments = faster leveling
- **Gold from kills** — better loot drops
- **Item drop rates** — higher chance of rare items
- **Heal/Power-up spawns** — more consumables per floor
- **Chest gold amount** — chests contain more gold

### Enemy Scaling

Enemies get harder every floor AND respond to community engagement:

| Floor | Base HP | HP per Floor | Damage per Floor |
|-------|---------|--------------|------------------|
| 0 | 25-65 | +12 | +3 |
| 5 | 85-125 | +12 | +3 |
| 10 | 145-185 | +12 | +3 |

Monster count per floor: `min(floor(4 + depth * 1.5 * sqrt(multiplier)), 14)`

With 100 comments (2x multiplier), floor 5 has ~12 enemies instead of ~10.

### Monster Types (by floor)

| Floor Range | Monster | Behavior |
|-------------|---------|----------|
| 0-1 | Shadow Crawler | Flank (circle strafe) |
| 2-3 | Lost Soul | Phase (walks through walls) |
| 4-5 | Flesh Golem | Charge (rushes at player) |
| 6-7 | Void Stalker | Teleport (blinks around) |
| 8+ | Bone Horror | Ranged (shoots projectiles) |

### Bosses

Bosses appear on specific floors and are significantly stronger than regular enemies:

| Floor | Boss | HP | Damage |
|-------|------|----|--------|
| 4 | Bone Serpent | 120 | 20 |
| 9 | Shadow Lord | 200 | 30 |

---

## Bonus Rooms (Every 20 Comments)

When a thread has **20+ comments**, bonus rooms start appearing on every floor:

- **1 bonus room per 20 comments** (e.g., 60 comments = 3 bonus rooms per floor)
- Each bonus room contains:
  - 3-5 chests with random loot
  - 1-2 heal pickups
  - 1-2 power-up pickups
  - 2-3 roaming monsters

Bonus rooms appear as green-highlighted doorways on the minimap.

---

## Community-Locked Chests

Special chests that only appear when a thread has **20+ comments**:

- Appear as dark blue/purple tiles on the minimap
- Need **20+ comments** to open
- When opened, drop **2x better loot** than regular chests:
  - Guaranteed weapon or armor drop
  - Bonus gold (scaled by community multiplier)
  - Higher chance of rare items

---

## Tile Types

| Tile | ID | Color | Description |
|------|----|-------|-------------|
| Floor | 1 | — | Walkable ground |
| Wall | 2 | — | Impassable wall |
| Door | 3 | — | Connects rooms |
| Chest | 4 | — | Contains loot |
| Trap | 5 | — | Damage on step |
| Healer | 6 | — | Restores HP |
| Power-up | 7 | — | Temporary buff |
| Stairs | 8 | — | Not used |
| Shop | 9 | — | Not used |
| Tall Grass | 10 | — | Random encounters |
| Spawn | 11 | — | Player start |
| Exit | 12 | — | Next floor |
| Water | 13 | — | Slow movement |
| Locked Door | 14 | — | Needs key |
| Secret Floor | 15 | — | Hidden room |
| Pit | 16 | — | Fall damage |
| Checkpoint | 17 | — | Save point |
| Bonus | 24 | — | Community bonus room |
| Locked Chest | 23 | — | Community-locked chest |

---

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Space | Attack (melee) |
| E | Interact (chests, doors, exit) |
| Q | Use ability (if unlocked) |
| 1-4 | Use inventory item |
| Tab | Toggle inventory |
| M | Toggle map |
| Esc | Pause |
| Click | Attack in direction |

---

## Items & Equipment

### Weapons

| Name | Damage | Special |
|------|--------|---------|
| Rusty Sword | +5 | None |
| Iron Blade | +8 | None |
| Shadow Dagger | +12 | Crit +15% |
| Bone Cleaver | +16 | Stun chance |
| Void Edge | +22 | Lifesteal 5% |
| Flamebrand | +28 | Burn DOT |

### Armor

| Name | Defense | Special |
|------|---------|---------|
| Leather Vest | +3 | None |
| Chainmail | +6 | None |
| Shadow Cloak | +10 | Dodge +10% |
| Bone Plate | +14 | Damage reduce 5% |
| Void Shroud | +18 | HP regen 1/tick |
| Dragon Scale | +24 | Fire resist |

### Consumables

| Name | Effect |
|------|--------|
| Health Potion | Restore 30 HP |
| Super Potion | Restore 60 HP |
| Full Restore | Restore max HP |
| Attack Boost | +5 ATK for 3 floors |
| Defense Boost | +5 DEF for 3 floors |
| Speed Boost | +30% speed for 3 floors |

---

## Achievements

| ID | Name | Description |
|----|------|-------------|
| first_kill | First Blood | Kill your first monster |
| floor_3 | Explorer | Reach floor 3 |
| floor_7 | Thread Master | Clear all floors |
| kills_10 | Warrior | Kill 10 monsters |
| kills_50 | Monster Slayer | Kill 50 monsters |
| gold_500 | Treasure Hunter | Collect 500 gold |
| gold_1000 | Vault Breaker | Collect 1000 gold |
| combo_5 | Combo King | 5-hit combo |
| combo_10 | Devastator | 10-hit combo |
| no_hit_floor | Untouchable | Clear a floor without taking damage |

---

## Architecture

```
webroot/
  game.js      — Main game (~4100 lines): Phaser scenes, dungeon gen, combat, UI
  index.html   — Gameboy shell UI, overlays, HUD
src/
  main.tsx     — Devvit server: Reddit API, thread→dungeon conversion
package.json   — Devvit dependencies
```

### Devvit Integration

The game runs as a Reddit Devvit app. The server:

1. Receives thread data via `getPostContent`
2. Extracts title, body, author, comment count
3. Generates dungeon seed from thread hash
4. Passes data to client via URL params:
   - `?comments=N` — comment count
   - `?seed=XXXXX` — dungeon seed
   - `?title=XXX` — thread title

### Dungeon Generation

1. Cellular automata (5 passes) → organic cave shape
2. Room carving (binary space partition) → rooms
3. Corridor pathfinding (A*) → connects rooms
4. Feature placement → spawn, exit, chests, traps
5. Theme coloring → 8 floor themes rotate
6. Community scaling → bonus rooms, locked chests

---

## Running Locally

```bash
# No dependencies needed — just static files
python -m http.server 3000 --directory webroot
# Open http://localhost:3000

# With simulated community engagement
# Open http://localhost:3000?comments=100

# Devvit mode (requires Reddit dev account)
npm install
npm run dev
```

---

## License

MIT
