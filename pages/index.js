// pages/index.js
import { useState } from "react";
import { SKIP_QUESTIONS } from "../lib/rubricKnowledge.js";

const CAMERAS = ["SVC-F", "SVC-FL", "SVC-FR", "SVC-L", "SVC-R", "SVC-B"];

async function callApi(url, body, ms = 290000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) {
      const msg = (data && data.error) ? data.error
        : `Server returned ${r.status}. ${r.status === 504 ? "The AI call timed out — set ANTHROPIC_EFFORT to 'high' in Vercel and redeploy, or retry." : ""}`;
      return { error: msg, raw: data?.raw || null };
    }
    if (!data) return { error: "Empty response from server." };
    return data;
  } catch (e) {
    if (e.name === "AbortError") return { error: "Request timed out (~5 min). Opus at 'max' effort can exceed Vercel's limit — set ANTHROPIC_EFFORT to 'high' and redeploy." };
    return { error: "Network error: " + e.message };
  } finally {
    clearTimeout(timer);
  }
}

export default function Home() {
  const [taskerName, setTaskerName] = useState("");
  const [taskId, setTaskId] = useState("");
  const [triageNote, setTriageNote] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [skipAnswers, setSkipAnswers] = useState({});
  const [preseedTrace, setPreseedTrace] = useState("");
  const [revisedTrace, setRevisedTrace] = useState("");
  const [preseedPlan, setPreseedPlan] = useState("");
  const [revisedPlan, setRevisedPlan] = useState("");
  const [cameras, setCameras] = useState([]);
  const [temporal, setTemporal] = useState(false);

  const [S, setS] = useState({
    trace: { loading: false, res: null, err: null },
    plan: { loading: false, res: null, err: null },
    camera: { loading: false, res: null, err: null },
    full: { loading: false, res: null, err: null, raw: null },
  });
  const upd = (k, patch) => setS((s) => ({ ...s, [k]: { ...s[k], ...patch } }));

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);

  const setSkip = (id, val) => setSkipAnswers((s) => ({ ...s, [id]: s[id] === val ? "" : val }));
  const toggleCam = (c) => setCameras((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const base = () => ({
    taskerName, taskId, triageNote, skipped, skipAnswers,
    preseedTrace, revisedTrace, preseedPlan, revisedPlan, cameras, temporal,
  });

  async function checkTrace() {
    upd("trace", { loading: true, err: null, res: null });
    const d = await callApi("/api/section", { mode: "trace", ...base() });
    upd("trace", { loading: false, res: d.analysis || null, err: d.error || null });
  }
  async function checkPlan() {
    upd("plan", { loading: true, err: null, res: null });
    const d = await callApi("/api/section", { mode: "plan", ...base() });
    upd("plan", { loading: false, res: d.analysis || null, err: d.error || null });
  }
  async function checkCamera() {
    upd("camera", { loading: true, err: null, res: null });
    const d = await callApi("/api/section", { mode: "camera", ...base() });
    upd("camera", { loading: false, res: d.analysis || null, err: d.error || null });
  }
  async function checkFull() {
    setSubmitted(false);
    upd("full", { loading: true, err: null, res: null, raw: null });
    const d = await callApi("/api/check", base());
    upd("full", { loading: false, res: d.analysis || null, err: d.error || null, raw: d.raw || null });
  }

  async function submit() {
    setSubmitErr(null);
    if (!taskId.trim()) { setSubmitErr("Task ID is required to submit."); return; }
    setSubmitting(true);
    const d = await callApi("/api/submit", {
      ...base(),
      analysis: S.full.res,
      sectionResults: { trace: S.trace.res, plan: S.plan.res, camera: S.camera.res },
    }, 30000);
    setSubmitting(false);
    if (d.error) setSubmitErr(d.error); else setSubmitted(true);
  }

  function resetForNext() {
    setTaskId(""); setTriageNote(""); setSkipped(false); setSkipAnswers({});
    setPreseedTrace(""); setRevisedTrace(""); setPreseedPlan(""); setRevisedPlan("");
    setCameras([]); setTemporal(false);
    setS({ trace: { loading: false, res: null, err: null }, plan: { loading: false, res: null, err: null }, camera: { loading: false, res: null, err: null }, full: { loading: false, res: null, err: null, raw: null } });
    setSubmitted(false); setSubmitErr(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <header className="app-header">
        <div className="wrap row">
          <div>
            <div className="eyebrow">Caption Labeling · Pre-Submission QC</div>
            <h1>Rubric QC Tool</h1>
            <div className="sub">Check each section as you go, or run a full review at the end. Powered by Opus 4.8.</div>
          </div>
          <a className="adminlink" href="/admin">Reviewer view →</a>
        </div>
      </header>

      <div className="wrap">
        <div className="disclaimer">
          <span className="ico">⚠️</span>
          <p><strong>The AI cannot see the camera footage.</strong> It reviews your text and gives a self-review checklist for anything needing the cameras. <strong>A clean result is not a guarantee the segment is correct.</strong> Each check can take 30–120s at max effort.</p>
        </div>

        <div className="card">
          <h2><span className="n">1</span> Task</h2>
          <div className="two-col">
            <div className="field"><label>Your name</label>
              <input type="text" value={taskerName} onChange={(e) => setTaskerName(e.target.value)} placeholder="e.g. Emmett" /></div>
            <div className="field"><label>Task ID <span className="hint">(required)</span></label>
              <input type="text" value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="e.g. seg_4471_az" /></div>
          </div>
          <div className="field"><label>Triage note</label>
            <textarea value={triageNote} onChange={(e) => setTriageNote(e.target.value)} placeholder="Paste the full triage / disengagement note..." style={{ minHeight: 80 }} /></div>
        </div>

        <div className="card">
          <h2><span className="n">2</span> Skip decision <span style={{ fontFamily: "var(--sans)", letterSpacing: 0, textTransform: "none", color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>— YES to all = LABEL · any NO = SKIP</span></h2>
          {SKIP_QUESTIONS.map((q, i) => (
            <div className="skipq" key={q.id}>
              <div className="q">{i + 1}. {q.q}</div>
              <div className="yn">
                <button className={"yes" + (skipAnswers[q.id] === "YES" ? " on" : "")} onClick={() => setSkip(q.id, "YES")}>YES</button>
                <button className={"no" + (skipAnswers[q.id] === "NO" ? " on" : "")} onClick={() => setSkip(q.id, "NO")}>NO</button>
                <span className="note" style={{ marginTop: 6 }}>{q.noMeans}</span>
              </div>
            </div>
          ))}
          <div className="field" style={{ marginTop: 12 }}>
            <div className="toggle-row">
              <label className="switch"><input type="checkbox" checked={skipped} onChange={(e) => setSkipped(e.target.checked)} /><span className="slider" /></label>
              <label style={{ margin: 0, fontWeight: 500 }}>I skipped this segment</label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2><span className="n">3</span> Thinking Trace</h2>
          <div className="two-col">
            <div className="field"><label>Pre-seed thinking trace</label>
              <textarea value={preseedTrace} onChange={(e) => setPreseedTrace(e.target.value)} placeholder="Paste the original pre-seed trace..." /></div>
            <div className="field"><label>Your revised thinking trace</label>
              <textarea value={revisedTrace} onChange={(e) => setRevisedTrace(e.target.value)} placeholder="Paste your edited trace..." /></div>
          </div>
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="primary" onClick={checkTrace} disabled={S.trace.loading}>
              {S.trace.loading ? <><span className="spinner" />Checking trace…</> : "✦ Check trace"}
            </button>
          </div>
          {S.trace.err && <div className="banner-err" style={{ marginTop: 12 }}>{S.trace.err}</div>}
          {S.trace.res && <SectionResult a={S.trace.res} kind="trace" />}
        </div>

        <div className="card">
          <h2><span className="n">4</span> Driving Plan</h2>
          <div className="two-col">
            <div className="field"><label>Pre-seed driving plan</label>
              <textarea value={preseedPlan} onChange={(e) => setPreseedPlan(e.target.value)} placeholder="Paste the original pre-seed plan..." /></div>
            <div className="field"><label>Your revised driving plan</label>
              <textarea value={revisedPlan} onChange={(e) => setRevisedPlan(e.target.value)} placeholder="Paste your edited plan..." /></div>
          </div>
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="primary" onClick={checkPlan} disabled={S.plan.loading}>
              {S.plan.loading ? <><span className="spinner" />Checking plan…</> : "✦ Check plan (+ trace consistency)"}
            </button>
          </div>
          {S.plan.err && <div className="banner-err" style={{ marginTop: 12 }}>{S.plan.err}</div>}
          {S.plan.res && <SectionResult a={S.plan.res} kind="plan" />}
        </div>

        <div className="card">
          <h2><span className="n">5</span> Minimal Input</h2>
          <div className="field"><label>Cameras selected <span className="hint">(default SVC-F)</span></label>
            <div className="cams">
              {CAMERAS.map((c) => (<span key={c} className={"cam" + (cameras.includes(c) ? " on" : "")} onClick={() => toggleCam(c)}>{c}</span>))}
            </div>
          </div>
          <div className="field">
            <div className="toggle-row">
              <label className="switch"><input type="checkbox" checked={temporal} onChange={(e) => setTemporal(e.target.checked)} /><span className="slider" /></label>
              <label style={{ margin: 0, fontWeight: 500 }}>Temporal selected</label>
            </div>
          </div>
          <div className="btns" style={{ marginTop: 12 }}>
            <button className="primary" onClick={checkCamera} disabled={S.camera.loading}>
              {S.camera.loading ? <><span className="spinner" />Analyzing…</> : "✦ Camera & Temporal advisor"}
            </button>
          </div>
          {S.camera.err && <div className="banner-err" style={{ marginTop: 12 }}>{S.camera.err}</div>}
          {S.camera.res && <CameraResult a={S.camera.res} />}
        </div>

        <div className="card" style={{ borderColor: "var(--teal)", background: "var(--teal-pale)" }}>
          <h2><span className="n">✓</span> Full review — everything above</h2>
          <p className="note" style={{ marginBottom: 12 }}>Runs the complete 17-item sweep across the whole submission. Use this before you submit.</p>
          <div className="btns">
            <button className="primary" onClick={checkFull} disabled={S.full.loading}>
              {S.full.loading ? <><span className="spinner" />Running full review…</> : "Run full check"}
            </button>
            <button className="ghost" onClick={resetForNext}>New task</button>
          </div>
          {S.full.err && <div className="banner-err" style={{ marginTop: 12 }}>{S.full.err}</div>}
          {S.full.raw && <pre className="json" style={{ marginTop: 12 }}>{S.full.raw}</pre>}
        </div>

        {S.full.res && <FullResult a={S.full.res} />}

        <div className="card" style={{ borderColor: "var(--ink)" }}>
          <h2 style={{ color: "var(--ink)" }}>Submit for review</h2>
          <p className="note" style={{ marginBottom: 12 }}>Saves this task (ID, trace/plan, and whatever checks you've run) for the reviewer. Running the full check first is recommended.</p>
          {submitErr && <div className="banner-err" style={{ marginBottom: 12 }}>{submitErr}</div>}
          {submitted ? (
            <div className="banner-ok">✓ Submitted. Task <b>{taskId}</b> is saved.
              <button className="ghost" style={{ marginLeft: 14 }} onClick={resetForNext}>Start next task</button>
            </div>
          ) : (
            <button className="submit" onClick={submit} disabled={submitting}>
              {submitting ? <><span className="spinner" />Saving…</> : "Submit task →"}
            </button>
          )}
        </div>

        <div className="footer-note">
          Rehearsal / QC tool · your own task content · powered by Claude Opus 4.8.<br />
          Per-section checks for speed; full review for the complete 17-item sweep.
        </div>
      </div>
    </>
  );
}

function SectionResult({ a, kind }) {
  const wi = a.writing_issues || {};
  const writingCount = (wi.hedging_words?.length || 0) + (wi.leftover_meta_narration?.length || 0) + (wi.redundancy?.length || 0) + (wi.other?.length || 0);
  return (
    <div style={{ marginTop: 14 }}>
      <div className={"verdict " + (a.verdict || "ok")} style={{ padding: "12px 14px", marginBottom: 12 }}>
        <div className="vtag">{a.verdict === "major_risk" ? "⚑ Major risk" : a.verdict === "minor_issues" ? "Minor issues" : "Clean (text-level)"}</div>
        <h3 style={{ fontSize: 14, margin: "5px 0 0" }}>{a.headline || ""}</h3>
      </div>
      {kind === "plan" && a.trace_plan_consistency && (
        <div className={"flag " + (a.trace_plan_consistency.consistent ? "minor" : "major")}>
          <div className="ftop"><span className="ftitle">Trace ↔ Plan consistency (M3)</span></div>
          <div className="frow"><b>{a.trace_plan_consistency.consistent ? "Consistent" : "Mismatch"}:</b> {a.trace_plan_consistency.detail}</div>
          <div className="frow"><b>Action is one of the trace's options:</b> {String(a.trace_plan_consistency.action_in_trace_options)}</div>
        </div>
      )}
      {kind === "plan" && a.structure && (
        <div className="flag minor" style={{ borderLeftColor: "var(--teal)" }}>
          <div className="pill-list">
            {["goal", "observation", "reasoning", "action", "safety"].map((k) => (
              <span className={"pill" + (a.structure[k] ? "" : " warn")} key={k}>{k}: {a.structure[k] ? "✓" : (k === "safety" ? "—" : "missing")}</span>
            ))}
          </div>
          {a.structure.note && <div className="frow" style={{ marginTop: 6 }}>{a.structure.note}</div>}
        </div>
      )}
      {a.major_risks?.length > 0 && a.major_risks.map((m, i) => (
        <div className="flag major" key={i}>
          <div className="ftop"><span className="code major">{m.code}</span><span className="ftitle">{m.title}</span></div>
          <div className="frow"><b>What:</b> {m.what}</div>
          <div className="frow"><b>Why:</b> {m.why}</div>
          {m.evidence && m.evidence !== "—" && <div className="frow"><b>Evidence:</b> <span className="ev">{m.evidence}</span></div>}
          {m.confirm && <div className="confirm">📷 Confirm on camera: {m.confirm}</div>}
        </div>
      ))}
      {a.minor_flags?.length > 0 && a.minor_flags.map((m, i) => (
        <div className="flag minor" key={i}>
          <div className="ftop"><span className="code minor">{m.code}</span><span className="ftitle">{m.title}</span></div>
          <div className="frow">{m.detail}</div>
          {m.evidence && m.evidence !== "—" && <div className="frow"><b>Evidence:</b> <span className="ev">{m.evidence}</span></div>}
          {m.fix && <div className="frow"><b>Fix:</b> {m.fix}</div>}
        </div>
      ))}
      {a.suspicious_unchanged?.length > 0 && (
        <div className="flag major"><div className="frow"><b style={{ color: "var(--red)" }}>Risky things left unchanged:</b>
          <ul style={{ margin: "4px 0 0 18px", fontSize: 12.5, color: "var(--red)" }}>{a.suspicious_unchanged.map((c, i) => <li key={i}>{c}</li>)}</ul></div></div>
      )}
      {writingCount > 0 && (
        <div className="flag minor">
          <div className="ftop"><span className="ftitle">Writing</span></div>
          {wi.hedging_words?.length > 0 && <div className="frow"><b>Hedging:</b> <span className="pill-list" style={{ display: "inline-flex", marginLeft: 4 }}>{wi.hedging_words.map((w, i) => <span className="pill warn" key={i}>{w}</span>)}</span></div>}
          {wi.leftover_meta_narration?.length > 0 && <div className="frow"><b>Meta-narration left in:</b> {wi.leftover_meta_narration.map((w, i) => <span className="ev" key={i} style={{ marginRight: 4 }}>{w}</span>)}</div>}
          {wi.redundancy?.length > 0 && <div className="frow"><b>Redundancy:</b> {wi.redundancy.join("; ")}</div>}
          {wi.other?.length > 0 && <div className="frow"><b>Other:</b> {wi.other.join("; ")}</div>}
        </div>
      )}
      {a.self_review?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="block-head" style={{ fontSize: 11 }}>Confirm on camera</div>
          {a.self_review.map((q, i) => (
            <label className="review-item" key={i}><input type="checkbox" /><span><span className="qc">{q.code} · </span><span className="qt">{q.question}</span></span></label>
          ))}
        </div>
      )}
    </div>
  );
}

function CameraResult({ a }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="guidance">
        <div className="g-row" style={{ fontSize: 13, marginBottom: 8 }}><b>{a.summary}</b></div>
        <div className="g-row"><b>Cameras the text implies:</b> {a.cameras_text_implies?.length ? a.cameras_text_implies.join(", ") : "—"}</div>
        {a.camera_reasoning?.length > 0 && (
          <ul style={{ margin: "4px 0 8px 18px", fontSize: 12 }}>
            {a.camera_reasoning.map((c, i) => <li key={i}><b>{c.camera}</b> — {c.because}</li>)}
          </ul>
        )}
        <div className="g-row"><b>Temporal needed?</b> <span style={{ textTransform: "uppercase", fontFamily: "var(--mono)", fontSize: 11, color: a.temporal_needed === "yes" ? "var(--red)" : a.temporal_needed === "maybe" ? "var(--amber-text)" : "var(--green)" }}>{a.temporal_needed}</span> — {a.temporal_reason}</div>
        {a.missing_from_selection?.length > 0 && (
          <div className="g-row" style={{ color: "var(--red)" }}><b>⚠ You didn't select (but text implies):</b> {a.missing_from_selection.join(", ")}</div>
        )}
        {a.extra_in_selection?.length > 0 && (
          <div className="g-row" style={{ color: "var(--amber-text)" }}><b>Selected but unused in text:</b> {a.extra_in_selection.join(", ")}</div>
        )}
        {a.temporal_mismatch && a.temporal_mismatch !== "none" && (
          <div className="g-row" style={{ color: "var(--red)" }}><b>Temporal:</b> {a.temporal_mismatch === "should_add" ? "you should ADD Temporal" : "you should REMOVE Temporal"}</div>
        )}
      </div>
    </div>
  );
}

function FullResult({ a }) {
  const wi = a.writing_issues || {};
  const writingCount = (wi.hedging_words?.length || 0) + (wi.leftover_meta_narration?.length || 0) + (wi.redundancy?.length || 0) + (wi.other?.length || 0);
  return (
    <div style={{ marginBottom: 20 }}>
      <div className={"verdict " + (a.verdict || "ok")}>
        <div className="vtag">{a.verdict === "major_risk" ? "⚑ Major risk — verify before submitting" : a.verdict === "minor_issues" ? "Minor issues to clean up" : "Looks clean (text-level)"}</div>
        <h3>{a.headline || ""}</h3><p>{a.summary || ""}</p>
      </div>
      <div className="stat-row">
        <div className="stat red"><div className="num">{a.major_risks?.length || 0}</div><div className="lbl">Major risks</div></div>
        <div className="stat amber"><div className="num">{a.minor_flags?.length || 0}</div><div className="lbl">Minor flags</div></div>
        <div className="stat amber"><div className="num">{writingCount}</div><div className="lbl">Writing issues</div></div>
        <div className="stat teal"><div className="num">{a.self_review_checklist?.length || 0}</div><div className="lbl">To confirm on camera</div></div>
      </div>
      {a.skip_check && (
        <div className="block"><div className="block-head">▸ Skip decision</div>
          <div className={"flag " + (a.skip_check.decision_coherent ? "minor" : "major")}><div className="frow"><b>{a.skip_check.decision_coherent ? "Coherent" : "Possible inconsistency"}:</b> {a.skip_check.note}</div></div></div>
      )}
      {a.major_risks?.length > 0 && (
        <div className="block"><div className="block-head" style={{ color: "var(--red)" }}>▸ Major risks (each could be 0%)</div>
          {a.major_risks.map((m, i) => (
            <div className="flag major" key={i}>
              <div className="ftop"><span className="code major">{m.code}</span><span className="ftitle">{m.title}</span></div>
              <div className="frow"><b>What:</b> {m.what}</div><div className="frow"><b>Why:</b> {m.why}</div>
              {m.evidence && m.evidence !== "—" && <div className="frow"><b>Evidence:</b> <span className="ev">{m.evidence}</span></div>}
              {m.confirm && <div className="confirm">📷 Confirm on camera: {m.confirm}</div>}
            </div>))}
        </div>
      )}
      {a.trace_plan_consistency && (
        <div className="block"><div className="block-head">▸ Trace ↔ Plan (M3)</div>
          <div className={"flag " + (a.trace_plan_consistency.consistent ? "minor" : "major")}>
            <div className="frow"><b>{a.trace_plan_consistency.consistent ? "Consistent" : "Mismatch"}:</b> {a.trace_plan_consistency.detail}</div>
            <div className="frow"><b>Action in trace options:</b> {String(a.trace_plan_consistency.action_in_trace_options)}</div></div></div>
      )}
      {a.minor_flags?.length > 0 && (
        <div className="block"><div className="block-head" style={{ color: "var(--amber-text)" }}>▸ Minor flags (−5% each)</div>
          {a.minor_flags.map((m, i) => (
            <div className="flag minor" key={i}>
              <div className="ftop"><span className="code minor">{m.code}</span><span className="ftitle">{m.title}</span></div>
              <div className="frow">{m.detail}</div>
              {m.evidence && m.evidence !== "—" && <div className="frow"><b>Evidence:</b> <span className="ev">{m.evidence}</span></div>}
              {m.fix && <div className="frow"><b>Fix:</b> {m.fix}</div>}
            </div>))}
        </div>
      )}
      {a.diff_analysis && (
        <div className="block"><div className="block-head">▸ What you changed</div>
          <div className="flag minor" style={{ borderLeftColor: "var(--teal)" }}>
            {a.diff_analysis.key_changes?.length > 0 && <><div className="frow"><b>Key changes:</b></div><ul style={{ margin: "4px 0 8px 18px", fontSize: 12.5 }}>{a.diff_analysis.key_changes.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
            {a.diff_analysis.suspicious_unchanged?.length > 0 && <><div className="frow"><b style={{ color: "var(--red)" }}>Suspicious unchanged:</b></div><ul style={{ margin: "4px 0 8px 18px", fontSize: 12.5, color: "var(--red)" }}>{a.diff_analysis.suspicious_unchanged.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
            {a.diff_analysis.new_problems_introduced?.length > 0 && <><div className="frow"><b style={{ color: "var(--red)" }}>New problems added:</b></div><ul style={{ margin: "4px 0 0 18px", fontSize: 12.5, color: "var(--red)" }}>{a.diff_analysis.new_problems_introduced.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
          </div></div>
      )}
      {writingCount > 0 && (
        <div className="block"><div className="block-head" style={{ color: "var(--amber-text)" }}>▸ Writing issues (revised text)</div>
          <div className="flag minor">
            {wi.hedging_words?.length > 0 && <div className="frow"><b>Hedging:</b> <span className="pill-list" style={{ display: "inline-flex", marginLeft: 4 }}>{wi.hedging_words.map((w, i) => <span className="pill warn" key={i}>{w}</span>)}</span></div>}
            {wi.leftover_meta_narration?.length > 0 && <div className="frow" style={{ marginTop: 6 }}><b>Meta-narration:</b> {wi.leftover_meta_narration.map((w, i) => <span className="ev" key={i} style={{ marginRight: 4 }}>{w}</span>)}</div>}
            {wi.redundancy?.length > 0 && <div className="frow" style={{ marginTop: 6 }}><b>Redundancy:</b> {wi.redundancy.join("; ")}</div>}
            {wi.other?.length > 0 && <div className="frow" style={{ marginTop: 6 }}><b>Other:</b> {wi.other.join("; ")}</div>}
          </div></div>
      )}
      {a.self_review_checklist?.length > 0 && (
        <div className="block"><div className="block-head">▸ Confirm on the cameras</div>
          {a.self_review_checklist.map((q, i) => (<label className="review-item" key={i}><input type="checkbox" /><span><span className="qc">{q.code} · </span><span className="qt">{q.question}</span></span></label>))}</div>
      )}
      {a.label_guidance && (
        <div className="block"><div className="block-head" style={{ color: "var(--teal)" }}>▸ Label guidance</div>
          <div className="guidance">
            <div className="g-row"><b>Cameras text implies:</b> {a.label_guidance.cameras_text_implies?.length ? a.label_guidance.cameras_text_implies.join(", ") : "—"}</div>
            <div className="g-row"><b>Temporal needed?</b> {a.label_guidance.temporal_needed} — {a.label_guidance.temporal_reason}</div>
            <div className="g-row"><b>Selection check:</b> {a.label_guidance.camera_selection_note}</div>
          </div></div>
      )}
      {a.rubric_sweep?.length > 0 && (
        <div className="block"><div className="block-head">▸ Full rubric sweep (all 17)</div>
          <div className="sweep">{a.rubric_sweep.map((r, i) => (
            <div className="sweep-item" key={i} title={r.note}><span className={"dot " + (r.status || "na").replace("/", "")} /><span className="sc">{r.code}</span><span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note}</span></div>))}</div></div>
      )}
    </div>
  );
}
