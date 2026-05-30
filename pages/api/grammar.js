// pages/api/grammar.js — comprehensive mechanical grammar sweep (separate from rubric check)
import { runOpus } from "../../lib/anthropicCall.js";
import { buildGrammarSystem, buildGrammarUser } from "../../lib/grammarPrompt.js";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const payload = req.body || {};
  if (!payload.revisedTrace && !payload.revisedPlan) {
    return res.status(400).json({ error: "Nothing to check." });
  }
  const result = await runOpus({
    system: buildGrammarSystem(),
    user: buildGrammarUser(payload),
    maxTokens: 8000,
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw || null });
  return res.status(200).json({ grammar: result.analysis });
}
