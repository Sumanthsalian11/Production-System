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

export default function FormResponses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
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

  return (
    <div className="p-3 p-md-4">
      <style>{`
        .fr-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-sm)}
        .fr-btn{background:var(--accent-grad);color:#fff;border:none;border-radius:8px;font-weight:600;font-size:.82rem;padding:7px 14px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
        .fr-btn:disabled{opacity:.5;cursor:not-allowed}
        .fr-btn-light{background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-weight:600;font-size:.82rem;padding:7px 14px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
        .fr-input{border:1px solid var(--border-strong);background:var(--surface);color:var(--text);border-radius:8px;padding:6px 10px;font-size:.84rem;outline:none}
        .fr-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
        .fr-wrap{overflow:auto;max-height:calc(100vh - 290px);min-height:200px}
        .fr-table{width:100%;border-collapse:collapse;font-size:.85rem}
        .fr-table th{position:sticky;top:0;background:var(--accent-soft);color:var(--text);text-align:left;padding:9px 12px;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;border-bottom:1px solid var(--border)}
        .fr-table td{padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text);vertical-align:top}
        .fr-table tr:hover td{background:var(--hover)}
        .fr-count{background:var(--surface-2);border:1px solid var(--border);border-radius:999px;padding:2px 12px;font-size:.75rem;font-weight:700;color:var(--text)}
      `}</style>

      <div className="fr-card">
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="d-flex align-items-center gap-2">
            <h5 className="mb-0 fw-bold" style={{ color: "var(--text)" }}>Form Responses</h5>
            <span className="fr-count">{filtered.length} of {rows.length}</span>
          </div>
          <div className="d-flex gap-2">
            <button className="fr-btn-light" onClick={load} disabled={loading}>
              <i className="bi bi-arrow-clockwise" /> {loading ? "Loading…" : "Refresh"}
            </button>
            <button className="fr-btn" onClick={exportExcel} disabled={!filtered.length}>
              <i className="bi bi-file-earmark-excel" /> Export to Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="d-flex flex-wrap align-items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <input
            className="fr-input"
            style={{ minWidth: 240 }}
            placeholder="🔍 Search name, email, address, phone, comments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="d-flex align-items-center gap-1 small" style={{ color: "var(--muted)" }}>
            From
            <input type="date" className="fr-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="d-flex align-items-center gap-1 small" style={{ color: "var(--muted)" }}>
            To
            <input type="date" className="fr-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {hasFilter && (
            <button className="fr-btn-light" onClick={clearFilters}>
              <i className="bi bi-x-lg" /> Clear
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger m-3 py-2 small">{error}</div>}

        {/* Table */}
        <div className="fr-wrap">
          {loading ? (
            <div className="text-center py-5 small" style={{ color: "var(--muted)" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5" style={{ color: "var(--muted)" }}>
              <i className="bi bi-inbox" style={{ fontSize: "2rem" }} />
              <div className="mt-2 small">{rows.length ? "No responses match your filters." : "No responses saved yet."}</div>
            </div>
          ) : (
            <table className="fr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Comments</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r._id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td>{r.email}</td>
                    <td style={{ minWidth: 200 }}>{r.address}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.phone}</td>
                    <td style={{ minWidth: 220 }}>{r.comments}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmt(r.submittedAt)}</td>
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