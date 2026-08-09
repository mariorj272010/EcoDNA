# EcoDNA MVP

EcoDNA is a environmental waste intelligence prototype:

**Reporter account → photo → Gemini Vision → standardized classification → contributor verification → GPS → independent reviewer approval → rewards + Waste DNA → Action Center**

## Current features

- Server-side Gemini image analysis
- Fixed dropdown taxonomies for category, packaging, and likely material
- Manual or device-GPS location selection
- Supabase report storage with local JSON fallback
- Private Supabase Storage evidence photos
- On-site reporter registration and sign-in backed by Supabase Auth
- Unique reporter usernames and account-linked report provenance
- Reviewer-approved rewards: 10 points for approved reports that meet the 80% AI-confidence threshold, with duplicate-award protection
- Reporter reward dashboard with submission states, points, and badge tiers
- Authenticated reviewer corrections, approval, rejection, notes, and audit history
- Pending observations excluded from environmental intelligence until approved
- Jakarta demo dataset with pending reviewer examples
- Confidence and data-quality flags
- Filters, CSV/JSON exports, map markers, hotspot rankings, and area profiles
- Shared intervention records and before/after measurement
- Time trends and 30-second shared-data refresh

## Quick start

1. Install Node.js 20 or newer.
2. Run `npm install` in this folder.
3. Run the complete `supabase/ecodna_reports.sql` in the Supabase SQL Editor. It is safe to rerun on an existing EcoDNA project and adds the reporter/rewards schema. Existing projects can instead run the smaller `supabase/reporter_rewards_migration.sql` upgrade.
4. Start EcoDNA:

```bash
npm run dev
```

Open <http://127.0.0.1:3000/app>.

## Account and reviewer setup

Reporters select **Create account** inside EcoDNA. The server creates a confirmed Supabase Auth user and a `reporter` row in `ecodna_profiles`; passwords remain managed by Supabase Auth and are never stored in report JSON.

Create reviewer accounts under **Supabase → Authentication → Users**, then promote each trusted reviewer in the SQL Editor:

```sql
insert into public.ecodna_profiles (user_id, role)
select id, 'reviewer'
from auth.users
where lower(email) = lower('reviewer@example.com')
on conflict (user_id)
do update set role = 'reviewer';
```

Reporter and reviewer roles intentionally remain separate. Reporters can submit observations and see their own rewards. Only reviewers can approve/reject observations, load shared demo data, reset storage, or deploy interventions. Reviewer accounts cannot submit field evidence, preventing self-approved rewards.

## Rewards behavior

- A newly submitted field report starts pending and awards no points.
- Reviewer approval creates one row in `ecodna_rewards` and awards 10 points only when average Gemini confidence is at least 80%.
- Low-confidence reports award no points even if retained as approved evidence. Confidence is an eligibility check, not a bonus, and AI confidence alone never awards points without reviewer approval.
- `report_id` is unique in the ledger, so repeated saves or approvals cannot award the same report twice.
- Rejected reports award no points. Demo observations and legacy observations without reporter ownership never award points.
- Cached totals are stored in `ecodna_profiles.reward_points`; the immutable ledger remains the source of truth.
- `ecodna_reward_leaderboard` provides a readable Supabase view for hackathon demonstrations.

## Data behavior

- Anonymous visitors can explore the dashboard, but field evidence requires an authenticated reporter account.
- New field reports store the reporter's Supabase user ID and username, remain pending, and are excluded from Waste DNA until approved.
- Evidence thumbnails are compressed and stored in the private `ecodna-evidence` bucket.
- Report JSON stores only the evidence object path.
- Rejected observations remain stored for audit purposes but never enter dashboard intelligence.
- The bundled demo dataset is visible to everyone. Reviewers can persist/refresh it in Supabase without deleting field reports.

## Sharing this project

Generated folders such as `node_modules` and `.next` are not required. The recipient recreates them with `npm install` and `npm run dev`.

For a simple teammate walkthrough after downloading the ZIP, see `TEAMMATE_SETUP.md`.

Do not commit `.env.local`. Share required credentials separately through a private channel. The Supabase service-role key grants elevated database access and must never appear in browser code or a public repository.

## Important interpretation limits

- `likelyMaterial` is a visual inference, not chemical identification.
- Unknown is preferable to an unsupported guess.
- Hotspot rankings reflect observed reports and survey effort; they are not population-normalized waste rates.
- Demo/sample observations are for demonstrating the workflow, not field evidence.
