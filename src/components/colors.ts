import type { MemberId } from '../domain/types';

const HUE: Record<MemberId, number> = { a: 174, b: 12 };
const SAT: Record<MemberId, number> = { a: 60, b: 80 };
// Bounds keep every shade ≥3:1 against both #ffffff and the dark surface #201f1c (WCAG non-text contrast)
const LIGHT_MIN: Record<MemberId, number> = { a: 30, b: 44 };
const LIGHT_MAX: Record<MemberId, number> = { a: 40, b: 60 };
const MEMBER_LIGHT: Record<MemberId, number> = { a: 35, b: 50 };

export function sliceColor(member: MemberId | null, shadeIndex: number, shadeCount: number): string {
  if (member === null) return 'var(--slice-empty)';
  const t = shadeCount <= 1 ? 0 : shadeIndex / (shadeCount - 1);
  const light = Math.round(LIGHT_MIN[member] + t * (LIGHT_MAX[member] - LIGHT_MIN[member]));
  return `hsl(${HUE[member]} ${SAT[member]}% ${light}%)`;
}

export function memberColor(m: MemberId) {
  return `hsl(${HUE[m]} ${SAT[m]}% ${MEMBER_LIGHT[m]}%)`;
}
