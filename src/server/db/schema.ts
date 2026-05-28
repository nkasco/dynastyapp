import { relations, sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const jsonText = <TData>(name: string) => text(name, { mode: "json" }).$type<TData>();

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
    image: text("image"),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_role_idx").on(table.role),
  ],
);

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const localCredentials = sqliteTable(
  "local_credentials",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    passwordAlgorithm: text("password_algorithm").notNull().default("argon2id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

export const inviteCodes = sqliteTable(
  "invite_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull(),
    label: text("label"),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("invite_codes_code_hash_unique").on(table.codeHash),
    index("invite_codes_active_idx").on(table.revokedAt, table.expiresAt),
  ],
);

export const inviteRedemptions = sqliteTable(
  "invite_redemptions",
  {
    id: text("id").primaryKey(),
    inviteCodeId: text("invite_code_id")
      .notNull()
      .references(() => inviteCodes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: integer("redeemed_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("invite_redemptions_invite_user_unique").on(table.inviteCodeId, table.userId),
    index("invite_redemptions_user_id_idx").on(table.userId),
  ],
);

export const leagues = sqliteTable(
  "leagues",
  {
    id: text("id").primaryKey(),
    sleeperLeagueId: text("sleeper_league_id").notNull(),
    name: text("name").notNull(),
    avatar: text("avatar"),
    season: integer("season").notNull(),
    status: text("status"),
    sport: text("sport").notNull().default("nfl"),
    scoringSettings: jsonText<Record<string, unknown>>("scoring_settings"),
    rosterPositions: jsonText<string[]>("roster_positions"),
    settings: jsonText<Record<string, unknown>>("settings"),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    importedAt: integer("imported_at", { mode: "timestamp_ms" }),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("leagues_sleeper_league_id_unique").on(table.sleeperLeagueId),
    index("leagues_season_idx").on(table.season),
    index("leagues_name_idx").on(table.name),
  ],
);

export const leagueUsers = sqliteTable(
  "league_users",
  {
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    sleeperUserId: text("sleeper_user_id").notNull(),
    displayName: text("display_name"),
    username: text("username"),
    avatar: text("avatar"),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.leagueId, table.sleeperUserId] }),
    index("league_users_league_display_name_idx").on(table.leagueId, table.displayName),
  ],
);

export const userLeagueTeams = sqliteTable(
  "user_league_teams",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    rosterId: integer("roster_id").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.leagueId] }),
    index("user_league_teams_roster_idx").on(table.leagueId, table.rosterId),
  ],
);

export const rosters = sqliteTable(
  "rosters",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    rosterId: integer("roster_id").notNull(),
    ownerSleeperUserId: text("owner_sleeper_user_id"),
    coOwners: jsonText<string[]>("co_owners"),
    settings: jsonText<Record<string, unknown>>("settings"),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("rosters_league_roster_unique").on(table.leagueId, table.rosterId),
    index("rosters_league_id_idx").on(table.leagueId),
    index("rosters_owner_idx").on(table.leagueId, table.ownerSleeperUserId),
  ],
);

export const players = sqliteTable(
  "players",
  {
    sleeperPlayerId: text("sleeper_player_id").primaryKey(),
    fullName: text("full_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    searchName: text("search_name").notNull(),
    position: text("position"),
    team: text("team"),
    status: text("status"),
    age: real("age"),
    birthDate: text("birth_date"),
    yearsExp: integer("years_exp"),
    fantasyPositions: jsonText<string[]>("fantasy_positions"),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("players_search_name_idx").on(table.searchName),
    index("players_position_team_idx").on(table.position, table.team),
    index("players_team_idx").on(table.team),
    index("players_status_idx").on(table.status),
  ],
);

export const playerSourceIds = sqliteTable(
  "player_source_ids",
  {
    sleeperPlayerId: text("sleeper_player_id")
      .notNull()
      .references(() => players.sleeperPlayerId, { onDelete: "cascade" }),
    source: text("source").notNull(),
    sourcePlayerId: text("source_player_id").notNull(),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.source, table.sourcePlayerId] }),
    index("player_source_ids_sleeper_idx").on(table.sleeperPlayerId),
  ],
);

export const rosterPlayers = sqliteTable(
  "roster_players",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    rosterId: integer("roster_id").notNull(),
    sleeperPlayerId: text("sleeper_player_id")
      .notNull()
      .references(() => players.sleeperPlayerId, { onDelete: "cascade" }),
    slot: text("slot", { enum: ["roster", "starter", "taxi", "reserve"] }).notNull().default("roster"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("roster_players_league_roster_player_slot_unique").on(
      table.leagueId,
      table.rosterId,
      table.sleeperPlayerId,
      table.slot,
    ),
    index("roster_players_roster_idx").on(table.leagueId, table.rosterId),
    index("roster_players_player_idx").on(table.sleeperPlayerId),
  ],
);

export const matchups = sqliteTable(
  "matchups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    rosterId: integer("roster_id").notNull(),
    matchupId: integer("matchup_id"),
    points: real("points"),
    starters: jsonText<string[]>("starters"),
    players: jsonText<string[]>("players"),
    playerPoints: jsonText<Record<string, number>>("player_points"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("matchups_league_season_week_roster_unique").on(
      table.leagueId,
      table.season,
      table.week,
      table.rosterId,
    ),
    index("matchups_league_week_idx").on(table.leagueId, table.season, table.week),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    sleeperTransactionId: text("sleeper_transaction_id").notNull(),
    type: text("type").notNull(),
    status: text("status"),
    rosterIds: jsonText<number[]>("roster_ids"),
    adds: jsonText<Record<string, number>>("adds"),
    drops: jsonText<Record<string, number>>("drops"),
    draftPicks: jsonText<unknown[]>("draft_picks"),
    waiverBudget: jsonText<unknown[]>("waiver_budget"),
    createdAtMs: integer("created_at_ms", { mode: "timestamp_ms" }),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("transactions_sleeper_unique").on(table.leagueId, table.sleeperTransactionId),
    index("transactions_league_created_idx").on(table.leagueId, table.createdAtMs),
    index("transactions_type_idx").on(table.type),
  ],
);

export const drafts = sqliteTable(
  "drafts",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id").references(() => leagues.id, { onDelete: "set null" }),
    sleeperDraftId: text("sleeper_draft_id").notNull(),
    season: integer("season").notNull(),
    type: text("type"),
    status: text("status"),
    settings: jsonText<Record<string, unknown>>("settings"),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("drafts_sleeper_draft_id_unique").on(table.sleeperDraftId),
    index("drafts_league_season_idx").on(table.leagueId, table.season),
  ],
);

export const draftPicks = sqliteTable(
  "draft_picks",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    leagueId: text("league_id").references(() => leagues.id, { onDelete: "set null" }),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    pickNo: integer("pick_no").notNull(),
    rosterId: integer("roster_id"),
    pickedByRosterId: integer("picked_by_roster_id"),
    sleeperPlayerId: text("sleeper_player_id").references(() => players.sleeperPlayerId, { onDelete: "set null" }),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("draft_picks_draft_pick_unique").on(table.draftId, table.pickNo),
    index("draft_picks_player_idx").on(table.sleeperPlayerId),
    index("draft_picks_league_season_roster_idx").on(table.leagueId, table.season, table.rosterId),
  ],
);

export const tradedPicks = sqliteTable(
  "traded_picks",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    round: integer("round").notNull(),
    rosterId: integer("roster_id").notNull(),
    ownerRosterId: integer("owner_roster_id").notNull(),
    previousOwnerRosterId: integer("previous_owner_roster_id"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("traded_picks_identity_unique").on(table.leagueId, table.season, table.round, table.rosterId),
    index("traded_picks_owner_idx").on(table.leagueId, table.ownerRosterId),
  ],
);

export const weeklyStats = sqliteTable(
  "weekly_stats",
  {
    id: text("id").primaryKey(),
    sleeperPlayerId: text("sleeper_player_id").references(() => players.sleeperPlayerId, { onDelete: "set null" }),
    gsisId: text("gsis_id"),
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    seasonType: text("season_type").notNull().default("REG"),
    team: text("team"),
    opponent: text("opponent"),
    position: text("position"),
    stats: jsonText<Record<string, number | string | null>>("stats").notNull(),
    fantasyPointsPpr: real("fantasy_points_ppr"),
    fantasyPointsHalfPpr: real("fantasy_points_half_ppr"),
    fantasyPointsStandard: real("fantasy_points_standard"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("weekly_stats_player_week_unique").on(
      table.season,
      table.week,
      table.seasonType,
      table.sleeperPlayerId,
    ),
    index("weekly_stats_player_idx").on(table.sleeperPlayerId, table.season, table.week),
    index("weekly_stats_gsis_idx").on(table.gsisId),
    index("weekly_stats_season_week_idx").on(table.season, table.week),
  ],
);

export const seasonStats = sqliteTable(
  "season_stats",
  {
    id: text("id").primaryKey(),
    sleeperPlayerId: text("sleeper_player_id").references(() => players.sleeperPlayerId, { onDelete: "set null" }),
    gsisId: text("gsis_id"),
    season: integer("season").notNull(),
    seasonType: text("season_type").notNull().default("REG"),
    team: text("team"),
    position: text("position"),
    games: integer("games"),
    stats: jsonText<Record<string, number | string | null>>("stats").notNull(),
    fantasyPointsPpr: real("fantasy_points_ppr"),
    fantasyPointsHalfPpr: real("fantasy_points_half_ppr"),
    fantasyPointsStandard: real("fantasy_points_standard"),
    sourceUpdatedAt: integer("source_updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("season_stats_player_season_unique").on(table.season, table.seasonType, table.sleeperPlayerId),
    index("season_stats_player_idx").on(table.sleeperPlayerId, table.season),
    index("season_stats_gsis_idx").on(table.gsisId),
    index("season_stats_query_idx").on(table.season, table.position, table.team),
  ],
);

export const tradeScenarios = sqliteTable(
  "trade_scenarios",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    leagueId: text("league_id").references(() => leagues.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary"),
    evaluation: jsonText<Record<string, unknown>>("evaluation"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("trade_scenarios_user_idx").on(table.userId, table.updatedAt),
    index("trade_scenarios_league_idx").on(table.leagueId),
  ],
);

export const tradeAssets = sqliteTable(
  "trade_assets",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => tradeScenarios.id, { onDelete: "cascade" }),
    side: text("side", { enum: ["give", "get"] }).notNull(),
    assetType: text("asset_type", { enum: ["player", "pick"] }).notNull(),
    sleeperPlayerId: text("sleeper_player_id").references(() => players.sleeperPlayerId, { onDelete: "set null" }),
    pickSeason: integer("pick_season"),
    pickRound: integer("pick_round"),
    rosterId: integer("roster_id"),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    createdAt: createdAt(),
  },
  (table) => [
    index("trade_assets_scenario_idx").on(table.scenarioId, table.side),
    index("trade_assets_player_idx").on(table.sleeperPlayerId),
  ],
);

export const importJobs = sqliteTable(
  "import_jobs",
  {
    id: text("id").primaryKey(),
    source: text("source", { enum: ["sleeper", "nflverse", "bootstrap", "system"] }).notNull(),
    status: text("status", { enum: ["queued", "running", "succeeded", "failed", "partial"] }).notNull(),
    scope: text("scope"),
    leagueId: text("league_id").references(() => leagues.id, { onDelete: "set null" }),
    season: integer("season"),
    week: integer("week"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    counts: jsonText<Record<string, number>>("counts"),
    error: text("error"),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("import_jobs_status_idx").on(table.status, table.createdAt),
    index("import_jobs_source_scope_idx").on(table.source, table.scope, table.season, table.week),
    index("import_jobs_league_idx").on(table.leagueId),
  ],
);

export const importLocks = sqliteTable(
  "import_locks",
  {
    lockKey: text("lock_key").primaryKey(),
    source: text("source").notNull(),
    ownerId: text("owner_id").notNull(),
    acquiredAt: integer("acquired_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    metadata: jsonText<Record<string, unknown>>("metadata"),
  },
  (table) => [index("import_locks_expires_at_idx").on(table.expiresAt)],
);

export const sourceSnapshots = sqliteTable(
  "source_snapshots",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceKey: text("source_key").notNull(),
    leagueId: text("league_id").references(() => leagues.id, { onDelete: "set null" }),
    season: integer("season"),
    week: integer("week"),
    payload: jsonText<unknown>("payload").notNull(),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("source_snapshots_source_key_unique").on(table.source, table.sourceKey),
    index("source_snapshots_lookup_idx").on(table.source, table.leagueId, table.season, table.week),
  ],
);

export const warningQueue = sqliteTable(
  "warning_queue",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    code: text("code").notNull(),
    message: text("message").notNull(),
    severity: text("severity", { enum: ["info", "warning", "error"] }).notNull().default("warning"),
    leagueId: text("league_id").references(() => leagues.id, { onDelete: "set null" }),
    sleeperPlayerId: text("sleeper_player_id").references(() => players.sleeperPlayerId, { onDelete: "set null" }),
    metadata: jsonText<Record<string, unknown>>("metadata"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("warning_queue_open_idx").on(table.resolvedAt, table.severity),
    index("warning_queue_source_code_idx").on(table.source, table.code),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonText<unknown>("value").notNull(),
  updatedAt: updatedAt(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  localCredential: one(localCredentials),
  teams: many(userLeagueTeams),
  tradeScenarios: many(tradeScenarios),
}));

export const leaguesRelations = relations(leagues, ({ many }) => ({
  users: many(leagueUsers),
  rosters: many(rosters),
  matchups: many(matchups),
  transactions: many(transactions),
  tradedPicks: many(tradedPicks),
}));

export const playersRelations = relations(players, ({ many }) => ({
  sourceIds: many(playerSourceIds),
  rosterSpots: many(rosterPlayers),
  weeklyStats: many(weeklyStats),
  seasonStats: many(seasonStats),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;
