// lib/sectionPrompts.js
// ---------------------------------------------------------------------------
// Focused prompts for the per-section checks so taskers don't wait for the
// full sweep. Each returns { system, user } and asks for a small JSON object.
// Reuses the same domain brain as the full check.
// ---------------------------------------------------------------------------

import {
  RUBRIC_ITEMS, WRITING_PRINCIPLES, GOLDEN_PATTERNS, PLAN_STRUCTURE,
  TRIAGE_TAXONOMY, MINIMAL_INPUT_GUIDANCE,
} from "./rubricKnowledge.js";

const TRIAGE_BLOCK = TRIAGE_TAXONOMY.map(t => `- ${t.code}: ${t.means} → correct action: ${t.correctAction}`).join("\n");

const SHARED_LIMITATION = `You CANNOT see the camera footage. Review TEXT ONLY: internal consistency, logical flow, writing quality, hedging, leftover meta-narration, and consistency with the triage note and golden-example patterns. For anything that needs the scene, produce a precise SELF-REVIEW question instead of a verdict. Never imply you verified the scene. Output ONLY valid JSON, no markdown, no prose outside the JSON.`;

const WRITING_BLOCK = WRITING_PRINCIPLES.map(p => "- " + p).join("\n");
const PATTERNS_BLOCK = GOLDEN_PATTERNS.map((p, i) => `${i + 1}. ${p.title}: ${p.detail}`).join("\n");

// ---------------- TRACE-ONLY ----------------
export function traceCheck({ triageNote, preseedTrace, revisedTrace, skipped }) {
  const items = RUBRIC_ITEMS.filter(r =>
    ["M4","M5","M6","M7","M8","m9","m11","m12","m13","m14","m15"].includes(r.code));
  const system = `You are an expert QC reviewer for the Waymo Caption Labeling pilot, focused ONLY on the THINKING TRACE.

${SHARED_LIMITATION}

RUBRIC ITEMS RELEVANT TO THE TRACE (Major = 0% for the whole segment; minor = -5%):
${items.map(r => `- ${r.code} [${r.sev}] ${r.name}${r.escalates ? " [CAN ESCALATE TO MAJOR if the missing object is the disengagement cause / safety-critical]" : ""}`).join("\n")}

ESCALATION: m12 (missing object) → M7/M4 if it's the disengagement cause or safety-critical. m9 hallucination → M7 if safety/compliance, M8 if high-prominence (category beats count).

WRITING PRINCIPLES:
${WRITING_BLOCK}

HIGH-SIGNAL PATTERNS FROM GOLDEN EXAMPLES:
${PATTERNS_BLOCK}

TRIAGE TAXONOMY — the revised trace must address the hazard implied by the triage code, and the action must match its intent:
${TRIAGE_BLOCK}

Compare the pre-seed trace to the revised trace and flag, specifically:
- LEFTOVER / PARTIAL EDIT: the tasker removed or changed a claim in one place but the OLD claim still appears elsewhere in the trace (e.g. they added an object but a later section still says "road is clear"). This is the most common and important issue — hunt for it.
- CONTRADICTION: two parts of the trace disagree (clear vs object; brake vs maintain speed; two different lanes/trajectories).
- MISSED HAZARD: the triage note implies a hazard the revised trace still doesn't address.
- HEDGE: low-confidence wording ("appears", "seems", "might", "likely", "possibly").
- STRUCTURE: missing/!out-of-order sections (Analyze → Synthesize → Explore Alternatives → Final Plan).
- GRAMMAR: typos, run-ons, leftover meta-narration ("the user wants me to act as a VLM", "Analyze the input").
- REDUNDANCY: the same fact stated multiple times.

For EVERY finding give a "type" (one of: leftover, contradiction, missed_hazard, hedge, structure, grammar, redundancy, consistency, speed, missing) and a "fix" that is a SHORT imperative (<14 words) — this is the one-liner the tasker sees first.

Return ONLY this JSON:
{
  "verdict": "ok" | "minor_issues" | "major_risk",
  "headline": "one short sentence (<20 words)",
  "major_risks": [{ "code":"M#","type":"...","fix":"<14-word imperative","why":"why it risks 0%","evidence":"<15-word quote or —","spans":["VERBATIM span(s) copied EXACTLY from the text to highlight; for a contradiction include BOTH conflicting sentences"],"confirm":"what to verify on camera" }],
  "minor_flags": [{ "code":"m#","type":"...","fix":"<14-word imperative","why":"short reason","evidence":"quote or —","spans":["VERBATIM span(s) copied EXACTLY from the text to highlight"] }],
  "self_review": [{ "code":"M# or m#","question":"yes/no question to confirm on camera" }]
}
Empty arrays must be []. Quotes <15 words. Keep every field terse. verdict = "major_risk" if any major_risks.`;

  const user = `TRIAGE NOTE:\n${triageNote || "—"}\n\nSegment marked as: ${skipped ? "SKIPPED" : "LABELED"}\n\n===== PRE-SEED THINKING TRACE =====\n${preseedTrace || "(none)"}\n\n===== REVISED THINKING TRACE =====\n${revisedTrace || "(none)"}\n\nProduce the JSON.`;
  return { system, user };
}

// ---------------- PLAN-ONLY (+ trace↔plan consistency) ----------------
export function planCheck({ triageNote, revisedTrace, preseedPlan, revisedPlan }) {
  const items = RUBRIC_ITEMS.filter(r =>
    ["M3","M4","M5","M6","m10","m13","m14","m15"].includes(r.code));
  const system = `You are an expert QC reviewer for the Waymo Caption Labeling pilot, focused ONLY on the DRIVING PLAN and its consistency with the Thinking Trace.

${SHARED_LIMITATION}

The Driving Plan must follow: ${PLAN_STRUCTURE.join(" → ")} (Safety Check only if present in the pre-seed).
The committed ACTION must be one of the options discussed in the Trace, and the trajectory + speed must match the Trace's final plan. A mismatch is M3 (MAJOR, 0%).

RUBRIC ITEMS RELEVANT TO THE PLAN:
${items.map(r => `- ${r.code} [${r.sev}] ${r.name}`).join("\n")}

WRITING PRINCIPLES:
${WRITING_BLOCK}

Key checks: (1) Does the Plan's action/trajectory/speed agree with the revised Trace and is the action one of the Trace's options? A mismatch is M3 (MAJOR). (2) Is the structure complete and in order? (3) Does the action follow logically from the scene (e.g. "pedestrian crossing" + "maintain speed" = contradiction)? (4) Leftover/partial edits (old claim still present). (5) Hedging, grammar, redundancy.

For EVERY finding give a "type" (one of: leftover, contradiction, mismatch, structure, hedge, grammar, redundancy, speed, missing) and a "fix" that is a SHORT imperative (<14 words) shown first.

Return ONLY this JSON:
{
  "verdict": "ok" | "minor_issues" | "major_risk",
  "headline": "one short sentence (<20 words)",
  "trace_plan_consistency": { "consistent": true|false, "action_in_trace_options": true|false|"unknown", "detail":"short" },
  "structure": { "goal":true|false, "observation":true|false, "reasoning":true|false, "action":true|false, "safety":true|false },
  "major_risks": [{ "code":"M#","type":"...","fix":"<14-word imperative","why":"short","evidence":"quote or —","spans":["VERBATIM span(s) from the text; include both sentences for a contradiction"],"confirm":"..." }],
  "minor_flags": [{ "code":"m#","type":"...","fix":"<14-word imperative","why":"short","evidence":"quote or —","spans":["VERBATIM span(s) from the text"] }],
  "self_review": [{ "code":"M# or m#","question":"..." }]
}
Empty arrays must be []. Quotes <15 words. Keep fields terse. verdict = "major_risk" if any major_risks.`;

  const user = `TRIAGE NOTE:\n${triageNote || "—"}\n\n===== REVISED THINKING TRACE (for cross-check) =====\n${revisedTrace || "(none)"}\n\n===== PRE-SEED DRIVING PLAN =====\n${preseedPlan || "(none)"}\n\n===== REVISED DRIVING PLAN =====\n${revisedPlan || "(none)"}\n\nProduce the JSON.`;
  return { system, user };
}

// ---------------- CAMERA & TEMPORAL ADVISOR ----------------
export function cameraCheck({ revisedTrace, revisedPlan, cameras = [], temporal = false }) {
  const system = `You are an expert QC reviewer for the Waymo Caption Labeling pilot, focused ONLY on Minimal Input: which camera views the caption requires, and whether Temporal is needed.

${SHARED_LIMITATION}

BACKGROUND:
- Camera views: SVC-F (front, the default), SVC-FL (front-left), SVC-FR (front-right), SVC-L (left), SVC-R (right), SVC-B (back).
- Rule of thumb from object position language: "ahead / in front / in my lane" → SVC-F; "to my left / left lane / on the left" → SVC-FL or SVC-L; "to my right / right lane" → SVC-FR or SVC-R; "behind me" → SVC-B.
- TEMPORAL is selected ONLY when the driving decision depends on MOTION across frames or a state CHANGE over time. ${MINIMAL_INPUT_GUIDANCE.temporalYes} ${MINIMAL_INPUT_GUIDANCE.temporalNo}
- m16 = mismatch between what the text references and the cameras selected (object referenced but its camera not selected, OR a camera selected but nothing in the text needs it). m17 = field left blank.

The tasker currently has selected: cameras = [${cameras.join(", ") || "none"}], temporal = ${temporal}.

Read the trace + plan. Infer from the TEXT which cameras are actually needed and whether Temporal is needed, then compare to the current selection and flag mismatches. Frame as actionable guidance.

Return ONLY this JSON:
{
  "cameras_text_implies": ["SVC-F", "..."],
  "camera_reasoning": [{ "camera":"SVC-FL","because":"text mentions object on the left" }],
  "temporal_needed": "yes" | "no" | "maybe",
  "temporal_reason": "why, citing the text",
  "missing_from_selection": ["cameras the text implies but tasker did NOT select, or []"],
  "extra_in_selection": ["cameras selected but nothing in the text needs them, or []"],
  "temporal_mismatch": "none" | "should_add" | "should_remove",
  "verdict": "ok" | "review",
  "summary": "1-2 sentence recommendation the tasker can act on"
}
Empty arrays must be []. Output ONLY the JSON.`;

  const user = `===== REVISED THINKING TRACE =====\n${revisedTrace || "(none)"}\n\n===== REVISED DRIVING PLAN =====\n${revisedPlan || "(none)"}\n\nCurrent selection: cameras = [${cameras.join(", ") || "none"}], temporal = ${temporal}.\n\nProduce the JSON.`;
  return { system, user };
}
