// pages/api/questions.js — reviewer: list open questions, or mark one resolved. Password-gated.
import { getSupabaseAdmin } from "../../lib/supabase.js";

export default async function handler(req, res) {
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(500).json({ error: "Storage not configured." });

  if (req.method === "GET") {
    const pw = req.headers["x-admin-password"] || req.query.pw;
    if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { data, error } = await sb.from("open_questions").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ questions: data || [] });
  }

  if (req.method === "POST") {
    const { id, resolved, password } = req.body || {};
    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!id) return res.status(400).json({ error: "Missing id." });
    const { error } = await sb.from("open_questions").update({ resolved: !!resolved }).eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
