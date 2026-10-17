# Piggy Bank + money-left pacing (spec and plan)

Phase 4 (penalty, Second Chance, proration) is on hold. This adds two features.

## Decisions (user, 2026-10-17)

- Piggy Banks are personal only (Iman, Tahereh). Home pot leftovers are not banked.
- The bank fills from month-end leftovers and is never reduced by overspending: each finished month adds `max(0, leftover)`.
- It starts at £0. The first month to settle is the setup month (October 2026), so the first deposit arrives on 1 November.
- The owner can move money from the bank into the **current** month's allowance, up to the balance.

## Maths (src/domain/money.ts)

All values are in pence. Only `purchase` entries count as spending; `bank` entries are top-ups.

- `topUps(m)` = the sum of `bank` entries for this budget in month m.
- `monthAllowance` = `monthlyAmount + topUps(this month)`.
- `leftAtStartOfToday` = `monthAllowance − purchases before today this month`.
- `daily` = `max(0, leftAtStartOfToday) ÷ days left in the month, counting today`.
  - Example: a 30-day month, £200, with £150 spent by the end of the 20th. On the 21st, £50 ÷ 10 days = £5.00.
  - Spending today does not change today's daily figure; it changes tomorrow's.
- `weekAllowance` = `max(0, left at the start of this week's first day in the month) ÷ days left from that day × this week's days in the month`.
  - This is fixed for the week, apart from top-ups made during the week.
- `todayLeft = daily − todaySpent`, `weekLeft = weekAllowance − weekSpent`, `monthLeft = monthAllowance − monthSpent` (unchanged).
- `piggyBank(budget, entries, today, timeZone)`:
  - The months run from the budget's `createdAt` month (in the household time zone) up to, but not including, today's month.
  - `balance = Σ max(0, monthlyAmount + topUps(m) − purchases(m)) − Σ all bank entries` (this month's included).
  - It uses the current `monthlyAmount` for past months. There's no amount editing yet; when there is, past amounts must be snapshotted.

## Data

- A new `MoneyKind` `'bank'`, created like a purchase:
  - `amount ≥ 1`, `label` "From Piggy Bank", `by = owner`, `day = today`.
  - It's deletable only on the same day, like other entries, so it doubles as undo.
- Rules: allow `kind == 'bank' && validPence(amount, 1)`.
- The backup validator accepts `'bank'`.
- `useMoney` loads all entries up to the end of the current month (no lower bound), so past months can be settled. The volume is tiny.

## UI

- **Money › Mine:** a Piggy Bank card under the tiles shows the balance and a **Move to this month** button (shown when the balance is above 0). A sheet takes an amount (≤ balance) and previews the new daily allowance.
- The bank entry shows in the week's list as "From Piggy Bank +£x".
- The Today tile caption reads "of £x · money left ÷ days left".
- **Money › Family:** each person's row also shows their Piggy Bank balance (it's a total, so it doesn't break privacy).
- The README Pocket Money section is updated.

## Tasks

1. Domain: the types, `allowanceStatus` rewrite, `piggyBank`, and tests (including the £5/day example), plus the backup validator.
2. Data: the rules and rules tests for `bank`, the `useMoney` query, and making sure the repo writes `bank` entries.
3. UI: the Mine Piggy Bank card and sheet, EntryList rendering for `bank`, the Family balances, the Purchase preview, the README, and tests.
