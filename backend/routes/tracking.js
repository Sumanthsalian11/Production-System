const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const IndentRequest = require("../models/Indentrequest");
const CustomerOrder = require("../models/CustomerOrder");
const WorkOrder = require("../models/WorkOrder");
const ProductionReal = require("../models/ProductionReal");
const Dispatch = require("../models/Dispatch");

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fd = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "-");
const QC_RX = /(^|\W)(qc|quality)/i;

// READ-ONLY: Indent -> PO (CustomerOrder) -> Work Order -> Production -> QC -> Dispatch
// builds the tracking rows. opt: { q, onlyNos, type, skip, limit, indentsOnly }
async function buildTracking(opt = {}) {
    const q = String(opt.q || "").trim();
    const limit = Math.min(opt.limit || 200, 1000); // always capped
    const rx = q ? new RegExp(esc(q), "i") : null;
    const onlyNos = opt.onlyNos && opt.onlyNos.length ? opt.onlyNos : null;

    // 1. indents
    const indFilter = {};
    if (onlyNos) indFilter.indentNo = { $in: onlyNos };
    else if (rx)
      indFilter.$or = [{ indentNo: rx }, { "items.customerName": rx }, { "items.productCode": rx }, { "items.description": rx }];
    if (opt.type === "sample") indFilter.indentType = "sample";
    else if (opt.type === "production") indFilter.indentType = { $ne: "sample" };
    const indents = await IndentRequest.find(indFilter)
      .select("indentNo groupId status indentType createdAt user items.customerName items.productCode items.description items.quantity")
      .sort({ createdAt: -1 })
      .skip(opt.skip || 0)
      .limit(limit)
      .lean();
    const indentNos = indents.map((i) => i.indentNo);

    // indents saved together (same groupId) share ONE order, stored under one indent no
    const groupIds = [...new Set(indents.map((i) => i.groupId).filter(Boolean))];
    const groupMembers = groupIds.length
      ? await IndentRequest.find({ groupId: { $in: groupIds } }).select("indentNo groupId").lean()
      : [];
    const groupNos = {};
    groupMembers.forEach((m) => { (groupNos[m.groupId] = groupNos[m.groupId] || []).push(m.indentNo); });
    const lookupNos = [...new Set([...indentNos, ...groupMembers.map((m) => m.indentNo)])];

    // 2. POs created from those indents + direct POs (no indent)
    const indentOrders = lookupNos.length
      ? await CustomerOrder.find({ indentNo: { $in: lookupNos } }).lean()
      : [];
    const directAnd = [{ $or: [{ indentNo: "" }, { indentNo: null }, { indentNo: { $exists: false } }] }];
    if (rx) directAnd.push({ $or: [{ purchaseOrderNo: rx }, { customerName: rx }, { description: rx }, { ticketNo: rx }] });
    const directOrders = (onlyNos || opt.indentsOnly)
      ? []
      : await CustomerOrder.find({ $and: directAnd }).sort({ createdAt: -1 }).limit(limit).lean();

    const orders = [...indentOrders, ...directOrders];
    const orderIds = orders.map((o) => o._id);

    // 3. work orders
    const wos = orderIds.length
      ? await WorkOrder.find({ customerOrderId: { $in: orderIds } })
          .select("efiWoNumber status customerOrderId createdAt planningUser orderQty totalQty locationSplits")
          .lean()
      : [];
    const woByOrder = new Map(wos.map((w) => [String(w.customerOrderId), w]));
    const woNums = wos.map((w) => w.efiWoNumber);

    // 4. production per work order + activity
    const prodRows = woNums.length
      ? await ProductionReal.aggregate([
          { $match: { workOrder: { $in: woNums } } },
          { $project: { workOrder: 1, productionQty: 1, productionDate: 1, machiness: 1 } },
          { $unwind: { path: "$machiness", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { wo: "$workOrder", a: "$machiness.activityId" },
              qty: { $sum: "$productionQty" },
              entries: { $sum: 1 },
              last: { $max: "$productionDate" },
            },
          },
        ]).allowDiskUse(true)
      : [];
    const actIds = [...new Set(prodRows.map((r) => String(r._id.a || "")).filter(Boolean))];
    const actDocs = actIds.length
      ? await mongoose.model("ActivityMaster").find({ _id: { $in: actIds } }, "activityName").lean()
      : [];
    const actName = new Map(actDocs.map((a) => [String(a._id), a.activityName]));
    const prodByWo = new Map();
    prodRows.forEach((r) => {
      const arr = prodByWo.get(r._id.wo) || [];
      arr.push({ name: actName.get(String(r._id.a)) || "-", qty: r.qty, entries: r.entries, last: r.last });
      prodByWo.set(r._id.wo, arr);
    });

    // 5. dispatch per work order
    const disp = woNums.length
      ? await Dispatch.find({ efiWoNumber: { $in: woNums } })
          .select("efiWoNumber dispatchQty balanceQty dispatchDate invoiceNo createdAt splitLocation")
          .sort({ createdAt: 1 })
          .lean()
      : [];
    const dispByWo = new Map();
    disp.forEach((d) => {
      const e = dispByWo.get(d.efiWoNumber) || { qty: 0, balance: 0, last: null, invoices: [] };
      e.qty += Number(d.dispatchQty) || 0;
      e.balance = Number(d.balanceQty) || 0; // latest (sorted by createdAt)
      if (d.splitLocation) e.split = true;
      e.last = d.dispatchDate;
      if (d.invoiceNo) e.invoices.push(d.invoiceNo);
      dispByWo.set(d.efiWoNumber, e);
    });

    // 5b. Out Source / PMS: dispatches are saved against the ticket, not a work order
    const ticketNos = orders
      .filter((o) => ["Out Source", "PMS"].includes(o.orderType) && o.ticketNo)
      .map((o) => o.ticketNo);
    const dispT = ticketNos.length
      ? await Dispatch.find({ ticketNo: { $in: ticketNos } })
          .select("ticketNo dispatchQty dispatchDate invoiceNo createdAt")
          .sort({ createdAt: 1 })
          .lean()
      : [];
    const dispByTicket = new Map();
    dispT.forEach((d) => {
      const e = dispByTicket.get(d.ticketNo) || { qty: 0, balance: 0, last: null, invoices: [] };
      e.qty += Number(d.dispatchQty) || 0;
      e.last = d.dispatchDate;
      if (d.invoiceNo) e.invoices.push(d.invoiceNo);
      dispByTicket.set(d.ticketNo, e);
    });

    const build = (indent, order) => {
      const item = (indent && indent.items && indent.items[0]) || {};
      const wo = order ? woByOrder.get(String(order._id)) : null;
      const acts = wo ? prodByWo.get(wo.efiWoNumber) || [] : [];
      const qcActs = acts.filter((a) => QC_RX.test(a.name));
      const prodActs = acts.filter((a) => !QC_RX.test(a.name));
      const prodQty = prodActs.reduce((m, a) => Math.max(m, a.qty), 0);
      const orderQty = wo ? Number(wo.orderQty) || 0 : Number(order?.quantity || item.quantity) || 0;
      const isExt = !!(order && ["Out Source", "PMS"].includes(order.orderType) && order.ticketNo && !wo);
      let dsp = wo ? dispByWo.get(wo.efiWoNumber) : null;
      if (dsp && dsp.split) {
        const splitTotal = (wo.locationSplits || []).reduce(
          (s, x) => s + (Number(x.qty ?? x.quantity) || 0), 0
        );
        if (splitTotal > 0) dsp = { ...dsp, balance: Math.max(0, splitTotal - dsp.qty) };
      }
      if (isExt) {
        const t = dispByTicket.get(order.ticketNo);
        dsp = t ? { ...t, balance: Math.max(0, orderQty - t.qty) } : null;
      }

      const stages = [];

      // New Indent
      stages.push(
        indent
          ? {
              key: "indent", label: "New Indent",
              state: indent.status === "REJECTED" ? "stopped" : "done",
              lines: [`Indent ${indent.indentNo}`, `Status: ${indent.status}`, `Raised: ${fd(indent.createdAt)} by ${indent.user || "-"}`],
            }
          : { key: "indent", label: "New Indent", state: "na", lines: ["Direct PO (no indent)"] }
      );

      // PO
      stages.push(
        order
          ? {
              key: "po", label: "Purchase Order", state: "done",
              lines: [`PO: ${order.purchaseOrderNo || "-"}`, `Ticket: ${order.ticketNo || "-"}`, `Type: ${order.orderType || "-"}`, `Date: ${fd(order.createdAt)}`],
            }
          : { key: "po", label: "Purchase Order", state: "pending", lines: ["Waiting for PO processing"] }
      );

      // Planner
      const notInhouse = order && order.orderType && order.orderType !== "Inhouse" && !wo;
      stages.push(
        wo
          ? {
              key: "planner", label: "Planner (Work Order)", state: "done",
              lines: [`WO No: ${wo.efiWoNumber}`, `Planned by: ${wo.planningUser || "-"}`, `Date: ${fd(wo.createdAt)}`],
            }
          : notInhouse
          ? { key: "planner", label: "Planner (Work Order)", state: "na", lines: [`${order.orderType} order, not planned in-house`] }
          : { key: "planner", label: "Planner (Work Order)", state: "pending", lines: [order ? "Waiting for work order" : "-"] }
      );

      // Production
      let pState = isExt ? "na" : "pending";
      if (wo && acts.length && prodActs.some((a) => a.entries > 0)) pState = orderQty && prodQty >= orderQty ? "done" : "partial";
      stages.push({
        key: "production", label: "Production", state: pState,
        lines: wo
          ? [`Produced: ${prodQty.toLocaleString("en-IN")} / ${orderQty.toLocaleString("en-IN")}`, ...prodActs.map((a) => `${a.name}: ${a.qty.toLocaleString("en-IN")} (last ${fd(a.last)})`)]
          : ["-"],
      });

      // QC
      stages.push({
        key: "qc", label: "QC", state: qcActs.some((a) => a.entries > 0) ? "done" : "pending",
        lines: qcActs.length ? qcActs.map((a) => `${a.name}: ${a.qty.toLocaleString("en-IN")} (last ${fd(a.last)})`) : ["No QC entry yet"],
      });

      // Dispatch
      let dState = "pending";
      if (dsp) dState = dsp.balance <= 0 ? "done" : "partial";
      stages.push({
        key: "dispatch", label: "Dispatch", state: dState,
        lines: dsp
          ? [`Dispatched: ${dsp.qty.toLocaleString("en-IN")}`, `Balance: ${dsp.balance.toLocaleString("en-IN")}`, `Last: ${fd(dsp.last)}`, dsp.invoices.length ? `Invoice: ${dsp.invoices.join(", ")}` : ""].filter(Boolean)
          : ["Not dispatched yet"],
      });

      if (isExt) {
        const ps = stages.find((s) => s.key === "production");
        if (ps) ps.lines = [`${order.orderType} order, produced by supplier`];
      }

      // current stage = first one not done / na
      const qcIdx = stages.findIndex((s) => s.key === "qc");
      if (qcIdx >= 0) stages.splice(qcIdx, 1);
      const cur = stages.find((s) => s.state !== "done" && s.state !== "na");
      if (cur && cur.state === "pending") cur.state = "current";

      return {
        ref: indent ? indent.indentNo : order?.ticketNo || order?.purchaseOrderNo || "-",
        poNo: order?.purchaseOrderNo || "",
        customer: item.customerName || order?.customerName || "-",
        product: item.description || order?.description || "-",
        productCode: item.productCode || order?.productCode || "",
        qty: indent && order && order.indentNo !== indent.indentNo ? Number(item.quantity) || orderQty : orderQty,
        woNo: wo ? wo.efiWoNumber : null,
        createdAt: indent ? indent.createdAt : order?.createdAt,
        current: cur ? cur.label : "Completed",
        stages,
      };
    };

    const rows = [];
    indents.forEach((ind) => {
      const nos = ind.groupId && groupNos[ind.groupId] ? groupNos[ind.groupId] : [ind.indentNo];
      const o =
        indentOrders.find((x) => x.indentNo === ind.indentNo) ||
        indentOrders.find((x) => nos.includes(x.indentNo));
      rows.push(build(ind, o || null));
    });
    directOrders.forEach((o) => rows.push(build(null, o)));
    rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return limit ? rows.slice(0, limit) : rows;
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    // indentNos = only these indents (used by the New Indent page). Without it: same as before.
    const onlyNos = String(req.query.indentNos || "").split(",").map((s) => s.trim()).filter(Boolean);
    const nos = onlyNos.slice(0, 200);
if (!nos.length) console.warn("BARE /api/tracking call from", req.headers.referer);
res.json(await buildTracking({ q: req.query.q, onlyNos: nos, limit: nos.length || 200 }));
  } catch (err) {
    console.error("TRACKING ERROR:", err);
    res.status(500).json({ message: "Error building tracking" });
  }
});

// Stage filter for the New Indent Track tab: scans newest-first in batches and returns
// the indent numbers whose current stage matches, plus a cursor for the next page.
router.get("/stage-page", authMiddleware, async (req, res) => {
  try {
    const stage = String(req.query.stage || "");
    const want = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    let skip = Math.max(0, parseInt(req.query.cursor, 10) || 0);
    const BATCH = 200;
    const MAX_SCAN = 20000;
    const out = [];
    let scanned = 0;
    let more = true;
    while (more && out.length < want && scanned < MAX_SCAN) {
      const rows = await buildTracking({
        q: req.query.q, type: req.query.type, skip, limit: BATCH, indentsOnly: true
      });
      if (rows.length < BATCH) more = false;
      let used = rows.length;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].current === stage) {
          out.push(rows[i].ref);
          if (out.length >= want) {
            used = i + 1;
            if (i + 1 < rows.length) more = true;
            break;
          }
        }
      }
      skip += used;
      scanned += used;
    }
    res.json({ indentNos: out, nextCursor: more ? skip : null });
  } catch (err) {
    console.error("STAGE PAGE ERROR:", err);
    res.status(500).json({ message: "Error filtering by stage" });
  }
});

const clean = (v) => {
  if (typeof v === "string") return v.length > 500 ? v.slice(0, 500) + "..." : v;
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === "object" && !(v instanceof Date) && !v._bsontype) {
    const o = {};
    Object.keys(v).forEach((k) => { if (k !== "__v") o[k] = clean(v[k]); });
    return o;
  }
  return v;
};

router.get("/detail", authMiddleware, async (req, res) => {
  try {
    const indentNo = String(req.query.indentNo || "").trim();
    const orderId = String(req.query.orderId || "").trim();
    if (!indentNo && !orderId) return res.json({});
    const indent = indentNo ? await IndentRequest.findOne({ indentNo }).lean() : null;
    let orderNos = [indentNo];
    if (indent && indent.groupId) {
      const mem = await IndentRequest.find({ groupId: indent.groupId }).select("indentNo").lean();
      orderNos = mem.map((m) => m.indentNo);
    }
    const orders = indentNo
      ? await CustomerOrder.find({ indentNo: { $in: orderNos } }).sort({ createdAt: 1 }).lean()
      : (/^[a-f0-9]{24}$/i.test(orderId) ? await CustomerOrder.find({ _id: orderId }).lean() : []);
    const order = orders[0] || null;
    const wos = orders.length
      ? await WorkOrder.find({ customerOrderId: { $in: orders.map((o) => o._id) } }).sort({ createdAt: 1 }).lean()
      : [];
    const wo = wos[0] || null;
    let production = [];
    let dispatch = [];
    if (wos.length) {
      const woNums = wos.map((w) => w.efiWoNumber);
      production = await ProductionReal.find({ workOrder: { $in: woNums } }).sort({ productionDate: 1 }).lean();
      dispatch = await Dispatch.find({ efiWoNumber: { $in: woNums } }).sort({ createdAt: 1 }).lean();
      const ids = [...new Set(production.flatMap((p) => (p.machiness || []).map((m) => String(m.activityId || ""))).filter(Boolean))];
      const acts = ids.length ? await mongoose.model("ActivityMaster").find({ _id: { $in: ids } }, "activityName").lean() : [];
      const nm = new Map(acts.map((a) => [String(a._id), a.activityName]));
      production.forEach((p) => (p.machiness || []).forEach((m) => { m.activityName = nm.get(String(m.activityId)) || ""; }));
    }
    // Out Source / PMS: dispatches are saved against the ticket
    const tNos = orders
      .filter((o) => ["Out Source", "PMS"].includes(o.orderType) && o.ticketNo)
      .map((o) => o.ticketNo);
    if (tNos.length) {
      const tDisp = await Dispatch.find({ ticketNo: { $in: tNos } }).sort({ createdAt: 1 }).lean();
      dispatch = [...dispatch, ...tDisp];
    }

    const isOid = (v) => /^[a-f0-9]{24}$/i.test(String(v || ""));
const nameMap = async (modelName, ids, field) => {
  try {
    const list = [...new Set(ids.filter(isOid).map(String))];
    if (!list.length) return new Map();
    const docs = await mongoose.model(modelName).find({ _id: { $in: list } }, field).lean();
    return new Map(docs.map((d) => [String(d._id), d[field]]));
  } catch (e) {
    return new Map(); // model name or field not found: leave ids as they are
  }
};

// location (indent + PO store an ObjectId; the work order already has text)
const locIds = [indent && indent.location, ...orders.map((o) => o.location)];
const locNames = await nameMap("LocationMaster", locIds, "locationName");
if (indent && locNames.has(String(indent.location))) indent.location = locNames.get(String(indent.location));
orders.forEach((o) => { if (locNames.has(String(o.location))) o.location = locNames.get(String(o.location)); });

for (const w of wos) {
  if (!Array.isArray(w.machines)) continue;
  const actNames = await nameMap("ActivityMaster", w.machines.map((m) => m.activityId), "activityName");
  const machNames = await nameMap("MachineMaster", w.machines.map((m) => m.machineId), "machineName");
  w.machines.forEach((m) => {
    m.activity = actNames.get(String(m.activityId)) || "";
    m.machine = machNames.get(String(m.machineId)) || "";
  });
}

// hide delay fields from the tracking popup
const HIDE_DISPATCH_FIELDS = ["delayDays", "delayLabel"];
dispatch = dispatch.map((d) => {
  const c = { ...d };
  HIDE_DISPATCH_FIELDS.forEach((k) => delete c[k]);
  return c;
});

// readable split label on dispatch records (e.g. "Manipal (Qty: 1200)")
const splitSrc = [...wos, ...orders];
const splitLocNames = await nameMap(
  "LocationMaster",
  splitSrc.flatMap((s) => (s.locationSplits || []).map((x) => String(x.location ?? x.locationId ?? ""))),
  "locationName"
);
const splitLabel = {};
splitSrc.forEach((src) => {
  const list = (src.locationSplits || [])
    .map((x) => ({
      loc: String(x.location ?? x.locationId ?? x.locationName ?? ""),
      qty: Number(x.qty ?? x.quantity ?? 0) || 0
    }))
    .filter((x) => x.loc);
  const count = {};
  list.forEach((x) => { count[x.loc] = (count[x.loc] || 0) + 1; });
  const seen = {};
  list.forEach((x) => {
    let key = x.loc;
    if (count[x.loc] > 1) { seen[x.loc] = (seen[x.loc] || 0) + 1; key = `${x.loc}#${seen[x.loc]}`; }
    splitLabel[key] = `${splitLocNames.get(x.loc) || x.loc} (Qty: ${x.qty})`;
  });
});
dispatch = dispatch.map((d) =>
  d.splitLocation && splitLabel[d.splitLocation] ? { ...d, splitLocation: splitLabel[d.splitLocation] } : d
);

// hide these fields from the tracking popup
const HIDE_FIELDS = ["activity2", "locationSplits"];
const stripHidden = (obj) => {
  if (obj) HIDE_FIELDS.forEach((k) => delete obj[k]);
};
stripHidden(indent);
orders.forEach(stripHidden);
wos.forEach(stripHidden);

res.json(clean({ indent, order: orders[0] || null, orders, workOrder: wos[0] || null, workOrders: wos, production, dispatch }));
  } catch (err) {
    console.error("TRACKING DETAIL ERROR:", err);
    res.status(500).json({ message: "Error loading tracking detail" });
  }
});

module.exports = router;
