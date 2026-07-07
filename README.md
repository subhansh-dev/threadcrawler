# Thread Crawler

[![Phaser](https://img.shields.io/badge/Phaser-3.60-000?logo=phaser&logoColor=white)](https://phaser.io)
[![Devvit](https://img.shields.io/badge/Devvit-Reddit-FF4500?logo=reddit&logoColor=white)](https://developers.reddit.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Pokemon Gameboy-style dungeon crawler where Reddit comment threads become the dungeon. Every comment is a room. Every reply is a path deeper.

Built for the [Reddit Game Hackathon](https://www.reddit.com/r/GamesOnReddit/).

---

## The Core Idea

Thread Crawler takes a real Reddit comment thread and turns it into a playable dungeon. The comment tree structure becomes the dungeon layout:

- **Root comments** are the starting rooms on the first floor
- **Replies** branch off into deeper corridors
- **Deep threads** become the deepest, most dangerous parts of the dungeon
- **Upvotes** = health pickups, **Downvotes** = traps, **Awards** = power-ups

## How Reddit Maps to Game Mechanics

| Reddit Concept | Game Mechanic |
|---|---|
| Comment | Room you can stand in |
| Reply | Path leading deeper |
| Upvote (positive score) | Health pickup |
| Downvote (negative score) | Damage trap |
| Award/Gilding | Power-up item |
| Thread depth | Dungeon floor number |
| Comment count | Total rooms available |

## Gameplay

**Movement:** WASD or Arrow Keys. D-pad touch support on mobile.

**Combat:** SPACE to fire projectiles. Monsters patrol rooms and chase you when close.

**Interaction:** Press E near the exit stairs to descend.

**Items:**
- Red cracked tiles = traps (damage + status effects)
- Green cross tiles = heals
- Gold star tiles = power-ups (random stat boost)
- Brown chest tiles = treasure (gold + items)

## Controls

| Key | Action |
|---|---|
| W/A/S/D or Arrows | Move |
| SPACE | Shoot |
| E | Interact with exit |
| I | Open/close bag |

## Gameboy UI

The game runs inside a pixel-art Gameboy DMG-01 shell:

- **Screen** — 480×340 Phaser canvas with Pokemon-style 16×16 tile rendering
- **HUD** — HP bar, XP bar, gold, level, combo counter, weapon display
- **D-pad** — Touch-compatible directional buttons
- **A/B buttons** — Mapped to shoot and interact
- **START/SELECT** — Game control buttons
- **Speaker grille** — Decorative
- **Power LED** — Glows red when game is active

The webpage background uses retro pixel grid patterns, CRT scanline overlays, and DMG-01 green glow accents.

## Addictive Features

### Combo System
Kill monsters fast to build combos. Higher combos = more XP and damage multipliers:
- 3x → 1.5× multiplier
- 5x → 2× multiplier
- 8x → 3× multiplier
- 12x → 4× multiplier
- 20x → 5× multiplier

Combo resets when you take damage. Maintaining combos is key to efficient runs.

### Boss Fights
Specific floors have unique bosses:

| Floor | Boss | HP |
|---|---|---|
| 3 | Thread Guardian | 150 |
| 5 | Reply Hydra | 250 |
| 7 | OP Overlord | 400 |

Bosses are larger, have crown decorations, name tags, and drop weapons on death.

### Weapon System
6 weapons with random drops (5% from normal monsters, guaranteed from bosses):

| Weapon | ATK | Special |
|---|---|---|
| Rusty Sword | +3 | — |
| Iron Blade | +6 | — |
| Fire Staff | +8 | 30% burn chance |
| Ice Bow | +5 | 30% freeze chance |
| Shadow Dagger | +10 | — |
| Holy Lance | +12 | Heal on kill |

### Persistent Upgrades Shop
Gold carries between runs. Spend it in the SHOP panel:

| Upgrade | Effect | Base Cost |
|---|---|---|
| Max HP | +10 HP per level | 30G |
| Attack | +2 ATK per level | 40G |
| Defense | +1 DEF per level | 35G |
| Speed | +10% movement | 50G |
| Bag Size | +2 inventory slots | 25G |

Upgrade costs scale with level (1.3×–1.8× multiplier per level).

### Random Events
While exploring, random events can trigger:

| Event | Effect |
|---|---|
| Mysterious Merchant | Buy +3 ATK for gold, or get free gold sample |
| Healing Fountain | Restore 50% HP |
| Cursed Altar | 50/50: +8 ATK or -30 HP |
| Ancient Shrine | +20 Max HP permanently |
| Trapped Chest | 60/40: +50 Gold or -20 HP |

### Achievements
8 achievements to unlock:

| Achievement | Condition |
|---|---|
| First Blood | Kill your first monster |
| Combo King | Reach 5x combo |
| Deep Diver | Reach floor 3 |
| Thread Master | Clear all 7 floors |
| Monster Slayer | Kill 50 monsters total |
| Gold Hoarder | Collect 500 gold |
| Veteran | Reach level 10 |
| Untouchable | Clear a floor without taking damage |

### Progression
- **Level up** by gaining XP from kills (combo bonus XP)
- **Titles:** Youngster → Bug Catcher → Hiker → Ace Trainer → Gym Leader → Elite Four → Pokemon Master
- **Floor themes** change with depth (7 unique Pokemon-inspired palettes)

## Dungeon Generation

Procedurally generated using three techniques:

1. **Perlin Noise** — organic cave boundaries via Fractal Brownian Motion
2. **Cellular Automata** — solid rock fill with neighbor-based smoothing (6 iterations)
3. **Room Carving + Corridor Connection** — rectangular rooms connected by L-shaped corridors

Each seed produces a deterministic dungeon.

## Floor Themes

| Floor | Theme | Colors |
|---|---|---|
| 1 | Viridian Dungeon | Green walls, tan floors |
| 2 | Cerulean Cave | Blue-gray tones |
| 3 | Goldenrod Tower | Warm gold palette |
| 4 | Cinnabar Lab | Red atmosphere |
| 5 | Lavender Tower | Purple tones |
| 6 | Seafoam Cave | Cyan ice caves |
| 7 | Victory Road | Dark golden halls |

## Monster Types

| Monster | Base HP | Speed | Behavior |
|---|---|---|---|
| Zubat | 25 | Slow | Patrols, chases when close |
| Gastly | 30 | Medium | Faster pursuit |
| Haunter | 40 | Slow | High damage |
| Gengar | 50 | Medium | Balanced threat |
| Mewtwo | 65 | Slow | Floor 5+ elite |

Monsters scale with depth: HP +8/floor, speed +2/floor, damage +2/floor.

## Features

- Fog of war with explored tile memory
- Real-time minimap (toggleable)
- Invincibility frames on damage (flashing effect)
- Floating damage numbers with combo indicators
- Particle effects on hits, kills, and item pickups
- Screen shake on damage
- Pokemon-style 16×16 pixel art tiles
- Status effects: Poison, Freeze, Burn, Shield, Haste, Regen
- Inventory system with consumables and equipment
- localStorage persistence for upgrades, gold, and achievements
- Devvit ↔ Phaser bridge via postMessage

## Project Structure

```
threadcrawler/
  devvit.json              # Reddit Devvit config
  package.json             # Dependencies
  src/
    main.tsx               # Devvit backend (Reddit API, thread → dungeon)
  webroot/
    index.html             # Gameboy shell UI + retro pixel web design
    game.js                # Phaser 3 engine, dungeon gen, all game systems
```

## Running

**Standalone (no Reddit):**
```bash
cd webroot
python -m http.server 3000
# Open http://localhost:3000
```

**With Devvit:**
```bash
npm install
npm install -g devvit
devvit login
devvit playtest r/your-subreddit
```

## Devvit Integration

The Devvit backend (`src/main.tsx`) fetches Reddit threads and converts them into dungeon data:
- Each comment becomes a room
- Comment depth = dungeon depth
- Upvotes = heals, downvotes = traps, awards = power-ups
- Thread vibe analysis (horror/strategy/zen/chaos/mystery)

Dungeon data is sent to the Phaser game via `postMessage`. The game listens for `devvit_dungeon` messages and uses the thread structure instead of random generation.

## Tech Stack

- **Phaser 3.60** — Game engine, rendering, physics, input
- **Devvit** — Reddit embedded app platform
- **Perlin Noise** — Procedural terrain generation
- **Cellular Automata** — Cave structure generation
- **Press Start 2P + VT323** — Pixel fonts
- **localStorage** — Persistent upgrades, gold, achievements

## Design

Retro Gameboy DMG-01 aesthetic:
- Pixel art Gameboy shell (body, bezel, d-pad, buttons, speaker)
- Dark black background with pixel grid overlay
- CRT scanline effect
- DMG-01 green glow accents
- Pokemon-style 16×16 colorful tiles
- Press Start 2P pixel font throughout

## License

MIT
