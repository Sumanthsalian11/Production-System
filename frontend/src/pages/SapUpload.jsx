import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toastLib from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";

/* ---------- API (same token / BASE_URL as the rest of the app) ---------- */
const API = `${BASE_URL}/api/sap-upload`;
const authCfg = (extra = {}) => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, ...extra });
const fail = (e) => {
  if (!e?.response) return new Error("Cannot reach server. Check your connection.");
  const d = e.response.data;
  return new Error(d?.error || d?.message || (e.response.status === 401 ? "Session expired. Please log in again." : e.message));
};
const api = {
  get: (p) => axios.get(API + p, authCfg()).then((r) => r.data).catch((e) => { throw fail(e); }),
  upload: (p, form) => axios.post(API + p, form, authCfg({ timeout: 0 })).then((r) => r.data).catch((e) => { throw fail(e); }),
  del: (p) => axios.delete(API + p, authCfg()).then((r) => r.data).catch((e) => { throw fail(e); }),
};

// stable function (kept outside the component)
const toast = (m) => {
  const msg = typeof m === "string" ? m : m?.message || String(m);
  if (/fail|error|invalid|not found|cannot|could not|missing|required|expired|denied|too large|select|upload an/i.test(msg)) toastLib.error(msg, { duration: 5000 });
  else if (/loaded|deleted/i.test(msg)) toastLib.success(msg, { duration: 3500 });
  else toastLib(msg, { duration: 4000 });
};


const formatDate = value => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN');
};

function SapUploadInner({ user, boot, reloadBoot }) {
  const fileRef = useRef(null);
  const [datasets, setDatasets] = useState(boot.datasets || []);
  const [logicTemplateId, setLogicTemplateId] = useState(String(boot.templates?.[0]?.id || ''));
  const [uploading, setUploading] = useState(false);
  const [dragOn, setDragOn] = useState(false);

  useEffect(() => setDatasets(boot.datasets || []), [boot.datasets]);
  useEffect(() => {
    setLogicTemplateId(current => boot.templates?.some(t => String(t.id) === current) ? current : String(boot.templates?.[0]?.id || ''));
  }, [boot.templates]);

  const uploadFile = async file => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      if (logicTemplateId) form.append('logicTemplateId', logicTemplateId);
      form.append('file', file);
      const result = await api.upload('/datasets', form);
      setDatasets(current => [result.dataset, ...current.filter(dataset => dataset.id !== result.dataset.id)]);
      await reloadBoot();
      toast(`Loaded ${result.dataset.row_count.toLocaleString('en-IN')} rows from ${result.dataset.file_name}`);
    } catch (error) {
      toast(error.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onFile = event => uploadFile(event.target.files?.[0]);

  const removeDataset = async dataset => {
    if (!window.confirm(`Delete uploaded data "${dataset.file_name}" permanently?`)) return;
    try {
      await api.del(`/datasets/${dataset.id}`);
      setDatasets(current => current.filter(item => item.id !== dataset.id));
      await reloadBoot();
      toast('Dataset deleted');
    } catch (error) {
      toast(error.message);
    }
  };

  const active = datasets[0];

  return <>
    <div className="sp-card upload-control-card">
      <div className="card-h">
        <h3><span className="sp-badge ac" style={{ padding: '3px 8px', fontSize: 11 }}>1</span> Upload SAP export</h3>
        {active && <div className="status-pill" style={{ background: 'var(--sf)', borderColor: 'var(--bd2)', color: 'var(--tx)', padding: '6px 14px' }}>
          <span style={{ color: 'var(--ok)', fontWeight: 700 }}>Active:</span>
          <span>{active.file_name}</span>
          <span className="sp-badge sm ac" style={{ marginLeft: 4 }}>{active.row_count.toLocaleString('en-IN')} rows</span>
        </div>}
      </div>

      {boot.templates?.length > 0 && <label style={{ marginBottom: 14 }}>
        Bank / Product Logic
        <select value={logicTemplateId} onChange={e => setLogicTemplateId(e.target.value)} disabled={uploading}>
          {boot.templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
        <small style={{ color: 'var(--mt)' }}>This bank / product’s saved movement rules will be linked to the uploaded SAP data.</small>
      </label>}

      <div
        className={`upload-dropzone ${dragOn ? 'dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !uploading && fileRef.current?.click()}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); fileRef.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); setDragOn(true); }}
        onDragLeave={() => setDragOn(false)}
        onDrop={e => { e.preventDefault(); setDragOn(false); uploadFile(e.dataTransfer.files?.[0]); }}
      >
        <div className="upload-dropzone-icon" aria-hidden="true">
          {uploading ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>
        <strong>{uploading ? 'Uploading and analyzing SAP dataset…' : 'Drop your SAP movement export here, or click to browse'}</strong>
        <span>Supports .xlsx, .xlsm, .xls, and .csv workbooks</span>
        <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" onChange={onFile} disabled={uploading} hidden aria-label="Upload SAP movement export" />
      </div>
    </div>

    <div className="sp-card">
      <div className="card-h">
        <h3>Uploaded datasets</h3>
        <span className="sp-badge ac">{datasets.length} files</span>
      </div>
      {datasets.length ? <div className="scroll" style={{ maxHeight: 460 }}><table>
        <thead><tr><th>File</th><th>Bank / Product Logic</th><th>Rows</th><th>Posting date span</th><th>Sheet</th>{user.is_admin && <th style={{ textAlign: 'right' }}>Action</th>}</tr></thead>
        <tbody>{datasets.map((dataset, idx) => <tr key={dataset.id}>
          <td>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontWeight: 650 }}>{dataset.file_name}</strong>
              {idx === 0 && <span className="sp-badge ok">Latest</span>}
            </div>
          </td>
          <td>{boot.templates?.find(t => String(t.id) === String(dataset.logic_template_id))?.name || 'Default logic'}</td>
          <td className="n"><span className="sp-badge ac">{dataset.row_count.toLocaleString('en-IN')}</span></td>
          <td>{formatDate(dataset.min_date)} – {formatDate(dataset.max_date)}</td>
          <td><span className="sp-badge">{dataset.sheet_name || '—'}</span></td>
          {user.is_admin && <td style={{ textAlign: 'right' }}><button className="sm dg" onClick={() => removeDataset(dataset)}>Delete</button></td>}
        </tr>)}</tbody>
      </table></div> : <p className="mt">No SAP movement data has been uploaded yet.</p>}
    </div>
  </>;
}

const CSS = `
/* Styles of this page only: every rule is scoped under .sup-root so nothing leaks into the rest of the app */
.sup-root { box-sizing: border-box; padding: 4px 2px 24px; color: var(--tx); font-family: var(--font-sans); font-size: 14px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.sup-root *, .sup-root *::before, .sup-root *::after { box-sizing: border-box; }
.sup-root button, .sup-root input, .sup-root select, .sup-root textarea { font-family: inherit; font-size: inherit; line-height: inherit; }
.sup-root h1, .sup-root h2, .sup-root h3 { font-family: var(--font-display); color: var(--tx); font-weight: 700; letter-spacing: -0.025em; margin: 0; }
.sup-root label { margin-bottom: 0; }
.sup-root p { margin-bottom: 0; }
.sup-root .sp-card { display: block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.sup-root {
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
.sup-root *, .sup-root *::before, .sup-root *::after { box-sizing: border-box; }
.sup-root button, .sup-root input, .sup-root select, .sup-root textarea {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
.sup-root button {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.sup-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.sup-root ::-webkit-scrollbar-track { background: transparent; }
.sup-root ::-webkit-scrollbar-thumb {
  background: var(--bd);
  border-radius: var(--rad-full);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.sup-root ::-webkit-scrollbar-thumb:hover { background: var(--mt-light); background-clip: padding-box; }
.sup-root :focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.sup-root h1, .sup-root h2, .sup-root h3, .sup-root h4, .sup-root h5, .sup-root h6 {
  font-family: var(--font-display);
  color: var(--tx);
  font-weight: 700;
  letter-spacing: -0.025em;
  margin: 0;
}
.sup-root a { color: var(--ac); text-decoration: none; transition: color var(--trans); }
.sup-root a:hover { color: var(--ac-h); }
.sup-root hr { border: 0; border-top: 1px solid var(--bd2); margin: 16px 0; }
.sup-root ::selection { background: var(--ac-ring); }
.sup-root .status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 13px;
  border: 1px solid var(--ok-bd);
  border-radius: var(--rad-full);
  background: var(--ok-bg);
  color: var(--ok);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: -0.01em;
  box-shadow: var(--sh-xs);
}
.sup-root .sp-badge {
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
.sup-root .sp-badge::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--rad-full);
  background: currentColor;
  opacity: 0.85;
}
.sup-root .sp-badge.ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-bd); }
.sup-root .sp-badge.am { background: var(--am-bg); color: var(--am); border-color: var(--am-bd); }
.sup-root .sp-badge.wr { background: var(--wb);    color: var(--wr); border-color: var(--wb-bd); }
.sup-root .sp-badge.ac { background: var(--ac2);   color: var(--ac); border-color: var(--ac-bd); }
.sup-root .card-h h3 > .sp-badge.ac:first-child {
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
.sup-root .card-h h3 > .sp-badge.ac:first-child::before { display: none; }
.sup-root .sp-card {
  position: relative;
  margin: 0 0 22px;
  padding: 24px 26px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: var(--sf);
  box-shadow: var(--sh-sm);
  transition: border-color var(--trans), box-shadow var(--trans);
}
.sup-root .sp-card:hover { box-shadow: var(--sh); border-color: var(--bd); }
.sup-root .card-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--bd2);
}
.sup-root h3 {
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
.sup-root .card-h h3 { margin: 0; }
.sup-root .mt { color: var(--mt); font-size: 12.5px; }
.sup-root p.mt { max-width: 90ch; line-height: 1.65; margin: 6px 0 14px; }
.sup-root .upload-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px 24px;
  border: 2px dashed var(--ac-bd);
  border-radius: var(--rad-lg);
  background: linear-gradient(180deg, var(--ac2) 0%, var(--sf2) 100%);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--trans), background var(--trans), transform var(--trans), box-shadow var(--trans);
}
.sup-root .upload-dropzone:hover, .sup-root .upload-dropzone.dragging {
  border-color: var(--ac);
  background: var(--ac2);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -10px var(--ac-ring);
}
.sup-root .upload-dropzone-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: var(--ac-gradient);
  color: var(--on-ac);
  box-shadow: var(--ac-glow);
}
.sup-root .upload-dropzone strong {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 750;
  color: var(--tx);
}
.sup-root .upload-dropzone span {
  font-size: 12.5px;
  color: var(--mt);
}
.sup-root button {
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
.sup-root button:hover {
  background: var(--sf2);
  border-color: var(--ac-bd);
  color: var(--ac);
  box-shadow: var(--sh-sm);
}
.sup-root button:active { transform: translateY(1px); }
.sup-root button.on {
  background: var(--ac-gradient);
  color: var(--on-ac);
  border: 1px solid transparent;
  box-shadow: var(--ac-glow), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.sup-root button.on:hover {
  background: var(--ac-gradient-hover);
  color: var(--on-ac);
  border-color: transparent;
  box-shadow: var(--ac-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}
.sup-root button.on:active { transform: translateY(1px); }
.sup-root button.sm {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: var(--rad-sm);
  font-weight: 600;
}
.sup-root button.dg {
  color: var(--wr);
  border-color: var(--wb-bd);
  background: transparent;
}
.sup-root button.dg:hover {
  background: var(--wb);
  color: var(--wr);
  border-color: var(--wr);
}
.sup-root button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  pointer-events: none;
}
.sup-root label {
  display: block;
  margin-bottom: 14px;
  color: var(--tx-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.sup-root input, .sup-root select, .sup-root textarea {
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
.sup-root input:hover, .sup-root select:hover, .sup-root textarea:hover { border-color: var(--ac-bd); }
.sup-root input:focus, .sup-root select:focus, .sup-root textarea:focus {
  border-color: var(--ac);
  box-shadow: 0 0 0 4px var(--ac-ring);
  background: var(--sf);
}
.sup-root input::placeholder, .sup-root textarea::placeholder { color: var(--mt-light); opacity: 0.9; }
.sup-root input[type="checkbox"] {
  width: 18px;
  min-height: 18px;
  height: 18px;
  margin: 0;
  border-radius: var(--rad-xs);
  accent-color: var(--ac);
  cursor: pointer;
}
.sup-root input[type="file"] {
  min-height: 72px;
  padding: 14px 16px;
  border: 2px dashed var(--ac-bd);
  border-radius: var(--rad-lg);
  background: var(--ac2);
  color: var(--tx-muted);
  cursor: pointer;
  transition: all var(--trans);
}
.sup-root input[type="file"]:hover { border-color: var(--ac); background: var(--sf-hover); }
.sup-root input[type="file"]::file-selector-button {
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
.sup-root input[type="file"]::file-selector-button:hover { background: var(--ac-gradient-hover); }
.sup-root textarea {
  min-height: 88px;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
}
.sup-root select {
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2362718d' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.6' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 18px;
  padding-right: 38px;
  appearance: none;
  -webkit-appearance: none;
}
.sup-root .scroll {
  overflow: auto;
  max-height: 600px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-md);
  background: var(--sf);
  box-shadow: var(--sh-xs);
}
.sup-root table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12.5px;
  font-family: var(--font-sans);
}
.sup-root td, .sup-root th {
  padding: 11px 16px;
  border-bottom: 1px solid var(--bd2);
  white-space: nowrap;
}
.sup-root th {
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
.sup-root td.n, .sup-root th.n {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
}
.sup-root td.n { font-family: var(--font-mono); font-size: 12px; }
.sup-root tbody tr:where(:nth-child(even)) td { background: var(--zebra); }
.sup-root tbody tr { transition: background-color 0.12s ease; }
.sup-root tbody tr:last-child td { border-bottom: 0; }
.sup-root .upload-control-card {
  padding: 18px 20px;
}
.sup-root .upload-control-card .card-h {
  margin-bottom: 12px;
  padding-bottom: 10px;
}

@media print { body * { visibility: hidden !important; } .sup-root, .sup-root * { visibility: visible !important; } .sup-root { position: absolute; left: 0; top: 0; width: 100%; } .sup-root .no-print { display: none !important; } }

`;

/* ---------- page ---------- */
export default function SapUpload() {
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
    <div className="sup-root">
      <style>{CSS}</style>
      {boot ? (
        <SapUploadInner user={user} boot={boot} reloadBoot={loadBoot} />
      ) : (
        <div className="sp-card"><p className="mt">{error || "Loading…"}</p></div>
      )}
    </div>
  );
}
