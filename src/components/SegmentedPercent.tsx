import { PERCENTS, type Percent } from '../domain/types';

export function SegmentedPercent({ value, onChange, label }: { value: Percent; onChange(p: Percent): void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={`${label} completion`}>
      {PERCENTS.map((p) => (
        <button key={p} role="radio" aria-checked={value === p} className={value === p ? 'on' : ''} onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
    </div>
  );
}
