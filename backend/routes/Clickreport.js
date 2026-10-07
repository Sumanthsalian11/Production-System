const express = require("express");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs"); // npm i exceljs
const router = express.Router();
const ClickReportEntry = require("../models/ClickReportEntry");

const n = (v) => (v === "" || v == null || isNaN(Number(v)) ? 0 : Number(v));
const r2 = (v) => Math.round(v * 100) / 100;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_ENTRIES_PER_SAVE = 200;
const EXPORT_LIMIT = 200000; // max records per Excel download
const TAX_NAMES = ["GST", "SGST", "CGST", "IGST"];
const SORT = { month: -1, createdAt: -1, _id: -1 };

// Excel ROUNDUP(x,0): rounds away from zero
const roundUp = (v) => {
  const x = +v.toFixed(6);
  return x < 0 ? -Math.ceil(-x) : Math.ceil(x);
};
const afterWastage = (imp, w) => roundUp(imp - (imp * w) / 100);

/* ---------- RISO machine (follows the riso.xlsx sheet) ----------
   A3 total  = (A3 end - A3 start) + Non Std(L)
   A4 total  = (A4 end - A4 start) + Non Std(S)
   Overall   = A3 total x 2 + A4 total
   Click calc= A3 total x A3 rate + A4 total x A4 rate (rates from the master, no wastage) */
const isRiso = (m) => /riso/i.test(String(m || ""));
const risoGroup = (t) => {
  const x = String(t || "").replace(/\s+/g, "").toUpperCase();
  return x === "A3" ? "A3" : x === "A4" ? "A4" : x === "NONSTD(L)" ? "NL" : x === "NONSTD(S)" ? "NS" : null;
};

// Recalculate one machine entry on the server (same formulas as the Ricoh sheet / Riso sheet)
function calcEntry(e = {}) {
  let a3Imp = 0, a3Bill = 0, a4RowImp = 0, a4RowBill = 0, totalImp = 0, totalW = 0, hasTotal = false;
  const otherMap = {}; // NEW: other paper sizes (billed separately)

  const rows = (e.rows || []).map((r) => {
    const start = n(r.start), end = n(r.end), wastage = n(r.wastage);
    const impression = r.end === "" || r.end == null ? 0 : Math.abs(start - end); // |start - end|
    const inputType = String(r.inputType || "").trim(); // paper size name from master, or "Total"
    const x = inputType.toUpperCase();
    // CHANGED: other sizes are now "Other" (billed at their own rate) instead of A4
    const g = !x ? null : x === "A3" ? "A3" : x === "TOTAL" ? "Total" : x === "A4" ? "A4" : "Other";
    if (g === "A3") { a3Imp += impression; a3Bill += afterWastage(impression, wastage); }
    else if (g === "A4") { a4RowImp += impression; a4RowBill += afterWastage(impression, wastage); }
    else if (g === "Total") { if (!hasTotal) totalW = wastage; hasTotal = true; totalImp += impression; }
    else if (g === "Other") {
      const o = otherMap[inputType] || (otherMap[inputType] = { name: inputType, imp: 0, bill: 0, w: wastage, rate: n(r.rate) });
      o.imp += impression;
      o.bill += afterWastage(impression, wastage);
    }
    return { inputType, start, end, wastage, impression, ...(g === "Other" ? { rate: n(r.rate) } : {}) };
  });

  // RISO: Excel grouping (A3 + Non Std(L), A4 + Non Std(S)); no wastage for Riso
  const riso = isRiso(e.machine);
  let rA4Imp = 0;
  if (riso) {
    a3Imp = 0;
    rows.forEach((r) => {
      const k = risoGroup(r.inputType);
      if (!k) return;
      if (k === "A3" || k === "NL") a3Imp += r.impression;
      else rA4Imp += r.impression;
    });
    a3Bill = a3Imp;
  }

  // A4 impression = (Total end - Total start) - A3 impression
  const derivedA4 = hasTotal ? totalImp - a3Imp : 0;
  const a4Imp = riso ? rA4Imp : a4RowImp + derivedA4;
  const a4Bill = riso ? a4Imp : a4RowBill + (hasTotal ? afterWastage(derivedA4, totalW) : 0);

  // NEW: other sizes with their own rate (not for Riso)
  const others = riso ? [] : Object.values(otherMap).map((o) => ({ ...o, amount: r2(o.bill * o.rate) }));
  const otherImp = others.reduce((s, o) => s + o.imp, 0);
  const otherAmount = others.reduce((s, o) => s + o.amount, 0);

  const totalClick = a4Imp + a3Imp * 2 + otherImp; // A4 + A3 x 2 + other sizes (Riso: Excel "Overall total")

  const a4Rate = n(e.a4Rate), a3Rate = n(e.a3Rate);
  const a3Amount = a3Bill * a3Rate;
  const a4Amount = a4Bill * a4Rate;
  const totalAmount = a3Amount + a4Amount + otherAmount; // CHANGED: + otherAmount
  const discount = n(e.discount);
  const discountAmount = (totalAmount * discount) / 100;
  const taxable = totalAmount - discountAmount;
  const taxList = (Array.isArray(e.taxes) ? e.taxes : [])
    .filter((t) => t && String(t.name || "").trim())
    .map((t) => ({ name: String(t.name).trim(), rate: n(t.rate) }));
  const taxes = taxList.map((t) => ({ ...t, amount: r2((taxable * t.rate) / 100) }));
  const gst = taxList.length ? taxList.reduce((s, t) => s + t.rate, 0) : n(e.gst);
  const gstAmount = taxList.length
    ? taxes.reduce((s, t) => s + t.amount, 0)
    : (taxable * gst) / 100;

  return {
    machine: String(e.machine || "").trim(),
    printer: String(e.printer || "").trim(),
    rows, a4Rate, a3Rate,
    a3Impression: a3Imp, a4Impression: a4Imp, a3Billable: a3Bill, a4Billable: a4Bill, totalClick,
    a3Amount: r2(a3Amount), a4Amount: r2(a4Amount), totalAmount: r2(totalAmount),
    discount, discountAmount: r2(discountAmount), gst, taxes,
    totalWithGst: r2(totalAmount - discountAmount + gstAmount),
  };
}

const validMonth = (m) => /^\d{4}-\d{2}$/.test(m || "");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build a Mongo filter from ?month=YYYY-MM&machine=NAME&printer=text
function buildQuery(qs = {}) {
  const q = {};
  if (validMonth(qs.month)) q.month = qs.month;
  if (qs.machine) q.machine = String(qs.machine);
  const printer = String(qs.printer || "").trim();
  if (printer) q.printer = { $regex: escapeRegex(printer), $options: "i" };
  return q;
}

// Rate + amount of one tax on a saved record (same logic as the UI)
const taxOf = (r, name) => {
  const t = (r.taxes || []).find((x) => x.name === name);
  if (t) return { rate: t.rate, amount: t.amount || 0 };
  if (name === "GST" && !(r.taxes || []).length && r.gst) return { rate: r.gst, amount: r.gstAmount || 0 };
  return null;
};

// NEW: other paper sizes (MICR / Non MICR ...) of a saved record, for the Excel export
const otherOf = (r) => {
  const empty = { size: "", imp: 0, bill: 0, rate: "", amount: 0 };
  if (isRiso(r.machine)) return empty;
  const m = {};
  (r.rows || []).forEach((x) => {
    const name = String(x.inputType || "").trim();
    const u = name.toUpperCase();
    if (!u || u === "A3" || u === "A4" || u === "TOTAL") return;
    const o = m[name] || (m[name] = { name, imp: 0, bill: 0, rate: n(x.rate) });
    o.imp += n(x.impression);
    o.bill += afterWastage(n(x.impression), n(x.wastage));
  });
  const list = Object.values(m).map((o) => ({ ...o, amount: r2(o.bill * o.rate) }));
  if (!list.length) return empty;
  return {
    size: list.map((o) => o.name).join(" / "),
    imp: list.reduce((t, o) => t + o.imp, 0),
    bill: list.reduce((t, o) => t + o.bill, 0),
    rate: list.map((o) => o.rate).join(" / "),
    amount: list.reduce((t, o) => t + o.amount, 0),
  };
};

const checkId = (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "Invalid record id" });
    return false;
  }
  return true;
};

/* ---------- List (paginated) ----------
   GET /?page=1&limit=50&month=YYYY-MM&machine=NAME&printer=text
   -> { data, total, page, pages, limit } */
router.get("/", async (req, res) => {
  try {
    const q = buildQuery(req.query);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const noFilter = Object.keys(q).length === 0;
    const [data, total] = await Promise.all([
      ClickReportEntry.find(q).sort(SORT).skip((page - 1) * limit).limit(limit).lean(),
      noFilter ? ClickReportEntry.estimatedDocumentCount() : ClickReportEntry.countDocuments(q),
    ]);

    res.json({ data, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- Totals for the current filter (one aggregation) ---------- */
router.get("/summary", async (req, res) => {
  try {
    const q = buildQuery(req.query);
    const [row] = await ClickReportEntry.aggregate(
      [
        { $match: q },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            a3Impression: { $sum: "$a3Impression" },
            a4Impression: { $sum: "$a4Impression" },
            totalClick: { $sum: "$totalClick" },
            a3Billable: { $sum: "$a3Billable" },
            a4Billable: { $sum: "$a4Billable" },
            a3Amount: { $sum: "$a3Amount" },
            a4Amount: { $sum: "$a4Amount" },
            totalAmount: { $sum: "$totalAmount" },
            discountAmount: { $sum: "$discountAmount" },
            totalWithGst: { $sum: "$totalWithGst" },
          },
        },
        { $project: { _id: 0 } },
      ],
      { allowDiskUse: true }
    );
    res.json(
      row || {
        count: 0, a3Impression: 0, a4Impression: 0, totalClick: 0, a3Billable: 0, a4Billable: 0,
        a3Amount: 0, a4Amount: 0, totalAmount: 0, discountAmount: 0, totalWithGst: 0,
      }
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- Distinct machine names (for the filter dropdown) ---------- */
router.get("/machines", async (req, res) => {
  try {
    const list = await ClickReportEntry.distinct("machine");
    res.json(list.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- Excel export (streamed, constant memory) ---------- */
router.get("/export", async (req, res) => {
  try {
    const q = buildQuery(req.query);
    const monthLabel = validMonth(req.query.month) ? req.query.month : "All";

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Click_Report_${monthLabel}.xlsx"`);

    const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: false, useSharedStrings: false });

    const head = [
      "Month", "Machine", "Printer name", "A3 impression", "A4 impression", "Total click",
      "A3 after wastage", "A4 after wastage", "A4 rate", "A3 rate", "A3 amount", "A4 amount",
      "Other size", "Other impression", "Other after wastage", "Other rate", "Other amount",
      "Total amount", "Discount %", "Discount amount",
      ...TAX_NAMES.flatMap((t) => [`${t} rate %`, `${t} amount`]),
      "Total amount with GST",
    ];
    const ws1 = wb.addWorksheet("Click Report");
    ws1.columns = head.map((h, i) => ({ header: h, width: i < 3 ? 18 : Math.max(12, h.length + 2) }));

    const readHead = ["Month", "Machine", "Printer name", "Input type", "Meter start reading", "Meter end reading", "Impression", "Wastage deduction %"];
    const ws2 = wb.addWorksheet("Readings");
    ws2.columns = readHead.map((h, i) => ({ header: h, width: i < 3 ? 18 : Math.max(14, h.length + 2) }));

    const tot = {
      a3Impression: 0, a4Impression: 0, totalClick: 0, a3Billable: 0, a4Billable: 0,
      a3Amount: 0, a4Amount: 0, totalAmount: 0, discountAmount: 0, totalWithGst: 0,
    };
    const taxTot = { GST: 0, SGST: 0, CGST: 0, IGST: 0 };
    const otTot = { imp: 0, bill: 0, amt: 0 }; // NEW: other sizes totals

    const cursor = ClickReportEntry.find(q).sort(SORT).limit(EXPORT_LIMIT).lean().cursor();
    for await (const r of cursor) {
      Object.keys(tot).forEach((k) => { tot[k] += r[k] || 0; });
      const oc = otherOf(r); // NEW
      otTot.imp += oc.imp; otTot.bill += oc.bill; otTot.amt += oc.amount;
      ws1.addRow([
        r.month, r.machine, r.printer, r.a3Impression, r.a4Impression, r.totalClick,
        r.a3Billable, r.a4Billable, r.a4Rate, r.a3Rate, r.a3Amount, r.a4Amount,
        oc.size, oc.imp, oc.bill, oc.rate, oc.amount,
        r.totalAmount, r.discount, r.discountAmount,
        ...TAX_NAMES.flatMap((t) => {
          const x = taxOf(r, t);
          if (x) taxTot[t] += x.amount || 0;
          return x ? [x.rate, x.amount] : ["", ""];
        }),
        r.totalWithGst,
      ]).commit();
      (r.rows || []).forEach((x) =>
        ws2.addRow([r.month, r.machine, r.printer, x.inputType, x.start, x.end, x.impression, x.wastage]).commit()
      );
    }

    ws1.addRow([
      "Total", "", "", tot.a3Impression, tot.a4Impression, tot.totalClick,
      tot.a3Billable, tot.a4Billable, "", "",
      tot.a3Amount, tot.a4Amount, "", otTot.imp, otTot.bill, "", otTot.amt,
      tot.totalAmount, "", tot.discountAmount,
      ...TAX_NAMES.flatMap((t) => ["", taxTot[t]]),
      tot.totalWithGst,
    ]).commit();

    ws1.commit();
    ws2.commit();
    await wb.commit();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: err.message });
    else res.destroy(err);
  }
});

/* ---------- Save one or more machine entries: { month, entries: [...] } ---------- */
router.post("/", async (req, res) => {
  try {
    const { month, entries } = req.body;
    if (!validMonth(month)) return res.status(400).json({ message: "Month must be YYYY-MM" });
    if (!Array.isArray(entries) || entries.length === 0)
      return res.status(400).json({ message: "No entries to save" });
    if (entries.length > MAX_ENTRIES_PER_SAVE)
      return res.status(400).json({ message: `Max ${MAX_ENTRIES_PER_SAVE} entries per save` });
    if (entries.some((e) => !String(e.machine || "").trim()))
      return res.status(400).json({ message: "Machine is required for every entry" });

    const created = await ClickReportEntry.insertMany(
      entries.map((e) => ({ month, ...calcEntry(e) }))
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------- Update one record: { month, entry } ---------- */
router.put("/:id", async (req, res) => {
  try {
    if (!checkId(req, res)) return;
    const { month, entry } = req.body;
    if (!validMonth(month)) return res.status(400).json({ message: "Month must be YYYY-MM" });
    const doc = await ClickReportEntry.findByIdAndUpdate(
      req.params.id,
      { month, ...calcEntry(entry) },
      { returnDocument: "after" } // replaces the deprecated { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Record not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!checkId(req, res)) return;
    await ClickReportEntry.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
module.exports.calcEntry = calcEntry; // exported for testing