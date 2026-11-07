import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BASE_URL from "../config/api";

function PoField({ icon, label, alwaysFloat, filled, caret, className = "", children }) {
  return (
    <div className={className}>
      <div className={`po-field ${filled || alwaysFloat ? "is-floated" : ""}`}>
        {icon && <i className={`bi ${icon} po-field-icon`}></i>}
        {children}
        <label className="po-field-label">{label}</label>
        {caret && <i className="bi bi-chevron-down po-caret"></i>}
      </div>
    </div>
  );
}

const has = (v) => v !== "" && v !== null && v !== undefined;
const norm = (v) => String(v ?? "").trim();
const truncateText = (t, n = 30) => (!t ? "-" : t.length > n ? t.substring(0, n) + "..." : t);
const isImgFile = (p) => /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(String(p || ""));
const isPdfFile = (p) => /\.pdf(\?.*)?$/i.test(String(p || ""));
const awBadge = (s) =>
  "custom-badge " +
  (s === "Approved" ? "badge-approved" : s === "Rejected" ? "badge-rejected" : s === "Pending" ? "badge-pending" : "badge-secondary");

const repoVersionsOf = (ind) => {
  const it = ind.items?.[0] || {};
  const vers = it.artworkVersions || [];
  if (vers.length) return vers;
  if (it.artwork?.filePath) {
    return [{
      version: 1, fileName: it.artwork.fileName, filePath: it.artwork.filePath,
      note: "Earlier upload", status: "Approved", comment: "",
      uploadedBy: ind.user || "", uploadedAt: ind.createdAt
    }];
  }
  return [];
};

export default function ArtworkRepository() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [indents, setIndents] = useState([]);
  const [repoQ, setRepoQ] = useState("");
  const [repoStatus, setRepoStatus] = useState("");
  const [repoAll, setRepoAll] = useState(false);
  const [repoSel, setRepoSel] = useState("");
  const [repoTotal, setRepoTotal] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null); // { url, name }

  useEffect(() => { if (!repoSel) setRepoTotal(false); }, [repoSel]);

  const fetchIndents = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/newindent`, { headers: { Authorization: `Bearer ${token}` } });
      setIndents(res.data);
    } catch {
      setIndents([]);
    }
  };
  useEffect(() => {
    fetchIndents();
    const t = setInterval(() => { if (!document.hidden) fetchIndents(); }, 60000);
    return () => clearInterval(t);
  }, []);

  const repoRows = useMemo(() => {
    const q = repoQ.trim().toLowerCase();
    const groups = {};
    indents.forEach((ind) => {
      const it = ind.items?.[0] || {};
      const gk = [it.customerName, it.productCode, it.materialType, it.description]
        .map((x) => norm(x).toLowerCase()).join("|");
      repoVersionsOf(ind).forEach((v, idx) => {
        if (!groups[gk]) groups[gk] = { it, list: [] };
        groups[gk].list.push({ ind, v, key: ind._id + "|" + idx });
      });
    });
    const out = [];
    Object.values(groups).forEach((g) => {
      const sorted = g.list.sort((a, b) => new Date(a.v.uploadedAt || 0) - new Date(b.v.uploadedAt || 0));
      const rank = { Approved: 3, Rejected: 2, Pending: 1, Superseded: 0 };
      const best = new Map();
      const usedIn = {};
      sorted.forEach((x) => {
        const k = x.v.filePath || x.v.fileName;
        (usedIn[k] = usedIn[k] || []).push(x.ind.indentNo);
        const cur = best.get(k);
        if (!cur || (rank[x.v.status] ?? 0) >= (rank[cur.v.status] ?? 0)) best.set(k, x);
      });
      const all = sorted
        .filter((x) => best.get(x.v.filePath || x.v.fileName) === x)
        .map((x) => ({ ...x, usedIn: usedIn[x.v.filePath || x.v.fileName] }));
      const shown = all
        .filter((x) => repoAll || repoStatus === "Superseded" || x.v.status !== "Superseded")
        .filter((x) => !repoStatus || x.v.status === repoStatus);
      if (!shown.length) return;
      const hay = [g.it.customerName, g.it.description, g.it.productCode, g.it.materialType,
        ...all.map((x) => x.ind.indentNo + " " + x.v.fileName)].join(" ").toLowerCase();
      if (q && !hay.includes(q)) return;
      const latest = shown[shown.length - 1];
      const indentKeys = {};
      g.list.forEach((x) => { indentKeys[x.ind.indentNo] = x.key; });
      out.push({ ...latest, it: g.it, all, list: g.list, count: all.length, indentKeys });
    });
    return out;
  }, [indents, repoQ, repoStatus, repoAll]);

  const renderModal = () => {
    if (!repoSel) return null;
    const grp = repoRows.find((r) => r.list.some((x) => x.key === repoSel));
    const cur = grp?.list.find((x) => x.key === repoSel);
    const ind = cur?.ind;
    const all = cur ? grp.list.filter((x) => x.ind._id === cur.ind._id) : [];
    const v = cur?.v;
    if (!ind || !v) return null;
    const it = ind.items?.[0] || {};
    const rows = [
      ["Customer", it.customerName], ["Product code", it.productCode], ["Product type", it.materialType],
      ["Description", it.description], ["Job size", it.jobSize], ["Color front", it.colorFront],
      ["Color back", it.colorBack], ["Paper group", it.paperGroup], ["Paper size", it.paperSize],
      ["GSM", it.gsm], ["Quantity", it.quantity],
      ["Delivery date", it.deliveryDate ? new Date(it.deliveryDate).toLocaleDateString("en-IN") : ""],
      ["Location", ind.location?.locationName], ["Notes", it.remark]
    ];

    const chipsOf = (st) => {
      const s = new Set();
      return grp.list
        .filter((x) => x.v.status === st)
        .filter((x) => {
          const k = x.v.version + "|" + (x.v.filePath || x.v.fileName);
          if (s.has(k)) return false;
          s.add(k);
          return true;
        })
        .sort((a, b) => (a.v.version || 0) - (b.v.version || 0));
    };
    const total = new Set(grp.list.map((x) => x.v.filePath || x.v.fileName)).size;
    const VerRow = ({ title, st }) => {
      const list = chipsOf(st);
      if (!list.length) return null;
      return (
        <div className="mt-3">
          <b style={{ textDecoration: "underline" }}>{title}</b>
          <div className="d-flex flex-wrap align-items-center mt-2">
            {list.map((x, i) => (
              <span key={x.key} className="d-inline-flex align-items-center">
                {i > 0 && <span style={{ width: 22, height: 2, background: "#8fbcc7" }} />}
                <button
                  type="button"
                  title={"Indent " + x.ind.indentNo}
                  onClick={() => setRepoSel(x.key)}
                  style={{
                    width: 38, height: 38, borderRadius: "50%", fontWeight: 700, fontSize: 12,
                    cursor: "pointer", color: "#000",
                    border: "2px solid " + (x.key === repoSel ? "#1f9d6b" : st === "Rejected" ? "#d64545" : "#0f5560"),
                    background: x.key === repoSel ? "#d9f2e6" : st === "Rejected" ? "#fbdcdc" : "#fff"
                  }}
                >
                  V{x.v.version}
                </button>
              </span>
            ))}
          </div>
        </div>
      );
    };

    return (
      <div className="trk-overlay" onClick={() => setRepoSel("")}>
        <div className="bar-body trk-panel trk-modal" onClick={(e) => e.stopPropagation()}>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <b>{it.customerName} - {it.description || it.productCode}</b>
            <span className={awBadge(v.status)}>v{v.version} {v.status}</span>
            <button
              type="button"
              className="btn-action-edit ms-auto"
              onClick={() => navigate("/new-in", { state: { openTrack: ind._id } })}
            >
              Open indent {ind.indentNo}
            </button>
            <button type="button" className="btn-action-delete" onClick={() => setRepoSel("")}>Close</button>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6">
              {isImgFile(v.filePath) || isImgFile(v.fileName) ? (
                <a href={BASE_URL + v.filePath} target="_blank" rel="noreferrer" title="Click to open full size">
                  <img src={BASE_URL + v.filePath} alt="Artwork preview"
                    style={{ width: "100%", maxHeight: 420, objectFit: "contain", border: "1px solid #e3e7ec", borderRadius: 8, background: "#f4f6f8" }} />
                </a>
              ) : isPdfFile(v.filePath) || isPdfFile(v.fileName) ? (
                <iframe title="Artwork preview" src={BASE_URL + v.filePath}
                  style={{ width: "100%", height: 420, border: "1px solid #e3e7ec", borderRadius: 8, background: "#f4f6f8" }} />
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center"
                  style={{ height: 200, border: "1px solid #e3e7ec", borderRadius: 8, background: "#f4f6f8" }}>
                  <i className="bi bi-file-earmark-image" style={{ fontSize: 42 }}></i>
                  <small>Browsers cannot preview this file type. Use the file link below to download it.</small>
                </div>
              )}
              <small className="d-block mt-1">
                {v.filePath ? <a href={BASE_URL + v.filePath} target="_blank" rel="noreferrer">{v.fileName}</a> : v.fileName}
                {" | "}{v.uploadedBy || "-"}{" | "}
                {v.uploadedAt ? new Date(v.uploadedAt).toLocaleString("en-IN") : "-"}
              </small>
              {v.note ? <small className="d-block">Note: {v.note}</small> : null}

              <VerRow title="Approved" st="Approved" />
              <VerRow title="Rejected" st="Rejected" />
              <VerRow title="Pending" st="Pending" />
              <div className="mt-3" style={{ cursor: "pointer", userSelect: "none" }}
                title="Double-click to see all version details" onDoubleClick={() => setRepoTotal(true)}>
                <b style={{ textDecoration: "underline" }}>Total version count</b>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{total}</div>
              </div>

              {repoTotal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={(e) => { e.stopPropagation(); setRepoTotal(false); }}>
                  <div onClick={(e) => e.stopPropagation()}
                    style={{ background: "#fff", borderRadius: 8, width: "94vw", maxWidth: 1200, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,.35)" }}>
                    <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #e3e7ec" }}>
                      <b style={{ fontSize: 15 }}>All versions: {it.customerName} - {it.description || it.productCode}</b>
                      <span className="bar-count">{total} version{total === 1 ? "" : "s"}</span>
                      <button type="button" className="btn-action-delete ms-auto" onClick={() => setRepoTotal(false)}>Close</button>
                    </div>
                    <div style={{ overflow: "auto", padding: 12 }}>
                      <table className="table table-bordered table-sm align-middle mb-0" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Ver</th><th>File</th><th>Indent</th><th>Status</th>
                            <th>Uploaded by</th><th>Uploaded at</th><th>Reviewed by</th><th>Reviewed at</th>
                            <th>Reviewer comment</th><th>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...grp.all].sort((a, b) => (a.v.version || 0) - (b.v.version || 0)).map((x) => (
                            <tr key={x.key} style={{ cursor: "pointer" }} title="Click to open this version"
                              onClick={() => { setRepoSel(x.key); setRepoTotal(false); }}>
                              <td className="fw-bold">V{x.v.version}</td>
                              <td>
                                {x.v.filePath ? (
                                  <a href={BASE_URL + x.v.filePath} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{x.v.fileName}</a>
                                ) : x.v.fileName}
                              </td>
                              <td>{x.ind.indentNo}</td>
                              <td><span className={awBadge(x.v.status)}>{x.v.status}</span></td>
                              <td>{x.v.uploadedBy || "-"}</td>
                              <td>{x.v.uploadedAt ? new Date(x.v.uploadedAt).toLocaleString("en-IN") : "-"}</td>
                              <td>{x.v.reviewedBy || "-"}</td>
                              <td>{x.v.reviewedAt ? new Date(x.v.reviewedAt).toLocaleString("en-IN") : "-"}</td>
                              <td>{x.v.comment || "-"}</td>
                              <td>{x.v.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="col-12 col-md-6">
              <table className="table table-bordered table-sm mb-0" style={{ fontSize: 12 }}>
                <tbody>
                  {rows.map(([l, val]) => (
                    <tr key={l}>
                      <th style={{ width: "40%" }}>{l}</th>
                      <td>{has(val) && val !== "" ? String(val) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <b>Versions</b>
            {all.map((x, i) => (
              <button key={i} type="button" className="btn-action-edit" onClick={() => setRepoSel(x.key)}>
                v{x.v.version} {x.v.status}
              </button>
            ))}
          </div>

          {v.comment ? (
            <p className="mt-2 mb-0">Reviewer comment: {v.comment}{v.reviewedBy ? " (" + v.reviewedBy + ")" : ""}</p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .indent-app-container{--ink:#000;position:relative;min-height:100vh;padding:24px 28px 40px;background:#f4f6f8;font-family:'Noto Sans','Segoe UI',system-ui,Arial,sans-serif;font-size:12.5px;color:#000}
        .indent-app-container .text-muted,.indent-app-container small{color:#000!important}
        .indent-app-container a{color:#0f5560;font-weight:600}
        .bar-card{overflow:hidden;border:1px solid #e3e7ec;border-radius:8px;background:#fff;box-shadow:0 1px 3px rgba(16,24,40,.06)}
        .bar-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;background:#fff;border-bottom:1px solid #e3e7ec}
        .bar-head h5{margin:0;font-size:14px;font-weight:700;padding-left:8px;border-left:3px solid #e4572e}
        .bar-body{padding:14px 20px 16px}
        .bar-count{padding:3px 12px;border-radius:999px;background:#f4f6f8;border:1px solid #e3e7ec;font-size:11px;font-weight:600;white-space:nowrap}
        .po-field{position:relative;display:flex;align-items:center;min-height:36px;background:#fff;border:1px solid #cfd6de;border-radius:6px}
        .po-field:focus-within{border-color:#0f5560;box-shadow:0 0 0 3px rgba(15,85,96,.15)}
        .po-field-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:.8rem;pointer-events:none;z-index:1}
        .po-field .po-input{width:100%;min-height:34px;padding:6px 8px 6px 32px;border:none;outline:none;background:transparent;font-family:inherit;font-size:.8rem;font-weight:500;color:#000}
        .po-field select.po-input{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:28px}
        .po-caret{position:absolute;right:10px;font-size:.7rem;pointer-events:none}
        .po-field-label{position:absolute;left:32px;top:50%;transform:translateY(-50%);max-width:calc(100% - 34px);overflow:hidden;text-overflow:ellipsis;padding:0 4px;background:#fff;font-size:.8rem;font-weight:500;white-space:nowrap;pointer-events:none;transition:all .15s ease}
        .po-field:focus-within .po-field-label,.po-field.is-floated .po-field-label{top:0;left:24px;font-size:.62rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
        .custom-table-container{width:100%;max-height:calc(100vh - 260px);overflow:auto;background:#fff}
        .custom-table-container table{margin-bottom:0}
        .custom-table-container thead th{position:sticky;top:0;z-index:2;padding:.7rem .8rem;background:#a9d0d9!important;color:#000!important;border:1px solid #8fbcc7!important;font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap}
        .custom-table-container tbody td{padding:.55rem .8rem;font-size:12px;font-weight:500;vertical-align:middle;background:#fff;color:#000}
        .custom-table-container tbody tr:nth-child(even) td{background:#fafbfc}
        .custom-table-container tbody tr:hover td{background:#fdeee8!important}
        .custom-table-container tbody tr.trk-selected td{background:#fde3d8!important}
        .custom-badge{display:inline-block;padding:.25rem .6rem;border-radius:4px;font-size:11px;font-weight:600;color:#000}
        .badge-pending{background:#fff3d6;border:1px solid #f2d291}
        .badge-approved{background:#d9f2e6;border:1px solid #a9dcc3}
        .badge-rejected{background:#fbdcdc;border:1px solid #f0b4b4}
        .badge-secondary{background:#f1f5f9;border:1px solid #e2e8f0}
        .btn-action-edit{background:#e8f3f6;color:#000;border:1px solid #b9d6dd;font-weight:600;font-size:.75rem;padding:.25rem .7rem;border-radius:6px;cursor:pointer}
        .btn-action-edit:hover{background:#d5e9ee}
        .btn-action-delete{background:#fbdcdc;color:#000;border:1px solid #f0b4b4;font-weight:600;font-size:.75rem;padding:.25rem .7rem;border-radius:6px;cursor:pointer}
        .btn-action-delete:hover{background:#f7c7c7}
        .trk-overlay{position:fixed;inset:0;z-index:1996;display:flex;align-items:center;justify-content:center;background:rgba(11,58,69,.55);backdrop-filter:blur(3px)}
        .trk-modal{width:94vw;max-width:1400px;max-height:90vh;overflow:auto;background:#fff;border-radius:12px;border-top:4px solid #e4572e;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:18px 24px 24px}
      `}</style>

      <div
        className="indent-app-container"
        onClickCapture={(e) => {
          const a = e.target.closest && e.target.closest("a[href]");
          if (!a) return;
          const href = a.getAttribute("href") || "";
          if (!/\.pdf($|\?|#)/i.test(href)) return;
          e.preventDefault();
          e.stopPropagation();
          setPdfPreview({ url: a.href, name: (a.textContent || "").trim() });
        }}
      >
        <div className="bar-card">
          <div className="bar-head">
            <h5>Artwork Repository</h5>
            <span className="bar-count">{repoRows.length} artwork file{repoRows.length === 1 ? "" : "s"}</span>
          </div>

          <div className="bar-body">
            <div className="row g-2 align-items-center">
              <PoField className="col-12 col-lg-5" icon="bi-search" label="Search customer, description or product code" filled={has(repoQ)}>
                <input type="text" className="po-input" value={repoQ} onChange={(e) => setRepoQ(e.target.value)} />
              </PoField>
              <PoField className="col-6 col-lg-3" icon="bi-flag" label="Status" alwaysFloat caret>
                <select className="po-input" value={repoStatus} onChange={(e) => setRepoStatus(e.target.value)}>
                  <option value="">All status</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Superseded">Superseded</option>
                </select>
              </PoField>
              <div className="col-6 col-lg-4">
                <label className="d-flex align-items-center gap-2" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={repoAll} onChange={(e) => setRepoAll(e.target.checked)} />
                  Include superseded versions
                </label>
              </div>
            </div>
          </div>

          <div className="custom-table-container">
            <table className="table table-bordered table-hover align-middle text-center bg-white">
              <thead>
                <tr>
                  <th></th><th>Customer</th><th>Product code</th><th>Product type</th><th>Description</th>
                  <th>Versions</th><th>Indent</th><th>Ver</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {repoRows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-4">No artwork matches.</td></tr>
                ) : (
                  repoRows.map(({ ind, v, key, count, indentKeys }) => {
                    const it = ind.items?.[0] || {};
                    const n = Object.keys(indentKeys).length;
                    return (
                      <tr key={key} className={repoSel === key ? "trk-selected" : ""}
                        style={{ cursor: "pointer" }} onClick={() => setRepoSel(key)}>
                        <td>
                          {isImgFile(v.filePath) || isImgFile(v.fileName) ? (
                            <img src={BASE_URL + v.filePath} alt=""
                              style={{ width: 80, height: 50, objectFit: "contain", borderRadius: 4, background: "#f4f6f8", border: "1px solid #e3e7ec" }} />
                          ) : (
                            <i className="bi bi-file-earmark-image" style={{ fontSize: 22 }}></i>
                          )}
                        </td>
                        <td>{it.customerName || "-"}</td>
                        <td className="fw-semibold">{it.productCode || "-"}</td>
                        <td>{it.materialType || "-"}</td>
                        <td style={{ textAlign: "left" }}>{truncateText(it.description, 50)}</td>
                        <td className="fw-bold">{count}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            className="form-control form-control-sm"
                            style={{ minWidth: 130, fontSize: 12 }}
                            list={"repo-ind-" + key}
                            placeholder={n + " indent" + (n === 1 ? "" : "s") + " - search"}
                            value=""
                            onChange={(e) => {
                              const name = e.target.value.trim();
                              if (indentKeys[name]) setRepoSel(indentKeys[name]);
                            }}
                          />
                          <datalist id={"repo-ind-" + key}>
                            {Object.keys(indentKeys).map((nm) => <option key={nm} value={nm} />)}
                          </datalist>
                        </td>
                        <td>v{v.version}</td>
                        <td><span className={awBadge(v.status)}>{v.status}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {renderModal()}

        {pdfPreview && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 2200, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setPdfPreview(null)}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 8, width: "94vw", maxWidth: 1100, height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
              <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #e3e7ec" }}>
                <i className="bi bi-file-earmark-pdf" style={{ color: "#e4572e" }}></i>
                <b style={{ fontSize: 14 }}>{pdfPreview.name || "PDF"}</b>
                <button type="button" className="btn-action-delete ms-auto" onClick={() => setPdfPreview(null)}>Close</button>
              </div>
              <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
                <iframe title="PDF" src={pdfPreview.url} style={{ width: "100%", height: "100%", border: "none" }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}