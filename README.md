# prop-hub-suite

Property management and house-watching platform. Web app today; Expo mobile app coming.

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Query for server state
- Capacitor (iOS/Android wrapper, being phased out in favor of a dedicated Expo app)
- Backend: Supabase today, migrating to Google Cloud (Cloud SQL + Firebase Auth + Cloud Run + GCS)

## Architecture notes

New work is organized around a backend-agnostic **AI workflow engine** under `src/lib/ai/workflows/`. Workflows are defined as data (see `src/lib/ai/workflows/schemas/`) and run against two swappable interfaces:

- `DataClient` — `src/lib/data/contracts.ts`
- `AuthClient` — `src/lib/auth/contracts.ts`

Both are implemented by mock clients today (in-memory + localStorage). Google Cloud implementations will be slotted in later without touching workflow or UI code.

See `docs/INFRA_SPEC.md` for the backend migration plan.

## Local development

Requires Node 20+.

```sh
npm install
npm run dev
```

The demo workflows page (no Supabase login required) lives at `/workflows-demo`.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run preview` — preview the production build locally
