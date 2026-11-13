// frontend/src/pages/JobValidation.jsx
// React port of the Apps Script "Job validation" dashboard (index.html).
// Needs:  npm i xlsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

const API = `${BASE_URL}/api/job-validation`;
const authCfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
const errMsg = (e) => e?.response?.data?.message || e?.message || String(e);

/* ---------------- formatting helpers ---------------- */
const fmtI = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt4 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const n0 = (v) => fmtI.format(v || 0);
const n2 = (v) => fmt2.format(v || 0);
const n4 = (v) => fmt4.format(v || 0);
const rs = (v) => "\u20B9" + n0(v);
const get = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const monthName = (k) => {
  if (k === "ALL") return "All months";
  const p = k.split("-");
  return new Date(+p[0], +p[1] - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
};

const COLORS = { paper: "#0A7896", production: "#14202B", ink: "#B4235C", plate: "#E5A823", film: "#5FA8BE", gum: "#8A97A3", other: "#C9D1D8" };
const LABELS = { paper: "Paper", production: "Machines", ink: "Ink", plate: "Plates", film: "Window / shrink film", gum: "Pasting gum", other: "Outsource and packing" };
const PARTS = ["paper", "production", "ink", "plate", "film", "gum", "other"];

/* ---------------- file parsing (upload) ---------------- */
const KINDS = ["production", "consumption", "planning"];
const lc = (s) => String(s == null ? "" : s).trim().toLowerCase();
const p2 = (n) => (n < 10 ? "0" : "") + n;

function isoText(s, order) {
  const m = String(s).trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:[ T]+(.*))?$/);
  if (!m) return s;
  const a = +m[1], b = +m[2];
  let y = +m[3];
  if (y < 100) y += 2000;
  let d = order === "MDY" ? b : a, mo = order === "MDY" ? a : b;
  if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return s;
  return y + "-" + p2(mo) + "-" + p2(d) + (m[4] ? " " + m[4].trim() : "");
}
const dayLabel = (iso) => {
  const p = iso.split("-");
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const first = text.split(/\r?\n/, 1)[0];
  let delim = ",";
  [["\t", first.split("\t").length], [";", first.split(";").length]].forEach((c) => { if (c[1] > first.split(delim).length) delim = c[0]; });
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function sheetGrid(ws) {
  if (!ws["!ref"]) return [];
  const rg = XLSX.utils.decode_range(ws["!ref"]);
  const out = [];
  for (let r = rg.s.r; r <= rg.e.r; r++) {
    const row = [];
    for (let c = rg.s.c; c <= rg.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      let v = "";
      if (cell && cell.v != null) {
        if (cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z)) {
          const dc = XLSX.SSF.parse_date_code(cell.v);
          const tm = p2(dc.H) + ":" + p2(dc.M) + ":" + p2(dc.S);
          v = cell.v < 1 ? tm : dc.y + "-" + p2(dc.m) + "-" + p2(dc.d) + (cell.v % 1 ? " " + tm : "");
        } else v = cell.v;
      }
      row.push(v);
    }
    out.push(row);
  }
  return out;
}

function missingOf(need, header) {
  const have = {};
  header.forEach((x) => { have[lc(x)] = 1; });
  return need.filter((g) => !g.some((n) => have[n])).map((g) => g[0]);
}

function pickSheet(need, wb) {
  let pick = null;
  wb.SheetNames.some((n) => {
    const g = sheetGrid(wb.Sheets[n]);
    if (!g.length) return false;
    if (!pick) pick = g;
    for (let i = 0; i < Math.min(g.length, 15); i++) if (!missingOf(need, g[i]).length) { pick = g; return true; }
    return false;
  });
  return pick || [];
}

function prepare(need, grid, order) {
  let best = -1, bestMiss = 99;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const m = missingOf(need, grid[i]).length;
    if (m < bestMiss) { bestMiss = m; best = i; }
    if (!m) break;
  }
  if (best < 0) return { error: "The file is empty." };
  let header = grid[best].map((x) => String(x == null ? "" : x).trim());
  const lack = missingOf(need, header);
  if (lack.length) return { error: "Missing columns: " + lack.join(", ") + ". Check that this is the right file." };
  let width = header.length;
  while (width > 0 && !header[width - 1]) width--;
  header = header.slice(0, width);
  const dateCols = [];
  let dcol = -1;
  header.forEach((x, j) => { if (/date/i.test(x)) dateCols.push(j); });
  ["date", "posting date", "document date"].some((n) => { const j = header.map(lc).indexOf(n); if (j >= 0) { dcol = j; return true; } return false; });
  const rows = [];
  let lo = "", hi = "";
  for (let r = best + 1; r < grid.length; r++) {
    const src = grid[r], row = [];
    let any = false;
    for (let j = 0; j < width; j++) {
      let v = src[j] == null ? "" : src[j];
      if (typeof v === "string") {
        v = v.trim();
        if (dateCols.indexOf(j) >= 0) v = isoText(v, order);
        if (v.charAt(0) === "=") v = "'" + v;
      }
      if (v !== "") any = true;
      row.push(v);
    }
    if (!any) continue;
    rows.push(row);
    if (dcol >= 0 && /^\d{4}-\d{2}-\d{2}/.test(String(row[dcol]))) {
      const d = String(row[dcol]).slice(0, 10);
      if (!lo || d < lo) lo = d;
      if (!hi || d > hi) hi = d;
    }
  }
  if (!rows.length) return { error: "No data rows found under the header." };
  return { header, rows, headerRow: best + 1, lo, hi };
}

/* ---------------- setup editor definition ---------------- */
const SETUP_TABS = [
  { id: "settings", label: "Settings", firstKey: "key", readOnly: ["key", "what it does"], noAdd: true,
    cols: [["key", "Key"], ["value", "Value"], ["what it does", "What it does"]] },
  { id: "rates", label: "Machine rates", firstKey: "machine",
    cols: [["machine", "Machine"], ["rs per hour", "Rs per hour"], ["also called", "Also called"]] },
  { id: "routes", label: "Product routes", firstKey: "product type",
    cols: [["product type", "Product Type"], ["printing", "Printing"], ["cutting", "Cutting"], ["die punch", "Die punch"], ["w&d", "W&D"], ["shrink m/c", "Shrink m/c"],
      ["cutting units/hr", "Cutting units/hr"], ["die punch units/hr", "Die punch units/hr"], ["w&d units/hr", "W&D units/hr"], ["ink divisor", "Ink divisor"],
      ["film rule", "Film rule"], ["qty from stage", "Qty from stage"], ["other stages (no rate)", "Other stages (no rate)"]] },
  { id: "mats", label: "Material rates", firstKey: "item",
    cols: [["item", "Item"], ["rate (rs)", "Rate (Rs)"], ["basis", "Basis"], ["note", "Note"]] },
  { id: "overrides", label: "Job overrides", firstKey: "wo no",
    cols: [["wo no", "WO No"], ["colours", "Colours"], ["plates used", "Plates used"], ["ink kg", "Ink kg"], ["window film (y/n)", "Window film (Y/N)"],
      ["pasting gum kg", "Pasting gum kg"], ["outsource charge (rs)", "Outsource charge (Rs)"], ["packing & transport (rs)", "Packing & transport (Rs)"], ["remarks", "Remarks"]] },
];

/* ======================================================================= */
export default function JobValidation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [fMachine, setFMachine] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [sortKey, setSortKey] = useState("wo");
  const [sortDir, setSortDir] = useState(-1);
  const [selected, setSelected] = useState(null); // WO number of the job shown in the pop-up window
  const [showUpload, setShowUpload] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const lastStamp = useRef(null);
  const monthRef = useRef("");
  monthRef.current = month;

  const load = useCallback(async (m, quiet) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const r = await axios.get(`${API}/report`, { ...authCfg(), params: { month: m || "" } });
      setData(r.data);
      lastStamp.current = r.data.stamp;
      setMonth(r.data.month);
    } catch (e) {
      setError("Could not read the report: " + errMsg(e) + ". Check that the Production and Consumption data has been uploaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(""); }, [load]);

  // refresh itself when data changes (same 90 s check as the Apps Script dashboard)
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden || !lastStamp.current) return;
      try {
        const r = await axios.get(`${API}/stamp`, authCfg());
        if (r.data.stamp && r.data.stamp !== lastStamp.current) load(monthRef.current, true);
      } catch { /* ignore */ }
    }, 90000);
    return () => clearInterval(t);
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const query = q.trim().toLowerCase();
    const list = data.rows
      .filter((r) => {
        if (fMachine && r.machine !== fMachine) return false;
        if (fStatus === "review" && r.status === "ok") return false;
        if (fStatus === "crit" && r.status !== "crit") return false;
        if (fStatus === "ok" && r.status !== "ok") return false;
        if (query && (r.wo + " " + r.customer + " " + r.job + " " + r.machine).toLowerCase().indexOf(query) < 0) return false;
        return true;
      })
      .map((r) => ({ ...r, flagCount: r.flags.filter((f) => f.sev !== "info").length * 100 + r.flags.length }));
    list.sort((a, b) => {
      let x = get(a, sortKey), y = get(b, sortKey);
      if (typeof x === "string" && !isNaN(+x) && x !== "") { x = +x; y = +y; }
      if (x == null) x = "";
      if (y == null) y = "";
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
    return list;
  }, [data, q, fMachine, fStatus, sortKey, sortDir]);

  const machineNames = useMemo(() => {
    const names = {};
    (data?.rows || []).forEach((r) => { if (r.machine) names[r.machine] = 1; });
    return Object.keys(names).sort();
  }, [data]);

  const onSort = (k) => {
    if (sortKey === k) setSortDir((d) => -d);
    else { setSortKey(k); setSortDir(1); }
  };

  /* ---------- exports ---------- */
  const downloadCsv = () => {
    const head = ["WO", "Machine", "Customer", "Job", "Product type", "WO qty", "Produced", "Waste %", "Printing h", "Cutting h", "Die punch h", "W&D h", "Paper", "Plate", "Ink", "Film", "Gum", "Machines", "Outsource", "Packing", "Total", "Rate per unit", "Rate per 1000", "Status", "Flags"];
    const lines = [head].concat(rows.map((r) => [r.wo, r.machine, r.customer, r.job, r.productType, r.woQty, r.prodQty, r.wastePct, r.hrs.printing, r.hrs.cutting, r.hrs.die, r.hrs.wd,
      r.cost.paper, r.cost.plate, r.cost.ink, r.cost.film, r.cost.gum, r.cost.production, r.cost.outsource, r.cost.packing, r.cost.total, r.perUnit, r.per1000,
      r.status, r.flags.map((f) => f.text).join("; ")]))
      .map((row) => row.map((v) => { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "job-validation-" + data.month + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // replaces "Export to sheet": same Consolidated column layout, downloaded as an Excel file
  const exportExcel = () => {
    const head = ["Machine", "Customer Name", "Job Description", "Material code", "Work order", "No of color", "WO qty", "Production qty",
      "Paper(kg) for Prodction", "Paper(kg) for Makerady", "Plate", "Ink kg", "window film kg/SHRINK FILM", "Pasting gum kg",
      "Printing", "Cutting", "Die punch", "W&D", "Shrink m/c", "Paper", "Plate", "Ink", "Window film/Shrink film", "Pasting gum",
      "Production cost(all m/c's)", "Outsourse charge", "Packing & Transportation charge", "Total Cost", "Per Lvs/No's cost", "Status", "Flags"];
    const body = data.rows.map((r) => [r.machine, r.customer, r.job, r.materialCode, r.wo, r.colors, r.woQty, r.prodQty,
      r.paperKg, 0, r.plates, r.inkKg, r.filmKg, r.gumKg,
      r.hrs.printing, r.hrs.cutting, r.hrs.die, r.hrs.wd, r.hrs.shrink,
      r.cost.paper, r.cost.plate, r.cost.ink, r.cost.film, r.cost.gum,
      r.cost.production, r.cost.outsource, r.cost.packing, r.cost.total, r.perUnit,
      r.status, r.flags.map((f) => f.text).join("; ")]);
    const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Report_" + (data.month === "ALL" ? "All" : data.month) + ".xlsx");
  };

  const s = data?.summary;
  const tot = s?.total || 1;

  return (
    <div className="jv">
      <style>{CSS}</style>

      <div className="jv-head">
        <div>
          <div className="jv-sub">
            {data
              ? `${monthName(data.month)}  |  ${n0(data.sources.production)} production entries, ${n0(data.sources.consumption)} SAP issues  |  costed statuses: ${data.costStatuses.toLowerCase()}  |  updated ${data.generatedAt}`
              : "Planning and production, costed with machine running rates"}
          </div>
        </div>
        <div className="jv-grow" />
        <div className="jv-ctl">
          <label htmlFor="jv-month">Month (by last production entry)</label>
          <select id="jv-month" value={month} onChange={(e) => { setMonth(e.target.value); load(e.target.value); }}>
            {data && data.months.concat(["ALL"]).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
          </select>
        </div>
        <FilesMenu onChanged={() => load("")} /><button className="jv-btn primary" onClick={() => setShowUpload(true)}>Upload data</button>
        <button className="jv-btn" onClick={() => setShowSetup(true)}>Setup</button>
        <button className="jv-btn" disabled={loading} onClick={() => load(month)}>Refresh</button>
        <button className="jv-btn" disabled={!data} onClick={downloadCsv}>Download CSV</button>
        <button className="jv-btn" disabled={!data} onClick={exportExcel}>Export to Excel</button>
      </div>

      <main className="jv-main">
        {flash && <div className="jv-msg ok">{flash}</div>}
        {error && <div className="jv-msg">{error}</div>}
        {loading && <div className="jv-loading">Reading Production and SAP consumption...</div>}

        {data && !loading && (
          <>
            <section className="jv-kpis">
              {[
                ["Jobs", n0(s.jobs), ""],
                ["Total cost", rs(s.total), ""],
                ["Machine cost", rs(s.production), ""],
                ["Waste", s.wastePct + "%", ""],
                ["Lost time", s.lostPct + "%", ""],
                ["Need review", n0(s.review), s.crit ? "crit" : ""],
              ].map((k) => (
                <div key={k[0]} className={"jv-kpi " + k[2]}>
                  <div className="v">{k[1]}</div>
                  <div className="l">{k[0]}{k[0] === "Need review" && s.crit ? ` (${s.crit} critical)` : ""}</div>
                </div>
              ))}
            </section>

            <div className="jv-split">
              <section className="jv-panel">
                <h2>Where the cost goes</h2>
                <div className="jv-bar" role="img" aria-label="Cost split">
                  {PARTS.map((k) => { const w = ((s[k] || 0) / tot) * 100; return w > 0 ? <span key={k} style={{ width: w + "%", background: COLORS[k] }} title={LABELS[k]} /> : null; })}
                </div>
                <ul className="jv-legend">
                  {PARTS.map((k) => (
                    <li key={k}><i style={{ background: COLORS[k] }} />{LABELS[k]}<span className="amt">{rs(s[k])} ({n0(((s[k] || 0) / tot) * 100)}%)</span></li>
                  ))}
                </ul>
              </section>
              <section className="jv-panel">
                <h2>Printing machines</h2>
                <table className="jv-table small">
                  <thead><tr><th>Machine</th><th className="num">Jobs</th><th className="num">Run hrs</th><th className="num">Lost hrs</th><th className="num">Lost %</th><th className="num">Machine cost</th><th className="num">To review</th></tr></thead>
                  <tbody>
                    {data.machines.length ? data.machines.map((m) => (
                      <tr key={m.machine}><td>{m.machine}</td><td className="num">{n0(m.jobs)}</td><td className="num">{n2(m.hrs)}</td><td className="num">{n2(m.lost)}</td><td className="num">{m.lostPct}%</td><td className="num">{rs(m.printCost)}</td><td className="num">{n0(m.review)}</td></tr>
                    )) : <tr><td colSpan={7} className="jv-empty">No printing hours found.</td></tr>}
                  </tbody>
                </table>
              </section>
            </div>

            <div className="jv-tools">
              <input type="search" placeholder="Search WO, customer or job" aria-label="Search jobs" value={q} onChange={(e) => setQ(e.target.value)} />
              <select aria-label="Filter by machine" value={fMachine} onChange={(e) => setFMachine(e.target.value)}>
                <option value="">All machines</option>
                {machineNames.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select aria-label="Filter by status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="review">Needs review</option>
                <option value="crit">Critical only</option>
                <option value="ok">Clean</option>
              </select>
              <span className="count">{rows.length} of {data.rows.length} jobs</span>
            </div>

            <div className="jv-tablewrap">
              <table className="jv-table">
                <thead>
                  <tr>
                    <th></th>
                    {[
                      ["wo", "WO", true], ["machine", "Machine"], ["customer", "Customer and job"], ["woQty", "WO qty", true], ["prodQty", "Produced", true],
                      ["qtyVarPct", "Vs WO", true], ["wastePct", "Waste", true], ["hrs.printing", "Print h", true], ["hrs.cutting", "Cut h", true], ["hrs.die", "Die h", true],
                      ["hrs.wd", "W&D h", true], ["cost.total", "Total cost", true], ["perUnit", "Rate per unit", true], ["per1000", "Rate per 1000", true], ["flagCount", "Flags"],
                    ].map(([k, label, num]) => (
                      <th key={k} className={"sortable" + (num ? " num" : "")} aria-sort={sortKey === k ? (sortDir > 0 ? "ascending" : "descending") : "none"} onClick={() => onSort(k)}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const serious = r.flags.filter((f) => f.sev !== "info");
                    const vcls = r.qtyVarPct < -2 ? "neg" : r.qtyVarPct > 5 ? "pos" : "";
                    return (
                      <JobRow key={r.wo} r={r} serious={serious} vcls={vcls} onOpen={() => setSelected(r.wo)} />
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <div className="jv-empty">No jobs match these filters.</div>}
            </div>
          </>
        )}
      </main>

      {selected && (() => {
        const idx = rows.findIndex((x) => x.wo === selected);
        const job = idx >= 0 ? rows[idx] : data?.rows.find((x) => x.wo === selected);
        if (!job) return null;
        return (
          <JobModal
            r={job}
            pos={idx >= 0 ? `${idx + 1} of ${rows.length}` : ""}
            onPrev={idx > 0 ? () => setSelected(rows[idx - 1].wo) : null}
            onNext={idx >= 0 && idx < rows.length - 1 ? () => setSelected(rows[idx + 1].wo) : null}
            onClose={() => setSelected(null)}
          />
        );
      })()}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={(msg) => {
            setShowUpload(false);
            setFlash(msg);
            setTimeout(() => setFlash(""), 15000);
            load("");
          }}
        />
      )}
      {showSetup && (
        <SetupModal
          onClose={() => setShowSetup(false)}
          onSaved={() => { setShowSetup(false); setFlash("Setup saved. The report has been recalculated."); setTimeout(() => setFlash(""), 8000); load(monthRef.current); }}
        />
      )}
    </div>
  );
}

/* ---------------- one job row (click opens the pop-up window) ---------------- */
function JobRow({ r, serious, vcls, onOpen }) {
  const flagCell = serious.length ? (
    <><span className={"jv-pill " + r.status}>{serious.length}</span> {serious[0].text}{serious.length > 1 ? ` +${serious.length - 1}` : ""}</>
  ) : r.flags.length ? (
    <span className="jv-jobdesc">{r.flags.length} note{r.flags.length > 1 ? "s" : ""}</span>
  ) : (
    <span className="jv-pill ok">Clean</span>
  );
  return (
    <>
      <tr className="job" tabIndex={0} onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}>
        <td><span className={"jv-dot " + r.status} title={r.status} /></td>
        <td className="num">{r.wo}</td>
        <td>{r.machine || "-"}</td>
        <td><div className="jv-cust">{r.customer || "-"}</div><div className="jv-jobdesc">{r.job}</div></td>
        <td className="num">{n0(r.woQty)}</td>
        <td className="num">{n0(r.prodQty)}</td>
        <td className={"num " + vcls}>{r.woQty ? (r.qtyVarPct > 0 ? "+" : "") + r.qtyVarPct + "%" : "-"}</td>
        <td className="num">{r.prodQty ? r.wastePct + "%" : "-"}</td>
        <td className="num">{n2(r.hrs.printing)}</td>
        <td className="num">{n2(r.hrs.cutting)}</td>
        <td className="num">{n2(r.hrs.die)}</td>
        <td className="num">{n2(r.hrs.wd)}</td>
        <td className="num">{n0(r.cost.total)}</td>
        <td className="num">{r.perUnit ? n4(r.perUnit) : "-"}</td>
        <td className="num">{r.per1000 ? n2(r.per1000) : "-"}</td>
        <td>{flagCell}</td>
      </tr>
    </>
  );
}

/* ---------------- pop-up window with the full job detail ---------------- */
function JobModal({ r, pos, onPrev, onNext, onClose }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, onPrev, onNext]);

  const statusLabel = r.status === "crit" ? "Critical" : r.status === "warn" ? "Needs review" : "Clean";
  return (
    <div className="jv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jv-modal jobwin" role="dialog" aria-modal="true" aria-label={"Job " + r.wo}>
        <div className="jv-mhead">
          <div>
            <h2>WO {r.wo} <span className={"jv-pill " + r.status} style={{ marginLeft: 8, verticalAlign: "middle" }}>{statusLabel}</span></h2>
            <div className="jv-jobdesc" style={{ maxWidth: "none" }}>
              <b>{r.customer || "-"}</b>{r.job ? " | " + r.job : ""}{r.machine ? " | " + r.machine : ""}
            </div>
          </div>
          <div className="jv-winbtns">
            {pos && <span className="jv-jobdesc">{pos}</span>}
            <button className="jv-btn" disabled={!onPrev} onClick={onPrev} title="Previous job (left arrow)">&lsaquo; Prev</button>
            <button className="jv-btn" disabled={!onNext} onClick={onNext} title="Next job (right arrow)">Next &rsaquo;</button>
            <button className="jv-btn" onClick={onClose} title="Close (Esc)">Close</button>
          </div>
        </div>
        <div className="jv-winstats">
          {[["WO qty", n0(r.woQty)], ["Produced", n0(r.prodQty)], ["Vs WO", r.woQty ? (r.qtyVarPct > 0 ? "+" : "") + r.qtyVarPct + "%" : "-"],
            ["Waste", r.prodQty ? r.wastePct + "%" : "-"], ["Total cost", rs(r.cost.total)], ["Rate per unit", r.perUnit ? n4(r.perUnit) : "-"], ["Rate per 1000", r.per1000 ? n2(r.per1000) : "-"]]
            .map(([l, v]) => <div key={l}><div className="v">{v}</div><div className="l">{l}</div></div>)}
        </div>
        <JobDetail r={r} />
      </div>
    </div>
  );
}

function JobDetail({ r }) {
  const c = r.cost, so = r.sources;
  const costRows = [
    [`Paper (${so.paper})`, n0(r.paperKg) + " kg", c.paper],
    [`Plates (${so.plate})`, n0(r.plates), c.plate],
    [`Ink (${so.ink})`, n2(r.inkKg) + " kg", c.ink],
    [`Window / shrink film (${so.film})`, n2(r.filmKg) + " kg", c.film],
    [`Pasting gum (${so.gum})`, n2(r.gumKg) + " kg", c.gum],
    ["Machines", "", c.production],
    ["Outsource", "", c.outsource],
    ["Packing and transport", "", c.packing],
  ];
  return (
    <div className="jv-detail">
      <div>
        <div className="jv-dgrid">
          <div>
            <h3>Cost build-up</h3>
            <table>
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Rs</th></tr></thead>
              <tbody>
                {costRows.map((x) => <tr key={x[0]}><td>{x[0]}</td><td className="num">{x[1]}</td><td className="num">{n0(x[2])}</td></tr>)}
                <tr className="total"><td>Total</td><td></td><td className="num">{n0(c.total)}</td></tr>
              </tbody>
            </table>
            <h3>Machine cost</h3>
            <table>
              <thead><tr><th>Stage</th><th>Machine</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Rs</th></tr></thead>
              <tbody>
                {r.rateInfo.length ? r.rateInfo.map((x, i) => (
                  <tr key={i}><td>{x.stage}</td><td>{x.machine}</td><td className="num">{n2(x.hrs)} h</td><td className="num">{n0(x.rate)}/h</td><td className="num">{n0(x.hrs * x.rate)}</td></tr>
                )) : <tr><td colSpan={5}>No machine hours costed.</td></tr>}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Validation</h3>
            {r.flags.length ? r.flags.map((f, i) => (
              <div key={i} className="jv-flagline">
                <span className={"jv-pill " + (f.sev === "info" ? "ok" : f.sev)}>{f.sev === "crit" ? "Critical" : f.sev === "warn" ? "Review" : "Note"}</span>
                <span>{f.text}</span>
              </div>
            )) : <div className="jv-flagline"><span className="jv-pill ok">Clean</span><span>Nothing to review.</span></div>}
            {r.breakdowns.length > 0 && (
              <>
                <h3>Breakdowns</h3>
                {r.breakdowns.map((b, i) => <div key={i} className="jv-flagline"><span className="num">{n2(b.hrs)} h</span><span>{b.why}</span></div>)}
              </>
            )}
            <h3>Hours: logged and used</h3>
            <table>
              <thead><tr><th>Stage</th><th className="num">Logged</th><th className="num">Used in cost</th></tr></thead>
              <tbody>
                <tr><td>Printing</td><td className="num">{n2(r.hrs.printing)}</td><td className="num">{n2(r.hrs.printing)}</td></tr>
                <tr><td>Cutting</td><td className="num">{n2(r.actualHrs.cutting)}</td><td className="num">{n2(r.hrs.cutting)}</td></tr>
                <tr><td>Die punch</td><td className="num">{n2(r.actualHrs.die)}</td><td className="num">{n2(r.hrs.die)}</td></tr>
                <tr><td>W&amp;D</td><td className="num">{n2(r.actualHrs.wd)}</td><td className="num">{n2(r.hrs.wd)}</td></tr>
                <tr><td>Make ready (not costed)</td><td className="num">{n2(r.makeReadyHrs)}</td><td className="num"></td></tr>
                <tr><td>Idle and breakdown</td><td className="num">{n2(r.lostHrs)}</td><td className="num">-</td></tr>
              </tbody>
            </table>
            <h3>Job</h3>
            <div className="jv-jobdesc">
              WO {r.wo} | {r.productType || "no product type"} | {r.paperDesc || "no paper"} | SAP paper {n0(r.paperKg)} kg{r.plannedPaperKg ? ` vs planned ${n0(r.plannedPaperKg)} kg` : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- upload modal ---------------- */
function UploadModal({ onClose, onDone }) {
  const [info, setInfo] = useState(null);
  const [raw, setRaw] = useState({});       // kind -> { name, grid, error }
  const [dates, setDates] = useState("DMY");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [drag, setDrag] = useState("");
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    axios.get(`${API}/upload-info`, authCfg()).then((r) => setInfo(r.data)).catch((e) => setLoadErr("Could not open upload: " + errMsg(e)));
  }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [busy, onClose]);

  // parse again whenever the file or the date order changes
  const parsed = useMemo(() => {
    const out = {};
    if (!info) return out;
    KINDS.forEach((k) => {
      const e = raw[k];
      if (!e) return;
      if (e.error) { out[k] = { error: e.error, name: e.name }; return; }
      const p = prepare(info.kinds[k].need, e.grid, dates);
      out[k] = p.error ? { error: p.error, name: e.name } : { ...p, name: e.name };
    });
    return out;
  }, [raw, dates, info]);

  const takeFile = (k, file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const rd = new FileReader();
    const set = (v) => setRaw((r) => ({ ...r, [k]: v }));
    rd.onerror = () => set({ name: file.name, error: "Could not read the file." });
    if (ext === "csv" || ext === "txt") {
      rd.onload = () => set({ name: file.name, grid: parseCsv(String(rd.result)) });
      rd.readAsText(file);
      return;
    }
    rd.onload = () => {
      try {
        const wb = XLSX.read(rd.result, { type: "array", cellNF: true });
        set({ name: file.name, grid: pickSheet(info.kinds[k].need, wb) });
      } catch {
        set({ name: file.name, error: "Could not open this file. Save it as .xlsx or CSV and try again." });
      }
    };
    rd.readAsArrayBuffer(file);
  };

  const ready = KINDS.filter((k) => parsed[k] && !parsed[k].error);

  const sendKind = async (k) => {
    const p = parsed[k];
    const grid = [p.header].concat(p.rows);
    const batchId = Date.now() + "-" + k;
    const CH = 1500;
    for (let pos = 0; pos < grid.length; pos += CH) {
      const part = grid.slice(pos, pos + CH);
      setMsg(`Uploading ${info.kinds[k].label}: ${n0(Math.min(pos + part.length, grid.length) - 1)} of ${n0(grid.length - 1)} rows...`);
      await axios.post(`${API}/upload/${k}`, { rows: part, startRow: pos, batchId, final: pos + part.length >= grid.length, passcode: pass, fileName: p.name }, authCfg());
    }
    return grid.length - 1;
  };

  const go = async () => {
    if (!ready.length || busy) return;
    const small = ready.filter((k) => { const c = info.kinds[k].rows; return c > 20 && parsed[k].rows.length < c * 0.5; });
    if (small.length && !window.confirm(`The new ${small.join(" and ")} file has fewer than half the rows now stored. Replace anyway?`)) return;
    setBusy(true);
    const LABEL = { production: "production rows", consumption: "SAP rows", planning: "planning rows" };
    const done = [];
    try {
      for (const k of ready) { const n = await sendKind(k); done.push(n0(n) + " " + LABEL[k]); }
      onDone("Uploaded " + done.join(", ") + ". The report has been recalculated.");
    } catch (e) {
      setBusy(false);
      setMsg("Upload stopped: " + errMsg(e) + ". The earlier data is still in place.");
    }
  };

  return (
    <div className="jv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="jv-modal" role="dialog" aria-modal="true">
        <div className="jv-mhead"><h2>Upload data</h2><button className="jv-btn" onClick={() => !busy && onClose()}>Close</button></div>
        <p className="jv-hint">Choose the files exported from your system (.xlsx, .xls or .csv). Each file replaces that data set and the report recalculates. A failed upload leaves the earlier data untouched.</p>
        {loadErr && <div className="jv-msg">{loadErr}</div>}
        {!info && !loadErr && <div className="jv-ustat">Checking stored data...</div>}
        {info && KINDS.map((k) => {
          const i = info.kinds[k], p = parsed[k], e = raw[k];
          const cls = "jv-ucard" + (drag === k ? " drag" : "") + (p ? (p.error ? " bad" : " ok") : "");
          return (
            <div key={k} className={cls}
              onDragOver={(ev) => { ev.preventDefault(); setDrag(k); }}
              onDragLeave={() => setDrag("")}
              onDrop={(ev) => { ev.preventDefault(); setDrag(""); const f = ev.dataTransfer.files[0]; if (f) takeFile(k, f); }}>
              <div className="top">
                <div><div className="name">{i.label}</div><div className="cur">{i.rows ? `${n0(i.rows)} rows stored now` : "Nothing stored yet"}</div></div>
                <input type="file" accept=".xlsx,.xls,.csv,.txt" aria-label={"Choose file for " + i.label} onChange={(ev) => ev.target.files[0] && takeFile(k, ev.target.files[0])} />
              </div>
              <div className="jv-ustat">
                {!e ? "Drop a file here or choose one."
                  : p?.error ? `${p.name}: ${p.error}`
                  : p ? `${p.name}: ${n0(p.rows.length)} rows${p.headerRow > 1 ? `, header on row ${p.headerRow}` : ""}${p.lo ? `, dates ${dayLabel(p.lo)} to ${dayLabel(p.hi)}` : ""}. Replaces ${n0(i.rows)} rows now stored.`
                  : `Reading ${e.name}...`}
              </div>
            </div>
          );
        })}
        <div className="jv-mrow">
          <label htmlFor="jv-dates">Dates written as text are</label>
          <select id="jv-dates" value={dates} onChange={(e) => setDates(e.target.value)}>
            <option value="DMY">day/month/year</option>
            <option value="MDY">month/day/year</option>
          </select>
          {info?.needPasscode && (<><label htmlFor="jv-pass">Passcode</label><input id="jv-pass" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} /></>)}
        </div>
        <div className="jv-mfoot">
          <span className="jv-hint" aria-live="polite" style={{ margin: 0 }}>{msg}</span>
          <button className="jv-btn primary" disabled={busy || !ready.length} onClick={go}>Upload and recalculate</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- setup modal (replaces the Setup sheet) ---------------- */
function SetupModal({ onClose, onSaved }) {
  const [setup, setSetup] = useState(null);
  const [tab, setTab] = useState("settings");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/setup`, authCfg()).then((r) => setSetup(r.data)).catch((e) => setErr("Could not load setup: " + errMsg(e)));
  }, []);

  const def = SETUP_TABS.find((t) => t.id === tab);
  const list = setup ? setup[tab] || [] : [];
  const edit = (i, k, v) => setSetup((s) => ({ ...s, [tab]: s[tab].map((r, x) => (x === i ? { ...r, [k]: v } : r)) }));
  const add = () => setSetup((s) => ({ ...s, [tab]: [...(s[tab] || []), {}] }));
  const del = (i) => setSetup((s) => ({ ...s, [tab]: s[tab].filter((_, x) => x !== i) }));

  const save = async () => {
    setSaving(true); setErr("");
    try {
      await axios.put(`${API}/setup`, setup, authCfg());
      onSaved();
    } catch (e) {
      setSaving(false);
      setErr("Could not save: " + errMsg(e));
    }
  };

  return (
    <div className="jv-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="jv-modal wide" role="dialog" aria-modal="true">
        <div className="jv-mhead"><h2>Setup</h2><button className="jv-btn" onClick={() => !saving && onClose()}>Close</button></div>
        <p className="jv-hint">Settings, machine rates, product routes, material rates and manual job values. Leave a job-override cell empty to keep the automatic value. Rows with an empty first column are ignored.</p>
        <div className="jv-tabs">
          {SETUP_TABS.map((t) => <button key={t.id} className={"jv-tab" + (t.id === tab ? " on" : "")} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        {err && <div className="jv-msg">{err}</div>}
        {!setup && !err && <div className="jv-ustat">Loading...</div>}
        {setup && (
          <div className="jv-setupwrap">
            <table className="jv-table small">
              <thead><tr>{def.cols.map((c) => <th key={c[0]}>{c[1]}</th>)}<th></th></tr></thead>
              <tbody>
                {list.map((row, i) => (
                  <tr key={i}>
                    {def.cols.map(([k]) => (
                      <td key={k}>
                        {def.readOnly?.includes(k)
                          ? <span className={k === "what it does" ? "jv-jobdesc" : ""}>{row[k]}</span>
                          : <input value={row[k] === undefined || row[k] === null ? "" : row[k]} onChange={(e) => edit(i, k, e.target.value)} />}
                      </td>
                    ))}
                    <td>{!def.noAdd && <button className="jv-btn" onClick={() => del(i)} title="Remove row">&times;</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="jv-mfoot">
          {def && !def.noAdd ? <button className="jv-btn" onClick={add}>Add row</button> : <span />}
          <button className="jv-btn primary" disabled={!setup || saving} onClick={save}>{saving ? "Saving..." : "Save and recalculate"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- styles (use the shared page tokens from DashboardLayout) ---------------- */
const CSS = `
.jv { --jv-cyan: var(--accent, #0A7896); --jv-line: var(--border, #D8DEE4); --jv-soft: #EDF0F3; --jv-cyan-soft: #E3F1F5;
  --jv-warn: #B7791F; --jv-warn-soft: #FBF1D9; --jv-crit: #B4235C; --jv-crit-soft: #F9E3EC; --jv-ok: #2C7A56;
  color: var(--text, #14202B); font-size: 14px; line-height: 1.45; background: #F1F4F6; min-height: 100vh; }
.jv * { box-sizing: border-box; }
.jv .num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.jv-head { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; padding: 14px 24px; background: #fff; border-bottom: 1px solid var(--jv-line); }
.jv-sub { color: var(--muted, #5A6772); font-size: 12.5px; }
.jv-grow { flex: 1; }
.jv-ctl { display: flex; align-items: center; gap: 8px; }
.jv-ctl label { color: var(--muted, #5A6772); font-size: 12.5px; }
.jv select, .jv input[type=search], .jv input[type=password], .jv-setupwrap input { background: #fff; border: 1px solid var(--jv-line); border-radius: 6px; padding: 7px 10px; font: inherit; color: inherit; min-width: 110px; }
.jv-setupwrap input { width: 100%; min-width: 80px; padding: 4px 8px; }
.jv-btn { background: #fff; border: 1px solid var(--jv-line); border-radius: 6px; padding: 7px 12px; cursor: pointer; font: inherit; font-weight: 500; color: inherit; }
.jv-btn:hover { border-color: var(--jv-cyan); color: var(--jv-cyan); }
.jv-btn.primary { background: var(--jv-cyan); border-color: var(--jv-cyan); color: #fff; }
.jv-btn.primary:hover { filter: brightness(.92); color: #fff; }
.jv-btn[disabled] { opacity: .5; cursor: default; }
.jv-main { padding: 20px 24px 40px; max-width: 1500px; margin: 0 auto; }
.jv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); background: #fff; border: 1px solid var(--jv-line); border-radius: 8px; }
.jv-kpi { padding: 14px 18px; border-right: 1px solid var(--jv-line); }
.jv-kpi:last-child { border-right: 0; }
.jv-kpi .v { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.jv-kpi .l { color: var(--muted, #5A6772); font-size: 12.5px; }
.jv-kpi.crit .v { color: var(--jv-crit); }
.jv-split { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(420px, 1.4fr); gap: 20px; margin-top: 20px; }
@media (max-width: 900px) { .jv-split, .jv-dgrid { grid-template-columns: 1fr !important; } }
.jv-panel { background: #fff; border: 1px solid var(--jv-line); border-radius: 8px; padding: 16px 18px; overflow: auto; }
.jv-panel h2 { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
.jv-bar { display: flex; height: 22px; border-radius: 4px; overflow: hidden; background: var(--jv-soft); }
.jv-bar span { display: block; height: 100%; }
.jv-legend { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
.jv-legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.jv-legend i { width: 10px; height: 10px; border-radius: 2px; flex: none; }
.jv-legend .amt { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--muted, #5A6772); }
.jv-table { border-collapse: collapse; width: 100%; }
.jv-table th, .jv-table td { padding: 8px 10px; border-bottom: 1px solid var(--jv-line); vertical-align: top; text-align: left; }
.jv-table th { font-weight: 600; font-size: 12.5px; color: var(--muted, #5A6772); background: var(--jv-soft); position: sticky; top: 0; z-index: 1; white-space: nowrap; }
.jv-table th.num { text-align: right; }
.jv-table th.sortable { cursor: pointer; user-select: none; }
.jv-table th.sortable:hover { color: var(--jv-cyan); }
.jv-table th[aria-sort="ascending"]::after { content: " \\25B2"; font-size: 9px; }
.jv-table th[aria-sort="descending"]::after { content: " \\25BC"; font-size: 9px; }
.jv-table.small td, .jv-table.small th { padding: 6px 8px; }
.jv-tools { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; margin: 24px 0 10px; }
.jv-tools .count { margin-left: auto; color: var(--muted, #5A6772); font-size: 12.5px; }
.jv-tablewrap { background: #fff; border: 1px solid var(--jv-line); border-radius: 8px; overflow: auto; max-height: 70vh; }
.jv-table tr.job { cursor: pointer; }
.jv-table tr.job:hover td { background: #F7FAFB; }
.jv-table tr.job[aria-expanded="true"] td { background: var(--jv-cyan-soft); border-bottom-color: transparent; }
.jv-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; }
.jv-dot.ok { background: var(--jv-ok); } .jv-dot.warn { background: #E5A823; } .jv-dot.crit { background: var(--jv-crit); }
.jv-cust { font-weight: 600; }
.jv-jobdesc { color: var(--muted, #5A6772); font-size: 12.5px; max-width: 320px; }
.jv .neg { color: var(--jv-crit); } .jv .pos { color: var(--jv-warn); }
.jv-pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; }
.jv-pill.warn { background: var(--jv-warn-soft); color: var(--jv-warn); }
.jv-pill.crit { background: var(--jv-crit-soft); color: var(--jv-crit); }
.jv-pill.ok { background: #E1F1E8; color: var(--jv-ok); }
.jv-table tr.detail td { background: var(--jv-cyan-soft); padding: 4px 16px 18px 40px; }
.jv-dgrid { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr); gap: 24px; }
.jv-dgrid h3 { margin: 12px 0 6px; font-size: 13px; }
.jv-dgrid table { border-collapse: collapse; width: 100%; }
.jv-dgrid td, .jv-dgrid th { padding: 4px 8px; background: transparent; position: static; border-bottom: 1px solid #C9DDE4; text-align: left; font-size: 12.5px; }
.jv-dgrid th.num, .jv-dgrid td.num { text-align: right; }
.jv-dgrid tr.total td { font-weight: 700; border-top: 2px solid #14202B; }
.jv-flagline { display: flex; gap: 8px; margin: 4px 0; align-items: flex-start; }
.jv-flagline .jv-pill { flex: none; }
.jv-empty { padding: 40px 20px; text-align: center; color: var(--muted, #5A6772); }
.jv-msg { padding: 14px 18px; border-radius: 8px; margin: 16px 0; background: var(--jv-crit-soft); color: var(--jv-crit); }
.jv-msg.ok { background: #E1F1E8; color: var(--jv-ok); }
.jv-loading { padding: 60px 20px; text-align: center; color: var(--muted, #5A6772); }
.jv-overlay { position: fixed; inset: 0; background: rgba(20,32,43,.45); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow: auto; z-index: 1090; }
.jv-modal { background: #fff; border: 1px solid var(--jv-line); border-radius: 8px; width: 100%; max-width: 720px; padding: 20px 22px; }
.jv-modal.wide { max-width: 1200px; }
.jv-mhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.jv-mhead h2 { margin: 0; font-size: 17px; }
.jv-hint { color: var(--muted, #5A6772); margin: 0 0 14px; font-size: 13px; }
.jv-ucard { border: 1px dashed var(--jv-line); border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; }
.jv-ucard.drag { border-color: var(--jv-cyan); background: var(--jv-cyan-soft); }
.jv-ucard.ok { border-style: solid; border-color: var(--jv-ok); }
.jv-ucard.bad { border-style: solid; border-color: var(--jv-crit); }
.jv-ucard .top { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; }
.jv-ucard .name { font-weight: 600; }
.jv-ucard .cur { color: var(--muted, #5A6772); font-size: 12.5px; }
.jv-ustat { margin-top: 6px; font-size: 12.5px; color: var(--muted, #5A6772); }
.jv-ucard.ok .jv-ustat { color: var(--jv-ok); } .jv-ucard.bad .jv-ustat { color: var(--jv-crit); }
.jv-mrow { display: flex; gap: 10px 16px; flex-wrap: wrap; align-items: center; margin: 12px 0; }
.jv-mrow label { color: var(--muted, #5A6772); font-size: 12.5px; }
.jv-mfoot { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 12px; }
.jv-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.jv-tab { background: #fff; border: 1px solid var(--jv-line); border-radius: 6px; padding: 6px 12px; cursor: pointer; font: inherit; }
.jv-tab.on { background: var(--jv-cyan); border-color: var(--jv-cyan); color: #fff; }
.jv-modal.jobwin { max-width: 1100px; }
.jv-modal.jobwin .jv-mhead { align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.jv-winbtns { display: flex; align-items: center; gap: 8px; }
.jv-winstats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); border: 1px solid var(--jv-line); border-radius: 8px; margin-bottom: 8px; }
.jv-winstats > div { padding: 10px 14px; border-right: 1px solid var(--jv-line); }
.jv-winstats > div:last-child { border-right: 0; }
.jv-winstats .v { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
.jv-winstats .l { color: var(--muted, #5A6772); font-size: 12px; }
.jv-detail { background: var(--jv-cyan-soft); border-radius: 8px; padding: 4px 16px 16px; }
.jv-setupwrap { overflow: auto; max-height: 55vh; border: 1px solid var(--jv-line); border-radius: 6px; }
`;

/* ---------------- uploaded files dropdown (names + delete) ---------------- */
const KIND_LABEL = { production: "Production", consumption: "SAP consumption", planning: "Planning" };

const FILES_CSS = `
.jv-files { position: relative; }
.jv-files-pop { position: absolute; right: 0; top: calc(100% + 6px); width: 400px; max-width: 92vw; background: #fff; border: 1px solid var(--jv-line); border-radius: 8px; box-shadow: 0 8px 24px rgba(20,32,43,.18); z-index: 30; max-height: 70vh; overflow: auto; }
.jv-files-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--jv-line); }
.jv-files-item:last-child { border-bottom: 0; }
.jv-files-info { min-width: 0; }
.jv-files-kind { font-size: 12px; color: var(--muted, #5A6772); font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.jv-files-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px; }
.jv-files-empty { padding: 16px; text-align: center; color: var(--muted, #5A6772); }
.jv-btn.del { color: var(--jv-crit); border-color: var(--jv-crit-soft); }
.jv-btn.del:hover { background: var(--jv-crit-soft); border-color: var(--jv-crit); color: var(--jv-crit); }
`;

function FilesMenu({ onChanged }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [needPass, setNeedPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyKind, setBusyKind] = useState("");
  const [err, setErr] = useState("");
  const boxRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await axios.get(`${API}/files`, authCfg());
      setList(r.data.files || []);
      setNeedPass(!!r.data.needPasscode);
    } catch (e) {
      setErr("Could not load files: " + errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const remove = async (f) => {
    const name = f.fileName || KIND_LABEL[f.kind] || f.kind;
    if (!window.confirm(`Delete "${name}" (${n0(f.rowCount)} rows) from the database?\n\nThis cannot be undone.`)) return;
    let passcode = "";
    if (needPass) {
      passcode = window.prompt("Enter the upload passcode to delete this file");
      if (passcode === null) return;
    }
    setBusyKind(f.kind);
    setErr("");
    try {
      await axios.delete(`${API}/files/${f.kind}`, { ...authCfg(), data: { passcode } });
      await refresh();
      onChanged();
    } catch (e) {
      setErr("Could not delete: " + errMsg(e));
    } finally {
      setBusyKind("");
    }
  };

  return (
    <div className="jv-files" ref={boxRef}>
      <style>{FILES_CSS}</style>
      <button className="jv-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Uploaded files &#9662;
      </button>
      {open && (
        <div className="jv-files-pop">
          {loading && <div className="jv-files-empty">Loading...</div>}
          {err && <div className="jv-msg" style={{ margin: 8 }}>{err}</div>}
          {!loading && !err && list.length === 0 && <div className="jv-files-empty">No files uploaded yet.</div>}
          {list.map((f) => (
            <div className="jv-files-item" key={f.kind}>
              <div className="jv-files-info">
                <div className="jv-files-kind">{KIND_LABEL[f.kind] || f.kind}</div>
                <div className="jv-files-name" title={f.fileName}>{f.fileName || "(file name not saved)"}</div>
                <div className="jv-jobdesc">
                  {n0(f.rowCount)} rows
                  {f.uploadedAt ? " | " + new Date(f.uploadedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  {f.uploadedBy ? " | " + f.uploadedBy : ""}
                </div>
              </div>
              <button className="jv-btn del" disabled={busyKind === f.kind} onClick={() => remove(f)}>
                {busyKind === f.kind ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}