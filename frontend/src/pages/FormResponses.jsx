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

export default function FormResponses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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
        const hay = [r.name, r.email, r.address, r.phone, r.comments].join(" ").toLowerCase();
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
    rows.forEach((r) => {
      if (!r.submittedAt) return;
      const k = dayKey(r.submittedAt);
      if (k === todayKey) today++;
      if (k >= weekKey) week++;
    });
    return { total: rows.length, today, week, latest: rows[0]?.submittedAt || null };
  }, [rows]);

  const clearFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
  };

  const exportExcel = () => {
    if (!filtered.length) return;
    const data = filtered.map((r, i) => ({
      "S.No": i + 1,
      Name: r.name || "",
      Email: r.email || "",
      Address: r.address || "",
      "Phone number": r.phone || "",
      Comments: r.comments || "",
      "Submitted At": fmt(r.submittedAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 30 },
      { wch: 40 },
      { wch: 16 },
      { wch: 40 },
      { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Form Responses");
    XLSX.writeFile(wb, `Form_Responses_${dayKey(new Date())}.xlsx`);
  };

  const hasFilter = search || from || to;

  const statCards = [
    { label: "Total Responses", value: stats.total, icon: "bi-inboxes-fill", color: "#3b7ddd", soft: "#eaf1fc" },
    { label: "Today", value: stats.today, icon: "bi-calendar-check-fill", color: "#1cbb8c", soft: "#e6f7f1" },
    { label: "Last 7 Days", value: stats.week, icon: "bi-graph-up-arrow", color: "#6f42c1", soft: "#f1ecfa" },
    {
      label: "Latest Response",
      value: stats.latest ? fmt(stats.latest) : "None yet",
      icon: "bi-clock-history",
      color: "#e8590c",
      soft: "#fdeee6",
      small: true,
    },
  ];

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

        .fr-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .fr-stat{background:#fff;border:1px solid #e5eaf2;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(31,45,61,.05)}
        .fr-stat-ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0}
        .fr-stat-val{font-size:1.45rem;font-weight:800;color:#1f2d3d;line-height:1.1}
        .fr-stat-val.small{font-size:.92rem;line-height:1.3}
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
        .fr-comment{color:#44566c;line-height:1.45}

        .fr-empty{text-align:center;padding:56px 20px;color:#6c757d}
        .fr-empty i{font-size:2.6rem;color:#b9c7dc}
        .fr-empty b{display:block;color:#1f2d3d;margin-top:10px;font-size:.98rem}
        .fr-alert{margin:14px 18px;padding:10px 14px;border-radius:10px;background:#fdecee;border:1px solid #f5c2c7;color:#a71d2a;font-size:.84rem;font-weight:600;display:flex;align-items:center;gap:8px}
        .fr-loading{text-align:center;padding:56px 20px;color:#6c757d;font-size:.9rem}

        @media (max-width:1100px){.fr-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (max-width:600px){.fr-page{padding:16px 12px}.fr-stats{grid-template-columns:1fr}.fr-count{margin-left:0}}
      `}</style>

      {/* Title + actions */}
      <div className="fr-top">
        <div className="fr-title">
          <div className="fr-title-icon"><i className="bi bi-ui-checks" /></div>
          <div>
            <h4>
              Form Responses
              <span className="fr-live"><i />Live</span>
            </h4>
            <p>Submissions from the contact form, updated automatically</p>
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
              <div className={`fr-stat-val ${s.small ? "small" : ""}`}>{s.value}</div>
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
              placeholder="Search name, email, address, phone, comments…"
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
                {rows.length ? "Try a different search or date range." : "New form submissions will appear here automatically."}
              </span>
            </div>
          ) : (
            <table className="fr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Comments</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
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
                    <td style={{ minWidth: 180 }}>
                      <span className="fr-chip"><i className="bi bi-geo-alt-fill" />{r.address}</span>
                    </td>
                    <td>
                      <span className="fr-chip"><i className="bi bi-telephone-fill" />{r.phone}</span>
                    </td>
                    <td className="fr-comment" style={{ minWidth: 200 }}>{r.comments}</td>
                    <td>
                      <span className="fr-date-pill"><i className="bi bi-calendar3" />{fmt(r.submittedAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}