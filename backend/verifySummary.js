/**
 * Compares the new server-side summary with the OLD Summary page logic on your
 * real data, for the filters you give. Writes nothing.
 *
 * Run from the backend folder (use your production routes file path):
 *   node verifySummary.js ./routes/productionRoutes.js
 *   node verifySummary.js ./routes/productionRoutes.js --from 2026-09-01 --to 2026-09-30
 *   node verifySummary.js ./routes/productionRoutes.js --customer "STATE BANK OF INDIA" --type Production
 *
 * Filters: --wo --from --to --group --mill --gsm --type --location --customer
 * Use it on a database small enough for the old page to load (it loads everything).
 */
const mongoose = require("mongoose");
try { require("dotenv").config(); } catch { /* optional */ }

const routesPath = process.argv[2];

const query = {};
["wo", "from", "to", "group", "mill", "gsm", "type", "location", "customer"].forEach((k) => {
  const i = process.argv.indexOf(`--${k}`);
  if (i > -1 && process.argv[i + 1]) query[k] = process.argv[i + 1];
});

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/production-system";

// ---------------- OLD page logic (copied from the current Summary page) ----------------
const normalizeGroup = (name) => {
  if (!name) return "";
  name = name.trim();
  if (name.startsWith("Non Surface Sized")) return "Non Surface Sized Maplit";
  if (name === "Parachment Paper") return "Parchment Paper";
  return name;
};

function oldLogic(productionData, plannerData, f) {
  const normalized = productionData.map((item) => {
    const matchedWO = plannerData.find((wo) => String(wo.efiWoNumber) === String(item.efiWoNumber));
    const materials = item.materials || [];
    const groups = materials.map((m) => normalizeGroup(m.materialGroupDescription)).filter(Boolean);
    const gsms = materials.map((m) => String(m.gsm)).filter(Boolean);
    return {
      ...item,
      plannedQty: Number(matchedWO?.qtyInLvs) || 0,
      mill: item.mill?.trim() || "",
      groups, gsms,
      mills: item.mill ? [item.mill.trim()] : [],
    };
  });

  const records = normalized.sort((a, b) => new Date(b.productionDate) - new Date(a.productionDate));

  let result = records.filter((r) => {
    if (f.wo && String(r.efiWoNumber) !== String(f.wo)) return false;
    if (f.from && new Date(r.productionDate).toISOString().slice(0, 10) < f.from) return false;
    if (f.to && new Date(r.productionDate).toISOString().slice(0, 10) > f.to) return false;
    if (f.mill && !r.mills.includes(f.mill)) return false;
    if (f.gsm && !r.gsms.includes(f.gsm)) return false;
    if (f.group && !r.groups.includes(f.group)) return false;
    if (f.type && r.productionType !== f.type) return false;
    if (f.location && !r.userLocations?.includes(f.location)) return false;
    if (f.customer && r.customerName !== f.customer) return false;
    return true;
  });
  result = result.sort((a, b) => new Date(b.productionDate) - new Date(a.productionDate));

  const hasFilter = Object.keys(f).length > 0;
  const filtered = hasFilter ? result : result.slice(0, 20);

  const by = (keyFn, init, add) =>
    Object.values(filtered.reduce((acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = init(key, item);
      add(acc[key], item);
      return acc;
    }, {}));

  const customers = by((i) => i.customerName || "Unknown",
    (k) => ({ customerName: k, weight: 0, waste: 0 }),
    (g, i) => { g.weight += Number(i.actualNetWeight || 0); g.waste += Number(i.totalWaste || 0); });

  const mills = by((i) => i.mill || "Unknown",
    (k) => ({ mill: k, weight: 0, waste: 0 }),
    (g, i) => { g.weight += Number(i.actualNetWeight || 0); g.waste += Number(i.totalWaste || 0); });

  const workOrders = by((i) => i.efiWoNumber || "Unknown",
    (k, i) => ({ workOrder: k, customer: i.customerName || "Unknown", weight: 0, waste: 0, plannedQty: 0, output: 0, achievedQty: 0 }),
    (g, item) => {
      const output = Number(item.productionOutput || 0);
      const ups = Array.isArray(item.ups) ? Number(item.ups.find((v) => Number(v) > 0) || 0) : Number(item.ups || 0);
      g.weight += Number(item.actualNetWeight || 0);
      g.waste += Number(item.totalWaste || 0);
      g.plannedQty = Number(item.plannedQty || 0);
      g.output += output;
      g.achievedQty += output * ups;
    });

  return { filteredCount: filtered.length, customers, mills, workOrders };
}

// ---------------- comparison (numbers may differ only in float noise) ----------------
const near = (a, b) => Math.abs(a - b) < 1e-6;

function compare(a, b) {
  const problems = [];
  if (a.filteredCount !== b.filteredCount) problems.push(`record count: old ${a.filteredCount} vs new ${b.filteredCount}`);

  const cmp = (name, x, y, keys, labelKey) => {
    if (x.length !== y.length) problems.push(`${name}: ${x.length} rows (old) vs ${y.length} rows (new)`);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      if (String(x[i][labelKey]) !== String(y[i][labelKey])) {
        problems.push(`${name} row ${i + 1}: old "${x[i][labelKey]}" vs new "${y[i][labelKey]}" (order/name)`);
        continue;
      }
      keys.forEach((k) => {
        const same = typeof x[i][k] === "number" ? near(x[i][k], y[i][k]) : String(x[i][k]) === String(y[i][k]);
        if (!same) problems.push(`${name} "${x[i][labelKey]}" ${k}: old ${x[i][k]} vs new ${y[i][k]}`);
      });
    }
  };

  cmp("Customer", a.customers, b.customers, ["weight", "waste"], "customerName");
  cmp("Mill", a.mills, b.mills, ["weight", "waste"], "mill");
  cmp("Work order", a.workOrders, b.workOrders, ["customer", "weight", "waste", "plannedQty", "output", "achievedQty"], "workOrder");
  return problems;
}

module.exports = { oldLogic, compare };

// ---------------- run ----------------
if (require.main === module) {
  (async () => {
    if (!routesPath) { console.error("Give the production routes file path."); process.exit(1); }
    await mongoose.connect(MONGO_URI);
    const Production = require(require("path").resolve("./models/Production"));
    const WorkOrder = require(require("path").resolve("./models/WorkOrder"));
    const router = require(require("path").resolve(routesPath));

    const production = await Production.find().sort({ createdAt: -1 }).lean();
    const planner = await WorkOrder.find({}, { efiWoNumber: 1, qtyInLvs: 1 }).lean();

    // JSON round trip = exactly what the old page received from the API
    const prodJson = JSON.parse(JSON.stringify(production));
    const planJson = JSON.parse(JSON.stringify(planner));
    const old = oldLogic(prodJson, planJson, query);

    const fresh = await new Promise((resolve, reject) => {
      router.getSummaryReport(
        { query },
        { json: (d) => resolve(d), status: () => ({ json: (d) => reject(new Error(JSON.stringify(d))) }) }
      );
    });
    const neu = {
      filteredCount: fresh.filteredCount,
      customers: fresh.customers,
      mills: fresh.mills,
      workOrders: fresh.workOrders,
    };

    const problems = compare(old, neu);
    console.log("Filters:", Object.keys(query).length ? JSON.stringify(query) : "(none -> latest 20)");
    console.log(`Old page: ${old.filteredCount} records, ${old.customers.length} customers, ${old.mills.length} mills, ${old.workOrders.length} work orders`);
    console.log(`Server  : ${neu.filteredCount} records, ${neu.customers.length} customers, ${neu.mills.length} mills, ${neu.workOrders.length} work orders`);
    if (problems.length === 0) console.log("\nMATCH: every row, order and total is the same.");
    else { console.log("\nDIFFERENCES:"); problems.slice(0, 40).forEach((p) => console.log(" - " + p)); }
    process.exit(problems.length ? 2 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}