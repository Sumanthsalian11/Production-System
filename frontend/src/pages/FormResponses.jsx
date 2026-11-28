import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

const dayKey = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

const initials = (n = "") =>
  String(n)
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

const AV_COLORS = ["#3b7ddd", "#1cbb8c", "#6f42c1", "#e8590c", "#17a2b8", "#c2255c", "#f59f00"];
const avColor = (n = "") => AV_COLORS[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

/* ---------- survey helpers ---------- */
const SCORE = { "NOT SATISFIED": 1, SATISFIED: 2, GOOD: 3, "VERY GOOD": 4, EXCELLENT: 5 };
const scoreOf = (a) => SCORE[String(a || "").trim().toUpperCase()] || 0;
const qNo = (q) => {
  const m = String(q || "").match(/^\s*(\d+)\s*\./);
  return m ? Number(m[1]) : 0;
};
const answerOf = (r, no) => (r.answers || []).find((x) => qNo(x.q) === no)?.a || "";
// questions 6, 7, 8 are the rating grids
const gridAnswers = (r) => (r.answers || []).filter((x) => [6, 7, 8].includes(qNo(x.q)));
const avgScore = (r) => {
  const v = gridAnswers(r).map((x) => scoreOf(x.a)).filter(Boolean);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const tone = (score) =>
  score == null ? { bg: "#eef1f5", fg: "#6c757d" }
  : score >= 4 ? { bg: "#e6f7f1", fg: "#14916c" }
  : score >= 3 ? { bg: "#eaf1fc", fg: "#2f64b1" }
  : score >= 2 ? { bg: "#fff6e5", fg: "#b77700" }
  : { bg: "#fdecee", fg: "#a71d2a" };
// "6. SALES & MARKETING [PRESENTATION]" -> section "6. SALES & MARKETING", item "PRESENTATION"
const splitQ = (q) => {
  const m = String(q).match(/^(.*?)\s*\[(.*)\]\s*$/);
  return m ? { section: m[1], item: m[2] } : { section: String(q), item: "" };
};

export default function FormResponses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${BASE_URL}/api/form-responses`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load responses");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 15000); // quiet auto-refresh
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (q) {
        const hay = [r.name, r.spocName, r.email, r.phone, r.address, r.comments, ...(r.answers || []).map((x) => x.a)]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const k = r.submittedAt ? dayKey(r.submittedAt) : "";
      if (from && (!k || k < from)) return false;
      if (to && (!k || k > to)) return false;
      return true;
    });
  }, [rows, search, from, to]);

  // summary numbers (display only)
  const stats = useMemo(() => {
    const todayKey = dayKey(new Date());
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekKey = dayKey(weekAgo);
    let today = 0;
    let week = 0;
    let sum = 0;
    let cnt = 0;
    rows.forEach((r) => {
      if (r.submittedAt) {
        const k = dayKey(r.submittedAt);
        if (k === todayKey) today++;
        if (k >= weekKey) week++;
      }
      const a = avgScore(r);
      if (a != null) { sum += a; cnt++; }
    });
    return { total: rows.length, today, week, avg: cnt ? sum / cnt : null, latest: rows[0]?.submittedAt || null };
  }, [rows]);

  const clearFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
  };

  const exportExcel = () => {
    if (!filtered.length) return;
    // one column per question, in the order the questions first appear
    const qs = [];
    filtered.forEach((r) => (r.answers || []).forEach((x) => { if (!qs.includes(x.q)) qs.push(x.q); }));
    qs.sort((a, b) => qNo(a) - qNo(b));

    const data = filtered.map((r, i) => {
      const row = {
        "S.No": i + 1,
        "Customer Name": r.name || "",
        "SPOC Name": r.spocName || "",
        "SPOC Email ID": r.email || "",
        "SPOC Contact number": r.phone || "",
        "Feedback Date": fmtDay(r.feedbackDate),
      };
      qs.forEach((q) => { row[q] = (r.answers || []).find((x) => x.q === q)?.a || ""; });
      row["Submitted At"] = fmt(r.submittedAt);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Object.keys(data[0]).map((k) => ({ wch: Math.min(Math.max(k.length + 2, 14), 40) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Survey Responses");
    XLSX.writeFile(wb, `Customer_Satisfaction_Responses_${dayKey(new Date())}.xlsx`);
  };

  const hasFilter = search || from || to;

  const statCards = [
    { label: "Total Responses", value: stats.total, icon: "bi-inboxes-fill", color: "#3b7ddd", soft: "#eaf1fc" },
    { label: "Today", value: stats.today, icon: "bi-calendar-check-fill", color: "#1cbb8c", soft: "#e6f7f1" },
    { label: "Last 7 Days", value: stats.week, icon: "bi-graph-up-arrow", color: "#6f42c1", soft: "#f1ecfa" },
  ];

  // detail popup content: group the grid answers by section
  const detailGroups = useMemo(() => {
    if (!detail) return [];
    const map = new Map();
    (detail.answers || []).forEach((x) => {
      const { section, item } = splitQ(x.q);
      if (!map.has(section)) map.set(section, []);
      map.get(section).push({ item, a: x.a });
    });
    return [...map.entries()].sort((a, b) => qNo(a[0]) - qNo(b[0]));
  }, [detail]);

  return (
    <div className="fr-page">
      <style>{`
        .fr-page{padding:22px 26px 30px;background:#f6f8fb;min-height:calc(100vh - 58px)}
        .fr-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
        .fr-title{display:flex;align-items:center;gap:12px}
        .fr-title-icon{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#3b7ddd,#2f64b1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.25rem;box-shadow:0 6px 14px rgba(59,125,221,.28)}
        .fr-title h4{margin:0;font-size:1.25rem;font-weight:800;color:#1f2d3d;letter-spacing:.2px}
        .fr-title p{margin:2px 0 0;font-size:.8rem;color:#6c757d}
        .fr-live{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:700;color:#14916c;background:#e6f7f1;border:1px solid #bfe9d9;border-radius:999px;padding:3px 10px;margin-left:6px}
        .fr-live i{width:7px;height:7px;border-radius:50%;background:#1cbb8c;display:inline-block;animation:frPulse 1.6s infinite}
        @keyframes frPulse{0%{transform:scale(.9);opacity:.8}50%{transform:scale(1.3);opacity:1}100%{transform:scale(.9);opacity:.8}}

        .fr-actions{display:flex;gap:10px;flex-wrap:wrap}
        .fr-btn{background:linear-gradient(135deg,#3b7ddd,#2f64b1);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:.83rem;padding:9px 18px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;box-shadow:0 4px 12px rgba(59,125,221,.28);transition:all .15s ease}
        .fr-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 16px rgba(59,125,221,.36)}
        .fr-btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
        .fr-btn-light{background:#fff;color:#1f2d3d;border:1px solid #dbe2ec;border-radius:10px;font-weight:700;font-size:.83rem;padding:9px 16px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .15s ease}
        .fr-btn-light:hover:not(:disabled){background:#f1f5fb;border-color:#b9c7dc}
        .fr-btn-light:disabled{opacity:.6;cursor:not-allowed}
        .fr-btn-sm{padding:5px 12px;font-size:.76rem;border-radius:8px}

        .fr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .fr-stat{background:#fff;border:1px solid #e5eaf2;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(31,45,61,.05)}
        .fr-stat-ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0}
        .fr-stat-val{font-size:1.45rem;font-weight:800;color:#1f2d3d;line-height:1.1}
        .fr-stat-lbl{font-size:.72rem;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:.05em;margin-top:3px}

        .fr-card{background:#fff;border:1px solid #e5eaf2;border-radius:14px;box-shadow:0 2px 8px rgba(31,45,61,.06);overflow:hidden}
        .fr-filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #e5eaf2;background:#fbfcfe}
        .fr-search{position:relative;flex:1;min-width:240px;max-width:420px}
        .fr-search i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#8a97a8;font-size:.9rem}
        .fr-input{width:100%;border:1px solid #d5dde9;background:#fff;color:#1f2d3d;border-radius:10px;padding:8px 12px;font-size:.84rem;outline:none;transition:all .15s ease}
        .fr-search .fr-input{padding-left:36px}
        .fr-input:focus{border-color:#3b7ddd;box-shadow:0 0 0 3px rgba(59,125,221,.14)}
        .fr-date{display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:.04em}
        .fr-date .fr-input{width:auto;text-transform:none;letter-spacing:0;font-weight:500}
        .fr-count{margin-left:auto;background:#eaf1fc;color:#2f64b1;border:1px solid #cfe0f8;border-radius:999px;padding:4px 14px;font-size:.76rem;font-weight:800}

        .fr-wrap{overflow:auto;max-height:calc(100vh - 430px);min-height:240px}
        .fr-table{width:100%;border-collapse:separate;border-spacing:0;font-size:.86rem}
        .fr-table thead th{position:sticky;top:0;z-index:2;background:#eef3fa;color:#44566c;text-align:left;padding:11px 16px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;border-bottom:2px solid #d8e2f0}
        .fr-table tbody td{padding:12px 16px;border-bottom:1px solid #edf1f7;color:#2b3a4b;vertical-align:middle;background:#fff}
        .fr-table tbody tr:nth-child(even) td{background:#fafbfd}
        .fr-table tbody tr:hover td{background:#f0f6ff}
        .fr-num{color:#8a97a8;font-weight:700;font-size:.78rem}
        .fr-person{display:flex;align-items:center;gap:11px;min-width:190px}
        .fr-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.78rem;flex-shrink:0;box-shadow:0 2px 6px rgba(31,45,61,.18)}
        .fr-name{font-weight:700;color:#1f2d3d;line-height:1.2}
        .fr-mail{color:#3b7ddd;font-size:.8rem}
        .fr-chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
        .fr-chip i{color:#8a97a8}
        .fr-date-pill{display:inline-flex;align-items:center;gap:6px;background:#f1ecfa;color:#5b34a8;border:1px solid #ddd0f3;border-radius:999px;padding:3px 11px;font-size:.76rem;font-weight:700;white-space:nowrap}
        .fr-pill{display:inline-block;border-radius:999px;padding:3px 11px;font-size:.74rem;font-weight:800;white-space:nowrap}
        .fr-muted{color:#9aa6b6}

        .fr-empty{text-align:center;padding:56px 20px;color:#6c757d}
        .fr-empty i{font-size:2.6rem;color:#b9c7dc}
        .fr-empty b{display:block;color:#1f2d3d;margin-top:10px;font-size:.98rem}
        .fr-alert{margin:14px 18px;padding:10px 14px;border-radius:10px;background:#fdecee;border:1px solid #f5c2c7;color:#a71d2a;font-size:.84rem;font-weight:600;display:flex;align-items:center;gap:8px}
        .fr-loading{text-align:center;padding:56px 20px;color:#6c757d;font-size:.9rem}

        .fr-modal-bg{position:fixed;inset:0;background:rgba(15,30,50,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:18px}
        .fr-modal{background:#fff;border-radius:16px;width:100%;max-width:760px;max-height:90vh;overflow:auto;box-shadow:0 24px 60px rgba(15,30,50,.35)}
        .fr-modal-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 22px;border-bottom:1px solid #e5eaf2;position:sticky;top:0;background:#fff;z-index:1}
        .fr-modal-h h5{margin:0;font-size:1.05rem;font-weight:800;color:#1f2d3d}
        .fr-modal-b{padding:16px 22px 22px}
        .fr-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px}
        .fr-kv div{background:#f6f8fb;border:1px solid #e5eaf2;border-radius:10px;padding:8px 12px}
        .fr-kv small{display:block;color:#6c757d;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
        .fr-kv b{color:#1f2d3d;font-size:.88rem;word-break:break-word}
        .fr-sec{margin-top:14px}
        .fr-sec-t{font-size:.8rem;font-weight:800;color:#2f64b1;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
        .fr-qrow{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:7px 0;border-bottom:1px dashed #e5eaf2;font-size:.84rem}
        .fr-qrow span:first-child{color:#44566c}

        @media (max-width:1100px){.fr-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (max-width:600px){.fr-page{padding:16px 12px}.fr-stats{grid-template-columns:1fr}.fr-count{margin-left:0}}
      `}</style>

      {/* Title + actions */}
      <div className="fr-top">
        <div className="fr-title">
          <div className="fr-title-icon"><i className="bi bi-ui-checks" /></div>
          <div>
            <h4>
              Customer Satisfaction Responses
              <span className="fr-live"><i />Live</span>
            </h4>
            <p>Survey submissions from the Google Form, updated automatically</p>
          </div>
        </div>
        <div className="fr-actions">
          <button className="fr-btn-light" onClick={() => load()} disabled={loading}>
            <i className="bi bi-arrow-clockwise" /> {loading ? "Loading…" : "Refresh"}
          </button>
          <button className="fr-btn" onClick={exportExcel} disabled={!filtered.length}>
            <i className="bi bi-file-earmark-excel" /> Export to Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="fr-stats">
        {statCards.map((s) => (
          <div className="fr-stat" key={s.label}>
            <div className="fr-stat-ico" style={{ background: s.soft, color: s.color }}>
              <i className={`bi ${s.icon}`} />
            </div>
            <div>
              <div className="fr-stat-val">{s.value}</div>
              <div className="fr-stat-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="fr-card">
        {/* Filters */}
        <div className="fr-filters">
          <div className="fr-search">
            <i className="bi bi-search" />
            <input
              className="fr-input"
              placeholder="Search customer, SPOC, email, phone, answers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="fr-date">
            From
            <input type="date" className="fr-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="fr-date">
            To
            <input type="date" className="fr-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {hasFilter && (
            <button className="fr-btn-light" onClick={clearFilters}>
              <i className="bi bi-x-lg" /> Clear
            </button>
          )}
          <span className="fr-count">{filtered.length} of {rows.length} shown</span>
        </div>

        {error && (
          <div className="fr-alert">
            <i className="bi bi-exclamation-triangle-fill" /> {error}
          </div>
        )}

        {/* Table */}
        <div className="fr-wrap">
          {loading ? (
            <div className="fr-loading">Loading responses…</div>
          ) : filtered.length === 0 ? (
            <div className="fr-empty">
              <i className="bi bi-inbox" />
              <b>{rows.length ? "No responses match your filters" : "No responses saved yet"}</b>
              <span className="small">
                {rows.length ? "Try a different search or date range." : "New survey submissions will appear here automatically."}
              </span>
            </div>
          ) : (
            <table className="fr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>SPOC</th>
                  <th>Phone</th>
                  <th>Feedback Date</th>

                  <th>Vs Competitors</th>
                  <th>Use Again</th>
                  <th>Overall</th>
                  <th>Submitted At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {

                  const overall = answerOf(r, 11);
                  const ot = tone(scoreOf(overall) || null);
                  const again = answerOf(r, 10);
                  return (
                    <tr key={r._id}>
                      <td className="fr-num">{i + 1}</td>
                      <td>
                        <div className="fr-person">
                          <div className="fr-av" style={{ background: avColor(r.name) }}>{initials(r.name)}</div>
                          <div>
                            <div className="fr-name">{r.name}</div>
                            <div className="fr-mail">{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{r.spocName || <span className="fr-muted">—</span>}</td>
                      <td>
                        {r.phone ? <span className="fr-chip"><i className="bi bi-telephone-fill" />{r.phone}</span> : <span className="fr-muted">—</span>}
                      </td>
                      <td>{r.feedbackDate ? <span className="fr-date-pill"><i className="bi bi-calendar3" />{fmtDay(r.feedbackDate)}</span> : <span className="fr-muted">—</span>}</td>

                      <td style={{ minWidth: 150 }}>{answerOf(r, 9) || <span className="fr-muted">—</span>}</td>
                      <td>
                        {again ? <span className="fr-pill" style={{ background: again.toUpperCase() === "YES" ? "#e6f7f1" : "#fdecee", color: again.toUpperCase() === "YES" ? "#14916c" : "#a71d2a" }}>{again}</span> : <span className="fr-muted">—</span>}
                      </td>
                      <td>{overall ? <span className="fr-pill" style={{ background: ot.bg, color: ot.fg }}>{overall}</span> : <span className="fr-muted">—</span>}</td>
                      <td><span className="fr-date-pill"><i className="bi bi-clock" />{fmt(r.submittedAt)}</span></td>
                      <td>
                        <button className="fr-btn-light fr-btn-sm" onClick={() => setDetail(r)}>
                          <i className="bi bi-eye" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail popup: every answer of one survey */}
      {detail && (
        <div className="fr-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="fr-modal">
            <div className="fr-modal-h">
              <h5>{detail.name || "Response"} • {fmt(detail.submittedAt)}</h5>
              <button className="fr-btn-light fr-btn-sm" onClick={() => setDetail(null)}><i className="bi bi-x-lg" /> Close</button>
            </div>
            <div className="fr-modal-b">
              <div className="fr-kv">
                <div><small>Customer Name</small><b>{detail.name || "—"}</b></div>
                <div><small>SPOC Name</small><b>{detail.spocName || "—"}</b></div>
                <div><small>SPOC Email</small><b>{detail.email || "—"}</b></div>
                <div><small>SPOC Contact</small><b>{detail.phone || "—"}</b></div>
                <div><small>Feedback Date</small><b>{detail.feedbackDate ? fmtDay(detail.feedbackDate) : "—"}</b></div>

                {detail.address ? <div><small>Address (old form)</small><b>{detail.address}</b></div> : null}
                {detail.comments ? <div><small>Comments (old form)</small><b>{detail.comments}</b></div> : null}
              </div>

              {detailGroups.length === 0 && <div className="fr-muted">No rating answers (this response is from the old contact form).</div>}
              {detailGroups.map(([section, items]) => (
                <div className="fr-sec" key={section}>
                  <div className="fr-sec-t">{section}</div>
                  {items.map((x, k) => {
                    const sc = tone(scoreOf(x.a) || null);
                    return (
                      <div className="fr-qrow" key={k}>
                        <span>{x.item || ""}</span>
                        <span className="fr-pill" style={{ background: sc.bg, color: sc.fg }}>{x.a}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}