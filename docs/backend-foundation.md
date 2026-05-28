# Backend Foundation — PetroTarget AI

Supabase-ready backend layer with localStorage fallback.
The app continues to work without any backend configuration.

---

## Why Supabase

- PostgreSQL with JSONB support — ideal for structured evidence and assumption objects
- Built-in Row Level Security (RLS) for multi-user data isolation
- Auth system for future sign-in flows
- No custom server required — frontend directly calls Supabase APIs
- Easy local development: all features work without Supabase configured

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | No | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | No | Your Supabase anon/public API key |

Both variables are optional. If absent, the app uses localStorage automatically.

Create a `.env.local` file at the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Do NOT commit `.env.local` to version control.

---

## Local Fallback Behavior

When `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are missing:

- `isSupabaseConfigured` = `false`
- `supabase` client = `null`
- `getProspectRepository()` returns `localProspectRepository`
- All CRUD operations use localStorage (`petrotarget-ai:prospects`)
- Storage indicator in sidebar shows **"Storage: Local"** (grey dot)
- No network requests are made
- All 208 tests pass without credentials

---

## Supabase Mode

When both env vars are present:

- `isSupabaseConfigured` = `true`
- `getProspectRepository()` returns `supabaseProspectRepository`
- CRUD operations use the `prospects` Supabase table
- Storage indicator shows **"Storage: Supabase"** (green dot)
- Derived fields (GCoS, priority, dataConfidence, geoscienceAssessment, economicAssessment) are regenerated on read by `scoreProspect()`

---

## How to Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy your Project URL and anon key
3. Open the **SQL Editor** and run the migration in `docs/backend-schema.md`
4. Set the env vars in `.env.local`
5. Restart the dev server: `npm run dev`

---

## Data Model

Only user-provided fields are stored in Supabase:

- Identification: `id`, `name`, `basin`, `block`, `play_type`
- Coordinates: `latitude`, `longitude`
- Scoring inputs: 6 component scores, `commercial_score`, `resource_estimate`
- Scoring config: `scoring_mode`, `target_phase`
- Complex objects (JSONB): `evidence`, `economic_assumptions`

**Not stored:** GCoS, priority, mainRisk, dataConfidence, recommendation, explanation, geoscienceAssessment, economicAssessment — all regenerated from stored inputs by `scoreProspect()` on every read.

See `docs/backend-schema.md` for full SQL schema and RLS setup.

---

## Repository Abstraction

`src/services/prospectRepository.ts` exposes:

```typescript
interface ProspectRepository {
  listProspects(): Promise<Prospect[]>;
  createProspect(input: Prospect): Promise<Prospect>;
  updateProspect(id: string, input: Prospect): Promise<Prospect>;
  deleteProspect(id: string): Promise<void>;
}

getProspectRepository(): ProspectRepository
// → localProspectRepository  (Supabase not configured)
// → supabaseProspectRepository (Supabase configured)
```

The Zustand store adds optional async methods:
- `loadFromRepository()` — pulls from configured repository into store
- `saveToRepository()` — pushes current store state to repository

Existing synchronous CRUD (`createProspect`, `updateProspect`, etc.) is unchanged.

---

## Migration Helper

`src/services/migrationService.ts` exports:

```typescript
migrateLocalProspectsToCloud(): Promise<{
  migrated: number;
  failed: number;
  errors: string[];
}>
```

Reads local prospects and upserts them to Supabase. Preserves evidence, economicAssumptions, scoringMode, and targetPhase. Reports per-prospect errors without crashing.

---

## Auth Placeholder

`src/services/authService.ts` exports placeholder functions:

```typescript
getCurrentUser(): Promise<User | null>
isAuthenticated(): Promise<boolean>
signOut(): Promise<void>
```

Returns `null`/`false` when Supabase is not configured. No login UI in this release.

---

## What Is NOT Included Yet

| Feature | Status |
|---------|--------|
| Login / signup UI | Not in this PR |
| Organizations / workspaces UI | Schema documented, no UI |
| Per-user RLS enforcement | Schema documented; owner_id nullable for now |
| Project / sub-portfolio UI | Not in this PR |
| Server-side Advisor / LLM | Not in this PR |
| File uploads / attachments | Not in this PR |
| Backend scoring (Edge Functions) | Not in this PR |
| ML pipeline | Not in this PR |
| Real-time sync / subscriptions | Not in this PR |

---

## Testing

All tests run without Supabase credentials:

```bash
npm run test          # 208+ tests, all pass without any env vars
npm run typecheck     # clean
npm run build         # clean production build
```

New service tests cover:
- `supabaseClient`: configured=false in test env, no throws
- `prospectRepository`: mapping round-trips, evidence/economicAssumptions preservation, local CRUD
- `migrationService`: graceful failure without Supabase, error reporting, per-prospect failure isolation
