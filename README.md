# Thread Crawler

A Reddit-powered roguelike dungeon crawler built with Phaser.js. Threads become dungeons — comments become loot, floors, and community scaling. Every run is different. Every death makes you stronger.

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
5. Die? Keep your gold. Buy permanent upgrades in The Vault. Try again.

---

## Core Pressure Systems

These three mechanics stack to create constant urgency. You can't just wander — the floor is fighting back.

### Floor Timer

Every floor has a countdown. When it hits zero, the floor **collapses**.

| Floor | Timer | Warning |
|-------|-------|---------|
| 1 | 90s | — |
| 5 | 70s | — |
| 10 | 50s | — |
| 15+ | 45s (min) | — |

- HUD shows `⏰ 67s` — turns yellow at 50%, red at 20%
- At 20%: heartbeat sound + "HURRY!" toast
- When timer hits 0: **FLOOR COLLAPSING** — continuous damage every 0.5s
- Collapse damage: `5 + depth * 3` per tick
- Camera shake increases the longer you survive the collapse
- **Kills give +2s back** — rewards fighting, not running

### Exit Lock

You can't leave a floor without proving you cleared it.

- Exit is **LOCKED** until you kill **70% of floor enemies**
- Exit shows `LOCKED (34%)` in red, updates as you kill
- When 70% killed: **EXIT UNLOCKED** toast + green flash + green particles
- Exit text turns green, shows `Press E`
- Greed counter (`☠ 5/12`) doubles as exit progress tracker

### Enemy Waves

The longer you stay, the worse it gets. New waves spawn automatically.

| Time | Wave | Enemies | Strength Bonus |
|------|------|---------|----------------|
| 0s | 0 | — | — |
| 15s | 1 | 2-3 | +15% |
| 30s | 2 | 3-4 | +30% |
| 45s | 3 | 4-5 | +45% |
| 60s | 4 | 5-6 | +60% |

- Wave interval: 15s (faster on deeper floors, min 8s)
- Each wave spawns 15% stronger enemies (HP + ATK scale)
- Enemies spawn 80-200px from the player with red flash
- HUD shows `☠ Wave 3` counter
- Toast + monster growl + red screen flash on each wave

**The three systems stack:** Timer pressures you to move fast. Exit lock forces you to fight. Waves keep escalating. Kills give +2s back. Risk tokens from refusing heals give gold/XP bonus. Every decision matters.

---

## Meta-Progression: The Vault

Die? Your gold persists. Spend it in **The Vault** between runs for permanent upgrades.

### Upgrades

| Upgrade | Effect | Base Cost | Cost Scaling |
|---------|--------|-----------|--------------|
| Max HP | +10 HP per level | 30G | 1.5x per level |
| Attack | +2 ATK per level | 40G | 1.5x per level |
| Defense | +1 DEF per level | 35G | 1.5x per level |
| Speed | +10% speed per level | 50G | 1.8x per level |
| Bag Size | +2 inventory slots per level | 25G | 1.3x per level |

### Accessing The Vault

- **Title screen:** "THE VAULT" button (gold)
- **Game-over screen:** "VAULT" button next to "RETRY"
- Shows total gold, current upgrade levels, best floor reached
- Buy upgrades, then press "ENTER THE DUNGEON"

### Best Floor Tracking

- Highest floor reached is saved to localStorage
- Displayed in The Vault as "Best run: Floor X"

---

## Risk Tokens

Refuse healing to gain power. Hold **SHIFT + interact** on heal tiles to refuse the heal.

- Each refusal = **+1 Risk Token** = **+15% gold/XP multiplier**
- Stacks up to ~3.5x at 16 tokens
- Purple particles + notification on refusal
- HUD shows: `⚡ 3 Risk (45%)`
- Risk applies to: kill gold, kill XP, chest gold

High risk, high reward. Die with 10 risk tokens? That's a 150% bonus to everything you earned.

---

## Floor Modifiers

Every floor gets a random modifier. Shows on floor splash + HUD.

| Modifier | Effect |
|----------|--------|
| ⚔ Glass Cannon | 2x ATK, -30% Max HP |
| 💰 Gold Rush | 2x Gold drops |
| ☠ Monster Surge | 2x Enemies, +100% XP |
| 💀 Cursed Floor | Healing items disabled |
| ⚡ Speed Demon | +50% speed, +20% ATK |
| 🛡 Iron Wall | +3 DEF, -20% speed |
| 💎 Greed Floor | 2x chest gold, +50% enemies |
| 💔 Fragile | -40% Max HP, +40% ATK |

Modifiers affect spawn counts, gold multipliers, XP multipliers, and player stats.

---

## Synergy System

Combine specific items/weapons for bonus effects. Synergies trigger automatically when both items are in your inventory.

| Synergy | Requires | Effect |
|---------|----------|--------|
| Inferno | Fire Staff + Bomb | Bombs leave fire trails |
| Frost Sprint | Ice Bow + Speed Boots | Leave ice trail that slows enemies |
| Shadow Step | Shadow Dagger + Compass | Teleport to exit (SHIFT+E) |
| Holy Guardian | Holy Lance + Shield | Shield regenerates 1 block per kill |

HUD shows `⚡ 1 Synergy` when active.

---

## Mid-Run Shop

Press **K** to open the Wandering Merchant. Merchants appear randomly after floor 2 (15% chance per floor).

| Item | Cost | Effect |
|------|------|--------|
| ATK Boost | 30G | +5 ATK for 60s |
| DEF Boost | 25G | +3 DEF for 60s |
| Speed Boost | 20G | +30% speed for 45s |
| Crit Boost | 35G | +15% crit for 60s |
| Full Heal | 50G | Restore all HP |
| Max HP +20 | 80G | Permanent +20 Max HP |
| Bomb | 40G | AoE damage item |
| Mega Potion | 30G | Restore 80 HP item |

Temporary buffs show on HUD with countdown timers.

---

## Combo System

Kill enemies quickly to build combos. Combos multiply XP and gold.

| Combo | Multiplier | Crit Bonus |
|-------|------------|------------|
| 0-2 | 1x | — |
| 3-4 | 1.5x | +5% crit |
| 5-7 | 2x | +10% crit |
| 8-11 | 3x | +15% crit |
| 12-19 | 4x | +15% crit |
| 20+ | 5x | +15% crit |

- Combo resets after 2 seconds without a kill
- Combo resets when you take damage
- Milestone toasts at 3, 5, 8, 12, 20 kills
- Screen flash at 8+ (purple) and 12+ (gold)
- HUD shows `5x COMBO (2x)` with pulse animation

---

## Greed System

Kill ALL enemies on a floor for a bonus.

- HUD shows `☠ 3/12` (killed/total) as you progress
- Color shifts: gray → purple (50%) → gold (80%)
- When 100% killed: `💰 GREED!` in gold
- **Greed Bonus:** `50 + depth * 30` gold (scales with community multiplier)
- Bonus applied when you exit the floor

---

## Escalating Difficulty

Enemies get exponentially harder every floor.

### Enemy Scaling Formula

```
HP = base_hp * (1.35 ^ depth)
ATK = base_damage * (1 + depth * 0.18)
Speed = base_speed + depth * 4
```

| Floor | Shadow Crawler HP | Bone Horror HP |
|-------|-------------------|----------------|
| 0 | 25 | 65 |
| 3 | 62 | 160 |
| 5 | 114 | 294 |
| 10 | 488 | 1,255 |

### Chest Gold Scaling

```
gold = (15 + random(25) + depth * 8) * community_mult * risk_mult * (1 + depth * 0.1)
```

### Kill Rewards Scaling

```
xp = (15 + depth * 8) * community_mult * risk_mult * floor_xp_mult
gold = (8 + depth * 5) * community_mult * risk_mult * floor_gold_mult * (1 + depth * 0.05)
```

### Monster Types (by floor)

| Floor | Monster | Behavior |
|-------|---------|----------|
| 0-1 | Shadow Crawler | Flank (circle strafe) |
| 2-3 | Lost Soul | Phase (walks through walls) |
| 4-5 | Flesh Golem | Charge (rushes at player) |
| 6-7 | Void Stalker | Teleport (blinks around) |
| 8+ | Bone Horror | Ranged (shoots projectiles) |

### Monster Count

```
count = min(floor((4 + depth * 1.5) * sqrt(community_mult) * floor_enemy_mult), 20)
```

---

## Bosses

Bosses appear on specific floors with scaled stats.

| Floor | Boss | Base HP | Special |
|-------|------|---------|---------|
| 3 | The Thread Wraith | 150 | 3-projectile spread |
| 5 | Hydra of Forgotten Replies | 250 | Ring of projectiles + charge |
| 7 | The Original Poster | 400 | Spiral + summon + AoE |

Boss HP scales: `hp * (1.3 ^ depth)`
Boss ATK scales: `damage * (1 + depth * 0.15)`

---

## Boss Rush Mode

Unlocked after beating the game for the first time.

- Red "BOSS RUSH" button on title screen
- 3 floors, each with a scaled boss
- Bosses: Thread Wraith → Hydra → Original Poster
- Each boss is 1.5x stronger than the previous
- No floor timer or exit lock — pure boss combat
- No enemy waves — just you and the boss

---

## Visual Juice

### Screen Effects
- **Screen shake** — on hits (4px), crits (12px), player damage (6-12px based on damage), boss spawn (15px)
- **Screen flash** — white on crits, red on damage, green on exit unlock, gold on level up
- **Hit freeze** — 0.04-0.08s pause on crits (hit-stop)
- **Camera follow** — smooth 0.1 lerp following player

### Particles
- **Kill particles** — 25 death + 10 gold sparkles + 8 white flash per kill
- **Crit particles** — 12 hit + 8 blood splatter
- **Level up** — 20 gold particles in ring pattern
- **Boss spawn** — 30 dramatic red particles
- **Risk refusal** — 10 purple particles
- **Wave spawn** — 6 red flash particles per enemy
- **Exit unlock** — 15 green particles around exit

### Damage Numbers
- Floating text on damage dealt/received
- Color-coded: white (normal), gold (crit), purple (combo), red (player damage), green (heal)
- Gold earned shown on kill: `+12G`

### HUD Elements
- Combo counter with pulse animation + multiplier
- Greed counter with color progression
- Floor modifier display
- Risk token counter
- Synergy indicator
- Temp buff timers
- Floor timer with color states
- Exit lock status
- Wave counter

---

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Space | Attack (melee) |
| E | Interact (chests, exit, shops) |
| I | Open inventory |
| K | Open mid-run shop |
| M | Toggle minimap |
| P | Pause |
| 1-4 | Use ability (Fireball, Heal, Dash, Shield) |
| Shift | Dodge roll (3 charges, regenerates) |
| Shift + interact on heal | Refuse heal (gain Risk Token) |

---

## Abilities

| Key | Ability | Cooldown | Effect |
|-----|---------|----------|--------|
| 1 | Fireball | 3s | Piercing fire projectile, 2x ATK damage |
| 2 | Heal | 8s | Restore 30% max HP |
| 3 | Dash Strike | 4s | Dash forward, damage nearby enemies (1.5x ATK) |
| 4 | Shield | 12s | Block next 3 hits |

---

## Items & Equipment

### Weapons

| Name | ATK | Special |
|------|-----|---------|
| Rusty Sword | +3 | None |
| Iron Blade | +6 | None |
| Fire Staff | +8 | 30% burn chance |
| Ice Bow | +5 | 30% slow chance |
| Shadow Dagger | +10 | +15% crit chance |
| Holy Lance | +12 | +5 HP on kill |

### Loot Rarity

| Rarity | Drop Chance | ATK Mult |
|--------|-------------|----------|
| Common | 50% | 1.0x |
| Uncommon | 25% | 1.3x |
| Rare | 15% | 1.6x |
| Epic | 8% | 2.0x |
| Legendary | 2% | 2.5x |

### Consumables

| Name | Effect |
|------|--------|
| Health Potion | Restore 40 HP |
| Mega Potion | Restore 80 HP |
| Bomb | 50 damage to all nearby enemies |
| Shield | Block next 3 hits |
| Speed Boots | +30% movement speed |
| Attack Gem | +5 ATK permanently |
| Defense Gem | +3 DEF permanently |
| Compass | Reveal exit on minimap |

---

## Status Effects

| Effect | Duration | Effect |
|--------|----------|--------|
| Poison | 5s | 2 damage per tick |
| Freeze | 3s | -50% speed |
| Burn | 4s | 3 damage per tick |
| Shield | Until broken | Block 3 hits |
| Haste | 5s | +50% speed |
| Regen | 8s | +2 HP per tick |

---

## Achievements

| ID | Name | Condition |
|----|------|-----------|
| first_blood | First Blood | Kill your first monster |
| combo_5 | Combo King | Reach 5x combo |
| floor_3 | Deep Diver | Reach floor 3 |
| floor_7 | Thread Master | Clear all floors |
| kills_50 | Monster Slayer | Kill 50 monsters total |
| gold_500 | Gold Hoarder | Collect 500 gold |
| level_10 | Veteran | Reach level 10 |
| no_damage_floor | Untouchable | Clear a floor without taking damage |

---

## Random Events

Events trigger randomly during exploration (0.3% chance per frame):

| Event | Effect |
|-------|--------|
| Mysterious Merchant | -20G for +3 ATK, or free 5-15G |
| Healing Fountain | +50% max HP heal |
| Cursed Altar | 50% chance: +8 ATK or -30 HP |
| Ancient Shrine | +20 Max HP |
| Trapped Chest | 60%: +50G, 40%: -20 HP |
| Whispers in the Dark | Creepy flavor text |
| Blood Pool | 70%: +5 ATK, 30%: -15 HP |
| Shadow Figure | +2 DEF from fear |
| Creaking Door | +15G + depth*5 |
| Ghostly Touch | 50%: +30 HP, 50%: -25 HP |

---

## Community Scaling System

Every thread starts with **10 base floors**. Community comments change everything.

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

What it scales: XP, gold, item drops, heal/power spawns, chest gold, enemy count.

---

## Tile Types

| Tile | ID | Description |
|------|----|-------------|
| Floor | 0 | Walkable ground |
| Wall | 1 | Impassable |
| Exit | 2 | Next floor (locked until 70% kills) |
| Spawn | 3 | Player start |
| Trap | 4 | Damage on step + status effect |
| Heal | 5 | Restore HP (SHIFT to refuse for Risk Token) |
| Power | 6 | Random buff (ATK/DEF/Gold/HP) |
| Water | 7 | -50% speed |
| Tall Grass | 8 | Random monster encounter |
| Path | 9 | Corridor between rooms |
| Fence | 10 | Impassable |
| Tree | 11 | Impassable |
| Floor Alt | 12 | Visual variation |
| Carpet | 13 | Visual variation |
| Stairs | 14 | Save point |
| Chest | 15 | Random loot + gold |
| Lava | 16 | Damage on step |
| Ice | 17 | +40% speed |
| Sand | 18 | Visual variation |
| Bridge | 19 | Over water |
| Flower | 20 | Visual decoration |
| Poison | 21 | Poison status on step |
| Spikes | 22 | Damage on step |
| Locked Chest | 23 | Community-locked (20+ comments) |
| Bonus | 24 | Community bonus room |

---

## Architecture

```
webroot/
  game.js      — Main game (~4800 lines): Phaser scenes, dungeon gen, combat, UI, systems
  index.html   — Gameboy shell UI, overlays, HUD, CSS animations
src/
  main.tsx     — Devvit server: Reddit API, thread→dungeon conversion
  server/
    index.js   — Minimal Express health check (unused by Devvit)
package.json   — Devvit dependencies
```

### Game Systems in game.js

- **Sound Engine** — Procedural music (7 themes), SFX, ambient sounds
- **Dungeon Generator** — Cellular automata + Perlin noise + room carving
- **Tile Renderer** — Pokemon-style pixel art tiles
- **Combat System** — Melee, abilities, status effects, crits
- **Enemy AI** — 5 behaviors (chase, flank, phase, charge, teleport, ranged)
- **Boss AI** — 3 unique boss patterns
- **Particle Pool** — Object-pooled particles for performance
- **Screen Effects** — Shake, flash, freeze, chromatic aberration
- **Combo System** — Kill streaks with multiplier
- **Floor Pressure** — Timer, collapse, exit lock, enemy waves
- **Risk Token System** — Refuse heals for gold/XP multiplier
- **Floor Modifiers** — Random per-floor buffs/debuffs
- **Synergy System** — Item combo bonuses
- **Mid-Run Shop** — Spend gold on temp buffs during dungeon
- **Meta-Progression** — The Vault, persistent gold, permanent upgrades
- **Boss Rush Mode** — Post-game boss gauntlet
- **Toast Notifications** — Styled popups for events
- **Loading Screen** — Tips + progress bar

### Devvit Integration

The game runs as a Reddit Devvit app:

1. Receives thread data via `getPostContent`
2. Extracts title, body, author, comment count
3. Generates dungeon seed from thread hash
4. Passes data to client via `postMessage`

Communication is one-directional (server → webview). Game state is client-side only (localStorage).

### Dungeon Generation

1. Cellular automata (6 passes) → organic cave shape
2. Room carving (random rectangles) → 8-12+ rooms per floor
3. Corridor pathfinding → connects all rooms
4. Feature placement → spawn, exit, chests, traps
5. Room decoration → grass, flowers, fences, water features
6. Water pools (Perlin-based) → natural water features
7. Secret rooms → hidden treasure rooms (60% chance)
8. Community bonus rooms → 1 per 20 comments
9. Border walls → ensure edges are solid
10. Exit + spawn placement → safety fallbacks

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
