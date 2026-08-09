# EcoDNA Frontend Handoff

## Purpose

EcoDNA turns a litter photo into a structured, human-verified observation and then into area-level environmental intelligence:

**Reporter account → photo → Gemini Vision → standardized verification → GPS → reviewer decision → rewards + Waste DNA → Action Center**

The frontend can be redesigned freely, but it must preserve the role rules, API contracts, and data meaning below.

## Product principles that must not change

- Gemini Vision analysis stays server-side. Never expose `GEMINI_API_KEY` in the browser.
- Category, packaging type, and likely material must use standard dropdown values. Users must not type arbitrary values for those fields.
- Brand is editable/free text; use `Unknown` where appropriate.
- `likelyMaterial` is a visual estimate, not chemical identification.
- Unknown is better than a confident-looking guess.
- A field observation is excluded from Waste DNA, hotspot rankings, trends, and Action Center until a reviewer approves it.
- Evidence and reporter provenance should remain visible to reviewers.

## User roles and navigation

| User state | Can see | Can do |
| --- | --- | --- |
| Visitor (not signed in) | Dashboard, map, Action Center, demo data | Explore data; open account/sign-in UI. Cannot upload or submit. |
| Reporter | Everything visitors see, Scan Waste, My Rewards | Register/sign in, upload a photo, verify AI output, choose GPS/manual pin, submit a report, see own points and report states. |
| Reviewer | Dashboard, review queue, audit history, Action Center deployment controls | Sign in, inspect private evidence, correct metadata, approve/reject reports, load demo data, reset reports, deploy interventions. Reviewers cannot submit reports. |

Main navigation currently contains:

- Scan Waste
- Waste DNA Dashboard
- Action Center
- My Rewards (reporter only)

## Screens and components to build

### 1. Account entry

Provide a combined account area with two modes:

- **Sign in:** email + password.
- **Create reporter account:** username + email + password + password confirmation.

Registration requirements:

- Username: 3–24 characters; lowercase letters, numbers, underscores only.
- Password: minimum 8 characters.
- Reviewer role must never be selectable in registration. It is assigned by an administrator in Supabase.

Show server errors inline, especially the Supabase migration/configuration message, duplicate username, duplicate email, and invalid credentials.

After a successful sign-in/registration, show a compact identity badge: `@username`, role, and reporter point total.

### 2. Reporter scan/submission flow

This is a multi-step flow and should make the reviewer gate clear:

1. Capture/upload an image (`image/*`, phone camera supported).
2. Send it to `POST /api/analyze` as multipart field `image`.
3. Present all detected items in editable cards.
4. Require the reporter to verify the standardized values before submitting.
5. Capture GPS or let the user place a manual map pin.
6. Collect an optional, recommended location/place name.
7. Compress/upload a JPEG evidence thumbnail to `POST /api/evidence`.
8. Submit the report through `POST /api/reports`.
9. Confirm the report is **pending reviewer approval**, not yet included in intelligence or rewards.

Per-item editor fields:

- Brand: editable text.
- Category: taxonomy dropdown.
- Packaging type: taxonomy dropdown.
- Likely material: taxonomy dropdown.
- AI confidence: display-only percentage.
- Add/remove item controls.

Essential UX states:

- No image selected.
- AI analyzing.
- No clear discarded packaging found.
- GPS permission denied/unavailable.
- Manual pin selected.
- Evidence upload in progress.
- Submission saved/pending.
- Unauthorized reporter submission: prompt sign-in.

### 3. Waste DNA dashboard

The dashboard answer should remain: **What is the problem? Where is it? How significant is it? What should we do?**

Required sections:

- Filter panel: area, category, packaging, likely material, source (field/demo), date range.
- Export controls: observations CSV, observations JSON, hotspots CSV.
- KPI cards: confirmed reports, waste items, dominant material, hotspot signal.
- Hotspot ranking: report density, item count, dominant stream, transparent priority score.
- Area profile: waste DNA, report/item totals, material share, recommended response.
- Material composition chart.
- Packaging chart.
- Product category and verified-brand summaries.
- Waste map.
- Data quality information and confidence/duplicate/missing-place/out-of-bounds flags.
- Time trend chart.

Approved reports drive all dashboard intelligence. Pending reports should show a visible count/notice but remain excluded from charts, hotspot ranking, map intelligence, trends, and recommendations.

### 4. Map behavior

Render approved observations as map markers. Support the existing marker filters:

- All markers.
- High-confidence only.
- Low-confidence only.

Use red markers for observations needing attention/quality review; use teal for those that pass quality checks. Markers should show location name, report timestamp, item summary, source, and relevant quality state in a popup/card.

### 5. Reviewer queue and audit history

Reviewer-only UI. A pending report should show:

- Location name, timestamp, coordinates, reporter username, source.
- Quality flags.
- Private evidence photo using `GET /api/evidence?path=...`.
- Correctable location name/latitude/longitude.
- Correctable brand/category/packaging/likely material for every item.
- Reviewer note/rejection reason.
- Approve and reject actions.

Show the reward outcome before approval:

- Average AI confidence at least 80%: **10 points if approved**.
- Low confidence: **No points — low AI confidence**.

Audit history lists the reviewer decision, reviewer email, timestamp, note, and correction summary.

### 6. My Rewards (reporter only)

Show the reporter:

- Username and current point total.
- Current tier: Eco Starter (0), Eco Scout (50), Waste Guardian (150), City Champion (300).
- Progress to the next tier.
- Submitted, awaiting review, approved, and rejected counts.
- Rules: an approved report earns 10 points only when its average AI confidence is at least 80%; low-confidence, pending, or rejected reports earn 0.
- Fairness note: points are non-monetary hackathon recognition; reviewers are separate from reporters; one report cannot earn twice.

### 7. Action Center

The Action Center uses approved hotspot data. It must keep three selectable action paths for a chosen hotspot:

1. Deploy targeted equipment.
2. Improve collection and behavior.
3. Validate and measure.

Each option needs a clear “View detailed plan” state. The detail view should include why the action fits the local Waste DNA, implementation steps, measures to track, and reviewer-only intervention deployment controls.

Action recommendations should remain evidence-aware: a permanent machine should not be recommended until there are sufficient reports/items and a concentrated material stream.

## Reward rules (source of truth)

| Condition | Points |
| --- | ---: |
| Pending report | 0 |
| Rejected report | 0 |
| Approved report, average AI confidence below 80% | 0 |
| Approved report, average AI confidence 80% or above | 10 |
| Demo report or old report without reporter ownership | 0 |

The 80% value is the average of all item `confidence` values in one report. The reviewer decision is still mandatory; confidence does not auto-approve a report.

## Data contracts

### Session object

Returned by `GET /api/auth/session` when signed in:

```ts
type AuthSession = {
  id: string;
  email: string;
  username: string;
  role: "reporter" | "reviewer";
  rewardPoints: number;
};
```

### Waste report

```ts
type WasteItem = {
  id: string;
  brand: string;
  category: string;
  packagingType: string;
  likelyMaterial: string;
  confidence: number; // 0–1
};

type WasteReport = {
  id: string;
  createdAt: string; // ISO date
  reporterId?: string;
  reporterUsername?: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  imagePath?: string;
  source?: "field" | "demo";
  reviewStatus?: "approved" | "rejected"; // undefined means pending
  reviewedAt?: string;
  reviewHistory?: ReviewAuditEntry[];
  items: WasteItem[];
};
```

The client may display `reporterId` only for the signed-in reporter’s own reports or a reviewer. Do not rely on a client-supplied reporter ID; the server attaches ownership on submission.

### Intervention

```ts
type Intervention = {
  id: string;
  areaKey: string;
  areaName: string;
  option: string;
  deployedAt: string; // YYYY-MM-DD
  createdAt: string;
};
```

## API contract

All API routes are same-origin. Server errors return `{ error: string }`.

| Endpoint | Method | Request | Response / frontend use |
| --- | --- | --- |
| `/api/auth/register` | POST | `{ username, email, password }` | Creates reporter account and normally signs in. Handle `201`, `400`, `409`, `502`, `503`. |
| `/api/auth/login` | POST | `{ email, password }` | Sets HTTP-only session cookie. |
| `/api/auth/logout` | POST | none | Clears session cookie. |
| `/api/auth/session` | GET | none | `{ session }`; `401` when signed out. |
| `/api/analyze` | POST | `FormData` with `image` | `{ items }`; image must be <=8 MB. |
| `/api/evidence` | POST | `FormData` with JPEG `evidence`, `reportId` | Reporter only. Returns `{ path }`; JPEG must be <=1 MB. |
| `/api/evidence?path=...` | GET | evidence path query | Reviewer only. Returns JPEG bytes. |
| `/api/reports` | GET | none | `{ reports, storage }`; refresh every 30 seconds. |
| `/api/reports` | POST | `{ report }` | Reporter only. Server forces it to a pending field report and attaches reporter ownership. |
| `/api/reports` | PUT | `{ reports }` | Reviewer only. Used by current review workflow; preserve the whole report collection. |
| `/api/reports` | DELETE | none | Reviewer only; clears observations but preserves earned reward history. |
| `/api/interventions` | GET | none | `{ interventions }`. |
| `/api/interventions` | POST | `{ intervention }` | Reviewer only; creates/updates deployment record. |

## Refresh and optimistic UI

- Fetch `/api/auth/session` and `/api/reports` on app load.
- Refresh reports and session every 30 seconds.
- Refresh immediately after sign-in, sign-out, report submission, reviewer decision, demo load, reset, or intervention deployment.
- Use a visible but non-blocking status area for save/error feedback.
- Do not optimistically show a submitted report as approved or rewarded; wait for reviewer action and refreshed data.

## Required backend configuration

The frontend should surface a helpful setup message if registration returns a `503`. Reporter accounts/rewards require the Supabase migration in:

- `supabase/reporter_rewards_migration.sql` (focused upgrade for an existing project)
- `supabase/ecodna_reports.sql` (complete project schema)

The frontend must never contain the Supabase service-role key. It is server-only.

## Existing implementation locations

- App shell, account UI, tabs, and rewards: `components/EcoDNAApp.tsx`
- Scan and report submission: `components/Scanner.tsx`
- Dashboard, review queue, and Action Center: `components/Dashboard.tsx`
- Map: `components/MapPanel.tsx`
- Types: `lib/types.ts`
- Confidence and reward eligibility: `lib/dataQuality.ts`, `lib/rewards.ts`
- API routes: `app/api/**`

