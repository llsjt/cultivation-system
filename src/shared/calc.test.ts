import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { calcProjectProgress } from './calc';

describe('calcProjectProgress', () => {
  it('rounds average progress', () => {
    expect(calcProjectProgress([])).toBe(0);
    expect(calcProjectProgress([20, 40, 100])).toBe(53);
  });

  it('stays in the progress range', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 0, maxLength: 50 }), (values) => {
        expect(calcProjectProgress(values)).toBeGreaterThanOrEqual(0);
        expect(calcProjectProgress(values)).toBeLessThanOrEqual(100);
      }),
    );
  });

  it('matches SQLite round(avg()) for stored integer progress', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE progress_values (value INTEGER NOT NULL)');
    const insert = db.prepare('INSERT INTO progress_values (value) VALUES (?)');

    for (const value of [20, 40, 100]) {
      insert.run(value);
    }

    const row = db.prepare('SELECT round(avg(value)) AS progress FROM progress_values').get() as { progress: number };
    expect(row.progress).toBe(calcProjectProgress([20, 40, 100]));
    db.close();
  });
});
