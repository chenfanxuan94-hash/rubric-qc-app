// pages/api/submit.js
// ---------------------------------------------------------------------------
// POST a full submission (form fields + the AI analysis) -> saves to Supabase.
// Returns { ok: true, id } or { error }.
// ---------------------------------------------------------------------------

import { getSupabaseAdmin } from "../../lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({
      error: "Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).",
    });
  }

  const b = req.body || {};
  if (!b.taskId) {
    return res.status(400).json({ error: "Task ID is required to submit." });
  }

  const analysis = b.analysis || null;
  const majorFlags = analysis?.major_risks?.length || 0;
  const minorFlags =
    (analysis?.minor_flags?.length || 0) +
    (analysis?.writing_issues
      ? (analysis.writing_issues.hedging_words?.length || 0) +
        (analysis.writing_issues.leftover_meta_narration?.length || 0) +
        (analysis.writing_issues.redundancy?.length || 0)
      : 0);

  const row = {
    tasker_name: b.taskerName || null,
    task_id: String(b.taskId),
    triage_note: b.triageNote || null,
    skipped: !!b.skipped,
    skip_answers: b.skipAnswers || {},
    preseed_trace: b.preseedTrace || null,
    revised_trace: b.revisedTrace || null,
    preseed_plan: b.preseedPlan || null,
    revised_plan: b.revisedPlan || null,
    cameras: b.cameras || [],
    temporal: !!b.temporal,
    label_answers: b.labelAnswers || {},
    section_results: b.sectionResults || null,
    ai_analysis: analysis,
    ai_verdict: analysis?.verdict || null,
    major_flags: majorFlags,
    minor_flags: minorFlags,
  };

  const { data, error } = await supabase
    .from("submissions")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("submit error:", error);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ ok: true, id: data.id });
}
