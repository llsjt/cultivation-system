import { describe, expect, it } from 'vitest';

import { getResourceRoleDisplay, getResourceStatusLabel, getResourceTypeLabel, getResourceWeightDisplay } from './resourceDisplay';

describe('resource display helpers', () => {
  it('labels cultivation roles with stable learning-oriented descriptions', () => {
    expect(getResourceRoleDisplay('core')).toMatchObject({
      label: '核心功法',
      description: '直接影响当前方向的主干掌握。',
      tone: 'success',
    });
    expect(getResourceRoleDisplay('reference')).toMatchObject({
      label: '参考资料',
      description: '作为查阅和旁证，不作为主要境界贡献。',
      tone: 'muted',
    });
  });

  it('describes mastery weight as direction representativeness', () => {
    expect(getResourceWeightDisplay(3)).toMatchObject({
      label: '方向代表性 3/5',
      valueLabel: '3/5',
      description: '代表这份资料对当前方向境界反馈的影响程度。',
    });
  });

  it('warns when weight is set to the highest representativeness', () => {
    expect(getResourceWeightDisplay(5)).toMatchObject({
      label: '方向代表性 5/5',
      tone: 'warning',
      description: '最高代表性请谨慎使用，避免所有资料都变成主干。',
    });
  });

  it('normalizes invalid weight input for edit field intermediate states', () => {
    expect(getResourceWeightDisplay(Number.NaN).valueLabel).toBe('1/5');
  });

  it('keeps type and status labels in one place', () => {
    expect(getResourceTypeLabel('exercise')).toBe('练习');
    expect(getResourceStatusLabel('review')).toBe('需复习');
  });
});
