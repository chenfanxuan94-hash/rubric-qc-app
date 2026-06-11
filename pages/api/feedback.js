// pages/api/feedback.js — log per-issue Agree/Disagree signals; reviewer can download all.
import { getSupabaseAdmin } from "../../lib/supabase.js";

export default async function handler(req, res) {
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(500).json({ error: "Storage not configured." });

  // POST: log one or more feedback events (from the tasker UI)
  if (req.method === "POST") {
    const { events } = req.body || {};
    if (!Array.isArray(events) || !events.length) return res.status(400).json({ error: "No events." });
    const rows = events.slice(0, 50).map((e) => ({
      tasker_name: (e.taskerName || "").trim() || null,
      task_id: (e.taskId || "").trim() || null,
      code: e.code || null,
      where_field: e.where || null,
      severity: e.severity || null,
      issue_fix: e.fix || null,
      issue_why: e.why || null,
      evidence: e.evidence || null,
      action: e.action || null,
      text_changed: (typeof e.textChanged === "boolean") ? e.textChanged : null,
      note: e.note || null,
      model: e.model || null, // which model flagged the issue (v3.9)
    }));
    let { error } = await sb.from("feedback").insert(rows);
    if (error && /model/.test(error.message || "")) {
      // migration not run yet — retry without the model column so feedback is never lost
      const legacy = rows.map(({ model, ...rest }) => rest);
      ({ error } = await sb.from("feedback").insert(legacy));
    }
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, logged: rows.length });
  }

  // GET: reviewer download (password-gated)
  if (req.method === "GET") {
    const pw = req.headers["x-admin-password"] || req.query.pw;
    if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { data, error } = await sb.from("feedback").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ feedback: data || [] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
