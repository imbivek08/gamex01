# 🏏 Cricket Auction

A multiplayer live cricket auction game. Create a private room, invite friends with a short code, and bid in real time to build your dream cricket squad.

Built with **Next.js + TypeScript + Tailwind CSS** (frontend), **Express + Socket.IO** (realtime backend), **Prisma ORM**, and **PostgreSQL**.

---

## Features

- **Private rooms** with a 4-character share code — 4–10 players
- **Host / auctioneer** role: start the auction, open bidding, run the countdown, confirm SOLD/UNSOLD, skip or hand-pick players, pause/resume
- **Live bidding** with server-side validation (membership, purse, bid increments, auction state, timer)
- **Countdown timer** with animated ring, bid history, and toast notifications
- **Persistent state** — refresh the browser or restart the server and the room survives
- **Final results screen** with every squad, spending, and remaining purse
- **150 fictional players** across WK / BAT / BOWL / AR with profiles, ratings, stats, and base prices

---

## Quick Start (one command)

**Prerequisites:** Node.js 18+, Docker (for PostgreSQL)

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (Docker)
npm run db:up

# 3. Run migrations + seed the player pool
npm run db:setup

# 4. Start both servers (web on :3000, realtime on :4000)
npm run dev
```

Then open **http://localhost:3000** in multiple browser tabs:

1. Tab 1: **Create Room** → enter your name → click **Share Invite Link** and send the generated link to your friends
2. Tabs 2–4: **Join Room** → enter the code + your names
3. Tab 1 (host): **Start the Auction**
4. Bidders: place bids with the quick-raise buttons or a custom amount
5. Host: **Start Countdown** → confirm **SOLD** or **UNSOLD** → next player
6. After all players are processed, the **results screen** shows every squad

---

## Environment Variables

Copy `.env.example` to `server/.env` and `web/.env.local`:

| Variable | Location | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | `server/.env` | `postgresql://auction:auction@localhost:5434/cricket_auction` | PostgreSQL connection string |
| `PORT` | `server/.env` | `4000` | Realtime server port |
| `CLIENT_ORIGIN` | `server/.env` | `http://localhost:3000` | Allowed browser origin (CORS) |
| `NEXT_PUBLIC_SERVER_URL` | `web/.env.local` | `http://localhost:4000` | Socket.IO server URL (browser) |

---

## Database Commands

```bash
npm run db:up          # Start PostgreSQL container (port 5434)
npm run db:down        # Stop PostgreSQL container
npm run db:migrate     # Create a new migration (prisma migrate dev)
npm run db:setup       # Apply migrations + seed players (prisma migrate deploy && prisma db seed)
npm run db:seed        # Seed or update the 150 fictional player profiles
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js + Tailwind)                           │
│  /            → create / join room                      │
│  /room/[code] → lobby → live auction → results          │
└──────────────────────┬──────────────────────────────────┘
                       │ Socket.IO (websocket)
┌──────────────────────▼──────────────────────────────────┐
│  Express + Socket.IO server (:4000)                     │
│  • room:create / room:join (with reconnection)          │
│  • bid:place → validated by AuctionEngine               │
│  • host controls (countdown, sold/unsold, skip, pause)  │
│  • broadcasts personalized room snapshots               │
└──────────────────────┬──────────────────────────────────┘
                       │ Prisma ORM
┌──────────────────────▼──────────────────────────────────┐
│  PostgreSQL (:5434)                                     │
│  Room · User · Participant · Player · RoomPlayer ·      │
│  Bid · Purchase · AuctionState                          │
└─────────────────────────────────────────────────────────┘
```

### Server-authoritative auction engine

Every bid is validated against:

1. Room membership & online status
2. Auction phase (`BIDDING` or `COUNTDOWN` only)
3. Player availability (must be the `CURRENT` player)
4. Bid amount (≥ base price / > current bid, ₹0.5 Cr steps)
5. Purse balance (bid ≤ remaining purse)
6. Pause state

Valid bids are persisted to the `Bid` table, the in-memory state is updated, and a personalized snapshot is broadcast to every socket in the room. SOLD/UNSOLD transitions debit purses and write `Purchase` records atomically.

### State persistence

The `AuctionState` table stores the live phase, current player, current bid, and countdown. On server restart, `AuctionManager.recoverAll()` rebuilds in-progress auctions from the database. Clients reconnect via `room:join` with their stored `userId` and receive a fresh snapshot — refreshing the browser never destroys a room.

---

## Project Structure

```
├── docker-compose.yml      # PostgreSQL container
├── package.json            # Workspaces + one-command scripts
├── server/                 # Express + Socket.IO + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # Data model
│   │   └── seed.ts         # 150 fictional players and profile stats
│   └── src/
│       ├── index.ts        # HTTP + Socket.IO bootstrap
│       ├── engine.ts       # Server-authoritative auction engine
│       ├── socket.ts       # Socket event handlers
│       ├── db.ts           # Prisma client
│       └── types.ts        # Shared types
│   └── test-e2e.ts         # Multiplayer Socket.IO test (32 assertions)
└── web/                    # Next.js + Tailwind
    ├── app/
    │   ├── page.tsx        # Landing (create / join)
    │   └── room/[code]/    # Room page (lobby → auction → results)
    ├── components/         # Lobby, AuctionRoom, BidderPanel, HostPanel,
    │                       # CountdownRing, PlayerCard, BidHistory, Results, Toasts
    └── lib/                # socket client, types, formatters
```

---

## Testing Multiplayer Locally

### Automated e2e test

With the server running on `:4000`:

```bash
cd server && npx tsx test-e2e.ts
```

Simulates a host + 4 bidders and verifies the full flow: room creation, joining, bid validation (below base, equal bid, bad increment, host bid), countdown, SOLD with purse debit, skip, unsold, pause/resume, and persistence.

### Manual multi-tab test

1. `npm run dev` → open http://localhost:3000 in 3–4 tabs
2. Tab 1: create a room, share the code
3. Other tabs: join with the code
4. Host starts the auction; bidders place bids; host runs countdowns and confirms sales
5. Refresh any tab — the room state is preserved
6. Finish all players to see the results screen

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start web (:3000) + server (:4000) together |
| `npm run build` | Build both packages for production |
| `npm run start` | Run production builds |
| `npm run db:up` / `db:down` | Start / stop PostgreSQL |
| `npm run db:setup` | Migrate + seed |
| `npm run db:migrate` | Create a new dev migration |

---

## Game Rules (V1)

- Each bidder starts with the room purse (default **₹100 Cr**, configurable 50–200)
- Bids must be in **₹0.5 Cr steps**, at least the base price, and at most the remaining purse
- The host starts a **10-second countdown**; bids are accepted until it ends
- When the countdown ends with a bid, the host confirms **SOLD** — the player joins the bidder's squad and the purse is debited
- With no bids, the host confirms **UNSOLD**
- The auction ends when all players are processed → results screen
