# Thread Crawler

[![Phaser](https://img.shields.io/badge/Phaser-3.60-000?logo=phaser&logoColor=white)](https://phaser.io)
[![Devvit](https://img.shields.io/badge/Devvit-Reddit-FF4500?logo=reddit&logoColor=white)](https://developers.reddit.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Hackathon%20Ready-green)]()

**A dungeon crawler where Reddit comment threads become the dungeon.**

Every comment is a room. Every reply is a path deeper. Traps hide in downvoted comments. Heals hide in upvoted ones. Monsters guard the deepest threads.

Built for the [Reddit Game Hackathon](https://www.reddit.com/r/GamesOnReddit/).

---

## How It Works

Thread Crawler turns Reddit's comment structure into a playable dungeon. When you start a game, it pulls a real thread from the subreddit and converts the comment tree into a navigable map.

| Reddit Concept | Game Equivalent |
|---|---|
| Comment | Room |
| Reply | Path deeper |
| Upvote | Health pack |
| Downvote | Trap |
| Award | Power-up |
| Thread depth | Dungeon depth |
| Long thread | Deep dungeon |

## Gameplay

**Controls:**
- WASD or Arrow Keys to move
- SPACE to shoot
- E to interact with exits

**Objective:** Navigate through the comment tree, collect loot, fight monsters, and reach the deepest room possible before dying.

**Progression:**
- Each floor generates a new dungeon from a seed
- Deeper floors have more monsters, tighter corridors, and better loot
- Killing monsters earns gold and XP
- Leveling up increases HP, attack, and defense
- Titles unlock at milestones: Newbie, Post Pilgrim, Comment Knight, Thread Surfer, Reply Warrior, Depth Diver, Thread Lord

## Technical Details

### Dungeon Generation

The map is generated using a combination of mathematical techniques:

1. **Perlin Noise** -- Creates organic terrain variation. Different octaves layered via Fractal Brownian Motion produce natural-looking cave boundaries.

2. **Cellular Automata** -- Iterative simulation where each cell's state depends on its neighbors. Runs 5 iterations to carve out cave-like open spaces from solid rock.

3. **Room Carving** -- Random rooms (4-10 tiles wide) are carved at random positions. This ensures there are always navigable spaces regardless of what the noise generates.

4. **Corridor Connection** -- Rooms are connected with L-shaped corridors, guaranteeing all rooms are reachable.

5. **Tile Placement** -- Traps, heals, power-ups, spawn point, and exit are placed based on room positions and random probability.

Each seed produces a deterministic dungeon, so the same seed always generates the same map.

### Rendering

Phaser 3 handles all rendering at 60fps:
- Tile-based map with per-tile color variation
- Physics-based player movement with wall collision
- Camera follows the player with smooth interpolation
- Screen shake on damage
- Hit particles on monster kills
- Pulsing exit glow

### Monster AI

Monsters use distance-based chase logic:
- Within 200px: move toward player at speed 60 + (depth * 10)
- Within 28px: deal damage to player
- Outside 200px: idle

Monster count scales with depth (2 + depth monsters per floor).

## Project Structure

```
threadcrawler/
  devvit.json          # Devvit configuration
  package.json         # Dependencies
  src/
    main.tsx           # Devvit backend (thread analysis, sentiment)
    server/
      index.js         # Express server for webview
  webroot/
    index.html         # Game UI with glassmorphic design
    game.js            # Phaser 3 game engine + math generation
    bg.jpg             # Background image
```

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open the playtest URL in your browser
```

The dev server creates a test subreddit and post automatically.

## Design

The UI uses a glassmorphic dark theme with:
- Purple/emerald/gold color palette
- Space Grotesk + JetBrains Mono typography
- Backdrop blur glass panels
- SVG icons (no emoji)
- Animated depth indicators
- Real-time activity log

## Built With

- [Phaser 3](https://phaser.io) -- Game engine
- [Devvit](https://developers.reddit.com) -- Reddit developer platform
- [Perlin Noise](https://en.wikipedia.org/wiki/Perlin_noise) -- Terrain generation
- [Cellular Automata](https://en.wikipedia.org/wiki/Cellular_automaton) -- Cave generation

## License

MIT
