# Dynalytics Implementation Plan

## Milestone Model

Milestones are embedded after the phase that unlocks the corresponding platform capability.

- **M0: Project Brain Exists** after Phase 0: The planning artifacts are usable by humans and agents.
- **M1: App Boots** after Phase 1: The shell runs locally with core UI styling.
- **M2: Private Login Works** after Phase 3: Friends can authenticate.
- **M3: API Boundary Works** after Phase 4: UI can call typed internal APIs.
- **M4: Nightly Imports Observable** after Phase 5: Server-side ingestion can run manually and nightly around 1 AM Eastern.
- **M5: Sleeper League Linked** after Phase 7: A user can paste a Sleeper league ID, select their team, and import league data.
- **M6: Player Browser Usable** after Phase 9: Players page works with filters, cards, and key stats.
- **M7: Player Browser Refined** after Phase 10: Players page has league-scoped watchlists, stronger filtering, pagination, and player overlays.
- **M8: Command Shell Usable** after Phase 11: Dashboard, sidebar navigation, profile, and branding work as a cohesive app frame.
- **M9: League UX Resilient** after Phase 12: League and player selection handle empty/redraft leagues cleanly.
- **M10: Player Deep Dives Usable** after Phase 13: Player detail pages show stat history and league context.
- **M11: League Analytics Usable** after Phase 14: League, roster, pick, and transaction views are usable.
- **M12: Trade Lab Usable** after Phase 15: Trade scenarios can be built and evaluated.
- **M13: Docker Ready** after Phase 16: App can run in Docker with persistent SQLite and nightly refresh.
- **M14: Private Beta Ready** after Phase 17: Core flows are tested and polished enough for friends.

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

- [x] Phase 1: App foundation
  - [x] Scaffold Next.js 16, React 19, TypeScript 5, and `pnpm`.
  - [x] Configure App Router project structure.
  - [x] Add Tailwind CSS 4.
  - [x] Initialize shadcn/ui with the `new-york` style.
  - [x] Add base layout, global CSS, app shell, and theme tokens.
  - [x] Add lucide-react, Sonner, TanStack Query, TanStack Table, React Hook Form, Zod, and Recharts/shadcn charts.
  - [x] Add lint, typecheck, test, and dev scripts.
  - [x] Add environment validation for auth, database, and import settings.
  - [x] Confirm the running app before declaring M1.

  **Milestone M1: App Boots** ✅

- [x] Phase 2: Database and migrations
  - [x] Add Drizzle ORM and `drizzle-kit`.
  - [x] Configure SQLite/libSQL file database.
  - [x] Add Drizzle config and migration scripts.
  - [x] Create auth tables.
  - [x] Create league, roster, player, pick, matchup, transaction, stat, import, and snapshot tables.
  - [x] Add indexes for player search, league lookup, roster joins, and stat queries.
  - [x] Add seed/dev bootstrap for first admin and invite codes.
  - [x] Document that schema changes require Drizzle migrations.

- [x] Phase 3: Authentication
  - [x] Configure NextAuth/Auth.js route handlers.
  - [x] Add GitHub provider.
  - [x] Add Discord provider.
  - [x] Add invite-gated local credentials provider.
  - [x] Hash local passwords with Argon2id.
  - [x] Add session helpers and protected route utilities.
  - [x] Add custom sign-in UI using shadcn components.
  - [x] Add first-admin bootstrap and friend invite flow.

  **Milestone M2: Private Login Works** ✅

- [x] Phase 4: API and service boundary
  - [x] Create Zod schemas for request and response shapes.
  - [x] Create server services for database, auth, Sleeper, nflverse, imports, and analytics.
  - [x] Add typed client-side API wrapper.
  - [x] Add consistent API error envelopes.
  - [x] Add auth guards for private API routes.
  - [x] Add pagination, filters, and sorting conventions.
  - [x] Add import-job status responses.
  - [x] Ensure UI code never imports server-only modules.

  **Milestone M3: API Boundary Works** ✅

- [x] Phase 5: Server-side refresh jobs
  - [x] Add server-side refresh runner.
  - [x] Schedule refresh around `1:00 AM America/New_York`.
  - [x] Make the job safe to run manually.
  - [x] Make the job idempotent per source, league, season, and week.
  - [x] Add import locks.
  - [x] Record start time, end time, source, status, counts, warnings, and failures.
  - [x] Add retry/backoff for temporary source failures.
  - [x] Prepare Docker-friendly cron or worker execution.

  **Milestone M4: Nightly Imports Observable** ✅

- [x] Phase 6: Sleeper ingestion
  - [x] Build read-only Sleeper API client.
  - [x] Add rate-aware fetch and response validation.
  - [x] Import `/players/nfl` no more than once per day.
  - [x] Import league metadata from pasted Sleeper league ID.
  - [x] Import league users and rosters.
  - [x] Import matchups by week.
  - [x] Import transactions and traded picks.
  - [x] Import drafts and draft picks.
  - [x] Store raw source payloads for debugging.

- [x] Phase 7: League linking onboarding
  - [x] Build authenticated onboarding route.
  - [x] Add form to paste Sleeper league ID.
  - [x] Validate league existence and show preview.
  - [x] Fetch league users and rosters.
  - [x] Let each user select their team.
  - [x] Store user-to-league/team mapping.
  - [x] Import all teams in the league for analysis.
  - [x] Show import progress and warnings.

  **Milestone M5: Sleeper League Linked** ✅

- [x] Phase 8: nflverse stats ingestion
  - [x] Import DynastyProcess/nflreadr player ID bridge.
  - [x] Map Sleeper player IDs to GSIS IDs.
  - [x] Import nflverse weekly player stats.
  - [x] Import nflverse season summaries.
  - [x] Store current season plus prior five seasons by default.
  - [x] Add derived fantasy stat summaries.
  - [x] Track unmapped players.
  - [x] Show source freshness in the UI.

- [x] Phase 9: Players page
  - [x] Build `/players` route.
  - [x] Add searchable player grid/list.
  - [x] Add filters for position, team, fantasy relevance, rostered status, age, and injury.
  - [x] Add sorting by name, age, position, production, and roster exposure.
  - [x] Build premium player card component.
  - [x] Add card stats, trend sparkline, badges, and team-color accents.
  - [x] Add locally cached player headshots refreshed by an ad-hoc `pnpm` command.
  - [x] Add responsive desktop/mobile layouts.
  - [x] Add empty, loading, and error states.

  **Milestone M6: Player Browser Usable** ✅

- [x] Phase 10: Player browser refinement and watchlists
  - [x] Add database schema and Drizzle migration for profile-and-league-scoped watchlists keyed by user profile, league, and player.
  - [x] Ensure watchlists do not conflict when two profiles link the same Sleeper league.
  - [x] Add internal watchlist API routes and typed client methods for list, add, and remove operations.
  - [x] Add a star control to the right of each player name on the Players page.
  - [x] Make the star set and unset that player on the active league's watchlist for the current profile.
  - [x] Keep the watchlist tied to the selected league so changing leagues changes the watchlist context.
  - [x] Rework confusing Players page filters; remove low-value options and keep only filters with clear decision value.
  - [x] Add `Flex` to the position filter as RB/WR/TE.
  - [x] Remove the league scoring banner from the Players page.
  - [x] Fix the contrast with the "Player browser" badge on the players page so it is readable in dark and light themes.
  - [x] Move the "position" and "sort" controls onto their own row, put the filters to the right of those controlsm, remove the half ppr scoring badge that is to the right side of the filters currently. but keep where it says it on each player card (add the badge to the player card before "Half PPR" or whatever setting it is whether it's full ppr, etc. they can all have the badge.)
  - [x] Add explicit ascending and descending sort controls, this can be represented by a directional arrow to the right of the selected Sort option that corresponds with aschending or descending, and if you click the sort control again it alternates between the 2.
  - [x] Add pagination controls so users can browse beyond the first 36 players.
  - [x] Add a full-screen player card overlay opened from card click, with dimmed/blurred backdrop and a chunky framed surface.
  - [x] Include clean tabbed or sectioned analytic charts and tables in the player overlay.
  - [x] Verify the overlay, filters, sort direction, pagination, and watchlist states on desktop and mobile.

  **Milestone M7: Player Browser Refined**

- [ ] Phase 11: App shell, dashboard, profile, and branding
  - [ ] Add a real dashboard home page for the private command center.
  - [ ] Add Dashboard to primary navigation.
  - [ ] Convert top navigation to a collapsible left sidebar.
  - [ ] Order sidebar items as Dashboard, Leagues, Players, Trade Lab, Reports.
  - [ ] Show only icons and hide word labels when the sidebar is collapsed.
  - [ ] Move profile and logout controls to the bottom of the sidebar.
  - [ ] Add a profile page for current-user account/profile settings.
  - [ ] Add a favicon.
  - [ ] Change the on-page `DC` mark to a single capital `D`.
  - [ ] Verify sidebar collapse, profile/logout placement, active states, and responsive behavior.

  **Milestone M8: Command Shell Usable**

- [ ] Phase 12: League selection robustness and empty-league states
  - [ ] Detect linked Sleeper leagues that have no rostered players yet.
  - [ ] Present sensible no-data states on the Leagues page for leagues with empty rosters.
  - [ ] Omit empty/redraft leagues from the Players page league dropdown until player roster data exists.
  - [ ] Keep league linking and refresh flows read-only toward Sleeper.
  - [ ] Add tests for empty-roster league summaries and Players page league dropdown eligibility.

  **Milestone M9: League UX Resilient**

- [ ] Phase 13: Player detail analytics
  - [ ] Build `/players/[id]` route.
  - [ ] Show Sleeper profile data and roster exposure.
  - [ ] Show weekly stat history.
  - [ ] Show season aggregates.
  - [ ] Show recent trend charts.
  - [ ] Show league ownership and lineup context.
  - [ ] Show transaction and draft history where available.
  - [ ] Add compare actions for future Trade Lab use.

  **Milestone M10: Player Deep Dives Usable**

- [ ] Phase 14: League and roster analytics
  - [x] Build linked leagues overview.
  - [x] Show linked league metadata, scoring label, roster count, and import freshness.
  - [x] Show all roster entries for the selected linked league.
  - [x] Show per-roster player counts.
  - [x] Add roster shortcuts from league view to filtered Players page results.
  - [ ] Build league detail route.
  - [ ] Show team strength by position.
  - [ ] Show age curve and roster construction.
  - [ ] Show pick inventory.
  - [ ] Show matchup and standings context.
  - [ ] Show transaction timeline.

  **Milestone M11: League Analytics Usable**

- [ ] Phase 15: Trade Lab
  - [ ] Build trade scenario builder.
  - [ ] Support players and draft picks as assets.
  - [ ] Support both sides selecting assets from league rosters.
  - [ ] Add roster-fit analysis.
  - [ ] Add age and production trend analysis.
  - [ ] Add positional scarcity heuristics.
  - [ ] Add explainable trade summary.
  - [ ] Save private trade scenarios locally.

  **Milestone M12: Trade Lab Usable**

- [ ] Phase 16: Docker and operations
  - [ ] Add Dockerfile.
  - [ ] Add Docker Compose file.
  - [ ] Mount SQLite database as persistent volume.
  - [ ] Add Docker environment examples.
  - [ ] Add nightly job execution in Docker.
  - [ ] Add backup guidance for SQLite.
  - [ ] Add startup and migration commands.
  - [ ] Add healthcheck endpoint.

  **Milestone M13: Docker Ready**

- [ ] Phase 17: Verification and polish
  - [ ] Add unit tests for parsers, mappers, and analytics.
  - [ ] Add integration tests for API routes.
  - [ ] Add database migration smoke tests.
  - [ ] Add import idempotency tests.
  - [ ] Add Playwright tests for auth, league linking, players page, and Trade Lab.
  - [ ] Verify responsive UI at desktop and mobile sizes.
  - [ ] Verify charts render with real imported data.
  - [ ] Confirm Sleeper integration is read-only.

  **Milestone M14: Private Beta Ready**

## Assumptions

- The first implementation pass only creates or updates the four planning files.
- Nightly refresh means approximately `1:00 AM America/New_York`.
- Docker follows local Node success.
- Drizzle migrations are mandatory for database schema changes.
