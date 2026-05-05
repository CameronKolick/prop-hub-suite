# Operations Runbook — prop-hub-suite

**Purpose.** Everything the on-call engineer needs to operate the app: how to deploy, how to roll back, how to rotate secrets, where the dashboards live, and what to do when things break. This file is a **stub** — fill in each section as the Google Cloud infrastructure is stood up.

**Audience.** Whoever is on-call (infra engineer today, founder + team later).

---

## 1. Environments

| Env | URL | Purpose | Who can push |
|---|---|---|---|
| local | http://localhost:8080 | dev | everyone |
| dev | _TBD_ | shared preview | infra + core devs |
| staging | _TBD_ | pre-prod smoke | infra + core devs |
| prod | _TBD_ | customer-facing | infra lead, via PR merge to `main` |

## 2. Deploy

### Web app (Vite bundle)

1. _Hosting platform TBD — Firebase Hosting or Cloud Run._
2. Deploy command: `_TBD_`
3. Deploy duration: _TBD_
4. Rollback command: `_TBD_` (see section 5)
5. Environment variables set at build time: see `.env.example`.

### Cloud Run API

1. Build: `_TBD_` (Dockerfile path, Cloud Build trigger)
2. Deploy: `gcloud run deploy ...` — full command TBD
3. The API must pass health check at `GET /healthz` within 60s of rollout.

### Mobile (Expo) — not yet built

- Builds via `eas build --platform ios` / `--platform android`
- Submission to app stores: TBD

## 3. Database migrations (Cloud SQL)

- Schema source of truth: _migrations directory TBD_
- Apply: `_TBD_` (sqitch? prisma migrate? hand-rolled?)
- Always apply to dev first, wait for green smoke test, then promote.
- Destructive changes (drop column, rename table): require a two-step deploy with a column-add / backfill / code-switch / column-drop sequence. Never drop a column in the same deploy as the code that stopped using it.

## 4. Secret rotation

Secrets live in **Google Secret Manager**. Never in `.env` files committed to git. Never in code. Never shared in Slack / email / tickets.

| Secret | Location | Consumers | Rotation cadence |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Secret Manager | Cloud Run API | 90 days or on suspected leak |
| `DB_APP_USER_PASSWORD` | Secret Manager | Cloud Run API | 180 days |
| _etc._ | | | |

**Rotation procedure:**

1. Generate new secret value (vendor console or `openssl rand`).
2. Create new version in Secret Manager: `gcloud secrets versions add <name> --data-file=-`.
3. Redeploy services that consume the secret (Cloud Run reads from Secret Manager on cold start).
4. Verify health check + a sample request against the new version.
5. Disable the old version: `gcloud secrets versions disable <name> <old-version>`.
6. Leave the old version disabled (not deleted) for 7 days, then destroy.

## 5. Rollback

### Web app
- Command: `_TBD_` (previous revision via hosting provider)
- Time to rollback: target < 2 minutes

### Cloud Run API
- `gcloud run services update-traffic <service> --to-revisions <prev-revision>=100`
- The previous 3 revisions are always retained.

### Database
- Schema changes are NOT rolled back by code rollback. If a migration caused the incident:
  1. Pause traffic via feature flag / maintenance page if customer-impacting.
  2. Apply a down-migration or a fix-forward migration — do not restore from backup unless data is genuinely lost.
  3. Cloud SQL automated backups run every 24h; point-in-time recovery is enabled. Restore procedure: _TBD_.

## 6. On-call

- **Primary rotation:** _TBD_
- **Escalation:** infra lead → founder
- **PagerDuty / Opsgenie / manual:** _TBD_

## 7. Observability

- **Logs:** Cloud Logging. Filter by service name. _URL TBD_
- **Metrics:** Cloud Monitoring. Dashboards: _URLs TBD_
- **Error tracking:** _Sentry? TBD_
- **Alerts:** documented in Cloud Monitoring. Current alerts: _TBD_

## 8. Common incidents

### "The whole site is 500ing"

1. Check Cloud Run service status: `gcloud run services describe <service>`.
2. Check last deploy time against incident start time — if recent, roll back (section 5).
3. Check Cloud SQL health: connections, CPU, disk.
4. Check Secret Manager — did any secret rotation kill auth to a dep?

### "AI workflows are hanging"

1. Check Anthropic API status: https://status.anthropic.com
2. Check `ANTHROPIC_API_KEY` is valid and not rate-limited.
3. Check Cloud Run logs for the `/llm/complete` endpoint.
4. The workflow engine has per-step timeouts; a hung step should fail the run after _TBD_ seconds.

### "A user can't log in"

1. Check Firebase Auth console for the user.
2. Check `users` table in Cloud SQL — the user row must exist with a valid `role`.
3. Expired ID token? User should re-login.

## 9. Known issues

See `docs/INFRA_SPEC.md` section 0 for the pre-existing CI failure context.

## 10. Access

- GCP project: _TBD_
- Firebase project: _TBD_
- GitHub repo: https://github.com/CameronKolick/prop-hub-suite
- Grant access via _TBD_ (IAM roles for GCP; GitHub team for repo).

---

_Last updated: the day this was created. Keep this file current — treat updating it as part of finishing any infra change._
