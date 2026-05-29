// lib/sectionPrompts.js
// ---------------------------------------------------------------------------
// Focused prompts for the per-section checks so taskers don't wait for the
// full sweep. Each returns { system, user } and asks for a small JSON object.
// Reuses the same domain brain as the full check.
// ---------------------------------------------------------------------------

import {
  RUBRIC_ITEMS, WRITING_PRINCIPLES, GOLDEN_PATTERNS, PLAN_STRUCTURE,
} from "./rubricKnowledge.js";

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

Compare the pre-seed trace to the revised trace. Did the tasker fix what needed fixing? Did they MISS the disengagement hazard implied by the triage note? Did they leave a risky framing unchanged (e.g. "clear road" when the triage note names a hazard)? Did they introduce new problems?

Return ONLY this JSON:
{
  "verdict": "ok" | "minor_issues" | "major_risk",
  "headline": "one sentence",
  "major_risks": [{ "code":"M#","title":"...","what":"...","why":"...","evidence":"<15-word quote or —","confirm":"what to verify on camera" }],
  "minor_flags": [{ "code":"m#","title":"...","detail":"...","evidence":"quote or —","fix":"..." }],
  "writing_issues": { "hedging_words":[], "leftover_meta_narration":[], "redundancy":[], "other":[] },
  "key_changes": ["what the tasker changed"],
  "suspicious_unchanged": ["risky things left unchanged, or []"],
  "self_review": [{ "code":"M# or m#","question":"yes/no question to confirm on camera" }]
}
Empty arrays must be []. Quotes <15 words. verdict = "major_risk" if any major_risks.`;

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

Key checks: (1) Does the Plan's action/trajectory/speed agree with the revised Trace? (2) Is the structure complete and in order? (3) Does the action follow logically from the scene (e.g. "pedestrian crossing" + "maintain speed" = contradiction)? (4) Writing quality.

Return ONLY this JSON:
{
  "verdict": "ok" | "minor_issues" | "major_risk",
  "headline": "one sentence",
  "trace_plan_consistency": { "consistent": true|false, "action_in_trace_options": true|false|"unknown", "detail":"..." },
  "structure": { "goal":true|false, "observation":true|false, "reasoning":true|false, "action":true|false, "safety":true|false, "note":"..." },
  "major_risks": [{ "code":"M#","title":"...","what":"...","why":"...","evidence":"quote or —","confirm":"..." }],
  "minor_flags": [{ "code":"m#","title":"...","detail":"...","evidence":"quote or —","fix":"..." }],
  "writing_issues": { "hedging_words":[], "leftover_meta_narration":[], "redundancy":[], "other":[] },
  "self_review": [{ "code":"M# or m#","question":"..." }]
}
Empty arrays must be []. Quotes <15 words. verdict = "major_risk" if any major_risks.`;

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
- TEMPORAL is selected when the driving decision depends on MOTION ACROSS FRAMES or a state CHANGE over time — e.g. confirming a traffic light is CHANGING (red→green), judging whether an object is MOVING into the path, or estimating another agent's speed/trajectory. A single static frame that fully supports the caption does NOT need Temporal.
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
