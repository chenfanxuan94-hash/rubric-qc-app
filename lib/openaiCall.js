// lib/openaiCall.js
// ---------------------------------------------------------------------------
// Adapter so the same prompts run on GPT-5.5, returning the SAME parsed-JSON
// shape ({ ok, analysis, ms } | { ok:false, status, error }).
// Uses the Chat Completions API with reasoning_effort + JSON-object output.
// Reasoning models count "thinking" tokens toward max_completion_tokens, so
// the budget is generous.
// ---------------------------------------------------------------------------

import { extractJson } from "./anthropicCall.js";

// Returns { ok:true, analysis, ms } | { ok:false, status, error, raw?, ms }
export async function runOpenAI({ system, user, model, effort = "high", maxTokens = 45000, images = [] }) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, status: 500, error: "OPENAI_API_KEY is not set on the server (add it in Vercel → Settings → Environment Variables, then redeploy)." };
  }
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: images.length
          ? [...images.map((im) => ({ type: "image_url", image_url: { url: `data:${im.media_type};base64,${im.data}` } })), { type: "text", text: user }]
          : user },
    ],
    reasoning_effort: effort,            // low | medium | high | xhigh
    response_format: { type: "json_object" }, // force valid JSON (prompt already asks for JSON)
    max_completion_tokens: maxTokens,    // reasoning models: includes reasoning tokens
  };

  const t0 = Date.now();
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    const ms = Date.now() - t0;

    if (!r.ok) {
      const apiMsg = data?.error?.message || `OpenAI API error (HTTP ${r.status}).`;
      let hint = "";
      if (r.status === 401) hint = " — your OPENAI_API_KEY looks invalid.";
      else if (r.status === 429) hint = " — rate limited or out of quota.";
      else if (r.status === 400 && /model/i.test(apiMsg)) hint = " — check the model string (gpt-5.5).";
      return { ok: false, status: r.status, error: apiMsg + hint, ms };
    }

    const choice = data?.choices?.[0];
    const finish = choice?.finish_reason;
    const text = (choice?.message?.content || "").trim();
    const analysis = extractJson(text);
    if (!analysis) {
      let msg = "GPT did not return parseable JSON.";
      if (finish === "length") msg = "GPT hit the token limit before finishing the JSON (raise maxTokens or lower effort).";
      else if (!text) msg = "GPT returned no answer text (likely spent the whole budget on reasoning — raise maxTokens or lower effort).";
      return { ok: false, status: 200, error: msg, raw: text, ms };
    }
    return { ok: true, analysis, ms };
  } catch (err) {
    const ms = Date.now() - t0;
    return { ok: false, status: 500, error: err?.message || "OpenAI call failed.", ms };
  }
}
