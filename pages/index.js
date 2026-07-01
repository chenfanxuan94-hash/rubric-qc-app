// pages/index.js — v3.8.2
import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { SKIP_QUESTIONS } from "../lib/rubricKnowledge.js";
import { lintAll } from "../lib/sopLint.js";
import { CHECK_MODELS } from "../lib/checkModels.js";
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
  const [textRoute, setTextRoute] = useState(""); // given context, NOT labeler-authored
  const [revisedPlan, setRevisedPlan] = useState("");
  const [cameras, setCameras] = useState([]);
  const [temporal, setTemporal] = useState(false);

  // ---- multi-model check state (v3.9) ----
  // selectedModels: which models run on "Run check" (opus48 is locked on).
  const [selectedModels, setSelectedModels] = useState(["opus48"]);
  // runs: per-model result { loading, res, err, raw, ms }
  const [runs, setRuns] = useState({});
  const [activeModel, setActiveModel] = useState("opus48");
  const userPickedTab = useRef(false);
  const [runNotices, setRunNotices] = useState([]);
  // ---- footage frames (beta, v3.10) ----
  const [sharing, setSharing] = useState(false);
  const [frames, setFrames] = useState([]); // [{dataUrl, kb}]
  const [burstIn, setBurstIn] = useState(0); // countdown
  const [clipOn, setClipOn] = useState(false); // recording 1fps
  const [frameView, setFrameView] = useState("grid"); // what's on screen for the next captures
  const shareVideoRef = useRef(null);
  const shareStreamRef = useRef(null);

  async function startShare() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      shareStreamRef.current = stream;
      setSharing(true);
      setTimeout(() => {
        if (shareVideoRef.current) { shareVideoRef.current.srcObject = stream; shareVideoRef.current.play().catch(() => {}); }
      }, 50);
      stream.getVideoTracks()[0].addEventListener("ended", stopShare);
    } catch { /* user cancelled the picker */ }
  }
  function stopShare() {
    try { shareStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    shareStreamRef.current = null; setSharing(false); setBurstIn(0); stopClip();
  }
  function grabFrame(maxW = 1024, q = 0.7) {
    const v = shareVideoRef.current;
    if (!v || !v.videoWidth) return null;
    const scale = Math.min(1, maxW / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL("image/jpeg", q);
    return { dataUrl, kb: Math.round(dataUrl.length * 0.75 / 1024) };
  }
  function captureOne() {
    const f = grabFrame(1024, 0.7);
    if (f) setFrames((cur) => [...cur, { ...f, view: frameView, t: null }].slice(0, 16));
  }
  const clipRef = useRef(null);
  function recordClip() { // 3-2-1 countdown, then 1 frame/sec for up to 15s (or Stop)
    let n = 3; setBurstIn(n);
    const cd = setInterval(() => {
      n -= 1; setBurstIn(n);
      if (n <= 0) {
        clearInterval(cd);
        let t = 0;
        setClipOn(true);
        const grab = () => {
          const f = grabFrame(720, 0.55);
          if (f) setFrames((cur) => [...cur, { ...f, view: frameView, t: Math.round(t * 10) / 10 }].slice(0, 36));
          t += 1 / 3;
          if (t >= 11) stopClip();
        };
        grab();
        clipRef.current = setInterval(grab, 333);
      }
    }, 1000);
  }
  function stopClip() { if (clipRef.current) clearInterval(clipRef.current); clipRef.current = null; setClipOn(false); setBurstIn(0); }
  const framesKb = frames.reduce((a, f) => a + f.kb, 0);
  const [gram, setGram] = useState({ loading: false, res: null, err: null });
  const [cam, setCam] = useState({ loading: false, res: null, err: null });
  const [missing, setMissing] = useState(null); // missing revised fields
  const [ctxMissing, setCtxMissing] = useState(null); // missing required context
  const [tip, setTip] = useState(null);
  const [revisions, setRevisions] = useState([]); // [{trace, plan, verdict, majors, minors, at}]
  const [prevFindings, setPrevFindings] = useState({}); // per-model anchor for re-check
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
  const base = () => ({ taskerName, taskId, triageNote, skipped, skipAnswers, preseedTrace, revisedTrace, preseedPlan, revisedPlan, textRoute, cameras, temporal });

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
    userPickedTab.current = false;
    setActiveModel(selectedModels[0] || "opus48");
    // snapshot the text the models will see (for "did you change it?" checks)
    setResultText({ trace: revisedTrace, plan: revisedPlan });
    setRunNotices([]);
    // reset per-result interaction state; keep disagreed suppressions
    setDismissed({}); setFading({}); setCamCleared({}); setCamFading({}); setPendingAddressed(null);
    // all selected models -> loading
    setRuns(Object.fromEntries(selectedModels.map((mid) => [mid, { loading: true, res: null, err: null, raw: null, ms: null }])));
    setGram({ loading: true, res: null, err: null });

    // grammar once (it reviews the text, not the model)
    callApi("/api/grammar", base(), 120000).then((g) => {
      setGram({ loading: false, res: (g.grammar && Array.isArray(g.grammar.errors)) ? g.grammar.errors : [], err: g.error || null });
    });

    // each model runs in parallel as its own request; tabs fill in as each finishes
    selectedModels.forEach((mid) => {
      callApi("/api/check", {
        ...base(), modelId: mid,
        frames: frames.map((f) => ({ d: f.dataUrl, view: f.view || 'grid', t: f.t })),
        priorFindings: prevFindings[mid] || null,
        suppressed: suppressedList.filter((s) => !s.model || s.model === mid).map(({ model, ...rest }) => rest),
      }, 780000).then((d) => {
        if (d.analysis) {
          setPrevFindings((pf) => ({ ...pf, [mid]: { major_risks: d.analysis.major_risks || [], minor_flags: d.analysis.minor_flags || [] } }));
          if (mid === "opus48") {
            const snap = {
              trace: revisedTrace, plan: revisedPlan,
              verdict: d.analysis.verdict,
              majors: d.analysis.major_risks?.length || 0,
              minors: d.analysis.minor_flags?.length || 0,
              at: new Date().toISOString(),
            };
            setRevisions((r) => [...r, snap]);
          }
          setRunNotices(noticesFor());
        }
        setRuns((cur) => ({ ...cur, [mid]: { loading: false, res: d.analysis || null, err: d.error || null, raw: d.raw || null, ms: d.ms ?? null } }));
        // jump to the first model that finishes so review can start immediately
        if (d.analysis && !userPickedTab.current) {
          setActiveModel((amid) => (runsRef.current?.[amid]?.res ? amid : mid));
        }
      });
    });
  }
  // keep a ref of runs for the auto-activate check above
  const runsRef = useRef(runs);
  runsRef.current = runs;

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

  // p is an issue point {code, sev, where, fix, why, evidence, _key, _model}
  function onDisagree(p) {
    fadeThenDismiss(p._key, "disagree");
    setSuppressedList((s) => [...s, { code: p.code, fix: p.fix || p.title, model: p._model || activeModel }]);
    logFeedback({ code: p.code, where: p.where, severity: p.sev, fix: p.fix || p.title, why: p.why, evidence: p.evidence, action: "disagree", model: p._model || activeModel });
  }

  function onAddressed(p) {
    // did the relevant field change since the result was produced?
    const field = (p.where === "plan") ? "plan" : "trace";
    const now = field === "plan" ? revisedPlan : revisedTrace;
    const changed = (now || "") !== (resultText[field] || "");
    if (!changed) { setPendingAddressed(p._key); return; } // ask "fixed or disagree?"
    fadeThenDismiss(p._key, "addressed");
    logFeedback({ code: p.code, where: p.where, severity: p.sev, fix: p.fix || p.title, why: p.why, evidence: p.evidence, action: "addressed", textChanged: true, model: p._model || activeModel });
  }

  function confirmAddressedAnyway(p) { // they insist they fixed it though text looks same
    setPendingAddressed(null);
    fadeThenDismiss(p._key, "addressed");
    logFeedback({ code: p.code, where: p.where, severity: p.sev, fix: p.fix || p.title, why: p.why, evidence: p.evidence, action: "addressed", textChanged: false, note: "claimed-fixed-no-text-change", model: p._model || activeModel });
  }
  function convertToDisagree(p) { // after the prompt, they admit they disagree
    setPendingAddressed(null);
    onDisagree(p);
  }

  function clearCam(idx, how) { // camera gate is per-model: keys are `${activeModel}|${idx}`
    const k = activeModel + "|" + idx;
    setCamFading((f) => ({ ...f, [k]: true }));
    setTimeout(() => setCamCleared((c) => ({ ...c, [k]: how })), 420);
  }

  // one-click grammar fix: replace first occurrence of `original` with `suggestion`, and
  // remove that error from the active grammar list so the blue underline clears immediately.
  function applyGrammarFix(where, original, suggestion) {
    if (!original) return;
    if ((where || "trace") === "plan") {
      setRevisedPlan((t) => t.replace(original, suggestion));
    } else {
      setRevisedTrace((t) => t.replace(original, suggestion));
    }
    setGram((g) => {
      if (!g.res) return g;
      let removed = false;
      const res = g.res.filter((e) => {
        if (!removed && (e.where || "trace") === (where || "trace") && e.original === original && e.suggestion === suggestion) {
          removed = true; return false;
        }
        return true;
      });
      return { ...g, res };
    });
  }

  async function submit() {
    setSubmitErr(null);
    if (!taskId.trim()) { setSubmitErr("Task ID is required to submit."); return; }
    setSubmitting(true);
    // primary = Opus (always runs); extra models ride inside sectionResults (jsonb, no migration)
    const primary = runs.opus48?.res || Object.values(runs).find((r) => r?.res)?.res || null;
    const extraModels = {};
    Object.entries(runs).forEach(([mid, r]) => {
      if (mid !== "opus48" && (r?.res || r?.err)) extraModels[mid] = { analysis: r.res || null, error: r.err || null, ms: r.ms ?? null };
    });
    const d = await callApi("/api/submit", {
      ...base(),
      analysis: primary,
      sectionResults: { camera: cam.res, grammar: gram.res, framesUsed: frames.length, models: extraModels, modelSelection: selectedModels, modelTimes: Object.fromEntries(Object.entries(runs).map(([mid, r]) => [mid, r?.ms ?? null])) },
      revisions,
      score: scoreOf(primary),
    }, 30000);
    setSubmitting(false);
    if (d.error) setSubmitErr(d.error); else { setSubmitted(true); setUnsavedModal(false); }
  }

  function newTaskClick() {
    // compelling reminder: if there's an un-submitted result, push hard to submit
    if (anyRes && !submitted) { setUnsavedModal(true); return; }
    resetForNext();
  }

  function resetForNext() {
    setTaskId(""); setTriageNote(""); setSkipped(false); setSkipAnswers({});
    setPreseedTrace(""); setRevisedTrace(""); setPreseedPlan(""); setRevisedPlan(""); setTextRoute("");
    setCameras([]); setTemporal(false);
    setRuns({}); setRunNotices([]); setActiveModel(selectedModels[0] || "opus48"); userPickedTab.current = false;
    setGram({ loading: false, res: null, err: null }); setCam({ loading: false, res: null, err: null });
    setMissing(null); setCtxMissing(null); setSubmitted(false); setSubmitErr(null);
    setRevisions([]); setPrevFindings({}); setShowHistory(false); setUnsavedModal(false);
    setDismissed({}); setFading({}); setSuppressedList([]); setCamCleared({}); setCamFading({}); setPendingAddressed(null); setResultText({ trace: "", plan: "" }); setSplitMode(false); setFrames([]); stopShare();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- per-model derived state (v3.9): everything below renders the ACTIVE tab ----
  const act = runs[activeModel] || {};
  const anyLoading = Object.values(runs).some((r) => r?.loading);
  const anyRes = Object.values(runs).some((r) => r?.res);
  const started = Object.keys(runs).length > 0;
  const multi = selectedModels.length > 1;

  const allPoints = act.res ? assignPoints(act.res, activeModel) : [];
  // stable key per issue; attach _key, _consistency
  allPoints.forEach((p) => {
    p._key = activeModel + "|" + (p.sev || "x") + "|" + (p.code || "") + "|" + (p.where || "") + "|" + (p.fix || p.title || "");
    p._model = activeModel;
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

  // camera-check gate — per model. The active tab renders ITS slice; submit requires
  // EVERY model that returned a result to have all its camera items cleared.
  const camItems = (act.res && Array.isArray(act.res.self_review_checklist)) ? act.res.self_review_checklist : [];
  const camClearedAct = {}; const camFadingAct = {};
  camItems.forEach((_, i) => {
    const k = activeModel + "|" + i;
    if (camCleared[k]) camClearedAct[i] = camCleared[k];
    if (camFading[k]) camFadingAct[i] = camFading[k];
  });
  const camPendingByModel = Object.entries(runs)
    .filter(([, r]) => r?.res)
    .map(([mid, r]) => {
      const items = Array.isArray(r.res.self_review_checklist) ? r.res.self_review_checklist : [];
      const pending = items.filter((_, i) => !camCleared[mid + "|" + i]).length;
      return { mid, pending };
    });
  const camAllCleared = camPendingByModel.every((x) => x.pending === 0);
  const canSubmit = !anyRes || (camAllCleared && !anyLoading); // every returned model's camera items must be cleared first

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
          {/* FOOTAGE FRAMES (beta, v3.10) — share the window playing the footage; capture frames for the AI */}
          <div className="foot-panel">
            <div className="mp-head">📺 Footage frames <span className="beta-tag">beta</span></div>
            <div className="mp-note">Optional: share the <b>window or tab playing the task footage</b>, capture a few frames at the decision moment, and the AI can visually verify the text against them. Tip: put the footage window and this tool <b>side by side</b>; clips are 10–15s, so use 🎬 Record clip to sample the whole clip (3 frames/sec for up to 11s) — switch to the footage window during the 3-2-1 countdown and press play. Tag what's on screen (grid or a zoomed camera) so the AI reads it correctly. Frames are sent to the AI for this check only — they are <b>never stored</b>.</div>
            {!sharing ? (
              <button className="ghost" onClick={startShare}>Share footage view…</button>
            ) : (
              <div className="foot-live">
                <div className="foot-prevwrap">
                  <video ref={shareVideoRef} muted playsInline className="foot-preview" />
                  {burstIn > 0 && <div className="foot-count">{burstIn}</div>}
                </div>
                <div className="foot-btns">
                  <label className="hint" style={{ marginBottom: 2 }}>What's on screen right now:</label>
                  <select className="foot-view" value={frameView} onChange={(e) => setFrameView(e.target.value)}>
                    <option value="grid">Full 8-camera grid</option>
                    {CAMERAS.map((c) => <option key={c} value={c}>{c} (zoomed single camera)</option>)}
                  </select>
                  <button className="primary" onClick={captureOne} disabled={frames.length >= 36 || clipOn}>📸 Capture frame</button>
                  {!clipOn
                    ? <button className="ghost" onClick={recordClip} disabled={burstIn > 0 || frames.length >= 36}>🎬 Record clip (3 frames/sec, up to 11s)</button>
                    : <button className="ghost" onClick={stopClip}>⏹ Stop recording ({frames.length}/36)</button>}
                  <button className="ghost" onClick={stopShare}>Stop sharing</button>
                </div>
              </div>
            )}
            {frames.length > 0 && (
              <div className="foot-frames">
                {frames.map((f, i) => (
                  <div className="foot-thumb" key={i}>
                    <img src={f.dataUrl} alt={"frame " + (i + 1)} />
                    <span className="foot-tag">{f.view === "grid" ? "grid" : f.view}{f.t != null ? ` · ${f.t}s` : ""}</span>
                    <button className="foot-x" onClick={() => setFrames((cur) => cur.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
                <div className="foot-meta">{frames.length}/36 · ~{framesKb} KB {framesKb > 3200 && <b style={{ color: "var(--red)" }}>— too heavy, remove frames</b>}</div>
              </div>
            )}
          </div>
        </div>

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

          <div className="field" style={{ marginTop: 16 }}>
            <label>Text Route <span className="hint" style={{ color: "var(--muted)" }}>· given context, not written by you — used only to check consistency</span></label>
            <textarea value={textRoute} onChange={(e) => setTextRoute(e.target.value)} placeholder="Paste the Text Route from the task if provided (e.g. the intended maneuver / route description)..." style={{ minHeight: 70 }} />
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

          {/* MODEL PICKER (v3.9) — which AIs review this task; applies to Run check and Re-check */}
          <div className="model-pick">
            <div className="mp-head">AI reviewers for this check</div>
            <div className="mp-note">Opus 4.8 always runs. If you have time, add a second or third model — different models catch different blind spots. Each added model runs <b>in parallel</b> and shows in its own tab as soon as it finishes.</div>
            <div className="mp-rows">
              {CHECK_MODELS.map((m) => {
                const onSel = selectedModels.includes(m.id);
                return (
                  <label key={m.id} className={"mp-row" + (onSel ? " on" : "") + (m.locked ? " locked" : "")}>
                    <input type="checkbox" checked={onSel} disabled={m.locked || anyLoading}
                      onChange={() => setSelectedModels((s) => onSel ? s.filter((x) => x !== m.id) : [...s, m.id])} />
                    <span className="mp-name">{m.label}</span>
                    <span className="mp-sub">{m.sub}{m.locked ? " · always on" : ""}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {!(multi ? started : anyRes) && (
            <div className="btns" style={{ marginTop: 16 }}>
              <button className="primary" onClick={onRunClick} disabled={anyLoading}>
                {anyLoading ? <><span className="spinner" />Reviewing with Opus 4.8…</> : (multi ? `Run check (${selectedModels.length} models)` : "Run check")}
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

          {!multi && act.err && <div className="banner-err" style={{ marginTop: 12 }}>{act.err}</div>}
          {!multi && act.raw && <pre className="json" style={{ marginTop: 12 }}>{act.raw}</pre>}
        </div>

        {/* RESULTS — its own separate block */}
        {(multi ? started : anyRes) && (
        <div className="card results-card">
          {multi && (
            <div className="mtabs">
              {selectedModels.map((mid) => {
                const m = CHECK_MODELS.find((x) => x.id === mid) || { label: mid };
                const r = runs[mid] || {};
                return (
                  <button key={mid} className={"mtab" + (activeModel === mid ? " on" : "")}
                    onClick={() => { userPickedTab.current = true; setActiveModel(mid); setTip(null); }}>
                    {m.label}
                    {r.loading && <span className="mtab-load" />}
                    {!r.loading && r.ms != null && <span className="mtab-ms">{(r.ms / 1000).toFixed(0)}s</span>}
                    {!r.loading && r.err && <span className="mtab-x">!</span>}
                  </button>
                );
              })}
            </div>
          )}

          {act.loading && (
            <div className="mtab-waiting"><span className="spinner" /> {(CHECK_MODELS.find((x) => x.id === activeModel) || {}).label || "This model"} is reviewing… {multi ? "— other tabs may finish first; you can start there." : ""}</div>
          )}
          {!act.loading && act.err && (
            <div>
              <div className="banner-err">This model didn't return a usable result: {act.err}</div>
              {act.raw && <pre className="json" style={{ marginTop: 12 }}>{act.raw}</pre>}
            </div>
          )}
          {act.res && (
            <div>
              {runNotices.length > 0 && (
                <div className="notice-box">{runNotices.map((n, i) => <div key={i}>• {n}</div>)}</div>
              )}
              {splitMode ? (
                <div className="split-wrap">
                  <div className="split-left">
                    <button className="split-exit" onClick={() => setSplitMode(false)}>← Stack view</button>
                    <FullResult a={act.res} setTip={setTip} hoveredPoint={tip?.p?._point}
                      tracePoints={tracePoints} planPoints={planPoints} points={points}
                      consistencyPoints={consistencyPoints} rubricPoints={rubricPoints} inSplit={true}
                      grammar={gram.res} grammarErr={gram.err} lint={lintNow}
                      traceText={revisedTrace} planText={revisedPlan}
                      preTrace={preseedTrace} prePlan={preseedPlan}
                      fading={fading} onAddressed={onAddressed} onDisagree={onDisagree}
                      pendingAddressed={pendingAddressed} confirmAddressedAnyway={confirmAddressedAnyway} convertToDisagree={convertToDisagree}
                      camItems={camItems} camCleared={camClearedAct} camFading={camFadingAct} clearCam={clearCam} applyGrammarFix={applyGrammarFix} />
                  </div>
                  <div className="split-right">
                    <div className="split-right-head">Your revised text — edit here</div>
                    <EditPanel label="Trace" field="trace" value={revisedTrace} onChange={setRevisedTrace} onGrammarFix={applyGrammarFix} onDisagree={onDisagree}
                      points={[...tracePoints, ...gTracePts]} located={lintLocated(lintNow, "trace")} setTip={setTip} hoveredPoint={tip?.p?._point} />
                    <EditPanel label="Plan" field="plan" value={revisedPlan} onChange={setRevisedPlan} onGrammarFix={applyGrammarFix} onDisagree={onDisagree}
                      points={[...planPoints, ...gPlanPts]} located={lintLocated(lintNow, "plan")} setTip={setTip} hoveredPoint={tip?.p?._point} />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="show-text-bar">
                    <button className="show-text-btn" onClick={() => setSplitMode(true)}>Show revised text →</button>
                  </div>
                  <FullResult a={act.res} setTip={setTip} hoveredPoint={tip?.p?._point}
                    tracePoints={tracePoints} planPoints={planPoints} points={points}
                    consistencyPoints={consistencyPoints} rubricPoints={rubricPoints} inSplit={false}
                    grammar={gram.res} grammarErr={gram.err} lint={lintNow}
                    traceText={revisedTrace} planText={revisedPlan}
                    preTrace={preseedTrace} prePlan={preseedPlan}
                    fading={fading} onAddressed={onAddressed} onDisagree={onDisagree}
                    pendingAddressed={pendingAddressed} confirmAddressedAnyway={confirmAddressedAnyway} convertToDisagree={convertToDisagree}
                    camItems={camItems} camCleared={camClearedAct} camFading={camFadingAct} clearCam={clearCam} applyGrammarFix={applyGrammarFix} />
                </div>
              )}

              {/* Re-check + revisions — at the BOTTOM of the results */}
              <div className="recheck-bar">
                <button className="primary" onClick={onRunClick} disabled={anyLoading}>
                  {anyLoading ? <><span className="spinner" />Re-checking…</> : (multi ? `↻ Re-check (${selectedModels.length} models)` : "↻ Re-check (after edits)")}
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
        </div>
        )}

        {/* SUBMIT */}
        <div className="card" style={{ borderColor: "var(--ink)" }}>
          <h2 style={{ color: "var(--ink)" }}>Submit for review</h2>
          <p className="note" style={{ marginBottom: 12 }}>Saves this task (ID, trace/plan, and your check) for the reviewer. Run the check first.</p>
          {submitErr && <div className="banner-err" style={{ marginBottom: 12 }}>{submitErr}</div>}
          {!canSubmit && !submitted && (
            <div className="gate-note">
              {anyLoading
                ? <>Some models are still reviewing — wait for them to finish before submitting.</>
                : <>Clear all camera checks above (mark each <b>Checked</b> or <b>Not relevant</b>) before submitting.
                    {multi && camPendingByModel.some((x) => x.pending > 0) && (
                      <> Pending: {camPendingByModel.filter((x) => x.pending > 0).map((x) => `${(CHECK_MODELS.find((m) => m.id === x.mid) || {}).label || x.mid} (${x.pending})`).join(", ")} — open that tab to clear them.</>
                    )}</>}
            </div>
          )}
          {submitted ? (
            <div className="banner-ok">✓ Submitted. Task <b>{taskId}</b> is saved.
              <button className="ghost" style={{ marginLeft: 14 }} onClick={resetForNext}>Start next task</button></div>
          ) : (
            <button className="submit" onClick={submit} disabled={submitting || !canSubmit}>{submitting ? <><span className="spinner" />Saving…</> : "Submit task →"}</button>
          )}
        </div>

        <div className="footer-note">Rehearsal / QC tool · your own task content · powered by Claude Opus 4.8 (+ optional GPT-5.5 & Gemini 3.1 Pro second opinions).</div>
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
      p: { _lint: true, _point: "S" + (i + 1), _color: SOPLINT_COLOR, kind: e.kind, original: e.original, fix: e.fix, rule: e.rule, suggestion: e.suggestion },
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
      {p.visual_check && <div className="tip-row"><b>👁 Frames:</b> {p.visual_check}{p.visual_note ? " — " + p.visual_note : ""}</div>}
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
// in an anchored popup, prefilled with a suggested correction. Grammar = one-click fix.
function EditPanel({ label, field, value, onChange, onGrammarFix, onDisagree, points, located, setTip, hoveredPoint }) {
  const [free, setFree] = useState(false);
  const [edit, setEdit] = useState(null); // {start,end,p,rect,draft}

  function openEdit(mark, e) {
    const r = e.currentTarget.getBoundingClientRect();
    setTip && setTip(null);
    const span = value.slice(mark.start, mark.end);
    const pre = (mark.p.suggestion != null && mark.p.suggestion !== undefined) ? mark.p.suggestion : span;
    setEdit({ start: mark.start, end: mark.end, p: mark.p, rect: { left: r.left, top: r.top, bottom: r.bottom }, draft: pre, span });
  }
  function saveEdit() {
    if (!edit) return;
    onChange(value.slice(0, edit.start) + edit.draft + value.slice(edit.end));
    setEdit(null);
  }
  function applyGrammar() { // grammar one-click → also clears the underline via onGrammarFix
    if (!edit) return;
    if (onGrammarFix) onGrammarFix(field, edit.p.original, edit.p.suggestion);
    else onChange(value.slice(0, edit.start) + (edit.p.suggestion || "") + value.slice(edit.end));
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
          <div className="ep-readhint">Click any highlight to edit it (a fix is suggested) · or “Edit freely” for the rest</div>
        </div>
      ) : (
        <div className="ep-empty">No text yet — click “Edit freely” to add it.</div>
      )}

      {edit && (
        <SpanEditor edit={edit} setEdit={setEdit} onSave={saveEdit} onFix={applyGrammar}
          onDisagree={onDisagree ? (p) => { onDisagree(p); setEdit(null); } : null}
          onCancel={() => setEdit(null)} />
      )}
    </div>
  );
}

// shows whitespace visibly so spacing errors are findable
function showWS(s) {
  if (s == null) return "";
  return String(s).replace(/ /g, "·").replace(/\t/g, "⇥");
}

function SpanEditor({ edit, setEdit, onSave, onFix, onDisagree, onCancel }) {
  const p = edit.p;
  const ref = useRef(null);
  const W = 360;
  // render-time horizontal clamp (no measurement needed — width is known)
  const vw = (typeof window !== "undefined") ? window.innerWidth : 1200;
  const vh = (typeof window !== "undefined") ? window.innerHeight : 800;
  let initLeft = edit.rect.left;
  if (initLeft + W > vw - 12) initLeft = vw - W - 12;
  if (initLeft < 12) initLeft = 12;
  const [pos, setPos] = useState({ left: initLeft, top: edit.rect.bottom + 8 });

  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const M = 12;
    let left = edit.rect.left;
    if (left + rect.width > vw - M) left = vw - rect.width - M;
    if (left < M) left = M;
    let top = edit.rect.bottom + 8;
    if (top + rect.height > vh - M) { top = edit.rect.top - rect.height - 8; if (top < M) top = M; }
    setPos({ left, top });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  const isGrammar = p._grammar, isLint = p._lint;
  const isSpacing = isGrammar && (p.gtype === "spacing");
  const node = (
    <>
      <div className="ep-pop-back" onClick={onCancel} />
      <div className="span-editor" ref={ref} style={{ left: pos.left, top: pos.top, borderColor: p._color.bd, maxHeight: vh - 24 }}>
        <div className="se-head">
          {isGrammar ? <><span className="pt-sev" style={{ background: p._color.bg, color: p._color.tx }}>grammar</span><span className="pt-code">{p.gtype || "fix"}</span></>
            : isLint ? <><span className="pt-sev" style={{ background: p._color.bg, color: p._color.tx }}>SOP rule</span><span className="pt-code">{p.kind}</span></>
            : <><span className={"pt-sev " + p.sev}>{p.sev}</span><span className="pt-code">{p.code}{p.type ? " · " + String(p.type).replace(/_/g, " ") : ""}</span></>}
        </div>
        {isGrammar && (<>
          {p.note && <div className="se-note">📍 {p.note}</div>}
          <div className="se-fix"><span className="g-orig">{isSpacing ? showWS(p.original) : p.original}</span> → <span className="g-sug">{isSpacing ? showWS(p.suggestion) : p.suggestion}</span></div>
        </>)}
        {isLint && <div className="se-why">{p.fix}{p.rule ? <span className="muted"> · {p.rule}</span> : null}</div>}
        {!isGrammar && !isLint && (<>
          <div className="se-fix">{p.fix || p.title}</div>
          {p.why && <div className="se-why"><b>Why:</b> {p.why}</div>}
          {p.suggestion != null && <div className="se-sugtag">✎ Suggested rewrite below — verify against the video before accepting.</div>}
        </>)}
        <textarea className="se-input" value={edit.draft} autoFocus
          onChange={(e) => setEdit({ ...edit, draft: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(); if (e.key === "Escape") onCancel(); }} />
        <div className="se-actions">
          {isGrammar && <button className="ib-fixed" onClick={onFix}>✓ Apply fix</button>}
          <button className="ib-agree" onClick={onSave}>✓ Save edit</button>
          {!isGrammar && !isLint && onDisagree && <button className="ib-disagree" onClick={() => onDisagree(p)}>✕ Disagree</button>}
          <button className="ib-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </>
  );
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
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
          {p.visual_check && <div className={"dr vischeck " + p.visual_check}><b>{p.visual_check === "confirmed" ? "👁 Frames: confirmed" : p.visual_check === "contradicted" ? "👁 Frames: CONTRADICTED" : "👁 Frames: not visible"}</b>{p.visual_note ? " — " + p.visual_note : ""}</div>}
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
            <span className="camq">{q.question}
              {q.model_answer && <span className={"cam-modelans " + (q.model_confidence === "high" ? "high" : "unsure")}>{q.model_confidence === "high" ? "🟢 Likely" : "🟡 Can't confirm"} (verify yourself): {q.model_answer}</span>}
            </span>
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
  const [open, setOpen] = useState({}); // key -> bool
  const CAM_RE = /SVC-(?:F|FL|FR|SL|SR|RL|RR|R)\b/gi;
  const raw = lg.cameras_text_implies || [];
  // pull only real camera tokens out of whatever the model returned (it sometimes returns a sentence)
  const found = [];
  raw.forEach((s) => { const m = String(s).match(CAM_RE); if (m) m.forEach((c) => found.push(c.toUpperCase())); });
  const cams = found.length ? [...new Set(found)] : ["SVC-F"];
  const note = lg.camera_selection_note || (raw.length && !found.length ? raw.join(" ") : "Forward view covers the driving decision.");
  const items = [...cams.map((c) => ({ key: c, label: c, why: note }))];
  if (lg.temporal_needed === "yes") items.push({ key: "Temporal", label: "Temporal", why: lg.temporal_reason || "Object movement across frames matters here." });
  return (
    <div>
      <div className="mi-head">Suggested input:</div>
      <div className="mi-list">
        {items.map((it) => (
          <div className="mi-row" key={it.key}>
            <span className="mi-pill">{it.label}</span>
            <button className="mi-plus" onClick={() => setOpen((o) => ({ ...o, [it.key]: !o[it.key] }))} aria-label="why">{open[it.key] ? "−" : "+"}</button>
            {open[it.key] && <div className="mi-why"><b>{it.label}:</b> {it.why} <span className="muted">— confirm against the video; you decide.</span></div>}
          </div>
        ))}
      </div>
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

  const framesSummary = a && a.frames_summary ? String(a.frames_summary) : null;
  return (
    <div className="result">
      {/* 1. What changed — bigger */}
      {a.change_summary && (
        <div className="r-changed"><div className="r-changed-k">What changed</div><div className="r-changed-t">{a.change_summary}</div></div>
      )}

      {/* 2. Big counts */}
      <BigCounts a={a} />

      {/* 2b. What the footage frames show (beta) */}
      {framesSummary && (
        <div className="frames-sum"><b>👁 Frames show:</b> {framesSummary} <span className="fs-caveat">— still confirm on the full video.</span></div>
      )}

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
              {gPoints.map((p, i) => {
                const sp = p.gtype === "spacing";
                return (
                  <div className="gfix" key={i}>
                    <span className="gfix-where">{p.where}</span>
                    <span className="g-orig">{sp ? showWS(p.original) : p.original}</span><span className="g-arrow">→</span><span className="g-sug">{sp ? showWS(p.suggestion) : p.suggestion}</span>
                    {p.note && <span className="gfix-note">📍 {p.note}</span>}
                    {applyGrammarFix && <button className="gfix-btn" onClick={() => applyGrammarFix(p.where, p.original, p.suggestion)}>✓ fix</button>}
                  </div>
                );
              })}
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
