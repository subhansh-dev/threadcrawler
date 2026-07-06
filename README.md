# Thread Crawler

**Dive into comment threads. Each reply is a room. Go deep or die.**

A Reddit-native dungeon crawler where comment threads become dungeons. Built with [Devvit](https://developers.reddit.com/) for the Reddit Game Hackathon.

## How It Works

- **Every comment is a room** — the thread structure IS the dungeon
- **Every reply is a path deeper** — more replies = deeper dungeon
- **Upvotes heal you** — high-scored comments contain health packs
- **Downvotes are traps** — negative-scored comments deal damage
- **Awards are power-ups** — gilded comments give special abilities
- **Monsters guard the depths** — the deeper you go, the harder it gets

## Features

- Thread-vibe detection (horror, strategy, zen, chaos, mystery)
- Dynamic monster spawning based on thread sentiment
- Combat system with attack/flee mechanics
- Level progression with titles (Newbie → Thread Lord)
- Depth tracking and kill counts
- Streak system for daily play
- Reddit-native UI (feels like browsing threads)

## Tech Stack

- **Backend:** Devvit (Reddit's developer platform)
- **Frontend:** Vanilla JS + CSS
- **Engine:** Phaser 3 (for advanced rendering)

## Running Locally

```bash
npm install
npx devvit playtest
```

## How to Play

1. Click "Crawl a Thread" to start
2. Read the comment — it's your room
3. Choose a reply path to go deeper
4. Watch for traps (⚠️), heals (💚), power-ups (⭐), and monsters (👾)
5. Fight or flee when monsters appear
6. Go as deep as you can

## Judging Criteria Alignment

| Criteria | How It's Hit |
|----------|--------------|
| Delightful UX | Clean dark theme, thread-like cards, smooth transitions |
| Polish | Full combat system, level progression, activity log |
| Reddit-y | Dungeon structure IS the thread structure, not fake |
| Hook-y | Daily streaks, depth tracking, kill counts, level titles |
| Phaser Innovation | Thread topology creates natural dungeon layouts |

## License

MIT
