CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`branch_id` integer NOT NULL,
	`clock_in` integer DEFAULT (unixepoch()) NOT NULL,
	`clock_out` integer,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `ingredients` ADD `cost_per_unit` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `note` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount_amount` real DEFAULT 0 NOT NULL;