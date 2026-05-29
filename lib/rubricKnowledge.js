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
// GOLDEN-TASK PATTERNS — the recurring correction types observed across the 5
// preseed→revised golden examples. These are the highest-signal things the AI
// should look for. (We cannot see the scene, so these are framed as
// internal-consistency and plausibility checks, not ground-truth verification.)
// ---------------------------------------------------------------------------
export const GOLDEN_PATTERNS = [
  {
    title: "Pre-seed often MISSES the disengagement-causing hazard",
    detail: "In Task 1 the pre-seed missed a yellow FOD object in the lane; in Task 5 it missed potholes and called the road 'clear'. The triage note names the hazard type — the revised trace MUST describe a hazard consistent with the triage note. If the triage note says there is a FOD / hazard / obstacle and the revised trace still reads as 'clear road, just following a lead car', that is a red flag for an M12-escalating-to-M7 miss. CHECK: does the revised trace identify a hazard consistent with the triage note?",
  },
  {
    title: "Safety-critical attribute WRONG in pre-seed (esp. traffic-signal state)",
    detail: "In Task 3 the pre-seed said the light was GREEN; it was actually YELLOW (about to turn red), which flips the entire decision from 'proceed with turn' to 'stop at the line'. CHECK: is the stated signal state consistent with the action? Green→proceed; Yellow/Red→stop or prepare to stop. A trace that says 'red light' but 'I proceed through' is an internal contradiction pointing at M7.",
  },
  {
    title: "Ego lane position frequently wrong in pre-seed",
    detail: "Tasks 1,2,4,5 all corrected the ego's own lane (leftmost→rightmost, rightmost→middle, etc.). CHECK: is the ego lane stated clearly and used consistently throughout (a plan that says 'stay in current lane' but earlier said two different lanes is inconsistent).",
  },
  {
    title: "Phantom 'lead vehicle' relationship",
    detail: "In Tasks 1, 4, 5 the pre-seed framed a vehicle as a same-lane 'lead car I am following' when it was actually in an ADJACENT lane. CHECK: if the trace says 'following the lead vehicle' / 'car-following', is that consistent with the rest of the description? A car in an adjacent lane is not a lead vehicle and should not drive a 'maintain following distance' plan.",
  },
  {
    title: "Action must follow from the corrected observations",
    detail: "Once the real hazard is identified, the trajectory + speed must change to match (Task 1 nudge around object; Task 3 stop for yellow; Task 5 decelerate over potholes). CHECK: does the Action logically follow from the Observation and Reasoning? Observation 'pedestrian crossing my path' + Action 'maintain speed' = contradiction (M4-type).",
  },
  {
    title: "Speed decision must match the hazard",
    detail: "CHECK: is the speed decision consistent with the scene? 'Accelerate to speed limit' while a hazard is in the lane is a contradiction. Speed claims in the Trace and Plan must also match each other (M6).",
  },
  {
    title: "Trace ↔ Plan consistency (M3)",
    detail: "The Driving Plan's committed action, trajectory, and speed must match the Trace's final plan and must be one of the Trace's discussed options. Diverging action verbs (Trace concludes 'brake/stop' but Plan says 'continue') = M3, a Major.",
  },
];

// Quick lookup helpers
export const MAJOR_CODES = RUBRIC_ITEMS.filter(r => r.sev === "major").map(r => r.code);
export const MINOR_CODES = RUBRIC_ITEMS.filter(r => r.sev === "minor").map(r => r.code);
