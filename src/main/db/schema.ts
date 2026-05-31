import { desc, sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

const statusSql = "'not_started','learning','paused','review','completed'";
const typeSql = "'document','video','web','course','repo','exercise','book','other'";
const openKindSql = "'file','folder','url','record_only'";
const cultivationRoleSql = "'core','supplement','trial','reference'";
const evidenceTypeSql = "'read','note','practice','assessment'";

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    realmRank: integer('realm_rank').notNull().default(0),
    realmLayer: integer('realm_layer').notNull().default(1),
    lastBreakthroughAt: text('last_breakthrough_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastStudiedAt: text('last_studied_at'),
  },
  (table) => ({
    nameCheck: check('projects_name_check', sql`length(trim(${table.name})) > 0 AND length(trim(${table.name})) <= 120`),
    descriptionCheck: check('projects_description_check', sql`${table.description} IS NULL OR length(${table.description}) <= 1000`),
    statusCheck: check('projects_status_check', sql.raw(`status IN (${statusSql})`)),
    realmRankCheck: check('projects_realm_rank_check', sql`${table.realmRank} BETWEEN 0 AND 4`),
    realmLayerCheck: check('projects_realm_layer_check', sql`${table.realmLayer} BETWEEN 1 AND 9`),
  }),
);

export const resources = sqliteTable(
  'resources',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type').notNull(),
    openKind: text('open_kind').notNull(),
    pathOrUrl: text('path_or_url'),
    cultivationRole: text('cultivation_role').notNull().default('core'),
    masteryGroup: text('mastery_group'),
    masteryWeight: integer('mastery_weight').notNull().default(1),
    status: text('status').notNull(),
    progressText: text('progress_text'),
    progressPercent: integer('progress_percent').notNull(),
    nextAction: text('next_action'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    lastOpenedAt: text('last_opened_at'),
    lastStudiedAt: text('last_studied_at'),
  },
  (table) => ({
    projectIdIdx: index('idx_resources_project_id').on(table.projectId),
    statusLastStudiedAtIdx: index('idx_resources_status_last_studied_at').on(
      table.status,
      desc(table.lastStudiedAt),
      desc(table.updatedAt),
      desc(table.createdAt),
      table.id,
    ),
    updatedAtIdx: index('idx_resources_updated_at').on(table.updatedAt),
    titleCheck: check('resources_title_check', sql`length(trim(${table.title})) > 0 AND length(trim(${table.title})) <= 200`),
    typeCheck: check('resources_type_check', sql.raw(`type IN (${typeSql})`)),
    openKindCheck: check('resources_open_kind_check', sql.raw(`open_kind IN (${openKindSql})`)),
    cultivationRoleCheck: check('resources_cultivation_role_check', sql.raw(`cultivation_role IN (${cultivationRoleSql})`)),
    masteryGroupCheck: check('resources_mastery_group_check', sql`${table.masteryGroup} IS NULL OR length(${table.masteryGroup}) <= 120`),
    masteryWeightCheck: check('resources_mastery_weight_check', sql`${table.masteryWeight} BETWEEN 1 AND 5`),
    pathOrUrlLengthCheck: check('resources_path_or_url_length_check', sql`${table.pathOrUrl} IS NULL OR length(${table.pathOrUrl}) <= 2048`),
    statusCheck: check('resources_status_check', sql.raw(`status IN (${statusSql})`)),
    progressTextCheck: check('resources_progress_text_check', sql`${table.progressText} IS NULL OR length(${table.progressText}) <= 500`),
    progressPercentCheck: check('resources_progress_percent_check', sql`${table.progressPercent} BETWEEN 0 AND 100`),
    nextActionCheck: check('resources_next_action_check', sql`${table.nextAction} IS NULL OR length(${table.nextAction}) <= 500`),
    recordOnlyPathCheck: check(
      'resources_record_only_path_check',
      sql`(${table.openKind} = 'record_only' AND (${table.pathOrUrl} IS NULL OR length(trim(${table.pathOrUrl})) = 0))
        OR (${table.openKind} <> 'record_only' AND ${table.pathOrUrl} IS NOT NULL AND length(trim(${table.pathOrUrl})) > 0)`,
    ),
  }),
);

export const studyLogs = sqliteTable(
  'study_logs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    resourceId: text('resource_id').references(() => resources.id, { onDelete: 'set null' }),
    resourceTitleSnapshot: text('resource_title_snapshot').notNull(),
    studiedAt: text('studied_at').notNull(),
    durationMinutes: integer('duration_minutes'),
    content: text('content'),
    progressBeforeText: text('progress_before_text'),
    progressBeforePercent: integer('progress_before_percent').notNull(),
    progressAfterText: text('progress_after_text'),
    progressAfterPercent: integer('progress_after_percent').notNull(),
    statusBefore: text('status_before').notNull(),
    statusAfter: text('status_after').notNull(),
    nextActionBefore: text('next_action_before'),
    nextAction: text('next_action'),
    evidenceType: text('evidence_type'),
    resourceUpdatedAtBefore: text('resource_updated_at_before'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    projectStudiedAtIdx: index('idx_study_logs_project_studied_at').on(table.projectId, desc(table.studiedAt), desc(table.createdAt)),
    resourceIdIdx: index('idx_study_logs_resource_id').on(table.resourceId, desc(table.studiedAt), desc(table.createdAt)),
    titleSnapshotCheck: check('study_logs_title_snapshot_check', sql`length(${table.resourceTitleSnapshot}) <= 200`),
    durationCheck: check('study_logs_duration_check', sql`${table.durationMinutes} IS NULL OR (${table.durationMinutes} BETWEEN 0 AND 1440)`),
    contentCheck: check('study_logs_content_check', sql`${table.content} IS NULL OR length(${table.content}) <= 2000`),
    progressBeforeTextCheck: check('study_logs_progress_before_text_check', sql`${table.progressBeforeText} IS NULL OR length(${table.progressBeforeText}) <= 500`),
    progressBeforePercentCheck: check('study_logs_progress_before_percent_check', sql`${table.progressBeforePercent} BETWEEN 0 AND 100`),
    progressAfterTextCheck: check('study_logs_progress_after_text_check', sql`${table.progressAfterText} IS NULL OR length(${table.progressAfterText}) <= 500`),
    progressAfterPercentCheck: check('study_logs_progress_after_percent_check', sql`${table.progressAfterPercent} BETWEEN 0 AND 100`),
    statusBeforeCheck: check('study_logs_status_before_check', sql.raw(`status_before IN (${statusSql})`)),
    statusAfterCheck: check('study_logs_status_after_check', sql.raw(`status_after IN (${statusSql})`)),
    nextActionBeforeCheck: check('study_logs_next_action_before_check', sql`${table.nextActionBefore} IS NULL OR length(${table.nextActionBefore}) <= 500`),
    nextActionCheck: check('study_logs_next_action_check', sql`${table.nextAction} IS NULL OR length(${table.nextAction}) <= 500`),
    evidenceTypeCheck: check('study_logs_evidence_type_check', sql.raw(`evidence_type IS NULL OR evidence_type IN (${evidenceTypeSql})`)),
  }),
);

export const breakthroughAttempts = sqliteTable(
  'breakthrough_attempts',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fromRealmRank: integer('from_realm_rank').notNull(),
    fromRealmLayer: integer('from_realm_layer').notNull(),
    targetRealmRank: integer('target_realm_rank').notNull(),
    daoFoundationScore: integer('dao_foundation_score').notNull(),
    passed: integer('passed').notNull(),
    bottleneckSummary: text('bottleneck_summary'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    projectCreatedAtIdx: index('idx_breakthrough_attempts_project_created_at').on(table.projectId, desc(table.createdAt)),
    fromRealmRankCheck: check('breakthrough_attempts_from_realm_rank_check', sql`${table.fromRealmRank} BETWEEN 0 AND 4`),
    fromRealmLayerCheck: check('breakthrough_attempts_from_realm_layer_check', sql`${table.fromRealmLayer} BETWEEN 1 AND 9`),
    targetRealmRankCheck: check('breakthrough_attempts_target_realm_rank_check', sql`${table.targetRealmRank} BETWEEN 0 AND 4`),
    daoFoundationScoreCheck: check('breakthrough_attempts_dao_foundation_score_check', sql`${table.daoFoundationScore} BETWEEN 0 AND 100`),
    passedCheck: check('breakthrough_attempts_passed_check', sql`${table.passed} IN (0, 1)`),
    bottleneckSummaryCheck: check('breakthrough_attempts_bottleneck_summary_check', sql`${table.bottleneckSummary} IS NULL OR length(${table.bottleneckSummary}) <= 1000`),
  }),
);

export const pendingStudySessions = sqliteTable(
  'pending_study_sessions',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    resourceTitleSnapshot: text('resource_title_snapshot').notNull(),
    openedAt: text('opened_at').notNull(),
    closedAt: text('closed_at'),
    durationMinutes: integer('duration_minutes'),
    closeSource: text('close_source'),
    progressBeforeText: text('progress_before_text'),
    progressBeforePercent: integer('progress_before_percent').notNull(),
    statusBefore: text('status_before').notNull(),
    nextActionBefore: text('next_action_before'),
    resourceUpdatedAtBefore: text('resource_updated_at_before').notNull(),
    singletonKey: integer('singleton_key').notNull().default(1),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    projectIdIdx: index('idx_pending_study_sessions_project_id').on(table.projectId),
    resourceIdIdx: index('idx_pending_study_sessions_resource_id').on(table.resourceId),
    singletonUnique: unique('pending_study_sessions_singleton_key_unique').on(table.singletonKey),
    titleSnapshotCheck: check('pending_sessions_title_snapshot_check', sql`length(${table.resourceTitleSnapshot}) <= 200`),
    progressBeforeTextCheck: check('pending_sessions_progress_before_text_check', sql`${table.progressBeforeText} IS NULL OR length(${table.progressBeforeText}) <= 500`),
    progressBeforePercentCheck: check('pending_sessions_progress_before_percent_check', sql`${table.progressBeforePercent} BETWEEN 0 AND 100`),
    durationCheck: check('pending_sessions_duration_check', sql`${table.durationMinutes} IS NULL OR (${table.durationMinutes} BETWEEN 0 AND 1440)`),
    closeSourceCheck: check('pending_sessions_close_source_check', sql`${table.closeSource} IS NULL OR ${table.closeSource} IN ('viewer_closed','user_ended','app_recovered')`),
    statusBeforeCheck: check('pending_sessions_status_before_check', sql.raw(`status_before IN (${statusSql})`)),
    nextActionBeforeCheck: check('pending_sessions_next_action_before_check', sql`${table.nextActionBefore} IS NULL OR length(${table.nextActionBefore}) <= 500`),
    singletonKeyCheck: check('pending_sessions_singleton_key_check', sql`${table.singletonKey} = 1`),
  }),
);
