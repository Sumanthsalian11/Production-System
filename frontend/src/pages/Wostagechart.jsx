import axios from "axios";
import BASE_URL from "../config/api";

const fmtD = (v) => (v ? new Date(v).toLocaleDateString("en-IN") : "-");
const fmtDT = (v) =>
  v ? new Date(v).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "-";

/* Builds the same Stage & Machine Flow tree as the Production Report page.
   complete = the LAST stage of the item's stage list has entries and its total
   (all machines added together) has reached the order qty. */
export async function fetchWoStageTree(woNo, token) {
  const headers = { Authorization: `Bearer ${token}` };
  const [rowsRes, stagesRes, actsRes] = await Promise.all([
    axios.get(`${BASE_URL}/api/production-real`, {
      headers,
      params: { workOrderExact: woNo, machineStatus: "PRODUCTION" }
    }),
    axios.get(`${BASE_URL}/api/master/item-stages`, { headers }),
    axios.get(`${BASE_URL}/api/master/activities`, { headers })
  ]);

  const rows = (rowsRes.data || []).map((item) => ({
    customerName: item.customerName,
    orderQty: item.orderQty,
    productType: item.productType,
    productionDate: item.productionDate,
    createdAt: item.createdAt,
    productionQty: Number(item.productionQty) || 0,
    createdMs: item.machineStatus === "PRODUCTION" ? new Date(item.createdAt).getTime() : 0,
    pairs: (item.machiness || []).map((p) => ({
      act: String(p.activityId?._id || p.activityId || ""),
      actName: p.activityId?.activityName || "",
      machine: p.machineId?.machineName || "Unassigned"
    }))
  }));

  if (!rows.length) return { workOrder: woNo, empty: true, complete: false, stages: [] };

  const itemStages = stagesRes.data || [];
  const activities = actsRes.data || [];

  const typeKey = String(rows.find((r) => r.productType)?.productType || "").trim().toUpperCase();

  let latestMs = -1;
  rows.forEach((r) => { if (r.createdMs > latestMs) latestMs = r.createdMs; });

  const acts = new Map();
  const recentActs = new Set();
  const recentKeys = new Set();

  rows.forEach((r) => {
    r.pairs.forEach(({ act, actName, machine }) => {
      if (!act) return;
      let a = acts.get(act);
      if (!a) {
        a = { id: act, name: "", qty: 0, lastMs: -1, prodDate: null, entryDate: null, machines: new Map() };
        acts.set(act, a);
      }
      if (actName && !a.name) a.name = actName;
      a.qty += r.productionQty;
      if (r.createdMs >= a.lastMs) { a.lastMs = r.createdMs; a.prodDate = r.productionDate; a.entryDate = r.createdAt; }
      let m = a.machines.get(machine);
      if (!m) {
        m = { name: machine, qty: 0, lastMs: -1, prodDate: null, entryDate: null };
        a.machines.set(machine, m);
      }
      m.qty += r.productionQty;
      if (r.createdMs >= m.lastMs) { m.lastMs = r.createdMs; m.prodDate = r.productionDate; m.entryDate = r.createdAt; }
      if (r.createdMs === latestMs) { recentActs.add(act); recentKeys.add(act + "|" + machine); }
    });
  });

  // stages from Item Stages (in order); activities not in the list are added at the end
  const rec = itemStages.find((s) => String(s.itemName || "").trim().toUpperCase() === typeKey);
  let stages = [];
  if (rec?.stages?.length) {
    stages = [...rec.stages]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: String(s.activityId?._id || s.activityId || ""), name: s.activityId?.activityName || "" }));
  }
  const listed = new Set(stages.map((s) => s.id));
  [...acts.values()]
    .filter((a) => !listed.has(a.id))
    .sort((a, b) => a.lastMs - b.lastMs)
    .forEach((a) => stages.push({ id: a.id, name: a.name }));

  const built = stages.map((s, i) => {
    const a = acts.get(s.id);
    return {
      id: s.id,
      label: activities.find((x) => String(x._id) === s.id)?.activityName || s.name || a?.name || `Stage ${i + 1}`,
      has: !!a,
      qty: a?.qty || 0,
      prodDate: a?.prodDate,
      entryDate: a?.entryDate,
      recent: recentActs.has(s.id),
      machines: a
        ? [...a.machines.values()]
            .sort((x, y) => x.lastMs - y.lastMs)
            .map((m) => ({ ...m, recent: recentKeys.has(s.id + "|" + m.name) }))
        : []
    };
  });

  const orderQty = Number(rows[0].orderQty) || 0;
  const last = built[built.length - 1];
  const lastQty = last && last.has ? last.qty : 0;

  return {
    workOrder: woNo,
    empty: false,
    customer: rows[0].customerName,
    orderQty,
    productType: rows.find((r) => r.productType)?.productType || "-",
    total: lastQty,                         // last stage total
    complete: orderQty > 0 && lastQty >= orderQty,
    stages: built
  };
}

/* Popup that shows the tree (same look as Production Report) */
export default function WoStageChartModal({ woNo, tree, onClose }) {
  return (
    <div className="wt-backdrop" onClick={onClose}>
      <style>{`
        .wt-backdrop{position:fixed;inset:0;background:rgba(6,40,61,.55);z-index:3000;display:flex;align-items:center;justify-content:center;padding:16px}
        .wt-modal{background:#fff;border-radius:12px;width:min(96vw,1400px);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.35)}
        .wt-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#a9dcf3;border-radius:12px 12px 0 0;color:#06324d}
        .wt-legend{padding:8px 16px;font-size:12px;color:#475569}
        .wt-legend span{display:inline-block;width:12px;height:12px;background:#c9f7c9;border:1px solid #2e9e3f;border-radius:3px;vertical-align:middle;margin-right:6px}
        .wt-scroll{overflow:auto;padding:12px 20px 24px}
        .wt-node{display:flex;flex-direction:column;align-items:center;position:relative;padding:20px 8px 0}
        .wt-node.root{padding:0}
        .wt-children{display:flex;justify-content:center;position:relative;padding-top:20px;width:max-content;margin:0 auto}
        .wt-children::before{content:"";position:absolute;top:0;left:50%;border-left:2px solid #6aa7c4;height:20px}
        .wt-children>.wt-node::before,.wt-children>.wt-node::after{content:"";position:absolute;top:0;right:50%;width:50%;height:20px;border-top:2px solid #6aa7c4}
        .wt-children>.wt-node::after{right:auto;left:50%;border-left:2px solid #6aa7c4}
        .wt-children>.wt-node:first-child::before,.wt-children>.wt-node:last-child::after{border-top:0 none}
        .wt-children>.wt-node:last-child::before{border-right:2px solid #6aa7c4}
        .wt-children>.wt-node:only-child::before{display:none}
        .wt-children>.wt-node:only-child::after{border-top:0;border-left:2px solid #6aa7c4}
        .wt-box{min-width:170px;border:2px solid #0877ad;border-radius:8px;background:#fff;padding:8px 10px;font-size:12px;text-align:center;line-height:1.5;color:#08283d}
        .wt-box .wt-title{font-weight:800;font-size:13px;margin-bottom:2px}
        .wt-wo{background:#bfe6f8;min-width:260px}
        .wt-mach{border-style:solid;border-color:#7aa7bd;background:#f7fbfe}
        .wt-box.recent{background:#c9f7c9;border-color:#2e9e3f}
        .wt-box.empty{background:#f1f3f5;border:2px dashed #aab;color:#777}
        .wt-done{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:800;background:#c9f7c9;color:#07583b;border:1px solid #2e9e3f}
      `}</style>

      <div className="wt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wt-head">
          <strong>Work Order #{woNo} - Stage &amp; Machine Flow</strong>
          <button type="button" className="btn btn-sm btn-danger" onClick={onClose}>Close</button>
        </div>

        {!tree ? (
          <div className="p-4 text-center text-muted">Loading...</div>
        ) : tree.empty ? (
          <div className="p-4 text-center text-muted">No production entries for this work order yet.</div>
        ) : (
          <>
            <div className="wt-legend">
              <span></span>Light green = stage / machine of the latest production entry
              {tree.complete && <b className="wt-done">Complete - last stage reached order qty</b>}
            </div>
            <div className="wt-scroll">
              <div className="wt-node root">
                <div className="wt-box wt-wo">
                  <div className="wt-title">WO #{tree.workOrder}</div>
                  <div>{tree.customer}</div>
                  <div>Product type: {tree.productType}</div>
                  <div>
                    Order Qty: {Number(tree.orderQty || 0).toLocaleString("en-IN")} | Production:{" "}
                    {Number(tree.total || 0).toLocaleString("en-IN")}
                  </div>
                </div>

                <div className="wt-children">
                  {tree.stages.map((s, i) => (
                    <div className="wt-node" key={s.id || i}>
                      <div className={"wt-box" + (s.recent ? " recent" : "") + (s.has ? "" : " empty")}>
                        <div className="wt-title">S{i + 1}: {s.label}</div>
                        {s.has ? (
                          <>
                            <div>Qty: {s.qty.toLocaleString("en-IN")}</div>
                            <div>Production date: {fmtD(s.prodDate)}</div>
                            <div>Entry date: {fmtDT(s.entryDate)}</div>
                          </>
                        ) : (
                          <div>No entry yet</div>
                        )}
                      </div>

                      {s.machines.length > 0 && (
                        <div className="wt-children">
                          {s.machines.map((m) => (
                            <div className="wt-node" key={m.name}>
                              <div className={"wt-box wt-mach" + (m.recent ? " recent" : "")}>
                                <div className="wt-title">{m.name}</div>
                                <div>Qty: {m.qty.toLocaleString("en-IN")}</div>
                                <div>Production date: {fmtD(m.prodDate)}</div>
                                <div>Entry date: {fmtDT(m.entryDate)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}