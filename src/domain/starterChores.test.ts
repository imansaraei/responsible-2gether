import { STARTER_CHORES, starterAssignee } from './starterChores';

test('14 starter chores in the agreed order', () => {
  expect(STARTER_CHORES.map((c) => c.name)).toEqual([
    'Empty dishes', 'Load the dishwasher', 'Load the washing machine', 'Empty the washing machine',
    'Washing the toilet', 'Tidy up living room', 'Tidy up kitchen', 'Sorting out the groceries',
    'Drying up the toilet', 'Tidy up the bedroom', 'Tidy up the hallway', 'Taking out the trash',
    'Cleaning the fridge', 'Cooking',
  ]);
});

test('total is 17.25 hours', () => {
  expect(STARTER_CHORES.reduce((s, c) => s + c.hours, 0)).toBe(17.25);
});

test('assignees alternate starting with a', () => {
  expect([0, 1, 2, 3].map(starterAssignee)).toEqual(['a', 'b', 'a', 'b']);
});
