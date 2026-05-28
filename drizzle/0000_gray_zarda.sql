CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `provider_account_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `draft_picks` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`league_id` text,
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`pick_no` integer NOT NULL,
	`roster_id` integer,
	`picked_by_roster_id` integer,
	`sleeper_player_id` text,
	`metadata` text,
	`source_updated_at` integer,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_picks_draft_pick_unique` ON `draft_picks` (`draft_id`,`pick_no`);--> statement-breakpoint
CREATE INDEX `draft_picks_player_idx` ON `draft_picks` (`sleeper_player_id`);--> statement-breakpoint
CREATE INDEX `draft_picks_league_season_roster_idx` ON `draft_picks` (`league_id`,`season`,`roster_id`);--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text,
	`sleeper_draft_id` text NOT NULL,
	`season` integer NOT NULL,
	`type` text,
	`status` text,
	`settings` text,
	`metadata` text,
	`source_updated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drafts_sleeper_draft_id_unique` ON `drafts` (`sleeper_draft_id`);--> statement-breakpoint
CREATE INDEX `drafts_league_season_idx` ON `drafts` (`league_id`,`season`);--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`scope` text,
	`league_id` text,
	`season` integer,
	`week` integer,
	`started_at` integer,
	`ended_at` integer,
	`counts` text,
	`error` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_jobs_status_idx` ON `import_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `import_jobs_source_scope_idx` ON `import_jobs` (`source`,`scope`,`season`,`week`);--> statement-breakpoint
CREATE INDEX `import_jobs_league_idx` ON `import_jobs` (`league_id`);--> statement-breakpoint
CREATE TABLE `import_locks` (
	`lock_key` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`owner_id` text NOT NULL,
	`acquired_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `import_locks_expires_at_idx` ON `import_locks` (`expires_at`);--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`label` text,
	`role` text DEFAULT 'member' NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_codes_code_hash_unique` ON `invite_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `invite_codes_active_idx` ON `invite_codes` (`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `invite_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_code_id` text NOT NULL,
	`user_id` text NOT NULL,
	`redeemed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`invite_code_id`) REFERENCES `invite_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_redemptions_invite_user_unique` ON `invite_redemptions` (`invite_code_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `invite_redemptions_user_id_idx` ON `invite_redemptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `league_users` (
	`league_id` text NOT NULL,
	`sleeper_user_id` text NOT NULL,
	`display_name` text,
	`username` text,
	`avatar` text,
	`metadata` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`league_id`, `sleeper_user_id`),
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `league_users_league_display_name_idx` ON `league_users` (`league_id`,`display_name`);--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`sleeper_league_id` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`season` integer NOT NULL,
	`status` text,
	`sport` text DEFAULT 'nfl' NOT NULL,
	`scoring_settings` text,
	`roster_positions` text,
	`settings` text,
	`metadata` text,
	`imported_at` integer,
	`source_updated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_sleeper_league_id_unique` ON `leagues` (`sleeper_league_id`);--> statement-breakpoint
CREATE INDEX `leagues_season_idx` ON `leagues` (`season`);--> statement-breakpoint
CREATE INDEX `leagues_name_idx` ON `leagues` (`name`);--> statement-breakpoint
CREATE TABLE `local_credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_algorithm` text DEFAULT 'argon2id' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matchups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` text NOT NULL,
	`season` integer NOT NULL,
	`week` integer NOT NULL,
	`roster_id` integer NOT NULL,
	`matchup_id` integer,
	`points` real,
	`starters` text,
	`players` text,
	`player_points` text,
	`source_updated_at` integer,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matchups_league_season_week_roster_unique` ON `matchups` (`league_id`,`season`,`week`,`roster_id`);--> statement-breakpoint
CREATE INDEX `matchups_league_week_idx` ON `matchups` (`league_id`,`season`,`week`);--> statement-breakpoint
CREATE TABLE `player_source_ids` (
	`sleeper_player_id` text NOT NULL,
	`source` text NOT NULL,
	`source_player_id` text NOT NULL,
	`metadata` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`source`, `source_player_id`),
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_source_ids_sleeper_idx` ON `player_source_ids` (`sleeper_player_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`sleeper_player_id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`search_name` text NOT NULL,
	`position` text,
	`team` text,
	`status` text,
	`age` real,
	`birth_date` text,
	`years_exp` integer,
	`fantasy_positions` text,
	`metadata` text,
	`source_updated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `players_search_name_idx` ON `players` (`search_name`);--> statement-breakpoint
CREATE INDEX `players_position_team_idx` ON `players` (`position`,`team`);--> statement-breakpoint
CREATE INDEX `players_team_idx` ON `players` (`team`);--> statement-breakpoint
CREATE INDEX `players_status_idx` ON `players` (`status`);--> statement-breakpoint
CREATE TABLE `roster_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` text NOT NULL,
	`roster_id` integer NOT NULL,
	`sleeper_player_id` text NOT NULL,
	`slot` text DEFAULT 'roster' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roster_players_league_roster_player_slot_unique` ON `roster_players` (`league_id`,`roster_id`,`sleeper_player_id`,`slot`);--> statement-breakpoint
CREATE INDEX `roster_players_roster_idx` ON `roster_players` (`league_id`,`roster_id`);--> statement-breakpoint
CREATE INDEX `roster_players_player_idx` ON `roster_players` (`sleeper_player_id`);--> statement-breakpoint
CREATE TABLE `rosters` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`roster_id` integer NOT NULL,
	`owner_sleeper_user_id` text,
	`co_owners` text,
	`settings` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rosters_league_roster_unique` ON `rosters` (`league_id`,`roster_id`);--> statement-breakpoint
CREATE INDEX `rosters_league_id_idx` ON `rosters` (`league_id`);--> statement-breakpoint
CREATE INDEX `rosters_owner_idx` ON `rosters` (`league_id`,`owner_sleeper_user_id`);--> statement-breakpoint
CREATE TABLE `season_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`sleeper_player_id` text,
	`gsis_id` text,
	`season` integer NOT NULL,
	`season_type` text DEFAULT 'REG' NOT NULL,
	`team` text,
	`position` text,
	`games` integer,
	`stats` text NOT NULL,
	`fantasy_points_ppr` real,
	`fantasy_points_half_ppr` real,
	`fantasy_points_standard` real,
	`source_updated_at` integer,
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_stats_player_season_unique` ON `season_stats` (`season`,`season_type`,`sleeper_player_id`);--> statement-breakpoint
CREATE INDEX `season_stats_player_idx` ON `season_stats` (`sleeper_player_id`,`season`);--> statement-breakpoint
CREATE INDEX `season_stats_gsis_idx` ON `season_stats` (`gsis_id`);--> statement-breakpoint
CREATE INDEX `season_stats_query_idx` ON `season_stats` (`season`,`position`,`team`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_key` text NOT NULL,
	`league_id` text,
	`season` integer,
	`week` integer,
	`payload` text NOT NULL,
	`captured_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_snapshots_source_key_unique` ON `source_snapshots` (`source`,`source_key`);--> statement-breakpoint
CREATE INDEX `source_snapshots_lookup_idx` ON `source_snapshots` (`source`,`league_id`,`season`,`week`);--> statement-breakpoint
CREATE TABLE `trade_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`side` text NOT NULL,
	`asset_type` text NOT NULL,
	`sleeper_player_id` text,
	`pick_season` integer,
	`pick_round` integer,
	`roster_id` integer,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `trade_scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `trade_assets_scenario_idx` ON `trade_assets` (`scenario_id`,`side`);--> statement-breakpoint
CREATE INDEX `trade_assets_player_idx` ON `trade_assets` (`sleeper_player_id`);--> statement-breakpoint
CREATE TABLE `trade_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`league_id` text,
	`title` text NOT NULL,
	`summary` text,
	`evaluation` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `trade_scenarios_user_idx` ON `trade_scenarios` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `trade_scenarios_league_idx` ON `trade_scenarios` (`league_id`);--> statement-breakpoint
CREATE TABLE `traded_picks` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`season` integer NOT NULL,
	`round` integer NOT NULL,
	`roster_id` integer NOT NULL,
	`owner_roster_id` integer NOT NULL,
	`previous_owner_roster_id` integer,
	`source_updated_at` integer,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `traded_picks_identity_unique` ON `traded_picks` (`league_id`,`season`,`round`,`roster_id`);--> statement-breakpoint
CREATE INDEX `traded_picks_owner_idx` ON `traded_picks` (`league_id`,`owner_roster_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`sleeper_transaction_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text,
	`roster_ids` text,
	`adds` text,
	`drops` text,
	`draft_picks` text,
	`waiver_budget` text,
	`created_at_ms` integer,
	`metadata` text,
	`source_updated_at` integer,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_sleeper_unique` ON `transactions` (`league_id`,`sleeper_transaction_id`);--> statement-breakpoint
CREATE INDEX `transactions_league_created_idx` ON `transactions` (`league_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`type`);--> statement-breakpoint
CREATE TABLE `user_league_teams` (
	`user_id` text NOT NULL,
	`league_id` text NOT NULL,
	`roster_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `league_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_league_teams_roster_idx` ON `user_league_teams` (`league_id`,`roster_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE TABLE `warning_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`code` text NOT NULL,
	`message` text NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`league_id` text,
	`sleeper_player_id` text,
	`metadata` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `warning_queue_open_idx` ON `warning_queue` (`resolved_at`,`severity`);--> statement-breakpoint
CREATE INDEX `warning_queue_source_code_idx` ON `warning_queue` (`source`,`code`);--> statement-breakpoint
CREATE TABLE `weekly_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`sleeper_player_id` text,
	`gsis_id` text,
	`season` integer NOT NULL,
	`week` integer NOT NULL,
	`season_type` text DEFAULT 'REG' NOT NULL,
	`team` text,
	`opponent` text,
	`position` text,
	`stats` text NOT NULL,
	`fantasy_points_ppr` real,
	`fantasy_points_half_ppr` real,
	`fantasy_points_standard` real,
	`source_updated_at` integer,
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_stats_player_week_unique` ON `weekly_stats` (`season`,`week`,`season_type`,`sleeper_player_id`);--> statement-breakpoint
CREATE INDEX `weekly_stats_player_idx` ON `weekly_stats` (`sleeper_player_id`,`season`,`week`);--> statement-breakpoint
CREATE INDEX `weekly_stats_gsis_idx` ON `weekly_stats` (`gsis_id`);--> statement-breakpoint
CREATE INDEX `weekly_stats_season_week_idx` ON `weekly_stats` (`season`,`week`);