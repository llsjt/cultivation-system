import type { InsertPendingSessionRow, PendingCloseSource, PendingSessionProjectionRow, PreparedStatement, RepositoryDatabase } from './types';

export class PendingSessionRepository {
  private readonly getLatestStatement: PreparedStatement;
  private readonly insertStatement: PreparedStatement;
  private readonly closeStatement: PreparedStatement;
  private readonly deleteByIdStatement: PreparedStatement;
  private readonly deleteByResourceIdStatement: PreparedStatement;

  constructor(db: RepositoryDatabase) {
    this.getLatestStatement = db.prepare(
      `SELECT ps.*, r.title AS current_resource_title
         FROM pending_study_sessions ps
         LEFT JOIN resources r ON r.id = ps.resource_id
        ORDER BY ps.created_at DESC
        LIMIT 1`,
    );
    this.insertStatement = db.prepare(
      `INSERT INTO pending_study_sessions (
        id, project_id, resource_id, resource_title_snapshot, opened_at,
        progress_before_text, progress_before_percent, status_before,
        next_action_before, resource_updated_at_before, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.closeStatement = db.prepare('UPDATE pending_study_sessions SET closed_at = ?, duration_minutes = ?, close_source = ? WHERE id = ? AND closed_at IS NULL');
    this.deleteByIdStatement = db.prepare('DELETE FROM pending_study_sessions WHERE id = ?');
    this.deleteByResourceIdStatement = db.prepare('DELETE FROM pending_study_sessions WHERE resource_id = ?');
  }

  getLatestRow(): PendingSessionProjectionRow | null {
    return (this.getLatestStatement.get() as PendingSessionProjectionRow | undefined) ?? null;
  }

  insert(input: InsertPendingSessionRow): void {
    this.insertStatement.run(
      input.id,
      input.project_id,
      input.resource_id,
      input.resource_title_snapshot,
      input.opened_at,
      input.progress_before_text,
      input.progress_before_percent,
      input.status_before,
      input.next_action_before,
      input.resource_updated_at_before,
      input.opened_at,
    );
  }

  close(input: { session_id: string; closed_at: string; duration_minutes: number; close_source: PendingCloseSource }): number {
    return this.closeStatement.run(input.closed_at, input.duration_minutes, input.close_source, input.session_id).changes;
  }

  deleteById(sessionId: string): number {
    return this.deleteByIdStatement.run(sessionId).changes;
  }

  deleteByResourceId(resourceId: string): number {
    return this.deleteByResourceIdStatement.run(resourceId).changes;
  }
}
