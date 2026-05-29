# Dynalytics Spec

## Purpose

This project is a private, web-based dynasty fantasy football analytics platform for a small friend group. It is not a commercial SaaS product. The platform should make imported league, roster, player, pick, and stats data easy to explore, compare, and use for trade decisions.

The app is self-contained. Sleeper and nflverse are data sources only. Nothing in this platform should sync, mutate, or write back to Sleeper.

## Core Stack

- Framework: Next.js 16 using the App Router
- UI: React 19, TypeScript 5, shadcn/ui, Tailwind CSS 4
- Charts: shadcn charts backed by Recharts; add direct Recharts usage where shadcn abstractions are not enough
- Icons: lucide-react
- Tables: TanStack Table
- Client data fetching: TanStack Query
- Forms and validation: React Hook Form and Zod
- Auth: NextAuth/Auth.js
- Database: SQLite through Drizzle ORM
- Migrations: drizzle-kit
- Package manager: pnpm
- Runtime: Node.js locally first, Docker later

## Runtime And Deployment

The first implementation target is a local Node.js runtime. Docker is the production-shaped target once the app is stable locally.

SQLite should be stored in a predictable local path during development and mounted as a persistent Docker volume later.

Suggested paths:

- Local database: `./data/dynalytics.db`
- Docker database: `/app/data/dynalytics.db`

The app should not target the Edge runtime because SQLite access, import jobs, and filesystem-backed operational tasks need a Node runtime.

## Architecture

The project is a single Next.js application with a strict boundary between the visual UI and the data/API layer.

UI responsibilities:

- Render pages, app shell, charts, cards, tables, forms, and interactive flows.
- Call the internal API client only.
- Never import database modules, external Sleeper clients, nflverse importers, or server-only utilities.

API and server responsibilities:

- Route Handlers under `/app/api/**/route.ts` expose internal API endpoints.
- Server modules under `src/server/**` own persistence, auth helpers, data ingestion, source clients, and analytics.
- Contracts under `src/contracts/**` define Zod request and response schemas shared by API handlers and client wrappers.
- Database schema and migrations live in Drizzle-owned files.

Recommended folders once implementation begins:

```text
app/
  api/
  (auth)/
  (app)/
src/
  components/
  contracts/
  lib/
  server/
    auth/
    db/
    imports/
    nflverse/
    sleeper/
    analytics/
drizzle/
data/
```

## Authentication

Use NextAuth/Auth.js as the authentication layer with these providers:

- GitHub OAuth
- Discord OAuth
- Local credentials

Local credentials must be invite-gated. Passwords must be hashed with Argon2id. The first admin may be bootstrapped through a setup command or controlled environment variable.

Auth data should persist in SQLite. Schema changes for auth tables must be represented through Drizzle migrations.

## Database And Migrations

Use Drizzle ORM for all database schema definitions and normal query work. Use drizzle-kit for generating and applying migrations.

Rules:

- All schema changes require a Drizzle migration.
- Raw SQL should be rare and reviewed.
- Import operations must be idempotent.
- Source freshness, import warnings, failures, and raw source snapshots should be stored.
- Add indexes early for player search, league lookup, roster joins, stat queries, and import status checks.

Core schema areas:

- Auth: users, accounts, sessions, verification tokens, local credentials, invite codes
- Sleeper: leagues, league users, rosters, roster players, matchups, transactions, traded picks, drafts, draft picks
- Players: canonical players, source IDs, team, position, status, age, metadata, source freshness
- nflverse: player ID bridge, weekly stats, season aggregates, derived fantasy summaries
- Analytics: trade scenarios, trade assets, evaluations, saved comparisons
- Operations: import jobs, import locks, source snapshots, warning queue, app settings

## Data Sources

### Sleeper

Sleeper provides:

- NFL player data
- Fantasy league metadata
- League users
- Rosters
- Matchups
- Transactions
- Traded picks
- Drafts and draft picks

Sleeper player data is the authority for player identity inside the app. The Sleeper integration must be read-only.

The `/players/nfl` payload should be refreshed no more than once per day. Linked leagues are imported from user-pasted Sleeper league IDs. After a league is linked, import all teams in that league so the platform can analyze roster context and potential trades across the league.

### nflverse

nflverse provides statistical history and player performance data.

Use nflverse weekly player stats and season summaries for current season plus the prior five seasons by default. Use nflreadr/DynastyProcess player ID bridge data to map Sleeper player IDs to GSIS IDs where needed.

Unmapped players should not block ingestion. Store them in a warning queue and surface the issue in import status UI.

## Server-Side Refresh Cadence

Data ingestion refresh should run server-side around `1:00 AM America/New_York` nightly.

The nightly refresh should:

- Be safe to trigger manually.
- Use import locks to avoid overlapping runs.
- Be idempotent by source, league, season, and week.
- Track start time, end time, status, counts, warnings, and failures.
- Retry transient failures with backoff.
- Continue independent import units when one league or source fails.
- Be Docker-friendly through cron, a worker process, or a scheduled command inside the container.

## Internal API Surface

Initial API routes should include:

- `GET /api/me`
- `GET /api/players`
- `GET /api/players/[id]`
- `POST /api/leagues/link`
- `GET /api/leagues`
- `GET /api/leagues/[id]`
- `POST /api/imports/sleeper`
- `POST /api/imports/nflverse`
- `GET /api/imports/[id]`
- `POST /api/trades/evaluate`

API conventions:

- Validate all inputs with Zod.
- Return typed success payloads.
- Return consistent error envelopes.
- Require auth for private app data.
- Support pagination, filtering, and sorting on list endpoints.
- Keep source API details out of UI components.

## Product Surfaces

### Players

The players page is a core experience. It should provide fast search, filters, sorting, and polished player cards.

Player cards should show:

- Name
- Position
- NFL team
- Age
- Injury/status
- Roster exposure in linked leagues
- Key season stat line
- Recent trend or sparkline
- Relevant badges such as rookie, taxi, IR, free agent, breakout trend, or declining usage

### Player Detail

Player detail pages should show:

- Sleeper profile data
- Weekly stat history
- Season aggregates
- Recent trend charts
- League ownership context
- Roster and lineup context
- Transaction and draft history where available
- Compare/trade actions

### League Analytics

League views should show:

- Linked leagues
- All rosters
- Team strength by position
- Age curve
- Roster construction
- Pick inventory
- Matchup and standings context
- Transaction timeline

### Trade Lab

Trade Lab should let users build trade scenarios with players and picks from imported league data.

The first version should be explainable rather than pretending to be an oracle. It should consider:

- Production
- Age
- Position
- Scarcity
- Roster fit
- League format
- Pick year and round
- Recent trend

The output should explain why a trade looks strong, risky, balanced, or lopsided.

## UI Direction

Use shadcn/ui for primitives and Tailwind CSS 4 for layout, spacing, and polish. The app should feel like a private dynasty command center rather than a marketing dashboard.

The UI should be dense, calm, sharp, and quick to scan. Use cards only when they are the interaction or contain repeated objects such as player cards. Avoid generic dashboard-card sprawl.

Charts should be embedded where they clarify decisions: player trends, roster construction, pick inventory, positional strength, and trade comparisons.

## References

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Auth.js: https://authjs.dev/
- Drizzle SQLite: https://orm.drizzle.team/docs/get-started-sqlite
- Sleeper API: https://docs.sleeper.com/
- nflreadr player stats: https://nflreadr.nflverse.com/reference/load_player_stats
- nflreadr player IDs: https://nflreadr.nflverse.com/reference/load_ff_playerids.html
- shadcn charts: https://ui.shadcn.com/charts
