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
  if (first === -1) return null;
  // 1) normal case: clean slice from first { to last }
  if (last !== -1) {
    try { return JSON.parse(t.slice(first, last + 1)); } catch { /* fall through to repair */ }
  }
  // 2) repair case: response was truncated mid-JSON. Close open string + brackets (LIFO),
  //    trying progressively harder salvage steps until one parses.
  const raw = t.slice(first);
  const attempts = [];
  // helper: given a string, close any open quote + all open brackets and return candidate
  const closeUp = (str) => {
    let inStr = false, esc = false; const stack = [];
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{" || c === "[") stack.push(c);
      else if (c === "}" || c === "]") stack.pop();
    }
    let out = str;
    if (inStr) out += '"';
    out = out.replace(/,\s*$/g, "");
    for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
    return out;
  };
  // attempt A: close as-is
  attempts.push(closeUp(raw.replace(/,\s*$/g, "")));
  // attempt B: cut back to the last COMPLETE element (last '}' or ']' or a clean string end),
  //   dropping a half-written trailing key/value, then close.
  let cut = raw;
  const lastBrace = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (lastBrace > 0) {
    cut = raw.slice(0, lastBrace + 1);
    attempts.push(closeUp(cut));
  }
  // attempt C: from the cut point, also strip a dangling ',' or partial '"key":' tail then close.
  if (lastBrace > 0) {
    let tail = raw.slice(0, lastBrace + 1).replace(/,\s*"[^"]*"\s*:?\s*$/,'').replace(/,\s*$/,'');
    attempts.push(closeUp(tail));
  }
  for (const cand of attempts) {
    try { const parsed = JSON.parse(cand); if (parsed && typeof parsed === "object") return parsed; } catch { /* next */ }
  }
  return null;
}

// Returns { ok:true, analysis } | { ok:false, status, error, raw? }
export async function runOpus({ system, user, maxTokens = 16000, images = [] }) {
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
      messages: [{
        role: "user",
        content: images.length
          ? [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })), { type: "text", text: user }]
          : user,
      }],
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
