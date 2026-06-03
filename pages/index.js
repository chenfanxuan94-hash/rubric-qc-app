// pages/index.js — v3.4.0
import { useState } from "react";
import { SKIP_QUESTIONS } from "../lib/rubricKnowledge.js";
import { lintAll } from "../lib/sopLint.js";
import ChatAssistant from "../components/ChatAssistant.js";

const CAMERAS = ["SVC-F", "SVC-FL", "SVC-FR", "SVC-SL", "SVC-SR", "SVC-RL", "SVC-RR", "SVC-R"];

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
  const [gram, setGram] = useState({ loading: false, res: null, err: null });
  const [cam, setCam] = useState({ loading: false, res: null, err: null });
  const [missing, setMissing] = useState(null); // missing revised fields
  const [ctxMissing, setCtxMissing] = useState(null); // missing required context
  const [tip, setTip] = useState(null);
  const [revisions, setRevisions] = useState([]); // [{trace, plan, verdict, majors, minors, at}]
  const [prevFindings, setPrevFindings] = useState(null); // anchor for re-check
  const [showHistory, setShowHistory] = useState(false);
  const [unsavedModal, setUnsavedModal] = useState(false);

  // v3.5 interaction state
  const [dismissed, setDismissed] = useState({});      // issueKey -> 'addressed' | 'disagree'
  const [fading, setFading] = useState({});            // issueKey -> true while animating out
  const [suppressedList, setSuppressedList] = useState([]); // [{code, fix}] disagreed; persists across re-checks
  const [camCleared, setCamCleared] = useState({});    // camIndex -> 'checked' | 'na'
  const [camFading, setCamFading] = useState({});
  const [pendingAddressed, setPendingAddressed] = useState(null); // issueKey awaiting "no change?" confirm
  const [resultText, setResultText] = useState({ trace: "", plan: "" }); // text at result time
  const [splitMode, setSplitMode] = useState(false); // side-by-side working view

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
    const ctx = [];
    if (!taskerName.trim()) ctx.push("your name");
    if (!taskId.trim()) ctx.push("Task ID");
    if (!triageNote.trim()) ctx.push("the triage note");
    if (ctx.length) { setCtxMissing(ctx); setMissing(null); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setCtxMissing(null);
    const miss = [];
    if (!revisedTrace.trim()) miss.push("revised thinking trace");
    if (!revisedPlan.trim()) miss.push("revised driving plan");
    if (miss.length) { setMissing(miss); return; }
    doRun();
  }

  async function doRun() {
    setMissing(null); setSubmitted(false);
    setFull({ loading: true, res: null, err: null, raw: null, notices: [] });
    setGram({ loading: true, res: null, err: null });
    const [d, g] = await Promise.all([
      callApi("/api/check", { ...base(), priorFindings: prevFindings, suppressed: suppressedList }),
      callApi("/api/grammar", base(), 120000),
    ]);
    if (d.analysis) {
      const snap = {
        trace: revisedTrace, plan: revisedPlan,
        verdict: d.analysis.verdict,
        majors: d.analysis.major_risks?.length || 0,
        minors: d.analysis.minor_flags?.length || 0,
        at: new Date().toISOString(),
      };
      setRevisions((r) => [...r, snap]);
      setPrevFindings({ major_risks: d.analysis.major_risks || [], minor_flags: d.analysis.minor_flags || [] });
    }
    setFull({ loading: false, res: d.analysis || null, err: d.error || null, raw: d.raw || null, notices: d.analysis ? noticesFor() : [] });
    setGram({ loading: false, res: (g.grammar && Array.isArray(g.grammar.errors)) ? g.grammar.errors : [], err: g.error || null });
    if (d.analysis) {
      // reset per-result interaction state; keep disagreed suppressions
      setDismissed({}); setFading({}); setCamCleared({}); setCamFading({}); setPendingAddressed(null);
      setResultText({ trace: revisedTrace, plan: revisedPlan });
    }
  }

  async function suggestMin() {
    setCam({ loading: true, res: null, err: null });
    const d = await callApi("/api/section", { mode: "camera", ...base() });
    setCam({ loading: false, res: d.analysis || null, err: d.error || null });
  }

  function scoreOf(res) {
    if (!res) return null;
    if ((res.major_risks?.length || 0) > 0) return 0;
    return Math.max(0, 100 - 5 * (res.minor_flags?.length || 0));
  }

  async function logFeedback(ev) {
    try {
      await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: [{ taskerName, taskId, ...ev }] }),
      });
    } catch {}
  }

  function fadeThenDismiss(key, action) {
    setFading((f) => ({ ...f, [key]: true }));
    setTimeout(() => setDismissed((d) => ({ ...d, [key]: action })), 480);
  }

  // p is an issue point {code, sev, where, fix, why, evidence, _key}
  function onDisagree(p) {
    fadeThenDismiss(p._key, "disagree");
    setSuppressedList((s) => [...s, { code: p.code, fix: p.fix || p.title }]);
    logFeedback({ code: p.code, where: p.where, severity: p.sev, fix: p.fix || p.title, why: p.why, evidence: p.evidence, action: "disagree" });
  }

  function onAddressed(p) {
    // did the relevant field change since the result was produced?
    const field = (p.where === "plan") ? "plan" : "trace";
    const now = field === "plan" ? revisedPlan : revisedTrace;
    const changed = (now || "") !== (resultText[field] || "");
    if (!changed) { setPendingAddressed(p._key); return; } // ask "fixed or disagree?"
    fadeThenDismiss(p._key, "addressed");
    logFeedback({ code: p.code, where: p.where, severity: p.sev, fix: p.fix || p.title, why: p.why, evidence: p.evidence, action: "addressed", textChanged: true });
  }

  function confirmAddressedAnyway(p) { // they insist they fixed it though text looks same
    setPendingAddressed(null);
    fadeThenDismiss(p._key, "addressed");
    logFeedback({ code: p.code, where: p.where, severity: p.sev, fix: p.fix || p.title, why: p.why, evidence: p.evidence, action: "addressed", textChanged: false, note: "claimed-fixed-no-text-change" });
  }
  function convertToDisagree(p) { // after the prompt, they admit they disagree
    setPendingAddressed(null);
    onDisagree(p);
  }

  function clearCam(idx, how) {
    setCamFading((f) => ({ ...f, [idx]: true }));
    setTimeout(() => setCamCleared((c) => ({ ...c, [idx]: how })), 420);
  }

  // one-click grammar fix: replace first occurrence of `original` with `suggestion` in the right field
  function applyGrammarFix(where, original, suggestion) {
    if (!original) return;
    if ((where || "trace") === "plan") {
      setRevisedPlan((t) => t.replace(original, suggestion));
    } else {
      setRevisedTrace((t) => t.replace(original, suggestion));
    }
  }

  async function submit() {
    setSubmitErr(null);
    if (!taskId.trim()) { setSubmitErr("Task ID is required to submit."); return; }
    setSubmitting(true);
    const d = await callApi("/api/submit", {
      ...base(),
      analysis: full.res,
      sectionResults: { camera: cam.res, grammar: gram.res },
      revisions,
      score: scoreOf(full.res),
    }, 30000);
    setSubmitting(false);
    if (d.error) setSubmitErr(d.error); else { setSubmitted(true); setUnsavedModal(false); }
  }

  function newTaskClick() {
    // compelling reminder: if there's an un-submitted result, push hard to submit
    if (full.res && !submitted) { setUnsavedModal(true); return; }
    resetForNext();
  }

  function resetForNext() {
    setTaskId(""); setTriageNote(""); setSkipped(false); setSkipAnswers({});
    setPreseedTrace(""); setRevisedTrace(""); setPreseedPlan(""); setRevisedPlan("");
    setCameras([]); setTemporal(false);
    setFull({ loading: false, res: null, err: null, raw: null, notices: [] }); setGram({ loading: false, res: null, err: null }); setCam({ loading: false, res: null, err: null });
    setMissing(null); setCtxMissing(null); setSubmitted(false); setSubmitErr(null);
    setRevisions([]); setPrevFindings(null); setShowHistory(false); setUnsavedModal(false);
    setDismissed({}); setFading({}); setSuppressedList([]); setCamCleared({}); setCamFading({}); setPendingAddressed(null); setResultText({ trace: "", plan: "" }); setSplitMode(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const allPoints = full.res ? assignPoints(full.res) : [];
  // stable key per issue; attach _key, _consistency
  allPoints.forEach((p) => {
    p._key = (p.sev || "x") + "|" + (p.code || "") + "|" + (p.where || "") + "|" + (p.fix || p.title || "");
    const t = (p.type || "").toLowerCase();
    p._consistency = /contradict|mismatch/.test(t) || p.code === "M3";
  });
  const points = allPoints.filter((p) => !dismissed[p._key]); // active (not agreed/disagreed)
  const tracePoints = points.filter((p) => (p.where || "trace") === "trace");
  const planPoints = points.filter((p) => p.where === "plan");
  const consistencyPoints = points.filter((p) => p._consistency);
  const rubricPoints = points.filter((p) => !p._consistency);
  const lintNow = lintAll(revisedTrace, revisedPlan);
  const gTracePts = grammarPoints(gram.res).filter((p) => p.where !== "plan");
  const gPlanPts = grammarPoints(gram.res).filter((p) => p.where === "plan");

  // camera-check gate
  const camItems = (full.res && Array.isArray(full.res.self_review_checklist)) ? full.res.self_review_checklist : [];
  const camAllCleared = camItems.every((_, i) => camCleared[i]);
  const canSubmit = !full.res || camAllCleared; // if a check was run, all camera items must be cleared first

  return (
    <>
      {tip && <TipCard tip={tip} />}
      {unsavedModal && (
        <div className="modal-overlay" onClick={() => setUnsavedModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ico">⚠️</div>
            <h3>This task isn't saved for review yet</h3>
            <p>If you start a new task now, this work — including its full revision history — won't be recorded for the reviewer. Submitting takes one click and keeps everything.</p>
            <div className="btns" style={{ marginTop: 16, justifyContent: "center" }}>
              <button className="submit" onClick={submit} disabled={submitting}>{submitting ? <><span className="spinner" />Saving…</> : "Submit now →"}</button>
              <button className="ghost" onClick={resetForNext}>Discard &amp; start new</button>
            </div>
            {submitErr && <div className="banner-err" style={{ marginTop: 12 }}>{submitErr}</div>}
          </div>
        </div>
      )}
      <header className="app-header">
        <div className="wrap" style={{ position: "relative", textAlign: "center" }}>
          <h1 style={{ margin: 0 }}>Turing Waymo Caption Labeling Support Tool</h1>
          <a className="adminlink-tr" href="/admin">Reviewer view →</a>
        </div>
      </header>

      <div className={"wrap" + (splitMode ? " wide" : "")}>
        <div className="disclaimer">
          <span className="ico">⚠️</span>
          <p>This reviews your <strong>text</strong> — consistency, trace↔plan agreement, writing, and the rubric. Always confirm the scene against the video; a clean text check isn't a guarantee on its own.</p>
        </div>

        {ctxMissing && (
          <div className="banner-err" style={{ marginBottom: 16 }}>Please fill in <b>{ctxMissing.join(", ")}</b> before running a check — the AI needs this context to review accurately.</div>
        )}

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

          <div className="field"><label>Thinking Trace {revisions.length > 0 && <span className="hint" style={{ color: "var(--teal)" }}>· pre-seed locked after first run (read-only)</span>}</label></div>
          <div className="two-col" style={{ marginBottom: 16 }}>
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Pre-seed trace (optional)</label>
              <textarea className={revisions.length > 0 ? "locked" : ""} readOnly={revisions.length > 0} value={preseedTrace} onChange={(e) => setPreseedTrace(e.target.value)} placeholder="Paste the original pre-seed trace (optional)..." /></div>
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Your revised trace{splitMode ? " · editing in side panel →" : ""}</label>
              <textarea value={revisedTrace} onChange={(e) => setRevisedTrace(e.target.value)} placeholder="Paste your edited trace..." readOnly={splitMode} className={splitMode ? "locked" : ""} /></div>
          </div>

          <div className="field"><label>Driving Plan</label></div>
          <div className="two-col">
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Pre-seed plan (optional)</label>
              <textarea className={revisions.length > 0 ? "locked" : ""} readOnly={revisions.length > 0} value={preseedPlan} onChange={(e) => setPreseedPlan(e.target.value)} placeholder="Paste the original pre-seed plan (optional)..." /></div>
            <div className="field" style={{ marginBottom: 0 }}><label className="hint">Your revised plan{splitMode ? " · editing in side panel →" : ""}</label>
              <textarea value={revisedPlan} onChange={(e) => setRevisedPlan(e.target.value)} placeholder="Paste your edited plan..." readOnly={splitMode} className={splitMode ? "locked" : ""} /></div>
          </div>

          {/* Minimal Input — part of the same combined evaluation */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--rule)" }}>
            <div className="field"><label>Minimal Input <span className="hint">(default SVC-F; add a camera only if the decision needs it)</span></label>
              <div className="cams">{CAMERAS.map((c) => (<span key={c} className={"cam" + (cameras.includes(c) ? " on" : "")} onClick={() => toggleCam(c)}>{c}</span>))}</div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <div className="toggle-row">
                <label className="switch"><input type="checkbox" checked={temporal} onChange={(e) => setTemporal(e.target.checked)} /><span className="slider" /></label>
                <label style={{ margin: 0, fontWeight: 500 }}>Temporal selected</label>
                <button className="linkbtn" style={{ marginLeft: 14 }} onClick={suggestMin} disabled={cam.loading}>{cam.loading ? "thinking…" : "💡 suggest (optional)"}</button>
              </div>
              {cam.err && <div className="banner-err" style={{ marginTop: 10 }}>{cam.err}</div>}
              {cam.res && <CameraResult a={cam.res} />}
            </div>
          </div>

          {!full.res && (
            <div className="btns" style={{ marginTop: 16 }}>
              <button className="primary" onClick={onRunClick} disabled={full.loading}>
                {full.loading ? <><span className="spinner" />Reviewing with Opus 4.8…</> : "Run check"}
              </button>
              <button className="ghost" onClick={newTaskClick}>New task</button>
            </div>
          )}

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
        </div>

        {/* RESULTS — its own separate block */}
        {full.res && (
        <div className="card results-card">
          {(() => null)()}
              {full.notices.length > 0 && (
                <div className="notice-box">{full.notices.map((n, i) => <div key={i}>• {n}</div>)}</div>
              )}
              {splitMode ? (
                <div className="split-wrap">
                  <div className="split-left">
                    <button className="split-exit" onClick={() => setSplitMode(false)}>← Stack view</button>
                    <FullResult a={full.res} setTip={setTip} hoveredPoint={tip?.p?._point}
                      tracePoints={tracePoints} planPoints={planPoints} points={points}
                      consistencyPoints={consistencyPoints} rubricPoints={rubricPoints} inSplit={true}
                      grammar={gram.res} grammarErr={gram.err} lint={lintNow}
                      traceText={revisedTrace} planText={revisedPlan}
                      preTrace={preseedTrace} prePlan={preseedPlan}
                      fading={fading} onAddressed={onAddressed} onDisagree={onDisagree}
                      pendingAddressed={pendingAddressed} confirmAddressedAnyway={confirmAddressedAnyway} convertToDisagree={convertToDisagree}
                      camItems={camItems} camCleared={camCleared} camFading={camFading} clearCam={clearCam} applyGrammarFix={applyGrammarFix} />
                  </div>
                  <div className="split-right">
                    <div className="split-right-head">Your revised text — edit here</div>
                    <EditPanel label="Trace" value={revisedTrace} onChange={setRevisedTrace}
                      points={[...tracePoints, ...gTracePts]} located={lintLocated(lintNow, "trace")} setTip={setTip} hoveredPoint={tip?.p?._point} />
                    <EditPanel label="Plan" value={revisedPlan} onChange={setRevisedPlan}
                      points={[...planPoints, ...gPlanPts]} located={lintLocated(lintNow, "plan")} setTip={setTip} hoveredPoint={tip?.p?._point} />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="show-text-bar">
                    <button className="show-text-btn" onClick={() => setSplitMode(true)}>Show revised text →</button>
                  </div>
                  <FullResult a={full.res} setTip={setTip} hoveredPoint={tip?.p?._point}
                    tracePoints={tracePoints} planPoints={planPoints} points={points}
                    consistencyPoints={consistencyPoints} rubricPoints={rubricPoints} inSplit={false}
                    grammar={gram.res} grammarErr={gram.err} lint={lintNow}
                    traceText={revisedTrace} planText={revisedPlan}
                    preTrace={preseedTrace} prePlan={preseedPlan}
                    fading={fading} onAddressed={onAddressed} onDisagree={onDisagree}
                    pendingAddressed={pendingAddressed} confirmAddressedAnyway={confirmAddressedAnyway} convertToDisagree={convertToDisagree}
                    camItems={camItems} camCleared={camCleared} camFading={camFading} clearCam={clearCam} applyGrammarFix={applyGrammarFix} />
                </div>
              )}

              {/* Re-check + revisions — at the BOTTOM of the results */}
              <div className="recheck-bar">
                <button className="primary" onClick={onRunClick} disabled={full.loading}>
                  {full.loading ? <><span className="spinner" />Re-checking…</> : "↻ Re-check (after edits)"}
                </button>
                <button className="ghost" onClick={newTaskClick}>New task</button>
                {revisions.length > 0 && <span className="rev-pill">Revision {revisions.length}</span>}
                {revisions.length > 1 && (
                  <button className="linkbtn" onClick={() => setShowHistory(!showHistory)}>{showHistory ? "hide history ▴" : "view history ▸"}</button>
                )}
                {revisions.length > 1 && (
                  <span className="note">{revisions[0].majors}→{revisions[revisions.length - 1].majors} major · {revisions[0].minors}→{revisions[revisions.length - 1].minors} minor</span>
                )}
              </div>
              {showHistory && revisions.length > 1 && (
                <div className="hist">
                  {revisions.map((rv, i) => (
                    <div className="hist-item" key={i}>
                      <div className="hist-head">
                        <b>Revision {i + 1}</b>
                        <span className={"vb " + (rv.verdict || "ok")}>{(rv.verdict || "ok").replace("_", " ")}</span>
                        <span className="note">{rv.majors} major · {rv.minors} minor</span>
                        <span className="note" style={{ marginLeft: "auto" }}>{new Date(rv.at).toLocaleTimeString()}</span>
                      </div>
                      {i > 0 && (
                        <details className="expander" style={{ marginTop: 6 }}>
                          <summary><span className="chev">▸</span> What changed from Revision {i} → {i + 1}</summary>
                          <div className="ebody">
                            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontFamily: "var(--mono)" }}>TRACE</div>
                            <TrackedBody before={revisions[i - 1].trace} after={rv.trace} />
                            <div style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 4px", fontFamily: "var(--mono)" }}>PLAN</div>
                            <TrackedBody before={revisions[i - 1].plan} after={rv.plan} />
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* SUBMIT */}
        <div className="card" style={{ borderColor: "var(--ink)" }}>
          <h2 style={{ color: "var(--ink)" }}>Submit for review</h2>
          <p className="note" style={{ marginBottom: 12 }}>Saves this task (ID, trace/plan, and your check) for the reviewer. Run the check first.</p>
          {submitErr && <div className="banner-err" style={{ marginBottom: 12 }}>{submitErr}</div>}
          {!canSubmit && !submitted && (
            <div className="gate-note">Clear all camera checks above (mark each <b>Checked</b> or <b>Not relevant</b>) before submitting.</div>
          )}
          {submitted ? (
            <div className="banner-ok">✓ Submitted. Task <b>{taskId}</b> is saved.
              <button className="ghost" style={{ marginLeft: 14 }} onClick={resetForNext}>Start next task</button></div>
          ) : (
            <button className="submit" onClick={submit} disabled={submitting || !canSubmit}>{submitting ? <><span className="spinner" />Saving…</> : "Submit task →"}</button>
          )}
        </div>

        <div className="footer-note">Rehearsal / QC tool · your own task content · powered by Claude Opus 4.8.</div>
      </div>
      <ChatAssistant askerName={taskerName} />
    </>
  );
}

/* ================= rendering ================= */
const SEV_COLOR = {
  major: { bg: "#FEE2E2", bd: "#DC2626", tx: "#991B1B" }, // red
  minor: { bg: "#FEF3C7", bd: "#F59E0B", tx: "#92400E" }, // amber/beige
};
const GRAMMAR_COLOR = { bg: "#DBEAFE", bd: "#2563EB", tx: "#1E40AF" }; // blue

function assignPoints(a) {
  const majors = (a.major_risks || []).map((f) => ({ ...f, sev: "major" }));
  const minors = (a.minor_flags || []).map((f) => ({ ...f, sev: "minor" }));
  return [...majors, ...minors].map((f, i) => ({ ...f, _point: i + 1, _color: SEV_COLOR[f.sev] }));
}

// grammar errors -> point-like objects so segmentize can highlight them (blue layer)
const SOPLINT_COLOR = { bg: "#EDE9FE", bd: "#7C3AED", tx: "#5B21B6" }; // violet

function grammarPoints(errors) {
  return (errors || []).map((e, i) => ({
    _grammar: true,
    _point: "G" + (i + 1),
    _color: GRAMMAR_COLOR,
    where: e.where || "trace",
    spans: [e.original],
    original: e.original,
    suggestion: e.suggestion,
    gtype: e.type,
    note: e.note,
  }));
}

// SOP-lint issues already carry exact offsets — build pre-located marks (more reliable than span search)
function lintLocated(issues, which) {
  return (issues || [])
    .filter((e) => (e.where || "trace") === which)
    .map((e, i) => ({
      start: e.start, end: e.end,
      p: { _lint: true, _point: "S" + (i + 1), _color: SOPLINT_COLOR, kind: e.kind, original: e.original, fix: e.fix, rule: e.rule },
    }));
}

function segmentize(text, points, located = []) {
  if (!text) return [{ text: "" }];
  const marks = [...located.filter((m) => m && m.start >= 0 && m.end <= text.length)];
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
  if (p._lint) {
    return (
      <div className="tipcard" style={{ left, top, width: w, borderColor: p._color.bd }}>
        <div className="tip-head">
          <span className="pt-sev" style={{ background: p._color.bg, color: p._color.tx }}>SOP rule</span>
          <span className="pt-code">{p.kind}</span>
        </div>
        <div className="tip-fix">{p.fix}</div>
        {p.rule && <div className="tip-row muted">{p.rule}</div>}
      </div>
    );
  }
  if (p._grammar) {
    return (
      <div className="tipcard" style={{ left, top, width: w, borderColor: p._color.bd }}>
        <div className="tip-head">
          <span className="pt-sev" style={{ background: p._color.bg, color: p._color.tx }}>grammar</span>
          <span className="pt-code">{p.gtype || "fix"}</span>
        </div>
        <div className="tip-fix"><span className="g-orig">{p.original}</span> → <span className="g-sug">{p.suggestion}</span></div>
        {p.note && <div className="tip-row">{p.note}</div>}
      </div>
    );
  }
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

function HighlightedText({ label, text, points, located = [], setTip, hoveredPoint, emptyMsg, bare }) {
  if (!text) return emptyMsg ? <div className="hl-panel"><div className="hl-body" style={{ color: "var(--muted)", fontStyle: "italic" }}>{emptyMsg}</div></div> : null;
  const segs = segmentize(text, points, located);
  const anyMark = segs.some((s) => s.mark);
  return (
    <div className={"hl-panel" + (bare ? " bare" : "")}>
      {!bare && <div className="hl-head">{label}{!anyMark && points.length > 0 ? " — couldn't pin spans; see list below" : ""}</div>}
      <div className="hl-body">
        {segs.map((s, i) => s.mark
          ? <mark key={i} className={"hl" + (s.mark.p._grammar ? " hl-gram" : "") + (s.mark.p._lint ? " hl-lint" : "") + (hoveredPoint === s.mark.p._point ? " linked" : "")}
              style={(s.mark.p._grammar || s.mark.p._lint)
                ? { textDecorationColor: s.mark.p._color.bd, outlineColor: s.mark.p._color.bd }
                : { background: s.mark.p._color.bg, borderBottomColor: s.mark.p._color.bd, outlineColor: s.mark.p._color.bd }}
              onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ p: s.mark.p, x: r.left, y: r.bottom }); }}
              onMouseLeave={() => setTip(null)}>
              {s.text}{!s.mark.p._grammar && !s.mark.p._lint && <sup className="hl-num" style={{ background: s.mark.p._color.bd }}>{s.mark.p._point}</sup>}
            </mark>
          : <span key={i}>{s.text}</span>)}
      </div>
    </div>
  );
}

// Right-pane editor (Route A): highlighted view stays; click any highlight to edit THAT span
// in an anchored popup (grammar gets one-click fix). "Edit freely" drops to a full textarea.
function EditPanel({ label, value, onChange, points, located, setTip, hoveredPoint }) {
  const [free, setFree] = useState(false);
  const [edit, setEdit] = useState(null); // {start,end,p,x,y,draft}

  function openEdit(mark, e) {
    const r = e.currentTarget.getBoundingClientRect();
    setTip && setTip(null);
    setEdit({ start: mark.start, end: mark.end, p: mark.p, x: r.left, y: r.bottom, draft: value.slice(mark.start, mark.end) });
  }
  function saveEdit() {
    if (!edit) return;
    onChange(value.slice(0, edit.start) + edit.draft + value.slice(edit.end));
    setEdit(null);
  }
  function applyGrammar() {
    if (!edit) return;
    onChange(value.slice(0, edit.start) + (edit.p.suggestion || "") + value.slice(edit.end));
    setEdit(null);
  }

  const segs = segmentize(value, points, located);

  return (
    <div className="edit-panel">
      <div className="ep-head">
        <span className="ep-label">{label}</span>
        <button className="ep-toggle" onClick={() => { setEdit(null); setFree(!free); }}>
          {free ? "✓ Done — show highlights" : "✎ Edit freely"}
        </button>
      </div>
      {free ? (
        <textarea className="ep-textarea" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Edit your revised text here…" />
      ) : value ? (
        <div className="ep-read">
          {segs.map((s, i) => s.mark
            ? <mark key={i} className={"hl ep-hl" + (s.mark.p._grammar ? " hl-gram" : "") + (s.mark.p._lint ? " hl-lint" : "")}
                style={(s.mark.p._grammar || s.mark.p._lint)
                  ? { textDecorationColor: s.mark.p._color.bd }
                  : { background: s.mark.p._color.bg, borderBottomColor: s.mark.p._color.bd }}
                onClick={(e) => openEdit(s.mark, e)}>
                {s.text}{!s.mark.p._grammar && !s.mark.p._lint && <sup className="hl-num" style={{ background: s.mark.p._color.bd }}>{s.mark.p._point}</sup>}
              </mark>
            : <span key={i}>{s.text}</span>)}
          <div className="ep-readhint">Click any highlight to edit it · or “Edit freely” for the rest</div>
        </div>
      ) : (
        <div className="ep-empty">No text yet — click “Edit freely” to add it.</div>
      )}

      {edit && (<>
        <div className="ep-pop-back" onClick={() => setEdit(null)} />
        <SpanEditor edit={edit} setEdit={setEdit} onSave={saveEdit} onFix={applyGrammar} onCancel={() => setEdit(null)} />
      </>)}
    </div>
  );
}

function SpanEditor({ edit, setEdit, onSave, onFix, onCancel }) {
  const p = edit.p;
  const w = 360;
  let left = edit.x; if (typeof window !== "undefined") { if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12; if (left < 12) left = 12; }
  const isGrammar = p._grammar, isLint = p._lint;
  return (
    <div className="span-editor" style={{ left, top: edit.y + 8, width: w, borderColor: p._color.bd }}>
      <div className="se-head">
        {isGrammar ? <><span className="pt-sev" style={{ background: p._color.bg, color: p._color.tx }}>grammar</span><span className="pt-code">{p.gtype || "fix"}</span></>
          : isLint ? <><span className="pt-sev" style={{ background: p._color.bg, color: p._color.tx }}>SOP rule</span><span className="pt-code">{p.kind}</span></>
          : <><span className={"pt-sev " + p.sev}>{p.sev}</span><span className="pt-code">{p.code}{p.type ? " · " + String(p.type).replace(/_/g, " ") : ""}</span></>}
      </div>
      {isGrammar && <div className="se-fix"><span className="g-orig">{p.original}</span> → <span className="g-sug">{p.suggestion}</span></div>}
      {isLint && <div className="se-why">{p.fix}{p.rule ? <span className="muted"> · {p.rule}</span> : null}</div>}
      {!isGrammar && !isLint && (<>
        <div className="se-fix">{p.fix || p.title}</div>
        {p.why && <div className="se-why"><b>Why:</b> {p.why}</div>}
      </>)}
      <textarea className="se-input" value={edit.draft} autoFocus
        onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(); if (e.key === "Escape") onCancel(); }} />
      <div className="se-actions">
        {isGrammar && <button className="ib-fixed" onClick={onFix}>✓ Apply fix</button>}
        <button className="ib-agree" onClick={onSave}>✓ Save edit</button>
        <button className="ib-disagree" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function IssueRow({ p, fading, onAddressed, onDisagree, pending, confirmAddressedAnyway, convertToDisagree }) {
  const [open, setOpen] = useState(false);
  const has = p.why || p.what || p.evidence || p.confirm || p.detail;
  const isPending = pending === p._key;
  return (
    <div className={"issue" + (fading ? " fading" : "")}>
      <div className="issue-top">
        <span className={"issue-dot " + p.sev} />
        <div className="issue-main">
          <div className="issue-fix">{p.fix || p.title || p.detail}</div>
          <div className="issue-tags">
            <span className={"itag " + p.sev}>{p.sev}</span>
            <span className="icode">{p.code}{p.where ? " · " + p.where : ""}{p.type ? " · " + String(p.type).replace(/_/g, " ") : ""}</span>
            {has && <button className="ilink" onClick={() => setOpen(!open)}>{open ? "less ▴" : "details +"}</button>}
          </div>
        </div>
      </div>
      {open && has && (
        <div className="issue-detail">
          {p.what && <div className="dr"><b>What:</b> {p.what}</div>}
          {p.why && <div className="dr"><b>Why:</b> {p.why}</div>}
          {p.detail && !p.why && <div className="dr">{p.detail}</div>}
          {p.evidence && p.evidence !== "—" && <div className="dr"><b>Evidence:</b> <span className="ev">{p.evidence}</span></div>}
        </div>
      )}
      {isPending ? (
        <div className="issue-confirm">
          <span>I don't see a change in your text for this — did you fix it, or do you disagree?</span>
          <div className="issue-actions">
            <button className="ib-fixed" onClick={() => confirmAddressedAnyway(p)}>I fixed it</button>
            <button className="ib-disagree" onClick={() => convertToDisagree(p)}>I disagree</button>
          </div>
        </div>
      ) : (
        <div className="issue-actions">
          <button className="ib-agree" onClick={() => onAddressed(p)}>✓ Addressed</button>
          <button className="ib-disagree" onClick={() => onDisagree(p)}>✕ Disagree</button>
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

function TrackedBody({ before, after }) {
  const d = wordDiff(before, after);
  return (
    <div className="diff-body">
      {d.map((w, i) => w.k === "=" ? <span key={i}>{w.t}</span> : w.k === "-" ? <span key={i} className="diff-del">{w.t}</span> : <span key={i} className="diff-add">{w.t}</span>)}
    </div>
  );
}

function TrackedDiff({ label, before, after }) {
  const [show, setShow] = useState(false);
  if (!after) return null;
  if (!before) return (
    <details className="expander"><summary><span className="chev">▸</span> {label}</summary>
      <div className="ebody" style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 12.5 }}>No pre-seed provided, so there's nothing to compare against.</div></details>
  );
  return (
    <details className="expander" onToggle={(e) => setShow(e.target.open)}>
      <summary><span className="chev">▸</span> {label} <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10 }}>(tracked changes)</span></summary>
      <div className="ebody">
        {show && <TrackedBody before={before} after={after} />}
        <div className="note" style={{ marginTop: 6 }}><span className="diff-del">red dashed = removed</span> · <span className="diff-add">green bold = added</span></div>
      </div>
    </details>
  );
}

function BigCounts({ a }) {
  const maj = a.major_risks?.length || 0, min = a.minor_flags?.length || 0;
  const v = a.verdict || "ok";
  return (
    <div className={"counts " + v}>
      {maj > 0 && <span className="ct ct-major"><b>{maj}</b> major</span>}
      {min > 0 && <span className="ct ct-minor"><b>{min}</b> minor</span>}
      {maj === 0 && min === 0 && <span className="ct ct-clean">✓ no rubric issues in the text</span>}
    </div>
  );
}

function CameraGate({ items, cleared, fading, clearCam }) {
  if (!items || !items.length) return null;
  const remaining = items.filter((_, i) => !cleared[i]).length;
  return (
    <div className="camgate">
      <div className="camgate-head">📷 Check on the video — clear each before submitting {remaining > 0 ? <span className="camgate-n">{remaining} left</span> : <span className="camgate-done">all clear ✓</span>}</div>
      <div className="camgate-list">
        {items.map((q, i) => cleared[i] ? null : (
          <div className={"camitem" + (fading[i] ? " fading" : "")} key={i}>
            <span className="camq">{q.question}</span>
            <div className="cambtns">
              <button className="cb-yes" onClick={() => clearCam(i, "checked")}>Checked</button>
              <button className="cb-na" onClick={() => clearCam(i, "na")}>Not relevant</button>
            </div>
          </div>
        ))}
        {remaining === 0 && <div className="camall">All camera checks cleared — you're good to submit.</div>}
      </div>
    </div>
  );
}

function CameraResult({ a }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="guidance">
        <div className="g-row" style={{ fontSize: 13, marginBottom: 8 }}><b>{a.summary}</b></div>
        <div className="g-row"><b>Recommended minimal set:</b> {a.recommended?.length ? a.recommended.join(", ") : "SVC-F"}</div>
        {a.reasoning && <div className="g-row" style={{ color: "var(--text)" }}>{a.reasoning}</div>}
        <div className="g-row"><b>Temporal?</b> <span style={{ textTransform: "uppercase", fontFamily: "var(--mono)", fontSize: 11, color: a.temporal_needed === "yes" ? "var(--red)" : a.temporal_needed === "maybe" ? "var(--amber-text)" : "var(--green)" }}>{a.temporal_needed}</span> — {a.temporal_reason}</div>
        {a.selection_feedback && <div className="g-row"><b>Your selection:</b> {a.selection_feedback}</div>}
        <div className="note" style={{ marginTop: 8 }}>Reminder: this is a hint to confirm against the video — you decide, not the AI.</div>
      </div>
    </div>
  );
}

function MinimalInputBoxes({ lg }) {
  const [open, setOpen] = useState(null); // which box's why is showing
  const cams = lg.cameras_text_implies?.length ? lg.cameras_text_implies : ["SVC-F"];
  const items = [...cams.map((c) => ({ key: c, label: c, why: lg.camera_selection_note || "Forward view covers the decision." }))];
  if (lg.temporal_needed === "yes") items.push({ key: "Temporal", label: "Temporal", why: lg.temporal_reason || "Motion across frames matters here." });
  const cur = items.find((it) => it.key === open);
  return (
    <div>
      <div className="mi-boxes">
        {items.map((it) => (
          <button key={it.key} className={"mi-box" + (open === it.key ? " on" : "")} onClick={() => setOpen(open === it.key ? null : it.key)}>
            {it.label}<span className="mi-q">?</span>
          </button>
        ))}
      </div>
      {cur && <div className="mi-why"><b>{cur.label}:</b> {cur.why} <span className="muted">— confirm against the video; you decide.</span></div>}
    </div>
  );
}

function FullResult({ a, setTip, hoveredPoint, tracePoints, planPoints, points, consistencyPoints, rubricPoints, inSplit, grammar, grammarErr, lint, traceText, planText, preTrace, prePlan,
  fading, onAddressed, onDisagree, pendingAddressed, confirmAddressedAnyway, convertToDisagree,
  camItems, camCleared, camFading, clearCam, applyGrammarFix }) {
  const gPoints = grammarPoints(grammar);
  const gTrace = gPoints.filter((p) => p.where !== "plan");
  const gPlan = gPoints.filter((p) => p.where === "plan");
  const lintTrace = lintLocated(lint, "trace");
  const lintPlan = lintLocated(lint, "plan");
  const traceAll = [...tracePoints, ...gTrace];
  const planAll = [...planPoints, ...gPlan];
  const consist = a.trace_plan_consistency;
  const consistDetail = consist && consist.consistent === false ? consist.detail : "";
  const consistIssues = [...(consistencyPoints || [])].sort((x, y) => x._point - y._point);
  const rubricIssues = [...(rubricPoints || [])].sort((x, y) => x._point - y._point);
  const hasConsistencyProblem = consistIssues.length > 0 || (consist && consist.consistent === false);
  const issueRow = (p) => (
    <IssueRow key={p._key} p={p} fading={!!fading[p._key]}
      onAddressed={onAddressed} onDisagree={onDisagree}
      pending={pendingAddressed} confirmAddressedAnyway={confirmAddressedAnyway} convertToDisagree={convertToDisagree} />
  );

  return (
    <div className="result">
      {/* 1. What changed — bigger */}
      {a.change_summary && (
        <div className="r-changed"><div className="r-changed-k">What changed</div><div className="r-changed-t">{a.change_summary}</div></div>
      )}

      {/* 2. Big counts */}
      <BigCounts a={a} />

      {/* 3. Consistency block — green/red, headline inside, expand for issues + explanation */}
      <details className={"consist-block " + (hasConsistencyProblem ? "bad" : "ok")} open={hasConsistencyProblem}>
        <summary>
          <span className="cb-pill">{hasConsistencyProblem ? "⚑ Consistency issues found" : "✓ Internally consistent — no issues"}</span>
          <span className="cb-expand">{(consistIssues.length || a.summary || consistDetail) ? "details" : ""}</span>
        </summary>
        <div className="cb-body">
          {a.headline && <div className="cb-headline">{a.headline}</div>}
          {(a.summary || consistDetail) && (
            <details className="cb-why">
              <summary><span className="plus">+</span> Why / full explanation</summary>
              <div className="cb-why-body">
                {a.summary && <p>{a.summary}</p>}
                {consistDetail && <p><b>Trace ↔ Plan:</b> {consistDetail}</p>}
                {a.skip_check && a.skip_check.decision_coherent === false && <p><b>Skip decision:</b> {a.skip_check.note}</p>}
              </div>
            </details>
          )}
          {consistIssues.length > 0 && (
            <div className="cb-issues">
              <div className="cb-issues-h">Inconsistencies to resolve ({consistIssues.length}) <span className="muted">— within trace, within plan, and trace ↔ plan</span></div>
              {consistIssues.map(issueRow)}
            </div>
          )}
        </div>
      </details>

      {/* 4. Rubric-related issues (non-consistency) */}
      {rubricIssues.length > 0 ? (
        <details className="r-more" open>
          <summary><span className="plus">+</span> Rubric-related issues to review and resolve ({rubricIssues.length})</summary>
          <div className="r-more-body">
            <div className="issue-hint">Mark each <b>Addressed</b> once you fix it, or <b>Disagree</b> if you think it's wrong — it clears from here and from your text.</div>
            {rubricIssues.map(issueRow)}
          </div>
        </details>
      ) : (
        <div className="r-allclear">✓ No other rubric issues.</div>
      )}

      {/* 5. Camera checks — mandatory gate */}
      <CameraGate items={camItems} cleared={camCleared} fading={camFading} clearCam={clearCam} />

      {/* 6. Minimal Input — big label; each recommended item is a clickable box that reveals why */}
      {a.label_guidance && (
        <div className="r-guide">
          <div className="r-guide-k">Minimal Input</div>
          <MinimalInputBoxes lg={a.label_guidance} />
        </div>
      )}

      {/* 7. Everything else, collapsed by default */}
      <div className="r-extras">
        {!inSplit && (
          <details className="r-more compact">
            <summary><span className="plus">+</span> Your revised text (highlighted)</summary>
            <div className="r-more-body">
              <div className="legend">
                <span><i className="lg" style={{ background: SEV_COLOR.major.bg, borderColor: SEV_COLOR.major.bd }} /> Major</span>
                <span><i className="lg" style={{ background: SEV_COLOR.minor.bg, borderColor: SEV_COLOR.minor.bd }} /> Minor</span>
                <span><i className="lg gram" style={{ borderColor: GRAMMAR_COLOR.bd }} /> Grammar</span>
                <span><i className="lg gram" style={{ borderColor: SOPLINT_COLOR.bd }} /> SOP rule</span>
              </div>
              <HighlightedText label="Revised trace" text={traceText} points={traceAll} located={lintTrace} setTip={setTip} hoveredPoint={hoveredPoint} />
              <HighlightedText label="Revised plan" text={planText} points={planAll} located={lintPlan} setTip={setTip} hoveredPoint={hoveredPoint} emptyMsg={!planText ? "No revised plan provided." : null} />
            </div>
          </details>
        )}

        {!grammarErr && gPoints.length > 0 && (
          <details className="r-more compact">
            <summary><span className="plus">+</span> Grammar &amp; mechanics ({gPoints.length})</summary>
            <div className="r-more-body">
              {gPoints.map((p, i) => (
                <div className="gfix" key={i}>
                  <span className="gfix-where">{p.where}</span>
                  <span className="g-orig">{p.original}</span><span className="g-arrow">→</span><span className="g-sug">{p.suggestion}</span>
                  {applyGrammarFix && <button className="gfix-btn" onClick={() => applyGrammarFix(p.where, p.original, p.suggestion)}>✓ fix</button>}
                </div>
              ))}
            </div>
          </details>
        )}

        {lint && lint.length > 0 && (
          <details className="r-more compact">
            <summary><span className="plus">+</span> SOP writing standards ({lint.length})</summary>
            <div className="r-more-body">
              {lint.map((e, i) => (
                <div className="gfix" key={i}><span className="gfix-where">{e.where}</span><span className="sop-kind">{e.kind}</span><span className="g-orig">{e.original}</span><span className="g-arrow">→</span><span className="sop-fix">{e.fix}</span></div>
              ))}
            </div>
          </details>
        )}

        <details className="r-more compact"><summary><span className="plus">+</span> Pre-seed → revised diff</summary>
          <div className="r-more-body">
            <TrackedDiff label="Trace" before={preTrace} after={traceText} />
            <TrackedDiff label="Plan" before={prePlan} after={planText} />
          </div>
        </details>

        {a.rubric_sweep?.length > 0 && (
          <details className="r-more compact"><summary><span className="plus">+</span> Full rubric sweep (all 17)</summary>
            <div className="r-more-body"><div className="sweep">{a.rubric_sweep.map((r, i) => (
              <div className="sweep-item" key={i} title={r.note}><span className={"dot " + (r.status || "na").replace("/", "")} /><span className="sc">{r.code}</span><span style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note}</span></div>))}</div></div>
          </details>
        )}
      </div>
    </div>
  );
}
