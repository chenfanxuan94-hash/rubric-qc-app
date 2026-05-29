// lib/anthropicCall.js
// ---------------------------------------------------------------------------
// One place for the Opus 4.8 call + robust JSON extraction, so every route
// (full check + section checks) behaves identically and surfaces real errors.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const EFFORT = process.env.ANTHROPIC_EFFORT || "max";

export function extractJson(text) {
  if (!text) return null;
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(t.slice(first, last + 1));
  } catch {
    return null;
  }
}

// Returns { ok:true, analysis } | { ok:false, status, error, raw? }
export async function runOpus({ system, user, maxTokens = 16000 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, status: 500, error: "ANTHROPIC_API_KEY is not set on the server (add it in Vercel → Settings → Environment Variables, then redeploy)." };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT },
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = (msg.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const analysis = extractJson(text);
    if (!analysis) return { ok: false, status: 200, error: "Model did not return parseable JSON.", raw: text };
    return { ok: true, analysis };
  } catch (err) {
    // Surface the REAL reason (auth, billing, rate limit, etc.)
    const status = err?.status || 500;
    const apiMsg = err?.error?.error?.message || err?.error?.message || err?.message || "Anthropic API call failed.";
    let hint = "";
    if (status === 401) hint = " — your ANTHROPIC_API_KEY looks invalid.";
    else if (status === 403) hint = " — permission denied; check the key and that billing is enabled.";
    else if (status === 400 && /credit|billing|balance/i.test(apiMsg)) hint = " — looks like a billing/credit issue on the Anthropic account.";
    else if (status === 429) hint = " — rate limited; wait a moment and retry.";
    return { ok: false, status, error: apiMsg + hint };
  }
}
