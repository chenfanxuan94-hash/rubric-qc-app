// pages/api/check.js — full 17-item sweep.
// Default (no modelId / "opus48") = the same Opus call as always.
// Optional modelId "gpt55" | "gem31pro" runs the SAME prompts on that model,
// so taskers can get a second/third opinion in parallel tabs.
import { runOpus } from "../../lib/anthropicCall.js";
import { runGemini } from "../../lib/geminiCall.js";
import { runOpenAI } from "../../lib/openaiCall.js";
import { checkModelById } from "../../lib/checkModels.js";
import { buildSystemPrompt, buildUserMessage } from "../../lib/checkPrompt.js";

export const config = { maxDuration: 800, api: { bodyParser: { sizeLimit: "12mb" } } };

// parse client frames ({d,view,t} or legacy data-URL strings) -> [{media_type, data, view, t}]
function parseFrames(frames) {
  if (!Array.isArray(frames)) return [];
  const out = [];
  let total = 0;
  for (const f of frames.slice(0, 16)) {
    const url = typeof f === "string" ? f : (f && f.d);
    const m = typeof url === "string" && url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) continue;
    if (m[2].length > 1200000) continue; // ~0.9MB per frame max
    total += m[2].length;
    if (total > 4500000) break; // total payload guard (~3.4MB binary)
    out.push({ media_type: m[1], data: m[2], view: (f && f.view) || "grid", t: (f && typeof f.t === "number") ? f.t : null });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const payload = req.body || {};
  if (!payload.revisedTrace && !payload.revisedPlan) {
    return res.status(400).json({ error: "Provide at least a revised trace or revised plan." });
  }

  const images = parseFrames(payload.frames);
  const { frames, ...rest } = payload;
  const system = buildSystemPrompt();
  const user = buildUserMessage({ ...rest, frameCount: images.length, frameMeta: images.map((im) => ({ view: im.view, t: im.t })) });
  const m = checkModelById(payload.modelId || "opus48");
  const t0 = Date.now();

  let result;
  if (!m || m.vendor === "anthropic") {
    // unchanged default path (env-configured Opus)
    result = await runOpus({ system, user, maxTokens: 16000, images });
  } else if (m.vendor === "gemini") {
    result = await runGemini({ system, user, model: m.model, thinkingLevel: m.thinkingLevel, maxTokens: 32000, images });
  } else {
    result = await runOpenAI({ system, user, model: m.model, effort: m.effort, maxTokens: 45000, images });
  }

  const ms = result.ms ?? (Date.now() - t0);
  if (!result.ok) return res.status(result.status).json({ error: result.error, raw: result.raw || null, ms });
  return res.status(200).json({ analysis: result.analysis, ms });
}
