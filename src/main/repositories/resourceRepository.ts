import type {
  CultivationResourceProjectionRow,
  GlobalResourceProjectionRow,
  InsertResourceRow,
  PageInput,
  PageRows,
  PreparedStatement,
  RepositoryDatabase,
  ResourceRow,
  UpdateResourceProgressInput,
  UpdateResourceRow,
} from './types';

export class ResourceRepository {
  private readonly listByProjectStatement: PreparedStatement;
  private readonly countByProjectStatement: PreparedStatement;
  private readonly findByIdStatement: PreparedStatement;
  private readonly findRecommendedStatement: PreparedStatement;
  private readonly listCultivationResourceRowsStatement: PreparedStatement;
  private readonly listGlobalResourceRowsStatement: PreparedStatement;
  private readonly listStatusRowsByProjectStatement: PreparedStatement;
  private readonly getLastStudiedAtByProjectStatement: PreparedStatement;
  private readonly insertStatement: PreparedStatement;
  private readonly updateStatement: PreparedStatement;
  private readonly updateProgressAfterLogStatement: PreparedStatement;
  private readonly updateLastOpenedAtStatement: PreparedStatement;
  private readonly deleteStatement: PreparedStatement;

  constructor(db: RepositoryDatabase) {
    this.listByProjectStatement = db.prepare(
      `SELECT * FROM resources
        WHERE project_id = ?
        ORDER BY
          CASE status WHEN 'learning' THEN 0 WHEN 'review' THEN 1 WHEN 'not_started' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END,
          COALESCE(last_studied_at, updated_at) DESC,
          created_at DESC,
          id ASC
        LIMIT ? OFFSET ?`,
    );
    this.countByProjectStatement = db.prepare('SELECT COUNT(*) AS count FROM resources WHERE project_id = ?');
    this.findByIdStatement = db.prepare('SELECT * FROM resources WHERE id = ?');
    this.findRecommendedStatement = db.prepare(
      `SELECT * FROM resources
        WHERE status IN ('learning', 'review', 'not_started')
        ORDER BY
          CASE status WHEN 'learning' THEN 0 WHEN 'review' THEN 1 ELSE 2 END,
          CASE WHEN last_studied_at IS NULL THEN 1 ELSE 0 END,
          last_studied_at DESC,
          updated_at DESC,
          created_at ASC,
          id ASC
        LIMIT 1`,
    );
    this.listCultivationResourceRowsStatement = db.prepare(
      `SELECT id, type, status, progress_percent, cultivation_role, mastery_group, mastery_weight
         FROM resources
        WHERE project_id = ? AND cultivation_role <> 'reference'`,
    );
    this.listGlobalResourceRowsStatement = db.prepare(
      `SELECT r.*,
              p.id AS project_summary_id,
              p.name AS project_name,
              p.status AS project_status,
              COALESCE((SELECT ROUND(AVG(progress_percent)) FROM resources WHERE project_id = p.id), 0) AS project_progress_percent
         FROM projects p
         JOIN resources r ON r.project_id = p.id
        ORDER BY
          COALESCE(p.last_studied_at, p.updated_at) DESC,
          p.created_at DESC,
          p.id ASC,
          CASE r.status WHEN 'learning' THEN 0 WHEN 'review' THEN 1 WHEN 'not_started' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END,
          COALESCE(r.last_studied_at, r.updated_at) DESC,
          r.created_at DESC,
          r.id ASC`,
    );
    this.listStatusRowsByProjectStatement = db.prepare('SELECT status FROM resources WHERE project_id = ?');
    this.getLastStudiedAtByProjectStatement = db.prepare('SELECT MAX(last_studied_at) AS last_studied_at FROM resources WHERE project_id = ?');
    this.insertStatement = db.prepare(
      `INSERT INTO resources (
        id, project_id, title, type, open_kind, path_or_url, cultivation_role, mastery_group,
        mastery_weight, status, progress_text, progress_percent, next_action, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.updateStatement = db.prepare(
      `UPDATE resources
          SET title = ?, type = ?, open_kind = ?, path_or_url = ?, cultivation_role = ?,
              mastery_group = ?, mastery_weight = ?, status = ?, progress_percent = ?, updated_at = ?
        WHERE id = ?`,
    );
    this.updateProgressAfterLogStatement = db.prepare(
      `UPDATE resources
          SET progress_text = ?, progress_percent = ?, next_action = ?, status = ?,
              last_studied_at = ?, updated_at = ?
        WHERE id = ?`,
    );
    this.updateLastOpenedAtStatement = db.prepare('UPDATE resources SET last_opened_at = ? WHERE id = ?');
    this.deleteStatement = db.prepare('DELETE FROM resources WHERE id = ?');
  }

  listByProjectRows(input: { project_id: string } & PageInput): PageRows<ResourceRow> {
    const rows = this.listByProjectStatement.all(input.project_id, input.limit, input.offset) as ResourceRow[];
    const total = this.countByProjectStatement.get(input.project_id) as { count: number };
    return { rows, total: total.count, limit: input.limit, offset: input.offset };
  }

  findRowById(resourceId: string): ResourceRow | null {
    return (this.findByIdStatement.get(resourceId) as ResourceRow | undefined) ?? null;
  }

  findRecommendedRow(): ResourceRow | null {
    return (this.findRecommendedStatement.get() as ResourceRow | undefined) ?? null;
  }

  listCultivationResourceRows(projectId: string): CultivationResourceProjectionRow[] {
    return this.listCultivationResourceRowsStatement.all(projectId) as CultivationResourceProjectionRow[];
  }

  listGlobalResourceRows(): GlobalResourceProjectionRow[] {
    return this.listGlobalResourceRowsStatement.all() as GlobalResourceProjectionRow[];
  }

  listStatusRowsByProject(projectId: string): { status: ResourceRow['status'] }[] {
    return this.listStatusRowsByProjectStatement.all(projectId) as { status: ResourceRow['status'] }[];
  }

  getLastStudiedAtByProject(projectId: string): string | null {
    const row = this.getLastStudiedAtByProjectStatement.get(projectId) as { last_studied_at: string | null };
    return row.last_studied_at;
  }

  insert(input: InsertResourceRow): void {
    this.insertStatement.run(
      input.id,
      input.project_id,
      input.title,
      input.type,
      input.open_kind,
      input.path_or_url,
      input.cultivation_role,
      input.mastery_group,
      input.mastery_weight,
      input.status,
      input.progress_text,
      input.progress_percent,
      input.next_action,
      input.now,
      input.now,
    );
  }

  update(input: UpdateResourceRow): number {
    return this.updateStatement.run(
      input.title,
      input.type,
      input.open_kind,
      input.path_or_url,
      input.cultivation_role,
      input.mastery_group,
      input.mastery_weight,
      input.status,
      input.progress_percent,
      input.now,
      input.resource_id,
    ).changes;
  }

  updateProgressAfterLog(input: UpdateResourceProgressInput): void {
    this.updateProgressAfterLogStatement.run(input.progress_text, input.progress_percent, input.next_action, input.status, input.now, input.now, input.resource_id);
  }

  updateLastOpenedAt(input: { resource_id: string; last_opened_at: string | null }): void {
    this.updateLastOpenedAtStatement.run(input.last_opened_at, input.resource_id);
  }

  delete(resourceId: string): number {
    return this.deleteStatement.run(resourceId).changes;
  }
}
