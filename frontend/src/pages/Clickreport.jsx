import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

/* ---------- API ---------- */
const MASTER_API = `${BASE_URL}/api/master`;
const REPORT_API = `${BASE_URL}/api/click-report`;
const cfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

/* ---------- Masters ---------- */
const TOTAL_TYPE = "Total";
const TAX_NAMES = ["GST", "SGST", "CGST", "IGST"];

/* ---------- RISO machine (calculation follows the riso.xlsx sheet) ---------- */
const RISO_TYPES = ["A3", "A4", "Non Std(L)", "Non Std(S)"];
const isRiso = (m) => /riso/i.test(String(m || ""));
const risoGroup = (t) => {
  const x = String(t || "").replace(/\s+/g, "").toUpperCase();
  return x === "A3" ? "A3" : x === "A4" ? "A4" : x === "NONSTD(L)" ? "NL" : x === "NONSTD(S)" ? "NS" : null;
};

/* layout styles for the billing card (colours follow the Planner Dashboard theme) */
const rowWrap = { display: "flex", gap: "8px", alignItems: "stretch", marginBottom: "6px" };
const rowBadge = {
  flex: "0 0 44px", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#e3f1f4", color: "#000000", fontSize: "11px", fontWeight: 700,
  letterSpacing: "0.4px", textTransform: "uppercase", borderRadius: "6px",
  border: "1px solid #bdd9df",
};
const rowGrid = {
  flex: 1, display: "grid", gap: "8px", alignItems: "stretch",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};
const TABLE_COLS = 31; // number of columns in the saved-records table
const PAGE_SIZES = [25, 50, 100, 200];
const EXPORT_LIMIT = 200000; // must match the server's EXPORT_LIMIT

const EMPTY_SUMMARY = {
  count: 0, a3Impression: 0, a4Impression: 0, totalClick: 0, a3Billable: 0, a4Billable: 0,
  a3Amount: 0, a4Amount: 0, totalAmount: 0, discountAmount: 0, totalWithGst: 0,
};

/* ---------- Embedded SVG Icons ---------- */
const Icons = {
  Chart: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Printer: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  Excel: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13l3 4m0-4l-3 4" />
      <path d="M14 13l3 4m0-4l-3 4" />
    </svg>
  ),
  Save: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Edit: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Reset: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  Sync: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  ),
};

/* ---------- Outlined floating-label field with a leading icon (same as Planner Dashboard) ---------- */
const has = (v) => v !== "" && v !== null && v !== undefined;

function PoField({
  icon,
  label,
  required,
  filled,
  alwaysFloat,
  caret,
  area,
  className = "",
  style,
  labelClass = "",
  children,
}) {
  return (
    <div className={className} style={style}>
      <div className={`po-field ${filled || alwaysFloat ? "is-floated" : ""} ${area ? "po-area" : ""}`}>
        {icon && <i className={`bi ${icon} po-field-icon`}></i>}
        {children}
        <label className={`po-field-label ${labelClass}`}>
          {label}
          {required && <span className="po-req"> *</span>}
        </label>
        {caret && <i className="bi bi-chevron-down po-caret"></i>}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */
let uid = 0;
const nextId = () => `id${++uid}`;
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? 0 : Number(v));
const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const money = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thisMonth = () => new Date().toISOString().slice(0, 7);

// Rate + amount of one tax (GST / SGST / CGST / IGST) on a saved record
const taxOf = (r, n) => {
  const t = (r.taxes || []).find((x) => x.name === n);
  if (t) return { rate: t.rate, amount: t.amount || 0 };
  // old records saved before separate taxes existed: show their single GST under "GST"
  if (n === "GST" && !(r.taxes || []).length && r.gst) return { rate: r.gst, amount: r.gstAmount || 0 };
  return null;
};

const newRow = (inputType = "") => ({ id: nextId(), inputType, start: "", end: "", wastage: "" });
const newEntry = () => ({
  id: nextId(), machine: "", printer: "", rows: [newRow()],
  a4Rate: "", a3Rate: "", discount: 0, gst: "", taxes: {}, otherRates: {}, // CHANGED: + otherRates
});
const fromRecord = (r) => ({
  id: nextId(), machine: r.machine, printer: r.printer,
  a4Rate: r.a4Rate || "", a3Rate: r.a3Rate || "", discount: r.discount, gst: r.gst,
  taxes: Object.fromEntries((r.taxes || []).map((t) => [t.name, t.rate])),
  otherRates: Object.fromEntries(
    (r.rows || [])
      .filter((x) => isOtherType(x.inputType) && x.rate != null && x.rate !== "")
      .map((x) => [String(x.inputType).trim(), x.rate])
  ), // NEW: rate is read back from the reading row
  rows: r.rows.length
    ? r.rows.map((x) => ({ id: nextId(), inputType: x.inputType, start: x.start, end: x.end, wastage: x.wastage }))
    : [newRow()],
});

/* ---------- Calculations ---------- */
const typeGroup = (t) => {
  const x = String(t || "").trim().toUpperCase();
  return !x ? null : x === "A3" ? "A3" : x === "TOTAL" ? "Total" : "A4";
};
// NEW: any paper size other than A3 / A4 / Total
const isOtherType = (t) => {
  const x = String(t || "").trim().toUpperCase();
  return !!x && x !== "A3" && x !== "A4" && x !== "TOTAL";
};
const roundUp = (v) => {
  const x = +v.toFixed(6);
  return x < 0 ? -Math.ceil(-x) : Math.ceil(x);
};
const afterWastage = (imp, w) => +(imp - (imp * num(w)) / 100).toFixed(2);
const rowCalc = (r) => ({ impression: r.end === "" ? 0 : Math.abs(num(r.start) - num(r.end)) });

/* RISO — same as the Excel sheet:
   A3 total  (H) = (A3 end - A3 start) + Non Std(L)
   A4 total  (K) = (A4 end - A4 start) + Non Std(S)
   Overall   (O) = H x 2 + K
   Click calc(P) = H x A3 rate + K x A4 rate (rates from the master)
   GST value     = P x GST %      Total = P + GST value */
const risoCalc = (e) => {
  // No wastage for Riso (as in the Excel sheet); rates come from the paper-size master
  let a3Imp = 0, a4Imp = 0;
  e.rows.forEach((r) => {
    const k = risoGroup(r.inputType);
    if (!k) return;
    const imp = rowCalc(r).impression;
    if (k === "A3" || k === "NL") a3Imp += imp;  // A3 + Non Std(L)
    else a4Imp += imp;                           // A4 + Non Std(S)
  });
  const a3Bill = a3Imp, a4Bill = a4Imp;
  const totalClick = a3Imp * 2 + a4Imp;          // Excel "Overall total"
  const a3Amount = a3Bill * num(e.a3Rate);
  const a4Amount = a4Bill * num(e.a4Rate);
  const total = a3Amount + a4Amount;
  const discountAmt = (total * num(e.discount)) / 100;
  const taxable = total - discountAmt;
  const taxAmt = {};
  Object.keys(e.taxes || {}).forEach((k) => {
    taxAmt[k] = (taxable * num(e.taxes[k])) / 100;
  });
  const gstAmt = Object.keys(taxAmt).length
    ? Object.values(taxAmt).reduce((s, v) => s + v, 0)
    : (taxable * num(e.gst)) / 100;
  return {
    a3Imp, a4Imp, a3Bill, a4Bill, totalClick, a3Amount, a4Amount, total,
    discountAmt, gstAmt, taxAmt, totalWithGst: taxable + gstAmt, others: [],
  };
};

const entryCalc = (e) => {
  if (isRiso(e.machine)) return risoCalc(e);

  let a3Imp = 0, a3Bill = 0, a4RowImp = 0, a4W = null, hasA4Row = false, totalImp = 0, totalW = null, hasTotal = false;
  const otherMap = {}; // NEW
  e.rows.forEach((r) => {
    const g = typeGroup(r.inputType);
    if (!g) return;
    const { impression } = rowCalc(r);
    if (isOtherType(r.inputType)) { // NEW: other paper sizes are billed separately
      const name = String(r.inputType).trim();
      const o = otherMap[name] || (otherMap[name] = { name, imp: 0, bill: 0, w: r.wastage });
      o.imp += impression;
      o.bill += afterWastage(impression, r.wastage);
      return;
    }
    if (g === "A3") { a3Imp += impression; a3Bill += afterWastage(impression, r.wastage); }
    else if (g === "A4") { a4RowImp += impression; hasA4Row = true; if (a4W === null) a4W = r.wastage; }
    else { hasTotal = true; totalImp += impression; if (totalW === null) totalW = r.wastage; }
  });
  // A4 = (A4 start - A4 end) - A3
  const a4Imp = hasA4Row ? a4RowImp - a3Imp : (hasTotal ? totalImp - a3Imp : 0);
  const a4Bill = hasA4Row
    ? afterWastage(a4Imp, a4W)
    : (hasTotal ? afterWastage(a4Imp, totalW) : 0);

  // NEW: other sizes with their own rate
  const others = Object.values(otherMap).map((o) => ({
    ...o,
    rate: num((e.otherRates || {})[o.name]),
    amount: o.bill * num((e.otherRates || {})[o.name]),
  }));
  const otherImp = others.reduce((s, o) => s + o.imp, 0);
  const otherAmount = others.reduce((s, o) => s + o.amount, 0);

  const totalClick = a4Imp + a3Imp * 2 + otherImp; // CHANGED (+ otherImp)
  const a3Amount = a3Bill * num(e.a3Rate);
  const a4Amount = a4Bill * num(e.a4Rate);
  const total = a3Amount + a4Amount + otherAmount; // CHANGED (+ otherAmount)
  const discountAmt = (total * num(e.discount)) / 100;
  const taxable = total - discountAmt;
  const taxAmt = {};
  Object.keys(e.taxes || {}).forEach((k) => {
    taxAmt[k] = (taxable * num(e.taxes[k])) / 100;
  });
  const gstAmt = Object.keys(taxAmt).length
    ? Object.values(taxAmt).reduce((s, v) => s + v, 0)
    : (taxable * num(e.gst)) / 100;
  return { a3Imp, a4Imp, a3Bill, a4Bill, totalClick, a3Amount, a4Amount, total, discountAmt, gstAmt, taxAmt, totalWithGst: taxable + gstAmt, others }; // NEW: others
};

export default function ClickReport() {
  const [month, setMonth] = useState(thisMonth());
  const [entries, setEntries] = useState([newEntry()]);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [machines, setMachines] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [paperSizes, setPaperSizes] = useState([]);
  const [gstTaxes, setGstTaxes] = useState([]);

  /* ---- saved records: server-side pagination / filters / totals ---- */
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [serverSummary, setSummary] = useState(EMPTY_SUMMARY);
  const [recordMachines, setRecordMachines] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState({ month: "", machine: "", printer: "" });
  const [printerQ, setPrinterQ] = useState(""); // debounced printer text sent to the server

  const recReq = useRef(0); // ignore out-of-date list responses
  const sumReq = useRef(0); // ignore out-of-date summary responses

  const loadMasters = async () => {
    try {
      const [m, p, ps, g] = await Promise.all([
        axios.get(`${MASTER_API}/machines`, cfg()),
        axios.get(`${MASTER_API}/printers`, cfg()),
        axios.get(`${MASTER_API}/paper-sizes`, cfg()),
        axios.get(`${MASTER_API}/gst/machine-taxes`, cfg()).catch(() => ({ data: [] })),
      ]);
      setMachines(m.data); setPrinters(p.data); setPaperSizes(ps.data); setGstTaxes(g.data);
    } catch {
      toast.error("Could not load machines / printers / paper sizes");
    }
  };

  const filterParams = () => ({
    ...(filter.month ? { month: filter.month } : {}),
    ...(filter.machine ? { machine: filter.machine } : {}),
    ...(printerQ ? { printer: printerQ } : {}),
  });

  const loadRecords = async () => {
    const id = ++recReq.current;
    setLoadingRecords(true);
    try {
      const res = await axios.get(REPORT_API, {
        ...cfg(),
        params: { page, limit: pageSize, ...filterParams() },
      });
      if (id !== recReq.current) return;
      const { data, total: t } = res.data;
      setRecords(data);
      setTotal(t);
      // page no longer exists (e.g. last row of last page deleted) -> go to last page
      if (data.length === 0 && page > 1 && t > 0) setPage(Math.max(1, Math.ceil(t / pageSize)));
    } catch {
      if (id === recReq.current) toast.error("Could not load saved records");
    } finally {
      if (id === recReq.current) setLoadingRecords(false);
    }
  };

  const loadSummary = async () => {
    const id = ++sumReq.current;
    try {
      const res = await axios.get(`${REPORT_API}/summary`, { ...cfg(), params: filterParams() });
      if (id === sumReq.current) setSummary({ ...EMPTY_SUMMARY, ...res.data });
    } catch {
      /* totals are non-critical */
    }
  };

  const loadRecordMachines = async () => {
    try {
      const res = await axios.get(`${REPORT_API}/machines`, cfg());
      setRecordMachines(res.data);
    } catch {
      /* dropdown is non-critical */
    }
  };

  const reloadAll = () => {
    loadRecords();
    loadSummary();
    loadRecordMachines();
  };

  useEffect(() => {
    loadMasters();
    loadRecordMachines();
  }, []);

  // debounce the printer text box so we don't hit the server on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      const v = filter.printer.trim();
      setPrinterQ((prev) => {
        if (prev !== v) setPage(1);
        return v;
      });
    }, 400);
    return () => clearTimeout(t);
  }, [filter.printer]);

  // list reloads whenever the page, page size or a filter changes
  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filter.month, filter.machine, printerQ]);

  // totals reload only when a filter changes
  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.month, filter.machine, printerQ]);

  const machineNames = machines.map((m) => m.machineName);
  const printerNamesFor = (machine) => printers.find((p) => p.machineName === machine)?.printerNames || [];

  const calcs = useMemo(() => entries.map(entryCalc), [entries]);

  // Footer totals: recalculated from the saved readings of the records on this page
  const summary = useMemo(() => {
    const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
    const s = {
      a3Impression: 0, a4Impression: 0, totalClick: 0, a3Billable: 0, a4Billable: 0,
      a3Amount: 0, a4Amount: 0, totalAmount: 0, discountAmount: 0, totalWithGst: 0,
      otherImpression: 0, otherBillable: 0, otherAmount: 0, // NEW
    };
    records.forEach((r) => {
      const c = entryCalc(fromRecord({ ...r, rows: r.rows || [] }));
      s.a3Impression += c.a3Imp;
      s.a4Impression += c.a4Imp;
      s.totalClick += c.totalClick;
      s.a3Billable += r2(c.a3Bill);
      s.a4Billable += r2(c.a4Bill);
      s.a3Amount += r2(c.a3Amount);
      s.a4Amount += r2(c.a4Amount);
      s.totalAmount += r2(c.total);
      s.discountAmount += r2(c.discountAmt);
      s.totalWithGst += r2(c.totalWithGst);
      // NEW: other paper sizes
      (c.others || []).forEach((o) => {
        s.otherImpression += o.imp;
        s.otherBillable += r2(o.bill);
        s.otherAmount += r2(o.amount);
      });
    });
    return s;
  }, [records]);

  const grand = useMemo(
    () => calcs.reduce((g, c) => ({ click: g.click + c.totalClick, total: g.total + c.total, withGst: g.withGst + c.totalWithGst }), { click: 0, total: 0, withGst: 0 }),
    [calcs]
  );

  /* ---------- Form updates ---------- */
  const updateEntry = (id, patch) => setEntries((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const updateRow = (entryId, rowId, patch) =>
    setEntries((l) => l.map((e) => (e.id === entryId ? { ...e, rows: e.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : e)));

  // Paper-size master entry for a Riso row (used for the rate).
  // Non Std(L) / Non Std(S) use their own master entry if present, else A3 / A4.
  const risoPaperFor = (type) => {
    const norm = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();
    const look = (name) => paperSizes.find((p) => norm(p.name) === norm(name));
    const g = risoGroup(type);
    return look(type) || look(g === "NL" ? "A3" : g === "NS" ? "A4" : type);
  };

  const changeInputType = (entryId, rowId, type) => {
    const group = typeGroup(type);
    const lookup = String(type === TOTAL_TYPE ? "A4" : type).trim().toUpperCase();
    const ps = paperSizes.find((p) => String(p.name).trim().toUpperCase() === lookup);
    setEntries((l) =>
      l.map((e) => {
        if (e.id !== entryId) return e;

        // RISO: no wastage; rate comes from the paper-size master
        if (isRiso(e.machine)) {
          const rp = risoPaperFor(type);
          const rg = risoGroup(type);
          const rKey = rg === "A3" || rg === "NL" ? "a3Rate" : "a4Rate";
          const rRate = rp && Number(rp.rate) > 0 ? { [rKey]: rp.rate } : {};
          return {
            ...e,
            rows: e.rows.map((r) => (r.id === rowId ? { ...r, inputType: type, wastage: "0" } : r)),
            ...rRate,
          };
        }

        const rows = e.rows.map((r) =>
          r.id === rowId ? { ...r, inputType: type, ...(ps ? { wastage: ps.wastage ?? 0 } : {}) } : r
        );
        const rateKey = group === "A3" ? "a3Rate" : "a4Rate";
        // CHANGED: other sizes put their master rate in otherRates (does not overwrite the A4 rate)
        const fillRate = ps && Number(ps.rate) > 0
          ? (isOtherType(type)
              ? { otherRates: { ...(e.otherRates || {}), [String(type).trim()]: ps.rate } }
              : { [rateKey]: ps.rate })
          : {};
        return { ...e, rows, ...fillRate };
      })
    );
  };

  // Taxes set for a machine in the GST Master: [{ name, rate }]
  const taxesFor = (machineName) => {
    const m = machines.find((x) => x.machineName === machineName);
    const rec = gstTaxes.find(
      (g) =>
        (m && String(g.machineId?._id ?? g.machineId) === String(m._id)) ||
        g.machineName === machineName
    );
    return (rec?.taxes || []).filter((t) => t.name).map((t) => ({ name: t.name, rate: Number(t.rate) || 0 }));
  };

  const totalOf = (taxes) => Object.values(taxes).reduce((s, v) => s + num(v), 0);

  const changeMachine = (entryId, machine) => {
    const taxes = Object.fromEntries(taxesFor(machine).map((t) => [t.name, t.rate]));
    setEntries((l) =>
      l.map((e) => {
        if (e.id !== entryId) return e;
        const base = { ...e, machine, printer: "", taxes, gst: totalOf(taxes) };

        // RISO selected: A3 / A4 / Non Std(L) / Non Std(S) rows; rates from the paper-size master
        if (isRiso(machine)) {
          return {
            ...base,
            rows: RISO_TYPES.map((t) => ({ ...newRow(t), wastage: "0" })),
            a3Rate: risoPaperFor("A3")?.rate ?? "",   // rates from the paper-size master
            a4Rate: risoPaperFor("A4")?.rate ?? "",
            // taxes / gst come from the GST master (set in `base` above)
          };
        }
        // switching away from RISO: clear the Riso-specific rows / rates
        if (isRiso(e.machine)) return { ...base, rows: [newRow()], a3Rate: "", a4Rate: "" };

        return base;
      })
    );
  };

  const changeTaxRate = (entryId, name, val) =>
    setEntries((l) =>
      l.map((e) => {
        if (e.id !== entryId) return e;
        const taxes = { ...(e.taxes || {}), [name]: val };
        return { ...e, taxes, gst: totalOf(taxes) };
      })
    );

  const addRow = (entryId) => setEntries((l) => l.map((e) => (e.id === entryId ? { ...e, rows: [...e.rows, newRow()] } : e)));
  const removeRow = (entryId, rowId) =>
    setEntries((l) => l.map((e) => (e.id === entryId && e.rows.length > 1 ? { ...e, rows: e.rows.filter((r) => r.id !== rowId) } : e)));
  const removeEntry = (id) => setEntries((l) => (l.length > 1 ? l.filter((e) => e.id !== id) : l));

  const resetForm = () => {
    setMonth(thisMonth());
    setEntries([newEntry()]);
    setEditingId(null);
  };

  /* ---------- Save / edit / delete ---------- */
  const toPayload = (e) => ({
    ...e,
    taxes: Object.keys(e.taxes || {}).map((k) => ({ name: k, rate: num(e.taxes[k]) })),
    // NEW: the rate of an "other" paper size is saved on its own row
    rows: e.rows.map((r) =>
      isOtherType(r.inputType)
        ? { ...r, rate: num((e.otherRates || {})[String(r.inputType).trim()]) }
        : r
    ),
  });

  const saveReport = async () => {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e.machine) return toast.error(`Select a machine${entries.length > 1 ? ` for entry ${i + 1}` : ""}`);
      if (!e.rows.some((r) => r.inputType && r.end !== "")) return toast.error(`Add at least one reading${entries.length > 1 ? ` for entry ${i + 1}` : ""}`);
    }
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`${REPORT_API}/${editingId}`, { month, entry: toPayload(entries[0]) }, cfg());
        toast.success("Record updated");
      } else {
        await axios.post(REPORT_API, { month, entries: entries.map(toPayload) }, cfg());
        toast.success(`${entries.length} record${entries.length > 1 ? "s" : ""} saved`);
      }
      resetForm();
      reloadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (rec) => {
    setMonth(rec.month);
    setEntries([fromRecord(rec)]);
    setEditingId(rec._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteRecord = async (rec) => {
    if (!window.confirm(`Delete ${rec.machine} (${rec.month})?`)) return;
    try {
      await axios.delete(`${REPORT_API}/${rec._id}`, cfg());
      toast.success("Record deleted");
      if (editingId === rec._id) resetForm();
      reloadAll();
    } catch {
      toast.error("Delete failed");
    }
  };

  /* ---------- Records: filters ---------- */
  const filterActive = filter.month || filter.machine || filter.printer;
  const changeFilter = (patch) => {
    setFilter((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilter({ month: "", machine: "", printer: "" });
    setPrinterQ("");
    setPage(1);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  /* ---------- Excel export ---------- */
  const exportExcel = async () => {
    if (!total) return toast.error("No records to export");
    setExporting(true);
    try {
      // fetch every record for the current filters, in chunks
      const all = [];
      for (let p = 1; all.length < Math.min(total, EXPORT_LIMIT); p++) {
        const res = await axios.get(REPORT_API, {
          ...cfg(),
          params: { page: p, limit: 200, ...filterParams() },
        });
        const batch = res.data.data || [];
        if (!batch.length) break;
        all.push(...batch);
      }

      // build rows with the SAME calculation the table uses
      const r2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
      const join = (rows, fn) => rows.map(fn).join(" / ");
      const sum = { a3Imp: 0, a4Imp: 0, click: 0, a3Bill: 0, a4Bill: 0, a3Amt: 0, a4Amt: 0, total: 0, disc: 0, withGst: 0, otImp: 0, otBill: 0, otAmt: 0 };

      const data = all.map((r) => {
        const rows = r.rows || [];
        const c = entryCalc(fromRecord({ ...r, rows }));
        sum.a3Imp += c.a3Imp; sum.a4Imp += c.a4Imp; sum.click += c.totalClick;
        sum.a3Bill += r2(c.a3Bill); sum.a4Bill += r2(c.a4Bill);
        sum.a3Amt += r2(c.a3Amount); sum.a4Amt += r2(c.a4Amount);
        sum.total += r2(c.total); sum.disc += r2(c.discountAmt); sum.withGst += r2(c.totalWithGst);
        // NEW: other paper sizes
        const oth = c.others || [];
        const otImp = oth.reduce((t, o) => t + o.imp, 0);
        const otBill = oth.reduce((t, o) => t + r2(o.bill), 0);
        const otAmt = oth.reduce((t, o) => t + r2(o.amount), 0);
        sum.otImp += otImp; sum.otBill += otBill; sum.otAmt += otAmt;

        const row = {
          "Month": r.month,
          "Machine": r.machine,
          "Printer": r.printer || "",
          "Input Type": join(rows, (x) => x.inputType || "—"),
          "Meter Start": join(rows, (x) => fmt(x.start)),
          "Meter End": join(rows, (x) => fmt(x.end)),
          "Impression": join(rows, (x) => fmt(rowCalc(x).impression)),
          "Wastage %": join(rows, (x) => `${x.wastage ?? 0}%`),
          "A3 Impression": c.a3Imp,
          "A4 Impression": c.a4Imp,
          "Total Clicks": c.totalClick,
          "A3 After Wastage": r2(c.a3Bill),
          "A4 After Wastage": r2(c.a4Bill),
          "A3 Rate": num(r.a3Rate),
          "A4 Rate": num(r.a4Rate),
          "A3 Amount": r2(c.a3Amount),
          "A4 Amount": r2(c.a4Amount),
          "Other Size": oth.map((o) => o.name).join(" / "),
          "Other Impression": otImp,
          "Other After Wastage": r2(otBill),
          "Other Rate": oth.map((o) => o.rate).join(" / "),
          "Other Amount": r2(otAmt),
          "Total Amount": r2(c.total),
          "Disc %": num(r.discount),
          "Disc Amount": r2(c.discountAmt),
        };
        TAX_NAMES.forEach((n) => {
          const t = taxOf(r, n);
          row[n] = t ? `${t.rate}%` : "";
        });
        row["Total + GST"] = r2(c.totalWithGst);
        return row;
      });

      // totals row
      const totals = Object.fromEntries(Object.keys(data[0] || {}).map((k) => [k, ""]));
      totals["Month"] = `TOTAL (${all.length} records)`;
      totals["A3 Impression"] = sum.a3Imp;
      totals["A4 Impression"] = sum.a4Imp;
      totals["Total Clicks"] = sum.click;
      totals["A3 After Wastage"] = r2(sum.a3Bill);
      totals["A4 After Wastage"] = r2(sum.a4Bill);
      totals["A3 Amount"] = r2(sum.a3Amt);
      totals["A4 Amount"] = r2(sum.a4Amt);
      totals["Other Impression"] = sum.otImp;
      totals["Other After Wastage"] = r2(sum.otBill);
      totals["Other Amount"] = r2(sum.otAmt);
      totals["Total Amount"] = r2(sum.total);
      totals["Disc Amount"] = r2(sum.disc);
      totals["Total + GST"] = r2(sum.withGst);
      data.push(totals);

      // write the file
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = Object.keys(data[0]).map((k) => ({ wch: Math.max(k.length + 2, 14) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Click Report");
      XLSX.writeFile(wb, `Click_Report_${filter.month || "All"}.xlsx`);
      if (total > EXPORT_LIMIT) {
        toast.success(`Excel downloaded (first ${fmt(EXPORT_LIMIT)} records — narrow the filters for the rest)`);
      } else {
        toast.success("Excel downloaded");
      }
    } catch {
      toast.error("Excel export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="planner-dashboard-root">
      {/* ========================================================================= */}
      {/* SCOPED ENTERPRISE TEAL / ORANGE THEME (same as Planner Dashboard)         */}
      {/* ========================================================================= */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');

        /* ---------- Theme tokens ---------- */
        .planner-dashboard-root {
          --brand: #e4572e;
          --brand-dark: #c9461f;
          --brand-soft: #fdeee8;
          --teal: #0b3a45;
          --teal-mid: #0f5560;
          --teal-soft: #e3f1f4;
          --ink: #000000;
          --ink-soft: #000000;
          --ink-mute: #000000;
          --line: #e3e7ec;
          --line-soft: #eef1f4;
          --field-line: #cfd6de;
          --surface: #ffffff;
          --page: #f4f6f8;
          --ok: #1f9d6b;
          --warn: #d98a00;
          --danger: #d64545;
        }

        .planner-dashboard-root {
          background: var(--page);
          min-height: 100vh;
          padding: 24px 28px 40px;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
          font-size: 12.5px;
          color: #000000;
          box-sizing: border-box;
        }
        .planner-dashboard-root *, .planner-dashboard-root *::before, .planner-dashboard-root *::after { box-sizing: border-box; }

        .planner-container-3d {
          max-width: 100%;
          margin: 0 auto;
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0;
          box-shadow: none;
        }

        .planner-dashboard-root h1,
        .planner-dashboard-root h4,
        .planner-dashboard-root h5,
        .planner-dashboard-root h6 {
          color: #000000;
          font-weight: 700;
          letter-spacing: -0.1px;
          margin: 0;
        }
        .planner-dashboard-root h1,
        .planner-dashboard-root h4 { font-size: 16px; }
        .planner-dashboard-root h5 { font-size: 14px; }
        .planner-dashboard-root small { font-size: 11.5px; color: #000000; font-weight: 600; }

        /* scrollbars */
        .planner-dashboard-root .scrollable-table-container::-webkit-scrollbar { height: 8px; width: 8px; }
        .planner-dashboard-root .scrollable-table-container::-webkit-scrollbar-thumb { background: #c5ccd5; border-radius: 8px; }
        .planner-dashboard-root .scrollable-table-container::-webkit-scrollbar-track { background: #f1f3f6; }

        /* ---------- Cards ---------- */
        .card-glass-3d {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
          overflow: visible;
          position: relative;
        }

        /* ---------- Buttons (flat, light colours, black text) ---------- */
        .btn-3d {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: inherit;
          font-weight: 600;
          border-radius: 6px;
          padding: 6px 13px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          font-size: 12px;
          border: 1px solid transparent;
          line-height: 1.3;
          white-space: nowrap;
          color: #000000;
          box-shadow: none;
        }
        .btn-3d svg { width: 14px; height: 14px; }
        .btn-3d:active { transform: translateY(1px) !important; }
        .btn-3d:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

        .btn-3d-primary { background: #fde3d8; border-color: #f5b9a1; color: #000000; }
        .btn-3d-primary:hover:not(:disabled) { background: #fbd0bf; border-color: #f0a48a; color: #000000; }

        .btn-3d-success { background: #d9f2e6; border-color: #a9dcc3; color: #000000; }
        .btn-3d-success:hover:not(:disabled) { background: #c5ebd6; border-color: #8fceb0; color: #000000; }

        .btn-3d-warning { background: #fff7e6; border-color: #f2d291; color: #000000; }
        .btn-3d-warning:hover:not(:disabled) { background: #ffecc2; color: #000000; }

        .btn-3d-danger { background: #fdecec; border-color: #f3c1c1; color: #000000; }
        .btn-3d-danger:hover:not(:disabled) { background: #f9d4d4; color: #000000; }

        .btn-3d-info { background: #e8f3f6; border-color: #b9d6dd; color: #000000; }
        .btn-3d-info:hover:not(:disabled) { background: #d5e9ee; border-color: #a9cdd6; color: #000000; }

        .btn-3d-dark { background: #d5e9ee; border-color: #a9cdd6; color: #000000; }
        .btn-3d-dark:hover:not(:disabled) { background: #c3dde4; border-color: #93bfca; color: #000000; }

        .btn-3d-secondary { background: #ffffff; border-color: var(--field-line); color: #000000; }
        .btn-3d-secondary:hover:not(:disabled) { background: var(--page); color: #000000; }

        /* ---------- Plain inputs used inside tables / pager ---------- */
        .cell-input {
          width: 100%;
          height: 32px;
          padding: 0 10px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 500;
          color: #000000;
          background: #ffffff;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          outline: none;
          box-shadow: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .cell-input:focus {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }
        .cell-input:disabled { opacity: 0.7; cursor: not-allowed; background: #f7f9fb; }

        /* ---------- Outlined floating-label fields (same as Planner Dashboard) ---------- */
        .planner-dashboard-root .po-field {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 36px;
          background: #ffffff;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .planner-dashboard-root .po-field:focus-within {
          border-color: var(--teal-mid);
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15);
        }
        .planner-dashboard-root .po-field-icon {
          position: absolute;
          left: 10px;
          color: #000000;
          font-size: 0.8rem;
          pointer-events: none;
        }
        .planner-dashboard-root .po-field .po-input {
          width: 100%;
          min-height: 34px;
          padding: 6px 8px 6px 32px;
          border: none !important;
          outline: none;
          background: transparent !important;
          box-shadow: none !important;
          color: #000000;
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 500;
          border-radius: 6px;
        }
        .planner-dashboard-root .po-field .po-input[readonly] { background: #f7f9fb !important; }
        .planner-dashboard-root .po-field select.po-input {
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          padding-right: 28px;
        }
        .planner-dashboard-root .po-field select.po-input:disabled { cursor: not-allowed; opacity: 0.7; }
        .planner-dashboard-root .po-field .po-input:disabled { cursor: not-allowed; opacity: 0.7; }
        .planner-dashboard-root .po-caret {
          position: absolute;
          right: 10px;
          font-size: 0.7rem;
          color: #000000;
          pointer-events: none;
        }
        .planner-dashboard-root .po-field-label {
          position: absolute;
          left: 32px;
          top: 50%;
          transform: translateY(-50%);
          padding: 0 4px;
          margin: 0;
          background: #ffffff;
          color: #000000;
          font-size: 0.8rem;
          font-weight: 500;
          pointer-events: none;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .planner-dashboard-root .po-field:focus-within .po-field-label,
        .planner-dashboard-root .po-field.is-floated .po-field-label {
          top: 0;
          left: 24px;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: #000000;
        }
        .planner-dashboard-root .po-req { color: var(--danger); }

        /* ---------- Data tables (light teal headers, zebra rows, orange hover) ---------- */
        .scrollable-table-container {
          border-radius: 8px;
          overflow-x: auto;
          overflow-y: auto;
          max-height: 560px;
          border: 1px solid var(--line);
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
          background: #ffffff;
        }
        .table-modern {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin-bottom: 0;
          white-space: nowrap;
        }
        .table-modern thead th {
          background: #a9d0d9 !important;
          color: #000000 !important;
          font-weight: 700 !important;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 9px 10px;
          border: 1px solid #8fbcc7 !important;
          position: sticky;
          top: 0;
          z-index: 5;
          text-align: center;
          white-space: nowrap;
        }
        .table-modern thead th.r { text-align: right; }
        .table-modern tbody td {
          padding: 7px 10px;
          border: 1px solid var(--line-soft);
          color: #000000;
          font-weight: 500;
          vertical-align: middle;
          transition: background 0.15s ease;
        }
        .table-modern tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
        .table-modern tbody tr:nth-child(even) td { background: #fafbfc; }
        .table-modern tbody tr:hover td { background-color: var(--brand-soft) !important; }
        .table-modern tfoot td {
          background: var(--teal-soft) !important;
          color: #000000 !important;
          font-weight: 700;
          padding: 9px 10px;
          border: 1px solid #bdd9df;
        }
        .table-modern tfoot td.r { text-align: right; }
        .cr-dash { color: #000000; opacity: 0.55; }

        /* ---------- Section headings (orange left bar) ---------- */
        .pl-section-title {
          display: flex; align-items: center; gap: 7px;
          margin: 2px 0 10px; padding-left: 8px;
          border-left: 3px solid var(--brand);
          font-size: 13px; font-weight: 700; color: #000000;
          letter-spacing: 0.2px;
        }

        /* ---------- Panels ---------- */
        .cr-panel {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 14px;
        }

        /* ---------- Machine card head ---------- */
        .cr-card-head {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--line);
          border-radius: 8px 8px 0 0;
          background: #ffffff;
        }
        .cr-head-left { display: flex; align-items: center; gap: 12px; }
        .cr-head-right { display: flex; align-items: center; gap: 10px; }
        .wo-icon {
          width: 36px; height: 36px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: var(--brand-soft);
          color: var(--brand);
          border: 1px solid #f7d3c6;
        }
        .wo-title { margin: 0; font-size: 15px; font-weight: 700; color: #000000; letter-spacing: -0.1px; }
        .wo-sub { font-size: 11.5px; color: #000000; }
        .cr-fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }

        /* ---------- KPI tiles ---------- */
        .kpi-tile-3d {
          background: #fafbfc;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid var(--line-soft);
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1px;
          min-width: 0;
        }
        .kpi-tile-3d.kpi-input { background: #ffffff; }
        .kpi-tile-label { font-size: 10px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 0.4px; }
        .kpi-tile-value { font-size: 14px; font-weight: 700; color: #000000; font-variant-numeric: tabular-nums; }
        .kpi-tile-sub { font-size: 10.5px; color: #000000; font-weight: 600; }

        .grand-total-dock {
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .grand-total-tile { display: flex; flex-direction: column; align-items: flex-end; }
        .grand-total-lbl { font-size: 10px; font-weight: 700; color: #000000; text-transform: uppercase; letter-spacing: 0.4px; }
        .grand-total-val { font-size: 18px; font-weight: 700; color: #000000; }
        .grand-total-sep { width: 1px; height: 36px; background: var(--line); }

        /* ---------- Badges ---------- */
        .badge-3d {
          display: inline-flex; align-items: center;
          padding: 3px 8px; border-radius: 4px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.2px;
          color: #000000; box-shadow: none;
        }
        .badge-3d-success { background: #e4f6ee; border: 1px solid #b7e4d0; }
        .badge-3d-primary { background: var(--teal-soft); border: 1px solid #bdd9df; }
        .badge-3d-warning { background: #fff3d6; border: 1px solid #f2d291; }

        /* ---------- Toolbar ---------- */
        .premium-toolbar {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 14px;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }
        .premium-toolbar.cr-tight {
          display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
        }
        .cr-tsep { width: 1px; height: 24px; background: var(--line); margin: 0 2px; }

        /* ---------- Ledger heading ---------- */
        .cr-ledger-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .cr-ledger-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }

        /* ---------- Pager ---------- */
        .cr-pager {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 12px;
          padding: 8px 12px;
          background: #ffffff;
          border: 1px solid var(--line);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #000000;
        }
        .cr-pager-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

        /* ---------- Invoice month (top right) ---------- */
        .cr-month-left {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        @media (max-width: 1000px) {
          .cr-month-left { position: static; transform: none; justify-content: center; margin-bottom: 12px; }
        }
        @media (max-width: 768px) {
          .planner-dashboard-root { padding: 14px; }
        }

        .cr-spinner-3d {
          display: inline-block;
          width: 13px; height: 13px;
          border: 2px solid rgba(0, 0, 0, 0.25);
          border-top-color: #000000;
          border-radius: 50%;
          animation: crSpin 0.6s linear infinite;
        }
        @keyframes crSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="planner-container-3d">
        {/* 2. MACHINE ENTRY CARDS */}
        {entries.map((e, i) => {
          const c = calcs[i];
          const taxKeys = Object.keys(e.taxes || {});
          const riso = isRiso(e.machine);
          return (
            <div
              key={e.id}
              className="card-glass-3d"
              style={{ marginBottom: "22px", padding: 0 }}
            >
              <div className="cr-card-head">
                <div className="cr-head-left">
                  <div className="wo-icon"><Icons.Printer /></div>
                  <div>
                    <h5 className="wo-title">Machine Unit #{i + 1}</h5>
                    <div className="wo-sub">Meter indexing and reading specifications</div>
                  </div>
                </div>

                <div className="cr-head-right">
                  <span className="badge-3d badge-3d-warning">Unit #{i + 1}</span>
                  {i === 0 && (
                    <>
                      <PoField style={{ width: "200px" }} icon="bi-calendar-month" label="Invoice Month" alwaysFloat>
                        <input
                          type="month"
                          className="po-input"
                          value={month}
                          onChange={(ev) => setMonth(ev.target.value)}
                        />
                      </PoField>
                      {editingId && (
                        <button className="btn-3d btn-3d-secondary" onClick={resetForm}>
                          ✕ Cancel Edit
                        </button>
                      )}
                    </>
                  )}
                  {!editingId && entries.length > 1 && (
                    <button
                      className="btn-3d btn-3d-danger"
                      style={{ padding: "4px 12px", fontSize: "11.5px" }}
                      onClick={() => removeEntry(e.id)}
                    >
                      <Icons.Trash /> Remove Unit
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: "16px" }}>
                {/* Machine selection */}
                <div className="cr-panel">
                  <div className="cr-fields">
                    <PoField icon="bi-printer" label="Select Machine" required alwaysFloat caret>
                      <select
                        className="po-input"
                        value={e.machine}
                        onChange={(ev) => changeMachine(e.id, ev.target.value)}
                      >
                        <option value="">Select Machine Profile…</option>
                        {machineNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </PoField>

                    <PoField icon="bi-printer-fill" label="Printer Name" alwaysFloat caret>
                      <select
                        className="po-input"
                        value={e.printer}
                        disabled={!e.machine}
                        onChange={(ev) => updateEntry(e.id, { printer: ev.target.value })}
                      >
                        <option value="">{e.machine ? "Select Printer…" : "Awaiting Machine Selection"}</option>
                        {printerNamesFor(e.machine).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </PoField>
                  </div>
                </div>

                {/* Readings table */}
                <div className="cr-panel">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <div className="pl-section-title" style={{ margin: 0 }}>
                      Meter Production Readings
                    </div>
                    <button
                      type="button"
                      className="btn-3d btn-3d-dark"
                      style={{ padding: "4px 12px", fontSize: "11.5px" }}
                      onClick={() => addRow(e.id)}
                    >
                      <Icons.Plus /> Add Reading Track
                    </button>
                  </div>

                  <div className="scrollable-table-container">
                    <table className="table-modern">
                      <thead>
                        <tr>
                          <th>Stock / Input Type</th>
                          <th>Meter Start Reading</th>
                          <th>Meter End Reading</th>
                          <th className="r">Impression Delta</th>
                          <th>Wastage %</th>
                          <th style={{ width: "45px", textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.rows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <select
                                className="cell-input"
                                value={r.inputType}
                                onChange={(ev) => changeInputType(e.id, r.id, ev.target.value)}
                              >
                                <option value="">Select paper…</option>
                                {(riso ? RISO_TYPES.map((n) => ({ name: n })) : paperSizes).map((ps) => (
                                  <option key={ps._id || ps.name} value={ps.name}>{ps.name}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="cell-input"
                                type="number" min="0" placeholder="0"
                                value={r.start}
                                onChange={(ev) => updateRow(e.id, r.id, { start: ev.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="cell-input"
                                type="number" min="0" placeholder="0"
                                value={r.end}
                                onChange={(ev) => updateRow(e.id, r.id, { end: ev.target.value })}
                              />
                            </td>
                            <td className="r" style={{ fontWeight: 700, fontSize: "12.5px" }}>
                              {fmt(rowCalc(r).impression)}
                            </td>
                            <td>
                              <input
                                className="cell-input"
                                type="number" min="0" max="100" step="0.1" placeholder="0.0"
                                value={r.wastage}
                                disabled={riso}
                                onChange={(ev) => updateRow(e.id, r.id, { wastage: ev.target.value })}
                              />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                className="btn-3d btn-3d-danger"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                disabled={e.rows.length === 1}
                                onClick={() => removeRow(e.id, r.id)}
                                title="Remove row"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {c.a4Imp < 0 && (
                    <div style={{ marginTop: "12px", padding: "9px 14px", background: "#fdecec", borderLeft: "4px solid #d64545", borderRadius: "6px", color: "#000000", fontSize: "12px", fontWeight: 600 }}>
                      ⚠️ Negative A4 impression computed. Ensure Total meter counter is not lower than A3 readings.
                    </div>
                  )}
                </div>

                {/* Billing summary */}
                <div className="cr-panel cr-fin" style={{ marginBottom: 0 }}>
                  <div className="pl-section-title">
                    Financial Realization &amp; Rate Metrics
                  </div>

                  {/* A3 */}
                  <div style={rowWrap}>
                    <div style={rowBadge}>A3</div>
                    <div style={rowGrid}>
                      <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #0f5560" }}>
                        <span className="kpi-tile-label">Impression</span>
                        <span className="kpi-tile-value">{fmt(c.a3Imp)}</span>
                        <span className="kpi-tile-sub">Billable: {money(c.a3Bill)}</span>
                      </div>
                      <div className="kpi-tile-3d kpi-input" style={{ borderLeft: "4px solid #8a94a3" }}>
                        <PoField icon="bi-currency-rupee" label="Rate (₹)" filled={has(e.a3Rate)}>
                          <input
                            type="number" min="0" step="0.001"
                            className="po-input"
                            value={e.a3Rate} onChange={(ev) => updateEntry(e.id, { a3Rate: ev.target.value })}
                          />
                        </PoField>
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #d98a00" }}>
                        <span className="kpi-tile-label">Amount</span>
                        <span className="kpi-tile-value">₹ {money(c.a3Amount)}</span>
                        <span className="kpi-tile-sub">{money(c.a3Bill)} × {num(e.a3Rate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* A4 */}
                  <div style={rowWrap}>
                    <div style={rowBadge}>A4</div>
                    <div style={rowGrid}>
                      <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #0f5560" }}>
                        <span className="kpi-tile-label">Impression</span>
                        <span className="kpi-tile-value">{fmt(c.a4Imp)}</span>
                        <span className="kpi-tile-sub">Billable: {money(c.a4Bill)}</span>
                      </div>
                      <div className="kpi-tile-3d kpi-input" style={{ borderLeft: "4px solid #8a94a3" }}>
                        <PoField icon="bi-currency-rupee" label="Rate (₹)" filled={has(e.a4Rate)}>
                          <input
                            type="number" min="0" step="0.001"
                            className="po-input"
                            value={e.a4Rate} onChange={(ev) => updateEntry(e.id, { a4Rate: ev.target.value })}
                          />
                        </PoField>
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #d98a00" }}>
                        <span className="kpi-tile-label">Amount</span>
                        <span className="kpi-tile-value">₹ {money(c.a4Amount)}</span>
                        <span className="kpi-tile-sub">{money(c.a4Bill)} × {num(e.a4Rate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* NEW: Other paper sizes (from master) */}
                  {(c.others || []).map((o) => (
                    <div style={rowWrap} key={o.name}>
                      <div style={{ ...rowBadge, fontSize: o.name.length > 4 ? "9px" : "11px", wordBreak: "break-all", textAlign: "center", padding: "0 2px" }}>
                        {o.name}
                      </div>
                      <div style={rowGrid}>
                        <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #0f5560" }}>
                          <span className="kpi-tile-label">Impression</span>
                          <span className="kpi-tile-value">{fmt(o.imp)}</span>
                          <span className="kpi-tile-sub">Billable: {money(o.bill)} (Wastage {num(o.w)}%)</span>
                        </div>
                        <div className="kpi-tile-3d kpi-input" style={{ borderLeft: "4px solid #8a94a3" }}>
                          <PoField icon="bi-currency-rupee" label="Rate (₹)" filled={has((e.otherRates || {})[o.name])}>
                            <input
                              type="number" min="0" step="0.001"
                              className="po-input"
                              value={(e.otherRates || {})[o.name] ?? ""}
                              onChange={(ev) => updateEntry(e.id, { otherRates: { ...(e.otherRates || {}), [o.name]: ev.target.value } })}
                            />
                          </PoField>
                        </div>
                        <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #d98a00" }}>
                          <span className="kpi-tile-label">Amount</span>
                          <span className="kpi-tile-value">₹ {money(o.amount)}</span>
                          <span className="kpi-tile-sub">{money(o.bill)} × {num((e.otherRates || {})[o.name])}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div style={rowWrap}>
                    <div style={rowBadge}>Total</div>
                    <div style={rowGrid}>
                      <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #1f9d6b", background: "#e4f6ee" }}>
                        <span className="kpi-tile-label">Total Clicks</span>
                        <span className="kpi-tile-value">{fmt(c.totalClick)}</span>
                        <span className="kpi-tile-sub">Aggregated</span>
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #e4572e" }}>
                        <span className="kpi-tile-label">Base Total</span>
                        <span className="kpi-tile-value">₹ {money(c.total)}</span>
                        <span className="kpi-tile-sub">Before Taxes</span>
                      </div>
                      <div className="kpi-tile-3d kpi-input" style={{ borderLeft: "4px solid #8a94a3" }}>
                        <PoField icon="bi-percent" label="Discount %" filled={has(e.discount)}>
                          <input
                            type="number" min="0" max="100" step="0.1"
                            className="po-input"
                            value={e.discount} onChange={(ev) => updateEntry(e.id, { discount: ev.target.value })}
                          />
                        </PoField>
                      </div>
                    </div>
                  </div>

                  {/* Tax */}
                  <div style={{ ...rowWrap, marginBottom: 0 }}>
                    <div style={rowBadge}>Tax</div>
                    <div style={rowGrid}>
                      {taxKeys.length > 0 ? (
                        <>
                          {taxKeys.map((k) => (
                            <div key={k} className="kpi-tile-3d kpi-input" style={{ borderLeft: "4px solid #8a94a3" }}>
                              <PoField icon="bi-percent" label={`${k} %`} filled={has(e.taxes[k])}>
                                <input
                                  type="number" min="0" max="100" step="0.01"
                                  className="po-input"
                                  value={e.taxes[k]}
                                  onChange={(ev) => changeTaxRate(e.id, k, ev.target.value)}
                                />
                              </PoField>
                              <span className="kpi-tile-sub" style={{ marginTop: "4px" }}>₹ {money(c.taxAmt[k])}</span>
                            </div>
                          ))}
                          <div className="kpi-tile-3d" style={{ borderLeft: "4px solid #0f5560" }}>
                            <span className="kpi-tile-label">Effective GST</span>
                            <span className="kpi-tile-value">{num(e.gst)}%</span>
                            <span className="kpi-tile-sub">Rate Applied</span>
                          </div>
                        </>
                      ) : (
                        <div className="kpi-tile-3d kpi-input" style={{ borderLeft: "4px solid #8a94a3" }}>
                          <PoField icon="bi-percent" label={e.machine ? "GST Rate %" : "GST Rate % (select machine)"} filled={has(e.gst)}>
                            <input
                              type="number" min="0" max="100" step="0.01"
                              className="po-input"
                              value={e.gst}
                              disabled={!e.machine}
                              onChange={(ev) => updateEntry(e.id, { gst: ev.target.value })}
                            />
                          </PoField>
                        </div>
                      )}

                      <div
                        className="kpi-tile-3d"
                        style={{ borderLeft: "4px solid #e4572e", background: "#e3f1f4", border: "1px solid #bdd9df", borderLeftWidth: "4px", borderLeftColor: "#e4572e" }}
                      >
                        <span className="kpi-tile-label">Total With GST</span>
                        <span className="kpi-tile-value" style={{ fontSize: "17px" }}>
                          ₹ {money(c.totalWithGst)}
                        </span>
                        <span className="kpi-tile-sub">Tax: ₹ {money(c.gstAmt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* 3. COMMAND DOCK */}
        <div className="card-glass-3d" style={{ padding: "14px 20px", marginBottom: "26px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {!editingId && (
                <button
                  className="btn-3d btn-3d-primary"
                  onClick={() => setEntries((l) => [...l, newEntry()])}
                >
                  <Icons.Plus /> Add Machine Unit
                </button>
              )}
              <button className="btn-3d btn-3d-success" onClick={saveReport} disabled={saving}>
                {saving ? <span className="cr-spinner-3d" /> : <Icons.Save />}
                {saving ? "Saving…" : editingId ? "Update Record" : "Save Report"}
              </button>
            </div>

            <div className="grand-total-dock">
              <div className="grand-total-tile">
                <span className="grand-total-lbl">Total Clicks</span>
                <span className="grand-total-val">{fmt(grand.click)}</span>
              </div>
              <div className="grand-total-sep" />
              <div className="grand-total-tile">
                <span className="grand-total-lbl">Base Net Total</span>
                <span className="grand-total-val">₹ {money(grand.total)}</span>
              </div>
              <div className="grand-total-sep" />
              <div className="grand-total-tile">
                <span className="grand-total-lbl">Cumulative With GST</span>
                <span className="grand-total-val" style={{ fontSize: "20px" }}>₹ {money(grand.withGst)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. SAVED RECORDS */}
        <div className="card-glass-3d" style={{ padding: "14px 16px" }}>
          <div className="cr-ledger-head">
            <div className="cr-ledger-title">
              <div className="pl-section-title" style={{ margin: 0 }}>Saved Records Ledger</div>
              <small>Master historical print production repository</small>
            </div>
            <span className="badge-3d badge-3d-primary">
              {fmt(total)} Record{total > 1 ? "s" : ""} Found
            </span>
          </div>

          <div className="premium-toolbar cr-tight">
            <button className="btn-3d btn-3d-secondary" onClick={reloadAll} disabled={loadingRecords}>
              <Icons.Sync /> {loadingRecords ? "Synchronizing…" : "Refresh"}
            </button>
            <button className="btn-3d btn-3d-success" onClick={exportExcel} disabled={exporting}>
              {exporting ? <span className="cr-spinner-3d" /> : <Icons.Excel />}
              {exporting ? "Preparing…" : "Download Excel"}
            </button>

            <span className="cr-tsep" />

            <PoField style={{ width: "170px" }} icon="bi-calendar-month" label="Month" alwaysFloat>
              <input
                type="month"
                className="po-input"
                value={filter.month}
                onChange={(e) => changeFilter({ month: e.target.value })}
              />
            </PoField>

            <PoField style={{ width: "190px" }} icon="bi-printer" label="Machine" alwaysFloat caret>
              <select
                className="po-input"
                value={filter.machine}
                onChange={(e) => changeFilter({ machine: e.target.value })}
              >
                <option value="">All Machines</option>
                {recordMachines.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </PoField>

            <PoField style={{ width: "170px" }} icon="bi-search" label="Printer" filled={has(filter.printer)}>
              <input
                type="text"
                className="po-input"
                value={filter.printer}
                onChange={(e) => setFilter((f) => ({ ...f, printer: e.target.value }))}
              />
            </PoField>

            <button
              className="btn-3d btn-3d-dark"
              disabled={!filterActive}
              onClick={resetFilters}
            >
              <Icons.Reset /> Reset Filters
            </button>
          </div>

          {/* Records table */}
          <div className="scrollable-table-container">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Machine</th>
                  <th>Printer</th>
                  <th>Input Type</th>
                  <th className="r">Meter Start</th>
                  <th className="r">Meter End</th>
                  <th className="r">Impression</th>
                  <th className="r">Wastage %</th>
                  <th className="r">A3 Impression</th>
                  <th className="r">A4 Impression</th>
                  <th className="r">Total Clicks</th>
                  <th className="r">A3 After Wastage</th>
                  <th className="r">A4 After Wastage</th>
                  <th className="r">A3 Rate</th>
                  <th className="r">A4 Rate</th>
                  <th className="r">A3 Amount</th>
                  <th className="r">A4 Amount</th>
                  <th>Other Size</th>
                  <th className="r">Other Impression</th>
                  <th className="r">Other After Wastage</th>
                  <th className="r">Other Rate</th>
                  <th className="r">Other Amount</th>
                  <th className="r">Total Amount</th>
                  <th className="r">Disc %</th>
                  <th className="r">Disc Amount</th>
                  {TAX_NAMES.map((n) => <th key={n} className="r">{n}</th>)}
                  <th className="r">Total + GST</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <FragmentRow
                    key={r._id}
                    r={r}
                    onEdit={() => startEdit(r)}
                    onDelete={() => deleteRecord(r)}
                  />
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLS} style={{ textAlign: "center", padding: "40px", color: "#000000" }}>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>🗂️</div>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#000000" }}>
                        {loadingRecords ? "Loading historical ledger entries…" : filterActive ? "No records match criteria." : "No records saved yet."}
                      </div>
                      <small>Recorded production dispatches will appear here automatically.</small>
                    </td>
                  </tr>
                )}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={8}>
                      <span className="badge-3d badge-3d-success">
                        {fmt(records.length)} record{records.length > 1 ? "s" : ""} (this page)
                      </span>
                    </td>
                    <td className="r">{fmt(summary.a3Impression)}</td>
                    <td className="r">{fmt(summary.a4Impression)}</td>
                    <td className="r">{fmt(summary.totalClick)}</td>
                    <td className="r">{money(summary.a3Billable)}</td>
                    <td className="r">{money(summary.a4Billable)}</td>
                    <td />
                    <td />
                    <td className="r">{money(summary.a3Amount)}</td>
                    <td className="r">{money(summary.a4Amount)}</td>
                    <td />
                    <td className="r">{fmt(summary.otherImpression)}</td>
                    <td className="r">{money(summary.otherBillable)}</td>
                    <td />
                    <td className="r">{money(summary.otherAmount)}</td>
                    <td className="r">{money(summary.totalAmount)}</td>
                    <td />
                    <td className="r">{money(summary.discountAmount)}</td>
                    {TAX_NAMES.map((n) => <td key={n} />)}
                    <td className="r" style={{ fontSize: "13px" }}>
                      ₹ {money(summary.totalWithGst)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          <div className="cr-pager">
            <div className="cr-pager-group">
              <span>Rows per page:</span>
              <select
                className="cell-input"
                style={{ width: "80px", height: "30px" }}
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>Showing {fmt(from)}–{fmt(to)} of {fmt(total)}</span>
            </div>
            <div className="cr-pager-group">
              <button className="btn-3d btn-3d-dark" style={{ padding: "5px 12px" }} disabled={page <= 1 || loadingRecords} onClick={() => setPage(1)}>« First</button>
              <button className="btn-3d btn-3d-dark" style={{ padding: "5px 12px" }} disabled={page <= 1 || loadingRecords} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
              <span>Page {fmt(page)} of {fmt(pages)}</span>
              <button className="btn-3d btn-3d-dark" style={{ padding: "5px 12px" }} disabled={page >= pages || loadingRecords} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next ›</button>
              <button className="btn-3d btn-3d-dark" style={{ padding: "5px 12px" }} disabled={page >= pages || loadingRecords} onClick={() => setPage(pages)}>Last »</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Row Component (all data visible) ---------- */
function FragmentRow({ r, onEdit, onDelete }) {
  const rows = r.rows || [];
  const c = entryCalc(fromRecord({ ...r, rows }));
  const stack = (fn, align) => (
    <td className={align === "r" ? "r" : ""}>
      {rows.length ? rows.map((x, i) => <div key={i}>{fn(x)}</div>) : "—"}
    </td>
  );
  const otherCell = (fn, align) => (
    <td className={align === "r" ? "r" : ""}>
      {(c.others || []).length ? c.others.map((o) => <div key={o.name}>{fn(o)}</div>) : <span className="cr-dash">—</span>}
    </td>
  );
  return (
    <tr>
      <td style={{ fontWeight: 700 }}>
        <span className="badge-3d badge-3d-primary">{r.month}</span>
      </td>
      <td style={{ fontWeight: 700 }}>{r.machine}</td>
      <td>{r.printer || <span className="cr-dash">—</span>}</td>
      {stack((x) => x.inputType || "—")}
      {stack((x) => fmt(x.start), "r")}
      {stack((x) => fmt(x.end), "r")}
      {stack((x) => fmt(rowCalc(x).impression), "r")}
      {stack((x) => `${x.wastage ?? 0}%`, "r")}
      <td className="r">{fmt(c.a3Imp)}</td>
      <td className="r">{fmt(c.a4Imp)}</td>
      <td className="r" style={{ fontWeight: 700 }}>{fmt(c.totalClick)}</td>
      <td className="r">{money(c.a3Bill)}</td>
      <td className="r">{money(c.a4Bill)}</td>
      <td className="r">{r.a3Rate}</td>
      <td className="r">{r.a4Rate}</td>
      <td className="r">{money(c.a3Amount)}</td>
      <td className="r">{money(c.a4Amount)}</td>
      {/* NEW: other paper sizes (e.g. MICR / Non MICR) */}
      {otherCell((o) => o.name)}
      {otherCell((o) => fmt(o.imp), "r")}
      {otherCell((o) => money(o.bill), "r")}
      {otherCell((o) => o.rate, "r")}
      {otherCell((o) => money(o.amount), "r")}
      <td className="r" style={{ fontWeight: 700 }}>{money(c.total)}</td>
      <td className="r">{r.discount}</td>
      <td className="r">{money(c.discountAmt)}</td>
      {TAX_NAMES.map((n) => {
        const t = taxOf(r, n);
        return (
          <td key={n} className="r">
            {t ? `${t.rate}%` : <span className="cr-dash">—</span>}
          </td>
        );
      })}
      <td className="r" style={{ fontWeight: 700 }}>
        ₹ {money(c.totalWithGst)}
      </td>
      <td style={{ textAlign: "center" }}>
        <div style={{ display: "inline-flex", gap: "4px" }}>
          <button className="btn-3d btn-3d-warning" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={onEdit} title="Edit record">
            <Icons.Edit />
          </button>
          <button className="btn-3d btn-3d-danger" style={{ padding: "3px 8px", fontSize: "11px" }} onClick={onDelete} title="Delete record">
            <Icons.Trash />
          </button>
        </div>
      </td>
    </tr>
  );
}