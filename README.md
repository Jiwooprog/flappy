# 🐦 Flappy Bird Arcade (React + TypeScript)

An arcade-grade, responsive Flappy Bird game built with **React 19**, **TypeScript**, **HTML5 Canvas**, and the **Web Audio API**.

![Flappy Bird Preview](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/gamepad-2.svg)

---

## 🚀 Quick Start

The development server is running at:
**[http://localhost:5173/](http://localhost:5173/)**

To start the dev server manually:
```bash
npm run dev
```

To build for production:
```bash
npm run build
```

---

## 🎮 Controls

| Action | Input |
|---|---|
| **Flap / Jump** | <kbd>Space</kbd>, <kbd>↑</kbd>, <kbd>W</kbd>, Mouse Click, or Screen Tap |
| **Pause / Resume** | <kbd>P</kbd> or <kbd>Esc</kbd> |
| **Restart Game** | <kbd>Space</kbd> on Game Over screen or Restart button |

---

## ✨ Features

- **60 FPS Delta-Time Canvas Engine**: Smooth physics, bird rotation, wing flap animation, and sub-pixel parallax scrolling.
- **Synthesized 8-Bit Web Audio API**: Procedural flap sound, double-tone score chime, punchy hit crunch, and high score fanfare without external audio files.
- **Multiple Bird Skins**:
  - 🐥 **Classic Flyer**: Retro golden bird with cheeks and animated wings.
  - 👤 **Gino**: Custom champion flyer using `gino.jpg` with blue plumage and flapping wings.
  - 💎 **Jewel**: Radiant star flyer using `jewel.jpg` with pink plumage and sparkling trail.
  - 🦅 **RJ**: High-altitude flight ace using `rj.jpg` with emerald plumage and speed feathers.
  - ⚡ **Cyber Neon**: Synthwave drone with glowing visor and trail.
  - 🔥 **Solar Phoenix**: Fiery crest with trailing embers.
  - 🌙 **Midnight Crow**: Stealth shadow glider with ruby eyes.
- **Dynamic Themes**:
  - ☀️ **Day**: Fluffy clouds, blue skies, and sun.
  - 🌇 **Sunset**: Amber glow, setting sun, and orange silhouettes.
  - 🌌 **Night**: Crescent moon, twinkling stars, and deep violet sky.
- **Difficulty Modes**:
  - **Casual**: Gentler gravity and wider pipe gaps.
  - **Classic**: Authentic retro arcade balance.
  - **Hardcore**: High speed and narrow gaps.
- **Global Multi-User Leaderboard**:
  - Persistent shared leaderboard backend via `/api/leaderboard` storing the top 100 high scores in `leaderboard.json`.
  - Automatic fallback to `localStorage` if offline or standalone.
  - Arcade gamer tag generator and custom username editor with instant saving.
  - Interactive podium view (Gold, Silver, Bronze) with flyer skin avatars and time-ago timestamps.
  - Filterable by game mode: All, Classic, Casual, and Hardcore.
  - Game Over ranking alert showing your exact position on the global charts.
- **Medal Achievements**: Bronze, Silver, Gold, and Platinum medals based on score milestones.
- **Confetti Fireworks**: Automatic particle celebration upon beating high scores.
- **Responsive Layout**: Retro arcade cabinet frame on desktop; edge-to-edge touch-friendly layout on mobile devices.

---

## ⚡ Deploying to Vercel with Upstash Redis

The project is fully pre-configured for **Vercel Serverless Functions** and **Upstash Redis**.

### Step 1: Create a Free Upstash Redis Database
1. Go to [https://console.upstash.com/](https://console.upstash.com/) and create a free Redis database (or select the **Storage** tab in your Vercel Dashboard and click **Create Database** -> **KV / Upstash**).
2. Copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** from the Upstash console.

### Step 2: Deploy to Vercel
1. Push this project to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Under **Environment Variables**, add:
   - `UPSTASH_REDIS_REST_URL` = your Upstash REST URL
   - `UPSTASH_REDIS_REST_TOKEN` = your Upstash REST token
4. Click **Deploy**.

Vercel will build the frontend and serve `/api/leaderboard` as a global serverless function connected directly to your cloud Redis database.
