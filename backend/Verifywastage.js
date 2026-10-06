/**
 * Compares the new server-side Wastage report with the OLD Wastage page logic on
 * your real data. Writes nothing.
 *
 *   node verifyWastage.js ./routes/productionRoutes.js --latest
 *   node verifyWastage.js ./routes/productionRoutes.js
 *   node verifyWastage.js ./routes/productionRoutes.js --from 2026-09-01 --to 2026-09-30
 *   node verifyWastage.js ./routes/productionRoutes.js --wo 10 --type Production
 *
 * Filters: --wo --date --month --from --to --group --mill --gsm --customer --type --location
 * Use it on a database small enough for the old page to load (it loads everything).
 */
const mongoose = require("mongoose");
try { require("dotenv").config(); } catch { /* optional */ }

const routesPath = process.argv[2];
const latestMode = process.argv.includes("--latest");
const query = {};
["wo", "date", "month", "from", "to", "group", "mill", "gsm", "customer", "type", "location"].forEach((k) => {
  const i = process.argv.indexOf(`--${k}`);
  if (i > -1 && process.argv[i + 1]) query[k] = process.argv[i + 1];
});

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/production-system";

// ---------------- OLD page logic (copied from the current Wastage page) ----------------
const normalizeGroup = (name) => {
  if (!name) return "";
  name = name.trim();
  if (name.startsWith("Non Surface Sized")) return "Non Surface Sized Maplit";
  if (name === "Parachment Paper") return "Parchment Paper";
  return name;
};

function oldLogic(data, f, latest) {
  const normalized = data
    .sort((a, b) => new Date(b.productionDate) - new Date(a.productionDate))
    .map((item) => {
      const groups = [...new Set((item.materials || []).map((m) => normalizeGroup(m.materialGroupDescription)).filter(Boolean))];
      const gsms = [...new Set((item.materials || []).map((m) => (m.gsm ? String(m.gsm) : "")).filter(Boolean))];
      return { ...item, mill: item.mill?.trim() || "", groups, gsms, mills: item.mill ? [item.mill.trim()] : [] };
    });

  if (latest) return normalized.slice(0, 30);

  return normalized.filter((r) => {
    if (!r.productionDate) return false;
    const formatted = new Date(r.productionDate).toISOString().split("T")[0];
    if (f.wo && !String(r.efiWoNumber).includes(f.wo)) return false;
    if (f.date && formatted !== f.date) return false;
    if (f.month && !formatted.startsWith(f.month)) return false;
    if (f.mill && !r.mills.includes(f.mill)) return false;
    if (f.gsm && !r.gsms.includes(f.gsm)) return false;
    if (f.group && !r.groups.includes(f.group)) return false;
    if (f.customer && r.customerName !== f.customer) return false;
    if (f.type && r.productionType !== f.type) return false;
    if (f.from && formatted < f.from) return false;
    if (f.to && formatted > f.to) return false;
    if (f.location && !r.userLocations?.includes(f.location)) return false;
    return true;
  });
}

function compare(oldRows, newRows) {
  const problems = [];
  if (oldRows.length !== newRows.length) problems.push(`record count: old ${oldRows.length} vs new ${newRows.length}`);
  const n = Math.min(oldRows.length, newRows.length);
  for (let i = 0; i < n; i++) {
    if (String(oldRows[i]._id) !== String(newRows[i]._id)) {
      problems.push(`position ${i + 1}: old record ${oldRows[i]._id} (WO ${oldRows[i].efiWoNumber}) vs new ${newRows[i]._id} (WO ${newRows[i].efiWoNumber})`);
      if (problems.length > 20) break;
    }
  }
  return problems;
}

module.exports = { oldLogic, compare };

if (require.main === module) {
  (async () => {
    if (!routesPath) { console.error("Give the production routes file path."); process.exit(1); }
    await mongoose.connect(MONGO_URI);
    const Production = require(require("path").resolve("./models/Production"));
    const router = require(require("path").resolve(routesPath));

    // what the old page received from GET /api/production (newest saved first), as JSON
    const all = JSON.parse(JSON.stringify(await Production.find().sort({ createdAt: -1 }).lean()));
    const oldRows = oldLogic(all, query, latestMode);

    const call = (q) => new Promise((resolve, reject) => {
      router.getWastageRows({ query: q }, {
        json: (d) => resolve(d),
        status: () => ({ json: (d) => reject(new Error(JSON.stringify(d))) })
      });
    });

    let newRows = [];
    let total = 0;
    if (latestMode) {
      const d = await call({ latest: "1" });
      newRows = d.rows; total = d.total;
    } else {
      for (let page = 1; ; page++) {
        const d = await call({ ...query, page: String(page), limit: "500" });
        total = d.total;
        if (!d.rows.length) break;
        newRows.push(...d.rows);
        if (newRows.length >= d.total) break;
      }
    }

    const problems = compare(oldRows, newRows);
    console.log("Mode   :", latestMode ? "latest 30" : "filters " + (Object.keys(query).length ? JSON.stringify(query) : "(none -> all records)"));
    console.log(`Old page: ${oldRows.length} records`);
    console.log(`Server  : ${newRows.length} records (server says total ${total})`);
    if (problems.length === 0) console.log("\nMATCH: same records in the same order.");
    else { console.log("\nDIFFERENCES:"); problems.forEach((p) => console.log(" - " + p)); }
    process.exit(problems.length ? 2 : 0);
  })().catch((e) => { console.error(e); process.exit(1); });
}