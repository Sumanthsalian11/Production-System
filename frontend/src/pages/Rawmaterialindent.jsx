import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

/* =====================================================================
   RAW MATERIAL & INK INDENT PORTAL  (React module, server backed)
   - All data lives in MongoDB through /api/raw-material-indent (see routes/rawMaterialIndent.js).
   - The browser only holds the current page of the board, so crores of rows are fine.
   - Same screens, same classes and same workings as before. Only dependency besides React: "xlsx" (exports).
   ===================================================================== */

const API = `${import.meta.env.VITE_API_URL || ""}/api/raw-material-indent`;
// ONE place to adapt to your login: return the headers your other pages send.
const authHeaders = () => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
async function api(path, { method = "GET", body, form } = {}) {
  const headers = { ...authHeaders() };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, {
    method,
    headers,
    credentials: "include",
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------- HELPERS ------------------------------ */
const formatNum = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Math.round(num).toLocaleString("en-IN");
};
const formatDec = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "0.0";
  return (Math.round(num * 10) / 10).toLocaleString("en-IN");
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const ToastCtx = createContext(() => {});
const useToast = () => useContext(ToastCtx);

const SHEET_TITLES = { MB5B: "MB5B stock sheet", ME2N: "ME2N pending PO sheet" };
const NO_SETTINGS = { criticalDays: 0, lowDays: 0, overstockDays: 1, targetCoverDays: 0, lotSize: 0 };

/* -------------------------------- ICONS ------------------------------- */
const ICONS = {
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chevron: '<polyline points="6 9 12 15 18 9"/>',
  "arrow-up": '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
  "arrow-down": '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      className="rmi-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

/* ------------------------------ STATUS BADGE -------------------------- */
function StatusBadge({ status }) {
  const map = {
    Critical: ["rmi-b-critical", "CRITICAL"],
    Low: ["rmi-b-low", "LOW"],
    Balanced: ["rmi-b-ok", "BALANCED"],
    Overstocked: ["rmi-b-over", "OVERSTOCK"],
  };
  const [cls, label] = map[status] || ["rmi-b-none", "NO DEMAND"];
  return <span className={`rmi-badge ${cls}`}>{label}</span>;
}

/* ------------------------------ SMALL UI PARTS ------------------------ */
const statusClass = (status) => String(status).toLowerCase().replace(/\s+/g, "");

// number box that keeps what you type locally and saves after a short pause / on blur
function CommitInput({ value, onCommit, delay = 600, ...rest }) {
  const [v, setV] = useState(value);
  const timer = useRef(null);
  const last = useRef(value);
  useEffect(() => {
    setV(value);
    last.current = value;
  }, [value]);
  const fire = (val) => {
    clearTimeout(timer.current);
    if (String(val) !== String(last.current)) {
      last.current = val;
      onCommit(val);
    }
  };
  return (
    <input
      {...rest}
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        clearTimeout(timer.current);
        if (delay) timer.current = setTimeout(() => fire(e.target.value), delay);
      }}
      onBlur={(e) => fire(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && fire(e.target.value)}
    />
  );
}

function DropZone({ type, title, hint, log, busy, onFile, step }) {
  const [over, setOver] = useState(false);
  const ref = useRef(null);
  const pick = () => ref.current && ref.current.click();
  return (
    <div
      className={`rmi-drop ${over ? "over" : ""} ${log ? "done" : ""}`}
      role="button"
      tabIndex={0}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f, type);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt"
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          if (f) onFile(f, type);
        }}
      />
      <div className="rmi-drop-icon">
        <Icon name={log ? "check" : "upload"} size={20} />
      </div>
      <div className="rmi-drop-text">
        <div className="rmi-drop-title">
          {step ? <span className="rmi-step">{step}</span> : null}
          {title}
        </div>
        {busy ? (
          <div className="rmi-drop-hint">{typeof busy === "string" ? busy : "Reading file..."}</div>
        ) : log ? (
          <>
            <div className="rmi-drop-hint">
              <strong>{log.fileName}</strong> &bull; {log.at}
            </div>
            <div className="rmi-drop-hint">
              {formatNum(log.used)} rows used{log.extra ? ` (${log.extra})` : ""}
              {log.skipped > 0 ? ` \u2022 ${formatNum(log.skipped)} skipped` : ""}
            </div>
            <div className="rmi-drop-action">Drop or click to replace</div>
          </>
        ) : (
          <>
            <div className="rmi-drop-hint">{hint}</div>
            <div className="rmi-drop-action">Drop a file here or click to choose</div>
          </>
        )}
      </div>
    </div>
  );
}

function CoverBar({ days, status, appSettings }) {
  if (days === null || days === undefined) return <span className="rmi-faint">-</span>;
  const max = Math.max(appSettings.overstockDays * 1.25, 1);
  const pct = Math.min(100, (days / max) * 100);
  return (
    <div className="rmi-cover">
      <span className="rmi-cover-num">{formatDec(days)} d</span>
      <div className="rmi-bar" aria-hidden="true">
        <i className={`rmi-fill s-${statusClass(status)}`} style={{ width: `${pct}%` }} />
        <b style={{ left: `${Math.min(100, (appSettings.criticalDays / max) * 100)}%` }} />
        <b style={{ left: `${Math.min(100, (appSettings.lowDays / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function ToastStack({ toasts, onClose }) {
  return (
    <div className="rmi-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`rmi-toast t-${t.type}`}>
          <span>{t.msg}</span>
          {t.actionLabel && (
            <button
              className="rmi-toast-act"
              onClick={() => {
                t.onAction && t.onAction();
                onClose(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
          <button className="rmi-toast-x" onClick={() => onClose(t.id)} aria-label="Dismiss">
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="rmi-pager">
      <button className="rmi-btn rmi-btn-outline rmi-btn-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button className="rmi-btn rmi-btn-outline rmi-btn-xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

/* ----------------------- COLUMN CONFIRMATION DIALOG ------------------- */
function ImportModal({ draft, onColumn, onApply, onCancel }) {
  const fields = draft.fields;
  const missing = fields.filter((f) => f.required && draft.map[f.key] < 0);
  const mapped = fields.filter((f) => draft.map[f.key] >= 0);
  const preview = draft.preview;

  return (
    <div className="rmi-modal-back" onClick={onCancel}>
      <div className="rmi-modal" role="dialog" aria-modal="true" aria-label="Confirm columns" onClick={(e) => e.stopPropagation()}>
        <div className="rmi-modal-head">
          <div>
            <h3>Check the columns</h3>
            <p>
              {SHEET_TITLES[draft.type]} &bull; {draft.fileName} &bull; {draft.sizeMB} MB
            </p>
          </div>
          <button className="rmi-iconbtn" onClick={onCancel} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="rmi-modal-body">
          <div className={`rmi-detect ${missing.length ? "bad" : "good"}`}>
            <Icon name={missing.length ? "alert" : "check"} size={16} />
            {missing.length
              ? `Choose the column for: ${missing.map((f) => f.label).join(", ")}.`
              : "All required columns were found. Review them below, then apply."}
          </div>

          <div className="rmi-form3">
            {fields.map((f) => (
              <div key={f.key}>
                <label>
                  {f.label}
                  {f.required ? " *" : ""}
                </label>
                <select
                  className={`rmi-input w100 ${f.required && draft.map[f.key] < 0 ? "rmi-invalid" : ""}`}
                  value={draft.map[f.key]}
                  onChange={(e) => onColumn(f.key, e.target.value)}
                >
                  <option value={-1}>- not in sheet -</option>
                  {draft.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `(column ${i + 1})`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {mapped.length > 0 && preview.length > 0 && (
            <div>
              <div className="rmi-sec-head">
                <h4>Preview of the first {preview.length} rows</h4>
              </div>
              <div className="rmi-tablewrap">
                <table className="rmi-table rmi-table-sm">
                  <thead>
                    <tr>
                      {mapped.map((f) => (
                        <th key={f.key}>{f.label.replace(" (optional)", "")}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>
                        {mapped.map((f) => (
                          <td key={f.key}>{r[draft.map[f.key]] || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="rmi-modal-foot">
          <button className="rmi-btn rmi-btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="rmi-btn rmi-btn-primary" onClick={onApply} disabled={missing.length > 0}>
            <Icon name="check" size={14} /> Apply {SHEET_TITLES[draft.type]}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================ FIRST-RUN GUIDE ====================== */
function SetupGuide({ importLog, busyOf, onFile }) {
  return (
    <div className="rmi-guide">
      <h3 className="rmi-guide-title">Load your SAP sheets to start planning</h3>
      <p className="rmi-guide-sub">
        Everything in this portal is built from your Excel files. Drag a file onto a card or click it. You will check
        the detected columns before anything is applied.
      </p>
      <div className="rmi-guide-grid">
        <DropZone
          step="1"
          type="MB5B"
          title="Stock sheet (MB5B)"
          hint="Materials, descriptions and stock per plant. Start here."
          log={importLog.MB5B}
          busy={busyOf("MB5B")}
          onFile={onFile}
        />
        <DropZone
          step="2"
          type="ME2N"
          title="Pending POs (ME2N)"
          hint="Material already on order, with vendor and delivery date."
          log={importLog.ME2N}
          busy={busyOf("ME2N")}
          onFile={onFile}
        />
      </div>
    </div>
  );
}

/* ================================ MAIN ================================= */
export default function RawMaterialIndent() {
  const [activeTab, setActiveTab] = useState("board");
  const [board, setBoard] = useState(null); // last /board response (one page)
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [filters, setFilters] = useState({ search: "", family: "", status: "", onlyShortage: false });
  const [sort, setSort] = useState({ key: "status", dir: "asc" });
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0); // bump to reload server data
  const [groups, setGroups] = useState([]); // [{id, cat, lead, fam}] for dropdowns
  const [vendors, setVendors] = useState([]);
  const [indentCart, setIndentCart] = useState([]);
  const [register, setRegister] = useState({ rows: [], total: 0 });
  const [importDraft, setImportDraft] = useState(null);
  const [reading, setReading] = useState(""); // sheet type being read / imported
  const [progress, setProgress] = useState("");
  const [drawer, setDrawer] = useState({ id: null, open: false, data: null });

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  /* ---- toasts ---- */
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const closeToast = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  const notify = useCallback((msg, opts = {}) => {
    const id = ++toastId.current;
    setToasts((p) => [...p.slice(-3), { id, msg, type: opts.type || "info", actionLabel: opts.actionLabel, onAction: opts.onAction }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), opts.duration || 6000);
  }, []);
  const fail = useCallback((e) => notify(e.message || "Something went wrong.", { type: "warn" }), [notify]);

  /* ---- planning board: filtered, sorted and paginated on the server ---- */
  const search = useDebounced(filters.search, 350);
  const boardQuery = (extra = {}) =>
    new URLSearchParams({
      search, family: filters.family, status: filters.status, onlyShortage: filters.onlyShortage ? "1" : "",
      sort: sort.key, dir: sort.dir, page, ...extra,
    }).toString();
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    setLoadingBoard(true);
    api(`/board?${boardQuery()}`)
      .then((d) => {
        if (my !== seq.current) return;
        setBoard(d);
        if (d.page !== page) setPage(d.page);
      })
      .catch(fail)
      .finally(() => my === seq.current && setLoadingBoard(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters.family, filters.status, filters.onlyShortage, sort, page, version]);

  useEffect(() => {
    api("/groups").then(setGroups).catch(fail);
    api("/vendors").then(setVendors).catch(() => {});
  }, [version, fail]);

  const refreshCart = useCallback(() => api("/cart").then(setIndentCart).catch(fail), [fail]);
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    if (activeTab === "register") api("/indents?limit=100").then(setRegister).catch(fail);
  }, [activeTab, version, fail]);

  /* ---- Esc closes the open dialog or drawer ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (importDraft) setImportDraft(null);
      else if (drawer.open) setDrawer((d) => ({ ...d, open: false }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [importDraft, drawer.open]);

  const appSettings = board ? board.settings : NO_SETTINGS;
  const plants = board ? board.plants : [];
  const importLog = board ? board.importLog : {};
  const changeFilters = (f) => {
    setFilters(f);
    setPage(1);
  };

  /* ---- drawer ---- */
  const loadDrawer = useCallback(
    (id) =>
      api(`/group?id=${encodeURIComponent(id)}`)
        .then((data) => setDrawer((d) => (d.id === id ? { ...d, data } : d)))
        .catch(fail),
    [fail]
  );
  const openMaterialDrawer = (groupId) => {
    setDrawer({ id: groupId, open: true, data: null });
    loadDrawer(groupId);
  };
  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }));

  const updatePlantSplit = async (groupId, plant, value) => {
    try {
      await api("/split", { method: "PUT", body: { group: groupId, plant, pct: value } });
      await loadDrawer(groupId);
      bump();
    } catch (e) {
      fail(e);
    }
  };

  /* ---- cart ---- */
  const cartRef = useRef([]);
  cartRef.current = indentCart;
  const cartTimers = useRef({});
  const saveLine = (line) => api("/cart/line", { method: "PUT", body: line }).catch(fail);

  const addToCartSingle = async (groupId, plant, qty) => {
    try {
      await api("/cart/line", { method: "PUT", body: { groupId, plant, qty } });
      await refreshCart();
      notify(`Added ${formatNum(qty)} KG for plant ${plant} to the cart`, {
        type: "success",
        actionLabel: "View cart",
        onAction: () => setActiveTab("cart"),
      });
    } catch (e) {
      fail(e);
    }
  };

  const addShortages = async (groupId, label) => {
    try {
      const r = await api("/cart/shortages", { method: "POST", body: { groupId } });
      if (!r.added) {
        notify(groupId ? "Nothing to indent for this spec group." : "No material shortages detected requiring indenting.");
        return;
      }
      await refreshCart();
      notify(`${r.added} ${groupId ? `line${r.added === 1 ? "" : "s"} from ${label} added to the cart` : "shortage lines added to the cart"}`, {
        type: "success",
        actionLabel: groupId ? "View cart" : undefined,
        onAction: () => setActiveTab("cart"),
      });
      if (!groupId) setActiveTab("cart");
    } catch (e) {
      fail(e);
    }
  };
  const addGroupShortages = (h) => addShortages(h.group.id, h.group.cat);
  const addAllShortagesToCart = () => addShortages(null);

  const updateCartLine = (i, patch) => {
    const line = { ...cartRef.current[i], ...patch };
    setIndentCart((prev) => prev.map((c, idx) => (idx === i ? line : c)));
    const key = `${line.groupId}|${line.plant}`;
    clearTimeout(cartTimers.current[key]);
    cartTimers.current[key] = setTimeout(() => saveLine(line), 500);
  };

  const removeCartLine = (i) => {
    const line = indentCart[i];
    if (!line) return;
    setIndentCart((prev) => prev.filter((_, idx) => idx !== i));
    api(`/cart/line?groupId=${encodeURIComponent(line.groupId)}&plant=${encodeURIComponent(line.plant)}`, { method: "DELETE" }).catch(fail);
    notify("Line removed from the cart", {
      actionLabel: "Undo",
      onAction: () => saveLine(line).then(refreshCart),
    });
  };

  const clearCart = () => {
    const before = indentCart;
    setIndentCart([]);
    api("/cart", { method: "DELETE" }).catch(fail);
    notify("Cart cleared", {
      actionLabel: "Undo",
      onAction: () => Promise.all(before.map(saveLine)).then(refreshCart),
    });
  };

  const raiseOfficialIndent = async () => {
    if (indentCart.length === 0) return;
    try {
      const r = await api("/indents", { method: "POST" });
      setIndentCart([]);
      setActiveTab("register");
      bump();
      notify(`Indent ${r.indentNo} raised as Draft`, { type: "success" });
    } catch (e) {
      fail(e);
    }
  };

  const setIndentStatus = (indentNo, status) => {
    setRegister((r) => ({ ...r, rows: r.rows.map((x) => (x.indentNo === indentNo ? { ...x, status } : x)) }));
    api(`/indents/${encodeURIComponent(indentNo)}/status`, { method: "PATCH", body: { status } }).catch(fail);
  };

  const exportIndentToExcel = (index) => {
    const indent = register.rows[index];
    const data = indent.lines.map((l) => ({
      "Indent Number": indent.indentNo,
      "Indent Date": indent.date,
      Status: indent.status,
      "Material Specification": l.groupId,
      "Plant Location": l.plant,
      "Quantity (KG)": l.qty,
      Vendor: l.vendor,
      "Required By": l.requiredBy,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Material Indent");
    XLSX.writeFile(wb, `${indent.indentNo}_Material_Indent.xlsx`);
  };

  /* ---- sheet upload (step 1: send file, server detects columns) ---- */
  const handleSapFile = async (file, type) => {
    if (!file) return;
    if (!/\.(xlsx|xlsm|xls|csv|tsv|txt)$/i.test(file.name)) {
      notify("Please choose an Excel or CSV file.", { type: "warn" });
      return;
    }
    setReading(type);
    setProgress("Reading file...");
    try {
      const form = new FormData();
      form.append("file", file);
      const d = await api(`/upload/${type}/preview`, { method: "POST", form });
      setImportDraft(d);
    } catch (e) {
      fail(e);
    }
    setReading("");
    setProgress("");
  };

  const setDraftColumn = (field, value) =>
    setImportDraft((d) => ({ ...d, map: { ...d.map, [field]: parseInt(value) } }));

  /* ---- sheet upload (step 2: server imports in the background, we poll) ---- */
  const applyImport = async () => {
    const d = importDraft;
    if (!d) return;
    setImportDraft(null);
    setReading(d.type);
    setProgress("Importing...");
    try {
      const { jobId } = await api(`/upload/${d.type}/apply`, {
        method: "POST",
        body: { uploadId: d.uploadId, map: d.map, headerRow: d.headerRow, fileName: d.fileName },
      });
      for (;;) {
        await sleep(1000);
        const j = await api(`/upload/job/${jobId}`);
        if (j.state === "running") setProgress(`Importing... ${formatNum(j.rows)} rows read`);
        else if (j.state === "error") throw new Error(j.error);
        else {
          notify(`${SHEET_TITLES[d.type]} loaded: ${formatNum(j.result.used)} rows (${j.result.extra})`, { type: "success" });
          break;
        }
      }
      bump();
    } catch (e) {
      fail(e);
    }
    setReading("");
    setProgress("");
  };
  const busyOf = (type) => (reading === type ? progress || true : false);

  const saveSettings = async (patch) => {
    try {
      await api("/settings", { method: "PUT", body: patch });
      bump();
    } catch (e) {
      fail(e);
    }
  };

  const resetAll = async () => {
    if (!window.confirm("Clear all uploaded sheets, jobs, cart, indents and settings?")) return;
    try {
      await api("/all", { method: "DELETE", body: { confirm: true } });
      setIndentCart([]);
      setBoard(null);
      bump();
      notify("All data cleared.");
    } catch (e) {
      fail(e);
    }
  };

  const exportBoard = async () => {
    try {
      const d = await api(`/board?${boardQuery({ limit: "all" })}`);
      const data = d.rows.map((h) => ({
        "Spec Group": h.group.cat,
        Family: h.group.fam,
        "Main Material": h.group.lead,
        "Mapped Jobs": h.jobNames,
        "Current Stock (KG)": Math.round(h.totalStock),
        "Monthly Req (KG)": Math.round(h.monthlyReq),
        "Pending PO (KG)": Math.round(h.totalPending),
        "Stock Days": h.daysCoverStockOnly === null ? "" : Math.round(h.daysCoverStockOnly * 10) / 10,
        "Total Days": h.daysCoverWithPending === null ? "" : Math.round(h.daysCoverWithPending * 10) / 10,
        "Indent Required (KG)": h.totalIndentRequired,
        Status: h.status,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Planning Board");
      XLSX.writeFile(wb, "Planning_Board.xlsx");
    } catch (e) {
      fail(e);
    }
  };

  /* ---- KPIs ---- */
  const hasMaterials = !!board && board.groupCount > 0;
  const k = board ? board.kpis : {};
  const dash = (v) => (hasMaterials ? v : "-");
  const kpis = [
    { title: "Current stock", val: dash(`${formatNum(k.stock)} KG`), sub: `Across ${plants.length} plant${plants.length === 1 ? "" : "s"}`, icon: "package", tone: "teal" },
    { title: "Pending delivery", val: dash(`${formatNum(k.pending)} KG`), sub: "Open purchase orders", icon: "truck", tone: "blue" },
    { title: "Monthly demand", val: dash(`${formatNum(k.monthlyReq)} KG`), sub: `${k.jobs || 0} job${k.jobs === 1 ? "" : "s"} allocated`, icon: "trend", tone: "green" },
    { title: "Critical / low", val: dash(`${k.critical || 0} group${k.critical === 1 ? "" : "s"}`), sub: `Under ${appSettings.lowDays} days of cover`, icon: "alert", tone: hasMaterials && k.critical > 0 ? "red" : "green" },
    { title: "Recommended indent", val: dash(`${formatNum(k.indent)} KG`), sub: "To reach the target buffer", icon: "cart", tone: "gold" },
  ];

  const tabs = [
    { id: "board", label: "Planning Board", icon: "grid", badge: hasMaterials && k.critical > 0 ? k.critical : 0, badgeTone: "red" },
    { id: "jobs", label: "Job Demand", icon: "layers", badge: 0 },
    { id: "register", label: "Indent Register", icon: "file", badge: 0 },
    { id: "settings", label: "Data & Settings", icon: "sliders", badge: 0 },
  ];

  const selectNumber = (e) => {
    if (e.target && e.target.type === "number" && e.target.select) e.target.select();
  };

  /* ================================ RENDER ============================= */
  return (
    <ToastCtx.Provider value={notify}>
      <div className="rmi-root" onFocus={selectNumber}>
        <style>{CSS + CSS_EXTRA}</style>

        {/* ---------- Header ---------- */}
        <div className="rmi-header">
          <button className="rmi-btn rmi-btn-gold rmi-cart-btn" onClick={() => setActiveTab("cart")}>
            <Icon name="cart" />
            <span>Indent cart</span>
            <span className="rmi-cart-badge">{indentCart.length}</span>
          </button>
        </div>

        {/* ---------- Tabs ---------- */}
        <div className="rmi-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`rmi-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
              {t.badge > 0 && <span className={`rmi-tab-badge b-${t.badgeTone}`}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* ---------- KPI cards ---------- */}
        <div className="rmi-kpis">
          {kpis.map((x) => (
            <div className="rmi-kpi" key={x.title}>
              <div className="rmi-kpi-top">
                <span className="rmi-kpi-title">{x.title}</span>
                <span className={`rmi-kpi-icon tone-${x.tone}`}>
                  <Icon name={x.icon} />
                </span>
              </div>
              <div className="rmi-kpi-val">{x.val}</div>
              <div className="rmi-kpi-sub">{x.sub}</div>
            </div>
          ))}
        </div>

        {/* ---------- Tab content ---------- */}
        <div className="rmi-panel">
          {activeTab === "board" &&
            (!board ? (
              <div className="rmi-note-empty">{loadingBoard ? "Loading..." : "Could not load data."}</div>
            ) : hasMaterials ? (
              <PlanningBoard
                data={board}
                loading={loadingBoard}
                filters={filters}
                setFilters={changeFilters}
                sort={sort}
                setSort={(s) => {
                  setSort(s);
                  setPage(1);
                }}
                page={page}
                setPage={setPage}
                appSettings={appSettings}
                cart={indentCart}
                onOpen={openMaterialDrawer}
                onAddAll={addAllShortagesToCart}
                onAddGroup={addGroupShortages}
                onExport={exportBoard}
                onGoTab={setActiveTab}
              />
            ) : (
              <SetupGuide importLog={importLog} busyOf={busyOf} onFile={handleSapFile} />
            ))}
          {activeTab === "jobs" && <JobPlanner groups={groups} version={version} onChanged={bump} />}
          {activeTab === "cart" && (
            <IndentCart
              cart={indentCart}
              groups={groups}
              vendors={vendors}
              onGoBoard={() => setActiveTab("board")}
              onClear={clearCart}
              onRaise={raiseOfficialIndent}
              onUpdate={updateCartLine}
              onRemove={removeCartLine}
            />
          )}
          {activeTab === "register" && (
            <IndentRegister register={register.rows} total={register.total} groups={groups} onStatus={setIndentStatus} onExport={exportIndentToExcel} />
          )}
          {activeTab === "settings" && (
            <SettingsPage
              settings={appSettings}
              onSave={saveSettings}
              plants={plants}
              families={board ? board.families : []}
              importLog={importLog}
              busyOf={busyOf}
              onFile={handleSapFile}
              version={version}
              onGroupChanged={bump}
              onReset={resetAll}
            />
          )}
        </div>

        {/* ---------- Footer ---------- */}
        <div className="rmi-footer">
          <div>
            <strong>Raw Material Indenting System</strong> &bull; Plants: {plants.length ? plants.join(", ") : "none loaded yet"}
          </div>
          <div>
            Target buffer <strong>{appSettings.targetCoverDays} days</strong> &bull; Lot rounding{" "}
            <strong>{appSettings.lotSize} KG</strong>
          </div>
        </div>

        {/* ---------- Drawer ---------- */}
        <div className={`rmi-backdrop ${drawer.open ? "open" : ""}`} onClick={closeDrawer}>
          <div className="rmi-drawer" role="dialog" aria-modal="true" aria-label="Spec group details" onClick={(e) => e.stopPropagation()}>
            {drawer.id !== null &&
              (drawer.data ? (
                <MaterialDrawer
                  data={drawer.data}
                  appSettings={appSettings}
                  cart={indentCart}
                  onClose={closeDrawer}
                  onSplit={updatePlantSplit}
                  onAddToCart={addToCartSingle}
                  onAddGroup={addGroupShortages}
                />
              ) : (
                <div className="rmi-note-empty">Loading...</div>
              ))}
          </div>
        </div>

        {importDraft && <ImportModal draft={importDraft} onColumn={setDraftColumn} onApply={applyImport} onCancel={() => setImportDraft(null)} />}

        <ToastStack toasts={toasts} onClose={closeToast} />
      </div>
    </ToastCtx.Provider>
  );
}

/* ============================ PLANNING BOARD =========================== */
const STATUS_ORDER = ["Critical", "Low", "Balanced", "Overstocked", "No Demand"];
const STATUS_LABEL = { Critical: "Critical", Low: "Low", Balanced: "Balanced", Overstocked: "Overstock", "No Demand": "No demand" };

function PlanningBoard({
  data, loading, filters, setFilters, sort, setSort, page, setPage, appSettings, cart,
  onOpen, onAddAll, onAddGroup, onExport, onGoTab,
}) {
  const { rows, plants, counts, families, importLog, shortLines, shortKG } = data;

  const toggleSort = (key) =>
    setSort(
      sort.key === key
        ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { key, dir: ["cat", "status", "stockDays", "totalDays"].includes(key) ? "asc" : "desc" }
    );

  const SortTh = ({ k, label, align }) => (
    <th className={align || ""} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className={`rmi-sort ${sort.key === k ? "on" : ""}`} onClick={() => toggleSort(k)}>
        {label}
        {sort.key === k && <Icon name={sort.dir === "asc" ? "arrow-up" : "arrow-down"} size={11} />}
      </button>
    </th>
  );

  const inCartAll = (h) => {
    const lines = plants.filter((p) => h.plantBreakdown[p].indent > 0);
    return (
      lines.length > 0 &&
      lines.every((p) => cart.some((c) => c.groupId === h.group.id && c.plant === p && c.qty === h.plantBreakdown[p].indent))
    );
  };

  const filtersActive = filters.search || filters.family || filters.status || filters.onlyShortage;
  const clearFilters = () => setFilters({ search: "", family: "", status: "", onlyShortage: false });
  const strip = [
    { type: "MB5B", label: "Stock" },
    { type: "ME2N", label: "Pending POs" },
  ];

  return (
    <div>
      {/* data status */}
      <div className="rmi-strip">
        {strip.map((s) => {
          const l = importLog[s.type];
          return (
            <button key={s.type} className={`rmi-datachip ${l ? "ok" : "off"}`} onClick={() => onGoTab("settings")} title="Manage data sources">
              <i />
              <span className="rmi-datachip-name">{s.label}</span>
              <span className="rmi-datachip-meta">{l ? l.at : "not loaded"}</span>
            </button>
          );
        })}
        {data.kpis.jobs === 0 && (
          <button className="rmi-linkbtn" onClick={() => onGoTab("jobs")}>
            Add job demand to get cover days and indent suggestions
          </button>
        )}
      </div>

      {/* status chips */}
      <div className="rmi-chips" role="group" aria-label="Filter by health">
        {[["", "All"], ...STATUS_ORDER.map((s) => [s, STATUS_LABEL[s]])].map(([val, label]) => (
          <button
            key={val || "all"}
            className={`rmi-chip c-${statusClass(val || "all")} ${filters.status === val ? "on" : ""} ${val && !counts[val] ? "zero" : ""}`}
            onClick={() => setFilters({ ...filters, status: val })}
            aria-pressed={filters.status === val}
          >
            {label} <b>{counts[val]}</b>
          </button>
        ))}
      </div>

      {/* filters + actions */}
      <div className="rmi-filterbar">
        <div className="rmi-filters">
          <div className="rmi-search">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Search spec, job or material code"
              aria-label="Search spec groups"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select className="rmi-input" aria-label="Family" value={filters.family} onChange={(e) => setFilters({ ...filters, family: e.target.value })}>
            <option value="">All families</option>
            {families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <label className="rmi-switch">
            <input type="checkbox" checked={filters.onlyShortage} onChange={(e) => setFilters({ ...filters, onlyShortage: e.target.checked })} />
            <span className="rmi-switch-track" />
            <span>Shortages only</span>
          </label>

          {filtersActive && (
            <button className="rmi-linkbtn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="rmi-actions">
          <button className="rmi-btn rmi-btn-outline" onClick={onExport} disabled={data.total === 0}>
            <Icon name="download" size={14} /> Export
          </button>
          <button className="rmi-btn rmi-btn-primary" onClick={onAddAll} disabled={shortLines === 0}>
            <Icon name="cart" size={14} />
            {shortLines > 0 ? `Add all shortages (${shortLines} lines, ${formatNum(shortKG)} KG)` : "No shortages to indent"}
          </button>
        </div>
      </div>

      <div className="rmi-resultline">
        Showing {rows.length} of {formatNum(data.total)} matching spec groups ({formatNum(data.groupCount)} total)
        {loading ? " - updating..." : ""}
      </div>

      <div className={`rmi-tablewrap rmi-sticky ${loading ? "rmi-loading" : ""}`}>
        <table className="rmi-table">
          <thead>
            <tr>
              <SortTh k="cat" label="Spec group" />
              <th>Mapped jobs</th>
              <SortTh k="stock" label="Stock" align="r" />
              <SortTh k="req" label="Monthly req." align="r" />
              <SortTh k="pending" label="Pending PO" align="r" />
              <SortTh k="stockDays" label="Stock days" align="r" />
              <SortTh k="totalDays" label="Total cover" />
              <SortTh k="indent" label="Indent needed" align="r" />
              <SortTh k="status" label="Health" align="c" />
              <th className="c">Cart</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="rmi-empty-row">
                  No spec groups match these filters.{" "}
                  <button className="rmi-linkbtn" onClick={clearFilters}>
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              rows.map((h) => (
                <tr
                  key={h.group.id}
                  className={`rmi-row-click st-${statusClass(h.status)}`}
                  tabIndex={0}
                  onClick={() => onOpen(h.group.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(h.group.id);
                  }}
                >
                  <td>
                    <div className="rmi-strong">{h.group.cat}</div>
                    <div className="rmi-muted rmi-trunc">{h.group.lead}</div>
                    <div className="rmi-link-note">
                      {h.group.matCount} material code{h.group.matCount === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="rmi-jobs-cell">{h.jobNames || <span className="rmi-faint">-</span>}</td>
                  <td className="r rmi-strong">{formatNum(h.totalStock)} KG</td>
                  <td className="r rmi-strong">{h.monthlyReq > 0 ? `${formatNum(h.monthlyReq)} KG` : <span className="rmi-faint">-</span>}</td>
                  <td className="r rmi-indigo">{h.totalPending > 0 ? `+${formatNum(h.totalPending)} KG` : <span className="rmi-faint">-</span>}</td>
                  <td className={`r ${h.daysCoverStockOnly !== null && h.daysCoverStockOnly < appSettings.criticalDays ? "rmi-red rmi-bold" : ""}`}>
                    {h.daysCoverStockOnly !== null ? `${formatDec(h.daysCoverStockOnly)} d` : <span className="rmi-faint">-</span>}
                  </td>
                  <td>
                    <CoverBar days={h.daysCoverWithPending} status={h.status} appSettings={appSettings} />
                  </td>
                  <td className={`r rmi-bold ${h.totalIndentRequired > 0 ? "rmi-gold" : "rmi-faint"}`}>
                    {h.totalIndentRequired > 0 ? `${formatNum(h.totalIndentRequired)} KG` : "-"}
                  </td>
                  <td className="c">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="c" onClick={(e) => e.stopPropagation()}>
                    {h.totalIndentRequired > 0 ? (
                      inCartAll(h) ? (
                        <span className="rmi-incart">
                          <Icon name="check" size={12} /> In cart
                        </span>
                      ) : (
                        <button className="rmi-btn rmi-btn-gold rmi-btn-xs" onClick={() => onAddGroup(h)}>
                          + Add
                        </button>
                      )
                    ) : (
                      <span className="rmi-faint">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager page={data.page} pages={data.pages} onPage={setPage} />
      <div className="rmi-hint">Click a row to see plant split, alternate codes and open POs.</div>
    </div>
  );
}

/* ============================== MATERIAL DRAWER ======================== */
function MaterialDrawer({ data, appSettings, cart, onClose, onSplit, onAddToCart, onAddGroup }) {
  const { health, plants, mats, pos } = data;
  const { group } = health;

  return (
    <>
      <div className="rmi-drawer-head">
        <div>
          <div className="rmi-drawer-kicker">
            {group.fam} &nbsp;
            <StatusBadge status={health.status} />
          </div>
          <h3 className="rmi-drawer-title">{group.cat}</h3>
          <div className="rmi-drawer-lead">{group.lead}</div>
        </div>
        <button className="rmi-drawer-x" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="rmi-drawer-body">
        <div className="rmi-metrics">
          <div>
            <div className="rmi-muted">Total Stock</div>
            <div className="rmi-metric">{formatNum(health.totalStock)} KG</div>
          </div>
          <div>
            <div className="rmi-muted">Pending POs</div>
            <div className="rmi-metric rmi-indigo">+{formatNum(health.totalPending)} KG</div>
          </div>
          <div>
            <div className="rmi-muted">Monthly Req.</div>
            <div className="rmi-metric">{formatNum(health.monthlyReq)} KG</div>
          </div>
          <div>
            <div className="rmi-muted">Total Cover</div>
            <div className={`rmi-metric ${health.daysCoverWithPending < appSettings.criticalDays ? "rmi-red" : "rmi-green"}`}>
              {health.daysCoverWithPending !== null ? `${formatDec(health.daysCoverWithPending)} Days` : "N/A"}
            </div>
          </div>
        </div>

        {/* Multi-location breakdown */}
        <div>
          <div className="rmi-sec-head">
            <h4>Multi-Location Indent Breakdown &amp; Stock Balance</h4>
            <span className="rmi-muted">Adjust demand % split across plants</span>
          </div>
          <div className="rmi-tablewrap">
            <table className="rmi-table rmi-table-sm">
              <thead>
                <tr>
                  <th>Plant Location</th>
                  <th className="c">Req Share %</th>
                  <th className="r">Current Stock</th>
                  <th className="r">Pending PO</th>
                  <th className="r">Target ({appSettings.targetCoverDays}d)</th>
                  <th className="r">Indent Rec.</th>
                  <th className="c">Action</th>
                </tr>
              </thead>
              <tbody>
                {plants.map((p) => {
                  const pb = health.plantBreakdown[p];
                  const currentSplit = health.plantSplits[p] || 0;
                  const hasSurplusElsewhere = plants.some((other) => other !== p && health.plantBreakdown[other].surplus > 0);
                  return (
                    <tr key={p}>
                      <td className="rmi-strong">Plant {p}</td>
                      <td className="c">
                        <CommitInput
                          type="number"
                          min="0"
                          max="100"
                          value={currentSplit}
                          onCommit={(v) => onSplit(group.id, p, v)}
                          className="rmi-input rmi-num-sm"
                        />{" "}
                        %
                      </td>
                      <td className="r">{formatNum(pb.stock)} KG</td>
                      <td className="r rmi-indigo">{pb.pending > 0 ? `+${formatNum(pb.pending)}` : "-"}</td>
                      <td className="r rmi-strong">{formatNum(pb.targetNeed)} KG</td>
                      <td className={`r rmi-bold ${pb.indent > 0 ? "rmi-gold" : "rmi-faint"}`}>
                        {pb.indent > 0 ? `${formatNum(pb.indent)} KG` : "-"}
                        {pb.indent > 0 && hasSurplusElsewhere && (
                          <div className="rmi-transfer">
                            <Icon name="refresh" size={10} /> Transfer available
                          </div>
                        )}
                      </td>
                      <td className="c">
                        {pb.indent > 0 && cart.some((c) => c.groupId === group.id && c.plant === p && c.qty === pb.indent) ? (
                          <span className="rmi-incart">
                            <Icon name="check" size={12} /> In cart
                          </span>
                        ) : pb.indent > 0 ? (
                          <button className="rmi-btn rmi-btn-gold rmi-btn-xs" onClick={() => onAddToCart(group.id, p, pb.indent)}>
                            + Cart
                          </button>
                        ) : (
                          <span className="rmi-faint rmi-xs">Balanced</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alternate codes */}
        <div>
          <div className="rmi-sec-head">
            <h4>Alternate Interchangeable Codes in Group</h4>
            {data.matsTruncated && <span className="rmi-muted">Showing first {mats.length} of {formatNum(group.matCount)}</span>}
          </div>
          <div className="rmi-tablewrap rmi-scroll">
            <table className="rmi-table rmi-table-sm">
              <thead>
                <tr>
                  <th>SAP Code</th>
                  <th>Material Description</th>
                  {plants.map((p) => (
                    <th key={p} className="r">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mats.map((m) => (
                  <tr key={m.c}>
                    <td className="rmi-mono rmi-bold">{m.c}</td>
                    <td>{m.s}</td>
                    {plants.map((p) => (
                      <td key={p} className="r">{m.st && m.st[p] ? formatNum(m.st[p]) : "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Open POs */}
        <div>
          <div className="rmi-sec-head">
            <h4>Active Open Purchase Orders (PO)</h4>
          </div>
          {pos.length === 0 ? (
            <div className="rmi-note-empty">No active pending POs for this material spec group.</div>
          ) : (
            <div className="rmi-tablewrap rmi-scroll">
              <table className="rmi-table rmi-table-sm">
                <thead>
                  <tr>
                    <th>PO Document</th>
                    <th>Vendor</th>
                    <th>Plant</th>
                    <th className="r">Quantity</th>
                    <th className="r">ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po, i) => (
                    <tr key={`${po.poNo}-${po.m}-${po.p}-${i}`}>
                      <td className="rmi-mono">{po.poNo}</td>
                      <td>{po.v || "-"}</td>
                      <td className="rmi-strong">{po.p}</td>
                      <td className="r rmi-indigo rmi-bold">{formatNum(po.q)} KG</td>
                      <td className="r">{po.e || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rmi-drawer-foot">
        <span className="rmi-muted">Plant split changes apply immediately.</span>
        <div className="rmi-actions">
          {health.totalIndentRequired > 0 && (
            <button className="rmi-btn rmi-btn-gold" onClick={() => onAddGroup(health)}>
              <Icon name="cart" size={14} /> Add all shortages ({formatNum(health.totalIndentRequired)} KG)
            </button>
          )}
          <button className="rmi-btn rmi-btn-dark" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ============================ JOB DEMAND PLANNER ======================= */
function JobPlanner({ groups, version, onChanged }) {
  const notify = useToast();
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [kg, setKg] = useState("");
  const [list, setList] = useState({ rows: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const search = useDebounced(term, 350);

  const load = useCallback(
    () =>
      api(`/jobs?${new URLSearchParams({ page, search })}`)
        .then(setList)
        .catch((e) => notify(e.message, { type: "warn" })),
    [page, search, notify]
  );
  useEffect(() => {
    load();
  }, [load, version]);

  const done = () => {
    load();
    onChanged();
  };
  const run = (p) => p.then(done).catch((e) => notify(e.message, { type: "warn" }));

  const handleAdd = () => {
    const kgNum = parseFloat(kg);
    const gid = groupId || (groups[0] && groups[0].id);
    if (!name || !kgNum || !gid) {
      notify("Enter a job title, choose a spec group and enter the monthly KG.", { type: "warn" });
      return;
    }
    run(api("/jobs", { method: "POST", body: { name, groupGroupId: gid, kg: kgNum } }).then(() => {
      notify(`Job "${name}" added`, { type: "success" });
      setName("");
      setKg("");
    }));
  };
  const onUpdate = (id, patch) => run(api(`/jobs/${id}`, { method: "PATCH", body: patch }));
  const onDelete = (job) =>
    run(
      api(`/jobs/${job.id}`, { method: "DELETE" }).then(() =>
        notify(`Job "${job.name}" removed`, {
          actionLabel: "Undo",
          onAction: () => run(api("/jobs", { method: "POST", body: { name: job.name, groupGroupId: job.groupGroupId, kg: job.kg } })),
        })
      )
    );
  const onShift = (id, targetGroupId, pct) =>
    run(
      api(`/jobs/${id}/shift`, { method: "POST", body: { targetGroupId, pct } }).then((r) =>
        notify(`${formatNum(r.shifted)} KG shifted to ${targetGroupId}`, { type: "success" })
      )
    );

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <div>
          <h3 className="rmi-h3">Job demand</h3>
          <p className="rmi-muted">
            Monthly KG per job drives cover days and indent suggestions. {formatNum(list.total)} job{list.total === 1 ? "" : "s"} loaded.
          </p>
        </div>
        <div className="rmi-search" style={{ maxWidth: 260 }}>
          <Icon name="search" size={14} />
          <input type="text" placeholder="Search job or spec group" aria-label="Search jobs" value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="rmi-callout">
        <Icon name="info" size={16} />
        <div>
          Use <strong>Shift</strong> to move a share of a job to another spec group (for example from 170 GSM to 130 GSM).
          Stock health and indent suggestions update straight away.
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rmi-note-empty">Upload the MB5B stock sheet first. Spec groups are built from the materials in it.</div>
      ) : (
        <div className="rmi-card">
          <h4 className="rmi-card-title">Add New Job Demand</h4>
          <div className="rmi-addjob">
            <div className="span2">
              <label>Job Title / Customer</label>
              <input type="text" className="rmi-input w100" placeholder="e.g. HDFC COVER PAGES" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label>Material Spec Group</label>
              <select className="rmi-input w100" value={groupId || groups[0].id} onChange={(e) => setGroupId(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Monthly Req. (KG)</label>
              <input type="number" className="rmi-input w100" placeholder="e.g. 5000" value={kg} onChange={(e) => setKg(e.target.value)} />
            </div>
            <div className="rmi-addjob-btn">
              <button className="rmi-btn rmi-btn-primary w100" onClick={handleAdd}>
                <Icon name="plus" size={14} /> Add Job
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rmi-tablewrap">
        <table className="rmi-table">
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Assigned Material Spec Group</th>
              <th className="r">Monthly Demand (KG)</th>
              <th className="c">Shift Demand Spec</th>
              <th className="c">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="rmi-empty-row">
                  No jobs yet. Add a job using the form above.
                </td>
              </tr>
            ) : (
              list.rows.map((j) => <JobRow key={j.id} job={j} groups={groups} onUpdate={onUpdate} onDelete={onDelete} onShift={onShift} />)
            )}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pages={list.pages} onPage={setPage} />
    </div>
  );
}

function JobRow({ job, groups, onUpdate, onDelete, onShift }) {
  const [shiftTarget, setShiftTarget] = useState("");
  const [shiftPct, setShiftPct] = useState(50);
  const known = groups.some((g) => g.id === job.groupGroupId);
  const target = shiftTarget || (groups[0] && groups[0].id) || "";

  return (
    <tr>
      <td>
        <CommitInput type="text" delay={0} value={job.name} onCommit={(v) => onUpdate(job.id, { name: v })} className="rmi-inline-input" />
      </td>
      <td>
        <select className="rmi-input" value={job.groupGroupId} onChange={(e) => onUpdate(job.id, { groupGroupId: e.target.value })}>
          {!known && <option value={job.groupGroupId}>{job.groupGroupId} (not in current sheets)</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.cat}
            </option>
          ))}
        </select>
      </td>
      <td className="r">
        <CommitInput type="number" delay={0} value={job.kg} onCommit={(v) => onUpdate(job.id, { kg: parseFloat(v) || 0 })} className="rmi-input rmi-num-md r" /> KG
      </td>
      <td className="c">
        <div className="rmi-shift">
          <select className="rmi-input" value={target} onChange={(e) => setShiftTarget(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.cat}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="100"
            value={shiftPct}
            onChange={(e) => setShiftPct(parseFloat(e.target.value))}
            className="rmi-input rmi-num-sm"
          />{" "}
          %
          <button className="rmi-btn rmi-btn-light rmi-btn-xs" disabled={!target} onClick={() => onShift(job.id, target, shiftPct)}>
            Shift
          </button>
        </div>
      </td>
      <td className="c">
        <button className="rmi-iconbtn rmi-red" onClick={() => onDelete(job)} title="Delete job">
          <Icon name="trash" size={14} />
        </button>
      </td>
    </tr>
  );
}

/* ================================ INDENT CART ========================== */
function IndentCart({ cart, groups, vendors, onGoBoard, onClear, onRaise, onUpdate, onRemove }) {
  if (cart.length === 0) {
    return (
      <div className="rmi-empty">
        <div className="rmi-empty-icon">
          <Icon name="cart" size={26} />
        </div>
        <h4>Your indent cart is empty</h4>
        <p>Add shortages from the Planning Board to build a purchase requisition.</p>
        <button className="rmi-btn rmi-btn-primary" onClick={onGoBoard}>
          Go to Planning Board
        </button>
      </div>
    );
  }

  const totalCartKG = cart.reduce((a, c) => a + c.qty, 0);
  const byPlant = {};
  cart.forEach((c) => {
    byPlant[c.plant] = (byPlant[c.plant] || 0) + c.qty;
  });
  const noVendor = cart.filter((c) => !c.vendor).length;

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <div>
          <h3 className="rmi-h3">Review purchase indent</h3>
          <p className="rmi-muted">Set quantities, vendors and delivery dates, then raise the indent.</p>
        </div>
        <div className="rmi-actions">
          <button className="rmi-btn rmi-btn-outline" onClick={onClear}>
            Clear cart
          </button>
          <button className="rmi-btn rmi-btn-primary" onClick={onRaise}>
            <Icon name="send" size={14} /> Raise material indent
          </button>
        </div>
      </div>

      <div className="rmi-tiles">
        <div className="rmi-tile">
          <span>Lines</span>
          <strong>{cart.length}</strong>
        </div>
        <div className="rmi-tile">
          <span>Total quantity</span>
          <strong>{formatNum(totalCartKG)} KG</strong>
        </div>
        {Object.entries(byPlant).map(([p, kg]) => (
          <div className="rmi-tile" key={p}>
            <span>Plant {p}</span>
            <strong>{formatNum(kg)} KG</strong>
          </div>
        ))}
      </div>

      {noVendor > 0 && (
        <div className="rmi-callout">
          <Icon name="info" size={16} />
          <div>
            {noVendor} line{noVendor === 1 ? " has" : "s have"} no vendor yet. You can still raise the indent and add vendors later.
          </div>
        </div>
      )}

      <datalist id="rmi-vendors">
        {vendors.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      <div className="rmi-tablewrap">
        <table className="rmi-table">
          <thead>
            <tr>
              <th>Spec group</th>
              <th>Plant</th>
              <th className="r">Quantity</th>
              <th>Vendor</th>
              <th>Required by</th>
              <th className="c">Remove</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((c, i) => {
              const group = groups.find((g) => g.id === c.groupId);
              return (
                <tr key={`${c.groupId}-${c.plant}`}>
                  <td>
                    <div className="rmi-strong">{group ? group.cat : c.groupId}</div>
                    <div className="rmi-muted">{group ? group.lead : ""}</div>
                  </td>
                  <td className="rmi-strong">Plant {c.plant}</td>
                  <td className="r">
                    <input
                      type="number"
                      min="0"
                      value={c.qty}
                      aria-label="Indent quantity"
                      onChange={(e) => onUpdate(i, { qty: parseFloat(e.target.value) || 0 })}
                      className="rmi-input rmi-num-md r"
                    />{" "}
                    KG
                  </td>
                  <td>
                    <input
                      type="text"
                      list="rmi-vendors"
                      className="rmi-input w100"
                      placeholder="Type or pick a vendor"
                      aria-label="Vendor"
                      value={c.vendor}
                      onChange={(e) => onUpdate(i, { vendor: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      className="rmi-input"
                      aria-label="Required delivery date"
                      value={c.requiredBy}
                      onChange={(e) => onUpdate(i, { requiredBy: e.target.value })}
                    />
                  </td>
                  <td className="c">
                    <button className="rmi-iconbtn rmi-red" onClick={() => onRemove(i)} title="Remove line" aria-label="Remove line">
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================== INDENT REGISTER ======================== */
function IndentRegister({ register, total, groups, onStatus, onExport }) {
  const [closed, setClosed] = useState({});

  if (register.length === 0) {
    return (
      <div className="rmi-empty">
        <div className="rmi-empty-icon">
          <Icon name="inbox" size={26} />
        </div>
        <h4>No indents raised yet</h4>
        <p>Indents you raise from the cart will be listed here, newest first.</p>
      </div>
    );
  }

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <h3 className="rmi-h3">Raised indents</h3>
        <span className="rmi-muted">
          {total} total{total > register.length ? ` (latest ${register.length} shown)` : ""}
        </span>
      </div>

      {register.map((r, idx) => {
        const isClosed = !!closed[r.indentNo];
        return (
          <div className="rmi-card" key={r.indentNo}>
            <div className="rmi-reg-head">
              <button
                className="rmi-reg-toggle"
                onClick={() => setClosed((c) => ({ ...c, [r.indentNo]: !c[r.indentNo] }))}
                aria-expanded={!isClosed}
              >
                <span className={`rmi-caret ${isClosed ? "" : "open"}`}>
                  <Icon name="chevron" size={14} />
                </span>
                <span className="rmi-reg-no">{r.indentNo}</span>
                <span className="rmi-muted">{r.date}</span>
                <span className="rmi-strong">
                  {r.lines.length} line{r.lines.length === 1 ? "" : "s"} &bull; {formatNum(r.totalKG)} KG
                </span>
              </button>
              <div className="rmi-actions">
                <select
                  className={`rmi-input rmi-bold rmi-stat s-${statusClass(r.status)}`}
                  value={r.status}
                  aria-label="Indent status"
                  onChange={(e) => onStatus(r.indentNo, e.target.value)}
                >
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="PO Placed">PO Placed</option>
                  <option value="Closed">Closed</option>
                </select>
                <button className="rmi-btn rmi-btn-green rmi-btn-xs" onClick={() => onExport(idx)}>
                  <Icon name="download" size={12} /> Export
                </button>
              </div>
            </div>

            {!isClosed && (
              <div className="rmi-tablewrap rmi-bg-white">
                <table className="rmi-table rmi-table-sm">
                  <thead>
                    <tr>
                      <th>Spec group</th>
                      <th>Plant</th>
                      <th className="r">Quantity</th>
                      <th>Vendor</th>
                      <th>Required by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((l) => {
                      const group = groups.find((g) => g.id === l.groupId);
                      return (
                        <tr key={`${l.groupId}-${l.plant}`}>
                          <td className="rmi-strong">{group ? group.cat : l.groupId}</td>
                          <td>Plant {l.plant}</td>
                          <td className="r rmi-strong">{formatNum(l.qty)} KG</td>
                          <td>{l.vendor || <span className="rmi-faint">Not set</span>}</td>
                          <td>{l.requiredBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================ SETTINGS ============================= */
function SettingsPage({ settings, onSave, plants, families, importLog, busyOf, onFile, version, onGroupChanged, onReset }) {
  const notify = useToast();
  const [meta, setMeta] = useState({ units: [], types: [] });
  const [matSearch, setMatSearch] = useState("");
  const [matPage, setMatPage] = useState(1);
  const [mats, setMats] = useState({ rows: [], hasMore: false });
  const q = useDebounced(matSearch, 350);

  useEffect(() => {
    api("/meta").then(setMeta).catch(() => {});
  }, [version]);
  useEffect(() => {
    api(`/materials?${new URLSearchParams({ search: q, page: matPage })}`)
      .then(setMats)
      .catch((e) => notify(e.message, { type: "warn" }));
  }, [q, matPage, version, notify]);

  const num = (key) => (v) => onSave({ [key]: parseFloat(v) });
  const types = settings.materialTypes || [];
  const toggleType = (t) => onSave({ materialTypes: types.includes(t) ? types.filter((x) => x !== t) : [...types, t] });
  const lots = settings.familyLots || [];
  const setLot = (family, v) =>
    onSave({ familyLots: [...lots.filter((l) => l.family !== family), { family, lot: parseFloat(v) }] });

  const saveGroup = async (code, group) => {
    try {
      await api("/material-group", { method: "PUT", body: { material: code, group } });
      onGroupChanged();
    } catch (e) {
      notify(e.message, { type: "warn" });
    }
  };

  return (
    <div className="rmi-stack">
      <div className="rmi-sec-top">
        <div>
          <h3 className="rmi-h3">Data &amp; settings</h3>
          <p className="rmi-muted">Load your sheets, tune the planning rules and correct spec groups.</p>
        </div>
      </div>

      <div className="rmi-card">
        <h4 className="rmi-card-title">Excel sheets</h4>
        <p className="rmi-muted rmi-mb">
          A new upload replaces the previous one of the same kind (the old data stays until the new file is fully loaded).
          Large files are read in the background; .xlsx, .csv and tab separated SAP exports are supported.
        </p>
        <div className="rmi-guide-grid">
          <DropZone type="MB5B" title="Stock sheet (MB5B)" hint="Materials, descriptions and stock per plant." log={importLog.MB5B} busy={busyOf("MB5B")} onFile={onFile} />
          <DropZone type="ME2N" title="Pending POs (ME2N)" hint="Material on order, vendor and delivery date." log={importLog.ME2N} busy={busyOf("ME2N")} onFile={onFile} />
        </div>
      </div>

      <div className="rmi-card">
        <h4 className="rmi-card-title">Planning rules</h4>
        <div className="rmi-form3">
          <div>
            <label>Working days per month</label>
            <CommitInput type="number" className="rmi-input w100" value={settings.workingDays} onCommit={num("workingDays")} />
          </div>
          <div>
            <label>Target buffer cover (days)</label>
            <CommitInput type="number" className="rmi-input w100" value={settings.targetCoverDays} onCommit={num("targetCoverDays")} />
          </div>
          <div>
            <label>Lot rounding size (KG)</label>
            <CommitInput type="number" className="rmi-input w100" value={settings.lotSize} onCommit={num("lotSize")} />
          </div>
          <div>
            <label>Critical below (days of cover)</label>
            <CommitInput type="number" className="rmi-input w100" value={settings.criticalDays} onCommit={num("criticalDays")} />
          </div>
          <div>
            <label>Low below (days of cover)</label>
            <CommitInput type="number" className="rmi-input w100" value={settings.lowDays} onCommit={num("lowDays")} />
          </div>
          <div>
            <label>Overstock above (days of cover)</label>
            <CommitInput type="number" className="rmi-input w100" value={settings.overstockDays} onCommit={num("overstockDays")} />
          </div>
          <div>
            <label>Main plant (gets 100% by default)</label>
            <select className="rmi-input w100" value={settings.mainPlant || ""} onChange={(e) => onSave({ mainPlant: e.target.value })}>
              <option value="">First plant found</option>
              {plants.map((p) => (
                <option key={p} value={p}>
                  Plant {p}
                </option>
              ))}
            </select>
          </div>
          <div className="rmi-span2">
            <label>Units planned (comma separated)</label>
            <CommitInput
              type="text"
              delay={0}
              className="rmi-input w100"
              value={(settings.planningUnits || []).join(", ")}
              onCommit={(v) => onSave({ planningUnits: v.split(",").map((x) => x.trim()).filter(Boolean) })}
            />
            <div className="rmi-muted">
              Units found in the stock sheet: {meta.units.length ? meta.units.map((u) => `${u.unit} (${formatNum(u.rows)})`).join(", ") : "-"}. Leave empty to plan every unit.
            </div>
          </div>
        </div>

        {meta.types.length > 0 && (
          <div className="rmi-mt">
            <label className="rmi-muted">Material types planned (none ticked = all)</label>
            <div className="rmi-chkgrid">
              {meta.types.map((t) => (
                <label key={t.type} className="rmi-check">
                  <input type="checkbox" checked={types.includes(t.type)} onChange={() => toggleType(t.type)} />
                  {t.type}
                </label>
              ))}
            </div>
          </div>
        )}

        {families.length > 0 && (
          <div className="rmi-mt">
            <label className="rmi-muted">Lot rounding per family (blank = the lot size above)</label>
            <div className="rmi-form3">
              {families.map((f) => {
                const l = lots.find((x) => x.family === f);
                return (
                  <div key={f}>
                    <label>{f}</label>
                    <CommitInput type="number" delay={0} className="rmi-input w100" value={l ? l.lot : ""} onCommit={(v) => parseFloat(v) > 0 && setLot(f, v)} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="rmi-card">
        <h4 className="rmi-card-title">Spec groups</h4>
        <p className="rmi-muted rmi-mb">
          Groups come from a "Spec group" column if your sheet has one. Otherwise they are the material group plus the GSM
          read from the description. Retype the group of any material to correct it. Materials with the same group name are
          planned together.
        </p>
        <div className="rmi-search rmi-mb">
          <Icon name="search" size={14} />
          <input
            type="text"
            placeholder="Search material code, description or group"
            aria-label="Search materials"
            value={matSearch}
            onChange={(e) => {
              setMatSearch(e.target.value);
              setMatPage(1);
            }}
          />
        </div>
        <div className="rmi-tablewrap rmi-scroll">
          <table className="rmi-table rmi-table-sm">
            <thead>
              <tr>
                <th>SAP code</th>
                <th>Material description</th>
                <th>Spec group</th>
              </tr>
            </thead>
            <tbody>
              {mats.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="rmi-empty-row">
                    No materials loaded yet.
                  </td>
                </tr>
              ) : (
                mats.rows.map((r) => (
                  <tr key={`${r.code}-${r.group}`}>
                    <td className="rmi-mono rmi-bold">{r.code}</td>
                    <td>{r.desc}</td>
                    <td>
                      <input
                        type="text"
                        className="rmi-input w100"
                        aria-label={`Spec group for ${r.code}`}
                        defaultValue={r.group}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v.toUpperCase() !== r.group) saveGroup(r.code, v);
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="rmi-pager">
          <button className="rmi-btn rmi-btn-outline rmi-btn-xs" disabled={matPage <= 1} onClick={() => setMatPage(matPage - 1)}>
            Previous
          </button>
          <span>Page {matPage}</span>
          <button className="rmi-btn rmi-btn-outline rmi-btn-xs" disabled={!mats.hasMore} onClick={() => setMatPage(matPage + 1)}>
            Next
          </button>
        </div>
      </div>

      <div className="rmi-card rmi-danger">
        <div className="rmi-sec-top rmi-nobar">
          <div>
            <h4 className="rmi-card-title">Saved data</h4>
            <p className="rmi-muted">Removes uploaded sheets, jobs, cart, indents and settings.</p>
          </div>
          <button className="rmi-btn rmi-btn-outline rmi-btn-danger" onClick={onReset}>
            <Icon name="trash" size={14} /> Clear all data
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================== CSS ================================ */
// >>> Paste the full CSS from your current file here (everything that was between the backticks of
//     `const CSS = \`...\`;`). It is unchanged. The two small additions below go in CSS_EXTRA.
/* ================================== CSS ================================ */
const CSS = `
:root {
  --rmi-bg: #f8fafc;
  --rmi-surface: #ffffff;
  --rmi-border: #e2e8f0;
  --rmi-border-focus: #3b82f6;
  --rmi-text: #1e293b;
  --rmi-muted: #64748b;
  --rmi-faint: #94a3b8;
  --rmi-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.rmi-root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--rmi-text);
  background: var(--rmi-bg);
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
}
.rmi-root * {
  box-sizing: border-box;
}

/* Typography & Utilities */
.rmi-strong { font-weight: 600; color: var(--rmi-text); }
.rmi-bold { font-weight: 700; }
.rmi-muted { color: var(--rmi-muted); font-size: 12px; }
.rmi-faint { color: var(--rmi-faint); }
.rmi-mono { font-family: var(--rmi-mono); font-size: 12px; }
.rmi-trunc { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rmi-link-note { font-size: 11px; color: #2563eb; margin-top: 2px; }
.rmi-xs { font-size: 11px; }
.rmi-mb { margin-bottom: 16px; }
.rmi-mt { margin-top: 16px; }
.rmi-span2 { grid-column: span 2; }
.w100 { width: 100%; }
.r { text-align: right; }
.c { text-align: center; }

/* Colors */
.rmi-indigo { color: #4f46e5; }
.rmi-red { color: #dc2626; }
.rmi-green { color: #16a34a; }
.rmi-gold { color: #d97706; }

/* Icons */
.rmi-icon { display: inline-block; vertical-align: middle; flex-shrink: 0; }

/* Header */
.rmi-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 16px;
}
.rmi-cart-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.rmi-cart-badge {
  background: #1e293b;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

/* Tabs */
.rmi-tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--rmi-border);
  margin-bottom: 20px;
  overflow-x: auto;
}
.rmi-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: none;
  background: transparent;
  color: var(--rmi-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0;
  transition: all 0.15s;
}
.rmi-tab:hover {
  color: var(--rmi-text);
  background: #f1f5f9;
}
.rmi-tab.active {
  color: #2563eb;
  font-weight: 600;
  border-bottom-color: #2563eb;
  background: #ffffff;
}
.rmi-tab-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 9999px;
}
.rmi-tab-badge.b-red { background: #fee2e2; color: #dc2626; }
.rmi-tab-badge.b-gold { background: #fef3c7; color: #d97706; }

/* KPI Cards */
.rmi-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.rmi-kpi {
  background: var(--rmi-surface);
  border: 1px solid var(--rmi-border);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.rmi-kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.rmi-kpi-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--rmi-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.rmi-kpi-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rmi-kpi-icon.tone-teal { background: #ccfbf1; color: #0d9488; }
.rmi-kpi-icon.tone-blue { background: #dbeafe; color: #2563eb; }
.rmi-kpi-icon.tone-green { background: #dcfce7; color: #16a34a; }
.rmi-kpi-icon.tone-red { background: #fee2e2; color: #dc2626; }
.rmi-kpi-icon.tone-gold { background: #fef3c7; color: #d97706; }
.rmi-kpi-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--rmi-text);
  margin-bottom: 4px;
}
.rmi-kpi-sub {
  font-size: 12px;
  color: var(--rmi-muted);
}

/* Panel */
.rmi-panel {
  background: var(--rmi-surface);
  border: 1px solid var(--rmi-border);
  border-radius: 10px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  min-height: 480px;
  margin-bottom: 24px;
}

/* Data Source Strip */
.rmi-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.rmi-datachip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid var(--rmi-border);
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.15s;
}
.rmi-datachip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}
.rmi-datachip.ok i { background: #16a34a; }
.rmi-datachip.ok { background: #f0fdf4; border-color: #bbf7d0; }
.rmi-datachip-name { font-weight: 600; color: var(--rmi-text); }
.rmi-datachip-meta { color: var(--rmi-muted); }

/* Health Filter Chips */
.rmi-chips {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.rmi-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  border: 1px solid var(--rmi-border);
  background: #f8fafc;
  color: var(--rmi-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.rmi-chip b {
  background: #e2e8f0;
  color: #1e293b;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
}
.rmi-chip.zero { opacity: 0.5; }
.rmi-chip.c-all.on { background: #1e293b; color: #fff; border-color: #1e293b; }
.rmi-chip.c-all.on b { background: #475569; color: #fff; }
.rmi-chip.c-critical.on { background: #fef2f2; color: #dc2626; border-color: #fca5a5; }
.rmi-chip.c-critical.on b { background: #fee2e2; color: #dc2626; }
.rmi-chip.c-low.on { background: #fffbeb; color: #d97706; border-color: #fde68a; }
.rmi-chip.c-low.on b { background: #fef3c7; color: #d97706; }
.rmi-chip.c-balanced.on { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.rmi-chip.c-balanced.on b { background: #dcfce7; color: #16a34a; }
.rmi-chip.c-overstocked.on, .rmi-chip.c-overstock.on { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.rmi-chip.c-overstocked.on b, .rmi-chip.c-overstock.on b { background: #dbeafe; color: #2563eb; }
.rmi-chip.c-nodemand.on { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }

/* Filter Bar & Controls */
.rmi-filterbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.rmi-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  flex-wrap: wrap;
}
.rmi-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.rmi-search {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 250px;
}
.rmi-search svg {
  position: absolute;
  left: 10px;
  color: var(--rmi-muted);
  pointer-events: none;
}
.rmi-search input {
  width: 100%;
  padding: 8px 12px 8px 32px;
  font-size: 13px;
  border: 1px solid var(--rmi-border);
  border-radius: 6px;
  outline: none;
  background: #ffffff;
}
.rmi-search input:focus {
  border-color: var(--rmi-border-focus);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
.rmi-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.rmi-switch input { display: none; }
.rmi-switch-track {
  width: 34px;
  height: 18px;
  background: #cbd5e1;
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}
.rmi-switch-track::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.rmi-switch input:checked + .rmi-switch-track { background: #2563eb; }
.rmi-switch input:checked + .rmi-switch-track::after { transform: translateX(16px); }

.rmi-linkbtn {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.rmi-resultline {
  font-size: 12px;
  color: var(--rmi-muted);
  margin-bottom: 8px;
}

/* Tables */
.rmi-tablewrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--rmi-border);
  border-radius: 8px;
}
.rmi-tablewrap.rmi-sticky thead {
  position: sticky;
  top: 0;
  z-index: 5;
  background: #f8fafc;
}
.rmi-tablewrap.rmi-scroll {
  max-height: 320px;
  overflow-y: auto;
}
.rmi-tablewrap.rmi-bg-white { background: #ffffff; }

.rmi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}
.rmi-table th {
  padding: 10px 12px;
  font-weight: 600;
  color: #475569;
  background: #f8fafc;
  border-bottom: 1px solid var(--rmi-border);
  white-space: nowrap;
}
.rmi-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--rmi-border);
  vertical-align: middle;
}
.rmi-table-sm th { padding: 8px 10px; font-size: 12px; }
.rmi-table-sm td { padding: 8px 10px; font-size: 12px; }
.rmi-table tbody tr:last-child td { border-bottom: none; }
.rmi-row-click { cursor: pointer; transition: background 0.12s; }
.rmi-row-click:hover { background: #f1f5f9; }

/* Status Row Borders */
.st-critical { border-left: 4px solid #ef4444; }
.st-low { border-left: 4px solid #f59e0b; }
.st-balanced { border-left: 4px solid #10b981; }
.st-overstocked { border-left: 4px solid #3b82f6; }
.st-nodemand { border-left: 4px solid #94a3b8; }

.rmi-sort {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.rmi-sort.on { color: #2563eb; }
.rmi-jobs-cell { font-size: 12px; max-width: 180px; }
.rmi-empty-row { text-align: center; padding: 36px 16px; color: var(--rmi-muted); }
.rmi-hint { font-size: 12px; color: var(--rmi-muted); margin-top: 10px; font-style: italic; }
.rmi-incart {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #16a34a;
  font-size: 12px;
  font-weight: 600;
}

/* Badges */
.rmi-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.rmi-b-critical { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.rmi-b-low { background: #fef3c7; color: #d97706; border: 1px solid #fde68a; }
.rmi-b-ok { background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; }
.rmi-b-over { background: #dbeafe; color: #2563eb; border: 1px solid #bfdbfe; }
.rmi-b-none { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

/* Cover Bar */
.rmi-cover {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}
.rmi-cover-num {
  font-size: 12px;
  font-weight: 600;
  width: 44px;
  text-align: right;
  flex-shrink: 0;
}
.rmi-bar {
  position: relative;
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
}
.rmi-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 4px;
}
.rmi-fill.s-critical { background: #ef4444; }
.rmi-fill.s-low { background: #f59e0b; }
.rmi-fill.s-balanced { background: #10b981; }
.rmi-fill.s-overstocked, .rmi-fill.s-overstock { background: #3b82f6; }
.rmi-fill.s-nodemand { background: #94a3b8; }
.rmi-bar b {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: #334155;
  z-index: 1;
  opacity: 0.6;
}

/* Buttons */
.rmi-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  line-height: 1.2;
}
.rmi-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.rmi-btn-primary { background: #2563eb; color: #ffffff; border-color: #2563eb; }
.rmi-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.rmi-btn-outline { background: #ffffff; color: #334155; border-color: #cbd5e1; }
.rmi-btn-outline:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; }
.rmi-btn-gold { background: #f59e0b; color: #ffffff; border-color: #d97706; }
.rmi-btn-gold:hover:not(:disabled) { background: #d97706; }
.rmi-btn-dark { background: #1e293b; color: #ffffff; border-color: #1e293b; }
.rmi-btn-dark:hover:not(:disabled) { background: #0f172a; }
.rmi-btn-green { background: #16a34a; color: #ffffff; border-color: #16a34a; }
.rmi-btn-green:hover:not(:disabled) { background: #15803d; }
.rmi-btn-danger { background: #dc2626; color: #ffffff; border-color: #dc2626; }
.rmi-btn-danger:hover:not(:disabled) { background: #b91c1c; }
.rmi-btn-light { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
.rmi-btn-light:hover:not(:disabled) { background: #e2e8f0; }
.rmi-btn-xs { padding: 4px 8px; font-size: 11px; border-radius: 4px; }
.rmi-iconbtn {
  background: none;
  border: none;
  padding: 6px;
  border-radius: 4px;
  color: var(--rmi-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.rmi-iconbtn:hover { background: #f1f5f9; color: var(--rmi-text); }
.rmi-iconbtn.rmi-red:hover { background: #fee2e2; color: #dc2626; }

/* Inputs */
.rmi-input {
  padding: 7px 10px;
  font-size: 13px;
  border: 1px solid var(--rmi-border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--rmi-text);
  outline: none;
  transition: border-color 0.15s;
}
.rmi-input:focus {
  border-color: var(--rmi-border-focus);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
.rmi-input.rmi-invalid { border-color: #ef4444; background: #fef2f2; }
.rmi-inline-input {
  border: 1px solid transparent;
  background: transparent;
  padding: 4px 6px;
  font-size: 13px;
  border-radius: 4px;
  width: 100%;
}
.rmi-inline-input:hover { border-color: var(--rmi-border); background: #ffffff; }
.rmi-inline-input:focus { border-color: #2563eb; background: #ffffff; outline: none; }
.rmi-num-sm { width: 64px; text-align: center; }
.rmi-num-md { width: 96px; }

/* Indent Status Select */
.rmi-stat { font-weight: 600; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
.rmi-stat.s-draft { background: #f1f5f9; color: #475569; }
.rmi-stat.s-submitted { background: #dbeafe; color: #1d4ed8; }
.rmi-stat.s-approved { background: #dcfce7; color: #15803d; }
.rmi-stat.s-poplaced { background: #fef3c7; color: #b45309; }
.rmi-stat.s-closed { background: #f3f4f6; color: #6b7280; }

/* Dropzones & Guide */
.rmi-guide { padding: 32px 16px; text-align: center; }
.rmi-guide-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.rmi-guide-sub { font-size: 14px; color: var(--rmi-muted); max-width: 580px; margin: 0 auto 24px; }
.rmi-guide-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  text-align: left;
}
.rmi-drop {
  border: 2px dashed var(--rmi-border);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.15s;
}
.rmi-drop:hover { border-color: #2563eb; background: #eff6ff; }
.rmi-drop.over { border-color: #2563eb; background: #dbeafe; }
.rmi-drop.done { border-color: #86efac; background: #f0fdf4; border-style: solid; }
.rmi-drop-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: #ffffff;
  border: 1px solid var(--rmi-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--rmi-muted);
}
.rmi-drop.done .rmi-drop-icon { background: #dcfce7; color: #16a34a; border-color: #bbf7d0; }
.rmi-drop-text { flex: 1; }
.rmi-drop-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
.rmi-step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
}
.rmi-drop-hint { font-size: 12px; color: var(--rmi-muted); margin-top: 2px; }
.rmi-drop-action { font-size: 12px; font-weight: 600; color: #2563eb; margin-top: 8px; }

/* Modals */
.rmi-modal-back {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.rmi-modal {
  background: #ffffff;
  border-radius: 12px;
  max-width: 820px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}
.rmi-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  border-bottom: 1px solid var(--rmi-border);
}
.rmi-modal-head h3 { margin: 0; font-size: 18px; font-weight: 600; }
.rmi-modal-head p { margin: 4px 0 0; font-size: 12px; color: var(--rmi-muted); }
.rmi-modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.rmi-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--rmi-border);
  background: #f8fafc;
}
.rmi-detect {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}
.rmi-detect.good { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.rmi-detect.bad { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.rmi-form3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.rmi-form3 label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
.rmi-sec-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: 8px;
  margin-bottom: 8px;
}
.rmi-sec-head h4 { margin: 0; font-size: 14px; font-weight: 600; }

/* Drawer & Backdrop */
.rmi-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: 900;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.rmi-backdrop.open { opacity: 1; pointer-events: auto; }
.rmi-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 700px;
  max-width: 92vw;
  background: #ffffff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  z-index: 910;
}
.rmi-backdrop.open .rmi-drawer { transform: translateX(0); }
.rmi-drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid var(--rmi-border);
  background: #f8fafc;
}
.rmi-drawer-kicker {
  font-size: 11px;
  font-weight: 700;
  color: var(--rmi-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
}
.rmi-drawer-title { font-size: 20px; font-weight: 700; margin: 0; }
.rmi-drawer-lead { font-size: 13px; color: var(--rmi-muted); margin-top: 4px; }
.rmi-drawer-x {
  background: none;
  border: none;
  color: var(--rmi-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
}
.rmi-drawer-x:hover { background: #e2e8f0; color: var(--rmi-text); }
.rmi-drawer-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.rmi-drawer-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--rmi-border);
  background: #f8fafc;
}
.rmi-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  background: #f8fafc;
  border: 1px solid var(--rmi-border);
  border-radius: 8px;
  padding: 14px;
}
.rmi-metric { font-size: 17px; font-weight: 700; margin-top: 2px; }
.rmi-transfer {
  font-size: 11px;
  color: #0284c7;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

/* Toast Notifications */
.rmi-toasts {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 380px;
}
.rmi-toast {
  background: #1e293b;
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: rmi-toast-in 0.2s ease-out;
}
.rmi-toast.t-info { border-left: 4px solid #3b82f6; }
.rmi-toast.t-warn { border-left: 4px solid #ef4444; }
.rmi-toast.t-success { border-left: 4px solid #10b981; }
.rmi-toast-act {
  background: #ffffff;
  color: #1e293b;
  border: none;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.rmi-toast-x {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  margin-left: auto;
  display: flex;
  align-items: center;
}
.rmi-toast-x:hover { color: #ffffff; }
@keyframes rmi-toast-in {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Job Demand Planner & Stack */
.rmi-stack { display: flex; flex-direction: column; gap: 20px; }
.rmi-sec-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.rmi-h3 { font-size: 18px; font-weight: 700; margin: 0; }
.rmi-callout {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 13px;
  color: #1e40af;
}
.rmi-callout svg { flex-shrink: 0; margin-top: 2px; color: #2563eb; }
.rmi-card {
  background: #ffffff;
  border: 1px solid var(--rmi-border);
  border-radius: 8px;
  padding: 18px;
}
.rmi-card.rmi-danger { border-color: #fca5a5; background: #fff5f5; }
.rmi-card-title { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
.rmi-addjob {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr auto;
  gap: 12px;
  align-items: flex-end;
}
.rmi-addjob label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
.rmi-shift { display: flex; align-items: center; gap: 6px; justify-content: center; }

/* Empty States & Tiles */
.rmi-empty { text-align: center; padding: 48px 20px; color: var(--rmi-muted); }
.rmi-empty h4 { font-size: 18px; font-weight: 600; color: var(--rmi-text); margin: 12px 0 6px; }
.rmi-empty p { font-size: 13px; margin: 0 0 20px; }
.rmi-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f1f5f9;
  color: var(--rmi-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rmi-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.rmi-tile {
  background: #f8fafc;
  border: 1px solid var(--rmi-border);
  border-radius: 6px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rmi-tile span { font-size: 12px; color: var(--rmi-muted); }
.rmi-tile strong { font-size: 18px; font-weight: 700; color: var(--rmi-text); }

/* Indent Register */
.rmi-reg-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.rmi-reg-toggle {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  flex: 1;
}
.rmi-caret { display: inline-flex; align-items: center; transition: transform 0.2s; }
.rmi-caret.open { transform: rotate(180deg); }
.rmi-reg-no { font-family: var(--rmi-mono); font-weight: 700; font-size: 14px; color: #2563eb; }

/* Settings / Checkboxes */
.rmi-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
.rmi-note-empty {
  text-align: center;
  padding: 24px;
  color: var(--rmi-muted);
  font-size: 14px;
}

/* Footer */
.rmi-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--rmi-muted);
  padding: 16px 0 0;
  border-top: 1px solid var(--rmi-border);
  margin-top: 24px;
  flex-wrap: wrap;
  gap: 8px;
}
`;

const CSS_EXTRA = `
.rmi-pager{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:10px;font-size:12px;color:var(--rmi-muted)}
.rmi-loading{opacity:.6;transition:opacity .15s}
.rmi-chkgrid{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:6px}
`;