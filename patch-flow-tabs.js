// Usage: node patch-flow-tabs.js <Newindent.jsx>   (run after patch-newindent.js and patch-flow-detail.js)
const fs = require("fs");
const f = process.argv[2];
let s = fs.readFileSync(f, "utf8");
if (!s.includes("flowSel")) { console.log("Run patch-flow-detail.js first."); process.exit(1); }
if (s.includes("flowData")) { console.log("Already patched."); process.exit(0); }
fs.writeFileSync(f + ".bak3", s);
const NL = s.includes("\r\n") ? "\r\n" : "\n";
const fix = (x) => x.replace(/\r?\n/g, NL);

const HELPERS = `const QC_RX_UI = /(^|\\W)(qc|quality)/i;
const flatDoc = (v, p, out) => {
  if (v === null || v === undefined) { out[p] = ""; return out; }
  if (Array.isArray(v)) {
    if (!v.length) out[p] = "";
    v.forEach((x, i) => flatDoc(x, p + "[" + (i + 1) + "]", out));
    return out;
  }
  if (typeof v === "object") {
    Object.keys(v).forEach((k) => flatDoc(v[k], p ? p + "." + k : k, out));
    return out;
  }
  out[p] = /^\\d{4}-\\d\\d-\\d\\dT/.test(String(v)) ? new Date(v).toLocaleString("en-IN") : String(v);
  return out;
};
const FlowKV = ({ doc }) => {
  if (!doc) return <div className="py-2">No record yet for this stage.</div>;
  const rows = Object.entries(flatDoc(doc, "", {}));
  return (
    <div className="table-responsive" style={{ maxHeight: 340 }}>
      <table className="table table-bordered table-sm mb-0 bg-white">
        <thead><tr><th style={{ width: "30%" }}>Field</th><th>Value</th></tr></thead>
        <tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
      </table>
    </div>
  );
};
const FlowList = ({ docs }) => {
  if (!docs || !docs.length) return <div className="py-2">No entries yet for this stage.</div>;
  const flats = docs.map((d) => flatDoc(d, "", {}));
  const cols = [];
  flats.forEach((o) => Object.keys(o).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
  return (
    <div className="table-responsive" style={{ maxHeight: 340 }}>
      <table className="table table-bordered table-sm mb-0 bg-white">
        <thead><tr><th>#</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{flats.map((o, i) => <tr key={i}><td>{i + 1}</td>{cols.map((c) => <td key={c}>{o[c] ?? ""}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
};
`;

const DETAILFN = `  const fetchFlowDetail = async (indentNo) => {
    if (flowData[indentNo] && !flowData[indentNo].error) return;
    try {
      const r = await axios.get(\`\${BASE_URL}/api/tracking/detail\`, { headers: { Authorization: \`Bearer \${token}\` }, params: { indentNo } });
      setFlowData((p) => ({ ...p, [indentNo]: r.data }));
    } catch {
      setFlowData((p) => ({ ...p, [indentNo]: { error: true } }));
    }
  };
  const fetchFlow = async () => {`;

const PANEL = `{(() => {
                        if (!flowSel.startsWith(ind.indentNo + "|")) return null;
                        const tab = flowSel.split("|")[1];
                        const d = flowData[ind.indentNo];
                        const isQc = (p) => (p.machiness || []).some((m) => QC_RX_UI.test(m.activityName || ""));
                        let body = <div className="py-2">Loading...</div>;
                        if (d && d.error) body = <div className="py-2">Could not load details.</div>;
                        else if (d) {
                          if (tab === "indent") body = <FlowKV doc={d.indent} />;
                          else if (tab === "po") body = <FlowKV doc={d.order} />;
                          else if (tab === "planner") body = <FlowKV doc={d.workOrder} />;
                          else if (tab === "production") body = <FlowList docs={(d.production || []).filter((p) => !isQc(p))} />;
                          else if (tab === "qc") body = <FlowList docs={(d.production || []).filter(isQc)} />;
                          else if (tab === "dispatch") body = <FlowList docs={d.dispatch} />;
                        }
                        return (
                          <div className="mt-2">
                            <div className="d-flex flex-wrap gap-1 align-items-center mb-1">
                              {fl.stages.map((x) => (
                                <button key={x.key} type="button" className={"btn btn-sm " + (x.key === tab ? "btn-export" : "btn-outline-secondary")}
                                  onClick={() => setFlowSel(ind.indentNo + "|" + x.key)}>{x.label}</button>
                              ))}
                              <button type="button" className="btn-action-delete ms-auto" onClick={() => setFlowSel("")}>Close</button>
                            </div>
                            {body}
                          </div>
                        );
                      })()}`;

// replace the earlier simple table block
const a0 = s.indexOf("{(() => {" + NL + "                        const sel = fl.stages.find");
if (a0 < 0) { console.log("ABORT: earlier detail block not found"); process.exit(1); }
const endMark = "})()}";
const a1 = s.indexOf(endMark, a0) + endMark.length;
s = s.slice(0, a0) + fix(PANEL) + s.slice(a1);

const edits = [
  [`  const [flowSel, setFlowSel] = useState("");`, `  const [flowSel, setFlowSel] = useState("");\n  const [flowData, setFlowData] = useState({});`],
  [`  const fetchFlow = async () => {`, DETAILFN],
  [`onDoubleClick={() => setFlowSel(flowSel === ind.indentNo + "|" + st.key ? "" : ind.indentNo + "|" + st.key)}`,
   `onDoubleClick={() => { setFlowSel(ind.indentNo + "|" + st.key); fetchFlowDetail(ind.indentNo); }}`],
  [`const PIPE = {`, HELPERS + `const PIPE = {`],
];
for (let [a, b] of edits) {
  a = fix(a); b = fix(b);
  const n = s.split(a).length - 1;
  if (n !== 1) { console.log("ABORT: expected 1 match, found " + n + " for:\n" + a.slice(0, 80)); process.exit(1); }
  s = s.replace(a, () => b);
}
fs.writeFileSync(f, s);
console.log("Patched " + f);
