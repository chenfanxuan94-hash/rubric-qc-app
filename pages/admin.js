// pages/admin.js
import { useState } from "react";

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load(k) {
    setError(null); setLoading(true);
    try {
      const r = await fetch("/api/list?key=" + encodeURIComponent(k));
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Failed"); setAuthed(false); }
      else { setRows(data.rows || []); setAuthed(true); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function exportCsv() {
    if (!rows.length) return;
    const cols = ["created_at", "tasker_name", "task_id", "skipped", "ai_verdict", "major_flags", "minor_flags"];
    const head = cols.join(",");
    const body = rows.map((r) =>
      cols.map((c) => {
        let v = r[c];
        if (v === null || v === undefined) v = "";
        v = String(v).replace(/"/g, '""');
        return /[",\n]/.test(v) ? `"${v}"` : v;
      }).join(",")
    ).join("\n");
    const blob = new Blob([head + "\n" + body], { type: "text/csv" });
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
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="subs">
            <thead>
              <tr><th>When</th><th>Tasker</th><th>Task ID</th><th>Skip</th><th>Verdict</th><th>Maj</th><th>Min</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setSel(r)}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.tasker_name || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{r.task_id}</td>
                  <td>{r.skipped ? "skip" : "label"}</td>
                  <td>{r.ai_verdict ? <span className={"vb " + r.ai_verdict}>{r.ai_verdict.replace("_", " ")}</span> : "—"}</td>
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
            <Field label="Triage note" v={sel.triage_note} />
            <Field label="Skipped?" v={String(sel.skipped)} />
            <Field label="Skip answers" v={JSON.stringify(sel.skip_answers)} />
            <Field label="Cameras" v={(sel.cameras || []).join(", ")} />
            <Field label="Temporal" v={String(sel.temporal)} />
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
