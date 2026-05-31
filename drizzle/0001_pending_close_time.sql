ALTER TABLE `pending_study_sessions` ADD `closed_at` text;
--> statement-breakpoint
ALTER TABLE `pending_study_sessions` ADD `duration_minutes` integer CHECK (`duration_minutes` IS NULL OR (`duration_minutes` BETWEEN 0 AND 1440));
--> statement-breakpoint
ALTER TABLE `pending_study_sessions` ADD `close_source` text CHECK (`close_source` IS NULL OR `close_source` IN ('viewer_closed','user_ended','app_recovered'));
