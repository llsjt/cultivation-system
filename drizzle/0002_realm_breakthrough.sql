ALTER TABLE `projects` ADD `realm_rank` integer DEFAULT 0 NOT NULL CHECK (`realm_rank` BETWEEN 0 AND 4);
--> statement-breakpoint
ALTER TABLE `projects` ADD `realm_layer` integer DEFAULT 1 NOT NULL CHECK (`realm_layer` BETWEEN 1 AND 9);
--> statement-breakpoint
ALTER TABLE `projects` ADD `last_breakthrough_at` text;
--> statement-breakpoint
ALTER TABLE `resources` ADD `cultivation_role` text DEFAULT 'core' NOT NULL CHECK (`cultivation_role` IN ('core','supplement','trial','reference'));
--> statement-breakpoint
ALTER TABLE `resources` ADD `mastery_group` text CHECK (`mastery_group` IS NULL OR length(`mastery_group`) <= 120);
--> statement-breakpoint
ALTER TABLE `resources` ADD `mastery_weight` integer DEFAULT 1 NOT NULL CHECK (`mastery_weight` BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE `study_logs` ADD `evidence_type` text CHECK (`evidence_type` IS NULL OR `evidence_type` IN ('read','note','practice','assessment'));
--> statement-breakpoint
CREATE TABLE `breakthrough_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `from_realm_rank` integer NOT NULL CHECK (`from_realm_rank` BETWEEN 0 AND 4),
  `from_realm_layer` integer NOT NULL CHECK (`from_realm_layer` BETWEEN 1 AND 9),
  `target_realm_rank` integer NOT NULL CHECK (`target_realm_rank` BETWEEN 0 AND 4),
  `dao_foundation_score` integer NOT NULL CHECK (`dao_foundation_score` BETWEEN 0 AND 100),
  `passed` integer NOT NULL CHECK (`passed` IN (0, 1)),
  `bottleneck_summary` text CHECK (`bottleneck_summary` IS NULL OR length(`bottleneck_summary`) <= 1000),
  `created_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_breakthrough_attempts_project_created_at` ON `breakthrough_attempts` (`project_id`, `created_at` DESC);
