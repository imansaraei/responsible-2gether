export type MemberId = 'a' | 'b';
export const MEMBER_IDS: MemberId[] = ['a', 'b'];
export const other = (m: MemberId): MemberId => (m === 'a' ? 'b' : 'a');

export type Percent = 0 | 25 | 50 | 75 | 100;
export const PERCENTS: Percent[] = [0, 25, 50, 75, 100];

export interface Members {
  a: { name: string };
  b: { name: string };
}

export interface Chore {
  id: string;
  name: string;
  hours: number;
  blockMinutes?: number;
  assignee: MemberId;
  createdAt: number;
  archivedAt: number | null;
}

export interface Completion {
  choreId: string;
  percent: Percent;
  name: string;
  hours: number;
  assignee: MemberId;
  updatedAt: number;
}

export type FeedbackKind = 'plus' | 'minus';

export interface Feedback {
  id: string;
  from: MemberId;
  to: MemberId;
  kind: FeedbackKind;
  text: string;
  createdAt: number;
  resolved: boolean;
}

export type Multiplier = 1 | 2 | 3;
export const MULTIPLIERS: Multiplier[] = [1, 2, 3];

export interface ChoreLog {
  id: string;
  choreId: string;
  name: string;       // chore name at the time of logging
  by: MemberId;       // who did it (credited the minutes)
  multiplier: Multiplier;
  minutes: number;    // block × multiplier
  day: string;        // device-local YYYY-MM-DD
  createdAt: number;
}

export type BudgetOwner = MemberId | 'shared';

export interface Budget {
  id: string;
  name: string;
  owner: BudgetOwner;
  monthlyAmount: number; // pence
  penalty: boolean;      // phase 4: missed-day penalty applies
  order: number;
  createdAt: number;
  archivedAt: number | null;
}

export type MoneyKind = 'purchase' | 'nothing';

export interface MoneyEntry {
  id: string;
  budgetId: string;
  by: MemberId;
  day: string;     // YYYY-MM-DD in the household time zone
  amount: number;  // pence; 0 for 'nothing'
  label: string;   // '' when not given
  kind: MoneyKind;
  createdAt: number;
}

export interface MoneySettings {
  timeZone: string;
  currency: 'GBP';
}
