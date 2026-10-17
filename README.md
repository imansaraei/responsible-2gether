# Khooneh (formerly Responsible 2gether)

The family command centre: a tiny PWA for the people sharing a home. Chores now
(weekly shares, helpfulness feedback, a to-do list), Pocket Money coming. Free to run (Firebase Spark + Cloudflare Workers
static assets), no logins — each phone just remembers who's holding it.

Live at **https://2gether.imansaraei.com**.

Design: `docs/superpowers/specs/2026-10-09-responsible-2gether-design.md`

## One-time setup

1. **Firebase** (console.firebase.google.com)
   - Create a project (Spark/free plan; Google Analytics off).
   - Build → Authentication → Sign-in method → enable **Anonymous**.
   - Build → Firestore Database → Create database (production mode, region near you, e.g. `eur3`).
   - Project settings → Your apps → add a **Web** app → copy the config object into `src/firebase/config.ts` (replace the `REPLACE_ME` values), then commit and push the edited `config.ts`.
   - Deploy the security rules (run `npm install` first so `npx firebase` is available):
     ```bash
     npm install
     npx firebase login
     npx firebase deploy --only firestore:rules --project <your-project-id>
     ```
2. **Hosting (Cloudflare, free)**
   - `wrangler.jsonc` deploys `dist/` as a Worker with static assets on the custom domain
     `2gether.imansaraei.com` (the `imansaraei.com` zone must be in the same Cloudflare account).
   - Deploy with `npm run deploy` (runs the tests, builds, then `wrangler deploy`;
     `npx wrangler login` once if needed). GitHub Actions only runs tests and a build.
3. **Phones**
   - Open `https://2gether.imansaraei.com`.
   - Phone 1 (any phone): *Create our household*. Settings → note the household code (use *Copy code*) or *Share join link*.
   - Phone 2, **iPhone**: do the install FIRST. Share → *Add to Home Screen*, then open the installed app (not Safari), choose *Join with a code* and paste the code. Home-screen apps on iOS don't share storage with Safari and drop the `#join` part of a link, so a join link opened in Safari won't carry over to the installed app.
   - Phone 2, **Android**: menu → *Install app*, then open the join link or use *Join with a code*.

## Upgrading an existing phone to Khooneh

iOS doesn't refresh an installed app's name or icon, so re-add it once. A newly
added Home Screen app starts with empty device storage; household data is safe in
Firestore. On each phone:

1. In the old app, open Settings and tap *Copy code* first.
2. Add the new app to the Home Screen from Safari (Share → *Add to Home Screen*).
3. Open it, choose *Join with a code*, paste the code, and pick who you are.
4. Turn reminders on again.
5. In the old app, turn reminders off, then delete it, to avoid duplicate reminders.

## How scoring works

- Each chore has a time block: the minutes it takes each time it's done (e.g. loading the dishwasher = 15 min). Edit blocks in Chores › Setup.
- Logging a chore (Chores › To-do) adds its block × 1, 2 or 3. You can undo it for 10 seconds.
- Minutes count for whoever logged them; the weekly chart shows each person's share of the minutes logged.
- Weeks rated with percentages before time blocks still show, as estimated minutes.
- Helpfulness is 100 minus 10 for every negative feedback received that week (never below 0). Positive feedback never changes it, and resolving a negative does not restore it.
- Warning: if you gave negative feedback but fewer than 2 positives per negative (positives < 2 × negatives), the app nudges you to balance it out.
- Weeks run Monday to Sunday and reset every Monday; past weeks are kept as history.

## Pocket Money

- The first visit to Money sets the monthly allowances: one for each person (theirs to spend on anything) and a shared Home pot.
- Daily allowance = monthly ÷ days in the month; this week = daily × this week's days in this month. For example £250 in October is £8.06 a day and £56.45 a week.
- Log purchases on the same day with **＋ Purchase** (Home or Money). On a day you spend nothing, tap **No spending today**. You can delete your own entries from today.
- Money › Family shows totals only — each person's purchases stay private to them. The Home pot is itemised for both.
- Days follow the household time zone chosen at setup.
- Coming next: a 120% charge for days that aren't logged, two Second Chances a month to fix them, and the Piggy Bank for month-end savings.

## Development

Requires Node 24+ and Java 17 for the emulator:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH=/opt/homebrew/opt/openjdk@17/bin:$PATH
npm install
npm test            # unit + component tests
npm run test:rules  # Firestore rules against the emulator
npm run emulators   # terminal 1: local Auth + Firestore
npm run dev:emu     # terminal 2: app against the emulator
```

## Backups

Data lives in Firestore and each phone keeps an offline copy. Settings →
*Export backup* opens the phone's share sheet — choose *Save to Files* (or
Drive) to keep the JSON file; on desktop it falls back to a normal download.
*Import backup* restores one (replacing current data). The app nudges you if
no export happened in 30 days.
