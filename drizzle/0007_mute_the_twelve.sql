CREATE TABLE `email_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_hash` text NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`ai_generated` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_templates_owner_idx` ON `email_templates` (`owner_hash`);--> statement-breakpoint
CREATE TABLE `sent_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_hash` text NOT NULL,
	`execution_id` integer,
	`automation_id` integer,
	`template_id` integer,
	`recipient_email` text NOT NULL,
	`recipient_name` text DEFAULT '' NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'sent' NOT NULL,
	`sender_email` text DEFAULT '' NOT NULL,
	`sent_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `executions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`template_id`) REFERENCES `email_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sent_emails_owner_sent_idx` ON `sent_emails` (`owner_hash`,`sent_at`);--> statement-breakpoint
ALTER TABLE `automations` ADD `template_id` integer REFERENCES email_templates(id);