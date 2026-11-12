# Missions and Bills (spec and plan)

## Decisions (user, 2026-11-12)

- **Missions:** one person assigns the other a mission with a gift (for example Iman to Tahereh, "Clean the cupboards", £5).
  - The flow is open → done (the assignee marks it done) → approved (only the giver approves).
  - The giver can also cancel an open or done mission, or send a done one back to open.
  - On approval the gift moves allowance to allowance in the approval month: the giver's month allowance goes down and the receiver's goes up. Both daily allowances re-pace straight away.
- **Bills:** each person has a list of monthly bills (name, amount).
  - Bills are paid on top of the allowance and never change the allowance or the pacing.
  - Money shows "This month: allowance £x + bills £y = £z" per person.
  - Both people see each other's bills itemised.

## Data

- `missions/{id}` holds `{ from, to, title (≤60), gift (pence ≥1), status: 'open'|'done'|'approved'|'cancelled', createdAt, updatedAt }`.
  - The rules validate the shape and that `from != to`. Who may do what is enforced by the client (soft, like the rest of the app).
  - Missions are not deletable; they are cancelled instead.
- **Approval** is one batch: set the mission to `approved`, and create two money entries with fixed ids:
  - `gift-out-{missionId}`: kind `giftOut`, on the giver's personal budget.
  - `gift-in-{missionId}`: kind `giftIn`, on the receiver's personal budget.
  - Both have `by = giver`, `day = today`, label = the mission title, amount = the gift.
  - The money entries are create-only, so a second approval fails rather than paying twice.
- **Money maths:** month allowance = `monthlyAmount + bank + giftIn − giftOut`.
  - Gifts are not spending.
  - Piggy Bank leftovers use the same month allowance; only `bank` entries reduce the bank.
  - Gift entries are never deletable in the UI.
- `bills/{id}` holds `{ owner: 'a'|'b', name (≤40), amount (pence ≥1), createdAt, archivedAt }`. Removing a bill sets `archivedAt` (no delete).
- Backup export/import includes `missions` and `bills`, the same way as budgets, and stays tolerant of old backups.

## UI

- **A new Money sub-tab, "Missions",** with sections:
  - "For me": open ones get **Mark done**.
  - "I set": done ones get **Approve £x** and **Not yet**; open ones get **Cancel**.
  - A **＋ Mission** sheet: title, gift amount, the other person as assignee.
  - Approved and cancelled missions from this month are listed under History.
- **Mine:**
  - A Bills card: a list with a remove button, **＋ Bill** (name and amount), and the line "This month: allowance £x + bills £y = £z".
  - Gift entries show in the list as "🎁 <title>" with +£ for gifts received and −£ for gifts given.
- **Family:** each person's row adds "Bills £y · Total £z".
- **Home:** a badge on the Money card when there are missions waiting for me (open for me, or done and waiting for my approval).
