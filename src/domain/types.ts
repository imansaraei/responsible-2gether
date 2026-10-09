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
