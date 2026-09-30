CREATE TABLE `webhook_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_hash` text NOT NULL,
	`key_hash` text NOT NULL,
	`request_id` text NOT NULL,
	`event_type` text DEFAULT 'unknown' NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`execution_id` integer,
	`response_json` text DEFAULT '' NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `executions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_owner_key_unique` ON `webhook_events` (`owner_hash`,`key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_events_request_unique` ON `webhook_events` (`request_id`);--> statement-breakpoint
CREATE INDEX `webhook_events_owner_created_idx` ON `webhook_events` (`owner_hash`,`created_at`);--> statement-breakpoint
ALTER TABLE `executions` ADD `model` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `executions` ADD `event_type` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `executions` ADD `request_id` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `executions` ADD `current_step` text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE `executions` ADD `error_message` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `executions` ADD `completed_at` text;--> statement-breakpoint
CREATE INDEX `executions_request_idx` ON `executions` (`request_id`);