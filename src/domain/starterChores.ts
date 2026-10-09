import type { MemberId } from './types';

// Weekly hours for a 50 m² one-bedroom flat shared by two.
export const STARTER_CHORES: { name: string; hours: number }[] = [
  { name: 'Empty dishes', hours: 1 },
  { name: 'Load the dishwasher', hours: 1.5 },
  { name: 'Load the washing machine', hours: 0.5 },
  { name: 'Empty the washing machine', hours: 1 },
  { name: 'Washing the toilet', hours: 1 },
  { name: 'Tidy up living room', hours: 1 },
  { name: 'Tidy up kitchen', hours: 1.5 },
  { name: 'Sorting out the groceries', hours: 0.5 },
  { name: 'Drying up the toilet', hours: 0.5 },
  { name: 'Tidy up the bedroom', hours: 0.75 },
  { name: 'Tidy up the hallway', hours: 0.25 },
  { name: 'Taking out the trash', hours: 0.5 },
  { name: 'Cleaning the fridge', hours: 0.25 },
  { name: 'Cooking', hours: 7 },
];

export const starterAssignee = (index: number): MemberId => (index % 2 === 0 ? 'a' : 'b');
