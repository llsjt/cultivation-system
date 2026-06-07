import type { CultivationLogProjectionRow, InsertStudyLogRow, PreparedStatement, RepositoryDatabase, StudyLogRow } from './types';

export class StudyLogRepository {
  private readonly listRecentRowsStatement: PreparedStatement;
  private readonly listCultivationLogRowsStatement: PreparedStatement;
  private readonly findByIdStatement: PreparedStatement;
  private readonly insertStatement: PreparedStatement;

  constructor(db: RepositoryDatabase) {
    this.listRecentRowsStatement = db.prepare(
      `SELECT * FROM study_logs
        WHERE (? IS NULL OR project_id = ?) AND (? IS NULL OR resource_id = ?)
        ORDER BY studied_at DESC, created_at DESC, id ASC
        LIMIT ?`,
    );
    this.listCultivationLogRowsStatement = db.prepare(
      `SELECT studied_at, duration_minutes, content, progress_before_percent, progress_after_percent, evidence_type
         FROM study_logs
        WHERE project_id = ?
        ORDER BY studied_at DESC, created_at DESC`,
    );
    this.findByIdStatement = db.prepare('SELECT * FROM study_logs WHERE id = ?');
    this.insertStatement = db.prepare(
      `INSERT INTO study_logs (
        id, project_id, resource_id, resource_title_snapshot, studied_at, duration_minutes, content,
        progress_before_text, progress_before_percent, progress_after_text, progress_after_percent,
        status_before, status_after, next_action_before, next_action, evidence_type,
        resource_updated_at_before, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  listRecentRows(input: { limit: number; project_id?: string; resource_id?: string }): StudyLogRow[] {
    return this.listRecentRowsStatement.all(input.project_id ?? null, input.project_id ?? null, input.resource_id ?? null, input.resource_id ?? null, input.limit) as StudyLogRow[];
  }

  listCultivationLogRows(projectId: string): CultivationLogProjectionRow[] {
    return this.listCultivationLogRowsStatement.all(projectId) as CultivationLogProjectionRow[];
  }

  findRowById(logId: string): StudyLogRow | null {
    return (this.findByIdStatement.get(logId) as StudyLogRow | undefined) ?? null;
  }

  insert(input: InsertStudyLogRow): void {
    this.insertStatement.run(
      input.id,
      input.project_id,
      input.resource_id,
      input.resource_title_snapshot,
      input.studied_at,
      input.duration_minutes,
      input.content,
      input.progress_before_text,
      input.progress_before_percent,
      input.progress_after_text,
      input.progress_after_percent,
      input.status_before,
      input.status_after,
      input.next_action_before,
      input.next_action,
      input.evidence_type,
      input.resource_updated_at_before,
      input.created_at,
    );
  }
}
