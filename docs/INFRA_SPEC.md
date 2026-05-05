# Infrastructure Spec — prop-hub-suite

**Audience:** the engineer/contractor building the Google Cloud backend.
**Goal:** replace the legacy Supabase backend with a Google Cloud stack, with zero changes to workflow engine or UI code.
**Source of truth:** this document plus the TypeScript interfaces in `src/lib/data/contracts.ts` and `src/lib/auth/contracts.ts`.

---

## 0. Known issues — read first

**CI has been failing since before the migration work started.** Every recent commit on `main` shows a red X on `.github/workflows/ci.yml`. The immediate failure is at the `Install dependencies` (`npm ci`) step — `package-lock.json` is out of sync with `package.json` (notably after `lovable-tagger` was removed, the lockfile wasn't regenerated). There may be additional pre-existing failures behind that one.

**Part of your onboarding is getting CI green again.** Expected steps:

1. `npm install` locally to regenerate `package-lock.json`; commit the updated lock.
2. Re-run CI and iterate on whatever surfaces next — likely some combination of typecheck errors, lint errors, or Playwright smoke tests that haven't been maintained.
3. If any CI steps are unmaintained and not worth fixing right now, remove them from `.github/workflows/ci.yml` rather than letting them stay broken. Better to have a smaller CI that's honestly green.

**Do not** merge new work on top of a broken CI long-term — we want a clean green baseline before layering real infra changes.

---

## 1. Context in one paragraph

prop-hub-suite is a property-management + house-watching app. It was built on Supabase and is being migrated to Google Cloud. New work is organized around an **AI workflow engine** that runs role-specific guided flows (e.g., a house watcher completing a check). The engine, the UI, and the mobile app all talk to the backend through two TypeScript interfaces — `DataClient` and `AuthClient`. Your job is to implement those interfaces on top of Google services. The app already runs today against a mock in-memory implementation of both.

## 2. The picture, end to end

```
┌─────────────────────┐     ┌─────────────────────┐
│  Web app (Vite +    │     │  Mobile app (Expo / │
│  React)             │     │  React Native) *    │
└──────────┬──────────┘     └──────────┬──────────┘
           │                            │
           └──────────────┬─────────────┘
                          │
                          ▼
           ┌──────────────────────────────┐
           │  Workflow engine + DataClient │
           │  + AuthClient interfaces       │
           │  (src/lib/**)                  │
           └──────────────┬───────────────┘
                          │
           ┌──────────────┴──────────────────┐
           │ swap-point: today uses mock     │
           │ clients; you implement Google   │
           │ Cloud-backed clients here       │
           └──────────────┬──────────────────┘
                          │
     ┌────────────────────┼─────────────────────┐
     │                    │                     │
     ▼                    ▼                     ▼
Firebase Auth       Cloud Run API       Cloud Storage
                    (Node/TS)                (GCS)
                         │
                         ▼
                   Cloud SQL (Postgres)
                         │
                         ▼
                   Secret Manager
                         │
                         ▼
                   Claude API (Anthropic)
```

\* Mobile app exists as a plan, not yet as code. It will share the same `DataClient` + `AuthClient`.

## 3. The contract you must implement

There are two TypeScript interfaces you must implement. Everything else in the codebase is already wired to use them.

### 3.1 `DataClient` — `src/lib/data/contracts.ts`

```ts
export interface DataClient {
  readonly properties: PropertiesRepo;
  readonly houseWatchers: HouseWatchersRepo;
  readonly checkTemplates: CheckTemplatesRepo;
  readonly checkSessions: CheckSessionsRepo;
  readonly checkResponses: CheckResponsesRepo;
  readonly photos: PhotosRepo;
  readonly workflowRuns: WorkflowRunsRepo;
}
```

Each repo is a small set of async methods. Read [`contracts.ts`](../src/lib/data/contracts.ts) for the full signatures. Read [`types.ts`](../src/lib/data/types.ts) for the domain types.

Your implementation lives at `src/lib/data/google/googleClient.ts` and gets registered in `src/lib/data/index.ts` under a new `case "google"` branch. Selection is driven by the env var `VITE_DATA_BACKEND=google`.

**Important:** the existing Supabase code under `src/integrations/supabase/` and every current page that imports from it stays in place during the migration. Your `DataClient` implementation is additive. Don't delete Supabase code — the product team will migrate pages off it one by one.

### 3.2 `AuthClient` — `src/lib/auth/contracts.ts`

```ts
export interface AuthClient {
  getState(): AuthState;
  subscribe(listener: AuthListener): () => void;
  signInAsRole(role: Role): Promise<AuthUser>;
  signOut(): Promise<void>;
}
```

Note: `signInAsRole` is a dev-only method used by the mock auth client for previewing any role. Your Firebase implementation replaces it with real sign-in. The exact auth method(s) to support are in section 5.

Your implementation lives at `src/lib/auth/firebase/firebaseAuthClient.ts`, registered in `src/lib/auth/index.ts` under `case "firebase"`.

## 4. Google Cloud services to stand up

| Concern             | Service                            | Purpose                                                    |
| ------------------- | ---------------------------------- | ---------------------------------------------------------- |
| Database            | Cloud SQL for Postgres (v15+)      | Primary data store. Relational. Private IP preferred.      |
| Auth                | Firebase Auth                      | Email/password + Google sign-in (see section 5)            |
| API                 | Cloud Run (Node 20+ container, TS) | Hosts all reads/writes + AI calls. Public HTTPS endpoint.  |
| File storage        | Cloud Storage (GCS)                | Photos, documents. Signed-URL uploads.                     |
| Secrets             | Secret Manager                     | Claude API key, DB creds, any third-party keys             |
| Web hosting         | Cloud Run or Firebase Hosting      | Serves the built Vite bundle                               |
| AI inference        | Anthropic Claude API (external)    | Workflow LLM steps. Called from the Cloud Run API only.    |
| Observability       | Cloud Logging + Cloud Monitoring   | Standard; alert on 5xx + DB latency                        |
| CI/CD               | GitHub Actions or Cloud Build      | Build → deploy Cloud Run on merge to main                  |

Single GCP project is fine to start. Multi-env (dev/staging/prod) recommended but not required for v1.

## 5. Auth requirements

- **Methods:** email/password at minimum; add "Sign in with Google" if low-effort.
- **Roles:** every user has exactly one role from this enum: `admin | property_manager | owner_investor | tenant | house_watcher`.
- **Role storage:** keep a `users` table in Cloud SQL with `id (pk, matches Firebase uid)`, `email`, `display_name`, `role`. Firebase Auth owns credentials; Cloud SQL owns application identity.
- **Session:** the Cloud Run API validates the Firebase ID token on every request. Extract `uid`, look up `role` from the `users` table. Cache the lookup with a short TTL (60s) to avoid a round-trip per call.
- **Password reset + email verification:** use Firebase built-ins, no custom flow.

## 6. Database schema (v1)

Only these tables are needed for the first workflow (house check). The full legacy Supabase schema (~90 tables) does NOT need to be ported up front. New tables get added as new workflows land.

```sql
-- identity
users (
  id             text primary key,           -- Firebase uid
  email          text not null unique,
  display_name   text,
  role           text not null check (role in (
                   'admin','property_manager','owner_investor',
                   'tenant','house_watcher'
                 )),
  created_at     timestamptz not null default now()
);

-- properties
properties (
  id                          text primary key,
  address                     text not null,
  city                        text not null,
  state                       text not null,
  postal_code                 text not null,
  owner_id                    text not null,
  assigned_house_watcher_id   text,
  notes                       text,
  created_at                  timestamptz not null default now()
);

-- house watchers
house_watchers (
  id            text primary key,
  user_id       text not null references users(id),
  display_name  text not null,
  email         text not null
);

-- check templates
check_templates (
  id           text primary key,
  name         text not null,
  description  text
);

check_template_sections (
  id           text primary key,
  template_id  text not null references check_templates(id) on delete cascade,
  name         text not null,
  "order"      int not null
);

check_template_items (
  id             text primary key,
  section_id     text not null references check_template_sections(id) on delete cascade,
  prompt         text not null,
  "order"        int not null,
  required       boolean not null default false,
  allows_photo   boolean not null default true,
  allows_note    boolean not null default true
);

-- check sessions
check_sessions (
  id                 text primary key,
  property_id        text not null references properties(id),
  template_id        text not null references check_templates(id),
  house_watcher_id   text not null references house_watchers(id),
  status             text not null check (status in ('scheduled','in_progress','completed','cancelled')),
  scheduled_for      timestamptz not null,
  started_at         timestamptz,
  completed_at       timestamptz,
  summary            text
);

check_item_responses (
  id           text primary key,
  session_id   text not null references check_sessions(id) on delete cascade,
  item_id      text not null references check_template_items(id),
  value        jsonb not null,                 -- {kind:'boolean'|'text'|'skipped', value?:...}
  note         text,
  photo_ids    text[] not null default '{}',
  answered_at  timestamptz not null default now()
);

-- photos
photos (
  id           text primary key,
  session_id   text not null references check_sessions(id) on delete cascade,
  item_id      text references check_template_items(id),
  url          text not null,                  -- GCS URL (signed or public)
  captured_at  timestamptz not null default now()
);

-- workflow runs (state persistence for the engine)
workflow_runs (
  id              text primary key,
  workflow_id     text not null,
  user_id         text not null references users(id),
  status          text not null check (status in (
                    'pending','running','awaiting_input','completed','failed','cancelled'
                  )),
  current_step_id text,
  state           jsonb not null default '{}',
  started_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz,
  error           text
);
```

Primary keys are `text` so the API can generate prefixed IDs like `prop_abc123` that are easy to recognize in logs. Matches the mock client's format.

## 7. Authorization rules

The API layer enforces these (there is no reliance on database-level RLS). Every request carries a Firebase ID token; the server extracts `uid` + `role` and applies:

| Operation                                    | Who may call                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `properties.listForHouseWatcher(hwId)`        | admin, or the house_watcher whose record has matching `user_id`             |
| `properties.get(id)`                          | admin, property_manager, assigned house_watcher, or the owner               |
| `houseWatchers.getByUserId(userId)`           | admin, or the watcher themselves                                            |
| `checkTemplates.*`                            | any authenticated user                                                      |
| `checkSessions.listForHouseWatcher(hwId)`     | admin, or the watcher whose record matches                                  |
| `checkSessions.get(id)`                       | admin, the assigned watcher, or the property's owner                         |
| `checkSessions.create(...)`                   | admin, or a house_watcher creating a session for themselves                 |
| `checkSessions.updateStatus(id, ...)`         | admin, or the assigned watcher                                              |
| `checkResponses.upsert(...)`                  | admin, or the assigned watcher for that session                             |
| `checkResponses.listForSession(sessionId)`    | admin, the assigned watcher, or the property's owner                        |
| `photos.upload(...)`                          | admin, or the assigned watcher for that session                             |
| `photos.listForSession(sessionId)`            | admin, the assigned watcher, or the property's owner                        |
| `workflowRuns.*`                              | admin, or the user whose `user_id` matches the run                          |

Reject with HTTP 403 (and a structured error body) on mismatch.

## 8. File storage

- Single bucket: `prop-hub-photos-<env>` (e.g., `prop-hub-photos-prod`).
- Uniform bucket-level access ON. No public objects.
- Uploads happen through signed PUT URLs issued by the API — the client never gets the bucket service account's key.
- Reads happen through signed GET URLs issued per request (short TTL, e.g., 10 minutes). The `Photo.url` column stores either the object path or a signed URL — your choice, just be consistent.
- Max object size 20 MB. Content-type must be `image/jpeg` or `image/png`.

## 9. AI / Claude API

- The workflow engine calls `LlmClient.complete(...)` — see `src/lib/ai/workflows/llm/contracts.ts`.
- In production, the Cloud Run API exposes an endpoint like `POST /llm/complete` that takes the same shape and forwards to Anthropic.
- **Do not** let the browser hit Anthropic directly. The API key stays in Secret Manager and only the Cloud Run service can read it.
- Default model: `claude-opus-4-7` (the direct-Anthropic client in `src/lib/ai/workflows/llm/claude.ts` is what your Cloud Run endpoint should mimic behaviorally, then be pointed at via a new `ClaudeViaApiClient` that calls your endpoint instead of Anthropic).

## 10. Migration strategy

1. Stand up the Google stack in parallel — Supabase stays live the whole time.
2. Implement `GoogleDataClient` + `FirebaseAuthClient` against the interfaces.
3. Seed Cloud SQL with a handful of test rows matching `src/lib/data/mock/seed.ts` so workflow code behaves identically.
4. Flip `VITE_DATA_BACKEND=google` and `VITE_AUTH_BACKEND=firebase` in a dev build. Run the `/workflows-demo` page (zero legacy code involved) end-to-end. This is your smoke test.
5. Migrate legacy pages off Supabase one feature at a time. Each migration is "replace `supabase.from('x')...` calls with `getDataClient().x.method(...)`" and requires adding methods to the `DataClient` interface + Google implementation as needed.
6. Once all pages are migrated, delete `src/integrations/supabase/` and remove the Supabase npm dependencies.

**Do not rush step 5.** The product direction is to refactor pages into **workflow runners** over time, not to clone the legacy Supabase code shape onto Google. Many of the 90 legacy tables will not be reimplemented — they'll be replaced by new entities that match new workflows.

## 11. Out of scope for v1

Explicitly NOT required in the first iteration:

- Realtime subscriptions (the legacy Supabase Realtime channels). If a workflow needs live updates, we'll add polling first and WebSockets later via a separate service.
- Row-Level Security at the database layer. Authorization lives in the Cloud Run API.
- Audit logging beyond Cloud Logging of requests. A dedicated audit table can come later.
- Stripe / payments, messaging, vendor portal. These legacy features keep using Supabase until they're rebuilt as workflows.

## 12. Deliverables checklist

When you're done, the following should be true:

- [ ] **CI (`.github/workflows/ci.yml`) is green on `main`.** See section 0 for context.
- [ ] `src/lib/data/google/googleClient.ts` exists and implements `DataClient`.
- [ ] `src/lib/auth/firebase/firebaseAuthClient.ts` exists and implements `AuthClient`.
- [ ] `src/lib/data/index.ts` has a `case "google"` branch; `src/lib/auth/index.ts` has a `case "firebase"` branch.
- [ ] A Cloud Run service is deployed with endpoints covering every method on the `DataClient` interface plus `POST /llm/complete`.
- [ ] Cloud SQL schema from section 6 is migrated and seeded.
- [ ] Firebase Auth is configured for email/password.
- [ ] GCS bucket with signed-URL uploads works end-to-end.
- [ ] Setting `VITE_DATA_BACKEND=google`, `VITE_AUTH_BACKEND=firebase`, and `VITE_LLM_BACKEND=claude-via-api` (or equivalent) makes `/workflows-demo` run end-to-end against the real backend.
- [ ] A short `docs/RUNBOOK.md` explains how to deploy, roll back, and rotate secrets.

## 13. Contact points in the codebase

Start here, in this order:

1. `src/lib/data/types.ts` — domain types
2. `src/lib/data/contracts.ts` — the interface you implement
3. `src/lib/data/mock/mockClient.ts` — reference implementation (behavior spec)
4. `src/lib/auth/contracts.ts` — auth interface
5. `src/lib/auth/mock/mockAuthClient.ts` — reference
6. `src/lib/ai/workflows/runner.ts` — shows how the engine calls the DataClient
7. `src/lib/ai/workflows/schemas/houseCheck.ts` — a real workflow definition
8. `src/pages/WorkflowsDemo.tsx` — the page that ties it all together

## 14. Questions you should ask before starting

If these don't have clear answers yet, raise them before writing code:

- Which GCP project/org do we deploy into?
- What's the deploy environment split (dev only? dev + prod?)?
- Who owns the GitHub repo and can grant Cloud Build / Actions access?
- Is there a budget cap / billing alert policy we need to respect?
- Are there any compliance requirements (HIPAA, PCI, SOC2) that affect storage or logging?
- What's the expected launch date and rough user count for capacity planning?
