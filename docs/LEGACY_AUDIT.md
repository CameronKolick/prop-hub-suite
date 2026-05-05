# Legacy Code Audit — prop-hub-suite

**Purpose.** This document evaluates every legacy module in the app and classifies it into one of four buckets so we know what to migrate, what to rewrite, and what to delete. It is the companion to `INFRA_SPEC.md`: that document tells the infra engineer *how* to stand up the new backend; this one tells the product team *which legacy screens* are worth wiring to it.

**Audience.** Founder, infra engineer, any future contractor touching the legacy code.

**Date.** Audit performed against the codebase as of the commit that introduced the AI workflow engine (`b4943bf`).

---

## Classification key

| Tag | Meaning |
|---|---|
| **KEEP** | Works well enough; migrate to the new `DataClient` without a redesign. |
| **REWRITE** | The screen represents a real feature we need, but the current implementation is too tangled to salvage. Rebuild as a workflow or a lean new component on top of `DataClient`. |
| **REPLACE** | The feature should exist, but in a fundamentally different shape — typically as an AI workflow rather than a page. The legacy screen is not a blueprint. |
| **KILL** | Dead, mocked, or redundant. Delete once dependencies are cut. |

---

## Cross-cutting findings

These apply to nearly every legacy module. They're not listed per-module below — treat them as the default assumption.

1. **Direct Supabase calls scattered in components.** Pages call `supabase.from('x')` inline rather than going through a data layer. This is *exactly* what the new `DataClient` interface fixes — but only if new work replaces these calls, it doesn't fix them automatically.
2. **Gigantic pages.** Several files exceed 700 LOC ([Properties.tsx](src/pages/Properties.tsx) 787, [PropertyDetail.tsx](src/pages/PropertyDetail.tsx) 784, [Maintenance.tsx](src/pages/Maintenance.tsx) 900+, [UserManagement.tsx](src/pages/UserManagement.tsx) 855, [EnterprisePropertyDetails](src/components/EnterprisePropertyDetails.tsx) 991). Business logic, data fetching, state, and UI are all co-located.
3. **Ad-hoc role gating.** Inline checks like `if (userRole !== 'house_watcher')` sprinkled through render functions. The `RoleBasedAccess` guard exists but isn't consistently used below the route level.
4. **Mobile as thin wrapper.** Most "mobile" variants (e.g., [PropertyManagerMobileDashboard.tsx](src/pages/dashboards/PropertyManagerMobileDashboard.tsx)) duplicate desktop queries with a narrower UI. There's no genuinely different *workflow* for a mobile-only role, which is exactly the gap the new workflow engine + Expo app will close.
5. **AI appears in two very different states.** The AI service layer ([src/lib/ai/aiService.ts](src/lib/ai/aiService.ts) + [src/integrations/ai/client.ts](src/integrations/ai/client.ts)) is actually decent — centralized, cached, circuit-broken. The AI *components* that call it ([PropertyAssistant](src/components/ai/PropertyAssistant.tsx), [MaintenanceTriage](src/components/ai/MaintenanceTriage.tsx), etc.) are one-off screen features that should become workflow steps, not dialogs.
6. **Two realtime strategies fighting.** Messaging uses custom `supabase.channel()` subscriptions; most other features poll via react-query. No unified real-time story.
7. **Mock data in production paths.** The entire [Client Portal](src/pages/ClientPortal/) renders hardcoded demo data and is effectively non-functional. [Finances.tsx](src/pages/Finances.tsx) also uses mock transactions.

---

## Module-by-module verdicts

### Authentication & Setup — **KEEP (for now)**

[src/pages/Auth.tsx](src/pages/Auth.tsx), [src/pages/Setup.tsx](src/pages/Setup.tsx)

Currently uses Supabase Auth directly. Small footprint, works. Will be replaced when Firebase Auth lands via the `AuthClient` interface — at that point these pages get a 1-file swap, not a rewrite. **No action until infra migration.**

---

### Dashboards (all 7 variants) — **REPLACE**

Desktop hubs: [PropertyManagerHub](src/pages/dashboards/PropertyManagerHub.tsx), [PropertyOwnerHub](src/pages/dashboards/PropertyOwnerHub.tsx), [TenantHub](src/pages/dashboards/TenantHub.tsx), [HouseWatcherHub](src/pages/dashboards/HouseWatcherHub.tsx). Plus mobile variants, plus an admin dashboard.

**Why replace, not rewrite:** These are *widget dashboards* (metrics, recent activity, pending actions). The product direction is **AI-led workflows that tell the user what to do next**, not dashboards the user has to interpret. A property manager's "dashboard" becomes *"You have 3 maintenance requests that need a vendor assigned. Let's start with the urgent one — tap to triage."* — which is a workflow runner, not a widget grid.

**What to build:** one `RoleHome` component per role, which renders the highest-priority workflow(s) for that role. Widgets only as a secondary scroll-down view.

**Disposition of legacy code:** KILL the mobile variants outright. Keep desktop hubs alive until the workflow-driven home exists, then delete.

---

### Maintenance — **REPLACE** (high priority)

[src/pages/Maintenance.tsx](src/pages/Maintenance.tsx) (900+ LOC) + [MaintenanceTriage.tsx](src/components/ai/MaintenanceTriage.tsx) + [maintenance-triage edge function](supabase/functions/maintenance-triage/index.ts).

The existing flow: tenant submits a request → PM opens a giant list → clicks a request → opens a dialog → clicks "AI Triage" → reads a suggestion → manually assigns vendor. Too many steps, too much screen.

**What it should become:** a *Maintenance Triage workflow*. Trigger: new request arrives. Steps: AI reads request (+ optional photos) → classifies priority/category/cost estimate → proposes vendor from a shortlist → PM taps approve → vendor notified → request moves to "assigned." End-to-end = 2 taps for the 80% case, full review path for the 20%.

**Why this is the right next workflow to build:** you already have the legacy component, the triage prompts, and the edge function. Converting to a workflow is a *compression* of existing logic, not an invention. Good demo piece.

**Legacy cleanup:** once the workflow exists, delete the page. The listing view can live as a secondary screen under "all requests" if needed.

---

### Messaging / Inbox / Communications — **REWRITE** (medium priority)

[src/pages/Messages.tsx](src/pages/Messages.tsx), [CommunicationHub.tsx](src/components/communication/CommunicationHub.tsx) (588 LOC), [RealTimeMessagingSystem.tsx](src/components/messaging/RealTimeMessagingSystem.tsx) (548 LOC), plus [MessageView](src/components/inbox/MessageView.tsx) (631 LOC) and 8 message-related tables.

**Why rewrite, not replace:** messaging is a real, ongoing feature (tenants need to talk to PMs, PMs need to talk to owners). It is *not* a guided workflow — it's a chat. But the current implementation has two competing systems (CommunicationHub vs. RealTimeMessagingSystem), inline Supabase channel subscriptions, and monolithic components. The data model is over-rich (typing indicators, reactions, mentions, scheduled messages, encryption keys) for a feature nobody is using yet at scale.

**Target:** a thin inbox built on the `DataClient` interface, with realtime delivered by a new `MessagesRepo.subscribe()` method. Kill the 8-table data model — reduce to 3 tables (`conversations`, `messages`, `message_participants`). Drop reactions, mentions, typing indicators, scheduled messages, encryption, templates, and analytics until there's a real user demand for any of them.

**Why not urgent:** the core money-making workflows (PM onboarding, maintenance, house checks) don't depend on rich messaging. Email / SMS notifications through edge functions cover the critical path. Revisit when we have paying customers asking for in-app chat.

---

### Properties (listing + detail pages) — **REWRITE**

[Properties.tsx](src/pages/Properties.tsx) (787 LOC), [PropertyDetail.tsx](src/pages/PropertyDetail.tsx) (784 LOC), [EnterprisePropertyDetails.tsx](src/components/EnterprisePropertyDetails.tsx) (991 LOC), [AddPropertyDialog.tsx](src/components/AddPropertyDialog.tsx) (867 LOC).

**Why rewrite:** property listing + detail is a table-stakes CRUD view that every PM tool has. You do need it — but what's there is unmaintainable (991-LOC component). The features are right (list, filter, view detail, edit, add via Zillow scrape); the implementation is wrong.

**Target:** a listing page + a detail page, each under 300 LOC, built on `DataClient`. The "add via Zillow scrape" feature becomes a small workflow (`wf.property_import.v1`) that parallels the portfolio import workflow we already built. The detail page's many tabs (maintenance, tenants, payments, documents) each become lazy-loaded sub-sections that query their own repo methods.

**Why not the first thing to build:** the portfolio import workflow already creates properties in bulk during onboarding, which covers the primary "how do properties get into the system" path. Single-property-add can wait.

---

### Tenants — **REWRITE**

[src/pages/Tenants.tsx](src/pages/Tenants.tsx) (300+ LOC), [AddTenantDialog](src/components/AddTenantDialog.tsx).

Same story as Properties but smaller. The listing page is fine conceptually; the implementation has direct Supabase calls and inline lease-expiration logic. **Migrate alongside the Properties rewrite** — same data layer changes hit both.

Tenant onboarding (move-in) is a great workflow candidate but can be deferred until PM onboarding + maintenance are live.

---

### Leasing / Marketing — **KILL** (most of it)

[Leasing.tsx](src/pages/Leasing.tsx) plus components for leads, listings, applications, tours, marketing campaigns.

**Why kill:** this is feature scope creep the app doesn't need for its 50-unit-PM MVP. Leads + rental applications are real features, but they're 12 months away. Marketing campaigns and tour scheduling are not differentiators. The tables exist (`leads`, `rental_applications`, `property_listings`, `property_tours`, `marketing_campaigns`) but have no customer validation.

**Disposition:** delete the UI, route, and all 5 components. Leave tables in the Supabase database alone (they're not hurting anything), but don't port them to Google Cloud. When leasing becomes a priority, build it fresh.

---

### Documents — **REWRITE** (later)

[src/pages/Documents.tsx](src/pages/Documents.tsx) (800+ LOC), [AIAnalysis.tsx](src/components/documents/AIAnalysis.tsx), [OCRExtractor](src/components/documents/OCRExtractor.tsx), folders, versions, signatures.

**Why rewrite, not replace:** documents are real (leases, W-9s, inspection reports). But the current implementation tries to be a full DMS — folders, versioning, signature requests, AI-tagging — and none of it has users.

**Target:** a flat file list scoped by entity (property, lease, tenant). Upload, preview, delete. AI tagging becomes a workflow step triggered on upload (`ai_prompt` → writes to state → user confirms tags). Signature requests get killed until someone explicitly asks for them — plenty of e-sign vendors do this better (DocuSign, Dropbox Sign).

**Not urgent:** file attachments hang off leases and inspections; until those workflows are live there's nothing to attach documents to.

---

### House Watching / Home Check — **PARTIALLY REPLACED**

[HouseWatching.tsx](src/pages/HouseWatching.tsx), [HomeCheck.tsx](src/pages/HomeCheck.tsx) (600+ LOC), plus 4 mobile variants.

The **check-a-property flow** is already replaced by our `houseCheckWorkflow` in [src/lib/ai/workflows/schemas/houseCheck.ts](src/lib/ai/workflows/schemas/houseCheck.ts). The legacy page still exists; kill it once the workflow is wired into a real mobile UI.

What remains: the *admin* side of house watching — assigning watchers to properties, scheduling cadence, viewing history. **REWRITE** as a lean admin page on `DataClient`. Much smaller scope than the current 300+ LOC mgmt page.

---

### Property Owners — **REWRITE (admin) + KILL (Client Portal)**

Admin side: [PropertyOwners.tsx](src/pages/PropertyOwners.tsx) + [AddPropertyOwnerDialog.tsx](src/components/AddPropertyOwnerDialog.tsx) (744 LOC) + [OwnerPortalSystem](src/components/owner/OwnerPortalSystem.tsx) (767 LOC).

Rewrite the admin (CRUD owners, view their portfolio, send statements) on `DataClient`. The giant `AddPropertyOwnerDialog` becomes an `ownerOnboarding` workflow — scope: name, email, ownership stake per property, payment details. Much smaller than what's there today.

Client Portal: [src/pages/ClientPortal/](src/pages/ClientPortal/) — **KILL.** Every page renders hardcoded mock data. It's demo code that got committed. Delete all 5 files and the route entries. When we want an owner-facing portal, build it as a role-specific home powered by workflows.

---

### Payments / Finances — **REWRITE** (much later)

[Finances.tsx](src/pages/Finances.tsx) (mock data only), [Payments.tsx](src/pages/Payments.tsx), edge functions for Stripe integration.

The Stripe plumbing (`create-payment`, `create-subscription`, `verify-payment`, `customer-portal`) is real and works. The *UI* renders mock data. Rewrite the UI on `DataClient` when real payments are needed.

**Why much later:** a 50-unit MVP PM company doesn't need in-app payments at launch — they can keep using whatever they currently use (Buildium for rent, QuickBooks for accounting). When payments become a competitive wedge, build the full trust-accounting flow as a real workflow. Do not half-build it now.

---

### Admin (UserManagement, CheckTemplates, AuditLogs) — **REWRITE**

[UserManagement.tsx](src/pages/UserManagement.tsx) (855 LOC), [CheckTemplates.tsx](src/pages/admin/CheckTemplates.tsx) (stub), [AuditLogs.tsx](src/pages/admin/AuditLogs.tsx) (stub), [MaintenanceHub.tsx](src/pages/admin/MaintenanceHub.tsx), [TenantsHub.tsx](src/pages/admin/TenantsHub.tsx).

**UserManagement:** the `sessionStorage` "emergency admin mode" hack must die. User provisioning becomes a workflow (`wf.user_invite.v1`) that handles role assignment, invite email, and profile creation as one flow. Listing + delete stays as a lean admin page.

**CheckTemplates:** rebuild as a proper editor when it matters. The template structure is already modeled in `DataClient`.

**AuditLogs:** leave as a stub until there's a compliance need.

**MaintenanceHub / TenantsHub:** redundant with the main Maintenance and Tenants pages once those are rewritten. Kill both.

---

### AI components — **REPLACE** (fold into workflows)

[PropertyAssistant.tsx](src/components/ai/PropertyAssistant.tsx) (floating chat), [MaintenanceTriage.tsx](src/components/ai/MaintenanceTriage.tsx), [InspectionSummaryGenerator.tsx](src/components/ai/InspectionSummaryGenerator.tsx), [AIAnalysis.tsx](src/components/documents/AIAnalysis.tsx).

All four are **one-off AI bolt-ons that should be workflow steps instead.**

- **PropertyAssistant** — the floating chat widget. **Kill.** Replaced by contextual AI embedded in each workflow step.
- **MaintenanceTriage** — becomes the Maintenance Triage workflow (see above).
- **InspectionSummaryGenerator** — becomes the final `ai_prompt` step in the house check workflow (already partially done in [houseCheck.ts](src/lib/ai/workflows/schemas/houseCheck.ts)).
- **AIAnalysis** — becomes the post-upload step in the Documents rewrite.

**What to keep:** the AI service layer itself ([src/lib/ai/aiService.ts](src/lib/ai/aiService.ts) and [src/integrations/ai/client.ts](src/integrations/ai/client.ts)) is well-built. But the workflow engine has its own LLM client ([src/lib/ai/workflows/llm/](src/lib/ai/workflows/llm/)) that's cleaner and portable to mobile. Once all AI consumers are workflow steps, the legacy aiService can be deleted.

---

## Roadmap: in what order to do this

Assuming the infra engineer has delivered a working `GoogleDataClient` + `FirebaseAuthClient` (acceptance test: `/workflows-demo` runs end-to-end):

### Phase 1 — Prove the pattern (weeks 1-2)
1. Build the **Maintenance Triage workflow**. Replace the legacy Maintenance page with a workflow runner + a simple listing.
2. Kill the floating **PropertyAssistant** widget.
3. Wire the **house check workflow** into a real mobile route (replaces HomeCheck.tsx).

### Phase 2 — Delete dead weight (week 3)
4. Delete **ClientPortal/** (5 files of mock data).
5. Delete **Leasing/** UI + components.
6. Delete **MaintenanceHub** and **TenantsHub** admin pages.
7. Delete **mobile dashboard variants**.

### Phase 3 — Rebuild the core (weeks 4-7)
8. Rewrite **Properties** listing + detail (both under 300 LOC each).
9. Rewrite **Tenants** listing + detail.
10. Build **tenant move-in workflow**.
11. Rewrite **Property Owners** admin + build owner onboarding workflow.
12. Build **RoleHome** components to replace the widget dashboards.

### Phase 4 — Messaging + documents (weeks 8-10)
13. Rewrite **Messaging** on the simplified 3-table model.
14. Rewrite **Documents** with lean file list + workflow-driven AI analysis.

### Phase 5 — Later
15. **Payments / Finances** — only when there's a customer explicitly asking.
16. **Leasing / Applications** — greenfield, not a port.
17. **Audit logs**, **check template editor** — when compliance or admin power users ask.

---

## What this audit is *not*

- Not a refactoring plan for the legacy code as it stands. No one should be cleaning up the 991-LOC EnterprisePropertyDetails component. It gets deleted, not refactored.
- Not a feature-parity target. The new app is intentionally *smaller* than the legacy one — we are cutting scope to ship.
- Not binding. If the first customer loves a feature we'd marked KILL, re-evaluate. These are priorities, not promises.

---

## TL;DR for a contractor

> "Most of the legacy code is scaffolding from a no-code tool. Don't touch it. Build workflows on the new interfaces, and delete legacy screens as workflows replace them. The only legacy things worth migrating as-is are Auth + Setup (temporary, until Firebase Auth lands) and the AI service layer (good pattern, dying soon). Everything else is either rewrite, replace, or kill."
