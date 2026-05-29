// pages/api/check.js — full 17-item sweep. Uses shared Opus helper.
import { runOpus } from "../../lib/anthropicCall.js";
import { buildSystemPrompt, buildUserMessage } from "../../lib/checkPrompt.js";

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const payload = req.body || {};
  if (!payload.revisedTrace && !payload.revisedPlan) {
    return res.status(400).json({ error: "Provide at least a revised trace or revised plan." });
  }
  const result = await runOpus({
    system: buildSystemPrompt(),
    user: buildUserMessage(payload),
    maxTokens: 16000,
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw || null });
  return res.status(200).json({ analysis: result.analysis });
}
