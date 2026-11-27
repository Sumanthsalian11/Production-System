import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import axios from "axios";
import toastLib from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";

/* ---------- API (same token / BASE_URL as the rest of the app) ---------- */
const API = `${BASE_URL}/api/sap-reports`;
const authCfg = (extra = {}) => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, ...extra });
const fail = (e) => {
  if (!e?.response) return new Error("Cannot reach server. Check your connection.");
  const d = e.response.data;
  return new Error(d?.error || d?.message || (e.response.status === 401 ? "Session expired. Please log in again." : e.message));
};
const api = {
  get: (p) => axios.get(API + p, authCfg()).then((r) => r.data).catch((e) => { throw fail(e); }),
  post: (p, body) => axios.post(API + p, body, authCfg({ timeout: 0 })).then((r) => r.data).catch((e) => { throw fail(e); }),
  async download(p, { body, fallback = "report.xlsx" } = {}) {
    let res;
    try { res = await axios.post(API + p, body, authCfg({ responseType: "blob", timeout: 0 })); }
    catch (e) {
      if (e?.response?.data instanceof Blob) {
        let msg = "Download failed";
        try { msg = JSON.parse(await e.response.data.text()).error || msg; } catch { /* keep default */ }
        throw new Error(msg);
      }
      throw fail(e);
    }
    const m = String(res.headers["content-disposition"] || "").match(/filename="([^"]+)"/);
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = m ? m[1] : fallback;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

// stable function (kept outside the components)
const toast = (m) => {
  const msg = typeof m === "string" ? m : m?.message || String(m);
  if (/fail|error|invalid|not found|cannot|could not|empty|check|upload raw|no report|expired|denied|select/i.test(msg)) toastLib.error(msg, { duration: 5000 });
  else if (/started|added|saved/i.test(msg)) toastLib.success(msg, { duration: 3500 });
  else toastLib(msg, { duration: 4000 });
};

const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fd = d => d ? d.slice(8) + '-' + M[+d.slice(5, 7) - 1] + '-' + d.slice(0, 4) : '';
const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const num = n => typeof n === 'number' ? n.toLocaleString('en-IN') : n;
const pct = n => typeof n === 'number' ? n.toFixed(2) + '%' : n;
const NUMK = ['open', 'rc', 'disp', 'wa', 'wastePct', 'tr', 'ot', 'close', 'chk'];
const PAGE_SIZE = 200;

function SheetTable({ s, q, onlyAnom, maxW, showAll = false }) {
  const colKeys = s.colKeys || [];
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [s, q, onlyAnom]);
  const rows = useMemo(() => {
    let bodyIdx = 0;
    const matches = [];
    s.a.forEach((r, i) => {
      if (!r.length || r.length <= 1 || i === 3 || r[0] === 'TOTAL') return;
      const flags = s.rowMeta?.[bodyIdx++] || {};
      if (q && !r.some(c => norm(c).includes(q))) return;
      if (onlyAnom && !(flags.neg || flags.chk || flags.highW || flags.ot)) return;
      matches.push(i);
    });
    return matches;
  }, [s, q, onlyAnom]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = new Set(showAll ? rows : rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE));
  let bodyIdx = 0;
  const trs = [];

  s.a.forEach((r, i) => {
    if (!r.length) return;
    if (r.length <= 1) {
      trs.push(
        <tr key={i}>
          <td colSpan={99} className={i ? 't1' : 't0'}>
            {r[0]}
          </td>
        </tr>
      );
      return;
    }
    if (i === 3) {
      trs.push(
        <tr key={i}>
          {r.map((c, ci) => (
            <th key={ci} className={NUMK.includes(colKeys[ci]) ? 'n' : ''}>
              {c}
            </th>
          ))}
        </tr>
      );
      return;
    }

    const isTot = r[0] === 'TOTAL';
    let rowCls = isTot ? 'tot' : '';
    let flags = {};

    if (!isTot) {
      flags = s.rowMeta?.[bodyIdx] || {};
      bodyIdx++;
      if (!visibleRows.has(i)) return;
    }
    if (!isTot && s.rowMeta) {
      if (flags.neg || flags.chk) rowCls = 'row-wr';
      else if (flags.highW || flags.ot) rowCls = 'row-am';
    }

    trs.push(
      <tr key={i} className={rowCls}>
        {r.map((c, ci) => {
          const ck = colKeys[ci];
          const isNum = typeof c === 'number';
          let cls = isNum ? 'n' : '';
          if (!isTot) {
            if (ck === 'close' && isNum && c < 0) cls += ' cell-wr';
            if (ck === 'chk' && isNum && Math.abs(c) > 1e-6) cls += ' cell-wr';
            if (ck === 'wastePct' && isNum && c > maxW) cls += ' cell-am';
          }
          return (
            <td key={ci} className={cls}>
              {ck === 'wastePct' && isNum ? pct(c) : num(c)}
            </td>
          );
        })}
      </tr>
    );
  });

  return <>
    <div className="scroll">
      <table><tbody>{trs}</tbody></table>
    </div>
    {rows.length > PAGE_SIZE && <div className="sp-row no-print" style={{ justifyContent: 'space-between', padding: '10px 2px' }}>
      <span className="mt">Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, rows.length)} of {rows.length.toLocaleString('en-IN')} rows</span>
      <div className="sp-row">
        <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
        <span className="mt">Page {safePage + 1} of {pageCount}</span>
        <button disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>Next</button>
      </div>
    </div>}
  </>;
}

function Report({ out, user, regenerate }) {
  const [cur, setCur] = useState(Math.max(0, out.sheets.length - 1)); // land on Summary
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [onlyAnom, setOnlyAnom] = useState(false);
  const [printAllRows, setPrintAllRows] = useState(false);

  const S = out.sheets, k = out.kpi, maxW = out.limits.maxWastePct;
  const s = S[cur] || S[0];
  const un = Object.entries(out.un);
  const hasCritical = k.negCount > 0 || k.chkCount > 0;
  const hasWarn = k.unSkuCount > 0 || k.unMovCount > 0 || k.highWCount > 0;
  const statusCls = hasCritical ? 'wr' : hasWarn ? 'am' : 'ok';
  const statusTxt = hasCritical ? 'ACTION REQUIRED' : hasWarn ? 'REVIEW WARNINGS' : 'RECONCILED · PASS';

  const download = async fmt => {
    let ack = false;
    if (!out.tpl.internal && out.limits.requireAckOnWarn && out.excCount > 0) {
      const msg = `PRE-RELEASE GOVERNANCE WARNING\n\nThis is a CUSTOMER RELEASE report with ${out.excCount} active exception(s):\n` +
        `• Negative stock variants: ${k.negCount}\n• Reconciliation variances: ${k.chkCount}\n` +
        `• Unmapped SAP SKUs: ${k.unSkuCount}\n• Unmapped movements: ${k.unMovCount}\n` +
        `• High-wastage variants: ${k.highWCount}\n\nProceed with download anyway?`;
      if (!window.confirm(msg)) return;
      ack = true;
    }
    try {
      await api.download('/download', {
        method: 'POST',
        body: { ...out.req, format: fmt, sheetIndex: cur, acknowledged: ack }
      });
      toast(`Report download started (${fmt.toUpperCase()})`);
    } catch (e) {
      toast(e.message);
    }
  };

  const print = async () => {
    setPrintAllRows(true);
    requestAnimationFrame(() => {
      window.print();
      setPrintAllRows(false);
    });
  };

  const quickMap = async () => {
    try {
      const r = await api.post(`/maps/${out.tpl.mapId}/quick-add`, { descriptions: Object.keys(out.un) });
      toast(`Added ${r.added} unmapped SKU(s) to ${r.map}`);
      regenerate();
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div className="sp-card" id="out">
      <div className="card-h">
        <h3 style={{ gap: 10 }}>
          <span className="sp-badge ac" style={{ padding: '3px 8px', fontSize: 11 }}>3</span>
          <span>Executive Snapshot & Report Preview</span>
          <span className={`sp-badge ${statusCls}`} style={{ marginLeft: 6 }}>
            {statusTxt}
          </span>
        </h3>
        <div className="sp-row no-print">
          <button className="pri" onClick={() => download('xlsx')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download Excel (.xlsx · {S.length} sheets)
          </button>
          <button onClick={() => download('csv')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="8" y1="13" x2="16" y2="13"></line>
              <line x1="8" y1="17" x2="16" y2="17"></line>
            </svg>
            Download Sheet (.csv)
          </button>
          <button onClick={print}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
            Print / PDF
          </button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-header">
            <span className="kl">Opening Stock</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65 }}>
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </div>
          <div className="kv">{num(k.open)}</div>
          <div className="ks">Baseline as on {fd(out.from)}</div>
        </div>

        <div className="kpi">
          <div className="kpi-header">
            <span className="kl">Receipts (Inward)</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ok)' }}>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            </svg>
          </div>
          <div className="kv">{num(k.rc)}</div>
          <div className="ks">From Stores & Plants</div>
        </div>

        <div className="kpi">
          <div className="kpi-header">
            <span className="kl">Net Dispatch</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ac)' }}>
              <polyline points="17 14 12 9 7 14"></polyline>
              <line x1="12" y1="9" x2="12" y2="21"></line>
              <path d="M5 9V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"></path>
            </svg>
          </div>
          <div className="kv">{num(k.disp)}</div>
          <div className="ks">Gross dispatch: {num(k.dg)}</div>
        </div>

        <div className={`kpi ${k.wastePct > maxW ? 'am' : 'ok'}`}>
          <div className="kpi-header">
            <span className="kl">Wastage & Rate</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: k.wastePct > maxW ? 'var(--am)' : 'var(--ok)' }}>
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </div>
          <div className="kv">
            {num(k.wa)} <span style={{ fontSize: 13, fontWeight: 700 }}>({k.wastePct.toFixed(2)}%)</span>
          </div>
          <div className="ks">SLA threshold: ≤ {maxW}%</div>
        </div>

        <div className={`kpi ${k.negCount ? 'wr' : ''}`}>
          <div className="kpi-header">
            <span className="kl">Closing Stock</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: k.negCount ? 'var(--wr)' : 'var(--tx)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <div className="kv">{num(k.close)}</div>
          <div className="ks">Balance as on {fd(out.to)}</div>
        </div>
      </div>

      {(k.negCount > 0 || k.chkCount > 0) && (
        <div className="sp-alert wr">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div style={{ flex: 1 }}>
            <strong>Control Failure:</strong>{' '}
            {k.negCount ? `${k.negCount} variant(s) have negative closing stock. ` : ''}
            {k.chkCount ? `${k.chkCount} variant(s) failed opening+movement=closing check. ` : ''}
            Verify opening baseline or SAP postings before releasing to customer.
          </div>
        </div>
      )}

      {un.length > 0 && (
        <div className="sp-alert am">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div style={{ flex: 1 }}>
            <strong>Unmapped SAP Descriptions ({un.length} SKU / {un.reduce((n, [, c]) => n + c, 0)} rows excluded):</strong>{' '}
            {un.slice(0, 5).map(([d, c]) => `${d} (${c})`).join('; ')}
            {un.length > 5 ? '…' : ''}
          </div>
          {user.is_admin && out.tpl.mapId && (
            <button className="sm pri" onClick={quickMap} style={{ alignSelf: 'center' }}>
              Quick-Add to Variant Map
            </button>
          )}
        </div>
      )}

      {!hasCritical && !hasWarn && (
        <div className="sp-alert ok">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <div style={{ flex: 1 }}>
            <strong>Pre-Release Governance Check Passed:</strong> Zero negative balances, zero reconciliation variances, zero unmapped SKUs, and wastage within {maxW}% SLA.
          </div>
        </div>
      )}

      <div className="chips no-print">
        {S.map((x, i) => (
          <button
            key={i}
            className={i === cur ? 'on' : ''}
            onClick={() => setCur(i)}
            aria-selected={i === cur}
          >
            {x.n}
          </button>
        ))}
      </div>

      <div className="pill-bar no-print">
        <input
          type="search"
          placeholder="Filter variant / SAP / rack…"
          value={q}
          onChange={e => { setQ(e.target.value); }}
          aria-label="Filter sheet variants"
        />
        <label className="ck">
          <input
            type="checkbox"
            checked={onlyAnom}
            onChange={e => setOnlyAnom(e.target.checked)}
          />
          Show anomalies only
        </label>
        <span className="mt">
          Viewing: <strong>{s?.n}</strong> · {out.tpl.internal ? 'Internal Control Copy' : 'Customer Release Copy'}
        </span>
      </div>

      {s && <SheetTable s={s} q={norm(deferredQ)} onlyAnom={onlyAnom} maxW={maxW} showAll={printAllRows} />}
    </div>
  );
}

function Generate({ user, boot }) {
  const [datasets, setDatasets] = useState(boot.datasets);
  const [dsId, setDsId] = useState(boot.datasets[0]?.id || '');
  const [G, setG] = useState({
    t: boot.datasets[0]?.logic_template_id && boot.templates.some(t => t.id === String(boot.datasets[0].logic_template_id))
      ? String(boot.datasets[0].logic_template_id)
      : boot.templates[0]?.id || '',
    from: boot.datasets[0]?.min_date || '',
    to: boot.datasets[0]?.max_date || '',
    gran: 'daily',
  });
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);

  const ds = datasets.find(d => d.id === String(dsId));
  const set = (k, v) => setG(g => ({ ...g, [k]: v }));

  const pickDataset = (id, list = datasets) => {
    setDsId(id);
    setOut(null);
    const d = list.find(x => x.id === String(id));
    if (d) setG(g => ({
      ...g,
      from: d.min_date,
      to: d.max_date,
      ...(boot.templates.some(t => t.id === String(d.logic_template_id)) ? { t: String(d.logic_template_id) } : {})
    }));
  };

  useEffect(() => {
    if (!boot.templates.some(t => t.id === String(G.t))) {
      set('t', boot.templates[0]?.id || '');
    }
  }, [boot.templates]); // eslint-disable-line

  const generate = async () => {
    if (!ds) return toast('Upload raw SAP data first (or select an uploaded file)');
    if (!G.t) return toast('No report template is assigned to your profile');
    if (!G.from || !G.to || G.from > G.to) return toast('Check the From / To dates');
    const days = (Date.parse(G.to) - Date.parse(G.from)) / 864e5;
    if (G.gran === 'daily' && days > 92 && !window.confirm(`This creates up to ${Math.round(days)} daily sheets. Continue?`)) return;
    const req = { datasetId: ds.id, templateId: String(G.t), from: G.from, to: G.to, gran: G.gran, skipEmpty: false };
    setBusy(true);
    try {
      const r = await api.post('/generate', req);
      setOut({ ...r, req });
      if (!r.sheets.length) toast('No data for this selection');
    } catch (x) {
      toast(x.message);
    }
    setBusy(false);
  };

  if (!boot.templates.length) {
    return (
      <div className="sp-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--am)', marginBottom: 14 }}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3 style={{ justifyContent: 'center', fontSize: 18 }}>No Report Templates Assigned</h3>
        <p className="mt" style={{ maxWidth: '52ch', margin: '8px auto', fontSize: 13.5 }}>
          No report templates are assigned to your user account. Please contact your Plant Administrator to assign customer templates.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 2-Column Dashboard Control Panel */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
          gap: 20,
          marginBottom: 22
        }}
      >
        {/* Step 2: Template & Reporting Period */}
        <div className="sp-card report-scope-card" style={{ margin: 0 }}>
          <div className="card-h">
            <h3>
              <span className="sp-badge ac" style={{ padding: '3px 8px', fontSize: 11 }}>2</span>
              Template & Reporting Scope
            </h3>
            {ds && (
              <span className="sp-badge ok" style={{ fontSize: 11 }}>
                Span: {fd(ds.min_date)} → {fd(ds.max_date)}
              </span>
            )}
          </div>

          <div className="g report-scope-grid">
            {datasets.length > 0 && <label>
              Active dataset source
              <select value={dsId} onChange={e => pickDataset(e.target.value)}>
                {datasets.map(d => <option key={d.id} value={d.id}>
                  {d.file_name} · {d.row_count.toLocaleString('en-IN')} rows ({fd(d.min_date)} to {fd(d.max_date)})
                </option>)}
              </select>
            </label>}
            <label>
              Report Template
              <select value={G.t} onChange={e => { set('t', e.target.value); setOut(null); }}>
                {boot.templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.internal ? '· [Internal Control]' : '· [Customer Release]'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sheet Granularity
              <select value={G.gran} onChange={e => set('gran', e.target.value)}>
                <option value="daily">One sheet per day (Daily detail)</option>
                <option value="monthly">One sheet per month (Monthly rollup)</option>
              </select>
            </label>
            <label>
              From Date
              <input type="date" value={G.from} onChange={e => set('from', e.target.value)} />
            </label>
            <label>
              To Date
              <input type="date" value={G.to} onChange={e => set('to', e.target.value)} />
            </label>
          </div>

          <div className="report-scope-actions">
            <button
              className="pri"
              onClick={generate}
              disabled={busy}
              style={{ minWidth: 160, minHeight: 40 }}
            >
              {busy ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  </svg>
                  Reconciling…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* If No Report Generated Yet: Professional Dashboard Ready State */}
      {!out && (
        <div className="sp-card no-print" style={{ textAlign: 'center', padding: '44px 24px', background: 'var(--sf)', borderColor: 'var(--bd2)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 60,
            height: 60,
            borderRadius: 'var(--rad-lg)',
            background: 'var(--ac-gradient)',
            color: 'var(--on-ac)',
            marginBottom: 16,
            boxShadow: 'var(--ac-glow)'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <h3 style={{ justifyContent: 'center', fontSize: 19, marginBottom: 8 }}>Ready for Stock Reconciliation</h3>
          <p className="mt" style={{ maxWidth: '58ch', margin: '0 auto 26px', fontSize: 13.5 }}>
            Select a dataset and reporting scope above, then click <strong>Generate Report</strong> to inspect executive KPIs, balance equations, and export formatted reports. Upload SAP files from the separate SAP Data Upload module.
          </p>

          <div className="feature-grid">
            <div className="feature-tile">
              <div className="feature-tile-head">
                <span className="feature-tile-icon ok" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                Equation Validation
              </div>
              <div className="mt" style={{ fontSize: 12.5 }}>
                Opening + Inward − Net Dispatch − Wastage = Closing stock validated row-by-row.
              </div>
            </div>

            <div className="feature-tile">
              <div className="feature-tile-head">
                <span className="feature-tile-icon am" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                </span>
                Exception Guardrails
              </div>
              <div className="mt" style={{ fontSize: 12.5 }}>
                Flags negative stock, unmapped SAP SKUs, and wastage SLA breaches before release.
              </div>
            </div>

            <div className="feature-tile">
              <div className="feature-tile-head">
                <span className="feature-tile-icon ac" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </span>
                Multi-Sheet Excel
              </div>
              <div className="mt" style={{ fontSize: 12.5 }}>
                One-click download of daily detail sheets and auto-reconciled Consolidated Summary.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Report Card View */}
      {out && (
        <Report
          key={out.req.templateId + out.from + out.to + out.sheets.length}
          out={out}
          user={user}
          regenerate={generate}
        />
      )}
    </>
  );
}

const CSS = `
/* Styles of this page only: every rule is scoped under .srp-root so nothing leaks into the rest of the app */
.srp-root { box-sizing: border-box; padding: 4px 2px 24px; color: var(--tx); font-family: var(--font-sans); font-size: 14px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.srp-root *, .srp-root *::before, .srp-root *::after { box-sizing: border-box; }
.srp-root button, .srp-root input, .srp-root select, .srp-root textarea { font-family: inherit; font-size: inherit; line-height: inherit; }
.srp-root h1, .srp-root h2, .srp-root h3 { font-family: var(--font-display); color: var(--tx); font-weight: 700; letter-spacing: -0.025em; margin: 0; }
.srp-root label { margin-bottom: 0; }
.srp-root p { margin-bottom: 0; }
.srp-root .sp-card { display: block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.srp-root {
  color-scheme: light;
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-display: 'Plus Jakarta Sans', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

  
  --sidebar-w: 256px;
  --sidebar-collapsed-w: 72px;
  --topbar-h: 64px;

  
  --bg: #f4f6f6;
  --bg-mesh:
    radial-gradient(880px 400px at 10% -6%, rgba(13, 148, 136, 0.08), transparent 65%),
    radial-gradient(760px 380px at 94% 8%, rgba(245, 158, 11, 0.06), transparent 65%);
  --sf: #ffffff;
  --sf2: #f7fafa;
  --sf-hover: #eef7f6;
  --sf-glass: rgba(255, 255, 255, 0.86);
  --zebra: #f9fbfb;
  --on-ac: #ffffff;

  
  --tx: #112224;
  --tx-muted: #334e52;
  --mt: #5f7a7e;
  --mt-light: #8ea5a8;

  
  --bd: #d2e0e0;
  --bd2: #e3ecec;

  
  --ac: #0d9488;
  --ac-h: #0f766e;
  --ac2: #e6f7f5;
  --ac-bd: #99e2d8;
  --ac-gradient: linear-gradient(135deg, #14b8a6 0%, #0f766e 100%);
  --ac-gradient-hover: linear-gradient(135deg, #0d9488 0%, #115e59 100%);
  --ac-ring: rgba(13, 148, 136, 0.2);
  --ac-glow: 0 8px 20px -6px rgba(13, 148, 136, 0.45);
  --gold: #fbbf24;
  --gold-warm: #f59e0b;

  
  --side-bg:
    radial-gradient(280px 220px at 0% 0%, rgba(20, 184, 166, 0.22), transparent 70%),
    radial-gradient(260px 220px at 100% 100%, rgba(245, 158, 11, 0.12), transparent 70%),
    linear-gradient(180deg, #081c20 0%, #0d282e 56%, #11353c 100%);
  --side-tx: #e0f2f1;
  --side-mt: #8db3b6;
  --side-hover: rgba(255, 255, 255, 0.08);
  --side-active: linear-gradient(135deg, rgba(20, 184, 166, 0.26) 0%, rgba(245, 158, 11, 0.1) 100%);
  --side-active-bd: rgba(94, 234, 212, 0.38);
  --side-bd: rgba(255, 255, 255, 0.09);
  --side-card: rgba(255, 255, 255, 0.06);
  --side-icon-bg: rgba(255, 255, 255, 0.07);
  --side-indicator: linear-gradient(180deg, #fbbf24 0%, #2dd4bf 100%);
  --side-indicator-glow: rgba(251, 191, 36, 0.6);

  
  --hero-bg: linear-gradient(125deg, #081c20 0%, #0f333a 55%, #115e59 100%);
  --hero-tx: #ffffff;
  --hero-mt: rgba(224, 242, 241, 0.85);
  --hero-glow-a: rgba(20, 184, 166, 0.38);
  --hero-glow-b: rgba(245, 158, 11, 0.24);
  --hero-grid: rgba(255, 255, 255, 0.05);

  
  --th-bg: #edf5f5;
  --th-tx: #143337;

  
  --violet: #7c3aed;
  --violet-bg: #f3e8ff;
  --violet-bd: #ddd6fe;
  --cyan: #0284c7;
  --cyan-bg: #e0f2fe;
  --cyan-bd: #bae6fd;
  --teal: #0d9488;
  --teal-bg: #ccfbf1;
  --teal-bd: #99f6e4;

  
  --ok: #059669;
  --ok-bg: #ecfdf5;
  --ok-bd: #a7f3d0;
  --ok-gradient: linear-gradient(135deg, #10b981 0%, #059669 100%);

  --am: #d97706;
  --am-bg: #fffbeb;
  --am-bd: #fde68a;
  --am-gradient: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);

  --wr: #e11d48;
  --wb: #fff1f2;
  --wb-bd: #fecdd3;
  --wr-gradient: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);

  
  --toast-bg: #0c2328;
  --toast-tx: #f0fdfa;
  --toast-ok: #34d399;
  --toast-er: #fb7185;
  --toast-wn: #fbbf24;
  --toast-in: #2dd4bf;
  --toast-close: #94b3b6;

  
  --scrim: rgba(7, 20, 24, 0.62);

  
  --sh-xs: 0 1px 2px 0 rgba(12, 35, 40, 0.04);
  --sh-sm: 0 1px 3px 0 rgba(12, 35, 40, 0.06), 0 1px 2px -1px rgba(12, 35, 40, 0.04);
  --sh: 0 4px 12px -2px rgba(12, 35, 40, 0.07), 0 2px 5px -2px rgba(12, 35, 40, 0.04);
  --sh-md: 0 12px 26px -6px rgba(12, 35, 40, 0.12), 0 4px 10px -4px rgba(12, 35, 40, 0.05);
  --sh-lg: 0 20px 40px -10px rgba(12, 35, 40, 0.16), 0 8px 16px -6px rgba(12, 35, 40, 0.07);
  --sh-xl: 0 28px 56px -12px rgba(12, 35, 40, 0.25), 0 10px 20px -8px rgba(12, 35, 40, 0.1);

  
  --rad-xs: 4px;
  --rad-sm: 8px;
  --rad-md: 12px;
  --rad-lg: 16px;
  --rad-xl: 22px;
  --rad-full: 9999px;

  
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --trans: 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.srp-root *, .srp-root *::before, .srp-root *::after { box-sizing: border-box; }
.srp-root button, .srp-root input, .srp-root select, .srp-root textarea {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
.srp-root button {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.srp-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.srp-root ::-webkit-scrollbar-track { background: transparent; }
.srp-root ::-webkit-scrollbar-thumb {
  background: var(--bd);
  border-radius: var(--rad-full);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.srp-root ::-webkit-scrollbar-thumb:hover { background: var(--mt-light); background-clip: padding-box; }
.srp-root :focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.srp-root h1, .srp-root h2, .srp-root h3, .srp-root h4, .srp-root h5, .srp-root h6 {
  font-family: var(--font-display);
  color: var(--tx);
  font-weight: 700;
  letter-spacing: -0.025em;
  margin: 0;
}
.srp-root a { color: var(--ac); text-decoration: none; transition: color var(--trans); }
.srp-root a:hover { color: var(--ac-h); }
.srp-root hr { border: 0; border-top: 1px solid var(--bd2); margin: 16px 0; }
.srp-root ::selection { background: var(--ac-ring); }
.srp-root .sp-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 3px 11px;
  border: 1px solid var(--bd);
  border-radius: var(--rad-full);
  background: var(--sf2);
  color: var(--mt);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.srp-root .sp-badge::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--rad-full);
  background: currentColor;
  opacity: 0.85;
}
.srp-root .sp-badge.ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-bd); }
.srp-root .sp-badge.am { background: var(--am-bg); color: var(--am); border-color: var(--am-bd); }
.srp-root .sp-badge.wr { background: var(--wb);    color: var(--wr); border-color: var(--wb-bd); }
.srp-root .sp-badge.ac { background: var(--ac2);   color: var(--ac); border-color: var(--ac-bd); }
.srp-root .card-h h3 > .sp-badge.ac:first-child {
  justify-content: center;
  min-width: 26px;
  min-height: 26px;
  border: 0;
  border-radius: 9px;
  background: var(--ac-gradient);
  color: var(--on-ac);
  font-size: 12px;
  box-shadow: var(--ac-glow);
}
.srp-root .card-h h3 > .sp-badge.ac:first-child::before { display: none; }
.srp-root .sp-card {
  position: relative;
  margin: 0 0 22px;
  padding: 24px 26px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: var(--sf);
  box-shadow: var(--sh-sm);
  transition: border-color var(--trans), box-shadow var(--trans);
}
.srp-root .sp-card:hover { box-shadow: var(--sh); border-color: var(--bd); }
.srp-root .card-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--bd2);
}
.srp-root h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  color: var(--tx);
  font-size: 16px;
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.35;
}
.srp-root .card-h h3 { margin: 0; }
.srp-root .mt { color: var(--mt); font-size: 12.5px; }
.srp-root p.mt { max-width: 90ch; line-height: 1.65; margin: 6px 0 14px; }
.srp-root .feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
  text-align: left;
}
.srp-root .feature-tile {
  padding: 18px 20px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: var(--sf2);
  transition: transform var(--trans), border-color var(--trans), box-shadow var(--trans);
}
.srp-root .feature-tile:hover {
  transform: translateY(-2px);
  border-color: var(--ac-bd);
  box-shadow: var(--sh-sm);
}
.srp-root .feature-tile-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-weight: 750;
  font-size: 13.5px;
  color: var(--tx);
}
.srp-root .feature-tile-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  flex-shrink: 0;
}
.srp-root .feature-tile-icon.ok { background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok-bd); }
.srp-root .feature-tile-icon.am { background: var(--am-bg); color: var(--am); border: 1px solid var(--am-bd); }
.srp-root .feature-tile-icon.ac { background: var(--ac2);   color: var(--ac); border: 1px solid var(--ac-bd); }
.srp-root button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 18px;
  border: 1px solid var(--bd);
  border-radius: var(--rad-md);
  background: var(--sf);
  color: var(--tx);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.25;
  cursor: pointer;
  box-shadow: var(--sh-xs);
  transition: background-color var(--trans), border-color var(--trans),
              box-shadow var(--trans), transform var(--trans), color var(--trans);
}
.srp-root button:hover {
  background: var(--sf2);
  border-color: var(--ac-bd);
  color: var(--ac);
  box-shadow: var(--sh-sm);
}
.srp-root button:active { transform: translateY(1px); }
.srp-root button.on, .srp-root button.pri {
  background: var(--ac-gradient);
  color: var(--on-ac);
  border: 1px solid transparent;
  box-shadow: var(--ac-glow), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.srp-root button.on:hover, .srp-root button.pri:hover {
  background: var(--ac-gradient-hover);
  color: var(--on-ac);
  border-color: transparent;
  box-shadow: var(--ac-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}
.srp-root button.on:active, .srp-root button.pri:active { transform: translateY(1px); }
.srp-root button.sm {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: var(--rad-sm);
  font-weight: 600;
}
.srp-root button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  pointer-events: none;
}
.srp-root label {
  display: block;
  margin-bottom: 14px;
  color: var(--tx-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.srp-root label.ck {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px 8px 0;
  color: var(--tx);
  font-size: 13px;
  font-weight: 550;
  letter-spacing: 0;
  cursor: pointer;
  user-select: none;
}
.srp-root label.ck:hover { color: var(--ac); }
.srp-root input, .srp-root select, .srp-root textarea {
  width: 100%;
  min-height: 44px;
  margin-top: 6px;
  padding: 10px 14px;
  border: 1px solid var(--bd);
  border-radius: var(--rad-md);
  outline: none;
  background: var(--sf);
  color: var(--tx);
  font-size: 13.5px;
  font-weight: 500;
  transition: border-color var(--trans), box-shadow var(--trans), background-color var(--trans);
}
.srp-root input:hover, .srp-root select:hover, .srp-root textarea:hover { border-color: var(--ac-bd); }
.srp-root input:focus, .srp-root select:focus, .srp-root textarea:focus {
  border-color: var(--ac);
  box-shadow: 0 0 0 4px var(--ac-ring);
  background: var(--sf);
}
.srp-root input::placeholder, .srp-root textarea::placeholder { color: var(--mt-light); opacity: 0.9; }
.srp-root input[type="checkbox"] {
  width: 18px;
  min-height: 18px;
  height: 18px;
  margin: 0;
  border-radius: var(--rad-xs);
  accent-color: var(--ac);
  cursor: pointer;
}
.srp-root input[type="file"] {
  min-height: 72px;
  padding: 14px 16px;
  border: 2px dashed var(--ac-bd);
  border-radius: var(--rad-lg);
  background: var(--ac2);
  color: var(--tx-muted);
  cursor: pointer;
  transition: all var(--trans);
}
.srp-root input[type="file"]:hover { border-color: var(--ac); background: var(--sf-hover); }
.srp-root input[type="file"]::file-selector-button {
  margin: 0 16px 0 0;
  padding: 9px 18px;
  border: 0;
  border-radius: var(--rad-sm);
  background: var(--ac-gradient);
  color: var(--on-ac);
  font: inherit;
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
  box-shadow: var(--ac-glow);
  transition: all var(--trans);
}
.srp-root input[type="file"]::file-selector-button:hover { background: var(--ac-gradient-hover); }
.srp-root textarea {
  min-height: 88px;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
}
.srp-root select {
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2362718d' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.6' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 18px;
  padding-right: 38px;
  appearance: none;
  -webkit-appearance: none;
}
.srp-root .g {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 16px 20px;
}
.srp-root .sp-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.srp-root .kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 16px;
  margin: 0 0 22px;
}
.srp-root .kpi {
  --kpi-accent: var(--ac);
  position: relative;
  min-width: 0;
  padding: 18px 20px 16px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: linear-gradient(180deg, var(--sf) 0%, var(--sf2) 100%);
  box-shadow: var(--sh-sm);
  overflow: hidden;
  transition: transform var(--trans), box-shadow var(--trans), border-color var(--trans);
}
.srp-root .kpi::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: var(--kpi-accent);
}
.srp-root .kpi::after {
  content: "";
  position: absolute;
  right: -28px;
  top: -28px;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--kpi-accent) 9%, transparent);
  pointer-events: none;
}
.srp-root .kpi:hover { transform: translateY(-3px); box-shadow: var(--sh-md); border-color: var(--ac-bd); }
.srp-root .kpi-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.srp-root .kpi-header svg {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  padding: 8px;
  border-radius: 10px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  opacity: 1 !important;
}
.srp-root .kpi .kl {
  color: var(--mt);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.srp-root .kpi .kv {
  margin-top: 10px;
  color: var(--tx);
  font-size: 26px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.035em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.srp-root .kpi .ks {
  margin-top: 8px;
  color: var(--mt);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}
.srp-root .kpi.ok { --kpi-accent: var(--ok); }
.srp-root .kpi.ok .kv { color: var(--ok); }
.srp-root .kpi.am { --kpi-accent: var(--am); }
.srp-root .kpi.am .kv { color: var(--am); }
.srp-root .kpi.wr { --kpi-accent: var(--wr); }
.srp-root .kpi.wr .kv { color: var(--wr); }
.srp-root .sp-alert {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin: 14px 0;
  padding: 14px 18px;
  border: 1px solid var(--bd2);
  border-left-width: 5px;
  border-radius: var(--rad-md);
  font-size: 13px;
  line-height: 1.6;
  box-shadow: var(--sh-xs);
  animation: fadeIn 0.2s ease-out;
}
.srp-root .sp-alert.wr { background: var(--wb);    color: var(--wr); border-color: var(--wb-bd); border-left-color: var(--wr); }
.srp-root .sp-alert.am { background: var(--am-bg); color: var(--am); border-color: var(--am-bd); border-left-color: var(--am); }
.srp-root .sp-alert.ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-bd); border-left-color: var(--ok); }
.srp-root .sp-alert strong { font-weight: 750; letter-spacing: -0.01em; }
.srp-root .chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-height: 124px;
  overflow-y: auto;
  margin: 18px 0;
  padding: 4px 2px;
}
.srp-root .chips button {
  min-height: 32px;
  padding: 5px 14px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-full);
  background: var(--sf2);
  color: var(--tx-muted);
  font-size: 12px;
  font-weight: 600;
  box-shadow: none;
}
.srp-root .chips button:hover { background: var(--ac2); color: var(--ac); border-color: var(--ac-bd); }
.srp-root .chips button.on {
  background: var(--ac-gradient);
  color: var(--on-ac);
  border-color: transparent;
  box-shadow: var(--ac-glow);
  font-weight: 700;
}
.srp-root .pill-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin: 14px 0 18px;
  padding: 12px 16px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: var(--sf2);
}
.srp-root .pill-bar input[type="search"] {
  max-width: 340px;
  min-height: 40px;
  margin: 0;
  background-color: var(--sf);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2362718d' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 12px center;
  background-size: 16px;
  padding-left: 38px;
  border-radius: var(--rad-full);
}
.srp-root .pill-bar .ck { margin: 0; }
.srp-root .pill-bar .mt { margin-left: auto; font-weight: 550; font-size: 12.5px; }
.srp-root .scroll {
  overflow: auto;
  max-height: 600px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-md);
  background: var(--sf);
  box-shadow: var(--sh-xs);
}
.srp-root table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12.5px;
  font-family: var(--font-sans);
}
.srp-root td, .srp-root th {
  padding: 11px 16px;
  border-bottom: 1px solid var(--bd2);
  white-space: nowrap;
}
.srp-root th {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--th-bg);
  color: var(--th-tx);
  text-align: left;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  border-bottom: 2px solid var(--ac);
}
.srp-root td.n, .srp-root th.n {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
}
.srp-root td.n { font-family: var(--font-mono); font-size: 12px; }
.srp-root tbody tr:where(:nth-child(even)) td { background: var(--zebra); }
.srp-root tbody tr { transition: background-color 0.12s ease; }
.srp-root tbody tr:last-child td { border-bottom: 0; }
.srp-root tbody tr:not(.tot):not(.row-wr):not(.row-am):hover td { background: var(--sf-hover); }
.srp-root tr.tot td {
  position: sticky;
  bottom: 0;
  z-index: 4;
  background: var(--ac2);
  color: var(--tx);
  border-top: 2px solid var(--ac);
  border-bottom: 0;
  font-weight: 800;
  font-size: 13px;
}
.srp-root tr.row-wr td { background: color-mix(in srgb, var(--wb) 70%, var(--sf)); }
.srp-root tr.row-am td { background: color-mix(in srgb, var(--am-bg) 70%, var(--sf)); }
.srp-root td.cell-wr {
  color: var(--wr);
  font-weight: 800;
  background: color-mix(in srgb, var(--wb) 90%, transparent);
}
.srp-root td.cell-am {
  color: var(--am);
  font-weight: 800;
  background: color-mix(in srgb, var(--am-bg) 90%, transparent);
}
.srp-root td.t0 {
  background: var(--sf);
  font-size: 16px;
  font-weight: 800;
  color: var(--tx);
  padding: 16px 16px 6px;
  letter-spacing: -0.02em;
}
.srp-root td.t1 {
  background: var(--sf);
  color: var(--mt);
  font-size: 12px;
  padding: 4px 16px 14px;
}
.srp-root .report-scope-card {
  padding: 18px 20px;
}
.srp-root .report-scope-card .card-h {
  margin-bottom: 12px;
  padding-bottom: 10px;
}
.srp-root .report-scope-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px 14px;
}
.srp-root .report-scope-grid label {
  min-width: 0;
  margin-bottom: 0;
}
.srp-root .report-scope-grid select, .srp-root .report-scope-grid input {
  min-width: 0;
}
.srp-root .report-scope-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--bd2);
}
@media (max-width: 1100px) {
.srp-root .report-scope-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
.srp-root .report-scope-grid { grid-template-columns: minmax(0, 1fr); }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media print { body * { visibility: hidden !important; } .srp-root, .srp-root * { visibility: visible !important; } .srp-root { position: absolute; left: 0; top: 0; width: 100%; } .srp-root .no-print { display: none !important; } }

`;

/* ---------- page ---------- */
export default function SapReports() {
  const user = useMemo(() => {
    try { return { is_admin: String(jwtDecode(localStorage.getItem("token") || "").role || "").toUpperCase() === "ADMIN" }; }
    catch { return { is_admin: false }; }
  }, []);
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState("");

  const loadBoot = useCallback(
    () => api.get("/data").then(setBoot).catch((e) => { setError(e.message); toast(e.message); }),
    []
  );
  useEffect(() => { loadBoot(); }, [loadBoot]);

  return (
    <div className="srp-root">
      <style>{CSS}</style>
      {boot ? <Generate user={user} boot={boot} /> : <div className="sp-card"><p className="mt">{error || "Loading…"}</p></div>}
    </div>
  );
}
