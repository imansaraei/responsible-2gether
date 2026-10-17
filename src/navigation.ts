export type TabId = 'home' | 'chores' | 'money' | 'settings';
export type ChoresSection = 'week' | 'todo' | 'feedback' | 'setup';

export type MoneySection = 'family' | 'mine' | 'home';

export interface NavTarget {
  tab: TabId;
  section?: ChoresSection;
  moneySection?: MoneySection;
}

export const CHORES_SECTIONS: { id: ChoresSection; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'todo', label: 'To-do' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'setup', label: 'Setup' },
];

export const MONEY_SECTIONS: { id: MoneySection; label: string }[] = [
  { id: 'family', label: 'Family' },
  { id: 'mine', label: 'Mine' },
  { id: 'home', label: 'Home pot' },
];
