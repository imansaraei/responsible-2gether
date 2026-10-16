# Khooneh — Implementation Roadmap

**Spec:** `docs/superpowers/specs/2026-10-16-family-command-center-design.md`

The spec has six phases that are separate subsystems. Each phase ships to the live app on its own
and gets its **own detailed plan**, written when that phase starts and based on the code as it is
then. This file lists them in order, with what each produces and what it depends on.

| Phase | Plan | Delivers | Depends on |
|---|---|---|---|
| 1 | `2026-10-16-khooneh-phase1-shell.md` (detailed) | Rename to Khooneh + new icon. Tabs Home / Chores / Money / Settings. Existing chores screens become the **Tidy Together** module with sub-sections. **Home** command centre: greeting, alerts, ＋ Chore, Tidy Together card (this week's split), Pocket Money "coming soon" card | — |
| 2 | *to write at start* | **Tidy Together blocks**: `blockMinutes` per chore, `choreLogs` with 1×/2×/3× multiplier, logging sheet with undo, minutes-based pie, migration from hours/percent (old weeks stay viewable), admin-free block editing in Chores setup | 1 |
| 3 | *to write at start* | **Pocket Money core**: `settings/app`, `budgets`, `budgetMonths`, `money` entries in pence. Pure allowance maths (daily/weekly/monthly left). Purchase sheet (allowance / Home). "No spending today". Family vs Mine vs Home views. Home today strip and ＋ Purchase | 1 |
| 4 | *to write at start* | **Penalty, Second Chance, Piggy Bank**: derived missed days (120%), rewind flow with 2/month + end-of-week window, counter-enforced rules, derived settlement and bank balance, spend-from-bank source, report screen | 3 |
| 5 | *to write at start* | **Admin panel** at `admin.2gether.imansaraei.com`: Google sign-in + `admins` allowlist in rules. People / Budgets / Rules / Chores / Bank adjustments / Reports (CSV) / Data / Audit log | 3 (and 2 for chores catalogue) |
| 6 | *to write at start* | **Spending-aware 22:00 reminder**: app reports `loggedToday` with its subscription sync, and the Worker picks the money-reminder copy | 3 |

Cross-cutting rules that apply to every phase:
- Pure domain logic goes in `src/domain/`, written test-first. Screens consume it via hooks.
- Money is stored in pence. Days are `YYYY-MM-DD` in the household time zone (default `Europe/London`).
- Firestore rule changes come with emulator rules tests (`npm run test:rules`).
- Each phase ends with a deploy (`npm run deploy`) and a phone-size check in the browser.
