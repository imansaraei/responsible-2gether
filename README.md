# Responsible 2gether

A tiny PWA for two people sharing a home: weekly chore shares, helpfulness
feedback, and a to-do list. Free to run (Firebase Spark + GitHub Pages), no
logins — each phone just remembers who's holding it.

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
2. **GitHub Pages**
   - Create a repo named `responsible-2gether` on your personal GitHub and push `main`.
   - Repo Settings → Pages → Source: **GitHub Actions**. The workflow deploys on every push to `main`.
   - Firebase console → Authentication → Settings → Authorised domains → add `<your-user>.github.io`.
3. **Phones**
   - Open `https://<your-user>.github.io/responsible-2gether/`.
   - Phone 1 (any phone): *Create our household*. Settings → note the household code (use *Copy code*) or *Share join link*.
   - Phone 2, **iPhone**: do the install FIRST. Share → *Add to Home Screen*, then open the installed app (not Safari), choose *Join with a code* and paste the code. Home-screen apps on iOS don't share storage with Safari and drop the `#join` part of a link, so a join link opened in Safari won't carry over to the installed app.
   - Phone 2, **Android**: menu → *Install app*, then open the join link or use *Join with a code*.

## How scoring works

- Each chore has hours and a completion percent (0/25/50/75/100); done hours = hours × percent / 100.
- A person's share is the sum of done hours of the chores assigned to them.
- Helpfulness is 100 minus 10 for every negative feedback received that week (never below 0). Positive feedback never changes it, and resolving a negative does not restore it.
- Warning: if you gave negative feedback but fewer than 2 positives per negative (positives < 2 × negatives), the app nudges you to balance it out.
- Weeks run Monday to Sunday and reset every Monday; past weeks are kept as history.

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
