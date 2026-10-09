# Responsible 2gether — Design

Date: 2026-10-09
Status: approved in chat

## Purpose

A free-to-run PWA for a couple to see how well each of them keeps the home
clean: who does how much of the weekly chores, and how helpful each finds the
other day to day. Two phones, one shared household, no accounts.

## Constraints

- Zero running cost (free tiers only).
- Syncs between two devices; data must survive a lost phone.
- No authentication UI. A device only remembers which person is using it.
- Installable PWA, works offline, phone-first layout.

## Stack

- Vite + React + TypeScript, `vite-plugin-pwa` (service worker + manifest).
- Firebase JS SDK: Anonymous Auth + Cloud Firestore (Spark/free plan) with
  persistent local cache (`persistentLocalCache` + multi-tab manager).
- Charts: hand-written SVG components (no chart library).
- Tests: Vitest for pure domain logic; React Testing Library for key
  components; manual phone-size run in a browser against the Firestore
  emulator.
- Hosting: GitHub Pages via GitHub Actions (app served under
  `/responsible-2gether/`, Vite `base` set accordingly).
- The Firebase web config is public by design; it lives in
  `src/firebase/config.ts`. Setting `VITE_USE_EMULATOR=1` points the app at
  the local Auth + Firestore emulators.

## Identity and households

- Members are always exactly two, with fixed ids `a` and `b`, each with a
  display name and a colour family (`a` = teal family, `b` = coral family).
- **Create household** (first device): enter both names → app generates a
  household code: three words from a built-in 256-word list plus four digits,
  e.g. `tidy-otter-maple-4821`. The household doc and the starter chore list
  are written.
- **Join household** (second device): enter the code, or open the share link
  `…/#join=<code>`.
- After create/join the device asks **"Who are you?"** (one of the two names)
  and stores `{householdCode, me}` in `localStorage`. Changeable in Settings.
- Firebase Anonymous Auth signs in silently on every device.
- Security rules: a signed-in client may `get`, `create` and `update` a
  household doc and read/write its subcollections; `list` on `households` is
  denied, so the code acts as the shared secret. Field-level validation keeps
  document shapes sane (types, value ranges, string lengths).

## Data model (Firestore)

```
households/{code}
  members: { a: {name}, b: {name} }
  createdAt: timestamp

households/{code}/chores/{choreId}
  name: string (1–60)
  hours: number (0.25–40, step 0.25)   // weekly time
  assignee: 'a' | 'b'
  createdAt: timestamp
  archivedAt: timestamp | null          // "delete" = archive

households/{code}/weeks/{weekId}/completions/{choreId}
  percent: 0 | 25 | 50 | 75 | 100
  name, hours, assignee                 // snapshot at time of rating
  updatedAt: timestamp

households/{code}/weeks/{weekId}/feedback/{feedbackId}
  from: 'a' | 'b'
  to: 'a' | 'b'                         // always the other member
  kind: 'plus' | 'minus'
  text: string (1–280)
  createdAt: timestamp
  resolved: boolean                     // meaningful for 'minus' only
```

`weekId` is the ISO-8601 week in the device's local time zone, e.g.
`2026-W41`. Weeks start Monday 00:00.

## Weekly reset and history

Nothing is deleted on Monday. The app computes the current `weekId`; data for
the new week starts empty, so completion rates are 0, feedback is empty and
helpfulness is 100%. The Dashboard has ‹ › arrows to browse past weeks
(read-only). To-do and Feedback always act on the current week.

A chore counts toward a week if it was created before the week ended and not
archived before the week started. For the **current week** the dashboard uses
the live chore name/hours/assignee. For **past weeks** it uses each
completion's snapshot, falling back to live chore data for unrated chores.

## Scoring rules (pure functions, unit-tested)

- `doneHours(chore) = hours × percent / 100`; unrated = 0%.
- Person's share = sum of `doneHours` of chores assigned to them.
- Donut slices: one per chore with `doneHours > 0`, grouped by person (person
  `a` slices first, then `b`), shaded within the person's colour family; plus
  one grey "not done yet" slice = total active hours − total done hours.
  Centre/legend shows each person's share as a percentage of all done hours
  (both 0% → shows "Nothing done yet").
- Helpfulness of person X for a week = `max(0, 100 − 10 × minusReceived(X))`.
  Plus feedback never changes it. Resolving a minus does not restore it.
- Ratio warning for giver X in the current week:
  `minusGiven(X) > 0 && plusGiven(X) < 2 × minusGiven(X)`.

## Screens

Bottom navigation, left → right:
**Configuration | Feedback | Dashboard | To-do | Settings**.
Dashboard is the centre tab, visually larger, and the default.

### Dashboard
- Week label with ‹ › (› disabled on current week).
- Donut chart as above, legend lists each person's total and chores.
- Under it, one helpfulness bar per person (0–100%), "you" first.
- "Kind words this week": the plus feedback the current user received.

### To-do
- "Your chores": chores assigned to me, each with a 5-step segmented control
  (0 / 25 / 50 / 75 / 100%). Changing it writes the completion with snapshot.
- "Feedback to act on": minus feedback I received this week, each with a
  checkbox bound to `resolved`. Shows the note and when it was given.

### Feedback
- Composer: + / − toggle, note field (required, ≤280 chars), Send.
- When the ratio rule is (or would become, with a minus being composed)
  violated, a warning card shows: too much negative feedback is usually
  destructive; consider redefining tasks or giving more positive feedback.
- List of feedback I gave this week; I can delete my own items (undo).

### Configuration
- All active chores: name, hours/week, assignee (toggle between two names).
- Add chore, edit inline, remove (archives). Total hours per person shown.

### Settings
- Member names (editable), "This device is: <name>" switcher.
- Household code + share link (copy / Web Share API).
- Sync status (online/offline, pending writes).
- Export JSON (whole household tree) / Import JSON (overwrites after a
  confirm dialog). Last export date stored per device; a reminder banner
  shows when it is more than 30 days ago or never.
- "Leave household on this device" (clears local storage only).

## Starter chores

Hours/week for a 50 m² one-bedroom flat for two. Assignees alternate a, b, a, …
in this order; the couple fixes them in Configuration.

| Chore | h/wk | Chore | h/wk |
|---|---|---|---|
| Empty dishes | 1.0 | Drying up the toilet | 0.5 |
| Load the dishwasher | 1.5 | Tidy up the bedroom | 0.75 |
| Load the washing machine | 0.5 | Tidy up the hallway | 0.25 |
| Empty the washing machine | 1.0 | Taking out the trash | 0.5 |
| Washing the toilet | 1.0 | Cleaning the fridge | 0.25 |
| Tidy up living room | 1.0 | Cooking | 7.0 |
| Tidy up kitchen | 1.5 | Sorting out the groceries | 0.5 |

Order as listed by the user: empty dishes, load dishwasher, load washing
machine, empty washing machine, washing the toilet, tidy living room, tidy
kitchen, sorting groceries, drying toilet, tidy bedroom, tidy hallway, trash,
fridge, cooking.

## Backup and durability

- Firestore stores data redundantly in Google's infrastructure.
- Each device keeps a full offline copy (persistent cache).
- Manual JSON export/import with a 30-day reminder.
- Past weeks are never deleted, so history doubles as an audit trail.

## Error handling

- Offline: writes queue locally and a small "offline — will sync" pill shows.
- Unknown household code on join: inline error, nothing stored.
- Firebase not configured (placeholder config): a setup screen explains the
  steps instead of crashing.
- Import validates the JSON shape before writing; invalid files are rejected
  with a message.

## Out of scope (for now)

- Real accounts / more than two members.
- Push notifications.
- Editing past weeks.

## Owner setup steps (documented in README)

1. Create a Firebase project (free Spark plan), add a Web app, enable
   Anonymous sign-in and Firestore; paste the config into
   `src/firebase/config.ts`; deploy `firestore.rules`.
2. Push the repo to a personal GitHub account, enable Pages (GitHub Actions
   source), and add the Pages domain to Firebase Auth authorised domains.
3. Open the site on both phones → Add to Home Screen.
