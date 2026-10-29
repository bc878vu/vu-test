# VU Test Papers

A small separate website for VU midterm test papers (lectures 1–22 only).
Students sign up with an access code from the admin, take MCQ and subjective
tests, and track their progress. The admin adds subjects, MCQs, and short/long
questions. Math renders with KaTeX in proper format.

## Setup

1. Run `supabase-tp.sql` (in `~/workspace/testpapers/`) once in the Supabase
   SQL editor. It creates the `tp_*` tables, row-level security policies, and
   seeds PHY101, MTH202 and STA301 midterm content (lectures 1–22 only).
2. Copy `app/.env.example` to `app/.env` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Install and build:
   - `cd app && npm install && npm run build`
4. Deploy the `app/` directory to Vercel (standard Vite build, no server code).

## First use

1. Log in with the admin account (`veducator4@gmail.com`).
2. Open Admin → Settings and set the student access code.
3. Share the site link + access code with students. Students sign up with the
   code; without it signup is refused.

## Notes

- STA301 has no long questions: no verified long section exists for its
  midterm, so none were invented.
- MTH202 covers lectures 1–22 only (logic, sets, relations, functions,
  sequences, series, recursion). Counting/permutations/combinations are
  lectures 29–34 (final term) and are deliberately excluded.
- "Most important / repeated" means the questions are present in past-paper
  banks and core to the handout; no per-question past-paper frequency is
  claimed.
