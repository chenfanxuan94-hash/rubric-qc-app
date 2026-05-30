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
          {S.trace.res && <SectionResult a={S.trace.res} kind="trace" traceText={revisedTrace} planText={revisedPlan} preTrace={preseedTrace} preMode />}
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
          {S.plan.res && <SectionResult a={S.plan.res} kind="plan" traceText={revisedTrace} planText={revisedPlan} prePlan={preseedPlan} preMode />}
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

        {S.full.res && <FullResult a={S.full.res} traceText={revisedTrace} planText={revisedPlan} preTrace={preseedTrace} prePlan={preseedPlan} />}

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

/* ================= v2.2 result rendering ================= */

// distinct highlight palette; majors get the warm/purple end first
const PALETTE = [
  { bg: "#E9D5FF", bd: "#7E22CE", tx: "#6B21A8" }, // purple
  { bg: "#FECACA", bd: "#DC2626", tx: "#991B1B" }, // red
  { bg: "#FBCFE8", bd: "#DB2777", tx: "#9D174D" }, // pink
  { bg: "#FED7AA", bd: "#EA580C", tx: "#9A3412" }, // orange
  { bg: "#FEF08A", bd: "#CA8A04", tx: "#854D0E" }, // yellow
  { bg: "#BFDBFE", bd: "#2563EB", tx: "#1E40AF" }, // blue
  { bg: "#99F6E4", bd: "#0D9488", tx: "#0F766E" }, // teal
  { bg: "#BBF7D0", bd: "#16A34A", tx: "#15803D" }, // green
];

// Build numbered points: majors first, then minors. Each gets _point + _color.
function assignPoints(a) {
  const majors = (a.major_risks || []).map((f) => ({ ...f, sev: "major" }));
  const minors = (a.minor_flags || []).map((f) => ({ ...f, sev: "minor" }));
  const all = [...majors, ...minors];
  return all.map((f, i) => ({ ...f, _point: i + 1, _color: PALETTE[i % PALETTE.length] }));
}

// find spans in text -> highlighted segments (whitespace-tolerant, overlap-safe)
function segmentize(text, points) {
  if (!text) return [{ text: "" }];
  const marks = [];
  points.forEach((p) => {
    (p.spans || []).forEach((span) => {
      if (!span || span.trim().length < 4) return;
      let start = text.indexOf(span);
      let len = span.length;
      if (start === -1) {
        try {
          const pat = span.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
          const m = new RegExp(pat).exec(text);
          if (m) { start = m.index; len = m[0].length; }
        } catch {}
      }
      if (start >= 0) marks.push({ start, end: start + len, p });
    });
  });
  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const clean = [];
  let lastEnd = -1;
  for (const m of marks) { if (m.start >= lastEnd) { clean.push(m); lastEnd = m.end; } }
  const segs = [];
  let cur = 0;
  for (const m of clean) {
    if (m.start > cur) segs.push({ text: text.slice(cur, m.start) });
    segs.push({ text: text.slice(m.start, m.end), mark: m });
    cur = m.end;
  }
  if (cur < text.length) segs.push({ text: text.slice(cur) });
  return segs;
}

function HighlightedText({ label, text, points }) {
  if (!text) return null;
  const segs = segmentize(text, points);
  const anyMark = segs.some((s) => s.mark);
  return (
    <div className="hl-panel">
      <div className="hl-head">{label}{!anyMark ? " — no highlightable spans (see list below)" : ""}</div>
      <div className="hl-body">
        {segs.map((s, i) => s.mark
          ? <mark key={i} className="hl" style={{ background: s.mark.p._color.bg, borderBottomColor: s.mark.p._color.bd }}
              title={`#${s.mark.p._point} · ${s.mark.p.code} · ${s.mark.p.fix || ""}`}>
              {s.text}<sup style={{ color: s.mark.p._color.tx }}>#{s.mark.p._point}</sup>
            </mark>
          : <span key={i}>{s.text}</span>
        )}
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
        <span className={"pt-sev " + p.sev}>{p.sev === "major" ? "major" : "minor"}</span>
        <span className="pt-code">{p.code}{p.type ? " · " + String(p.type).replace(/_/g, " ") : ""}</span>
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

function PointList({ points }) {
  if (!points.length) return null;
  return (
    <div className="pt-list">
      {points.map((p, i) => <PointRow key={i} p={p} />)}
    </div>
  );
}

/* ---- word-level diff (LCS) ---- */
function wordDiff(before, after) {
  const A = (before || "").split(/(\s+)/);
  const B = (after || "").split(/(\s+)/);
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: A[i], k: "=" }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: A[i], k: "-" }); i++; }
    else { out.push({ t: B[j], k: "+" }); j++; }
  }
  while (i < n) { out.push({ t: A[i], k: "-" }); i++; }
  while (j < m) { out.push({ t: B[j], k: "+" }); j++; }
  return out;
}

function DiffView({ before, after }) {
  const [show, setShow] = useState(false);
  if (!before && !after) return null;
  const d = show ? wordDiff(before, after) : null;
  return (
    <details className="expander" onToggle={(e) => setShow(e.target.open)}>
      <summary><span className="chev">▸</span> Diff view (pre-seed → revised)</summary>
      <div className="ebody">
        <div className="diff-body" style={{ maxHeight: 420 }}>
          {d ? d.map((w, i) =>
            w.k === "=" ? <span key={i}>{w.t}</span>
            : w.k === "-" ? <span key={i} className="diff-del">{w.t}</span>
            : <span key={i} className="diff-add">{w.t}</span>
          ) : null}
        </div>
        <div className="note" style={{ marginTop: 6 }}><span className="diff-del">red = removed</span> · <span className="diff-add">green = added</span></div>
      </div>
    </details>
  );
}

function CompactVerdict({ a, points }) {
  const maj = (a.major_risks?.length) || 0;
  const min = (a.minor_flags?.length) || 0;
  const cam = (a.self_review?.length || a.self_review_checklist?.length || 0);
  const v = a.verdict || "ok";
  return (
    <div className={"compact-verdict " + v}>
      <span className="vt">{v === "major_risk" ? "⚑ Fix before submit" : v === "minor_issues" ? "Minor cleanup" : "✓ Clean (text-level)"}</span>
      {(maj > 0 || min > 0 || cam > 0) && (
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>{maj} major · {min} minor · {cam} to verify</span>
      )}
      {a.headline && <span className="vh">— {a.headline}</span>}
    </div>
  );
}

function SelfReviewBlock({ items }) {
  if (!items || !items.length) return null;
  return (
    <details className="expander">
      <summary><span className="chev">▸</span> 📷 Verify on camera ({items.length}) — AI can't see these</summary>
      <div className="ebody">
        {items.map((q, i) => (
          <label className="review-item" key={i}><input type="checkbox" /><span><span className="qc">{q.code} · </span><span className="qt">{q.question}</span></span></label>
        ))}
      </div>
    </details>
  );
}

/* ---------- section result (trace / plan) ---------- */
function SectionResult({ a, kind, traceText, planText, preTrace, prePlan }) {
  const points = assignPoints(a);
  return (
    <div style={{ marginTop: 14 }}>
      <CompactVerdict a={a} points={points} />

      {kind === "plan" && a.trace_plan_consistency && !a.trace_plan_consistency.consistent && (
        <div className="banner-err" style={{ marginBottom: 8 }}>⚑ Trace↔Plan mismatch (M3): {a.trace_plan_consistency.detail}</div>
      )}

      {/* highlighted text */}
      {kind === "trace"
        ? <HighlightedText label="Your revised trace — flagged spans" text={traceText} points={points} />
        : <HighlightedText label="Your revised plan — flagged spans" text={planText} points={points} />}

      {/* numbered points */}
      <PointList points={points} />

      {kind === "plan" && a.structure && (
        <details className="expander">
          <summary><span className="chev">▸</span> Plan structure</summary>
          <div className="ebody"><div className="pill-list">
            {["goal", "observation", "reasoning", "action", "safety"].map((k) => (
              <span className={"pill" + (a.structure[k] ? "" : " warn")} key={k}>{k}: {a.structure[k] ? "✓" : (k === "safety" ? "—" : "missing")}</span>
            ))}
          </div></div>
        </details>
      )}

      <SelfReviewBlock items={a.self_review} />
      <DiffView before={kind === "trace" ? preTrace : prePlan} after={kind === "trace" ? traceText : planText} />
    </div>
  );
}

/* ---------- camera advisor ---------- */
function CameraResult({ a }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="guidance">
        <div className="g-row" style={{ fontSize: 13, marginBottom: 8 }}><b>{a.summary}</b></div>
        <div className="g-row"><b>Cameras the text implies:</b> {a.cameras_text_implies?.length ? a.cameras_text_implies.join(", ") : "—"}</div>
        {a.camera_reasoning?.length > 0 && (
          <details className="expander" style={{ marginTop: 6, marginBottom: 6 }}>
            <summary><span className="chev">▸</span> Why these cameras</summary>
            <div className="ebody"><ul style={{ margin: "0 0 0 18px", fontSize: 12 }}>
              {a.camera_reasoning.map((c, i) => <li key={i}><b>{c.camera}</b> — {c.because}</li>)}
            </ul></div>
          </details>
        )}
        <div className="g-row"><b>Temporal?</b> <span style={{ textTransform: "uppercase", fontFamily: "var(--mono)", fontSize: 11, color: a.temporal_needed === "yes" ? "var(--red)" : a.temporal_needed === "maybe" ? "var(--amber-text)" : "var(--green)" }}>{a.temporal_needed}</span> — {a.temporal_reason}</div>
        {a.missing_from_selection?.length > 0 && (<div className="g-row" style={{ color: "var(--red)" }}><b>⚠ Not selected (text implies):</b> {a.missing_from_selection.join(", ")}</div>)}
        {a.extra_in_selection?.length > 0 && (<div className="g-row" style={{ color: "var(--amber-text)" }}><b>Selected but unused:</b> {a.extra_in_selection.join(", ")}</div>)}
        {a.temporal_mismatch && a.temporal_mismatch !== "none" && (<div className="g-row" style={{ color: "var(--red)" }}><b>Temporal:</b> {a.temporal_mismatch === "should_add" ? "ADD Temporal" : "REMOVE Temporal"}</div>)}
      </div>
    </div>
  );
}

/* ---------- full result ---------- */
function FullResult({ a, traceText, planText, preTrace, prePlan }) {
  const points = assignPoints(a);
  // split points back by which text they hit, for two panels
  return (
    <div style={{ marginBottom: 20 }}>
      <CompactVerdict a={{ ...a, self_review: a.self_review_checklist }} points={points} />
      {a.summary && <p className="note" style={{ marginBottom: 12 }}>{a.summary}</p>}

      {a.skip_check && !a.skip_check.decision_coherent && (
        <div className="banner-err" style={{ marginBottom: 8 }}>⚑ Skip decision may be inconsistent: {a.skip_check.note}</div>
      )}
      {a.trace_plan_consistency && !a.trace_plan_consistency.consistent && (
        <div className="banner-err" style={{ marginBottom: 8 }}>⚑ Trace↔Plan mismatch (M3): {a.trace_plan_consistency.detail}</div>
      )}

      {/* highlighted panels — points may reference either text; show both */}
      <HighlightedText label="Revised trace — flagged spans" text={traceText} points={points} />
      <HighlightedText label="Revised plan — flagged spans" text={planText} points={points} />

      {/* numbered points */}
      <PointList points={points} />

      {a.diff_analysis && (a.diff_analysis.suspicious_unchanged?.length > 0 || a.diff_analysis.new_problems_introduced?.length > 0 || a.diff_analysis.key_changes?.length > 0) && (
        <details className="expander">
          <summary><span className="chev">▸</span> What changed vs. pre-seed (AI summary)</summary>
          <div className="ebody" style={{ fontSize: 12.5 }}>
            {a.diff_analysis.key_changes?.length > 0 && (<><b>Changes:</b><ul style={{ margin: "4px 0 8px 18px" }}>{a.diff_analysis.key_changes.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            {a.diff_analysis.suspicious_unchanged?.length > 0 && (<><b style={{ color: "var(--red)" }}>Risky unchanged:</b><ul style={{ margin: "4px 0 8px 18px", color: "var(--red)" }}>{a.diff_analysis.suspicious_unchanged.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            {a.diff_analysis.new_problems_introduced?.length > 0 && (<><b style={{ color: "var(--red)" }}>New problems:</b><ul style={{ margin: "4px 0 0 18px", color: "var(--red)" }}>{a.diff_analysis.new_problems_introduced.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
          </div>
        </details>
      )}

      <DiffView before={preTrace} after={traceText} />
      <DiffView before={prePlan} after={planText} />

      <SelfReviewBlock items={a.self_review_checklist} />

      {a.label_guidance && (
        <details className="expander">
          <summary><span className="chev">▸</span> Label guidance (cameras / Temporal)</summary>
          <div className="ebody" style={{ fontSize: 12.5 }}>
            <div className="g-row"><b>Cameras text implies:</b> {a.label_guidance.cameras_text_implies?.length ? a.label_guidance.cameras_text_implies.join(", ") : "—"}</div>
            <div className="g-row"><b>Temporal?</b> {a.label_guidance.temporal_needed} — {a.label_guidance.temporal_reason}</div>
            <div className="g-row"><b>Selection:</b> {a.label_guidance.camera_selection_note}</div>
          </div>
        </details>
      )}

      {a.rubric_sweep?.length > 0 && (
        <details className="expander">
          <summary><span className="chev">▸</span> Full rubric sweep (all 17)</summary>
          <div className="ebody"><div className="sweep">{a.rubric_sweep.map((r, i) => (
            <div className="sweep-item" key={i} title={r.note}><span className={"dot " + (r.status || "na").replace("/", "")} /><span className="sc">{r.code}</span><span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note}</span></div>))}</div></div>
        </details>
      )}
    </div>
  );
}
