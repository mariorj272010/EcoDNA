# EcoDNA — Teammate Setup Guide

Follow these steps after downloading `EcoDNA_MVP_Teammate_2026-08-09.zip`.

## 1. Unzip the project

1. Right-click the ZIP file.
2. Choose **Extract All**.
3. Open the extracted `ecodna-mvp` folder in VS Code or a terminal.

## 2. Install Node.js

1. Install Node.js 20 or newer from <https://nodejs.org> if it is not already installed.
2. Open Command Prompt inside the `ecodna-mvp` folder.
3. Check it works:

```bash
node -v
```

## 3. Install project packages

Run:

```bash
npm install
```

Wait until it finishes. This recreates the `node_modules` folder that was intentionally left out of the ZIP.

## 4. Create the private environment file

1. Duplicate `.env.example`.
2. Rename the duplicate to `.env.local`.
3. Ask the project owner for the private values and paste them into `.env.local`:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.6-flash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Do not upload, commit, or send `.env.local` in a public chat or GitHub repository. It contains the server-side Gemini and Supabase credentials.

## 5. Connect to the shared Supabase project

If the project owner has already set up Supabase and you should share the same EcoDNA reports:

1. Do **not** create a new Supabase project.
2. Put the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into your own private `.env.local` file.
3. Do **not** rerun the migration unless the owner asks you to. The shared database is already configured.

Only run the migration when the shared project has not yet been configured:

1. Open the shared Supabase project.
2. Open **SQL Editor** → **New query**.
3. Open `supabase/reporter_rewards_migration.sql` in this project.
4. Copy all of it into Supabase.
5. Click **Run**.
6. Confirm Supabase displays a success message.

This is safe to rerun. It creates the username/profile and reward tables needed for reporter registration.

## 6. Start EcoDNA

Run:

```bash
npm run dev
```

Open this address in a browser:

<http://127.0.0.1:3000/app>

Keep the terminal open while using the app. Press `Ctrl + C` in that terminal to stop it.

## 7. Quick test checklist

1. Open **Create account** and make a reporter account.
2. Sign in as that reporter.
3. Upload a litter photo, analyze it, verify the dropdown fields, choose a location, and submit it.
4. The report should say it is waiting for reviewer approval.
5. Sign in with a reviewer account to approve or reject it.
6. A reviewer-approved report with average AI confidence of at least 80% awards the reporter 10 points.
7. Open **My Rewards** as the reporter to confirm the point total.

## Shared-data note

If you use the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as the project owner, reports, accounts, reviewer decisions, and rewards are shared between your computers automatically. Demo data can be loaded only by reviewer accounts.

## Common problems

| Problem | Fix |
| --- | --- |
| `npm` is not recognized | Install Node.js, close/reopen Command Prompt, then try again. |
| “Supabase authentication is not configured” | Check `.env.local` exists, has the correct values, then stop and restart `npm run dev`. |
| “Reporter registration needs the updated EcoDNA Supabase SQL” | Run `supabase/reporter_rewards_migration.sql` in the shared Supabase SQL Editor. |
| Gemini analysis fails | Check `GEMINI_API_KEY` in `.env.local` and restart the app. |
| No shared reports appear | Confirm both computers use the same Supabase URL and service-role key, then press **Refresh now**. |
