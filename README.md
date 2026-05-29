# Rubric QC Tool — Caption Labeling Pre-Submission Self-Check

A web app for the Waymo Caption Labeling pilot. Taskers paste their **revised Thinking Trace + Driving Plan** (alongside the pre-seed versions), run an **Opus 4.8** review that flags everything risky against the 17-item rubric, then **Submit** — every submission is saved to Supabase so the reviewer can look before rehearsing the label on the real Waymo platform.

- **`/`** — tasker form, AI check, submit
- **`/admin`** — reviewer dashboard (password-gated): list, inspect, export CSV

The AI **cannot see the camera footage** — it reviews the text (consistency, trace↔plan agreement, writing, golden-example patterns) and produces a camera self-review checklist for everything it can't verify. This is stated clearly in the UI; a clean text result is never presented as "the segment is correct."

---

## What you need (3 accounts/keys)

1. **Anthropic API key** — from https://console.anthropic.com → API Keys. (Billing must be enabled; Opus 4.8 at `max` effort is the most capable but also the priciest tier — see Cost below.)
2. **Supabase project** — free tier is fine. From https://supabase.com → New project. You'll need the **Project URL** and the **service_role** key (Project Settings → API).
3. **Vercel account** — https://vercel.com (free Hobby tier works). Plus the Vercel CLI: `npm i -g vercel`.

---

## Step 1 — Supabase (database)

1. Create a Supabase project. Wait for it to finish provisioning.
2. Open **SQL Editor → New query**, paste the contents of `supabase_schema.sql`, and **Run**. This creates the `submissions` table.
3. Go to **Project Settings → API** and copy:
   - **Project URL** → this is `SUPABASE_URL`
   - **service_role** secret key → this is `SUPABASE_SERVICE_ROLE_KEY` (keep it secret; it's server-only).

## Step 2 — Run locally first (recommended)

```bash
cd rubric-qc-app
npm install
cp .env.local.example .env.local      # then edit .env.local with your real keys
npm run dev                            # open http://localhost:3000
```

Fill `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8
ANTHROPIC_EFFORT=max
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_PASSWORD=choose-a-strong-password
```

Test: paste one of your golden tasks, click **Run AI check**, then **Submit**, then open `/admin` and confirm the row appears.

## Step 3 — Push to GitHub (so Vercel can build it)

```bash
cd rubric-qc-app
git init
git add .
git commit -m "Rubric QC tool"
# create an empty repo on github.com first, then:
git remote add origin https://github.com/YOUR-USERNAME/rubric-qc-app.git
git branch -M main
git push -u origin main
```

## Step 4 — Deploy to Vercel (via terminal)

```bash
cd rubric-qc-app
vercel            # first run: links the project (accept defaults; framework auto-detected as Next.js)
```

Then add your environment variables to Vercel (either in the dashboard under
**Project → Settings → Environment Variables**, or via CLI):

```bash
vercel env add ANTHROPIC_API_KEY production
vercel env add ANTHROPIC_MODEL production            # claude-opus-4-8
vercel env add ANTHROPIC_EFFORT production           # max
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add ADMIN_PASSWORD production
```

Deploy to production:

```bash
vercel --prod
```

Vercel prints your live URL (e.g. `https://rubric-qc-app.vercel.app`). Share `/` with the taskers; keep `/admin` + the password for yourself.

> **Note on long AI calls:** `pages/api/check.js` sets `maxDuration: 300`. On Vercel's Hobby plan the function timeout caps lower than 300s; if you see timeouts at `max` effort, either upgrade the plan or set `ANTHROPIC_EFFORT=xhigh` or `high` (still very strong, faster).

---

## Cost control

Each "Run AI check" is one Opus 4.8 call with adaptive thinking. `max` effort = deepest analysis = most tokens. To reduce cost:
- Set `ANTHROPIC_EFFORT=high` (the model default; still excellent) or `xhigh`.
- The system prompt is large but identical each call; Opus 4.8 prompt-caches prompts ≥1,024 tokens automatically on repeat calls, which lowers input cost.

---

## How it works (for future edits)

- `lib/rubricKnowledge.js` — **the brain**: the 17 rubric items, the two escalation rules, the 4-question skip tree, the writing principles, and the golden-task patterns. Edit here to change what the AI looks for.
- `lib/checkPrompt.js` — builds the Opus system prompt + user message and defines the **JSON schema** returned.
- `pages/api/check.js` — calls Opus 4.8 (`thinking:{type:"adaptive"}`, `output_config:{effort}`), parses the JSON.
- `pages/api/submit.js` + `lib/supabase.js` — save a submission.
- `pages/api/list.js` — reviewer read (password-gated).
- `pages/index.js` — tasker form + results renderer.
- `pages/admin.js` — reviewer dashboard + CSV export.

## Important notes

- This is a **rehearsal / QC** tool that operates on the tasker's own pasted content. It is not a browser plugin and does not touch the Waymo platform.
- The `service_role` key bypasses Supabase RLS, so it must only ever live in server env vars (it does — it's only imported in `/api` routes). Never expose it client-side.
- The AI's "major risk" flags are **risks to verify**, not verdicts. The final call always rests on the human looking at the cameras.
