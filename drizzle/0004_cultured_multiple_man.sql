CREATE TABLE `gmail_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_hash` text NOT NULL,
	`email` text NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`scopes` text DEFAULT '' NOT NULL,
	`connected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_synced_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gmail_connections_session_hash_unique` ON `gmail_connections` (`session_hash`);--> statement-breakpoint
CREATE INDEX `gmail_connections_session_idx` ON `gmail_connections` (`session_hash`);--> statement-breakpoint
ALTER TABLE `automations` ADD `owner_hash` text DEFAULT 'template' NOT NULL;--> statement-breakpoint
CREATE INDEX `automations_owner_idx` ON `automations` (`owner_hash`);--> statement-breakpoint
ALTER TABLE `executions` ADD `owner_hash` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
CREATE INDEX `executions_owner_created_idx` ON `executions` (`owner_hash`,`created_at`);