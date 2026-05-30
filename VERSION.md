# Rubric QC Tool — version log

## v2.2.0  (current)
- RETRAINED BRAIN on the authoritative client labeled-examples doc. Old training discarded. Added a TRIAGE TAXONOMY (the 5 real triage codes + the correct action each implies) and Temporal ground truth (Temporal only when motion matters — e.g. officer gesturing, school-bus lights flashing — NOT for static FOD / observed yellow light / potholes). The checker now verifies the revised action matches the triage intent.
- TURNITIN-STYLE HIGHLIGHTING: flagged spans are highlighted in-place inside your revised trace/plan, each a numbered "point" with its own color. Hover a highlight to see "#N · CODE · fix". A contradiction highlights BOTH sentences in the same color/number. Numbered detail list sits below; click "?" on any point to expand why/evidence/camera-confirm.
- DIFF VIEW: expandable pre-seed → revised word-level diff (red = removed, green = added) for both trace and plan.
- BIGGER TEXT WINDOWS: wider layout and taller, wrapping textareas — no more left-right scrolling.
- GRAMMAR / hedging / leftover-meta flagging retained and folded into the point list.
- ADMIN per-tasker accuracy panel (reviewer-only): tasks per tasker, avg majors/minors per task, verdict distribution bar, and each tasker's most-flagged rubric codes.
- No new DB migration (still uses the section_results column from v2.0.0).

## v2.1.0
- VISUAL PARSIMONY: results are now a compact action list. Each finding shows a short one-line fix + a type tag (leftover / contradiction / hedge / structure / grammar / mismatch / missing). Click the "?" to expand in place for the why + evidence + camera-confirm note.
- Trace check now explicitly hunts for PARTIAL EDITS / LEFTOVERS — e.g. "pre-seed said X, you changed it in one section but X still appears later." Plus contradictions, missed hazards, hedging, structure, grammar, redundancy.
- Self-review (camera) checklist, "what changed", label guidance, and the full 17-item sweep are collapsed into expandable rows by default.
- Per-section buttons + full check unchanged; taskers can check nothing, one section, or everything.
- No DB migration needed beyond v2.0.0's section_results column.

## v2.0.0
- Per-section AI checks: ✦ Check trace, ✦ Check plan (+ trace↔plan consistency), ✦ Camera & Temporal advisor — each runs independently so you don't wait for the full sweep.
- Camera advisor compares the text's implied cameras/Temporal against what you selected and flags mismatches (m16/m17).
- Hardened error handling: every failed call shows the real reason (missing key / billing / 504 timeout); client-side timeout so the page can never hang.
- Shared Opus 4.8 helper (lib/anthropicCall.js) used by all routes.
- New API route: pages/api/section.js. New prompts: lib/sectionPrompts.js.
- Submit now also stores section_results (new jsonb column — see migration below).

### DB migration required for v2.0.0
Run once in Supabase SQL editor:
    alter table public.submissions add column if not exists section_results jsonb;

## v1.0.0
- Initial app: single full 17-item check, submit to Supabase, /admin reviewer dashboard, CSV export.
