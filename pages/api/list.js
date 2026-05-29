// pages/api/list.js
// ---------------------------------------------------------------------------
// GET ?key=ADMIN_PASSWORD -> { rows: [...] }  (most recent 500)
// Simple shared-password gate so only the reviewer can read submissions.
// ---------------------------------------------------------------------------

import { getSupabaseAdmin } from "../../lib/supabase.js";

export default async function handler(req, res) {
  const key = req.query.key || req.headers["x-admin-key"];
  if (!process.env.ADMIN_PASSWORD || key !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: "Supabase not configured." });

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ rows: data });
}
