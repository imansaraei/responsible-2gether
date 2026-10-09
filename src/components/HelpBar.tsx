import type { MemberId } from '../domain/types';
import { memberColor } from './colors';

export function HelpBar({ name, value, member }: { name: string; value: number; member: MemberId }) {
  return (
    <div className="helpbar">
      <div className="helpbar-head"><span>{name}</span><strong>{value}%</strong></div>
      <div className="helpbar-track" role="meter" aria-label={`${name} helpfulness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="helpbar-fill" style={{ width: `${value}%`, background: memberColor(member) }} />
      </div>
    </div>
  );
}
