# Rubric QC Tool — version log

## v3.2.1  (current) — false-positive reduction (trained reasoning)
- TRACE IS TEMPORAL: the model is now trained that a trace moves through time — current-state observation ("I am in the middle lane") vs the committed plan ("I will stay in the right-most lane") are DIFFERENT MOMENTS, not a contradiction. A real contradiction requires two claims about the SAME attribute at the SAME moment. Fixes the false M5 "middle vs right-most lane" flag.
- PHANTOM-LEAD = strict (option b): only flagged when the TEXT contradicts itself about the same vehicle's lane (calls it a same-lane lead AND places it in an adjacent lane). A plain description of a car in an adjacent lane is no longer flagged.
- CAMERA CHECKS ARE SEPARATE: anything camera-dependent (blue car in my lane? officer gesturing proceed?) appears ONLY in the camera-check list — never as a major/minor flag and never as a highlighted span. Keeps the flags list uncluttered.
- GRAMMAR SPANS are now tight + atomic: one broken phrase per point (e.g. just "the the"), never a long span across an unrelated clause, never two grammar issues merged.
- m16 fires ONLY for a decision-critical object visible only in a non-front camera — scenery mentioned in a direction ("accident on the left") no longer triggers it.

## v3.2.0
Re-read the canonical SOP and corrected real errors:
- FLAG DISCIPLINE (the big fix): a Major/minor flag is only raised for things DEMONSTRABLE FROM TEXT (contradictions, trace↔plan mismatch, leftovers, hedging, grammar, structure, triage-intent mismatch). Anything that needs the camera to confirm (e.g. "is the officer gesturing proceed vs stop?") is NO LONGER mislabeled as a rubric violation — it becomes a short camera check. Fixes the "missed hazard" mislabel.
- CAMERA LIST CORRECTED to the canonical set: SVC-F, SVC-FL, SVC-FR, SVC-SL, SVC-SR, SVC-RL, SVC-RR, SVC-R (previously had wrong SVC-L/R/B).
- MINIMAL INPUT now matches canonical: the FEWEST cameras needed for the DECISION. Default SVC-F; only add a camera if the decision truly requires it (not because an object is "on the left"). The advisor is now conservative.
- TEMPORAL corrected to the canonical test: only when movement across multiple frames is essential (cut-in tracked across frames, pedestrian/animal motion, traffic-light STATE CHANGE). A static object or single-frame signal state does not need it.
- SCENE GROUNDING (coordinates/object IDs) flagged as OUT OF SCOPE — never required or rewarded.
- Redundancy bar raised: Rationale/Trajectory/Speed naturally restate the situation — that's structure, not redundancy. Only true verbatim duplication is flagged. Hedging/structure/leftover now prioritized.
- CONTRADICTION evidence must NAME BOTH LOCATIONS and quote both ("Trajectory says '…' but Rationale says '…'"), and both spans highlight together.
- CAMERA CHECKS are now terse (2–5 words: "Officer gesturing proceed?", "Object in lane?") instead of long sentences.
- HOVER-LINKING: kept just two colors (Major=red, minor=amber) but hovering any highlighted span now outlines ALL spans of that same issue (across trace and plan), with a clear #N badge — so same-issue sentences are linkable without a rainbow.
- Dedicated TRACE↔PLAN CONSISTENCY status block always shown at the top of results (consistent / mismatch / not-checked).
- Minimal Input selection sits with the trace+plan and is evaluated by the one combined check; the optional advisor button is now conservative too.

## v3.1.0
- TITLE: "For the Turing Waymo Team" on the header.
- SEVERITY COLORS: Major is always RED, minor is always amber/beige (dropped the per-point rainbow). Points still numbered for matching.
- REQUIRED CONTEXT: name, Task ID, and triage note are now compulsory before any check (context improves accuracy). The check blocks and tells you what's missing.
- IN-APP RE-CHECK + STABILITY: after a check you can edit the text and hit "Re-check". Re-checks are ANCHORED — the model receives its prior findings and is told to mark each resolved/remaining and NOT invent new minor nitpicks unless your edit caused them or it's a high-confidence Major. Plus a confidence floor + deterministic ordering in the prompt. This dramatically reduces the "I fixed it and new random issues appeared" problem. (Note: LLMs can't be made bit-for-bit deterministic — Opus 4.8 doesn't allow temperature=0 — but anchoring removes the confusing part.)
- REVISION CHAIN: every check snapshots the trace+plan. Default view shows the latest; "Revision N · view history" reveals a compact timeline with tracked-changes diffs BETWEEN consecutive revisions. The full chain is saved on submit.
- COMPELLING SUBMIT REMINDER: clicking "New task" with unsaved results opens a modal — "this task isn't saved for review; its revision history will be lost" — with one-click Submit now, or Discard.
- REVIEWER DASHBOARD upgrades (reviewer-only): Score column (Major=0%, else 100−5×minors) and a Revisions count in the table; a "Most common mistakes" panel aggregating rubric codes across all submissions; the per-tasker accuracy panel; richer CSV export (now includes score, revision count, full pre-seed/revised text, codes, headline — opens in Excel); and the full revision history shown in each submission's detail.

### DB migration for v3.1.0 (run once in Supabase SQL editor)
    alter table public.submissions add column if not exists revisions jsonb;
    alter table public.submissions add column if not exists score int;

## v3.0.0
- ONE COMBINED CHECK (no more isolated trace/plan checks). Trace + plan are always reviewed together so the Trace↔Plan consistency check runs automatically.
- MISSING-FIELD REMINDER: if a revised field is empty when you hit Run, a prompt asks "you don't have X — add it?" → Add, or Check anyway (results then note that consistency couldn't be checked).
- PRE-SEED OPTIONAL: leave pre-seed blank and the diff/comparison simply notes "nothing to compare against"; the revised text is still fully reviewed for writing, internal consistency, canonical compliance, and triage alignment.
- HOVER POPUPS: hover any highlighted span (in trace OR plan) to get a floating card with severity, code, fix, why, evidence, and the camera-confirm note — no scrolling to a list. Findings now carry a "where" field so each highlight lands in the correct panel.
- TRACKED-CHANGES DIFF (Word convention): pre-seed → revised shown inline; removed text = red strikethrough, added text = red underline.
- GENTLE, OPT-IN Minimal Input advisor: a separate optional button suggests cameras/Temporal from the text, explicitly framed as a hint to confirm against the video (not a decision) to avoid over-reliance.
- Skip-decision self-check tucked into an optional expander.
- No new DB migration (still uses section_results from v2.0.0).

## v2.2.0
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
