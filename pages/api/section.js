// pages/api/section.js
// POST { mode: "trace"|"plan"|"camera", ...fields } -> { analysis } | { error, raw? }
import { runOpus } from "../../lib/anthropicCall.js";
import { traceCheck, planCheck, cameraCheck } from "../../lib/sectionPrompts.js";

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};
  const mode = b.mode;

  let prompt;
  if (mode === "trace") {
    if (!b.revisedTrace) return res.status(400).json({ error: "Add your revised thinking trace first." });
    prompt = traceCheck(b);
  } else if (mode === "plan") {
    if (!b.revisedPlan) return res.status(400).json({ error: "Add your revised driving plan first." });
    prompt = planCheck(b);
  } else if (mode === "camera") {
    if (!b.revisedTrace && !b.revisedPlan) return res.status(400).json({ error: "Add a trace or plan first so the advisor has text to read." });
    prompt = cameraCheck(b);
  } else {
    return res.status(400).json({ error: "Unknown mode." });
  }

  const result = await runOpus({ system: prompt.system, user: prompt.user, maxTokens: mode === "camera" ? 4000 : 12000 });
  if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw || null });
  return res.status(200).json({ analysis: result.analysis });
}
