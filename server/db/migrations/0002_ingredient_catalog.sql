CREATE TABLE `ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingredients_name_unique` ON `ingredients` (`name`);
--> statement-breakpoint
INSERT INTO `ingredients` (`name`, `unit`) SELECT DISTINCT `name`, `unit` FROM `stock_items`;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_stock_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`min_threshold` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_stock_items` (`id`, `branch_id`, `ingredient_id`, `quantity`, `min_threshold`)
SELECT `s`.`id`, `s`.`branch_id`, `i`.`id`, `s`.`quantity`, `s`.`min_threshold`
FROM `stock_items` `s` JOIN `ingredients` `i` ON `i`.`name` = `s`.`name` AND `i`.`unit` = `s`.`unit`;
--> statement-breakpoint
DROP TABLE `stock_items`;
--> statement-breakpoint
ALTER TABLE `__new_stock_items` RENAME TO `stock_items`;
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_items_branch_ingredient_unique` ON `stock_items` (`branch_id`,`ingredient_id`);
--> statement-breakpoint
DROP TABLE `product_ingredients`;
--> statement-breakpoint
CREATE TABLE `product_ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`ingredient_id` integer NOT NULL,
	`quantity` real NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
