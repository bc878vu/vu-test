# VU Test Papers

A small separate website for VU midterm test papers (lectures 1–22 only).
Students sign up with an access code from the admin, take MCQ and subjective
tests, and track their progress. The admin adds subjects, MCQs, and short/long
questions, edits individual questions, imports validated JSON batches, and
manages additional admin roles. Math renders with KaTeX in proper format.

## Setup

1. Run the base `supabase-tp.sql` schema in the Supabase SQL editor first. That
   existing file is maintained separately and is not included in this repository.
   It creates the `tp_*` tables, base row-level security policies, and seed content.
2. Run this repository's `supabase-tp-admins.sql` in the same SQL editor. It adds
   the admin-role table and database policies so extra admins can manage content.
3. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. From the repository root, install and build:
   - `npm install && npm run build`
5. Deploy the repository root to Vercel (standard Vite build, no server code).

## First use

1. Log in with the admin account (`veducator4@gmail.com`).
2. Open Admin → Settings and set the student access code.
3. Use Admin → Admins to add or remove extra admin roles after running the migration.
4. Share the site link + access code with students. Note: the current signup
   access-code check is client-side only; use a server-side/Edge Function gate if
   the code must be enforced as a security boundary.

## Notes

- STA301 has no long questions: no verified long section exists for its
  midterm, so none were invented.
- MTH202 covers lectures 1–22 only (logic, sets, relations, functions,
  sequences, series, recursion). Counting/permutations/combinations are
  lectures 29–34 (final term) and are deliberately excluded.
- "Most important / repeated" means the questions are present in past-paper
  banks and core to the handout; no per-question past-paper frequency is
  claimed.

## Database (moved 2026-10-30)

The database lives in the EduNexus Supabase project (edunexus-app,
cprpndovdfnkvekewstv) — one place for the whole website's data. The
one-shot `supabase-tp-edunexus-move.sql` (base schema + admins + review +
users + access code VU2026) was run in that project's SQL editor.
Vercel env `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` point at that
project. (Previously the AI CV Builder project's database was used.)
