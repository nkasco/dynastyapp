# Dynasty Fantasy Football Analytics Platform Implementation Plan

## Milestone Model

Milestones are embedded after the phase that unlocks the corresponding platform capability.

- **M0: Project Brain Exists** after Phase 0: The planning artifacts are usable by humans and agents.
- **M1: App Boots** after Phase 1: The shell runs locally with core UI styling.
- **M2: Private Login Works** after Phase 3: Friends can authenticate.
- **M3: API Boundary Works** after Phase 4: UI can call typed internal APIs.
- **M4: Nightly Imports Observable** after Phase 5: Server-side ingestion can run manually and nightly around 1 AM Eastern.
- **M5: Sleeper League Linked** after Phase 7: A user can paste a Sleeper league ID, select their team, and import league data.
- **M6: Player Browser Usable** after Phase 9: Players page works with filters, cards, and key stats.
- **M7: Player Deep Dives Usable** after Phase 10: Player detail pages show stat history and league context.
- **M8: League Analytics Usable** after Phase 11: League, roster, pick, and transaction views are usable.
- **M9: Trade Lab Usable** after Phase 12: Trade scenarios can be built and evaluated.
- **M10: Docker Ready** after Phase 13: App can run in Docker with persistent SQLite and nightly refresh.
- **M11: Private Beta Ready** after Phase 14: Core flows are tested and polished enough for friends.

## Phases

- [x] Phase 0: Planning artifacts
  - [x] Check whether `spec.md` exists; create it only if missing, otherwise update it.
  - [x] Check whether `soul.md` exists; create it only if missing, otherwise update it.
  - [x] Check whether `implementation_plan.md` exists; create it only if missing, otherwise update it.
  - [x] Check whether `AGENTS.md` exists; create it only if missing, otherwise update it.
  - [x] Document the stack and architectural boundaries in `spec.md`.
  - [x] Document product taste and UI principles in `soul.md`.
  - [x] Add this expanded checkbox roadmap to `implementation_plan.md`.
  - [x] Add milestone indicators to `implementation_plan.md`.
  - [x] Add agent operating rules to `AGENTS.md`.

  **Milestone M0: Project Brain Exists**

- [ ] Phase 1: App foundation
  - [ ] Scaffold Next.js 16, React 19, TypeScript 5, and `pnpm`.
  - [ ] Configure App Router project structure.
  - [ ] Add Tailwind CSS 4.
  - [ ] Initialize shadcn/ui with the `new-york` style.
  - [ ] Add base layout, global CSS, app shell, and theme tokens.
  - [ ] Add lucide-react, Sonner, TanStack Query, TanStack Table, React Hook Form, Zod, and Recharts/shadcn charts.
  - [ ] Add lint, typecheck, test, and dev scripts.
  - [ ] Add environment validation for auth, database, and import settings.

  **Milestone M1: App Boots**

- [ ] Phase 2: Database and migrations
  - [ ] Add Drizzle ORM and `drizzle-kit`.
  - [ ] Configure SQLite/libSQL file database.
  - [ ] Add Drizzle config and migration scripts.
  - [ ] Create auth tables.
  - [ ] Create league, roster, player, pick, matchup, transaction, stat, import, and snapshot tables.
  - [ ] Add indexes for player search, league lookup, roster joins, and stat queries.
  - [ ] Add seed/dev bootstrap for first admin and invite codes.
  - [ ] Document that schema changes require Drizzle migrations.

- [ ] Phase 3: Authentication
  - [ ] Configure NextAuth/Auth.js route handlers.
  - [ ] Add GitHub provider.
  - [ ] Add Discord provider.
  - [ ] Add invite-gated local credentials provider.
  - [ ] Hash local passwords with Argon2id.
  - [ ] Add session helpers and protected route utilities.
  - [ ] Add custom sign-in UI using shadcn components.
  - [ ] Add first-admin bootstrap and friend invite flow.

  **Milestone M2: Private Login Works**

- [ ] Phase 4: API and service boundary
  - [ ] Create Zod schemas for request and response shapes.
  - [ ] Create server services for database, auth, Sleeper, nflverse, imports, and analytics.
  - [ ] Add typed client-side API wrapper.
  - [ ] Add consistent API error envelopes.
  - [ ] Add auth guards for private API routes.
  - [ ] Add pagination, filters, and sorting conventions.
  - [ ] Add import-job status responses.
  - [ ] Ensure UI code never imports server-only modules.

  **Milestone M3: API Boundary Works**

- [ ] Phase 5: Server-side refresh jobs
  - [ ] Add server-side refresh runner.
  - [ ] Schedule refresh around `1:00 AM America/New_York`.
  - [ ] Make the job safe to run manually.
  - [ ] Make the job idempotent per source, league, season, and week.
  - [ ] Add import locks.
  - [ ] Record start time, end time, source, status, counts, warnings, and failures.
  - [ ] Add retry/backoff for temporary source failures.
  - [ ] Prepare Docker-friendly cron or worker execution.

  **Milestone M4: Nightly Imports Observable**

- [ ] Phase 6: Sleeper ingestion
  - [ ] Build read-only Sleeper API client.
  - [ ] Add rate-aware fetch and response validation.
  - [ ] Import `/players/nfl` no more than once per day.
  - [ ] Import league metadata from pasted Sleeper league ID.
  - [ ] Import league users and rosters.
  - [ ] Import matchups by week.
  - [ ] Import transactions and traded picks.
  - [ ] Import drafts and draft picks.
  - [ ] Store raw source payloads for debugging.

- [ ] Phase 7: League linking onboarding
  - [ ] Build authenticated onboarding route.
  - [ ] Add form to paste Sleeper league ID.
  - [ ] Validate league existence and show preview.
  - [ ] Fetch league users and rosters.
  - [ ] Let each user select their team.
  - [ ] Store user-to-league/team mapping.
  - [ ] Import all teams in the league for analysis.
  - [ ] Show import progress and warnings.

  **Milestone M5: Sleeper League Linked**

- [ ] Phase 8: nflverse stats ingestion
  - [ ] Import DynastyProcess/nflreadr player ID bridge.
  - [ ] Map Sleeper player IDs to GSIS IDs.
  - [ ] Import nflverse weekly player stats.
  - [ ] Import nflverse season summaries.
  - [ ] Store current season plus prior five seasons by default.
  - [ ] Add derived fantasy stat summaries.
  - [ ] Track unmapped players.
  - [ ] Show source freshness in the UI.

- [ ] Phase 9: Players page
  - [ ] Build `/players` route.
  - [ ] Add searchable player grid/list.
  - [ ] Add filters for position, team, fantasy relevance, rostered status, age, and injury.
  - [ ] Add sorting by name, age, position, production, and roster exposure.
  - [ ] Build premium player card component.
  - [ ] Add card stats, trend sparkline, badges, and team-color accents.
  - [ ] Add responsive desktop/mobile layouts.
  - [ ] Add empty, loading, and error states.

  **Milestone M6: Player Browser Usable**

- [ ] Phase 10: Player detail analytics
  - [ ] Build `/players/[id]` route.
  - [ ] Show Sleeper profile data and roster exposure.
  - [ ] Show weekly stat history.
  - [ ] Show season aggregates.
  - [ ] Show recent trend charts.
  - [ ] Show league ownership and lineup context.
  - [ ] Show transaction and draft history where available.
  - [ ] Add compare actions for future Trade Lab use.

  **Milestone M7: Player Deep Dives Usable**

- [ ] Phase 11: League and roster analytics
  - [ ] Build linked leagues overview.
  - [ ] Build league detail route.
  - [ ] Show all rosters in the league.
  - [ ] Show team strength by position.
  - [ ] Show age curve and roster construction.
  - [ ] Show pick inventory.
  - [ ] Show matchup and standings context.
  - [ ] Show transaction timeline.

  **Milestone M8: League Analytics Usable**

- [ ] Phase 12: Trade Lab
  - [ ] Build trade scenario builder.
  - [ ] Support players and draft picks as assets.
  - [ ] Support both sides selecting assets from league rosters.
  - [ ] Add roster-fit analysis.
  - [ ] Add age and production trend analysis.
  - [ ] Add positional scarcity heuristics.
  - [ ] Add explainable trade summary.
  - [ ] Save private trade scenarios locally.

  **Milestone M9: Trade Lab Usable**

- [ ] Phase 13: Docker and operations
  - [ ] Add Dockerfile.
  - [ ] Add Docker Compose file.
  - [ ] Mount SQLite database as persistent volume.
  - [ ] Add Docker environment examples.
  - [ ] Add nightly job execution in Docker.
  - [ ] Add backup guidance for SQLite.
  - [ ] Add startup and migration commands.
  - [ ] Add healthcheck endpoint.

  **Milestone M10: Docker Ready**

- [ ] Phase 14: Verification and polish
  - [ ] Add unit tests for parsers, mappers, and analytics.
  - [ ] Add integration tests for API routes.
  - [ ] Add database migration smoke tests.
  - [ ] Add import idempotency tests.
  - [ ] Add Playwright tests for auth, league linking, players page, and Trade Lab.
  - [ ] Verify responsive UI at desktop and mobile sizes.
  - [ ] Verify charts render with real imported data.
  - [ ] Confirm Sleeper integration is read-only.

  **Milestone M11: Private Beta Ready**

## Assumptions

- The first implementation pass only creates or updates the four planning files.
- Nightly refresh means approximately `1:00 AM America/New_York`.
- Docker follows local Node success.
- Drizzle migrations are mandatory for database schema changes.
