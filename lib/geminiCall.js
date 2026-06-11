// lib/geminiCall.js
// ---------------------------------------------------------------------------
// Adapter so the same prompts we send to Anthropic can run on Gemini, returning
// the SAME parsed-JSON shape ({ ok, analysis, ms } | { ok:false, status, error }).
// Uses Google's v1beta generateContent REST API with forced JSON output.
// ---------------------------------------------------------------------------

import { extractJson } from "./anthropicCall.js";

// Returns { ok:true, analysis, ms } | { ok:false, status, error, raw?, ms }
export async function runGemini({ system, user, model, thinkingLevel, maxTokens = 24000, images = [] }) {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, status: 500, error: "GEMINI_API_KEY is not set on the server (add it in Vercel → Settings → Environment Variables, then redeploy)." };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const generationConfig = {
    responseMimeType: "application/json",
    maxOutputTokens: maxTokens,
    temperature: 1,
  };
  // correct REST shape: generationConfig.thinkingConfig.thinkingLevel (UPPERCASE value)
  if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: String(thinkingLevel).toUpperCase() };

  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [...images.map((im) => ({ inline_data: { mime_type: im.media_type, data: im.data } })), { text: user }] }],
    generationConfig,
  };

  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    const ms = Date.now() - t0;

    if (!r.ok) {
      const apiMsg = data?.error?.message || `Gemini API error (HTTP ${r.status}).`;
      let hint = "";
      if (r.status === 400 && /API key/i.test(apiMsg)) hint = " — your GEMINI_API_KEY looks invalid.";
      else if (r.status === 403) hint = " — permission denied; check the key / API access.";
      else if (r.status === 429) hint = " — rate limited; wait a moment and retry.";
      return { ok: false, status: r.status, error: apiMsg + hint, ms };
    }

    // Surface explicit blocks / truncation
    const cand = data?.candidates?.[0];
    if (!cand) {
      const blocked = data?.promptFeedback?.blockReason;
      return { ok: false, status: 200, error: blocked ? `Gemini blocked the request (${blocked}).` : "Gemini returned no candidates.", ms };
    }
    // answer text = all non-thought text parts joined
    const text = (cand.content?.parts || [])
      .filter((p) => p && typeof p.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();

    const analysis = extractJson(text);
    if (!analysis) {
      const fin = cand.finishReason ? ` (finishReason: ${cand.finishReason})` : "";
      return { ok: false, status: 200, error: "Gemini did not return parseable JSON" + fin + ".", raw: text, ms };
    }
    return { ok: true, analysis, ms };
  } catch (err) {
    const ms = Date.now() - t0;
    return { ok: false, status: 500, error: err?.message || "Gemini call failed.", ms };
  }
}
