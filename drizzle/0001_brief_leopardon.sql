ALTER TABLE `import_jobs` ADD `user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `import_jobs_user_idx` ON `import_jobs` (`user_id`,`created_at`);