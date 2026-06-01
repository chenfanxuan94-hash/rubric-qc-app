// pages/admin.js
import { useState } from "react";

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load(k) {
    setError(null); setLoading(true);
    try {
      const r = await fetch("/api/list?key=" + encodeURIComponent(k));
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Failed"); setAuthed(false); }
      else { setRows(data.rows || []); setAuthed(true); loadQuestions(k); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadQuestions(k) {
    try {
      const r = await fetch("/api/questions?pw=" + encodeURIComponent(k));
      const data = await r.json();
      if (r.ok) setQuestions(data.questions || []);
    } catch {}
  }

  async function resolveQuestion(id, resolved) {
    try {
      await fetch("/api/questions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved, password: key }),
      });
      setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, resolved } : q)));
    } catch {}
  }

  function computeTaskerStats(rows) {
    const map = {};
    for (const r of rows) {
      const name = (r.tasker_name && r.tasker_name.trim()) || "(no name)";
      if (!map[name]) map[name] = { name, n: 0, major: 0, minor: 0, ok: 0, minor_v: 0, major_v: 0, codes: {} };
      const t = map[name];
      t.n++;
      t.major += r.major_flags || 0;
      t.minor += r.minor_flags || 0;
      if (r.ai_verdict === "ok") t.ok++;
      else if (r.ai_verdict === "minor_issues") t.minor_v++;
      else if (r.ai_verdict === "major_risk") t.major_v++;
      const a = r.ai_analysis;
      if (a) {
        (a.major_risks || []).forEach((f) => { if (f.code) t.codes[f.code] = (t.codes[f.code] || 0) + 1; });
        (a.minor_flags || []).forEach((f) => { if (f.code) t.codes[f.code] = (t.codes[f.code] || 0) + 1; });
      }
    }
    return Object.values(map).map((t) => ({
      ...t,
      avgMajor: t.n ? (t.major / t.n) : 0,
      avgMinor: t.n ? (t.minor / t.n) : 0,
      topCodes: Object.entries(t.codes).sort((a, b) => b[1] - a[1]).slice(0, 5),
    })).sort((a, b) => b.major_v - a.major_v || b.major - a.major);
  }

  function commonMistakes(rows) {
    const codes = {};
    for (const r of rows) {
      const a = r.ai_analysis;
      if (!a) continue;
      [...(a.major_risks || []), ...(a.minor_flags || [])].forEach((f) => {
        if (!f.code) return;
        if (!codes[f.code]) codes[f.code] = { code: f.code, n: 0, sev: (f.code[0] === "M" ? "major" : "minor"), ex: f.fix || f.title || "" };
        codes[f.code].n++;
      });
    }
    return Object.values(codes).sort((a, b) => b.n - a.n);
  }

  function csvCell(v) {
    if (v === null || v === undefined) v = "";
    if (typeof v === "object") v = JSON.stringify(v);
    v = String(v).replace(/"/g, '""');
    return /[",\n]/.test(v) ? `"${v}"` : v;
  }

  function exportCsv() {
    if (!rows.length) return;
    const cols = [
      ["created_at", (r) => r.created_at],
      ["tasker_name", (r) => r.tasker_name],
      ["task_id", (r) => r.task_id],
      ["skipped", (r) => r.skipped],
      ["verdict", (r) => r.ai_verdict],
      ["score", (r) => r.score],
      ["majors", (r) => r.major_flags],
      ["minors", (r) => r.minor_flags],
      ["revisions", (r) => (r.revisions ? r.revisions.length : "")],
      ["major_codes", (r) => (r.ai_analysis?.major_risks || []).map((f) => f.code).join(" ")],
      ["minor_codes", (r) => (r.ai_analysis?.minor_flags || []).map((f) => f.code).join(" ")],
      ["triage_note", (r) => r.triage_note],
      ["preseed_trace", (r) => r.preseed_trace],
      ["revised_trace", (r) => r.revised_trace],
      ["preseed_plan", (r) => r.preseed_plan],
      ["revised_plan", (r) => r.revised_plan],
      ["cameras", (r) => (r.cameras || []).join(" ")],
      ["temporal", (r) => r.temporal],
      ["headline", (r) => r.ai_analysis?.headline],
    ];
    const head = cols.map((c) => c[0]).join(",");
    const body = rows.map((r) => cols.map((c) => csvCell(c[1](r))).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "rubric_qc_submissions.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <>
        <header className="app-header"><div className="wrap"><div className="eyebrow">Reviewer</div><h1>Submissions review</h1></div></header>
        <div className="wrap narrow" style={{ marginTop: 24 }}>
          <div className="card">
            <h2>Enter reviewer password</h2>
            <div className="field">
              <input type="text" value={key} onChange={(e) => setKey(e.target.value)} placeholder="ADMIN_PASSWORD" onKeyDown={(e) => e.key === "Enter" && load(key)} />
            </div>
            {error && <div className="banner-err">{error}</div>}
            <button className="primary" onClick={() => load(key)} disabled={loading}>{loading ? "Loading…" : "Unlock"}</button>
          </div>
          <div className="footer-note"><a href="/">← back to tasker view</a></div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="wrap row">
          <div><div className="eyebrow">Reviewer</div><h1>Submissions ({rows.length})</h1></div>
          <div className="btns">
            <button className="ghost" onClick={() => load(key)}>Refresh</button>
            <button className="ghost" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
      </header>
      <div className="wrap" style={{ marginTop: 20 }}>
        {error && <div className="banner-err">{error}</div>}

        <div style={{ marginBottom: 18 }}>
          <div className="block-head" style={{ marginBottom: 10 }}>▸ Open questions from the SOP assistant ({questions.filter((q) => !q.resolved).length} unresolved)</div>
          {questions.length === 0 ? (
            <div className="oq-empty">No questions logged yet. When the assistant can't answer something from the canonical doc, it appears here for the next sync.</div>
          ) : (
            <div className="oq-list">
              {questions.map((qq) => (
                <div className={"oq-row" + (qq.resolved ? " done" : "")} key={qq.id}>
                  <label className="oq-check"><input type="checkbox" checked={qq.resolved} onChange={(e) => resolveQuestion(qq.id, e.target.checked)} /></label>
                  <div className="oq-main">
                    <div className="oq-q">{qq.question}</div>
                    <div className="oq-meta">{qq.asker_name ? qq.asker_name + " · " : ""}{new Date(qq.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div className="block-head" style={{ marginBottom: 10 }}>▸ Per-tasker accuracy (reviewer only)</div>
            <div className="tk-grid">
              {computeTaskerStats(rows).map((t) => {
                const total = t.ok + t.minor_v + t.major_v || 1;
                return (
                  <div className="tk-card" key={t.name}>
                    <div className="tk-name">{t.name}</div>
                    <div className="tk-stat"><span>Tasks</span><span className="v">{t.n}</span></div>
                    <div className="tk-stat"><span>Avg majors / task</span><span className="v" style={{ color: t.avgMajor > 0 ? "var(--red)" : "var(--green)" }}>{t.avgMajor.toFixed(2)}</span></div>
                    <div className="tk-stat"><span>Avg minors / task</span><span className="v" style={{ color: "var(--amber-text)" }}>{t.avgMinor.toFixed(2)}</span></div>
                    <div className="tk-stat"><span>Major-risk tasks</span><span className="v" style={{ color: "var(--red)" }}>{t.major_v}</span></div>
                    <div className="tk-bar" title={`${t.ok} clean · ${t.minor_v} minor · ${t.major_v} major`}>
                      <i style={{ width: (100 * t.ok / total) + "%", background: "var(--green)" }} />
                      <i style={{ width: (100 * t.minor_v / total) + "%", background: "var(--amber)" }} />
                      <i style={{ width: (100 * t.major_v / total) + "%", background: "var(--red)" }} />
                    </div>
                    {t.topCodes.length > 0 && (
                      <div className="tk-codes">Most-flagged: {t.topCodes.map(([c, n]) => <span className="cd" key={c}>{c}×{n}</span>)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="block-head" style={{ marginBottom: 10 }}>▸ Most common mistakes (across all submissions)</div>
            <div className="cm-list">
              {commonMistakes(rows).map((c) => (
                <div className="cm-row" key={c.code}>
                  <span className={"pt-sev " + c.sev}>{c.sev}</span>
                  <span className="cm-code">{c.code}</span>
                  <span className="cm-bar"><i style={{ width: Math.min(100, c.n * 18) + "px", background: c.sev === "major" ? "var(--red)" : "var(--amber)" }} /></span>
                  <span className="cm-n">{c.n}×</span>
                  <span className="cm-ex">{c.ex}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="subs">
            <thead>
              <tr><th>When</th><th>Tasker</th><th>Task ID</th><th>Skip</th><th>Verdict</th><th>Score</th><th>Rev</th><th>Maj</th><th>Min</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setSel(r)}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.tasker_name || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{r.task_id}</td>
                  <td>{r.skipped ? "skip" : "label"}</td>
                  <td>{r.ai_verdict ? <span className={"vb " + r.ai_verdict}>{r.ai_verdict.replace("_", " ")}</span> : "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontWeight: 600, color: r.score === 0 ? "var(--red)" : r.score === 100 ? "var(--green)" : "var(--amber-text)" }}>{r.score === null || r.score === undefined ? "—" : r.score + "%"}</td>
                  <td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{r.revisions ? r.revisions.length : "—"}</td>
                  <td style={{ color: r.major_flags ? "var(--red)" : "var(--muted)", fontWeight: 600 }}>{r.major_flags}</td>
                  <td style={{ color: "var(--amber-text)", fontWeight: 600 }}>{r.minor_flags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel && (
          <div className="detail-pane">
            <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)" }}>Task {sel.task_id} · {sel.tasker_name || "—"}</h2>
              <button className="ghost" onClick={() => setSel(null)}>Close</button>
            </div>
            <Field label="Score" v={sel.score === null || sel.score === undefined ? "—" : sel.score + "%"} />
            <Field label="Triage note" v={sel.triage_note} />
            <Field label="Skipped?" v={String(sel.skipped)} />
            <Field label="Skip answers" v={JSON.stringify(sel.skip_answers)} />
            <Field label="Cameras" v={(sel.cameras || []).join(", ")} />
            <Field label="Temporal" v={String(sel.temporal)} />
            {sel.revisions && sel.revisions.length > 1 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 5 }}>Revision history ({sel.revisions.length})</div>
                {sel.revisions.map((rv, i) => (
                  <div key={i} style={{ fontSize: 12, padding: "5px 0", borderBottom: "1px solid var(--rule)" }}>
                    <b>Rev {i + 1}</b> · <span className={"vb " + (rv.verdict || "ok")}>{(rv.verdict || "ok").replace("_", " ")}</span> · {rv.majors} major · {rv.minors} minor <span style={{ color: "var(--muted)" }}>· {new Date(rv.at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
            <Two a={sel.preseed_trace} b={sel.revised_trace} la="Pre-seed trace" lb="Revised trace" />
            <Two a={sel.preseed_plan} b={sel.revised_plan} la="Pre-seed plan" lb="Revised plan" />
            <div style={{ marginTop: 14 }}>
              <div className="block-head">AI analysis (JSON)</div>
              <pre className="json">{JSON.stringify(sel.ai_analysis, null, 2)}</pre>
            </div>
          </div>
        )}
        <div className="footer-note"><a href="/">← back to tasker view</a></div>
      </div>
    </>
  );
}

function Field({ label, v }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{v || "—"}</div>
    </div>
  );
}
function Two({ a, b, la, lb }) {
  return (
    <div className="two-col" style={{ marginBottom: 10 }}>
      <div><div style={{ fontFamily: "var(--mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 3 }}>{la}</div><div style={{ fontSize: 12, color: "var(--text)", whiteSpace: "pre-wrap", background: "var(--bg)", padding: 10, borderRadius: 6, maxHeight: 240, overflow: "auto" }}>{a || "—"}</div></div>
      <div><div style={{ fontFamily: "var(--mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "var(--muted)", marginBottom: 3 }}>{lb}</div><div style={{ fontSize: 12, color: "var(--text)", whiteSpace: "pre-wrap", background: "var(--bg)", padding: 10, borderRadius: 6, maxHeight: 240, overflow: "auto" }}>{b || "—"}</div></div>
    </div>
  );
}
