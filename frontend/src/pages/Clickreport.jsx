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

/* layout styles for the billing card */
const rowWrap = { display: "flex", gap: "8px", alignItems: "stretch", marginBottom: "6px" };
const rowBadge = {
  flex: "0 0 44px", display: "flex", alignItems: "center", justifyContent: "center",
  background: "linear-gradient(180deg, #d9f1fd 0%, #a8dcf6 100%)", color: "#08406b", fontSize: "11px", fontWeight: 800,
  letterSpacing: "0.4px", textTransform: "uppercase", borderRadius: "10px",
  border: "1px solid #86c6e8",
};
const rowGrid = {
  flex: 1, display: "grid", gap: "8px", alignItems: "stretch",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};
const inputTileLbl = { fontSize: "11px", fontWeight: 700, color: "#4a6f8c", textTransform: "uppercase", letterSpacing: "0.4px" };
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
      <style>{`
        /* ---------- Page backdrop (soft sky glass) ---------- */
        .planner-dashboard-root {
          min-height: 100vh;
          padding: 18px;
          font-family: 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
          color: #0b2f4f;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 12% 6%, rgba(255, 255, 255, 0.9) 0, rgba(255, 255, 255, 0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160, 222, 250, 0.7) 0, rgba(160, 222, 250, 0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%);
          background-attachment: fixed;
        }
        .planner-container-3d {
          max-width: 100%;
          margin: 0 auto;
          background: rgba(255, 255, 255, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.9);
          border-radius: 26px;
          padding: 22px 24px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 16px 36px rgba(40, 120, 170, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        /* ---------- Glass cards ---------- */
        .card-glass-3d {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(228, 246, 255, 0.9) 100%);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          border-radius: 22px;
          box-shadow: 0 14px 32px rgba(40, 120, 170, 0.16), inset 0 1px 0 #fff;
          overflow: hidden;
          transition: all 0.25s ease;
          position: relative;
        }

        /* ---------- Soft sky buttons ---------- */
        .btn-3d {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-weight: 800;
          border-radius: 12px;
          padding: 7px 16px;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          font-size: 13px;
          border: 1px solid transparent;
          line-height: 1.3;
          white-space: nowrap;
        }
        .btn-3d:active { transform: translateY(2px) !important; }
        .btn-3d:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
        .btn-3d-primary {
          background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%); color: #08406b; border-color: #7fc3e8;
          box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40, 120, 170, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .btn-3d-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #7fbbe0, 0 10px 16px rgba(40, 120, 170, 0.24); color: #08406b; }
        .btn-3d-success {
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%); color: #07583b; border-color: #7fd3ab;
          box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20, 168, 112, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .btn-3d-success:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #84cba9, 0 10px 16px rgba(20, 168, 112, 0.24); color: #07583b; }
        .btn-3d-warning {
          background: linear-gradient(180deg, #fff0c4 0%, #fcd477 100%); color: #7a4f00; border-color: #f3c35a;
          box-shadow: 0 3px 0 #e9b845, 0 7px 12px rgba(245, 158, 11, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .btn-3d-warning:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #e9b845, 0 10px 16px rgba(245, 158, 11, 0.24); color: #7a4f00; }
        .btn-3d-danger {
          background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%); color: #8f1414; border-color: #ee8f8f;
          box-shadow: 0 3px 0 #e08a8a, 0 7px 12px rgba(220, 38, 38, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .btn-3d-danger:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #e08a8a, 0 10px 16px rgba(220, 38, 38, 0.2); color: #8f1414; }
        .btn-3d-dark {
          background: linear-gradient(180deg, #e2eff8 0%, #b3d3e8 100%); color: #0b3a5c; border-color: #98bfd8;
          box-shadow: 0 3px 0 #8fb4cc, 0 7px 12px rgba(40, 90, 130, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .btn-3d-dark:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #8fb4cc, 0 10px 16px rgba(40, 90, 130, 0.2); color: #0b3a5c; }
        .btn-3d-secondary {
          background: linear-gradient(180deg, #eef5fa 0%, #cbdce8 100%); color: #34526b; border-color: #aac3d4;
          box-shadow: 0 3px 0 #b6cbd9, 0 7px 12px rgba(93, 124, 147, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }
        .btn-3d-secondary:hover { transform: translateY(-1px); box-shadow: 0 4px 0 #b6cbd9, 0 10px 16px rgba(93, 124, 147, 0.2); color: #34526b; }

        /* ---------- Inputs ---------- */
        .input-3d {
          background: #fff;
          border: 1.5px solid #9ccbe6;
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          color: #0b2f4f;
          box-shadow: inset 0 2px 5px rgba(10, 80, 130, 0.1);
          transition: all 0.2s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .input-3d:focus { outline: none; border-color: #1b9be0; box-shadow: 0 0 0 4px rgba(27, 155, 224, 0.2), 0 6px 14px rgba(27, 155, 224, 0.12); }
        .input-3d:disabled { background: linear-gradient(180deg, #f1f7fb 0%, #dfecf5 100%); color: #4a6f8c; cursor: not-allowed; }

        /* ---------- Tables ---------- */
        .scrollable-table-container {
          border-radius: 16px;
          overflow-x: auto;
          overflow-y: auto;
          max-height: 560px;
          border: 1px solid #a9d9f2;
          box-shadow: 0 8px 20px rgba(40, 120, 170, 0.12);
          background: #fff;
        }
        .table-modern { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 0; white-space: nowrap; }
        .table-modern thead th {
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important;
          color: #08406b !important;
          font-weight: 800;
          padding: 10px 12px;
          border: 1px solid #7fbfe4;
          position: sticky;
          top: 0;
          z-index: 5;
          letter-spacing: 0.3px;
          text-align: left;
          white-space: nowrap;
        }
        .table-modern thead th.r { text-align: right; }
        .table-modern tbody td { padding: 8px 11px; border: 1px solid #d3e8f4; color: #0b2f4f; vertical-align: middle; transition: background 0.15s ease; }
        .table-modern tbody td.r { text-align: right; font-variant-numeric: tabular-nums; }
        .table-modern tbody tr:nth-child(even) td { background: #f3faff; }
        .table-modern tbody tr:hover td { background-color: #d9f2fc !important; }
        .table-modern tfoot td { background: #d9f0fb !important; color: #08406b !important; font-weight: 800; padding: 10px 12px; border: 1px solid #a9d9f2; }
        .table-modern tfoot td.r { text-align: right; }

        /* ---------- KPI tiles / dock ---------- */
        .kpi-tile-3d {
          background: linear-gradient(180deg, #ffffff 0%, #f1faff 100%);
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid #cfe8f6;
          box-shadow: 0 4px 12px rgba(40, 120, 170, 0.1), inset 0 1px 0 #fff;
          display: flex;
          flex-direction: column;
          gap: 2px;
          transition: transform 0.15s ease;
        }
        .kpi-tile-3d:hover { transform: translateY(-2px); }
        .kpi-tile-label { font-size: 10.5px; font-weight: 700; color: #4a6f8c; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-tile-value { font-size: 16px; font-weight: 800; color: #0b2f4f; font-variant-numeric: tabular-nums; }
        .kpi-tile-sub { font-size: 10.5px; color: #1b86c8; font-weight: 600; }

        .grand-total-dock {
          background: linear-gradient(180deg, #ffffff 0%, #eaf7ff 100%);
          border: 1px solid #cfe8f6;
          border-radius: 18px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          box-shadow: 0 8px 20px rgba(40, 120, 170, 0.12), inset 0 1px 0 #fff;
        }
        .grand-total-tile { display: flex; flex-direction: column; align-items: flex-end; }
        .grand-total-sep { width: 1px; height: 38px; background: #bfe0f2; }

        .badge-3d { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.3px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
        .badge-3d-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
        .badge-3d-primary { background: #d6effc; color: #08406b; border: 1px solid #86c6e8; }
        .badge-3d-warning { background: #fef3c7; color: #8a5a00; border: 1px solid #fde68a; }

        .premium-toolbar {
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 14px 16px;
          margin-bottom: 16px;
          box-shadow: 0 6px 16px rgba(40, 120, 170, 0.1), inset 0 1px 0 #fff;
        }

        .cr-pager {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 14px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          font-size: 12.5px;
          font-weight: 700;
          color: #08406b;
          box-shadow: inset 0 1px 0 #fff;
        }
        .cr-pager-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

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

        .cr-spinner-3d {
          display: inline-block;
          width: 13px; height: 13px;
          border: 2px solid rgba(7, 88, 59, 0.3);
          border-top-color: #07583b;
          border-radius: 50%;
          animation: crSpin 0.6s linear infinite;
        }
        /* ---------- Compact: Financial Realization & Rate Metrics ---------- */
        .cr-fin .kpi-tile-3d { padding: 5px 10px; gap: 0; border-radius: 10px; box-shadow: 0 2px 6px rgba(40, 120, 170, 0.08), inset 0 1px 0 #fff; }
        .cr-fin .kpi-tile-3d:hover { transform: none; }
        .cr-fin .kpi-tile-label { font-size: 9.5px; letter-spacing: 0.3px; }
        .cr-fin .kpi-tile-value { font-size: 13.5px; line-height: 1.2; }
        .cr-fin .kpi-tile-sub { font-size: 9.5px; }
        .cr-fin .input-3d { height: 28px !important; margin-top: 1px !important; padding: 3px 9px; font-size: 12px; border-radius: 9px; }
        .cr-fin .kpi-tile-3d > span:first-child { line-height: 1.2; }

        /* ---------- Compact ledger heading + toolbar (one slim bar) ---------- */
        .cr-ledger-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
        .cr-ledger-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
        .cr-ledger-title h4 { margin: 0; font-size: 16px; font-weight: 800; color: #0a4f8c; }
        .cr-ledger-title small { color: #4a6f8c; font-size: 11.5px; }
        .premium-toolbar.cr-tight {
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
          padding: 6px 10px; margin-bottom: 8px; border-radius: 12px;
        }
        .cr-tight .btn-3d { padding: 4px 12px; font-size: 12px; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12); }
        .cr-fgroup { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: #08406b; }
        .cr-tsep { width: 1px; height: 22px; background: #bfe0f2; margin: 0 2px; }

        @keyframes crSpin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="planner-container-3d">
        {/* 1. HEADER */}
        <div style={{ position: "relative", textAlign: "center", marginBottom: "18px" }}>
          <div className="cr-month-left">
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#08406b" }}>Invoice Month:</span>
            <input
              type="month"
              className="input-3d"
              style={{ width: "180px", height: "36px", fontWeight: 700 }}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            {editingId && (
              <button className="btn-3d btn-3d-secondary" onClick={resetForm}>
                ✕ Cancel Edit
              </button>
            )}
          </div>
         
          <p style={{ margin: "4px 0 0", color: "#4a6f8c", fontSize: "13.5px", fontWeight: 500 }}>
            {editingId
              ? "✏️ Editing a saved record — update parameters and save."
              : "Automatic click impressions and tax billing."}
          </p>
        </div>

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
              <div
                style={{
                  background: "linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%)",
                  borderBottom: "1px solid #86c6e8",
                  padding: "14px 20px",
                  color: "#08406b",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: "rgba(255,255,255,0.7)",
                      boxShadow: "0 2px 8px rgba(40, 120, 170, 0.18), inset 0 1px 0 #fff",
                      display: "flex", alignItems: "center", justifyContent: "center", color: "#0a6fb8",
                    }}
                  >
                    <Icons.Printer />
                  </div>
                  <div>
                    <h5 style={{ margin: 0, fontWeight: 800, fontSize: "16px", color: "#08406b" }}>
                      Machine Unit #{i + 1}
                    </h5>
                    <small style={{ color: "#2f6d96", fontSize: "11.5px" }}>
                      Meter indexing and reading specifications
                    </small>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="badge-3d badge-3d-warning">Unit #{i + 1}</span>
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
                <div
                  style={{
                    background: "linear-gradient(180deg, #ffffff 0%, #f4fbff 100%)", borderRadius: "16px", padding: "14px",
                    border: "1px solid #cfe8f6", marginBottom: "16px",
                    boxShadow: "0 4px 12px rgba(40, 120, 170, 0.08), inset 0 1px 0 #fff",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#08406b", textTransform: "uppercase", marginBottom: "5px" }}>
                        🖨️ Select Machine <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <select
                        className="input-3d"
                        style={{ height: "38px", fontWeight: 600 }}
                        value={e.machine}
                        onChange={(ev) => changeMachine(e.id, ev.target.value)}
                      >
                        <option value="">Select Machine Profile…</option>
                        {machineNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#08406b", textTransform: "uppercase", marginBottom: "5px" }}>
                        🖨 Printer Name
                      </label>
                      <select
                        className="input-3d"
                        style={{ height: "38px", fontWeight: 600 }}
                        value={e.printer}
                        disabled={!e.machine}
                        onChange={(ev) => updateEntry(e.id, { printer: ev.target.value })}
                      >
                        <option value="">{e.machine ? "Select Printer…" : "Awaiting Machine Selection"}</option>
                        {printerNamesFor(e.machine).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Readings table */}
                <div
                  style={{
                    background: "linear-gradient(180deg, #ffffff 0%, #f4fbff 100%)", borderRadius: "16px", padding: "14px",
                    border: "1px solid #cfe8f6", marginBottom: "16px",
                    boxShadow: "0 4px 12px rgba(40, 120, 170, 0.08), inset 0 1px 0 #fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#1b86c8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
                                className="input-3d"
                                style={{ height: "34px", fontSize: "12.5px" }}
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
                                className="input-3d"
                                style={{ height: "34px", fontSize: "12.5px" }}
                                type="number" min="0" placeholder="0"
                                value={r.start}
                                onChange={(ev) => updateRow(e.id, r.id, { start: ev.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="input-3d"
                                style={{ height: "34px", fontSize: "12.5px" }}
                                type="number" min="0" placeholder="0"
                                value={r.end}
                                onChange={(ev) => updateRow(e.id, r.id, { end: ev.target.value })}
                              />
                            </td>
                            <td className="r" style={{ fontWeight: 800, color: "#0a6fb8", fontSize: "13px" }}>
                              {fmt(rowCalc(r).impression)}
                            </td>
                            <td>
                              <input
                                className="input-3d"
                                style={{ height: "34px", fontSize: "12.5px" }}
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
                    <div style={{ marginTop: "12px", padding: "10px 14px", background: "#fef2f2", borderLeft: "4px solid #ef4444", borderRadius: "6px", color: "#991b1b", fontSize: "12.5px", fontWeight: 600 }}>
                      ⚠️ Negative A4 impression computed. Ensure Total meter counter is not lower than A3 readings.
                    </div>
                  )}
                </div>

                {/* Billing summary */}
                <div
                  className="cr-fin"
                  style={{
                    background: "linear-gradient(180deg, #ffffff 0%, #f4fbff 100%)", borderRadius: "14px", padding: "9px 12px 10px",
                    border: "1px solid #cfe8f6", boxShadow: "0 4px 12px rgba(40, 120, 170, 0.08), inset 0 1px 0 #fff",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#1b86c8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "7px" }}>
                    Financial Realization &amp; Rate Metrics
                  </div>

                  {/* A3 */}
                  <div style={rowWrap}>
                    <div style={rowBadge}>A3</div>
                    <div style={rowGrid}>
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #0284c7" }}>
                        <span className="kpi-tile-label">Impression</span>
                        <span className="kpi-tile-value">{fmt(c.a3Imp)}</span>
                        <span className="kpi-tile-sub">Billable: {money(c.a3Bill)}</span>
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #64748b" }}>
                        <span style={inputTileLbl}>Rate (₹)</span>
                        <input
                          type="number" min="0" step="0.001" placeholder="0.00"
                          className="input-3d" style={{ height: "38px", marginTop: "4px" }}
                          value={e.a3Rate} onChange={(ev) => updateEntry(e.id, { a3Rate: ev.target.value })}
                        />
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #f59e0b" }}>
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
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #0284c7" }}>
                        <span className="kpi-tile-label">Impression</span>
                        <span className="kpi-tile-value">{fmt(c.a4Imp)}</span>
                        <span className="kpi-tile-sub">Billable: {money(c.a4Bill)}</span>
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #64748b" }}>
                        <span style={inputTileLbl}>Rate (₹)</span>
                        <input
                          type="number" min="0" step="0.001" placeholder="0.00"
                          className="input-3d" style={{ height: "38px", marginTop: "4px" }}
                          value={e.a4Rate} onChange={(ev) => updateEntry(e.id, { a4Rate: ev.target.value })}
                        />
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #f59e0b" }}>
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
                        <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #0284c7" }}>
                          <span className="kpi-tile-label">Impression</span>
                          <span className="kpi-tile-value">{fmt(o.imp)}</span>
                          <span className="kpi-tile-sub">Billable: {money(o.bill)} (Wastage {num(o.w)}%)</span>
                        </div>
                        <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #64748b" }}>
                          <span style={inputTileLbl}>Rate (₹)</span>
                          <input
                            type="number" min="0" step="0.001" placeholder="0.00"
                            className="input-3d" style={{ height: "38px", marginTop: "4px" }}
                            value={(e.otherRates || {})[o.name] ?? ""}
                            onChange={(ev) => updateEntry(e.id, { otherRates: { ...(e.otherRates || {}), [o.name]: ev.target.value } })}
                          />
                        </div>
                        <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #f59e0b" }}>
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
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #10b981", background: "#f0fdf4" }}>
                        <span className="kpi-tile-label">Total Clicks</span>
                        <span className="kpi-tile-value" style={{ color: "#15803d" }}>{fmt(c.totalClick)}</span>
                        <span className="kpi-tile-sub" style={{ color: "#15803d" }}>Aggregated</span>
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #8b5cf6" }}>
                        <span className="kpi-tile-label">Base Total</span>
                        <span className="kpi-tile-value" style={{ color: "#6d28d9" }}>₹ {money(c.total)}</span>
                        <span className="kpi-tile-sub" style={{ color: "#6d28d9" }}>Before Taxes</span>
                      </div>
                      <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #64748b" }}>
                        <span style={inputTileLbl}>Discount %</span>
                        <input
                          type="number" min="0" max="100" step="0.1" placeholder="0.0"
                          className="input-3d" style={{ height: "38px", marginTop: "4px" }}
                          value={e.discount} onChange={(ev) => updateEntry(e.id, { discount: ev.target.value })}
                        />
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
                            <div key={k} className="kpi-tile-3d" style={{ borderLeft: "5px solid #64748b" }}>
                              <span style={inputTileLbl}>{k} %</span>
                              <input
                                type="number" min="0" max="100" step="0.01"
                                className="input-3d" style={{ height: "38px", marginTop: "4px" }}
                                value={e.taxes[k]}
                                onChange={(ev) => changeTaxRate(e.id, k, ev.target.value)}
                              />
                              <span className="kpi-tile-sub" style={{ marginTop: "4px" }}>₹ {money(c.taxAmt[k])}</span>
                            </div>
                          ))}
                          <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #06b6d4" }}>
                            <span className="kpi-tile-label">Effective GST</span>
                            <span className="kpi-tile-value">{num(e.gst)}%</span>
                            <span className="kpi-tile-sub">Rate Applied</span>
                          </div>
                        </>
                      ) : (
                        <div className="kpi-tile-3d" style={{ borderLeft: "5px solid #64748b" }}>
                          <span style={inputTileLbl}>GST Rate %</span>
                          <input
                            type="number" min="0" max="100" step="0.01"
                            className="input-3d" style={{ height: "38px", marginTop: "4px" }}
                            value={e.gst}
                            disabled={!e.machine}
                            placeholder={e.machine ? "Enter GST %" : "Select machine first"}
                            onChange={(ev) => updateEntry(e.id, { gst: ev.target.value })}
                          />
                        </div>
                      )}

                      <div
                        className="kpi-tile-3d"
                        style={{
                          borderLeft: "5px solid #0369a1",
                          background: "linear-gradient(135deg, #d6effc 0%, #bfe5f8 100%)",
                          boxShadow: "0 6px 14px rgba(40, 120, 170, 0.18)",
                        }}
                      >
                        <span className="kpi-tile-label" style={{ color: "#08406b" }}>Total With GST</span>
                        <span className="kpi-tile-value" style={{ color: "#08406b", fontSize: "19px" }}>
                          ₹ {money(c.totalWithGst)}
                        </span>
                        <span className="kpi-tile-sub" style={{ color: "#0a4f8c" }}>Tax: ₹ {money(c.gstAmt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* 3. COMMAND DOCK */}
        <div className="card-glass-3d" style={{ padding: "16px 20px", marginBottom: "26px" }}>
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
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#4a6f8c", textTransform: "uppercase" }}>Total Clicks</span>
                <span style={{ fontSize: "20px", fontWeight: 900, color: "#0b2f4f" }}>{fmt(grand.click)}</span>
              </div>
              <div className="grand-total-sep" />
              <div className="grand-total-tile">
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#4a6f8c", textTransform: "uppercase" }}>Base Net Total</span>
                <span style={{ fontSize: "20px", fontWeight: 900, color: "#0b2f4f" }}>₹ {money(grand.total)}</span>
              </div>
              <div className="grand-total-sep" />
              <div className="grand-total-tile">
                <span style={{ fontSize: "10.5px", fontWeight: 800, color: "#1b86c8", textTransform: "uppercase" }}>Cumulative With GST</span>
                <span style={{ fontSize: "22px", fontWeight: 900, color: "#0a6fb8" }}>₹ {money(grand.withGst)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. SAVED RECORDS */}
        <div className="card-glass-3d" style={{ padding: "10px 14px 12px" }}>
          <div className="cr-ledger-head">
            <div className="cr-ledger-title">
              <h4>Saved Records Ledger</h4>
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

            <div className="cr-fgroup">
              <span>Month:</span>
              <input
                type="month"
                className="input-3d"
                style={{ width: "150px", height: "30px" }}
                value={filter.month}
                onChange={(e) => changeFilter({ month: e.target.value })}
              />
            </div>

            <div className="cr-fgroup">
              <span>Machine:</span>
              <select
                className="input-3d"
                style={{ width: "160px", height: "30px" }}
                value={filter.machine}
                onChange={(e) => changeFilter({ machine: e.target.value })}
              >
                <option value="">All Machines</option>
                {recordMachines.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="cr-fgroup">
              <span>Printer:</span>
              <input
                type="text"
                placeholder="Query printer…"
                className="input-3d"
                style={{ width: "150px", height: "30px" }}
                value={filter.printer}
                onChange={(e) => setFilter((f) => ({ ...f, printer: e.target.value }))}
              />
            </div>

            <button
              className="btn-3d btn-3d-dark"
              disabled={!filterActive}
              onClick={resetFilters}
            >
              <Icons.Reset /> Reset Filters
            </button>
          </div>

          {/* Records table (26 columns) */}
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
                    <td colSpan={TABLE_COLS} style={{ textAlign: "center", padding: "40px", color: "#4a6f8c" }}>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>🗂️</div>
                      <div style={{ fontWeight: 700, fontSize: "15px", color: "#0b2f4f" }}>
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
                    <td className="r" style={{ color: "#08406b", fontSize: "14px" }}>
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
                className="input-3d"
                style={{ width: "80px", height: "32px" }}
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
      {(c.others || []).length ? c.others.map((o) => <div key={o.name}>{fn(o)}</div>) : <span style={{ color: "#8fb0c8" }}>—</span>}
    </td>
  );
  return (
    <tr>
      <td style={{ fontWeight: 700 }}>
        <span className="badge-3d badge-3d-primary">{r.month}</span>
      </td>
      <td style={{ fontWeight: 700, color: "#0b2f4f" }}>{r.machine}</td>
      <td>{r.printer || <span style={{ color: "#8fb0c8" }}>—</span>}</td>
      {stack((x) => x.inputType || "—")}
      {stack((x) => fmt(x.start), "r")}
      {stack((x) => fmt(x.end), "r")}
      {stack((x) => fmt(rowCalc(x).impression), "r")}
      {stack((x) => `${x.wastage ?? 0}%`, "r")}
      <td className="r">{fmt(c.a3Imp)}</td>
      <td className="r">{fmt(c.a4Imp)}</td>
      <td className="r" style={{ fontWeight: 800, color: "#0a6fb8" }}>{fmt(c.totalClick)}</td>
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
            {t ? `${t.rate}%` : <span style={{ color: "#8fb0c8" }}>—</span>}
          </td>
        );
      })}
      <td className="r" style={{ fontWeight: 900, color: "#0a6fb8" }}>
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