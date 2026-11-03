// Usage: node patch-newindent.js <path/to/Newindent.jsx>
const fs = require("fs");
const f = process.argv[2];
if (!f || !fs.existsSync(f)) { console.log("Usage: node patch-newindent.js <Newindent.jsx>"); process.exit(1); }
let s = fs.readFileSync(f, "utf8");
if (s.includes("fetchFlow")) { console.log("Already patched."); process.exit(0); }
fs.writeFileSync(f + ".bak", s);

const STAGE_STRIP = `                </ol>

                {(() => {
                  const fl = flow[ind.indentNo];
                  if (!fl) return null;
                  const CL = { done: ["#d9f2e6", "#1f9d6b"], partial: ["#fff3d6", "#d98a00"], current: ["#fde3d8", "#e4572e"], stopped: ["#fbdcdc", "#d64545"] };
                  return (
                    <div className="mt-2 mb-2">
                      <div className="mb-1"><b>Order flow</b>{fl.woNo ? <> &nbsp;WO <b>{fl.woNo}</b></> : null}{fl.poNo ? <> &nbsp;PO <b>{fl.poNo}</b></> : null} &nbsp;Now: <b>{fl.current}</b></div>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                        {fl.stages.map((st) => {
                          const c = CL[st.state] || ["#f4f6f8", "#b8c0cb"];
                          return (
                            <div key={st.key} style={{ flex: "1 1 0", minWidth: 150, background: c[0], border: "1px solid " + c[1], borderRadius: 6, padding: "6px 10px" }}>
                              <b style={{ color: c[1] }}>{st.label}</b>
                              {st.lines.map((ln, q) => <div key={q} style={{ fontSize: 11.5 }}>{ln}</div>)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
`;

const edits = [
  [`  const [trackErr, setTrackErr] = useState("");`,
   `  const [trackErr, setTrackErr] = useState("");\n  const [flow, setFlow] = useState({});`],
  [`      setIndents(res.data);\n    } catch {\n      setIndents([]);\n    }\n  };`,
   `      setIndents(res.data);\n      fetchFlow();\n    } catch {\n      setIndents([]);\n    }\n  };\n  const fetchFlow = async () => {\n    try {\n      const r = await axios.get(\`\${BASE_URL}/api/tracking\`, { headers: { Authorization: \`Bearer \${token}\` }, params: { limit: 300 } });\n      const m = {};\n      (r.data || []).forEach((x) => { m[x.ref] = x; });\n      setFlow(m);\n    } catch {\n      setFlow({});\n    }\n  };`],
  [`<th>Due</th><th>Stage</th><th>Progress</th><th></th>`,
   `<th>Due</th><th>Stage</th><th>Progress</th><th>WO No</th><th>Live Status</th><th></th>`],
  [`colSpan={9} className="text-center py-4">No indents match`,
   `colSpan={11} className="text-center py-4">No indents match`],
  [`<td><div className="trk-bar"><i style={{ width: \`\${Math.round(((i + 1) / P.length) * 100)}%\` }} /></div></td>`,
   `<td><div className="trk-bar"><i style={{ width: \`\${Math.round(((i + 1) / P.length) * 100)}%\` }} /></div></td>\n                        <td className="fw-bold">{flow[ind.indentNo]?.woNo || "-"}</td>\n                        <td>{flow[ind.indentNo]?.current || "-"}</td>`],
  [`                </ol>\n`, STAGE_STRIP],
];
const NL = s.includes("\r\n") ? "\r\n" : "\n";
for (let [a, b] of edits) {
  a = a.replace(/\n/g, NL); b = b.replace(/\n/g, NL);
  const n = s.split(a).length - 1;
  if (n !== 1) { console.log("ABORT: expected 1 match, found " + n + " for:\n" + a.slice(0, 80)); process.exit(1); }
  s = s.replace(a, () => b);
}
fs.writeFileSync(f, s);
console.log("Patched " + f + " (backup: .bak)");
