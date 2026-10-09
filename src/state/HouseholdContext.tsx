import { createContext, useContext } from 'react';
import type { Chore, MemberId, Members } from '../domain/types';
import type { DeviceState } from '../device';

export interface HouseholdCtx {
  code: string;
  me: MemberId;
  members: Members;
  chores: Chore[];
  currentWeekId: string;
  device: DeviceState;
  updateDevice(patch: Partial<DeviceState>): void;
}

export const HouseholdContext = createContext<HouseholdCtx | null>(null);

export function useHousehold(): HouseholdCtx {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold outside HouseholdContext');
  return ctx;
}
