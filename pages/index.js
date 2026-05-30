// pages/index.js — v3.0.0
import { useState } from "react";
import { SKIP_QUESTIONS } from "../lib/rubricKnowledge.js";

const CAMERAS = ["SVC-F", "SVC-FL", "SVC-FR", "SVC-L", "SVC-R", "SVC-B"];

async function callApi(url, body, ms = 290000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    if (!r.ok) return { error: (data && data.error) ? data.error : `Server ${r.status}. ${r.status === 504 ? "Timed out — set ANTHROPIC_EFFORT=high in Vercel & redeploy." : ""}`, raw: data?.raw || null };
    if (!data) return { error: "Empty response from server." };
    return data;
  } catch (e) {
    if (e.name === "AbortError") return { error: "Timed out (~5 min). Set ANTHROPIC_EFFORT=high in Vercel & redeploy." };
    return { error: "Network error: " + e.message };
  } finally { clearTimeout(timer); }
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

  const [full, setFull] = useState({ loading: false, res: null, err: null, raw: null, notices: [] });
  const [cam, setCam] = useState({ loading: false, res: null, err: null });
  const [missing, setMissing] = useState(null); // list of labels, or null
  const [tip, setTip] = useState(null); // {p, x, y}

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState(null);

  const setSkip = (id, v) => setSkipAnswers((s) => ({ ...s, [id]: s[id] === v ? "" : v }));
  const toggleCam = (c) => setCameras((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const base = () => ({ taskerName, taskId, triageNote, skipped, skipAnswers, preseedTrace, revisedTrace, preseedPlan, revisedPlan, cameras, temporal });

  function noticesFor() {
    const n = [];
    if (!revisedTrace.trim() || !revisedPlan.trim()) n.push("Trace↔Plan consistency can't be checked because you're missing " + [!revisedTrace.trim() ? "the revised trace" : null, !revisedPlan.trim() ? "the revised plan" : null].filter(Boolean).join(" and ") + ".");
    if (!preseedTrace.trim()) n.push("No pre-seed trace provided, so the trace diff / comparison won't render.");
    if (!preseedPlan.trim()) n.push("No pre-seed plan provided, so the plan diff / comparison won't render.");
    return n;
  }

  function onRunClick() {
    setSubmitErr(null);
    const miss = [];
    if (!revisedTrace.trim()) miss.push("revised thinking trace");
    if (!revisedPlan.trim()) miss.push("revised driving plan");
    if (miss.length) { setMissing(miss); return; }
    doRun();
  }

  async function doRun() {
    setMissing(null); setSubmitted(false);
    setFull({ loading: true, res: null, err: null, raw: null, notices: [] });
    const d = await callApi("/api/check", base());
    setFull({ loading: false, res: d.analysis || null, err: d.error || null, raw: d.raw || null, notices: d.analysis ? noticesFor() : [] });
  }

  async function suggestMin() {
    setCam({ loading: true, res: null, err: null });
    const d = await callApi("/api/section", { mode: "camera", ...base() });
    setCam({ loading: false, res: d.analysis || null, err: d.error || null });
  }

  async function submit() {
    setSubmitErr(null);
    if (!taskId.trim()) { setSubmitErr("Task ID is required to submit."); return; }
    setSubmitting(true);
    const d = await callApi("/api/submit", { ...base(), analysis: full.res, sectionResults: { camera: cam.res } }, 30000);
    setSubmitting(false);
    if (d.error) setSubmitErr(d.error); else setSubmitted(true);
  }

  function resetForNext() {
    setTaskId(""); setTriageNote(""); setSkipped(false); setSkipAnswers({});
    setPreseedTrace(""); setRevisedTrace(""); setPreseedPlan(""); setRevisedPlan("");
    setCameras([]); setTemporal(false);
    setFull({ loading: false, res: null, err: null, raw: null, notices: [] }); setCam({ loading: false, res: null, err: null });
    setMissing(null); setSubmitted(false); setSubmitErr(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const points = full.res ? assignPoints(full.res) : [];
  const tracePoints = points.filter((p) => (p.where || "trace") === "trace");
  const planPoints = points.filter((p) => p.where === "plan");

  return (
    <>
      {tip && <TipCard tip={tip} />}
      <header className="app-header">
        <div className="wrap row">
          <div>
            <div className="eyebrow">Caption Labeling · Pre-Submission QC</div>
            <h1>Rubric QC Tool</h1>
            <div className="sub">Paste your work, run one combined review, then submit. Powered by Opus 4.8.</div>
          </div>
          <a className="adminlink" href="/admin">Reviewer view →</a>
        </div>
      </header>

      <div className="wrap">
        <div className="disclaimer">
          <span className="ico">⚠️</span>
          <p><strong>The AI cannot see the camera footage.</strong> It reviews your text — consistency, trace↔plan agreement, writing, canonical compliance — and lists what needs the cameras. <strong>A clean result is not a guarantee the segment is correct.</strong></p>
        </div>

        {/* PART 1 */}
        <div className="card">
          <h2><span className="n">1</span> Task &amp; triage note</h2>
          <div className="two-col">
            <div className="field"><label>Your name</label>
              <input type="text" value={taskerName} onChange={(e) => setTaskerName(e.target.value)} placeholder="e.g. Emmett" /></div>
            <div className="field"><label>Task ID <span className="hint">(required)</span></label>
              <input type="text" value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="e.g. seg_4471_az" /></div>
          </div>
          <div className="field"><label>Triage note <span className="hint">(watch the video first, then paste the triage / disengagement note)</span></label>
            <textarea value={triageNote} onChange={(e) => setTriageNote(e.target.value)} placeholder="e.g. fod.non_ignorable_fod.wrong_side_nudge: ..." style={{ minHeight: 90 }} /></div>
          <div style={{ marginTop: 8 }}>
            <details className="expander">
              <summary><span className="chev">▸</span> Skip decision (optional self-check) — YES to all = LABEL · any NO = SKIP</summary>
              <div className="ebody">
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
                <div className="toggle-row" style={{ marginTop: 10 }}>
                  <label className="switch"><input type="checkbox" checked={skipped} onChange={(e) => setSkipped(e.target.checked)} /><span className="slider" /></label>
                  <label style={{ margin: 0, fontWeight: 500 }}>I skipped this segment</label>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* PART 2 — combined captions */}
        <div className="card">
          <h2><span className="n">2</span> Captions — pre-seed &amp; your revision</h2>
          <p className="note" style={{ marginBottom: 14 }}>Paste the pre-seed and your revised versions. Pre-seed is optional (leave blank to skip the comparison). The trace and plan are always checked <b>together</b> for consistency.</p>

          <div className="field"><label>Thinking Trace</label></div>
          <div className="two-col" style={{ marginBottom: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Pre-seed trace (optional)</label>
              <textarea value={preseedTrace} onChange={(e) => setPreseedTrace(e.target.value)} placeholder="Paste the original pre-seed trace (optional)..." /></div>
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Your revised trace</label>
              <textarea value={revisedTrace} onChange={(e) => setRevisedTrace(e.target.value)} placeholder="Paste your edited trace..." /></div>
          </div>

          <div className="field"><label>Driving Plan</label></div>
          <div className="two-col">
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Pre-seed plan (optional)</label>
              <textarea value={preseedPlan} onChange={(e) => setPreseedPlan(e.target.value)} placeholder="Paste the original pre-seed plan (optional)..." /></div>
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Your revised plan</label>
              <textarea value={revisedPlan} onChange={(e) => setRevisedPlan(e.target.value)} placeholder="Paste your edited plan..." /></div>
          </div>

          <div className="btns" style={{ marginTop: 16 }}>
            <button className="primary" onClick={onRunClick} disabled={full.loading}>
              {full.loading ? <><span className="spinner" />Reviewing with Opus 4.8…</> : "Run check"}
            </button>
            <button className="ghost" onClick={resetForNext}>New task</button>
          </div>

          {missing && (
            <div className="reminder">
              <div className="rtext">You haven't added <b>{missing.join(" and ")}</b>. Add {missing.length > 1 ? "them" : "it"} for a full review?</div>
              <div className="btns" style={{ marginTop: 10 }}>
                <button className="primary" onClick={() => setMissing(null)}>Add it</button>
                <button className="ghost" onClick={doRun}>Check anyway</button>
              </div>
            </div>
          )}

          {full.err && <div className="banner-err" style={{ marginTop: 12 }}>{full.err}</div>}
          {full.raw && <pre className="json" style={{ marginTop: 12 }}>{full.raw}</pre>}

          {full.res && (
            <div style={{ marginTop: 16 }}>
              {full.notices.length > 0 && (
                <div className="notice-box">
                  {full.notices.map((n, i) => <div key={i}>• {n}</div>)}
                </div>
              )}
              <FullResult a={full.res} setTip={setTip}
                tracePoints={tracePoints} planPoints={planPoints}
                traceText={revisedTrace} planText={revisedPlan}
                preTrace={preseedTrace} prePlan={preseedPlan} />
            </div>
          )}
        </div>

        {/* PART 3 — minimal input advisor (gentle, opt-in) */}
        <div className="card">
          <h2><span className="n">3</span> Minimal Input</h2>
          <div className="field"><label>Your selection <span className="hint">(default SVC-F; add only what's needed)</span></label>
            <div className="cams">{CAMERAS.map((c) => (<span key={c} className={"cam" + (cameras.includes(c) ? " on" : "")} onClick={() => toggleCam(c)}>{c}</span>))}</div>
          </div>
          <div className="field">
            <div className="toggle-row">
              <label className="switch"><input type="checkbox" checked={temporal} onChange={(e) => setTemporal(e.target.checked)} /><span className="slider" /></label>
              <label style={{ margin: 0, fontWeight: 500 }}>Temporal selected</label>
            </div>
          </div>
          <p className="note" style={{ margin: "4px 0 10px" }}>Optional: get a gentle hint from the text about cameras / Temporal. <b>This is a suggestion to confirm against the video — you decide, not the AI.</b></p>
          <div className="btns">
            <button className="ghost" onClick={suggestMin} disabled={cam.loading}>
              {cam.loading ? <><span className="spinner" />Thinking…</> : "💡 Suggest cameras / Temporal (optional)"}
            </button>
          </div>
          {cam.err && <div className="banner-err" style={{ marginTop: 12 }}>{cam.err}</div>}
          {cam.res && <CameraResult a={cam.res} />}
        </div>

        {/* SUBMIT */}
        <div className="card" style={{ borderColor: "var(--ink)" }}>
          <h2 style={{ color: "var(--ink)" }}>Submit for review</h2>
          <p className="note" style={{ marginBottom: 12 }}>Saves this task (ID, trace/plan, and your check) for the reviewer. Run the check first.</p>
          {submitErr && <div className="banner-err" style={{ marginBottom: 12 }}>{submitErr}</div>}
          {submitted ? (
            <div className="banner-ok">✓ Submitted. Task <b>{taskId}</b> is saved.
              <button className="ghost" style={{ marginLeft: 14 }} onClick={resetForNext}>Start next task</button></div>
          ) : (
            <button className="submit" onClick={submit} disabled={submitting}>{submitting ? <><span className="spinner" />Saving…</> : "Submit task →"}</button>
          )}
        </div>

        <div className="footer-note">Rehearsal / QC tool · your own task content · powered by Claude Opus 4.8.</div>
      </div>
    </>
  );
}

/* ================= rendering ================= */
const PALETTE = [
  { bg: "#E9D5FF", bd: "#7E22CE", tx: "#6B21A8" },
  { bg: "#FECACA", bd: "#DC2626", tx: "#991B1B" },
  { bg: "#FBCFE8", bd: "#DB2777", tx: "#9D174D" },
  { bg: "#FED7AA", bd: "#EA580C", tx: "#9A3412" },
  { bg: "#FEF08A", bd: "#CA8A04", tx: "#854D0E" },
  { bg: "#BFDBFE", bd: "#2563EB", tx: "#1E40AF" },
  { bg: "#99F6E4", bd: "#0D9488", tx: "#0F766E" },
  { bg: "#BBF7D0", bd: "#16A34A", tx: "#15803D" },
];

function assignPoints(a) {
  const majors = (a.major_risks || []).map((f) => ({ ...f, sev: "major" }));
  const minors = (a.minor_flags || []).map((f) => ({ ...f, sev: "minor" }));
  return [...majors, ...minors].map((f, i) => ({ ...f, _point: i + 1, _color: PALETTE[i % PALETTE.length] }));
}

function segmentize(text, points) {
  if (!text) return [{ text: "" }];
  const marks = [];
  points.forEach((p) => (p.spans || []).forEach((span) => {
    if (!span || span.trim().length < 4) return;
    let start = text.indexOf(span), len = span.length;
    if (start === -1) { try { const pat = span.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"); const m = new RegExp(pat).exec(text); if (m) { start = m.index; len = m[0].length; } } catch {} }
    if (start >= 0) marks.push({ start, end: start + len, p });
  }));
  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const clean = []; let lastEnd = -1;
  for (const m of marks) { if (m.start >= lastEnd) { clean.push(m); lastEnd = m.end; } }
  const segs = []; let cur = 0;
  for (const m of clean) { if (m.start > cur) segs.push({ text: text.slice(cur, m.start) }); segs.push({ text: text.slice(m.start, m.end), mark: m }); cur = m.end; }
  if (cur < text.length) segs.push({ text: text.slice(cur) });
  return segs;
}

function TipCard({ tip }) {
  const p = tip.p;
  const w = 330;
  let left = tip.x; if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12; if (left < 12) left = 12;
  const top = tip.y + 8;
  return (
    <div className="tipcard" style={{ left, top, width: w, borderColor: p._color.bd }}>
      <div className="tip-head">
        <span className="pt-num" style={{ background: p._color.bd, width: 18, height: 18, fontSize: 10 }}>{p._point}</span>
        <span className={"pt-sev " + p.sev}>{p.sev}</span>
        <span className="pt-code">{p.code}{p.type ? " · " + String(p.type).replace(/_/g, " ") : ""}</span>
      </div>
      <div className="tip-fix">{p.fix || p.title}</div>
      {p.why && <div className="tip-row"><b>Why:</b> {p.why}</div>}
      {p.evidence && p.evidence !== "—" && <div className="tip-row"><b>Evidence:</b> <span className="ev">{p.evidence}</span></div>}
      {p.confirm && <div className="tip-cam">📷 {p.confirm}</div>}
    </div>
  );
}

function HighlightedText({ label, text, points, setTip, emptyMsg }) {
  if (!text) return emptyMsg ? <div className="hl-panel"><div className="hl-head">{label}</div><div className="hl-body" style={{ color: "var(--muted)", fontStyle: "italic" }}>{emptyMsg}</div></div> : null;
  const segs = segmentize(text, points);
  const anyMark = segs.some((s) => s.mark);
  return (
    <div className="hl-panel">
      <div className="hl-head">{label}{!anyMark && points.length > 0 ? " — couldn't pin spans; see list below" : ""}</div>
      <div className="hl-body">
        {segs.map((s, i) => s.mark
          ? <mark key={i} className="hl" style={{ background: s.mark.p._color.bg, borderBottomColor: s.mark.p._color.bd }}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ p: s.mark.p, x: r.left, y: r.bottom }); }}
              onMouseLeave={() => setTip(null)}>
              {s.text}<sup style={{ color: s.mark.p._color.tx }}>#{s.mark.p._point}</sup>
            </mark>
          : <span key={i}>{s.text}</span>)}
      </div>
    </div>
  );
}

function PointRow({ p }) {
  const [open, setOpen] = useState(false);
  const has = p.why || p.what || p.evidence || p.confirm || p.detail || p.title;
  return (
    <div className="pt-row">
      <div className="pt-line" onClick={() => has && setOpen(!open)}>
        <span className="pt-num" style={{ background: p._color.bd }}>{p._point}</span>
        <span className={"pt-sev " + p.sev}>{p.sev}</span>
        <span className="pt-code">{p.code}{p.where ? " · " + p.where : ""}{p.type ? " · " + String(p.type).replace(/_/g, " ") : ""}</span>
        <span className="pt-fix">{p.fix || p.title || p.detail}</span>
        {has && <span className="pt-q">{open ? "−" : "?"}</span>}
      </div>
      {open && has && (
        <div className="pt-detail">
          {p.title && p.title !== p.fix && <div className="dr"><b>{p.title}</b></div>}
          {p.what && <div className="dr"><b>What:</b> {p.what}</div>}
          {p.why && <div className="dr"><b>Why:</b> {p.why}</div>}
          {p.detail && !p.why && <div className="dr">{p.detail}</div>}
          {p.evidence && p.evidence !== "—" && <div className="dr"><b>Evidence:</b> <span className="ev">{p.evidence}</span></div>}
          {p.confirm && <div className="cam">📷 Confirm on camera: {p.confirm}</div>}
        </div>
      )}
    </div>
  );
}

/* word-level tracked-changes diff */
function wordDiff(before, after) {
  const A = (before || "").split(/(\s+)/), B = (after || "").split(/(\s+)/);
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { out.push({ t: A[i], k: "=" }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: A[i], k: "-" }); i++; } else { out.push({ t: B[j], k: "+" }); j++; } }
  while (i < n) { out.push({ t: A[i], k: "-" }); i++; }
  while (j < m) { out.push({ t: B[j], k: "+" }); j++; }
  return out;
}

function TrackedDiff({ label, before, after }) {
  const [show, setShow] = useState(false);
  if (!after) return null;
  if (!before) return (
    <details className="expander"><summary><span className="chev">▸</span> {label}</summary>
      <div className="ebody" style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 12.5 }}>No pre-seed provided, so there's nothing to compare against.</div></details>
  );
  const d = show ? wordDiff(before, after) : null;
  return (
    <details className="expander" onToggle={(e) => setShow(e.target.open)}>
      <summary><span className="chev">▸</span> {label} <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10 }}>(tracked changes)</span></summary>
      <div className="ebody">
        <div className="diff-body">
          {d && d.map((w, i) => w.k === "=" ? <span key={i}>{w.t}</span> : w.k === "-" ? <span key={i} className="diff-del">{w.t}</span> : <span key={i} className="diff-add">{w.t}</span>)}
        </div>
        <div className="note" style={{ marginTop: 6 }}><span className="diff-del">red strike = removed from pre-seed</span> · <span className="diff-add">red underline = added in revision</span></div>
      </div>
    </details>
  );
}

function CompactVerdict({ a }) {
  const maj = a.major_risks?.length || 0, min = a.minor_flags?.length || 0, cam = a.self_review_checklist?.length || 0;
  const v = a.verdict || "ok";
  return (
    <div className={"compact-verdict " + v}>
      <span className="vt">{v === "major_risk" ? "⚑ Fix before submit" : v === "minor_issues" ? "Minor cleanup" : "✓ Clean (text-level)"}</span>
      {(maj || min || cam) ? <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>{maj} major · {min} minor · {cam} to verify</span> : null}
      {a.headline && <span className="vh">— {a.headline}</span>}
    </div>
  );
}

function SelfReviewBlock({ items }) {
  if (!items || !items.length) return null;
  return (
    <details className="expander"><summary><span className="chev">▸</span> 📷 Verify on camera ({items.length}) — AI can't see these</summary>
      <div className="ebody">{items.map((q, i) => (<label className="review-item" key={i}><input type="checkbox" /><span><span className="qc">{q.code} · </span><span className="qt">{q.question}</span></span></label>))}</div>
    </details>
  );
}

function CameraResult({ a }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="guidance">
        <div className="g-row" style={{ fontSize: 13, marginBottom: 8 }}><b>{a.summary}</b></div>
        <div className="g-row"><b>Cameras the text implies:</b> {a.cameras_text_implies?.length ? a.cameras_text_implies.join(", ") : "—"}</div>
        {a.camera_reasoning?.length > 0 && (
          <details className="expander" style={{ marginTop: 6, marginBottom: 6 }}><summary><span className="chev">▸</span> Why these cameras</summary>
            <div className="ebody"><ul style={{ margin: "0 0 0 18px", fontSize: 12 }}>{a.camera_reasoning.map((c, i) => <li key={i}><b>{c.camera}</b> — {c.because}</li>)}</ul></div></details>
        )}
        <div className="g-row"><b>Temporal?</b> <span style={{ textTransform: "uppercase", fontFamily: "var(--mono)", fontSize: 11, color: a.temporal_needed === "yes" ? "var(--red)" : a.temporal_needed === "maybe" ? "var(--amber-text)" : "var(--green)" }}>{a.temporal_needed}</span> — {a.temporal_reason}</div>
        {a.missing_from_selection?.length > 0 && (<div className="g-row" style={{ color: "var(--red)" }}><b>⚠ Not selected (text implies):</b> {a.missing_from_selection.join(", ")}</div>)}
        {a.extra_in_selection?.length > 0 && (<div className="g-row" style={{ color: "var(--amber-text)" }}><b>Selected but unused:</b> {a.extra_in_selection.join(", ")}</div>)}
        {a.temporal_mismatch && a.temporal_mismatch !== "none" && (<div className="g-row" style={{ color: "var(--red)" }}><b>Temporal:</b> {a.temporal_mismatch === "should_add" ? "consider ADDING Temporal" : "consider REMOVING Temporal"}</div>)}
        <div className="note" style={{ marginTop: 8 }}>Reminder: confirm against the video. This is a hint, not a decision.</div>
      </div>
    </div>
  );
}

function FullResult({ a, setTip, tracePoints, planPoints, traceText, planText, preTrace, prePlan }) {
  return (
    <div>
      <CompactVerdict a={a} />
      {a.summary && <p className="note" style={{ marginBottom: 12 }}>{a.summary}</p>}

      {a.skip_check && a.skip_check.decision_coherent === false && (<div className="banner-err" style={{ marginBottom: 8 }}>⚑ Skip decision may be inconsistent: {a.skip_check.note}</div>)}
      {a.trace_plan_consistency && a.trace_plan_consistency.consistent === false && (<div className="banner-err" style={{ marginBottom: 8 }}>⚑ Trace↔Plan mismatch (M3): {a.trace_plan_consistency.detail}</div>)}
      {a.trace_plan_consistency && a.trace_plan_consistency.consistent === "unknown" && (<div className="notice-box" style={{ marginBottom: 8 }}>Trace↔Plan consistency not checked: {a.trace_plan_consistency.detail}</div>)}

      <HighlightedText label="Revised trace — hover a highlight for details" text={traceText} points={tracePoints} setTip={setTip} />
      <HighlightedText label="Revised plan — hover a highlight for details" text={planText} points={planPoints} setTip={setTip} emptyMsg={!planText ? "No revised plan provided." : null} />

      {(tracePoints.length + planPoints.length) > 0 && (
        <div className="pt-list">
          <div className="mini-head" style={{ color: "var(--ink)" }}>All flagged points</div>
          {[...tracePoints, ...planPoints].sort((x, y) => x._point - y._point).map((p, i) => <PointRow key={i} p={p} />)}
        </div>
      )}

      <TrackedDiff label="Trace diff (pre-seed → revised)" before={preTrace} after={traceText} />
      <TrackedDiff label="Plan diff (pre-seed → revised)" before={prePlan} after={planText} />

      {a.diff_analysis && (a.diff_analysis.suspicious_unchanged?.length > 0 || a.diff_analysis.new_problems_introduced?.length > 0 || a.diff_analysis.key_changes?.length > 0) && (
        <details className="expander"><summary><span className="chev">▸</span> What changed vs. pre-seed (AI summary)</summary>
          <div className="ebody" style={{ fontSize: 12.5 }}>
            {a.diff_analysis.key_changes?.length > 0 && (<><b>Changes:</b><ul style={{ margin: "4px 0 8px 18px" }}>{a.diff_analysis.key_changes.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            {a.diff_analysis.suspicious_unchanged?.length > 0 && (<><b style={{ color: "var(--red)" }}>Risky unchanged:</b><ul style={{ margin: "4px 0 8px 18px", color: "var(--red)" }}>{a.diff_analysis.suspicious_unchanged.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            {a.diff_analysis.new_problems_introduced?.length > 0 && (<><b style={{ color: "var(--red)" }}>New problems:</b><ul style={{ margin: "4px 0 0 18px", color: "var(--red)" }}>{a.diff_analysis.new_problems_introduced.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
          </div></details>
      )}

      <SelfReviewBlock items={a.self_review_checklist} />

      {a.label_guidance && (
        <details className="expander"><summary><span className="chev">▸</span> Label guidance (cameras / Temporal) — confirm against video</summary>
          <div className="ebody" style={{ fontSize: 12.5 }}>
            <div className="g-row"><b>Cameras text implies:</b> {a.label_guidance.cameras_text_implies?.length ? a.label_guidance.cameras_text_implies.join(", ") : "—"}</div>
            <div className="g-row"><b>Temporal?</b> {a.label_guidance.temporal_needed} — {a.label_guidance.temporal_reason}</div>
            <div className="g-row"><b>Selection:</b> {a.label_guidance.camera_selection_note}</div>
          </div></details>
      )}

      {a.rubric_sweep?.length > 0 && (
        <details className="expander"><summary><span className="chev">▸</span> Full rubric sweep (all 17)</summary>
          <div className="ebody"><div className="sweep">{a.rubric_sweep.map((r, i) => (
            <div className="sweep-item" key={i} title={r.note}><span className={"dot " + (r.status || "na").replace("/", "")} /><span className="sc">{r.code}</span><span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note}</span></div>))}</div></div></details>
      )}
    </div>
  );
}
