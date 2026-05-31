import { describe, expect, it } from 'vitest';

import { SaveStudyLogInputSchema, UpdateResourceInputSchema } from './dto';

describe('DTO schemas', () => {
  it('requires resource_updated_at_before for new study logs', () => {
    expect(() =>
      SaveStudyLogInputSchema.parse({
        resource_id: 'r1',
        source: 'record_only',
        progress_percent: 20,
        resource_updated_at_before: '',
      }),
    ).toThrow();
  });

  it('rejects progress and project changes in update_resource', () => {
    expect(() =>
      UpdateResourceInputSchema.parse({
        resource_id: 'r1',
        title: 'x',
        type: 'document',
        open_kind: 'record_only',
        progress_percent: 30,
      }),
    ).toThrow();
  });
});
