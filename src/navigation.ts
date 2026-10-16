export type TabId = 'home' | 'chores' | 'money' | 'settings';
export type ChoresSection = 'week' | 'todo' | 'feedback' | 'setup';

export interface NavTarget {
  tab: TabId;
  section?: ChoresSection;
}

export const CHORES_SECTIONS: { id: ChoresSection; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'todo', label: 'To-do' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'setup', label: 'Setup' },
];
