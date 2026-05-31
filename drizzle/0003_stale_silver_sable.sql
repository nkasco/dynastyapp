CREATE TABLE `player_watchlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`league_id` text NOT NULL,
	`sleeper_player_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeper_player_id`) REFERENCES `players`(`sleeper_player_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_watchlists_user_league_player_unique` ON `player_watchlists` (`user_id`,`league_id`,`sleeper_player_id`);--> statement-breakpoint
CREATE INDEX `player_watchlists_user_league_idx` ON `player_watchlists` (`user_id`,`league_id`);--> statement-breakpoint
CREATE INDEX `player_watchlists_player_idx` ON `player_watchlists` (`sleeper_player_id`);