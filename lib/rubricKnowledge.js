// lib/rubricKnowledge.js
// ---------------------------------------------------------------------------
// THE BRAIN. Everything the AI checker needs to know about the Waymo Caption
// Labeling rubric, distilled from the Canonical doc + the 5 golden tasks.
// This is imported by checkPrompt.js to build the Opus 4.8 system prompt, and
// by the frontend to render the rubric reference.
// ---------------------------------------------------------------------------

export const RUBRIC_ITEMS = [
  // ---- MAJOR (each → 0% for the whole segment) ----
  { code: "M1",  sev: "major", name: "Failed to skip the question",
    textCheckable: false,
    note: "Skip-decision error. Cannot verify from text — depends on whether the triage object is visible at the critical timestamp." },
  { code: "M2",  sev: "major", name: "Incorrectly skipped instead of providing captions",
    textCheckable: false,
    note: "Skip-decision error. Brief/partial visibility is NOT a skip reason." },
  { code: "M3",  sev: "major", name: "Mismatch between Thinking Trace caption and Driving Plan",
    textCheckable: true,
    note: "The committed action in the Driving Plan must be one of the options discussed in the Trace, and the two must agree on trajectory + speed. This is text-checkable and HIGH PRIORITY." },
  { code: "M4",  sev: "major", name: "Mismatch between Thinking Trace caption and Human Driving",
    textCheckable: false,
    note: "The trace/plan must match what the human driver actually did in the 5s window. Cannot verify the ground truth from text, BUT internal logic can hint at it (e.g. observation says pedestrian crossing yet action says maintain speed)." },
  { code: "M5",  sev: "major", name: "Incorrect information on trajectory",
    textCheckable: false,
    note: "Trajectory described must be correct per forward cameras. Text can reveal internal contradictions only." },
  { code: "M6",  sev: "major", name: "Incorrect information on ADV Speed",
    textCheckable: "partial",
    note: "Speed must match the Speed-section ground truth. Text-checkable for INTERNAL consistency (trace speed vs plan speed; speed claim vs stated action e.g. 'maintain 40mph' while 'coming to a stop')." },
  { code: "M7",  sev: "major", name: "Hallucination Fixing Error — Safety or Compliance issues",
    textCheckable: "partial",
    note: "Wrong/ invented safety-critical element (traffic-signal STATE, stop sign, pedestrian, lane status) OR a safety-critical OMISSION. The category name says 'Hallucination' but the doc's examples include omissions ('missed stop sign'). Cannot verify ground truth, but can flag internal contradictions and missing-safety-element risk." },
  { code: "M8",  sev: "major", name: "Hallucination Fixing Error — High Prominence",
    textCheckable: false,
    note: "A prominent foreground object invented/ described that dominates the scene. Cannot verify from text." },

  // ---- MINOR (each → -5%) ----
  { code: "m9",  sev: "minor", name: "<3 Hallucination Fixing Error in Thinking Trace",
    textCheckable: false,
    note: "Up to 2 minor invented objects in the Trace that are NEITHER safety/compliance NOR high-prominence. If a hallucination is safety or high-prominence it escalates to M7/M8 regardless of count." },
  { code: "m10", sev: "minor", name: "<3 Hallucination Fixing Error in Driving Plan",
    textCheckable: false,
    note: "Same as m9 but in the Driving Plan. Tracked in a separate column from m9." },
  { code: "m11", sev: "minor", name: "Missing Object/Event for <3 insignificant objects",
    textCheckable: false,
    note: "Up to 2 omitted objects that do NOT affect the driving decision in the next 5s." },
  { code: "m12", sev: "minor", name: "Missing missed objects/Events",
    textCheckable: false, escalates: true,
    note: "A noteworthy omitted object. ESCALATES to M4 or M7 if the missing object is the DISENGAGEMENT CAUSE or safety-critical. This is the single most important judgment call." },
  { code: "m13", sev: "minor", name: "Missing plan option",
    textCheckable: true,
    note: "The Trace should weigh at least one alternative option, and at least one option must align with what the human driver actually did. Text-checkable: are options present? Does the committed action map to one?" },
  { code: "m14", sev: "minor", name: "Not maintained the logical flow of caption",
    textCheckable: true,
    note: "The reasoning must build step-by-step (Goal → Observation → Reasoning → Action → Safety Check) rather than jumping to a verdict. Text-checkable." },
  { code: "m15", sev: "minor", name: "Grammatical & Language Syntax error",
    textCheckable: true,
    note: "Includes low-confidence/hedging language ('appears', 'seems', 'might' are explicitly named by the SOP), run-ons, typos, and leftover meta-process narration ('the user wants me to act as a VLM', '1. Analyze the input'). Text-checkable and HIGH YIELD." },
  { code: "m16", sev: "minor", name: "Mismatch between Thinking Trace caption and Minimal Input camera selection",
    textCheckable: "partial",
    note: "Objects referenced in text must be visible in the selected cameras, and selected cameras should be referenced. Partially text-checkable if the camera selection is provided." },
  { code: "m17", sev: "minor", name: "Operator failed to select Minimal Input Field",
    textCheckable: true,
    note: "The Minimal Input field cannot be left blank. Text-checkable: is any camera selected?" },
];

// ---------------------------------------------------------------------------
// The 4-question skip decision tree (authoritative, from Workflow Sub-Flow).
// YES to all = LABEL. ANY NO = SKIP.
// ---------------------------------------------------------------------------
export const SKIP_QUESTIONS = [
  { id: "q1", q: "Can you identify the triggering object/event in the scene?",
    noMeans: "If NO → SKIP with #unsure_disengage_reason (the disengagement cause isn't visible)." },
  { id: "q2", q: "Does the disengagement make sense / is the reason clear and unambiguous?",
    noMeans: "If NO → SKIP with #unsure_disengage_reason (you can't construct a confident rationale)." },
  { id: "q3", q: "Can you understand what the driver did next (the future action/trajectory)?",
    noMeans: "If NO → SKIP (you can't describe the resulting plan)." },
  { id: "q4", q: "Is the triggering event still ahead of the ADV (not already passed)?",
    noMeans: "If NO → SKIP with #late_disengagement (the ADV has already passed the trigger)." },
];

// ---------------------------------------------------------------------------
// Driving-Plan / Thinking-Trace structure expectations.
// ---------------------------------------------------------------------------
export const TRACE_STRUCTURE = [
  "1. Analyze the input (scene, route, current state)",
  "2. Synthesize and Reason (obstacles, rules, plan options)",
  "3. Explore Alternatives (weigh options, mark best/incorrect/invalid)",
  "4. Final Plan Construction (rationale, trajectory, speed)",
];
export const PLAN_STRUCTURE = ["Goal", "Observation", "Reasoning", "Action", "Safety Check"];

// ---------------------------------------------------------------------------
// WRITING PRINCIPLES (from the Canonical SOP §3e + golden tasks).
// ---------------------------------------------------------------------------
export const WRITING_PRINCIPLES = [
  "First-person ADV voice ('I observe…', 'I will…'), not third person ('the vehicle will…').",
  "NO low-confidence / hedging language. The SOP explicitly bans 'appears', 'seems', 'might'. Also watch: 'maybe', 'possibly', 'likely', 'probably', 'could be', 'looks like', 'seemingly'.",
  "NO leftover meta-process narration in the final caption: 'The user wants me to act as a VLM', 'Analyze the input', 'Synthesize and Reason', 'Final Plan Construction', 'This covers all the required parts', 'The plan is ready to be written'. These are scaffolding the labeler is expected to strip.",
  "Remove redundancy — do not state the same fact two or three times.",
  "Be concise and factual. Describe what is actually there.",
];

// ---------------------------------------------------------------------------
// TRIAGE TAXONOMY — the real client triage codes and the CORRECT action each
// implies. The revised caption's action MUST align with the triage intent.
// (Learned from the 5 authoritative labeled examples.)
// ---------------------------------------------------------------------------
export const TRIAGE_TAXONOMY = [
  { code: "fod.non_ignorable_fod.wrong_side_nudge",
    means: "A non-ignorable FOD (an uncommon object — NOT a car/cone/normal vehicle) is in the path and the ADV nudged toward it / to the wrong side.",
    correctAction: "Identify the FOD object and nudge SAFELY AWAY from it (usually a slight lane change / nudge around), adjusting speed as needed." },
  { code: "svi.law_enforcers_and_responders.overyield_to_proceed",
    means: "The ADV is over-yielding (stopping) while a law-enforcement officer or responder is gesturing for it to PROCEED.",
    correctAction: "Proceed (move forward slowly/cautiously) in response to the officer's gesture, rather than staying stopped." },
  { code: "intersection.yellow_light.poor_stop_location",
    means: "Approaching an intersection as the light turns yellow, the ADV stops in a poor location (past the stop line / in the crosswalk).",
    correctAction: "Decelerate and come to a COMPLETE STOP at the correct position — before the stop line. (Yellow → prepare to stop, not proceed.)" },
  { code: "svi.underyield_active_school_bus",
    means: "The ADV fails to stop for an ACTIVE school bus (red lights flashing / stop sign extended) — a critical safety violation.",
    correctAction: "Stop immediately and remain stopped until the bus deactivates. (Applies to traffic in both directions on an undivided road.)" },
  { code: "fod.degraded_road",
    means: "The road surface itself is the hazard (potholes, large cracks, unpaved).",
    correctAction: "Slow down / decelerate to navigate the degraded surface carefully, then resume normal speed after passing it." },
];

// ---------------------------------------------------------------------------
// MINIMAL INPUT / TEMPORAL — verbatim from the canonical SOP (Step 5 + Appx D).
// Minimal Input = the FEWEST cameras needed to reach the correct DECISION.
// ---------------------------------------------------------------------------
export const CAMERA_LIST = ["SVC-F", "SVC-FL", "SVC-FR", "SVC-SL", "SVC-SR", "SVC-RL", "SVC-RR", "SVC-R"];

export const MINIMAL_INPUT_GUIDANCE = {
  principle: "Minimal Input = the FEWEST camera inputs needed to arrive at the CORRECT DRIVING DECISION. It is not 'every camera that shows a mentioned object'.",
  default: "Default is SVC-F on every task. Start there.",
  addMore: "Add another camera ONLY if SVC-F alone is insufficient to make the correct driving decision. An object being on the left does NOT by itself justify SVC-FL — only add it if that camera is needed to decide what to do.",
  temporal: "Add Temporal ONLY when object movement across multiple frames is essential to the decision. Canonical valid cases: a vehicle cut-in that must be tracked across frames; pedestrian/animal movement that can't be judged from one frame; a traffic-light STATE CHANGE confirmed across frames. A static object, or a signal state readable in a single frame, does NOT need Temporal.",
  consistency: "If the text references something only visible in a non-front camera, that camera must be selected (m16). If a camera is selected but nothing in the text needs it, deselect it. Blank Minimal Input is a scorable error (m17).",
  groundingOutOfScope: "Scene grounding (Perception Object IDs / coordinates like [obj](x,y,z)) is OUT OF SCOPE for this pilot. Do not add, require, reward, or reference coordinates. If the tasker added coordinates, they are unnecessary (not a major error, but can be noted).",
};

// ---------------------------------------------------------------------------
// GOLDEN-TASK PATTERNS — retrained on the 5 AUTHORITATIVE labeled examples
// (clean client versions). These are the recurring, high-signal correction
// types. We cannot see the scene, so these are framed as internal-consistency,
// triage-alignment, and plausibility checks — never ground-truth verification.
// ---------------------------------------------------------------------------
export const GOLDEN_PATTERNS = [
  {
    title: "Pre-seed MISSES the disengagement-causing hazard named by the triage",
    detail: "The triage code names a specific hazard. In Ex1 the pre-seed missed a yellow FOD object and called the road clear; in Ex5 it missed potholes and called the road clear. THE most important check: does the revised trace explicitly identify a hazard consistent with the triage code? If the triage says FOD/degraded-road/etc. and the revised trace still reads 'road is clear, following a lead car', that is a critical miss (m12 escalating to M7/M4).",
  },
  {
    title: "Revised action must MATCH the triage intent",
    detail: "Each triage code implies one correct action (FOD → nudge away; overyield → proceed when gestured; yellow-light → stop at the line; school-bus → stop; degraded-road → slow down). Check the revised plan's committed action against the triage intent. Ex2: pre-seed stayed stopped, but the triage is 'overyield_to_proceed' so the correct action is to PROCEED when the officer gestures. Ex3: pre-seed proceeded through on 'green' but the triage is a yellow light, so the correct action is to STOP at the line.",
  },
  {
    title: "Safety-critical attribute WRONG in pre-seed (esp. traffic-signal state)",
    detail: "Ex3: pre-seed said the light was GREEN; it was YELLOW, which flips the decision from 'proceed with turn' to 'stop at the line'. Check that any stated signal state is consistent with the committed action: green → proceed; yellow/red → stop or prepare to stop. A trace that says 'red/yellow' but 'I proceed' is an internal contradiction pointing at M7.",
  },
  {
    title: "Ego's OWN lane position is frequently wrong in pre-seed",
    detail: "All 5 examples corrected the ego's own lane (leftmost→rightmost, right→middle, center→rightmost, etc.). Check the ego lane is stated clearly and used consistently throughout (a plan that references two different ego lanes, or 'stay in current lane' after naming the wrong lane, is inconsistent).",
  },
  {
    title: "Phantom 'lead vehicle' that is actually in an ADJACENT lane",
    detail: "Ex1, Ex4, Ex5: the pre-seed framed a vehicle as a same-lane 'lead car I am following' when it was actually in an ADJACENT lane. A car in an adjacent lane is NOT a lead vehicle and must not drive a 'maintain following distance' plan. Check: if the trace says 'following the lead vehicle / car-following', is that consistent with the rest of the description, or is that car actually in another lane?",
  },
  {
    title: "Wrong DYNAMIC state of another agent",
    detail: "Ex2: the pre-seed said the blue car ahead was 'stopped' when it was actually MOVING slowly — and the correct plan (follow it through) depends on that. Check whether the stated motion state of key agents is consistent with the committed action.",
  },
  {
    title: "Action must follow from the corrected observations; speed must match the hazard",
    detail: "Once the real hazard is identified, trajectory + speed must change to match (Ex1 nudge + decelerate; Ex3 stop; Ex5 decelerate over potholes). 'Accelerate to speed limit' while a hazard is in the lane is a contradiction. Observation 'pedestrian/object in my path' + Action 'maintain speed' = contradiction (M4-type).",
  },
  {
    title: "Trace ↔ Plan consistency (M3)",
    detail: "The Driving Plan's committed action, trajectory, and speed must match the Trace's final plan and be one of the Trace's discussed options. Diverging verbs (Trace concludes 'stop/nudge' but Plan says 'continue/maintain') = M3, a Major.",
  },
  {
    title: "Strip meta-process scaffolding from the final caption",
    detail: "Ex4's revised version removed sections like '5. Refine the output to match the requested format' and 'Drafting the final output'. Leftover scaffolding — 'The user wants me to act as a VLM', 'Analyze the input', 'This covers all the required parts', 'The plan is ready to be written' — should be cleaned out (m15).",
  },
  {
    title: "Partial edits / leftovers and redundancy",
    detail: "Watch for a fact corrected in one section but the OLD version still present elsewhere, and for the same fact repeated multiple times. The labeler is expected to delete redundant pre-seed details, not leave both versions in.",
  },
];

// ---------------------------------------------------------------------------
// CORE ANALYSIS PRINCIPLE — what may be flagged vs. what is only a camera check.
// (Fixes the failure mode of labeling camera-verification items as rubric errors.)
// ---------------------------------------------------------------------------
export const FLAG_DISCIPLINE = {
  rule: "A finding may be a MAJOR or MINOR rubric flag ONLY if it is DEMONSTRABLE FROM THE TEXT ALONE. If confirming it requires looking at the camera, it is NOT a flag — it goes in camera_checks as a short verification prompt.",
  textDemonstrable: [
    "Internal contradiction (two statements in the text disagree) — e.g. 'middle lane' vs 'right-most lane'; 'maintain 40 mph' vs 'brake to a stop'.",
    "Trace↔Plan mismatch (M3): the plan's action/trajectory/speed doesn't match the trace's final plan, or isn't one of the trace's options.",
    "Leftover / partial edit: a claim changed in one place but the old version still appears elsewhere.",
    "Hedging / low-confidence language (m15 fluency): 'appears', 'seems', 'might', 'likely', 'possibly', 'could be'.",
    "Grammar / syntax / leftover meta-narration (m15): 'the user wants me to act as a VLM', 'Analyze the input', 'This covers all the required parts'.",
    "Broken logical flow / missing plan structure (m14): not Goal→Observation→Reasoning→Action.",
    "Genuine verbatim redundancy (same sentence repeated to no purpose). NOTE: Rationale, Trajectory, and Speed naturally restate the situation — that is correct structure, NOT redundancy. Only flag true duplicated content.",
    "Triage-intent mismatch you can see in the text (e.g. triage says 'overyield → proceed' but the committed action is still 'remain stopped').",
  ],
  cameraOnly: [
    "Whether an object/event actually exists in the scene (e.g. is the officer really gesturing PROCEED vs STOP; is there really an object in the lane; is the light actually yellow).",
    "The true trajectory, the true speed, the true signal state.",
    "Whether something is genuinely missing from the scene.",
    "These become SHORT camera checks, e.g. 'Officer gesturing proceed?', 'Object in lane?', 'Light yellow?'. Do NOT phrase them as rubric violations and do NOT assign them a Major/minor code.",
  ],
};

// Quick lookup helpers
export const MAJOR_CODES = RUBRIC_ITEMS.filter(r => r.sev === "major").map(r => r.code);
export const MINOR_CODES = RUBRIC_ITEMS.filter(r => r.sev === "minor").map(r => r.code);
