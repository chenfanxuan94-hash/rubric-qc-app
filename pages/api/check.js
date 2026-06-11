// pages/api/check.js — full 17-item sweep.
// Default (no modelId / "opus48") = the same Opus call as always.
// Optional modelId "gpt55" | "gem31pro" runs the SAME prompts on that model,
// so taskers can get a second/third opinion in parallel tabs.
import { runOpus } from "../../lib/anthropicCall.js";
import { runGemini } from "../../lib/geminiCall.js";
import { runOpenAI } from "../../lib/openaiCall.js";
import { checkModelById } from "../../lib/checkModels.js";
import { buildSystemPrompt, buildUserMessage } from "../../lib/checkPrompt.js";

export const config = { maxDuration: 800 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const payload = req.body || {};
  if (!payload.revisedTrace && !payload.revisedPlan) {
    return res.status(400).json({ error: "Provide at least a revised trace or revised plan." });
  }

  const system = buildSystemPrompt();
  const user = buildUserMessage(payload);
  const m = checkModelById(payload.modelId || "opus48");
  const t0 = Date.now();

  let result;
  if (!m || m.vendor === "anthropic") {
    // unchanged default path (env-configured Opus)
    result = await runOpus({ system, user, maxTokens: 16000 });
  } else if (m.vendor === "gemini") {
    result = await runGemini({ system, user, model: m.model, thinkingLevel: m.thinkingLevel, maxTokens: 32000 });
  } else {
    result = await runOpenAI({ system, user, model: m.model, effort: m.effort, maxTokens: 45000 });
  }

  const ms = result.ms ?? (Date.now() - t0);
  if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw || null, ms });
  return res.status(200).json({ analysis: result.analysis, ms });
}
