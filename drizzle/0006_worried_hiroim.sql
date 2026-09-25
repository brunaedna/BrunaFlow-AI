CREATE TABLE `webhook_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_hash` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_keys_session_hash_unique` ON `webhook_keys` (`session_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_keys_key_hash_unique` ON `webhook_keys` (`key_hash`);
