import { normalizeProgressPercent } from '../../shared/progress';

export function ProgressBar({ value }: { value: number }) {
  const progress = normalizeProgressPercent(value);

  return (
    <div className="progress-wrap" role="progressbar" aria-label={`完成 ${progress}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <span style={{ width: `${progress}%` }} />
      <strong>{progress}%</strong>
    </div>
  );
}
