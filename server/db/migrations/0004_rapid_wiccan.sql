ALTER TABLE `employees` ADD `code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `employees_code_unique` ON `employees` (`code`);