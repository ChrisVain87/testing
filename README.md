# 🌍 Creature World

> A browser-based massively multiplayer idle strategy game where thousands of players each own one cute, autonomous creature powered by their chosen AI (OpenAI, Claude, Gemini, or Grok).

## Architecture Overview

```
creature-world/
├── frontend/               # React 18 + Vite + Phaser 3.60 + Zustand
│   ├── src/
│   │   ├── components/     # React UI (landing, auth, game sidebar, modals)
│   │   ├── game/           # Phaser scenes (WorldScene, UIScene, BootScene)
│   │   ├── store/          # Zustand stores (auth, game)
│   │   ├── services/       # API client + Socket.io service
│   │   └── types/          # Shared TypeScript types
├── backend/                # NestJS + Socket.io + Prisma + Bull
│   ├── src/
│   │   ├── auth/           # JWT auth, Passport strategies
│   │   ├── creatures/      # Creature CRUD, prompt updates
│   │   ├── map/            # Chunk generation, land claiming, structures
│   │   ├── llm/            # LLM Gateway, prompt builder, job processor
│   │   ├── simulation/     # 10Hz tick loop, action execution
│   │   ├── websocket/      # Socket.io gateway, real-time events
│   │   └── moderation/     # Content moderation, reporting
│   └── prisma/             # Database schema + migrations
├── docker-compose.yml      # Production stack
├── docker-compose.dev.yml  # Dev infrastructure only
└── nginx.conf              # Reverse proxy config
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Phaser 3.60 (WebGL2), Zustand, React Query, Tailwind CSS |
| Backend | NestJS, Socket.io, Passport JWT, BullMQ |
| Database | PostgreSQL 16 + pgvector + PostGIS |
| Cache/Queue | Redis 7 + BullMQ |
| AI Providers | OpenAI SDK, Anthropic SDK, Gemini (OpenAI-compat), xAI Grok |
| Infra | Docker, Nginx, PWA (vite-plugin-pwa) |

## Quick Start (Development)

### 1. Start infrastructure
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2. Configure backend
```bash
cd backend
cp ../.env.example .env
# Edit .env - fill in JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
npm install
npx prisma migrate dev
npx prisma db seed
```

### 3. Start backend
```bash
npm run start:dev
# Backend runs on http://localhost:4000
```

### 4. Start frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000)

## Production Deployment

### Docker Compose (single server)
```bash
cp .env.example .env
# Fill in all required values, especially:
# - JWT_SECRET=$(openssl rand -hex 64)
# - JWT_REFRESH_SECRET=$(openssl rand -hex 64)
# - ENCRYPTION_KEY=<exactly 32 characters>

docker compose up -d
```

## Key Features

### Infinite Procedural Map
- 64×64 tile chunks with Simplex noise terrain generation
- Biomes: grass, forest, mountain, water, desert, snow, swamp, lava, crystal, void, candy, neon
- Only claimed/modified chunks stored in PostgreSQL
- PostGIS spatial indexes for efficient land ownership queries

### AI Control System (LLM Gateway)
```
Player writes system prompt (every 4h)
  → Backend queues BullMQ job
  → LLM Gateway builds context:
      • Creature stats (HP, energy, food, materials)
      • Nearby tiles & structures (3×3 chunk view)
      • Nearby creatures (allies/enemies)
      • Top-8 memories (semantic similarity via pgvector)
      • Recent actions
  → Calls chosen AI provider (OpenAI / Claude / Gemini / Grok)
  → Parses & validates JSON action plan (max 20 actions)
  → Saves plan to DB
  → Simulation workers execute at 10 ticks/second
  → Position/stat deltas streamed via Socket.io room subscriptions
```

**Available AI Actions:**
| Action | Description |
|--------|-------------|
| `move_to` | Navigate to chunk coordinates |
| `claim_land` | Claim tiles in configurable radius/shape |
| `build_structure` | Construct huts, towers, bridges, farms, mines, etc. |
| `terraform_tile` | Change tile type, name, and visual properties |
| `interact` | Form alliances, trade, or fight other creatures |
| `explore` | Autonomous directional exploration |
| `invent_new_biome` | **Create entirely new terrain types with custom rules!** |
| `gather_resources` | Collect food, materials, or energy |
| `rest` | Regenerate stats over time |

### Memory System
- **Short-term**: Last N actions + current world snapshot (injected each LLM call)
- **Long-term**: pgvector embeddings, top-8 retrieved per cosine similarity
- **Global KB**: Opt-in anonymized strategy sharing across players

### Real-time Multiplayer
- Socket.io with chunk-room subscriptions (only receive updates for visible area)
- Creatures broadcast position/stat deltas at 10Hz
- Global events feed (biome inventions, battles, alliances, level-ups)
- PWA with push notifications when cooldown ends

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_HOST` | Redis host | ✅ |
| `JWT_SECRET` | JWT signing secret (64+ chars) | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token secret (64+ chars) | ✅ |
| `ENCRYPTION_KEY` | AES key for API key storage (**exactly 32 chars**) | ✅ |
| `PROMPT_COOLDOWN_HOURS` | Hours between prompt updates (default: 4) | ❌ |
| `SIMULATION_TICK_HZ` | Tick rate (default: 10) | ❌ |
| `MAX_ACTIVE_CREATURES` | Max creatures in simulation (default: 5000) | ❌ |

## Security

- Player API keys: AES-256 encrypted in DB, **never logged or returned to client**
- JWT: 1h access token + 30d refresh token rotation
- Rate limiting: 60 req/min globally, 5/min on register, 10/min on login
- Content moderation on system prompts before any LLM call
- WebSocket connections require valid JWT (verified on `handleConnection`)

## Creature Types

| Emoji | Name | Specialty |
|-------|------|-----------|
| 🫧 | Blobbo | Water & swamps |
| 🦔 | Fuzzling | Defense & walls |
| 🐊 | Snorkle | Fast exploration |
| ⚡ | Zipplet | Speed & energy |
| 🌿 | Gloomp | Nature & farming |
| 🐙 | Wobblo | Complex building |
| 🦑 | Squidlet | Terraforming |
| 💣 | Boomba | PvP combat |
| 🐰 | Fluffnik | Alliances |
| 🦎 | Crinkle | Biome invention |
| 🐸 | Plonker | Resource gathering |
| 🌟 | Zazzle | Balanced stats |

## AI Providers

| Provider | Models | Special |
|----------|--------|---------|
| OpenAI | GPT-4o, GPT-4o-mini | JSON mode |
| Anthropic | Claude Opus/Sonnet/Haiku 4.x | XML output |
| Google | Gemini 2.0 Flash, 1.5 Pro | OpenAI-compat |
| xAI | Grok-2, Grok-2 Mini | OpenAI-compat |