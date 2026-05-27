# Agent Instructions

Before doing any work in this repository, read these files in full:

1. `spec.md`
2. `implementation_plan.md`
3. `soul.md`

These files are the source of truth for architecture, roadmap, and product taste.

## Operating Rules

- Preserve the UI/API/data boundary described in `spec.md`.
- UI components must not import database modules, Sleeper clients, nflverse importers, or other server-only code.
- Use Next.js Route Handlers for internal API endpoints.
- Use Drizzle ORM for database schema and normal database access.
- Use drizzle-kit migrations for every database schema change.
- Keep Sleeper integration read-only. Never implement writes or sync-back behavior to Sleeper.
- Keep ingestion server-side. Nightly refresh should run around `1:00 AM America/New_York`.
- Keep import jobs idempotent and observable.
- Update `implementation_plan.md` checkboxes as phases and tasks are completed.
- Respect the product direction in `soul.md`: private command center, dense but calm, no generic SaaS sprawl.
- Prefer small, verifiable implementation steps over broad rewrites.
- Add tests in proportion to risk, especially for imports, database migrations, auth, and analytics.

## When Starting A Task

1. Re-read the relevant sections of `spec.md`.
2. Check the current phase in `implementation_plan.md`.
3. Confirm the change fits the product taste in `soul.md`.
4. Inspect existing code before editing.
5. Keep changes scoped to the requested phase or task.

## Verification Expectations

For implementation work, verify the relevant layer before declaring the task complete:

- TypeScript compiles for app and API work.
- Drizzle migrations generate and apply for schema work.
- Unit or integration tests pass for parser, importer, auth, and analytics work.
- UI flows are checked responsively for player cards, league pages, charts, and Trade Lab.
- Sleeper remains read-only.
