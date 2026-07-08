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

**Combat:** SPACE to fire projectiles. Monsters patrol rooms and chase you when close. Dodge roll with SHIFT for i-frames.

**Interaction:** Press E near the exit stairs to descend.

**Abilities:** Keys 1-4 activate unlockable skills (Fireball, Heal, Dash Strike, Barrier).

**Items:**
- Red cracked tiles = traps (damage + status effects)
- Glowing green pools = poison (applies POISON status)
- Retractable metal spikes = timed spike traps
- Green cross tiles = heals
- Gold star tiles = power-ups (random stat boost)
- Brown chest tiles = treasure (gold + items)
- Lava tiles = burn damage + BURN status

## Controls

| Key | Action |
|---|---|
| W/A/S/D or Arrows | Move |
| SPACE | Shoot |
| SHIFT | Dodge Roll (i-frames, 3 charges) |
| E | Interact with exit |
| I | Open/close bag |
| 1 | Fireball ability |
| 2 | Heal ability |
| 3 | Dash Strike ability |
| 4 | Barrier ability |
| P | Pause / Resume |
| M | Toggle minimap |

## Gameboy UI

The game runs inside a pixel-art Gameboy DMG-01 shell:

- **Screen** — 480×340 Phaser canvas with Pokemon-style 16×16 tile rendering
- **HUD** — HP bar, XP bar, gold, level, combo counter, weapon display, dodge pips, ability bar
- **D-pad** — Touch-compatible directional buttons
- **A/B buttons** — Mapped to shoot and interact
- **START/SELECT** — Game control buttons
- **Speaker grille** — Decorative
- **Power LED** — Glows red when game is active
- **CRT Overlay** — Scanline effect + vignette for retro feel

The webpage background uses retro pixel grid patterns, CRT scanline overlays, and DMG-01 green glow accents.

## Visual Effects

### Particle System
Object-pooled particle engine (400 particles max) for fire, smoke, magic trails, blood splatter, death explosions, gold sparkles, torch flames, and ambient dust.

### Screen Effects
- **Camera Shake** — Scales with damage dealt and received
- **Hit-Stop** — Brief physics pause on critical hits for impact feel
- **Screen Flash** — Color-coded flashes (red for damage, gold for crits, blue for shield)
- **CRT Overlay** — Scanlines + vignette for authentic retro feel

### Dynamic Lighting
Torch flames flicker with warm glow halos. Light pools illuminate dark dungeon corridors. Each floor theme has unique ambient color.

### Monster Death
Shrink-and-dissolve animation with themed color particle explosions and gold sparkles.

## Addictive Features

### Combo System
Kill monsters fast to build combos. Higher combos = more XP, more damage, and higher crit chance:
- 3x → 1.5× multiplier, +5% crit
- 5x → 2× multiplier, +10% crit
- 8x → 3× multiplier, +15% crit
- 12x → 4× multiplier
- 20x → 5× multiplier

Combo resets when you take damage. Maintaining combos is key to efficient runs.

### Critical Hit System
15% base crit chance, boosted by combo tier. Crits deal 2× damage with:
- Hit-stop freeze frame
- Enhanced screen shake
- Yellow particle burst + blood splatter
- "CRIT!" toast notification

### Dodge Roll
Press SHIFT to dodge with invincibility frames. 3 charges that regenerate over time. Trail particles and speed boost during roll.

### Loot Rarity System
Weapons drop with random rarity tiers:

| Rarity | Color | Drop Rate | Stat Multiplier |
|---|---|---|---|
| Common | Gray | 50% | 1.0× |
| Uncommon | Green | 25% | 1.3× |
| Rare | Blue | 15% | 1.6× |
| Epic | Purple | 8% | 2.0× |
| Legendary | Gold | 2% | 2.5× |

### Ability System
4 abilities with cooldowns, unlocked from the start:

| Key | Ability | Cooldown | Effect |
|---|---|---|---|
| 1 | 🔥 Fireball | 3s | Piercing projectile, 2× ATK damage |
| 2 | 💚 Heal | 8s | Restore 30% max HP |
| 3 | ⚡ Dash Strike | 4s | Teleport forward, AoE damage to nearby enemies |
| 4 | 🛡 Barrier | 12s | Block next 3 hits |

### Boss Fights
Specific floors have unique bosses with cinematic intros:

| Floor | Boss | HP |
|---|---|---|
| 3 | The Thread Wraith | 150 |
| 5 | Hydra of Forgotten Replies | 250 |
| 7 | The Original Poster | 400 |

Boss intros feature full-screen name reveal animation, physics pause, and dramatic particle effects. Bosses drop rarity-rolled weapons on death.

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
| Whispers in the Dark | Atmospheric horror event |
| Blood Pool | 70/30: +5 ATK or -15 HP |
| Shadow Figure | +2 DEF from fear |
| Creaking Door | Find gold |
| Ghostly Touch | 50/50: heal or damage |

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
- **Level-up celebration** — ring explosion particles + gold screen flash

## Environmental Hazards

| Hazard | Visual | Effect |
|---|---|---|
| Trap tiles | Red cracked floor | Damage on contact |
| Spike traps | Retractable metal spikes (timed) | Damage when extended |
| Poison pools | Bubbling green liquid | Applies POISON status (ticking damage) |
| Lava | Flowing orange/red | Damage + BURN status |
| Tall grass | Pokemon-style grass tufts | Random monster encounters |

## Secret Rooms

Hidden treasure rooms carved into walls. Contain chests, heals, and power-ups. Look for gaps in wall patterns — the best loot is hidden.

## Dungeon Generation

Procedurally generated using deterministic seeded techniques:

1. **Perlin Noise** — organic cave boundaries via Fractal Brownian Motion
2. **Cellular Automata** — solid rock fill with neighbor-based smoothing (6 iterations, seeded RNG)
3. **Room Carving + Corridor Connection** — rectangular rooms connected by L-shaped corridors
4. **Secret Room Placement** — hidden rooms behind walls with treasure
5. **Environmental Decoration** — torches, flowers, fences, water features

Each seed produces a fully deterministic dungeon.

## Floor Themes

| Floor | Theme | Colors | Ambient Sound |
|---|---|---|---|
| 1 | Viridian Dungeon | Green walls, tan floors | Water drip |
| 2 | Cerulean Catacombs | Blue-gray tones | Wind |
| 3 | Goldenrod Crypt | Warm gold palette | Creaking |
| 4 | Cinnabar Depths | Red atmosphere | Heartbeat |
| 5 | Lavender Mausoleum | Purple tones | Whispers |
| 6 | Seafoam Abyss | Cyan ice caves | Water drip |
| 7 | Victory Graveyard | Dark golden halls | Heartbeat |

## Monster Types

| Monster | Base HP | Speed | Behavior |
|---|---|---|---|
| Shadow Crawler | 25 | Slow | Flanking — circles behind player |
| Lost Soul | 30 | Medium | Phasing — teleports through walls |
| Flesh Golem | 40 | Slow | Charging — rushes in straight lines |
| Void Stalker | 50 | Medium | Teleporting — blinks to player |
| Bone Horror | 65 | Slow | Ranged — fires projectiles |

Monsters scale with depth: HP +8/floor, speed +2/floor, damage +2/floor.

## UI Systems

### Toast Notifications
Slide-in notifications for loot drops, crits, level-ups, warnings, and achievements. Color-coded by type (info/success/warning/error/loot/legendary).

### Loading Screen
Animated progress bar with random gameplay tips between floor transitions.

### Stats Screen
Full run statistics: floor, level, HP, ATK, DEF, gold, kills, max combo, achievements, weapon, dodge charges.

### Dynamic Music
Procedural music engine with 7 unique floor themes. Volume intensifies during combat based on nearby threat count. Bass, melody, pad, and noise layers.

## Features

- Fog of war with explored tile memory
- Real-time minimap (toggleable with M key)
- Invincibility frames on damage (flashing effect)
- Dodge roll with i-frames and trail particles
- Critical hit system with hit-stop and screen effects
- Floating damage numbers with combo indicators
- Object-pooled particle system (400 max)
- Screen shake, flash, and freeze frame effects
- CRT overlay with scanlines and vignette
- Dynamic torch lighting with flicker
- Pokemon-style 16×16 pixel art tiles
- Status effects: Poison, Freeze, Burn, Shield, Haste, Regen
- Inventory system with consumables, equipment, and drop
- Loot rarity tiers (Common → Legendary)
- 4 abilities with cooldown UI
- Boss intro cinematics
- Secret rooms with hidden treasure
- Environmental hazards: spikes, poison, lava
- localStorage persistence for upgrades, gold, and achievements
- Devvit ↔ Phaser bridge via postMessage
- Seeded deterministic dungeon generation

## Project Structure

```
threadcrawler/
  devvit.json              # Reddit Devvit config
  package.json             # Dependencies (MIT license)
  .gitignore               # Ignore rules
  src/
    main.tsx               # Devvit backend (Reddit API, thread → dungeon)
    server/
      index.js             # Express server (health check)
  webroot/
    index.html             # Gameboy shell UI + retro pixel web design
    game.js                # Phaser 3 engine, dungeon gen, all game systems
    bg.jpg                 # Background image
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

## Devvit Integration

The Devvit backend (`src/main.tsx`) fetches Reddit threads and converts them into dungeon data:
- Recursive comment tree traversal with proper depth tracking
- Each comment becomes a room with parentId-based depth calculation
- Upvotes = heals, downvotes = traps, awards = power-ups
- Thread vibe analysis (horror/strategy/zen/chaos/mystery)
- Seeded PRNG for deterministic monster generation

Dungeon data is sent to the Phaser game via `postMessage`. The game listens for `devvit_dungeon` messages and uses the thread structure instead of random generation.

## Tech Stack

- **Phaser 3.60** — Game engine, rendering, physics, input
- **Devvit** — Reddit embedded app platform
- **Perlin Noise** — Procedural terrain generation (seeded)
- **Cellular Automata** — Cave structure generation (seeded)
- **Web Audio API** — Procedural music + SFX engine
- **Press Start 2P + VT323** — Pixel fonts
- **localStorage** — Persistent upgrades, gold, achievements
- **Express** — Server health check endpoint

## Design

Retro Gameboy DMG-01 aesthetic:
- Pixel art Gameboy shell (body, bezel, d-pad, buttons, speaker)
- Dark black background with pixel grid overlay
- CRT scanline effect + vignette overlay
- DMG-01 green glow accents
- Pokemon-style 16×16 colorful tiles with animation
- Dynamic torch lighting with warm glow halos
- Press Start 2P pixel font throughout
- Floating pixel decorations (coins, stars, mushrooms, ? blocks)

## License

MIT