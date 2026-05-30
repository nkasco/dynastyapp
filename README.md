# Dynalytics

Private dynasty fantasy football analytics command center.

## First-Time Setup

Use the setup script from the repo root:

```bash
pnpm setup
```

The setup script checks Node, enables Corepack, creates `.env` from `.env.example` when needed, creates `data/`, and installs dependencies with pnpm.

If you want to do the steps manually:

```bash
corepack enable
pnpm install
cp .env.example .env
mkdir -p data
```

## Local Development

Start the Next.js app:

```bash
pnpm dev
```

Build and run the production build locally:

```bash
pnpm build
pnpm start
```

## Database

Generate Drizzle migrations after schema changes:

```bash
pnpm db:generate
```

Apply migrations:

```bash
pnpm db:migrate
```

Bootstrap local admin/invite settings from `.env`:

```bash
pnpm db:bootstrap
```

Open Drizzle Studio:

```bash
pnpm db:studio
```

Useful `.env` bootstrap fields:

```bash
FIRST_ADMIN_EMAIL=""
FIRST_ADMIN_NAME="League Admin"
FIRST_ADMIN_PASSWORD=""
BOOTSTRAP_INVITE_CODES=""
```

## Local Data Imports

Run the full manual refresh. This queues and runs the same work as the nightly refresh: Sleeper players, linked Sleeper leagues, and nflverse stats.

```bash
pnpm refresh:run
```

For the full nflverse import, especially after changing stat ingestion or rebuilding from an empty database, use a larger Node heap:

```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm refresh:run
```

Run queued import jobs without creating a new nightly refresh job:

```bash
pnpm imports:run
```

Run the refresh worker:

```bash
pnpm refresh:worker
```

The default local database is:

```bash
data/dynalytics.db
```

## Verification

Run lint, typecheck, and tests:

```bash
pnpm check
```

Individual checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:watch
```

## Notes

- Sleeper integration is read-only.
- nflverse data is shared global data, not per-user data.
- Nightly refresh is configured for `1:00 AM America/New_York`, but `pnpm refresh:run` is the local escape hatch when you want fresh data immediately.
