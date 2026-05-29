# Database Layer

Phase 2 uses Drizzle ORM with a local SQLite/libSQL file database. The default development URL is `file:./data/dynalytics.db`.

Schema changes must be made in `src/server/db/schema.ts`, then captured with a Drizzle migration:

```bash
pnpm db:generate
pnpm db:migrate
```

Normal application code should use `src/server/db/index.ts` for database access. UI components must not import this module directly; route handlers and server services own persistence.

Development bootstrap:

```bash
FIRST_ADMIN_EMAIL="you@example.com" FIRST_ADMIN_PASSWORD_HASH="argon2id-hash-from-phase-3" pnpm db:bootstrap
BOOTSTRAP_INVITE_CODES="league-room,waiver-wire" pnpm db:bootstrap
```

The bootstrap script is idempotent. Password hashing is intentionally left to the Phase 3 auth implementation; Phase 2 stores the schema and accepts a precomputed hash so local credentials can be seeded once the auth flow exists.
