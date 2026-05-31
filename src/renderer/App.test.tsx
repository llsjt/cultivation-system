// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { normalizeProgressPercent } from '../shared/progress';
import { ProgressBar } from './App';

describe('ProgressBar', () => {
  it('renders width, text, and aria from the normalized value', () => {
    // Feature: black-myth-ui-theme, Property 5: ProgressBar render output is consistent with normalized progress.
    fc.assert(
      fc.property(fc.double(), (value) => {
        const normalized = normalizeProgressPercent(value);
        const { container, unmount } = render(<ProgressBar value={value} />);
        const progressbar = screen.getByRole('progressbar');
        const fill = container.querySelector('.progress-wrap span');

        expect(progressbar).toHaveAttribute('aria-valuenow', String(normalized));
        expect(progressbar).toHaveTextContent(`${normalized}%`);
        expect(fill).toHaveStyle({ width: `${normalized}%` });
        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
