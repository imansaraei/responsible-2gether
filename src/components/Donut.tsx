import type { ReactNode } from 'react';
import type { DonutSlice } from '../domain/scoring';
import { sliceColor } from './colors';

const SIZE = 240, STROKE = 38, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;
const fmt = (h: number) => `${Math.round(h * 100) / 100} h`;

export function Donut({ slices, label }: { slices: DonutSlice[]; label: ReactNode }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Share of chores done this week">
        <circle className="donut-track" cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--slice-empty)" strokeWidth={STROKE} />
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {total > 0 && slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.key}
                data-slice={s.key}
                cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
                stroke={sliceColor(s.member, s.shadeIndex, s.shadeCount)}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              >
                <title>{`${s.label} — ${fmt(s.value)}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <div className="donut-label">{label}</div>
    </div>
  );
}
