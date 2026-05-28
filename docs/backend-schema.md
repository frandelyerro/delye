# Backend Schema — PetroTarget AI

Intended Supabase database schema. For v1, only the `prospects` table is active.
The remaining tables are documented for future multi-user workspace features.

---

## Tables

### profiles

Extends Supabase Auth users with display metadata.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key, references auth.users |
| email | text | not null |
| full_name | text | nullable |
| created_at | timestamptz | default now() |

---

### organizations

Workspace / company containers for multi-team use.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| name | text | not null |
| created_at | timestamptz | default now() |

---

### organization_members

Membership and roles within an organization.

| Column | Type | Notes |
|--------|------|-------|
| organization_id | uuid | references organizations(id) |
| user_id | uuid | references auth.users(id) |
| role | text | owner / admin / member / viewer |

---

### projects

Exploration projects within an organization (sub-portfolios).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| organization_id | uuid | references organizations(id) |
| name | text | not null |
| description | text | nullable |
| created_at | timestamptz | default now() |

---

### prospects

Core data table. The only table active in v1.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key (app-generated or uuid_generate_v4()) |
| project_id | uuid | nullable for v1 — references projects(id) |
| owner_id | uuid | nullable for v1 — references auth.users(id) |
| name | text | not null |
| basin | text | not null |
| block | text | not null |
| play_type | text | not null |
| latitude | numeric | not null |
| longitude | numeric | not null |
| resource_estimate | numeric | not null |
| commercial_score | numeric | not null |
| source_score | numeric | not null |
| migration_score | numeric | not null |
| reservoir_score | numeric | not null |
| seal_score | numeric | not null |
| trap_score | numeric | not null |
| timing_score | numeric | not null |
| scoring_mode | text | 'manual' or 'evidence_derived' |
| target_phase | text | nullable — 'oil', 'gas', 'condensate', 'unknown' |
| evidence | jsonb | nullable — structured petroleum system evidence |
| economic_assumptions | jsonb | nullable — per-prospect EMV assumption overrides |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

**Derived fields are NOT stored** (GCoS, priority, mainRisk, dataConfidence, geoscienceAssessment, economicAssessment).
They are regenerated on read by `scoreProspect()` in `src/domain/scoring.ts`.

---

## Suggested SQL migration

```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Prospects table
create table if not exists public.prospects (
  id text primary key,
  project_id uuid references public.projects(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  basin text not null,
  block text not null default '',
  play_type text not null,
  latitude numeric not null,
  longitude numeric not null,
  resource_estimate numeric not null default 0,
  commercial_score numeric not null default 0,
  source_score numeric not null default 0.5,
  migration_score numeric not null default 0.5,
  reservoir_score numeric not null default 0.5,
  seal_score numeric not null default 0.5,
  trap_score numeric not null default 0.5,
  timing_score numeric not null default 0.5,
  scoring_mode text not null default 'manual',
  target_phase text,
  evidence jsonb,
  economic_assumptions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.prospects enable row level security;

-- Policy: users can only see their own prospects
create policy "Users can select their own prospects"
  on public.prospects for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own prospects"
  on public.prospects for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own prospects"
  on public.prospects for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own prospects"
  on public.prospects for delete
  using (auth.uid() = owner_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prospects_updated_at
  before update on public.prospects
  for each row execute function public.handle_updated_at();
```

> **Note:** For v1, `owner_id` is nullable and RLS policies are optional until auth is implemented.
> Without auth, remove the RLS policies or add a temporary permissive policy for testing.

---

## v1 Scope

Only `prospects` is implemented. `organizations`, `projects`, and `profiles` are documented
for future workspace features but have no UI in this release.
