# Thread Crawler

[![Phaser](https://img.shields.io/badge/Phaser-3.60-000?logo=phaser&logoColor=white)](https://phaser.io)
[![Devvit](https://img.shields.io/badge/Devvit-Reddit-FF4500?logo=reddit&logoColor=white)](https://developers.reddit.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Hackathon%20Ready-green)]()

A dungeon crawler where Reddit comment threads become the dungeon. Every comment is a room. Every reply is a path deeper into the darkness.

Built for the [Reddit Game Hackathon](https://www.reddit.com/r/GamesOnReddit/).

---

## The Core Idea

Thread Crawler takes a real Reddit comment thread and turns it into a playable dungeon. The comment tree structure becomes the dungeon layout:

- **Root comments** are the starting rooms on the first floor
- **Replies** branch off into deeper corridors
- **Deep threads** (comments with many nested replies) become the deepest, most dangerous parts of the dungeon
- **Short threads** are shallow rooms with quick exits

The deeper you go into the reply tree, the harder the dungeon gets. A thread with 10 levels of nesting becomes a 10-floor dungeon crawl.

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
| Author name | Room label |
| Score value | Trap/heal intensity |

## Gameplay

**Movement:** WASD or Arrow Keys to walk around the dungeon.

**Combat:** SPACE to fire a projectile in the direction you're facing. Monsters patrol rooms and chase you when you get close.

**Interaction:** Press E near the green exit to descend to the next floor.

**Items:**
- Red floor tiles = traps (deal damage on contact)
- Green cross tiles = heals (restore HP on contact)
- Gold star tiles = power-ups (random stat boost)

**Progression:** Clear 7 floors to escape the dungeon. Each floor generates a new layout from a mathematical seed. Deeper floors have more monsters, tighter corridors, and better loot.

## Controls

| Key | Action |
|---|---|
| W/A/S/D or Arrows | Move |
| SPACE | Shoot |
| E | Interact with exit |

## Dungeon Generation

Every dungeon is procedurally generated using three mathematical techniques layered together:

**Perlin Noise** creates the organic cave boundaries. By sampling noise at different frequencies and combining them (Fractal Brownian Motion), we get natural-looking terrain that isn't random — it has structure, like real cave systems.

**Cellular Automata** fills in the solid rock. Starting with random fill, we run 6 iterations where each cell's state depends on its neighbors. Cells with 5+ neighbors become open space. This creates connected cave rooms naturally.

**Room Carving + Corridor Connection** ensures playability. Random rectangular rooms are carved out, then connected with L-shaped corridors. This guarantees all rooms are reachable no matter what the noise generates.

Each seed produces a deterministic dungeon — same seed always generates the same map.

## Floor Themes

The dungeon changes visual theme as you descend:

| Floor | Theme | Colors |
|---|---|---|
| 1 | Thread Depths | Purple walls, dark floors |
| 2 | Void Corridor | Deep purple, minimal light |
| 3 | Emerald Cavern | Green-tinted caves |
| 4 | Crimson Depths | Red atmosphere |
| 5 | Golden Halls | Warm golden tones |
| 6 | Frozen Abyss | Cyan ice caves |
| 7 | Shadow Realm | Near-black, minimal visibility |

## Monster Types

Monsters scale with floor depth:

| Monster | Base HP | Speed | Behavior |
|---|---|---|---|
| Shadow | 25 | Slow | Patrols, chases when close |
| Wraith | 35 | Medium | Faster pursuit |
| Stalker | 45 | Slow | High damage tank |
| Void | 55 | Medium | Balanced threat |
| Crawler | 65 | Slow | Floor 5+ elite |

Each floor adds 3 + floor_number monsters. Monster stats scale with depth.

## Features

- Fog of war with explored tile memory
- Real-time minimap showing player, monsters, and exit
- Invincibility frames on damage (flashing effect)
- Particle effects on hits, kills, and item pickups
- Screen shake on damage
- 7 unique floor themes with distinct color palettes
- Progressive difficulty scaling
- Level-up system with stat increases and title progression
- Gold economy for future features
- Activity log tracking all events

## Project Structure

```
threadcrawler/
  devvit.json              # Reddit Devvit config
  package.json             # Dependencies
  src/
    main.tsx               # Backend (Reddit API, thread analysis)
    server/index.js        # Express server
  webroot/
    index.html             # Game UI with glassmorphic design
    game.js                # Phaser 3 engine + dungeon generation
    phaser.min.js          # Phaser 3 library (local)
    bg.jpg                 # Main background (MewoOS wallpaper)
    start-bg.jpg           # Start screen background
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

## Tech Stack

- **Phaser 3** — Game engine, rendering, physics
- **Devvit** — Reddit integration (optional)
- **Perlin Noise** — Procedural terrain generation
- **Cellular Automata** — Cave structure generation
- **Space Grotesk + Share Tech Mono** — Typography
- **Glassmorphic CSS** — UI panels with backdrop blur

## Design

Dark theme with MewoOS-inspired glassmorphism:
- Pure black background with wallpaper blur
- Translucent glass panels with backdrop-filter
- Sakura pink and miku teal accent colors
- SVG icons throughout
- Noise texture overlay for depth

## License

MIT
