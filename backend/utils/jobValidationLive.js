// Builds Production + Planning rows straight from the database
// (same columns as the Excel exports, header names lower-cased like the uploaded data)
const ProductionReal = require("../models/ProductionReal"); // check file name in backend/models
const WorkOrder = require("../models/WorkOrder");           // check file name in backend/models
const Activity = require("../models/ActivityMaster");
const Machine = require("../models/MachineMaster");

const t12 = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  let H = parseInt(h, 10);
  const ap = H >= 12 ? "PM" : "AM";
  H = H % 12 || 12;
  return `${H}:${m} ${ap}`;
};
const iso = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x) ? String(d).slice(0, 10) : x.toISOString().slice(0, 10);
};
const idOf = (v) => String((v && v._id) || v || "");
const asArr = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []);
const join = (arr) => arr.filter((x) => x !== undefined && x !== null && x !== "").join(", ");

async function nameMaps() {
  const [acts, macs] = await Promise.all([Activity.find().lean(), Machine.find().lean()]);
  const a = {}, m = {};
  acts.forEach((x) => { a[String(x._id)] = x.activityName; });
  macs.forEach((x) => { m[String(x._id)] = x.machineName; });
  return { a, m };
}

async function loadLiveProduction() {
  const [docs, { a, m }] = await Promise.all([ProductionReal.find().lean(), nameMaps()]);
  const rows = docs.filter((r) => Number(r.workOrder) > 0).map((r) => ({
    "wo no": r.workOrder,
    "customer": r.customerName || "",
    "job description": r.jobDescription || "",
    "product type": r.productType || "",
    "date": iso(r.productionDate),
    "shift": r.shift || "",
    "machine status": r.machineStatus || "",
    "from time (12h)": t12(r.productionFromTime),
    "to time (12h)": t12(r.productionToTime),
    "stage": join(asArr(r.machiness).map((p) => a[idOf(p.activityId)] || p.activityId?.activityName)),
    "machine": join(asArr(r.machiness).map((p) => m[idOf(p.machineId)] || p.machineId?.machineName)),
    "material code": join(asArr(r.materials).map((x) => x.materialCode)),
    "material description": join(asArr(r.materials).map((x) => x.materialDescription)),
    "order qty": r.orderQty,
    "production qty": r.productionQty,
    "wastage qty": r.wastageQty,
    "remarks": r.remarks || "",
  }));
  return { rows, meta: null };
}

async function loadLivePlanning() {
  let q = WorkOrder.find();
  try { q = q.populate("customer", "name"); } catch (e) { /* customer is plain text */ }
  let docs;
  try { docs = await q.lean(); } catch (e) { docs = await WorkOrder.find().lean(); }

  const rows = docs.flatMap((wo) => {
    const base = {
      "wo no": wo.efiWoNumber,
      "product code": wo.productCode || "",
      "customer name": (wo.customer && wo.customer.name) || (typeof wo.customer === "string" ? wo.customer : ""),
      "job description": wo.description || wo.productName || "",
      "product type": wo.productType || "",
      "order qty": wo.orderQty,
      "color front": wo.colorFront,
      "color back": wo.colorBack,
    };
    const mats = asArr(wo.materials).length ? asArr(wo.materials) : [{}];
    return mats.map((x) => ({
      ...base,
      "paper code": x.materialCode != null ? String(x.materialCode) : "",
      "paper qty": x.paperQty,
      "paper size": x.paperSize || "",
      "gsm": x.gsm || "",
    }));
  });
  return { rows, meta: null };
}

// changes whenever records are added / removed / edited, so the page auto-refreshes
async function liveStamp() {
  const one = async (M) => {
    const n = await M.countDocuments();
    const last = await M.findOne().sort({ updatedAt: -1 }).select("updatedAt createdAt").lean();
    const t = last ? new Date(last.updatedAt || last.createdAt || 0).getTime() : 0;
    return `${n}:${t}`;
  };
  return "live:" + (await one(ProductionReal)) + "|" + (await one(WorkOrder));
}

module.exports = { loadLiveProduction, loadLivePlanning, liveStamp };