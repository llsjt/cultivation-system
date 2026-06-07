import type { ProjectStatus } from '../../shared/enums';
import type { PageInput, PageRows, PreparedStatement, ProjectRow, ProjectSummaryProjectionRow, RepositoryDatabase } from './types';

export class ProjectRepository {
  private readonly listWithProgressStatement: PreparedStatement;
  private readonly countStatement: PreparedStatement;
  private readonly findSummaryByIdStatement: PreparedStatement;
  private readonly findByIdStatement: PreparedStatement;
  private readonly progressRowsStatement: PreparedStatement;
  private readonly getNameStatement: PreparedStatement;
  private readonly getLastSavedAtStatement: PreparedStatement;
  private readonly insertStatement: PreparedStatement;
  private readonly updateStatement: PreparedStatement;
  private readonly deleteStatement: PreparedStatement;
  private readonly updateDerivedStateStatement: PreparedStatement;
  private readonly updateRealmAfterBreakthroughStatement: PreparedStatement;

  constructor(db: RepositoryDatabase) {
    this.listWithProgressStatement = db.prepare(
      `SELECT p.*,
              COUNT(r.id) AS resource_count,
              COALESCE(ROUND(AVG(r.progress_percent)), 0) AS progress_percent
         FROM projects p
         LEFT JOIN resources r ON r.project_id = p.id
        GROUP BY p.id
        ORDER BY COALESCE(p.last_studied_at, p.updated_at) DESC, p.created_at DESC, p.id ASC
        LIMIT ? OFFSET ?`,
    );
    this.countStatement = db.prepare('SELECT COUNT(*) AS count FROM projects');
    this.findSummaryByIdStatement = db.prepare(
      `SELECT p.*,
              COUNT(r.id) AS resource_count,
              COALESCE(ROUND(AVG(r.progress_percent)), 0) AS progress_percent
         FROM projects p
         LEFT JOIN resources r ON r.project_id = p.id
        WHERE p.id = ?
        GROUP BY p.id`,
    );
    this.findByIdStatement = db.prepare('SELECT * FROM projects WHERE id = ?');
    this.progressRowsStatement = db.prepare('SELECT progress_percent FROM resources WHERE project_id = ?');
    this.getNameStatement = db.prepare('SELECT name FROM projects WHERE id = ?');
    this.getLastSavedAtStatement = db.prepare(
      `SELECT MAX(saved_at) AS saved_at
         FROM (
           SELECT updated_at AS saved_at FROM projects
           UNION ALL SELECT updated_at AS saved_at FROM resources
           UNION ALL SELECT created_at AS saved_at FROM study_logs
           UNION ALL SELECT created_at AS saved_at FROM pending_study_sessions
         )`,
    );
    this.insertStatement = db.prepare('INSERT INTO projects (id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    this.updateStatement = db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?');
    this.deleteStatement = db.prepare('DELETE FROM projects WHERE id = ?');
    this.updateDerivedStateStatement = db.prepare('UPDATE projects SET status = ?, last_studied_at = ?, updated_at = ? WHERE id = ?');
    this.updateRealmAfterBreakthroughStatement = db.prepare('UPDATE projects SET realm_rank = ?, realm_layer = ?, last_breakthrough_at = ?, updated_at = ? WHERE id = ?');
  }

  listWithProgressRows(input: PageInput): PageRows<ProjectSummaryProjectionRow> {
    const rows = this.listWithProgressStatement.all(input.limit, input.offset) as ProjectSummaryProjectionRow[];
    const total = this.countStatement.get() as { count: number };
    return { rows, total: total.count, limit: input.limit, offset: input.offset };
  }

  findSummaryRowById(projectId: string): ProjectSummaryProjectionRow | null {
    return (this.findSummaryByIdStatement.get(projectId) as ProjectSummaryProjectionRow | undefined) ?? null;
  }

  findRowById(projectId: string): ProjectRow | null {
    return (this.findByIdStatement.get(projectId) as ProjectRow | undefined) ?? null;
  }

  getProgressPercent(projectId: string): number {
    const rows = this.progressRowsStatement.all(projectId) as { progress_percent: number }[];
    if (rows.length === 0) {
      return 0;
    }

    const total = rows.reduce((sum, row) => sum + row.progress_percent, 0);
    return Math.round(total / rows.length);
  }

  getName(projectId: string): string | null {
    const row = this.getNameStatement.get(projectId) as { name: string } | undefined;
    return row?.name ?? null;
  }

  getLastSavedAt(): string | null {
    const row = this.getLastSavedAtStatement.get() as { saved_at: string | null };
    return row.saved_at;
  }

  insert(input: { id: string; name: string; description: string | null; now: string }): void {
    this.insertStatement.run(input.id, input.name, input.description, 'not_started', input.now, input.now);
  }

  update(input: { project_id: string; name: string; description: string | null; now: string }): number {
    return this.updateStatement.run(input.name, input.description, input.now, input.project_id).changes;
  }

  delete(projectId: string): number {
    return this.deleteStatement.run(projectId).changes;
  }

  updateDerivedState(input: { project_id: string; status: ProjectStatus; last_studied_at: string | null; now: string }): void {
    this.updateDerivedStateStatement.run(input.status, input.last_studied_at, input.now, input.project_id);
  }

  updateRealmAfterBreakthrough(input: { project_id: string; realm_rank: number; realm_layer: number; last_breakthrough_at: string; now: string }): number {
    return this.updateRealmAfterBreakthroughStatement.run(input.realm_rank, input.realm_layer, input.last_breakthrough_at, input.now, input.project_id).changes;
  }
}
