ALTER TABLE `executions` ADD `provider` text DEFAULT 'simulation' NOT NULL;--> statement-breakpoint
ALTER TABLE `executions` ADD `email_draft` text DEFAULT '' NOT NULL;