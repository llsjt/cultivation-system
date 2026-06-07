import type { InsertBreakthroughAttemptRow, PreparedStatement, RepositoryDatabase } from './types';

export class BreakthroughAttemptRepository {
  private readonly insertStatement: PreparedStatement;

  constructor(db: RepositoryDatabase) {
    this.insertStatement = db.prepare(
      `INSERT INTO breakthrough_attempts (
        id, project_id, from_realm_rank, from_realm_layer, target_realm_rank,
        dao_foundation_score, passed, bottleneck_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  insert(input: InsertBreakthroughAttemptRow): void {
    this.insertStatement.run(
      input.id,
      input.project_id,
      input.from_realm_rank,
      input.from_realm_layer,
      input.target_realm_rank,
      input.dao_foundation_score,
      input.passed,
      input.bottleneck_summary,
      input.created_at,
    );
  }
}
