CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL CHECK (length(trim(`name`)) > 0 AND length(trim(`name`)) <= 120),
  `description` text CHECK (`description` IS NULL OR length(`description`) <= 1000),
  `status` text NOT NULL CHECK (`status` IN ('not_started','learning','paused','review','completed')),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_studied_at` text
);
--> statement-breakpoint
CREATE TABLE `resources` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `title` text NOT NULL CHECK (length(trim(`title`)) > 0 AND length(trim(`title`)) <= 200),
  `type` text NOT NULL CHECK (`type` IN ('document','video','web','course','repo','exercise','book','other')),
  `open_kind` text NOT NULL CHECK (`open_kind` IN ('file','folder','url','record_only')),
  `path_or_url` text CHECK (`path_or_url` IS NULL OR length(`path_or_url`) <= 2048),
  `status` text NOT NULL CHECK (`status` IN ('not_started','learning','paused','review','completed')),
  `progress_text` text CHECK (`progress_text` IS NULL OR length(`progress_text`) <= 500),
  `progress_percent` integer NOT NULL CHECK (`progress_percent` BETWEEN 0 AND 100),
  `next_action` text CHECK (`next_action` IS NULL OR length(`next_action`) <= 500),
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `last_opened_at` text,
  `last_studied_at` text,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  CHECK (
    (`open_kind` = 'record_only' AND (`path_or_url` IS NULL OR length(trim(`path_or_url`)) = 0))
    OR (`open_kind` <> 'record_only' AND `path_or_url` IS NOT NULL AND length(trim(`path_or_url`)) > 0)
  )
);
--> statement-breakpoint
CREATE TABLE `study_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `resource_id` text,
  `resource_title_snapshot` text NOT NULL CHECK (length(`resource_title_snapshot`) <= 200),
  `studied_at` text NOT NULL,
  `duration_minutes` integer CHECK (`duration_minutes` IS NULL OR (`duration_minutes` BETWEEN 0 AND 1440)),
  `content` text CHECK (`content` IS NULL OR length(`content`) <= 2000),
  `progress_before_text` text CHECK (`progress_before_text` IS NULL OR length(`progress_before_text`) <= 500),
  `progress_before_percent` integer NOT NULL CHECK (`progress_before_percent` BETWEEN 0 AND 100),
  `progress_after_text` text CHECK (`progress_after_text` IS NULL OR length(`progress_after_text`) <= 500),
  `progress_after_percent` integer NOT NULL CHECK (`progress_after_percent` BETWEEN 0 AND 100),
  `status_before` text NOT NULL CHECK (`status_before` IN ('not_started','learning','paused','review','completed')),
  `status_after` text NOT NULL CHECK (`status_after` IN ('not_started','learning','paused','review','completed')),
  `next_action_before` text CHECK (`next_action_before` IS NULL OR length(`next_action_before`) <= 500),
  `next_action` text CHECK (`next_action` IS NULL OR length(`next_action`) <= 500),
  `resource_updated_at_before` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `pending_study_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `resource_id` text NOT NULL,
  `resource_title_snapshot` text NOT NULL CHECK (length(`resource_title_snapshot`) <= 200),
  `opened_at` text NOT NULL,
  `progress_before_text` text CHECK (`progress_before_text` IS NULL OR length(`progress_before_text`) <= 500),
  `progress_before_percent` integer NOT NULL CHECK (`progress_before_percent` BETWEEN 0 AND 100),
  `status_before` text NOT NULL CHECK (`status_before` IN ('not_started','learning','paused','review','completed')),
  `next_action_before` text CHECK (`next_action_before` IS NULL OR length(`next_action_before`) <= 500),
  `resource_updated_at_before` text NOT NULL,
  `singleton_key` integer DEFAULT 1 NOT NULL CHECK (`singleton_key` = 1),
  `created_at` text NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE cascade,
  UNIQUE (`singleton_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_resources_project_id` ON `resources` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_resources_status_last_studied_at` ON `resources` (`status`, `last_studied_at` DESC, `updated_at` DESC, `created_at` DESC, `id` ASC);
--> statement-breakpoint
CREATE INDEX `idx_resources_updated_at` ON `resources` (`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_study_logs_project_studied_at` ON `study_logs` (`project_id`, `studied_at` DESC, `created_at` DESC);
--> statement-breakpoint
CREATE INDEX `idx_study_logs_resource_id` ON `study_logs` (`resource_id`, `studied_at` DESC, `created_at` DESC);
--> statement-breakpoint
CREATE INDEX `idx_pending_study_sessions_project_id` ON `pending_study_sessions` (`project_id`);
--> statement-breakpoint
CREATE INDEX `idx_pending_study_sessions_resource_id` ON `pending_study_sessions` (`resource_id`);
