// pages/api/chat.js — canonical-grounded assistant. Logs unanswerable questions for the reviewer.
import { runOpus } from "../../lib/anthropicCall.js";
import { buildChatSystem, buildChatUser } from "../../lib/chatPrompt.js";
import { getSupabaseAdmin } from "../../lib/supabase.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { question, history, askerName } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: "Empty question." });

  const result = await runOpus({
    system: buildChatSystem(),
    user: buildChatUser(question.trim(), Array.isArray(history) ? history : []),
    maxTokens: 1200,
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const a = result.analysis || {};
  const answerable = a.answerable === true && a.answer && a.answer.trim();

  // If not answerable, log it for the reviewer to address at sync.
  if (!answerable) {
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        await sb.from("open_questions").insert({
          question: question.trim(),
          asker_name: (askerName || "").trim() || null,
          resolved: false,
        });
      }
    } catch (e) { /* logging is best-effort; never block the user */ }
  }

  return res.status(200).json({
    answerable: !!answerable,
    answer: answerable ? a.answer.trim() : "",
    quote: a.quote || "",
    page: a.page || "",
  });
}
