// Usage: node patch-flow-detail.js <Newindent.jsx>   (run after patch-newindent.js)
const fs = require("fs");
const f = process.argv[2];
let s = fs.readFileSync(f, "utf8");
if (!s.includes("fetchFlow")) { console.log("Run patch-newindent.js first."); process.exit(1); }
if (s.includes("flowSel")) { console.log("Already patched."); process.exit(0); }
fs.writeFileSync(f + ".bak2", s);
const NL = s.includes("\r\n") ? "\r\n" : "\n";
const TABLE = `                        })}
                      </div>
                      {(() => {
                        const sel = fl.stages.find((x) => ind.indentNo + "|" + x.key === flowSel);
                        if (!sel) return null;
                        return (
                          <div className="mt-2">
                            <b>{sel.label} - details</b>
                            <table className="table table-bordered table-sm mb-0 mt-1 bg-white">
                              <thead><tr><th style={{ width: "30%" }}>Field</th><th>Value</th></tr></thead>
                              <tbody>
                                {sel.lines.map((ln, q) => {
                                  const k = ln.indexOf(": ");
                                  return (
                                    <tr key={q}>
                                      <td>{k > -1 ? ln.slice(0, k) : "-"}</td>
                                      <td>{k > -1 ? ln.slice(k + 2) : ln}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}`;
const edits = [
  [`  const [flow, setFlow] = useState({});`, `  const [flow, setFlow] = useState({});\n  const [flowSel, setFlowSel] = useState("");`],
  [`<div key={st.key} style={{ flex: "1 1 0", minWidth: 150,`,
   `<div key={st.key} title="Double-click for details" onDoubleClick={() => setFlowSel(flowSel === ind.indentNo + "|" + st.key ? "" : ind.indentNo + "|" + st.key)} style={{ cursor: "pointer", flex: "1 1 0", minWidth: 150,`],
  [`                        })}\n                      </div>\n                    </div>\n                  );\n                })()}`, TABLE],
];
for (let [a, b] of edits) {
  a = a.replace(/\n/g, NL); b = b.replace(/\n/g, NL);
  const n = s.split(a).length - 1;
  if (n !== 1) { console.log("ABORT: expected 1 match, found " + n + " for:\n" + a.slice(0, 80)); process.exit(1); }
  s = s.replace(a, () => b);
}
fs.writeFileSync(f, s);
console.log("Patched " + f);
