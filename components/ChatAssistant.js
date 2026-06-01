// components/ChatAssistant.js — bottom-right popup; answers strictly from the canonical SOP.
import { useState, useRef, useEffect } from "react";

export default function ChatAssistant({ askerName }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: "Ask me anything about the labeling SOP — rounding rules, skip conditions, writing standards, camera selection. I answer only from the canonical document.", meta: null },
  ]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, open, loading]);

  async function send() {
    const question = q.trim();
    if (!question || loading) return;
    setQ("");
    const history = msgs.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.text }));
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, askerName }),
      });
      const d = await r.json();
      if (d.error) {
        setMsgs((m) => [...m, { role: "assistant", text: "Something went wrong reaching the assistant. Try again.", meta: null }]);
      } else if (d.answerable) {
        setMsgs((m) => [...m, { role: "assistant", text: d.answer, meta: { quote: d.quote, page: d.page } }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", text: "I can't find that in the canonical document, so I won't guess. I've logged your question for the reviewer to cover at the next sync.", meta: { logged: true } }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Network issue — please try again.", meta: null }]);
    } finally { setLoading(false); }
  }

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Open SOP assistant">
          <span className="chat-fab-ico">?</span>
          <span className="chat-fab-label">Ask the SOP</span>
        </button>
      )}
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div>
              <div className="chat-title">SOP Assistant</div>
              <div className="chat-sub">Answers only from the canonical document</div>
            </div>
            <button className="chat-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="chat-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={"chat-msg " + m.role}>
                <div className="chat-bubble">{m.text}</div>
                {m.meta && m.meta.quote ? (
                  <div className="chat-quote">“{m.meta.quote}”{m.meta.page ? <span className="chat-page"> — {m.meta.page}</span> : null}</div>
                ) : null}
                {m.meta && m.meta.logged ? (<div className="chat-logged">✓ logged for reviewer</div>) : null}
              </div>
            ))}
            {loading && <div className="chat-msg assistant"><div className="chat-bubble"><span className="chat-dots"><i/><i/><i/></span></div></div>}
          </div>
          <div className="chat-input">
            <textarea
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="e.g. What's the timestamp rounding rule?" rows={1} />
            <button onClick={send} disabled={loading || !q.trim()}>Send</button>
          </div>
          <div className="chat-foot">Grounded in the canonical SOP · won't guess</div>
        </div>
      )}
    </>
  );
}
