CREATE TABLE `delivery_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `delivery_attempts_email_created_idx` ON `delivery_attempts` (`email_hash`,`created_at`);