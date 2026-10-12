import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { Send, ArrowLeft, Play, Upload, Paperclip, Inbox } from "lucide-react";
import BASE_URL from "../config/api";

// Prepress view of the Artwork Docket — restyled to the aqua-glass look of the
// Reel Register page (glossy header, 3D buttons, colorful table).
// All data logic (fetch/send/status) is unchanged.

const GLOSSY_BLUE = "#e4572e";

const prepressArtworkStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap');
  .paw-container{position:relative;width:100%!important;max-width:none!important;box-sizing:border-box;min-height:100%;margin:0!important;padding:16px 18px 28px;overflow:hidden;border:0;font-family:'Source Sans 3','Segoe UI',system-ui,-apple-system,sans-serif;color:#1f2d3a;background:#f3f5f7}
  .paw-container>*{position:relative}
  /* when shown inside the Prepress page it uses that page's backdrop */
  .dashboard-container .paw-container{background:none;padding:0;overflow:visible}

  .paw-heading{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 14px;padding:9px 18px;border-radius:6px;color:#1f2d3a;background:#fff;border:1px solid #dfe4e9;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .paw-heading h3{position:relative;z-index:1;margin:0;font-size:21px;font-weight:700;letter-spacing:-.4px;color:#043a45}
  .paw-heading p{position:relative;z-index:1;margin:2px 0 0;color:#5f6c7a;font-size:.85rem;font-weight:600}
  .paw-userchip{display:flex;align-items:center;gap:10px}
  .paw-avatar{width:32px;height:32px;border-radius:50%;background:#0f6b7c;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:600;flex-shrink:0;box-shadow:none}
  .paw-userinfo{font-size:12.5px;color:#1f2d3a;text-align:right;line-height:1.3}
  .paw-userinfo b{display:block;font-weight:700}.paw-userinfo span{color:#5f6c7a;font-size:11px;text-transform:uppercase;letter-spacing:.04em}

  .paw-container .filter-bar{display:flex;justify-content:flex-end;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;border-radius:6px;background:#f8f9fa;border:1px solid #dfe4e9;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .paw-container .filter-bar:before{content:"FILTER TICKETS";margin-right:auto;padding-left:5px;color:#043a45;font-size:.7rem;font-weight:600;letter-spacing:.12em}
  .paw-container .filter-bar .form-control{min-height:36px;padding:6px 12px;border:1.5px solid #cfd6dd;border-radius:4px;color:#1f2d3a;background:#fff;font-size:13px;font-weight:600;box-shadow:none}
  .paw-container .filter-bar .form-control::placeholder{color:#9aa5b1;font-weight:600;opacity:1}
  .paw-container .filter-bar .form-control:focus{border-color:#0f6b7c;outline:none;box-shadow:0 0 0 3px rgba(15,107,124,.15)}

  .paw-container .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:4px;font-weight:700;color:#fff;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease}
  .paw-container .btn:hover:not(:disabled){transform:none;filter:brightness(1.04)}
  .paw-container .btn:active:not(:disabled){transform:none}
  .paw-container .btn:disabled{cursor:not-allowed;opacity:.5}
  .paw-container .btn-primary{background:#043a45;border-color:#043a45;box-shadow:none}
  .paw-container .btn-success{background:#e4572e;border-color:#e4572e;box-shadow:none}
  .paw-container .btn-secondary{background:#fff;color:#1f2d3a;border-color:#cfd6dd;box-shadow:none}
  .paw-container .btn-info{background:#0f6b7c;border-color:#0f6b7c;box-shadow:none}

  .paw-container .production-real-table-wrap{background:#fff;border:1px solid #dfe4e9;border-radius:6px;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .production-real-table-wrap::-webkit-scrollbar{width:8px;height:8px}
  .production-real-table-wrap::-webkit-scrollbar-track{background:#f1f3f5;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb{background:#c2ccd4;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb:hover{background:#9fb0bd}
  .paw-container .production-real-table{width:100%;min-width:0;margin:0;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:.81rem;color:#1f2d3a;background:#fff}
  .paw-container .production-real-table th,.paw-container .production-real-table td{overflow-wrap:anywhere;word-break:break-word;vertical-align:middle}
  .paw-container .production-real-table thead th{position:sticky;top:0;z-index:1;padding:11px 10px;background:#f4f6f8!important;color:#5f6c7a!important;border:0!important;border-bottom:1px solid #dfe4e9!important;font-size:.7rem;font-weight:600;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap}
  .paw-container .production-real-table tbody td{padding:9px 10px;border:0!important;border-bottom:1px solid #edf0f3!important;border-right:1px solid #f3f5f7!important;font-weight:400;color:#1f2d3a;background:#fff}
  .paw-container .production-real-table tbody tr{cursor:pointer;transition:background .12s ease}
  .paw-container .production-real-table tbody tr:nth-child(even) td{background:#fff}
  .paw-container .production-real-table tbody tr:hover td{background:#f1f7f8!important}
  .paw-container .production-real-table .empty-state{padding:42px!important;color:#5f6c7a!important;font-weight:600;text-align:center}

  .paw-status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .paw-status .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .paw-detail-card{border-radius:6px;overflow:hidden;background:#fff;border:1px solid #dfe4e9;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .paw-detail-head{padding:16px 22px;border-bottom:1px solid #dfe4e9;background:#f8f9fa}
  .paw-thread{padding:20px 22px;display:flex;flex-direction:column;gap:14px;max-height:52vh;overflow-y:auto;background:#f8f9fa}
  .paw-thread::-webkit-scrollbar{width:8px}.paw-thread::-webkit-scrollbar-thumb{background:#c2ccd4;border-radius:8px}
  .paw-composer{border-top:1px solid #dfe4e9;background:#fff;padding:14px 18px}
  .paw-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#043a45;background:#e6f1f3;border:1px solid #dfe4e9;border-radius:4px;padding:5px 10px;max-width:220px;text-decoration:none}
  .paw-icon-btn{width:40px;height:40px;flex-shrink:0;border:1.5px solid #cfd6dd;border-radius:4px;background:#fff;color:#043a45;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:none}
  .paw-icon-btn:disabled{opacity:.5;cursor:not-allowed}
  .paw-back-btn{width:34px;height:34px;border-radius:50%;border:1px solid transparent;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;background:#0f6b7c;box-shadow:none}
`;

const STATUS_META = {
  open: { label: "New", fg: "#B4740D", bg: "#FCF1DC", dot: "#E3A63D" },
  in_progress: { label: "In progress", fg: "#0f6b7c", bg: "#e6f1f3", dot: "#0f6b7c" },
  changes_submitted: { label: "In review", fg: "#6D3FD1", bg: "#F1ECFD", dot: "#8B5CF6" },
  closed: { label: "Closed", fg: "#12805E", bg: "#E6F6F0", dot: "#1FA37B" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "changes_submitted", label: "Review" },
  { key: "closed", label: "Closed" },
];

function StatusPill({ status }) {
  const s = STATUS_META[status] || STATUS_META.open;
  return (
    <span className="paw-status" style={{ background: s.bg, color: s.fg }}>
      <span className="dot" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  if (isYesterday) return "Yesterday · " + time;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  return date + " · " + time;
}

export default function PrepressArtworkDashboard() {
  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;
  const config = { headers: { Authorization: `Bearer ${token}` } };

  const [tickets, setTickets] = useState([]);
  const [view, setView] = useState("list");
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [ticketFilter, setTicketFilter] = useState("");
  const [msgText, setMsgText] = useState("");
  const [msgFiles, setMsgFiles] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const threadEndRef = useRef(null);
  const msgFileInputRef = useRef(null);

  const active = tickets.find((t) => t.ticketId === activeId);

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    if (view === "detail") threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [view, active?.messages?.length]);

  async function fetchTickets() {
    const res = await axios.get(BASE_URL + "/api/artwork/tickets", config);
    setTickets(res.data);
  }

  async function fetchOne(ticketId) {
    const res = await axios.get(BASE_URL + "/api/artwork/tickets/" + ticketId, config);
    setTickets((prev) => {
      const others = prev.filter((t) => t.ticketId !== ticketId);
      return [res.data, ...others];
    });
  }

  function handleMsgFileChange(e) {
    const picked = Array.from(e.target.files || []);
    setMsgFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  }

  function removeMsgFile(index) {
    setMsgFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function sendMessage() {
    if ((!msgText.trim() && msgFiles.length === 0) || !active) return;

    const textToSend = msgText;
    const filesToSend = msgFiles;

    try {
      setSendingMsg(true);
      const data = new FormData();
      data.append("text", textToSend);
      filesToSend.forEach((f) => data.append("attachments", f));

      const res = await axios.post(
        BASE_URL + "/api/artwork/tickets/" + active.ticketId + "/messages",
        data,
        { headers: config.headers }
      );

      setTickets((prev) => prev.map((t) => (t.ticketId === active.ticketId ? res.data : t)));
      setMsgText("");
      setMsgFiles([]);

      const lastMsg = res.data.messages[res.data.messages.length - 1];
      if (filesToSend.length > 0 && (!lastMsg.attachments || lastMsg.attachments.length === 0)) {
        console.warn("[sendMessage] Files were sent but the server saved the message with NO attachments. This points to a backend issue (multer/file filter/route), not the frontend.");
      }
    } catch (err) {
      console.error("sendMessage failed:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Failed to send message. Check the file type/size and try again.");
    } finally {
      setSendingMsg(false);
    }
  }

  async function doAction(action) {
    const res = await axios.patch(BASE_URL + "/api/artwork/tickets/" + active.ticketId + "/status", { action }, config);
    setTickets((prev) => prev.map((t) => (t.ticketId === active.ticketId ? res.data : t)));
  }

  const visibleTickets = tickets.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (customerFilter.trim() && !(t.customerName || "").toLowerCase().includes(customerFilter.trim().toLowerCase())) return false;
    if (ticketFilter.trim() && !(t.ticketId || "").toLowerCase().includes(ticketFilter.trim().toLowerCase())) return false;
    return true;
  });

  const initials = (name) =>
    (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  // ---------- Detail / chat ----------
  if (view === "detail" && active) {
    const canStart = active.status === "open";
    const canSubmitChanges = active.status === "in_progress";
    const isClosed = active.status === "closed";

    return (
      <div style={{ width: "100%", padding: 0, margin: 0 }}>
        <style>{prepressArtworkStyles}</style>
        <div className="paw-container">
          <div className="paw-heading">
            <div className="d-flex align-items-center gap-3">
              <button className="paw-back-btn" onClick={() => setView("list")}>
                <ArrowLeft size={16} />
              </button>
              <div>
                <h3>{active.ticketId}</h3>
                <p>{active.materialCode} · {active.customerName}</p>
              </div>
            </div>
            <div className="paw-userchip">
              <div className="paw-avatar">{initials(user?.name)}</div>
              <div className="paw-userinfo">
                <b>{user?.name}</b>
                <span>Prepress</span>
              </div>
            </div>
          </div>

          <div className="paw-detail-card">
            <div className="paw-detail-head">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <div style={{ fontWeight: 700, color: "#043a45", fontSize: 13 }}>{active.materialCode}</div>
                  <div style={{ fontSize: 13, color: "#3b4a58", marginTop: 3 }}>
                    {active.customerName} <span style={{ color: "#c2ccd4" }}>·</span> {active.variant || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#5f6c7a", marginTop: 4 }}>
                    Raised by {active.createdBy} · {formatTime(active.createdAt)}
                  </div>
                </div>
                <StatusPill status={active.status} />
              </div>

              {active.attachments && active.attachments.length > 0 ? (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  {active.attachments.map((a, i) => (
                    <a key={i} className="paw-chip" href={BASE_URL + a.url} target="_blank" rel="noreferrer">
                      <Paperclip size={12} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.originalName}</span>
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="d-flex flex-wrap gap-2 mt-3">
                {canStart && (
                  <button className="btn btn-sm btn-success" onClick={() => doAction("start")}>
                    <Play size={13} style={{ marginRight: 5 }} /> Start work
                  </button>
                )}
                {canSubmitChanges && (
                  <button className="btn btn-sm btn-primary" onClick={() => doAction("submit")}>
                    <Upload size={13} style={{ marginRight: 5 }} /> Submit changes
                  </button>
                )}
              </div>
            </div>

            <div className="paw-thread">
              {active.messages.map((m) => {
                const mine = m.sender === user?.name;
                if (m.type === "status") {
                  return (
                    <div key={m._id} style={{ textAlign: "center", fontSize: 11.5, color: "#5f6c7a", fontWeight: 600, display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                      <span style={{ flex: 1, height: 1, background: "#dfe4e9" }} />
                      <span style={{ whiteSpace: "nowrap" }}>{m.sender} {m.text.toLowerCase()} · {formatTime(m.time)}</span>
                      <span style={{ flex: 1, height: 1, background: "#dfe4e9" }} />
                    </div>
                  );
                }
                return (
                  <div key={m._id} style={{ display: "flex", gap: 8, justifyContent: mine ? "flex-end" : "flex-start" }}>
                    {!mine && (
                      <div className="paw-avatar" style={{ width: 28, height: 28, fontSize: 10.5 }}>
                        {initials(m.sender)}
                      </div>
                    )}
                    <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                      <div style={{ fontSize: 11, color: "#5f6c7a", marginBottom: 4, fontWeight: 600, padding: "0 2px" }}>
                        {mine ? "You" : m.sender} <span style={{ color: "#c2ccd4" }}>·</span> {m.role === "PREPRESS" ? "Prepress" : "KAS"}
                      </div>
                      <div
                        style={{
                          background: mine ? "#0f6b7c" : "#fff",
                          color: mine ? "#fff" : "#1f2d3a",
                          border: mine ? "none" : "1px solid #dfe4e9",
                          borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          padding: "10px 13px",
                          boxShadow: mine ? "0 4px 10px rgba(30,130,190,.3)" : "0 1px 3px rgba(10,80,130,.1)",
                        }}
                      >
                        {m.text ? <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.text}</div> : null}
                        {m.attachments && m.attachments.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: m.text ? 8 : 0 }}>
                            {m.attachments.map((a, ai) => (
                              
                              <a  key={ai}
                                href={BASE_URL + a.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500,
                                  color: mine ? "#fff" : "#1f2d3a",
                                  border: mine ? "1px solid rgba(255,255,255,0.35)" : "1px solid #dfe4e9",
                                  borderRadius: 8, padding: "6px 10px",
                                  background: mine ? "rgba(255,255,255,0.14)" : "#f1f7f8",
                                  maxWidth: 220, overflow: "hidden", textDecoration: "none",
                                }}
                              >
                                <Paperclip size={12} style={{ flexShrink: 0, opacity: .8 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.originalName}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#9aa5b1", marginTop: 4, padding: "0 2px" }}>{formatTime(m.time)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            <div className="paw-composer">
              {msgFiles.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {msgFiles.map((f, i) => (
                    <span key={i} className="paw-chip">
                      <Paperclip size={12} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button onClick={() => removeMsgFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9aa5b1", padding: 0, marginLeft: 2 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="d-flex gap-2 align-items-center">
                <button
                  type="button"
                  className="paw-icon-btn"
                  onClick={() => !isClosed && msgFileInputRef.current?.click()}
                  disabled={isClosed}
                >
                  <Paperclip size={16} />
                </button>
                <input
                  ref={msgFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xls,.xlsx,image/png,image/jpeg"
                  onChange={handleMsgFileChange}
                  disabled={isClosed}
                  style={{ display: "none" }}
                />
                <input
                  className="form-control"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={isClosed ? "Ticket is closed" : "Write a note..."}
                  disabled={isClosed}
                  style={{ flex: 1, height: 40, borderRadius: 4, border: "1.5px solid #cfd6dd", fontWeight: 600, color: "#1f2d3a", boxShadow: "none" }}
                />
                <button
                  className="btn"
                  onClick={sendMessage}
                  disabled={(!msgText.trim() && msgFiles.length === 0) || isClosed || sendingMsg}
                  style={{
                    padding: "0 16px", height: 40, borderRadius: 4,
                    border: (msgText.trim() || msgFiles.length > 0) && !isClosed ? "1px solid transparent" : "none",
                    background: (msgText.trim() || msgFiles.length > 0) && !isClosed ? GLOSSY_BLUE : "#e2e4ea",
                    boxShadow: (msgText.trim() || msgFiles.length > 0) && !isClosed ? "none" : "none",
                    color: (msgText.trim() || msgFiles.length > 0) && !isClosed ? "#fff" : "#9DA2B0",
                    display: "flex", alignItems: "center", flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- List ----------
  return (
    <div style={{ width: "100%", padding: 0, margin: 0 }}>
      <style>{prepressArtworkStyles}</style>
      <div className="paw-container">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div className="d-flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className="btn btn-sm"
                onClick={() => setFilter(f.key)}
                style={{
                  border: "1px solid " + (filter === f.key ? "rgba(255,255,255,.6)" : "#cfd6dd"),
                  background: filter === f.key ? GLOSSY_BLUE : "#fff",
                  color: filter === f.key ? "#fff" : "#043a45",
                  textShadow: filter === f.key ? undefined : "none",
                  boxShadow: filter === f.key ? "none" : "0 3px 8px rgba(10,80,130,.12)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="paw-userchip">
            <div className="paw-avatar">{initials(user?.name)}</div>
            <div className="paw-userinfo">
              <b>{user?.name}</b>
              <span>Prepress</span>
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <input
            type="text"
            placeholder="Filter by customer..."
            className="form-control form-control-sm"
            style={{ width: "220px" }}
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          />
          <input
            type="text"
            placeholder="Filter by ticket ID..."
            className="form-control form-control-sm"
            style={{ width: "220px" }}
            value={ticketFilter}
            onChange={(e) => setTicketFilter(e.target.value)}
          />
          {(customerFilter || ticketFilter || filter !== "all") && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => { setCustomerFilter(""); setTicketFilter(""); setFilter("all"); }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="production-real-table-wrap" style={{ maxHeight: 420, overflowY: "auto", overflow: "auto" }}>
          <table className="production-real-table">
            <thead>
              <tr>
                <th style={{ width: "110px" }}>Ticket</th>
                <th style={{ minWidth: "120px" }}>Material code</th>
                <th style={{ minWidth: "180px" }}>Customer</th>
                <th style={{ minWidth: "100px" }}>Variant</th>
                <th style={{ width: "110px" }}>Status</th>
                <th style={{ width: "80px", textAlign: "center" }}>Notes</th>
                <th style={{ minWidth: "150px" }}>Last update</th>
                <th style={{ width: "80px", textAlign: "center" }}>Files</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.length === 0 && (
                <tr>
                  <td className="empty-state" colSpan={8}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <Inbox size={26} strokeWidth={1.5} />
                      No tickets match this view.
                    </div>
                  </td>
                </tr>
              )}
              {visibleTickets.slice(0, 30).map((t) => (
                <tr
                  key={t.ticketId}
                  onClick={() => {
                    setActiveId(t.ticketId);
                    fetchOne(t.ticketId);
                    setView("detail");
                  }}
                >
                  <td style={{ fontWeight: 700, color: "#043a45" }}>{t.ticketId}</td>
                  <td>{t.materialCode}</td>
                  <td style={{ fontWeight: 600 }}>{t.customerName}</td>
                  <td>{t.variant || "—"}</td>
                  <td><StatusPill status={t.status} /></td>
                  <td style={{ textAlign: "center" }}>{t.messages?.length || 0}</td>
                  <td>{formatTime(t.updatedAt)}</td>
                  <td style={{ textAlign: "center" }}>
                    {t.attachments && t.attachments.length > 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Paperclip size={12} /> {t.attachments.length}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}