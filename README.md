# SoTex Partner Network

Internal prospect-management application for building referral and strategic payroll/HR partnerships across Texas. Built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase/PostgreSQL.

## Architecture

- `app/` — Next.js App Router pages, metadata, health endpoint, and responsive CRM shell.
- `components/partner-network.tsx` — dashboard, searchable firm table, profile, contacts, outreach, import preview, and export interactions.
- `lib/` — deterministic scoring, fictional preview records, shared types, and Supabase browser/server clients.
- `supabase/migrations/` — PostgreSQL schema, indexes, normalization, scoring triggers, RLS, and authenticated-user policies.
- `supabase/seed.sql` — 15 fictional firms with varied geography, services, and contact coverage.

The browser receives only the Supabase publishable key. The service-role key is read only in server code and must never use a `NEXT_PUBLIC_` prefix.

## Environment

Copy `.env.example` to `.env.local` and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SERVICE_ROLE_KEY=sb_secret_YOUR_SERVER_ONLY_KEY
```

Without these values, the app runs in preview mode with fictional in-memory data so the interface can be evaluated safely.

## Supabase setup

1. Install the current Supabase CLI and run `supabase --help` to confirm its commands.
2. Create/link a Supabase project.
3. Run `supabase db push` to apply `supabase/migrations/20260811000000_phase_1.sql`.
4. Run `supabase db reset` locally to apply the migration and `supabase/seed.sql`, or paste the seed file into the SQL editor for a non-production test project.
5. In Supabase Auth, create the internal users who may access the app. The migration grants CRUD access only to authenticated users and revokes anonymous table access.

Current Supabase projects may not expose new tables to the Data API automatically. The migration explicitly grants the authenticated role table access; keep RLS enabled.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Before shipping changes, run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Vercel deployment

1. Import this repository as a new Vercel project; framework detection should select Next.js.
2. Add the three environment variables above for Preview and Production.
3. Deploy. The health endpoint at `/api/health` reports whether database configuration is present without exposing secrets.
4. Set the matching production URL in Supabase Auth redirect URLs before enabling sign-in flows.

## CSV formats

The Imports page downloads a ready-to-use template. Import preview classifies new firms, possible duplicates, new contacts, and invalid rows. Mail Merge Export includes only contacts with email addresses and supplies deterministic personalization notes.

## Known Phase 1 limitations

- Preview mode changes reset on reload until a Supabase project is connected.
- Authentication UI is intentionally minimal; user provisioning happens in Supabase.
- CSV import preview demonstrates the complete validation flow; high-volume background processing is deferred.
- Scoring uses deterministic rules and exact service/industry labels rather than enrichment or fuzzy matching.
- Automated email sending, HubSpot sync, and AI enrichment are not included. Google Places discovery and optional Lusha decision-maker enrichment are available when their server-only keys are configured.

## Recommended Phase 2

Add role-based workspaces and audit logs, background CSV jobs, enrichment-provider adapters, HubSpot synchronization, campaign/mail-merge execution, referral/revenue attribution, configurable scoring weights, and analytics for conversion by region and source.

## Phase 2 discovery and enrichment

Phase 2 adds a staging-first real-prospect workflow. Apply `supabase/migrations/20260811010000_phase_2_discovery_enrichment.sql`, then optionally run `supabase/phase2_san_antonio_candidates.sql` to stage the controlled 15-firm San Antonio starter batch.

The new Discovery area includes candidate metrics, bulk review, approval/rejection, exact and fuzzy duplicate warnings, source evidence, confidence labels, and a seven-query San Antonio discovery plan. Approval rechecks duplicates before converting a candidate into a scored firm.

Google Places stages firms for human review. Optional Lusha contact research stages up to three decision makers per candidate; revealing emails and phones may consume Lusha credits. Selected staged contacts are copied into the permanent contacts table only when the candidate is approved.

Saved firm views now include Ready for Outreach, A/B prospects not contacted, missing decision maker/email, referral and wholesale payroll opportunities, and region-specific ready lists.
