// lib/canonical.js — full text of the authoritative Caption Labeling Canonical SOP.
// This is the ONLY source the project assistant may answer from.
export const CANONICAL_TEXT = `[Page 1]
Overview

[Page 2]
Caption Labeling Analysis: Canonical
Towards a Shared Understanding and an Excellent Pilot
Overview
What this is about
Waymo's Autonomous Driving Vehicle (ADV) generates text captions in two forms: a Thinking
Trace that captures how the vehicle's AI interpreted a scene and reasoned toward a driving
decision, and a Driving Plan that describes how and why to drive at that moment. The objective
of this work is to review, correct, and improve these captions particularly within the scenario of
what is termed Disengagement (when the human driver decided to take over) and in general,
ensuring each caption accurately reflects what the human driver actually did after taking control
of the vehicle, and that it is safe and logically sound.
Waymo has identified four capabilities that define a strong caption labeling operation:
❖ Critical analysis: the ability to watch a 30-second vehicle clip and evaluate what is
actually happening
❖ Road rules fluency: a strong understanding of US traffic law and intuition about driving
behavior
❖ Natural language: the ability to write clearly and precisely in the voice of the vehicle
❖ LLM literacy: a working understanding of how large language models reason, so that
errors in the Thinking Trace can be identified and corrected
The Core Workflow: Edit-Verify
The Pilot is a set of 40 run segments meant to evaluate the candidate Partner’s ability to deliver
high quality data within strict error budgets on Waymo’s tooling. The tool’s queue (task flow)
operates via an Edit-Verify model with two sequential passes per segment.
➔ Step 1 - Label: Reviews the camera feed, Thinking Trace, and Driving Plan. Produces a
corrected Thinking Trace and Driving Plan aligned with what the human driver actually
did, particularly in the five seconds following disengagement.
➔ Step 2 - Review: Views the Labeler's output, audits it against the Quality Rubric, corrects
anything that does not meet standard, and self-certifies a QC score. The Reviewer's
output is the final submitted label and the one Waymo measures.
➔ Note: Quality is assessed on the post-QC label. Errors caught and corrected in Step 2 do
not count against the threshold/budget.
Why this is important: High Stakes Pilot on Waymo's Tooling
This is Turing's first engagement with Waymo, and our goal, as with other clients, is to move into
a position of primary data and thought partner, delivering not just data but outcomes. The quality
of work here is our first impression and must land maximally well.

[Page 3]
Winning this contract requires clearing three bars simultaneously: outperforming an incumbent
vendor who already has a working relationship with Waymo; outperforming other new vendors
being evaluated in parallel; and, regardless of the competitive field, meeting Waymo's quality
and operational standards in absolute terms. The pilot is the primary basis for the award
decision, and it is scored to full production standards from day one.
This is why the team has been assembled the way it has. Each of you was selected for your
potential to grow and lead a team in exactly this kind of high-accountability, precision-execution
initiative. Your primary expertise does not lie in caption labeling, and parts of this work will be
repetitive. That is by design. We have deliberately put together an overqualified team due to the
strategic importance of the pilot and as the margin for error is zero, and this work rewards
judgment, rigor, and professional execution above domain familiarity.
Note: All work is conducted exclusively within Waymo’s tooling.
The Team: Roles
At present there are two primary roles within this team.
1. Labeling:
a. Emmett Ferguson (US)
b. Negar Etemadyrad (US)
c. Pratyush Dave (India)
d. Tilak Mani (India)
2. Review:
a. Fan Xuan Xuan (Overall)
Alongside the error budget our intention is to exhibit quality parity across the two locations. The
skills required across the roles are identical and we intend to train and prepare in a way such
that each team member is able to play both roles.
Timeline
Note: Phase 2, the pilot, is expected to kick off by the end of this week, i.e. around 05/22.
Phase Dates Focus
Phase 1 , Onboarding & Tool Build skills and systems needed for pilot
May 15 – May 22
Development execution
Complete all 40 segments to Waymo's
Phase 2 , Pilot Execution May 22 – May 29
quality standard
Phase 1: Onboarding and Tool Development

[Page 4]
Before the pilot queue opens, we use this window to build the skills and systems needed for
maximum performance during execution.
★ Refresh and strengthen intuition on US road rules
★ Practice LLM Thought and Plan review
★ Develop internal tooling: build the training and QA tools that will support and enable the
team
Phase 2: Pilot Execution
40 segments, split across 2 Labelers (across each location). The Reviewer acts as the final
quality gate for every segment.
Metric Target
Tasks 40 segments per location - 20 per Labeler per location
AHT per pass Under 15 minutes (Labeler and Reviewer independently)
Major errors per segment Zero
Minor errors per segment Fewer than 3
Segments with minor errors
5% or fewer
per batch
Documents
Tab / Link Contents
The complete labeling process: five steps, Reviewer protocol, writing standards,
SOP
and a worked example
Skip Criteria When to skip a segment and how to tag it correctly
Trajectory Alignment How to verify and align trajectory across the Thinking Trace and Driving Plan
(Shared on 05/18) Waymo's official labeling policy: authoritative for all rules and
[Internal] Caption Labeling: …
procedures
Checklist Waymo's pre-submit checklist: complete before every submission
Rubrics Waymo's quality rubric: 17 error types, scoring rules, and pilot success criteria

[Page 5]
SOP

[Page 6]
Labeling Standard Operating Procedure
Project: Waymo Caption Labeling Pilot
Applies to: All team members: Labelers and Reviewers
Version: 2.0 | Last updated: 2026-05-19
1. Introduction
What this work is
Waymo's autonomous vehicles generate two text outputs as they drive:
● A Thinking Trace: how the AI reasons about the scene in front of it
● A Driving Plan: what the AI intends to do and why
At certain moments, a human driver takes over from the AI. These moments, disengagements,
are captured as training data because they represent situations the AI handled incorrectly or
found challenging. The exact moment of takeover is called the critical timestamp (also referred
to in Waymo source documents as the critical iteration or critical iteration offset). Each captured
moment includes the video of the scene, the AI's Thinking Trace, and the AI's Driving Plan at
the point of takeover.
Your job is to review and correct both text outputs so they are accurate, safe, and logically follow
human driving behavior as exhibited in the scene after the moment of disengagement, grounded
in what the camera actually shows.
What the outputs must satisfy
Both the Thinking Trace and Driving Plan must meet the following requirements. These are not
guidelines — they are the standard against which your work is scored.
Thinking Trace:
1. Every object, event, and claim must be verifiable from the camera inputs you select — if
it is not visible, it does not belong in the text
2. The described trajectory and maneuver must match the human driver's actual behavior
following disengagement
Driving Plan: 3. Must be structurally consistent with the Thinking Trace — the final action
cannot contradict or extend beyond what the Thinking Trace establishes 4. Must match what the

[Page 7]
human driver actually did in the first 5 seconds after disengagement, exactly as shown in the
video — this is documentation of what occurred, not a judgment of whether it was optimal
Overriding principle: When text and camera conflict, the camera wins. Always.
What errors cost you
The quality thresholds below come from Waymo's Quality Rubrics. The scoring formula is an
internal working interpretation; the source rubric defines error categories and thresholds but
does not specify a percentage-based score. Understand both before you label a single
segment.
Scoring:
- Any Major error → score = 0% for that segment
- Minor errors reduce the segment score — exact formula in the Quality Rubrics tab
- Major penalty overrides minor penalty — major + minor errors still score 0%
Quality thresholds:
- Per segment: zero Major errors; fewer than 3 Minor errors
- Per batch: zero Major errors across the sample; no more than 5% of segments with
Minor errors
- Relabeling: maximum one round permitted per segment
One misidentified traffic light. One incorrect speed. One missed stop sign. Any of these is a
Major error and scores zero.
2. Workflow
Your role
This project uses an Edit-Verify queue: two sequential passes on every segment.
Pass Role Responsibility
Pass 1 — Labeler First rater Watches the scene, corrects
both outputs, selects minimal
camera input, submits

[Page 8]
Pass Role Responsibility
Pass 2 — Reviewer Second rater Reviews the Labeler's output
against the rubric, corrects
any remaining errors,
self-certifies the QC score
The Reviewer has full visibility into everything the Labeler submitted and can edit anything.
Quality is measured on the final post-QC output. Errors the Reviewer catches and corrects do
not count against the threshold — errors they miss do.
Time target: Each pass must be completed in under 15 minutes. The Labeler pass and
Reviewer pass are each measured independently. This is a Pilot Success Criterion per Waymo's
Quality Rubrics.
Task inputs
Review all of the following before making any edits:
Input Description
Video feed Camera views from the Waymo vehicle,
accessible in CrowdCompute
Triage comment A short note explaining why the human driver
took manual control
Critical timestamp The exact moment of disengagement — your
anchor for all edits
Pre-seed Thinking Trace AI-generated reasoning — your starting point,
not your final answer
Pre-seed Driving Plan AI-generated action plan — your starting
point, not your final answer
Text Route The route the ADV was following. If absent
from the pre-seed, write NA before submitting
Batch cadence
The full pilot is 40 segments. Work in sub-batches of 5 before continuing.
After each sub-batch of 5:

[Page 9]
- Review QC results across those 5 segments
- Identify any recurring error patterns before they compound
- Resolve interpretation questions before proceeding
This is a mandatory internal operational requirement. Waymo's Q&A recommends batches of 5;
we are treating it as non-negotiable.
3. Guidelines
Work through these five steps in order on every segment. Do not skip ahead.
Step 1 — Validate Disengagement Reason
What to do: Read the triage comment. Confirm that the object or behavior it describes is visible
in the scene, and that the resulting trajectory makes sense given what you can see.
Skip if any of the following are true:
Condition Tag
The object or behavior named in the triage #unsure_disengage_reason
comment is not visible in the scene
The reason for disengagement is present but #unsure_disengage_reason
unclear or ambiguous
The future trajectory described does not #unsure_disengage_reason
make sense given the route, image, and
triage note
The ADV has already passed the triggering #late_disengagement
object or critical moment by the timestamp
Do not skip if the cause of disengagement is visible in any of the front three cameras at the
critical timestamp and you can construct a rationale consistent with the triage note.
If no skip condition applies, proceed to Step 2.

[Page 10]
Step 2 — Validate Future Trajectory
What to do: Locate the critical timestamp in the platform UI and navigate to it.
- Timestamps are in multiples of 0.1 seconds. Truncate — do not round. Drop everything
after the first decimal place (e.g., 15114.97 → 15114.9; 15114.95 → 15114.9, not
15115.0)
- Check the three forward-facing cameras at and immediately after this timestamp
- Confirm the triggering object or event is still visible ahead
If confirmed, proceed to Step 3.
Step 3 — Revise Thinking Trace
Out of scope for this pilot: Scene Grounding (linking objects to Perception Object
IDs or coordinates) is explicitly excluded. Do not add, verify, or reference object IDs
or coordinates. See Appendix E.
Goal: A correct Thinking Trace is comprehensive, consistent, and fluent.
- Comprehensive — all major objects and events affecting the driving decision are
present and correctly described
- Consistent — the described trajectory and reasoning align with the human driver's
actual behavior and are internally coherent
- Fluent — the text is written clearly, in first person, without ambiguity or redundancy
Work through the following in order.
3a. Edit discipline
- Edit, don't rewrite. Only change what is factually wrong, logically broken, or materially
incomplete. If a sentence is correct, leave it exactly as written.
- Camera is source of truth. When text appears sound but contradicts the camera,
correct the text. Do not rationalize the discrepancy.
- Trajectory must match the human driver. The maneuver and speed profile described
in the trace must reflect what the human driver actually did after disengagement —
verified against the camera.
3b. Object accuracy — both directions
Getting objects right requires checking in both directions. Errors in either direction are scored.
Hallucination (over-inclusion):

[Page 11]
Remove any object, event, or claim that cannot be confirmed from your selected camera inputs.
This includes:
- Anything not visible in the selected cameras
- Objects visible but too far away to affect driving in the next 5 seconds (internal standard)
- Incorrectly described attributes of visible objects
Hallucinations are not equal. Know which are Major errors (score = 0%):
Hallucination type Severity
Safety or compliance issue — e.g., wrong Major
traffic light state, missed stop sign, incorrect
lane status
High-prominence object — a clearly salient Major
object that is hallucinated or materially
misdescribed
Other hallucination errors (fewer than 3 per Minor
output)
Missed objects (under-inclusion):
All major objects and events that affect the driving decision must appear in the trace and be
correctly described. If a vehicle, pedestrian, road condition, or traffic signal is visible in your
selected cameras and influences the plan — it must be in the text.
3c. Speed
The speed profile described in the Thinking Trace must match what the human driver actually
did following disengagement:
- Verify the described speed behavior (braking, accelerating, holding) against the camera
- Speed information must be consistent between the Thinking Trace and the Driving Plan
Incorrect ADV speed information is a Major error. Score = 0%.
3d. Plan options
- Modify plan options to match your updated rationale
- Options may be suboptimal but must be factually grounded in the scene — for example,
if a road hazard exists, options such as "Nudge Left," "Nudge Right," or "Hard Brake" are
appropriate if they are present in the pre-seed and grounded in the scene

[Page 12]
- Do not add options that do not exist in the pre-seed
- At least one option must align with the actual trajectory the human driver took (internal
standard — the Policy requires options to be factually grounded but does not state this
condition explicitly)
- If no pre-seed option corresponds to what the human driver actually did, escalate to the
project lead rather than adding a new option
3e. Writing standards
- First person only. Use "I" — never "we" or "you"
- No abbreviations. Write every object in full: "garbage can" not "FOD", "pedestrian" not
"ped"
- No low-confidence language (internal standard). Remove: "might", "seems",
"appears", "possibly", "likely", "I think". The trace is written from certainty, based on what
is observed
- Actions beyond 5 seconds. If a complete maneuver starts within 5 seconds but
extends slightly beyond (e.g., stopping before a stop line, changing lanes), describe the
full maneuver. Describe the next action concisely
- 3-point turns. If a 3-point turn cannot be fully described within 5 seconds, it may be
included as a complete driving option
- Remove redundancy. Cut anything repeated or logically implied
Step 4 — Revise Driving Plan
Goal: The Driving Plan must precisely match what the human driver did in the first 5 seconds
following disengagement. Not an inference, not an ideal — what the camera shows happened.
Structure
Goal → Observation → Reasoning → Action → Safety Check
(Safety Check only if present in the pre-seed)
Component What it covers
Goal Where does the ADV need to go? State the
intended route or direction — e.g., "My plan is
to proceed straight through the intersection."
Observation Which objects, signals, or conditions directly
affect the driving decision? Name them
specifically — a school bus with stop signs

[Page 13]
Component What it covers
extended, a pedestrian entering the
crosswalk, a vehicle cutting in from the left.
Reasoning Why does what was observed require a
specific response? This is the causal link —
e.g., "the school bus legally requires all traffic
to stop." Vague reasoning is a quality failure.
Action What does the ADV do in the first 5 seconds?
Speed, direction, and maneuver must match
the human driver exactly as shown in the
camera.
Safety Check How is the action executed safely? Include
only if this component appears in the
pre-seed.
Rules
- First 5 seconds are exact. Action and speed profile must reflect what the human driver
actually did — verified against the camera
- Speed must be correct and consistent. Matches the camera and is consistent with the
Thinking Trace. Incorrect speed is a Major error
- No new actions. The Driving Plan cannot include any action not already discussed in
the plan options of the Thinking Trace
- Causal clarity. The plan must state the "why" and arrive logically at the final action
- All writing standards from Step 3e apply
Step 5 — Select Minimal Input and Submit
What to do: Choose the fewest camera inputs needed to arrive at the correct driving decision.
This field must be completed — leaving it blank is a scorable error.
- Default: SVC-F. Start here on every task
- Add other cameras only if SVC-F alone is insufficient for the correct driving decision
- Add Temporal only if tracking movement across multiple frames is necessary
Available cameras:

[Page 14]
Position Camera
Front SVC-F
Front-Left SVC-FL
Front-Right SVC-FR
Side Left SVC-SL
Side Right SVC-SR
Rear-Left SVC-RL
Rear-Right SVC-RR
Rear SVC-R
Consistency check: If you reference an object only visible in SVC-FL, that camera must be
selected. If you selected a camera but reference nothing from it, deselect it.
4. Reviewer Protocol
This is not a review of the Labeler's effort — it is an independent quality gate. The Reviewer's
job is to certify that the final output meets Waymo's quality standard. The Reviewer has full
visibility into the Labeler's output and can edit anything — but approach each segment with
independent judgment, not deference to the prior pass.
Work through the following in order:
1. Validate the skip decision (if applicable) — was the tag correct and the skip justified?
2. Review the Thinking Trace against the camera: comprehensiveness, trajectory
alignment, object accuracy (both directions), speed, writing standards
3. Review the Driving Plan against the first 5 seconds: action accuracy, speed, logical
structure, consistency with the Thinking Trace
4. Review camera selection — is it the true minimum? Is it consistent with what the text
references?
5. Correct all errors directly in the platform
6. Complete the QC grid — record a grade for every question: Major error, Minor error, or
Zero errors
7. Self-certify your QC score against the Quality Rubric before submitting

[Page 15]
Sign off only when you are confident the segment meets the zero-Major-error standard. You are
accountable for what passes through.
5. Pre-Submit Checklist
Complete Waymo's Pre-Submit Checklist (tab: Checklist) before every submission —
Labeler and Reviewer alike. That document is the authoritative list.
One check from this SOP not covered in the source checklist:
Check How to verify
Text Route field If Text Route was present in the pre-seed,
confirm it is included. If absent from the
pre-seed, write NA before submitting
On the Grounding item: Waymo's source checklist ends with a "Grounding and
adding Custom point" item. This is excluded for this pilot — confirmed out of
scope by Waymo Q&A. See Appendix E.
Appendix A — Quality Rubric
See tab: Rubrics — the authoritative scoring document. It contains the full error type table
(17 error types across 4 categories), quality criteria, pilot success criteria, and the scoring grid
with worked examples.
Scoring summary for quick reference — full detail is in the source:
- Any Major error → 0%
- Minor errors reduce the segment score — exact formula in the source
- Major overrides Minor — a segment with both still scores 0%
- Thinking Trace and Driving Plan Minor hallucination errors are tracked in separate
columns in the scoring grid — each output is evaluated independently against the "less
than 3" threshold

[Page 16]
Appendix B — Terminology
Term Definition
ADV Autonomous Driving Vehicle — the Waymo
car
Disengagement The moment the ADV switches from
software-driven to human-driven
Critical timestamp The disengagement timestamp shown in the
platform UI. Also referred to in Waymo source
documents as critical iteration and critical
iteration offset — all refer to the same
moment
Pre-seed The AI-generated starting text for both the
Thinking Trace and Driving Plan
Thinking Trace Free-form description of the AI's reasoning
process leading to the driving decision
Driving Plan Free-form description of why and how to drive
at the moment of disengagement
Text Route The route the ADV was following; write NA if
absent from the pre-seed
SVC Surround View Camera
SVC-F Front-facing surround view camera — the
default minimal input
Minimal Input The minimum set of camera inputs required
to arrive at the correct driving decision.
Waymo's Policy and Rubrics use "Minimal
Input"; the Checklist occasionally uses
"Minimum Input" — these are the same field
Temporal Multi-frame view for observing object
movement over time
Edit-Verify queue Two-pass workflow: Labeler (Pass 1) then
Reviewer (Pass 2)

[Page 17]
Term Definition
Hallucination Any object, event, or claim in the text that
cannot be verified from the selected camera
inputs
Key elements The elements in the Driving Plan that directly
affect the planned trajectory or Text Route
GT trajectory Ground Truth trajectory — the actual path the
human driver took following disengagement.
Synonymous with "human driver's trajectory"
throughout these guidelines
Comprehensiveness All major objects and events affecting the
driving decision are present and correct
Consistency Trajectory, reasoning, and speed are
coherent across the Thinking Trace and
Driving Plan
Fluency Text is grammatically correct, unambiguous,
and free of low-confidence language
Appendix C — Skip Criteria
Condition Tag
Object or behavior in triage comment not #unsure_disengage_reason
visible
Reason for disengagement unclear or #unsure_disengage_reason
ambiguous
Future trajectory does not make sense given #unsure_disengage_reason
route, image, and triage note
ADV has already passed the triggering object #late_disengagement
or critical moment

[Page 18]
Appendix D — When to Use Temporal
Add Temporal only when object movement across frames is essential to the driving decision.
Common valid cases:
- A vehicle's cut-in must be tracked unfolding across frames
- Pedestrian or animal movement is critical and cannot be determined from a single frame
- A traffic light state change must be confirmed across frames
Appendix E — Scene Grounding (Out of Scope for
This Pilot)
The Waymo policy document references scene grounding — linking objects in the text to
Perception Object IDs or spatial coordinates. This is explicitly out of scope for the pilot. Do
not add, verify, or reference object IDs or coordinates. Waymo has confirmed the policy
document will be updated to reflect this.
Appendix F — Worked Example (School Bus Scene)
Sourced from the Waymo RFP. Demonstrates the level and type of editing expected.
Scene: ADV approaching a T-junction. School bus stopped in the opposite lane with lights
flashing and stop sign extended. ADV failed to stop for the active school bus.
Triage comment: svi.underyield_active_school_bus
Pre-seed Driving Plan:
"My plan is to brake and come to a complete stop behind the dark SUV ahead. This
action is necessary because the school bus has its red lights flashing and stop sign
extended..."
Corrected Driving Plan:
"My plan is to immediately brake hard and come to a complete stop before the T
junction. This action is necessary because the school bus has its red lights flashing
and stop signs extended, legally requiring all traffic to stop. I will remain stopped

[Page 19]
and wait until the bus retracts its stop sign and turns off its lights before cautiously
proceeding straight, staying mindful of the pedestrians on the sidewalk."
What changed and why:
Change Reason
"brake" → "immediately brake hard" Camera shows hard braking — speed must
match
"behind the dark SUV" → "before the T The SUV is moving past the bus and is no
junction" longer a valid stopping anchor; the T-junction
is the correct positional reference for where
the ADV should stop
"stop sign" → "stop signs" (plural) Camera shows both stop signs extended
"remain in my current lane and wait" → "Lane" reference was redundant; "stopped" is
"remain stopped and wait" more precise
Added: "wait until the bus retracts its stop Describes the full maneuver including the
sign and turns off its lights" release condition

[Page 20]
Skip Criteria

[Page 21]
Skip Criteria
Why this matters
A wrong skip decision is a Major error — score 0% for the segment. This applies in both
directions:
Error Consequence
You labeled a segment that should have been Major error
skipped
You skipped a segment that should have Major error
been labeled
There is no partial credit. Getting the skip decision right is the first gate — everything else is
downstream of it.
Decision tree
Work through these questions in order on every segment. Stop at the first "skip" answer.
None
1. Is the object or behavior named in the triage comment
visible in the scene at or around the critical timestamp?
NO ──► SKIP → #unsure_disengage_reason
YES ──► continue to 2
2. Is the reason for disengagement clear and unambiguous
from what you can see?
NO ──► SKIP → #unsure_disengage_reason
YES ──► continue to 3
3. Does the future trajectory make sense given the route,

[Page 22]
the image, and the triage note together?
NO ──► SKIP → #unsure_disengage_reason
YES ──► continue to 4
4. At the critical timestamp, is the triggering object or
critical moment still ahead of the ADV in the forward
cameras?
NO (ADV has already passed it) ──► SKIP → #late_disengagement
YES ──► DO NOT SKIP — proceed to labeling
Q4 navigation: Check frames at and immediately after the critical timestamp, not the timestamp
alone. See SOP Step 2 for the full navigation and truncation procedure.
Condition definitions
#unsure_disengage_reason — three triggers
Any one of these is sufficient to skip with this tag.
Trigger 1 — Object not visible
The triage comment names a specific object or behavior (e.g., "cut-in vehicle", "pedestrian in
crosswalk", "FOD on road"). That object or behavior cannot be found in the scene at or around
the critical timestamp in any of the forward-facing cameras.
Key distinction: you cannot find it is different from it is not there. If the scene is ambiguous or the
object is partially occluded, use your best judgment — but if you genuinely cannot identify the
triggering object, skip. Do not label a segment where you cannot confirm what caused the
disengagement.
Trigger 2 — Reason unclear
The object may be visible, but the reason it caused a disengagement is not clear from the
scene. Example: a vehicle is visible, but there is nothing about its behavior at the critical
timestamp that obviously explains a takeover. If you cannot form a coherent rationale linking the
object/behavior to the disengagement, skip.

[Page 23]
Trigger 3 — Future trajectory incoherent
Even if the disengagement reason is understandable, the trajectory the human driver would
need to take following disengagement does not make sense given the route, the image, and the
triage note together. The test is not whether the scene is ambiguous — it is whether a sensible
correction trajectory exists at all. If you cannot identify what a reasonable human driver would
do next given everything in front of you, skip.
#late_disengagement — one trigger
The ADV has already passed the triggering object or critical moment by the critical
timestamp.
Navigate to the critical timestamp. Check the three forward-facing cameras. Ask: is the
triggering object still ahead of the ADV, or has the vehicle already moved past it?
- If the object is still ahead → do not skip
- If the ADV has already passed the object → #late_disengagement
Do not skip
If all four questions in the decision tree resolve to "continue" — the object is visible, the reason
is clear, the trajectory makes sense, and the ADV has not yet passed the scene — do not skip.
Label the segment.
The policy is explicit: if the cause of disengagement is visible in any of the front three cameras
at the critical timestamp and you can construct a rationale consistent with the triage note, you
must label.
Uncertainty about how to label is not a valid skip reason. Uncertainty about whether a
disengagement is valid is.
The two Major skip errors
Error 1 — Labeled instead of skipping
You completed the labeling steps on a segment that met a skip condition. The rubric records this
as: "Failed to skip the question."

[Page 24]
Common cause: discomfort with skipping, or uncertainty about whether the skip condition truly
applies. When in doubt, re-run the decision tree. If any trigger fires, skip.
Error 2 — Skipped instead of labeling
You applied a skip tag to a segment that should have been labeled. The rubric records this as:
"Incorrectly skipped question instead of providing captions."
Common cause: the scene is complex or the object is harder to locate, and skipping feels like
the safe option. It is not — a skip on a labelable segment scores the same as a major
hallucination.
Edge cases
The object is visible but only briefly
If the triggering object appears in the scene at the critical timestamp — even briefly, even
partially — and the disengagement reason is clear, this is labelable. Brief visibility is not a skip
condition.
The triage comment uses jargon or an abbreviation
Do not skip because the triage comment is hard to parse. Expand the abbreviation, understand
what it is describing, then apply the decision tree. Example:
svi.underyield_active_school_bus — look for a school bus with stop sign extended
and lights active. If it's there, label.
Two possible triggering objects
If the scene contains more than one candidate for the disengagement cause and the triage note
is ambiguous, check whether either candidate produces a coherent rationale. If yes for either,
label based on the one that best matches. If neither produces a coherent rationale, skip with
#unsure_disengage_reason.
The ADV is very close to the object at the critical timestamp
Close is not the same as passed. The question is whether the object is still within the
forward-facing camera view ahead of the ADV. If it is — even at close range — this is not late
disengagement. Label it.

[Page 25]
Trajectory Alignment

[Page 26]
Trajectory Alignment and Speed Verification
What this covers
Trajectory alignment is the requirement that both the Thinking Trace and the Driving Plan
accurately describe what the human driver actually did following disengagement — in terms of
direction, maneuver, and speed. It is the most consequential part of the labeling task and the
source of four Major error categories.
Major error (verbatim from Waymo Quality Score
Rubrics)
Mismatch between Thinking trace caption 0%
and Human Driving
Mismatch between Thinking trace caption 0%
and Driving Plan
Incorrect information on trajectory 0%
Incorrect information on ADV Speed 0%
Getting any one of these wrong on a single segment scores zero regardless of everything else
in the output.
Step 1 — Establish ground truth from the camera
Before editing a single word, watch the camera. You cannot align text to a trajectory you have
not confirmed.
Reading trajectory
At the critical timestamp, note:
- Direction — Is the ADV going straight, turning, changing lanes, pulling over?
- Maneuver — Is there braking, acceleration, a lane change, a stop? When does it begin
relative to the timestamp?
- Objects affecting the path — What is the ADV responding to? Where is that object in
relation to the vehicle?

[Page 27]
Watch at minimum 5 seconds of footage from the critical timestamp forward. This is the window
the Driving Plan must match exactly.
Reading speed
Speed is not always labeled on screen. Use the camera to infer it:
- Hard braking — visible deceleration, objects in frame moving toward the vehicle rapidly
then slowing
- Gradual braking — steady deceleration over several seconds
- Holding speed — stable relative motion of objects in frame
- Acceleration — objects in frame receding faster over time
- Coming to a stop — motion in frame reaches zero
Check the Speed section in the task interface first — this is the primary source. Use the camera
to verify and to fill any gaps. Either way, the described speed behavior must match what you
observe.
Step 2 — Align the Thinking Trace
The Thinking Trace describes the AI's reasoning about the scene. Its trajectory content must
satisfy two conditions:
Condition A — Matches the camera
Every object, event, and spatial claim in the trace must be verifiable from the selected camera
inputs. If the trace says "the vehicle ahead is braking hard," the camera must show it.
Condition B — Matches the human driver
The maneuver and speed profile described in the trace must reflect what the human driver
actually did after disengagement. A trace that describes the AI's original (incorrect) plan —
rather than the human's corrective action — is wrong and must be fixed.
These conditions are distinct. A trace can be camera-grounded but still wrong on trajectory (it
accurately describes objects but attributes the wrong action to the ADV). Check both.
What to fix in the Thinking Trace
- Described direction or maneuver differs from what the human driver did → correct it
- Speed described does not match human driver behavior → correct it
- Trace describes a trajectory consistent with the AI's original plan rather than the human
takeover → rewrite the affected portions to reflect the human's action

[Page 28]
- Reasoning that leads logically to the wrong action → fix the reasoning chain, not just the
conclusion
What not to change
If a sentence accurately describes the scene and supports the correct trajectory, leave it. Do not
improve correct sentences. Do not add detail that is not required. Only fix what is wrong.
Writing standards
All writing standards from SOP Section 3e apply to both outputs: first person only ("I"), no
abbreviations, no low-confidence language. Do not restate them here — verify compliance as
part of your edit pass.
Step 3 — Align the Driving Plan
The Driving Plan is held to a stricter standard than the Thinking Trace: it must match the human
driver's behavior in the first 5 seconds exactly. Not approximately. Not ideally. What the camera
shows, the plan states.
The 5-second window
Start timing from the critical timestamp. The Driving Plan's Action component must describe
what the human driver did within this window:
- If the human braked to a stop in 3 seconds — the plan says the ADV brakes to a stop
- If the human accelerated and changed lanes — the plan describes that sequence
- If the human held speed and maintained lane — the plan states that
The plan does not describe what the ADV should have done. It documents what occurred.
Required structure
Goal → Observation → Reasoning → Action → Safety Check
(Safety Check only if present in the pre-seed)
Trajectory content lives primarily in Reasoning and Action:
- Reasoning — why the observed situation requires a specific response; must be
consistent with the actual trajectory
- Action — what the ADV does; must match the human driver's first 5 seconds exactly

[Page 29]
If the pre-seed's Reasoning section describes a rationale that would lead to a different action
than what the human took, fix the Reasoning. The Action must follow logically from the
Reasoning, and both must match the camera.
Speed in the Driving Plan
The Driving Plan must describe speed behavior accurately:
- State explicitly whether the ADV is braking, accelerating, holding speed, or stopping
- The described speed profile must match what the human driver did, verified from the
camera
- Speed information must be consistent with how speed is described in the Thinking Trace
— if the trace says "hard braking" and the plan says "gradual deceleration," one of them
is wrong
Step 4 — Verify Trace ↔ Plan consistency
After aligning each output to the camera independently, check that they are consistent with each
other. Two correct outputs can still contradict each other.
Check the following pairs:
Element Must match across Trace and Plan
Primary maneuver Both describe the same action (braking, lane
change, stop, etc.)
Speed profile Both describe the same speed behavior
Key objects The primary object driving the decision is the
same in both — the Trace cannot be
responding to a school bus while the Plan
responds to a pedestrian
Final action The action in the Driving Plan cannot be
absent from the plan options in the Thinking
Trace
The last point is a firm rule: the Driving Plan cannot include any action not already
discussed in the Thinking Trace's plan options.

[Page 30]
Additionally: at least one plan option in the Thinking Trace must align with the actual trajectory
the human driver took (internal standard). If the plan options cover only alternatives and none
reflects what actually happened, the options need to be revised.
Edge cases
Actions that extend beyond 5 seconds
Some maneuvers begin within the 5-second window but cannot be completed within it — a lane
change, stopping before a stop line, navigating through an intersection. In these cases:
- Describe the complete maneuver even if it extends past 5 seconds
- Describe the next action after it concisely
- Do not truncate the maneuver at 5 seconds if doing so produces an incomplete or
misleading description
The 5-second rule means the plan must be grounded in and consistent with what happened in
the first 5 seconds — not that description must stop at the 5-second mark.
3-point turns
A 3-point turn cannot be meaningfully described within a 5-second window. If the human driver
initiated a 3-point turn, it may be included as a complete driving option despite the 5-second
constraint. Describe the full maneuver.
Speed is ambiguous from the camera
If you cannot determine with confidence whether the ADV is braking hard or gradually, use the
available signals (rate of change of objects in frame, scene context, Speed section) to make a
judgment. Describe the behavior you can confirm — hard braking, gradual braking, holding
speed — without claiming precision you cannot verify. Do not use low-confidence language
("seems to be braking") — make a determination and state it.

[Page 31]
Checklist

[Page 32]
Check List How to Execute
Check the triage note and verify if the reason for disengagement
Validate the triage note
mentioned is visible in the camera view at the critical iteration
Thinking trace caption, Driving Plan and Trajectory The thinking trace and driving plan should be consistent with the
consistency actual human driving post the disengagement
Check that all objects clearly visible in the Minimum Input are
included in the caption and are correct (For example, red light
really is red, OR Pedestrian really is a pedestrian, OR Silver SUV in
front of the ADV really is a Silver SUV)
Major Hallucination
Check if you've removed unnecessary objects from the caption.
What are unnecessary objects - Objects that are too far in the
scene and do now affect driving in the next 5 secs, OR objects that
are not visible in Minimum inputs
Check if you have included all major objects and events in your
caption (for example, if a dog is crossing the street in front of the
ADV, ensure that you sufficiently mention dog in your caption, OR
Check for Missed objects/ Events
the ADV has to turn right in the future, ensure your caption says I
will change lanes to move into the shared turn lane for an
upcoming right turn)
Check that that rationale in the caption is aligning with the actual
trajectory followed by the Human Driver for up to 5 seconds after
Correct information on trajectory the focus offset, i.e when the drive switches to Manual (image)
- check if the information on trajectory is consistent across
sections
This should be checked in the Speed section if the speed is
Correct information on ADV Speed consistent with what the human driver is performing in the next 5
sec and also whether the info is consistent across sections
Check if the Preseed caption had Plan Options.
- If yes, improve these plan options. At least one of these options
should align with the actual trajectory followed by the Human
Check for Missing plan options
Driver for upto 5 secs after the focus offset, i.e. when the drive
switches to Manual.
- If no, do not add plan options to your caption.

[Page 33]
Check List How to Execute
Logical flow: recheck if the rationale includes a step-by-step
analysis leading to the final plan instead of directly jumping into
the final plan in the beginning of the caption.
Check if your statements across the caption, specifically the
Driving Plan, are following the correct logical flow: Goal →
Observation → Reasoning → Action → Safety Check
Goal: Long term where does that ADV need to go as per route plan
Observation: What all is the ADV observing in it surroundings
Reasoning: Now that the ADV has observed its surrounding, does
Check logical flow of caption
anything affect its driving in the immediate future (next 5 secs)
Action: Now that the ADV has understood its surroundings and
that something affects its driving, what is the action that the ADV
is going to take in the immediate future (next 5 secs). This should
align with the actual action that the Human Driver took for the next
5 secs from the focus offset
Safety (if present in the seed): You know the surroundings, you
know why you need to do something, you know what you need to
do, now ensure that your action is executed safely. "
Check if you have removed all redundant information from the
Remove Redundancy
preseeded caption.
Assuming you are writing your caption in a google doc instead of
the CC tool directly, use Gemini to correct your grammatical and
language errors:
- select the written text and ask gemini to correct grammatical
errors - You may use the prompt "Correct the grammar in the
selected text." Generally, Gemini is right, but feel free to reject a
modification if your original text is grammatically correct.
Grammatical & Language check - select the written text and ask gemini to list all low confidence
words - you may use the prompt "List all words in the selected text
that convey low confidence". Generally, Gemini should be able to
catch words like "might", "seems", "appears", etc. Find these words
in your text and replace or remove them(Ctrl+F).
Read the caption end to end to ensure you are grammatically
correct and are not using any terms that convey ambiguity or low
confidence

[Page 34]
Check List How to Execute
-Select SVC F and (if applicable) an additional camera view that
may be required for driving plan decision.
Align Thinking trace with the Minimal Input camera -Select Temporal if you need to refer to other frames to reach a
selection driving decision. For example, you will need to use temporal to
check if the traffic light in the immediate future has turned Green
from Red.
Ground all the objects that are critical to the driving plan at CI
frame and add smooth coordinates for objects that don't have
Grounding and adding Custom point perception objects.
Add custom points for all the associated ground level objects like
lane, lane markers, intersection, crosswalk etc.,
Word Peg Image explaining the reference
Manual

[Page 35]
Word Peg Image explaining the reference
Speed
section

[Page 36]
Rubrics

[Page 37]
Quality Rubrics
Error Categories Severity Error Type
Major Major - Failed to skip the question
Skip Question Error Major - Incorrectly skipped question instead of providing
Major
captions
Major - Mismatch between Thinking trace caption and
Major
Driving Plan
Rationale and trajectory Major - Mismatch between Thinking trace caption and
Major
consistency Error Human Driving
Major Major - Incorrect information on trajectory
Major Major - Incorrect information on ADV Speed
Major - Hallucination Fixing Error - Safety or Compliance
Major
issues
Major Major - Hallucination Fixing Error - High Prominence
Minor - less than 3 Hallucination Fixing Error in Thinking
Minor
Trace
Minor - less than 3 Hallucination Fixing Error in Driving
Minor
Hallucination fixing error, Plan
Missing Details Error
Minor - Missing Object/Event for less than 3 insignificant
Minor
objects
Minor Minor - Missing missed objects/ Events
Minor Minor - Missing plan option
Minor Minor - Not maintained the logical flow of caption
Minor Minor - Grammatical & Language Syntax error
Minor - Mismatch between Thinking trace caption and
Minor
Minimal Input Type Error Minimal Input camera selection
Minor Minor - Operator failed to select Minimal Input Field
Quality Criteria:
1. Per run segment:
a. Labeled run segment should have zero Major errors (list of major errors above)
b. Labeled run segment should have <3 Minor errors (list of minor errors above)
2. Per batch:
a. All run segment in the sample of batch should have zero Major errors
b. Not more that 5% run segments in a sample of a batch can have Minor errors
3. Relabeling:

[Page 38]
a. If a run segment does not meet the quality criteria, the run segment should be
relabeled
b. If samples in a batch do not meet the quality criteria, all run segments in that
batch should be relabeled.
c. At most one round of relabeling to be permitted per run segment.
Pilot Success Criteria
1. Meet the quality criteria above
2. AHT: Demonstrate ability to label this in <15 mins per question
Non-goal, but great to have:
1. Workflow improvement suggestions / insights
2. Suggestions to having robust quality
Scoring Grid
Scoring Criteria:
1. For any Major error, the quality score becomes 0%
2. For every minor error, the quality drops by 5%
3. Major error penalty (100%) overrides minor error penalty (5%)
Question # Major Minor Score
Skip Question Rationale and trajectory consistency Minimal Input Type Final
Error Error Hallucination fixing error, Missing Details Error Error Score
Major Major Major Major Major Major Major Major Minor Minor Minor Minor Minor Minor Minor Minor Minor

[Page 39]
Minor - Minor -
Major - Major - Major - less than Minor - Mismatch
Incorrectly Mismatch Major - Major - Hallucinat 3 Missing between Minor -
skipped between Mismatch Major - Major - Hallucination ion Fixing Hallucinat Minor - less Object/Event Minor - Minor - Not Thinking Operator
Major - question Thinking between Incorrect Incorrect Fixing Error - Error - ion Fixing than 3 for less than Missing Minor - maintained Minor - trace caption failed to
Failed to instead of trace Thinking trace informatio informatio Safety or High Error in Hallucination 3 missed Missing the logical Grammatical and Minimal select
skip the providing caption and caption and n on n on ADV Compliance Prominen Thinking Fixing Error in insignificant objects/ plan flow of & Language Input camera Minimal Final
# question captions Driving Plan Human Driving trajectory Speed issues ce Trace Driving Plan objects Events option caption Syntax error selection Input Field Score
1 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0%
2 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 95%
3 0 0 0 0 0 0 0 0 1 0 1 0 0 0 1 0 0 85%
4 0 1 0 0 0 0 0 0 1 0 1 0 0 0 1 0 0 0%
Using the scoring criteria described at the start of this section here’s how the above questions
have been scored:
1. One Major error and no minor errors - using #1 the score is 0%
2. Zero Major errors and 1 minor errors - using #2 the score is 95%
3. Zero Major errors and 3 minor errors - using #2 the score is 85%
4. One Major error and 3 minor errors - using #1 and #3 the score is 0%

[Page 40]
[WIP]

[Page 41]
Scene Understanding: ADV disregarded traffic laws while maneuvering in proximity to an
active school bus that was stopped to pick up or drop off children. The ideal behaviour is for the
ADV to stop when there is an active school bus with flashing lights ON, disregarding it being in
the oncoming lane.
Triage comment: svi.underyield_active_school_bus:
Our vehicle **fails to stop for an active school bus** (i.e., its lights are flashing, or its stop sign is
out), a critical safety violation. We should stop immediately.
Thinking trace
Preseeded Caption
The user wants me to act as a VLM and provide
a high-level driving plan based on an image and
some contextual information.
**Context:**
- **Image:** Shows a two-lane road with a yellow
school bus stopped on the right side. The bus
has its stop sign extended and red lights
flashing. Two pedestrians (likely students) are on
the sidewalk to the left of the bus. There's
another car in front of me, behind the bus. The
road has a double yellow line in the center. A
speed limit sign indicates 30 mph.
- **Route:** "In 350 meters: Continue onto
Johnson Rd NE. Continue for 75 meters then:
Slight left onto Lenox Rd NE. Continue for 2380
meters then: Turn right onto Cheshire Bridge Rd
NE. Speed limit is 30mph". The immediate
instruction is to continue straight.
- **Current Speed:** 8.8 m/s (19.7 mph).
**Analysis of the scene:**
1. **Obstacles/Hazards:**
* **Stopped School Bus:** The most critical
element. The school bus is stopped on the right
side of the road with its red lights flashing and
stop sign extended. This is a legally mandated
stop situation in the US. All traffic in both
directions must stop until the bus retracts its sign
and turns off its lights.
* **Pedestrians:** Two pedestrians are on the
sidewalk/shoulder on the left. They appear to
have just gotten off the bus or are waiting to
cross. Their presence reinforces the need to be
extremely cautious.
* **Vehicle ahead:** There is a dark-colored SUV
stopped behind the school bus. I am behind this

[Page 42]
SUV.
2. **Traffic Rules & Signs:**
* **School Bus Stop Law:** I must stop and wait
for the bus. Passing a stopped school bus with
its red lights flashing is illegal and dangerous.
* **Speed Limit:** The sign says 30 mph. My
current speed is 19.7 mph, which is below the
limit. However, the immediate situation requires
a full stop, not maintaining speed.
* **Lane Markings:** Double yellow line in the
center means no passing from either direction.
This further prohibits me from trying to go around
the bus.
3. **Route Plan vs. Immediate Situation:**
* The long-term plan is to continue straight.
* The immediate action required is to stop for the
school bus.
**Developing the Plan:**
1. **Rationale:** The primary reason for the plan
is the stopped school bus with its red lights
flashing and stop sign extended. This legally and
for safety reasons requires me to stop. The
presence of pedestrians near the bus further
emphasizes the need for caution and stopping.
2. **Trajectory:** I am already behind another
vehicle that is stopped for the bus. My trajectory
is to stay in my current lane and maintain a safe
following distance behind the vehicle in front of
me, which is also stopped. I will not attempt to
pass the bus or the vehicle in front.
3. **Speed Decision:** My current speed is 19.7
mph, but I need to stop. The vehicle in front is
already stopped. Therefore, I must brake to a
complete stop behind the lead vehicle. I will
remain stopped until the school bus retracts its
stop sign, turns off its flashing red lights, and
begins to move.
**Synthesizing the final plan:**
- **Rationale:** A school bus is stopped ahead
with its red lights flashing and stop sign
extended, which legally requires all traffic to
stop.
- **Trajectory:** I will remain in the current lane
and come to a complete stop a safe distance
behind the dark SUV that is already stopped for
the bus.
- **Speed:** I will brake to a stop and wait until
the school bus turns off its signals and resumes
motion before proceeding cautiously.
This covers all the required parts. The language

[Page 43]
should be clear and concise.
**Final Plan Formulation:**
"My plan is to brake to a complete stop behind
the dark SUV in front of me. This is because
there is a stopped school bus with its red lights
flashing and stop sign extended, which legally
requires me to stop. I will stay in my current lane
and wait until the bus retracts its signs and starts
moving before I resume driving cautiously, while
keeping an eye on the pedestrians on the left."
This is a good, comprehensive plan. It's concise
and covers all the required elements. It correctly
identifies the critical`;
