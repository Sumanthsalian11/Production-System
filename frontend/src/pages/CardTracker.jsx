import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toastLib from "react-hot-toast";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";

/* ---------- API (same token / BASE_URL as the rest of the app) ---------- */
const API = `${BASE_URL}/api`;
const authCfg = (extra = {}) => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, ...extra });
const fail = (e) => {
  if (e?.response?.status === 401 || e?.response?.status === 403) {
    const m = e.response.data?.error || e.response.data?.message;
    return new Error(m || "Session expired. Please log in again.");
  }
  if (!e?.response) return new Error("Cannot reach server. Check your connection.");
  const d = e.response.data;
  let msg = d?.error || d?.message;
  if (!msg && d instanceof Blob) msg = "Download failed";
  return new Error(msg || e.message);
};
const api = {
  get: (p) => axios.get(API + p, authCfg()).then((r) => r.data).catch((e) => { throw fail(e); }),
  upload: (p, form) => axios.post(API + p, form, authCfg({ timeout: 0 })).then((r) => r.data).catch((e) => { throw fail(e); }),
  del: (p) => axios.delete(API + p, authCfg()).then((r) => r.data).catch((e) => { throw fail(e); }),
  async download(p, { body, fallback = "download.xlsx" } = {}) {
    let res;
    try { res = await axios.post(API + p, body, authCfg({ responseType: "blob", timeout: 0 })); }
    catch (e) {
      if (e?.response?.data instanceof Blob) {
        try { throw new Error(JSON.parse(await e.response.data.text()).error || "Download failed"); }
        catch (x) { throw x instanceof SyntaxError ? new Error("Download failed") : x; }
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

// stable function (it is listed in useEffect dependency arrays below)
const toast = (m) => {
  const msg = typeof m === "string" ? m : m?.message || String(m);
  if (/fail|error|invalid|not |cannot|could not|missing|expired|denied|too large/i.test(msg)) toastLib.error(msg, { duration: 5000 });
  else if (/loaded|deleted|started|saved/i.test(msg)) toastLib.success(msg, { duration: 3500 });
  else toastLib(msg, { duration: 4000 });
};


const DAY = 864e5;
const RENDER_LIMIT = 1000;
const num = x => (Number(x) || 0).toLocaleString('en-IN');
const fmtD = iso => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '');
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const fifo = (a, b) => (Date.parse(a.recv) - Date.parse(b.recv)) || (a.ts - b.ts) || (a.i - b.i);

const TABS = [
  ['pn', 'Stage Pending (FIFO)'],
  ['ov', 'Overview'],
  ['bt', 'Batches'],
  ['sc', 'Daily Capacity Plan'],
  ['dp', 'Dispatched'],
  ['jb', 'All Jobs']
];

const Chip = ({ tone = 'mt', children }) => <span className={`ct-chip t-${tone}`}>{children}</span>;

function Table({ cols, rows, empty = 'Nothing matches the current selection.', limit = RENDER_LIMIT }) {
  const shown = rows.slice(0, limit);
  return (
    <>
      <div className="scroll" style={{ maxHeight: 560 }}>
        <table className="ct-table">
          <thead><tr>{cols.map((c, i) => <th key={i} className={c.n ? 'ct-num' : ''}>{c.h}</th>)}</tr></thead>
          <tbody>
            {shown.length ? shown.map((r, ri) => (
              <tr key={r.i ?? r.key ?? ri}>{cols.map((c, ci) => <td key={ci} className={c.n ? 'ct-num' : ''}>{c.f(r, ri)}</td>)}</tr>
            )) : <tr><td colSpan={cols.length} className="mt" style={{ textAlign: 'center', padding: 22 }}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <div className="ct-note">Showing the first {num(limit)} of {num(rows.length)} rows (FIFO order). Use the filters or export for the full list.</div>}
    </>
  );
}

function CardTrackerInner({ user }) {
  const fileRef = useRef(null);
  const [boot, setBoot] = useState(null);
  const [datasetId, setDatasetId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragOn, setDragOn] = useState(false);
  const [asOf, setAsOf] = useState('');
  const [tab, setTab] = useState('pn');
  const [menuOpen, setMenuOpen] = useState(false);
  const [stageSel, setStageSel] = useState('ALL');
  const [flt, setFlt] = useState({ bank: '', lot: '', pri: '', q: '' });
  const [caps, setCaps] = useState({});
  const [todayOnly, setTodayOnly] = useState(true);
  const [jobQ, setJobQ] = useState('');
  const [jobStage, setJobStage] = useState('');

  const loadBoot = useCallback(async (selectId) => {
    const b = await api.get('/card-tracker/config');
    setBoot(b);
    setDatasetId(cur => selectId ?? (b.datasets.some(d => d.id === cur) ? cur : b.datasets[0]?.id ?? null));
    return b;
  }, []);

  useEffect(() => { loadBoot().catch(e => toast(e.message)); }, [loadBoot, toast]);

  useEffect(() => {
    if (!datasetId) { setData(null); return; }
    setLoading(true);
    api.get(`/card-tracker/datasets/${datasetId}`)
      .then(d => { setData(d); setAsOf(d.asOf); })
      .catch(e => { setData(null); toast(e.message); })
      .finally(() => setLoading(false));
  }, [datasetId, toast]);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const cfg = boot?.config;
  useEffect(() => {
    if (cfg) setCaps(Object.fromEntries(cfg.stages.map(s => [s.key, s.dailyCap || ''])));
  }, [cfg]);

  /* ---------- derived data (everything below is driven by the configuration) ---------- */
  const stages = cfg?.stages || [];
  const fieldOf = useMemo(() => Object.fromEntries((cfg?.fields || []).map(f => [f.key, f])), [cfg]);
  const label = k => fieldOf[k]?.label || k;
  const bands = useMemo(() => [...(cfg?.priorities || [])].sort((a, b) => b.minAge - a.minAge), [cfg]);
  const topBand = bands[0];
  const ageOf = j => Math.max(0, Math.round((Date.parse(asOf) - Date.parse(j.recv)) / DAY));
  const bandOf = j => { const a = ageOf(j); return bands.find(p => a >= p.minAge) || bands[bands.length - 1]; };
  const jobs = data?.jobs;

  const queues = useMemo(() => {
    if (!jobs) return {};
    return Object.fromEntries(stages.map(s => [s.key, jobs.filter(j => j.cur === s.key).sort(fifo).map((j, k) => ({ ...j, rank: k + 1 }))]));
  }, [jobs, stages]);

  const stageOf = k => stages.find(s => s.key === k);
  const StageChip = ({ k }) => (k ? <Chip tone={stageOf(k)?.tone}>{stageOf(k)?.label}</Chip> : <Chip tone="ok">{label('dispatchQty')}</Chip>);
  const stateBadge = st => {
    if (st === 'Completed') return <Chip tone="ok">Done</Chip>;
    if (st === 'Partial') return <Chip tone="am">Partial</Chip>;
    if (st === 'N/A') return <Chip tone="mt">N/A</Chip>;
    return <Chip>Pending</Chip>;
  };

  // One renderer for every configured column source.
  const cell = (col, j) => {
    const s = col.source;
    let out;
    if (s === 'rank') out = j.rank;
    else if (s === 'priority') { const b = bandOf(j); out = <Chip tone={b.tone}>{b.label}</Chip>; }
    else if (s === 'age') out = ageOf(j);
    else if (s === 'recv') out = fmtD(j.recv);
    else if (s === 'processed') out = <span className="mt">{[fmtD(j.f.procDate), j.f.procTime].filter(Boolean).join(' ') || '—'}</span>;
    else if (s === 'pq') out = num(j.pq);
    else if (s === 'blank') out = '';
    else if (s.startsWith('state:')) out = stateBadge(j.states[s.slice(6)]);
    else if (s.includes('/')) out = s.split('/').map(k => num(j.f[k])).join(' / ');
    else {
      const t = fieldOf[s]?.type;
      out = t === 'number' ? num(j.f[s]) : t === 'date' ? fmtD(j.f[s]) : j.f[s];
    }
    if (col.bold) out = <b>{out}</b>;
    return col.badgeWhenPartial && j.partial ? <>{out} <Chip tone="am">Partial</Chip></> : out;
  };
  const toCols = list => list.map(c => ({ h: c.label || label(c.source), n: c.numeric, f: j => cell(c, j) }));

  /* ---------- actions ---------- */
  const upload = async file => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.upload('/card-tracker/datasets', form);
      await loadBoot(r.dataset.id);
      toast(`Loaded ${num(r.dataset.row_count)} jobs from ${r.dataset.file_name}`);
    } catch (e) { toast(e.message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const removeDataset = async () => {
    const d = boot.datasets.find(x => x.id === datasetId);
    if (!d || !window.confirm(`Delete tracker data "${d.file_name}" permanently?`)) return;
    try { await api.del(`/card-tracker/datasets/${d.id}`); setDatasetId(null); await loadBoot(); toast('Dataset deleted'); }
    catch (e) { toast(e.message); }
  };

  const exportTo = async target => {
    setMenuOpen(false);
    const targets = target === 'ALL_SEPARATE' ? stages.map(s => s.key) : [target];
    try {
      for (const t of targets) {
        await api.download('/card-tracker/export', { method: 'POST', body: { datasetId, asOf, target: t }, fallback: 'tracker.xlsx' });
      }
      toast('Download started');
    } catch (e) { toast(e.message); }
  };

  /* ---------- gates ---------- */
  if (!boot) return <div className="ck-card"><p className="mt">Loading Card Job Tracker…</p></div>;

  if (!boot.configured) {
    return <div className="ck-card">
      <div className="card-h"><h3>Card Job Tracker is not configured</h3></div>
      <p className="mt">The built-in tracker configuration could not be loaded. Contact your administrator.</p>
    </div>;
  }

  const toolbar = (
    <div className="ct-toolbar no-print">
      {boot.datasets.length > 0 && <label>Dataset
        <select value={datasetId ?? ''} onChange={e => setDatasetId(e.target.value)}>
          {boot.datasets.map(d => <option key={d.id} value={d.id}>{d.file_name} · {num(d.row_count)} jobs</option>)}
        </select>
      </label>}
      {data && <label>As-of date
        <input type="date" value={asOf} onChange={e => e.target.value && setAsOf(e.target.value)} />
      </label>}
      <span className="ct-spacer" />
      {data && <div className="ct-menu-wrap" onClick={e => e.stopPropagation()}>
        <button onClick={() => setMenuOpen(o => !o)}>Export Excel ▾</button>
        {menuOpen && <div className="ct-menu">
          {stages.map(s => <button key={s.key} onClick={() => exportTo(s.key)}>
            <span>{s.label} Pending (FIFO)</span><Chip tone={s.tone}>{num(queues[s.key]?.length)}</Chip>
          </button>)}
          <hr />
          <button onClick={() => exportTo('ALL_SEPARATE')}><b>Download all {stages.length} stage files</b></button>
          <button onClick={() => exportTo('COMBINED')}><b>Download full workbook</b></button>
        </div>}
      </div>}
      {user.is_admin && data && <button className="dg" onClick={removeDataset}>Delete dataset</button>}
      <button className="pri" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : 'Upload sheet'}</button>
      <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden onChange={e => upload(e.target.files?.[0])} />
    </div>
  );

  if (!boot.datasets.length) {
    return <>{toolbar}
      <div className={`ct-drop upload-dropzone ${dragOn ? 'on dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => !busy && fileRef.current?.click()}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); fileRef.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); setDragOn(true); }} onDragLeave={() => setDragOn(false)}
        onDrop={e => { e.preventDefault(); setDragOn(false); upload(e.dataTransfer.files?.[0]); }}>
        <div className="upload-dropzone-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h3>Drop the tracker sheet here</h3>
        <p className="mt">.xlsx, .xls or .csv — columns are matched by name (AutoTrackDetails export works as-is).</p>
      </div></>;
  }
  if (loading || !data) return <>{toolbar}<div className="ck-card"><p className="mt">{loading ? 'Loading jobs…' : 'No data to show.'}</p></div></>;

  /* ---------- tabs ---------- */
  const open = jobs.filter(j => j.cur);

  const vPending = () => {
    const banks = [...new Set(open.map(j => j.f.bank))].sort();
    const lots = [...new Set(open.map(j => j.f.flag))].sort();
    const q = flt.q.trim().toLowerCase();
    const filtered = k => queues[k].filter(j =>
      (!flt.bank || j.f.bank === flt.bank) && (!flt.lot || j.f.flag === flt.lot) && (!flt.pri || bandOf(j).key === flt.pri) &&
      (!q || [j.f.bank, j.f.desc, j.f.qcSheet, j.f.auditSheet, j.f.mct, j.f.flag, j.f.dispatchMode].join(' ').toLowerCase().includes(q)));
    const anyFilter = flt.bank || flt.lot || flt.pri || flt.q;

    return <>
      <div className="kpis">
        {stages.map(s => {
          const L = queues[s.key];
          const hi = L.filter(j => bandOf(j).key === topBand.key).length;
          return <div key={s.key} className={`kpi ct-click ${stageSel === s.key ? 'on' : ''}`} onClick={() => setStageSel(s.key)}>
            <div className="kpi-header"><Chip tone={s.tone}>{s.label}</Chip><span className="ks">Oldest: <b>{L[0] ? fmtD(L[0].recv) : '—'}</b></span></div>
            <div className="kv">{num(L.length)}</div>
            <div className="ks">{num(sum(L, j => j.pq))} pending cards{hi ? ` · ${hi} ${topBand.label}` : ''}</div>
          </div>;
        })}
      </div>
      <div className="ck-card ct-filter-card">
        <div className="chips ct-stage-chips" style={{ marginBottom: 12 }}>
          <button className={stageSel === 'ALL' ? 'on' : ''} onClick={() => setStageSel('ALL')}>All stages ({num(open.length)})</button>
          {stages.map(s => <button key={s.key} className={stageSel === s.key ? 'on' : ''} onClick={() => setStageSel(s.key)}>{s.label} ({num(queues[s.key].length)})</button>)}
        </div>
        <div className="ck-row ct-filter-row" style={{ alignItems: 'flex-end' }}>
          <label>{label('bank')}<select value={flt.bank} onChange={e => setFlt({ ...flt, bank: e.target.value })}><option value="">All</option>{banks.map(b => <option key={b}>{b}</option>)}</select></label>
          <label>{label('flag')}<select value={flt.lot} onChange={e => setFlt({ ...flt, lot: e.target.value })}><option value="">All</option>{lots.map(l => <option key={l}>{l}</option>)}</select></label>
          <label>Priority<select value={flt.pri} onChange={e => setFlt({ ...flt, pri: e.target.value })}><option value="">All</option>{cfg.priorities.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
          <label style={{ flex: 1, minWidth: 220 }}>Search<input value={flt.q} placeholder="Bank, job, QC sheet, audit no, ref…" onChange={e => setFlt({ ...flt, q: e.target.value })} /></label>
          {anyFilter && <button className="sm" onClick={() => setFlt({ bank: '', lot: '', pri: '', q: '' })}>Reset filters</button>}
        </div>
      </div>
      {(stageSel === 'ALL' ? stages : [stageOf(stageSel)]).map(s => {
        const L = filtered(s.key);
        return <div className="ck-card" key={s.key}>
          <div className="card-h">
            <h3><Chip tone={s.tone}>{s.label}</Chip> Pending queue (FIFO)</h3>
            <div className="ck-row">
              <span className="mt">Showing <b>{num(L.length)}</b> jobs · <b>{num(sum(L, j => j.pq))}</b> cards</span>
              <button className="sm pri" disabled={!queues[s.key].length} onClick={() => exportTo(s.key)}>⬇ Export {s.label} Excel</button>
            </div>
          </div>
          <Table cols={toCols([...cfg.queueColumns, ...s.columns])} rows={L} empty="No pending jobs match the current selection." />
        </div>;
      })}
    </>;
  };

  const vOverview = () => {
    const byDate = new Map();
    open.forEach(j => {
      const o = byDate.get(j.recv) || { key: j.recv, recv: j.recv, jobs: 0, cards: 0, by: {} };
      o.jobs++; o.cards += j.pq; o.by[j.cur] = (o.by[j.cur] || 0) + 1;
      byDate.set(j.recv, o);
    });
    const dispatchedCards = sum(jobs.filter(j => j.done || j.partial), j => (j.done ? j.f.qty : j.f.dispatchQty));
    return <>
      <div className="kpis">
        <div className="kpi"><div className="kl">Total Jobs</div><div className="kv">{num(jobs.length)}</div><div className="ks">{num(sum(jobs, j => j.f.qty))} cards</div></div>
        <div className="kpi"><div className="kl">Cards Dispatched</div><div className="kv">{num(dispatchedCards)}</div><div className="ks">{num(jobs.filter(j => j.done).length)} jobs complete</div></div>
        <div className="kpi am"><div className="kl">Open Jobs</div><div className="kv">{num(open.length)}</div><div className="ks">{num(sum(open, j => j.pq))} cards pending</div></div>
        <div className="kpi wr"><div className="kl">High-Priority Open Jobs (Aged 2+ days)</div><div className="kv">{num(open.filter(j => bandOf(j).key === topBand.key).length)}</div></div>
      </div>
      <div className="ck-card">
        <div className="card-h"><h3>Stage-wise progress & active queue</h3></div>
        <p className="ct-note">A completed later stage marks earlier pending stages as N/A, as set in the stage rules.</p>
        <Table rows={stages} cols={[
          { h: 'Stage', f: s => <Chip tone={s.tone}>{s.label}</Chip> },
          { h: 'Completed', n: 1, f: s => num(jobs.filter(j => j.states[s.key] === 'Completed').length) },
          { h: 'N/A', n: 1, f: s => num(jobs.filter(j => j.states[s.key] === 'N/A').length) },
          { h: 'Waiting here', n: 1, f: s => <b>{num(queues[s.key].length)}</b> },
          { h: 'Cards waiting', n: 1, f: s => <b>{num(sum(queues[s.key], j => j.pq))}</b> },
          { h: 'Oldest data date', f: s => (queues[s.key][0] ? fmtD(queues[s.key][0].recv) : '—') },
          { h: 'Completion %', f: s => {
            const done = jobs.filter(j => j.states[s.key] === 'Completed').length;
            const app = jobs.length - jobs.filter(j => j.states[s.key] === 'N/A').length;
            const pct = app ? Math.round(100 * done / app) : 100;
            return <div className="ct-bar-wrap"><div className="ct-bar"><i style={{ width: `${pct}%` }} /></div><span className="mt">{pct}%</span></div>;
          } }
        ]} />
      </div>
      <div className="ck-card">
        <div className="card-h"><h3>Open work by data received date (FIFO ageing)</h3></div>
        <Table rows={[...byDate.values()].sort((a, b) => a.recv.localeCompare(b.recv))} cols={[
          { h: label('recvDate'), f: r => fmtD(r.recv) },
          { h: 'Age', n: 1, f: r => `${Math.max(0, Math.round((Date.parse(asOf) - Date.parse(r.recv)) / DAY))} d` },
          ...stages.map(s => ({ h: s.label, n: 1, f: r => (r.by[s.key] ? <Chip tone={s.tone}>{num(r.by[s.key])}</Chip> : '—') })),
          { h: 'Open jobs', n: 1, f: r => <b>{num(r.jobs)}</b> },
          { h: 'Open cards', n: 1, f: r => <b>{num(r.cards)}</b> }
        ]} />
      </div>
    </>;
  };

  const vBatches = () => <div className="ck-card">
    <div className="card-h"><h3>Batches ({label('recvDate')} + {label('flag')})</h3></div>
    <p className="ct-note">Stage counts show jobs currently waiting at each stage.</p>
    <Table rows={data.batches.map(b => ({ ...b, key: `${b.recv}|${b.flag}` }))} cols={[
      { h: label('recvDate'), f: b => fmtD(b.recv) },
      { h: label('flag'), f: b => b.flag },
      { h: 'Jobs', n: 1, f: b => num(b.jobs) },
      { h: 'Cards', n: 1, f: b => num(b.cards) },
      ...stages.map(s => ({ h: s.label, n: 1, f: b => (b.waiting[s.key] ? <Chip tone={s.tone}>{num(b.waiting[s.key])}</Chip> : <span className="mt">—</span>) })),
      { h: 'Completed jobs', n: 1, f: b => num(b.done) },
      { h: `Cards ${label('dispatchQty').toLowerCase()}`, f: b => {
        const pct = Math.round(100 * b.dispatchedCards / Math.max(b.cards, 1));
        return <div className="ct-bar-wrap"><div className="ct-bar"><i style={{ width: `${pct}%` }} /></div><span className="mt">{pct}%</span></div>;
      } },
      { h: 'Batch status', f: b => { const s = stages.find(x => b.waiting[x.key]); return s ? <Chip tone={s.tone}>{s.label}</Chip> : <Chip tone="ok">{label('dispatchQty')}</Chip>; } }
    ]} />
  </div>;

  const vSchedule = () => {
    const planned = Object.fromEntries(stages.map(s => {
      const cap = Number(caps[s.key]) || 0;
      let cum = 0;
      return [s.key, queues[s.key].map(j => { const slot = (!cap || cum < cap) ? 'Today' : 'Next'; cum += j.pq; return { ...j, slot }; })];
    }));
    return <>
      <div className="ck-card">
        <div className="ck-row" style={{ alignItems: 'flex-end' }}>
          {stages.map(s => <label key={s.key}>{s.label}: daily card target (blank = all)
            <input type="number" min="0" value={caps[s.key] ?? ''} onChange={e => setCaps({ ...caps, [s.key]: e.target.value })} />
          </label>)}
          <label>Show<select value={todayOnly ? '1' : '0'} onChange={e => setTodayOnly(e.target.value === '1')}>
            <option value="1">Today’s FIFO allocation</option><option value="0">All waiting jobs</option>
          </select></label>
        </div>
        <p className="ct-note">Jobs are allocated strictly in FIFO order (oldest data date first, then processed timestamp).</p>
      </div>
      {stages.map(s => {
        const L = planned[s.key], today = L.filter(j => j.slot === 'Today');
        return <div className="ck-card" key={s.key}>
          <div className="card-h">
            <h3><Chip tone={s.tone}>{s.label}</Chip> {num(today.length)} jobs / {num(sum(today, j => j.pq))} cards today · {num(L.length)} waiting</h3>
            <button className="sm" disabled={!L.length} onClick={() => exportTo(s.key)}>⬇ Export {s.label} Excel</button>
          </div>
          <Table rows={todayOnly ? today : L} cols={[
            { h: 'FIFO #', n: 1, f: j => j.rank },
            { h: 'Slot', f: j => (j.slot === 'Today' ? <b>Today</b> : <span className="mt">Next</span>) },
            ...toCols([
              { source: 'priority', label: 'Priority' }, { source: 'recv', label: label('recvDate') }, { source: 'flag' }, { source: 'bank' },
              { source: 'desc' }, { source: 'qcSheet' }, { source: 'pq', label: cfg.export.labels.cards, numeric: true, badgeWhenPartial: true }, { source: 'dispatchMode' }
            ])
          ]} />
        </div>;
      })}
    </>;
  };

  const vDispatched = () => {
    const part = jobs.filter(j => j.partial);
    const byDay = new Map();
    data.dispatches.forEach(g => {
      const k = `${g.date}|${g.mode}`;
      const o = byDay.get(k) || { key: k, date: g.date, mode: g.mode, n: 0, jobs: 0, cards: 0 };
      o.n++; o.jobs += g.jobs; o.cards += g.cards; byDay.set(k, o);
    });
    return <>
      <div className="kpis">
        <div className="kpi"><div className="kl">{label('dispatchNo')}s</div><div className="kv">{num(data.dispatches.length)}</div></div>
        <div className="kpi"><div className="kl">Jobs</div><div className="kv">{num(sum(data.dispatches, g => g.jobs))}</div></div>
        <div className="kpi"><div className="kl">Cards</div><div className="kv">{num(sum(data.dispatches, g => g.cards))}</div></div>
        <div className="kpi am"><div className="kl">Partial</div><div className="kv">{num(part.length)}</div><div className="ks">balance still pending</div></div>
      </div>
      <div className="ck-card">
        <div className="card-h"><h3>By {label('dispatchDate').toLowerCase()} and {label('dispatchMode').toLowerCase()}</h3></div>
        <Table rows={[...byDay.values()].sort((a, b) => b.date.localeCompare(a.date) || a.mode.localeCompare(b.mode))} cols={[
          { h: label('dispatchDate'), f: r => fmtD(r.date) || '—' }, { h: label('dispatchMode'), f: r => r.mode },
          { h: `${label('dispatchNo')}s`, n: 1, f: r => num(r.n) }, { h: 'Jobs', n: 1, f: r => num(r.jobs) }, { h: 'Cards', n: 1, f: r => num(r.cards) }
        ]} />
      </div>
      <div className="ck-card">
        <div className="card-h"><h3>{label('dispatchNo')}s</h3></div>
        <Table rows={data.dispatches.map(g => ({ ...g, key: `${g.no}|${g.date}` }))} cols={[
          { h: label('dispatchNo'), f: g => g.no }, { h: label('dispatchDate'), f: g => fmtD(g.date) || '—' }, { h: label('dispatchMode'), f: g => g.mode },
          { h: 'Jobs', n: 1, f: g => num(g.jobs) }, { h: 'Cards', n: 1, f: g => num(g.cards) }, { h: label('bank') + 's', f: g => g.banks.join(', ') },
          { h: 'Status', f: g => (g.partial ? <Chip tone="am">Partial</Chip> : <Chip tone="ok">Complete</Chip>) }
        ]} />
      </div>
      <div className="ck-card">
        <div className="card-h"><h3>Partial: balance pending</h3></div>
        <Table rows={part} cols={[
          { h: label('bank'), f: j => j.f.bank }, { h: label('desc'), f: j => j.f.desc }, { h: label('dispatchNo'), f: j => j.f.dispatchNo },
          { h: label('qty'), n: 1, f: j => num(j.f.qty) }, { h: label('dispatchQty'), n: 1, f: j => num(j.f.dispatchQty) }, { h: 'Balance', n: 1, f: j => <b>{num(j.pq)}</b> }
        ]} />
      </div>
    </>;
  };

  const vJobs = () => {
    const q = jobQ.trim().toLowerCase();
    const L = jobs.filter(j =>
      (!jobStage || (jobStage === '__done' ? !j.cur : j.cur === jobStage)) &&
      (!q || [j.f.bank, j.f.desc, j.f.qcSheet, j.f.auditSheet, j.f.dispatchNo, j.f.flag].join(' ').toLowerCase().includes(q))).sort(fifo);
    return <div className="ck-card">
      <div className="ck-row" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
        <label style={{ flex: 1, minWidth: 220 }}>Search<input value={jobQ} onChange={e => setJobQ(e.target.value)} placeholder="Bank, job, QC sheet, audit no, dispatch no" /></label>
        <label>Current stage<select value={jobStage} onChange={e => setJobStage(e.target.value)}>
          <option value="">All</option>{stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}<option value="__done">{label('dispatchQty')}</option>
        </select></label>
      </div>
      <div className="ct-note">{num(L.length)} jobs</div>
      <Table limit={500} rows={L} cols={[
        ...toCols([{ source: 'recv', label: label('recvDate') }, { source: 'flag' }, { source: 'bank' }, { source: 'desc' }, { source: 'qcSheet' }, { source: 'qty', numeric: true }]),
        ...stages.map(s => ({ h: s.label, f: j => stateBadge(j.states[s.key]) })),
        { h: 'Current stage', f: j => <StageChip k={j.cur} /> },
        { h: label('dispatchNo'), f: j => j.f.dispatchNo }
      ]} />
    </div>;
  };

  return <>
    {toolbar}
    <div className="tabs no-print" style={{ marginBottom: 18 }}>
      {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
    </div>
    {{ pn: vPending, ov: vOverview, bt: vBatches, sc: vSchedule, dp: vDispatched, jb: vJobs }[tab]()}
  </>;
}

const CSS = `
/* Card Job Tracker styles: every rule is scoped under .ctk-root so nothing leaks into the rest of the app */
.ctk-root { box-sizing: border-box; padding: 4px 2px 24px; color: var(--tx); font-family: var(--font-sans); font-size: 14px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
.ctk-root *, .ctk-root *::before, .ctk-root *::after { box-sizing: border-box; }
.ctk-root button, .ctk-root input, .ctk-root select, .ctk-root textarea { font-family: inherit; font-size: inherit; line-height: inherit; }
.ctk-root h1, .ctk-root h2, .ctk-root h3 { font-family: var(--font-display); color: var(--tx); font-weight: 700; letter-spacing: -0.025em; margin: 0; }
.ctk-root hr { border: 0; border-top: 1px solid var(--bd2); margin: 16px 0; }
.ctk-root label { margin-bottom: 0; }
.ctk-root p { margin-bottom: 0; }
.ctk-root .ck-card { display: block; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.ctk-root {
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
.ctk-root *, .ctk-root *::before, .ctk-root *::after { box-sizing: border-box; }
.ctk-root button, .ctk-root input, .ctk-root select, .ctk-root textarea {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
.ctk-root button {
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.ctk-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.ctk-root ::-webkit-scrollbar-track { background: transparent; }
.ctk-root ::-webkit-scrollbar-thumb {
  background: var(--bd);
  border-radius: var(--rad-full);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.ctk-root ::-webkit-scrollbar-thumb:hover { background: var(--mt-light); background-clip: padding-box; }
.ctk-root :focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.ctk-root h1, .ctk-root h2, .ctk-root h3, .ctk-root h4, .ctk-root h5, .ctk-root h6 {
  font-family: var(--font-display);
  color: var(--tx);
  font-weight: 700;
  letter-spacing: -0.025em;
  margin: 0;
}
.ctk-root a { color: var(--ac); text-decoration: none; transition: color var(--trans); }
.ctk-root a:hover { color: var(--ac-h); }
.ctk-root hr { border: 0; border-top: 1px solid var(--bd2); margin: 16px 0; }
.ctk-root ::selection { background: var(--ac-ring); }
.ctk-root .tabs {
  display: inline-flex;
  gap: 5px;
  flex-wrap: wrap;
  margin: 0 0 22px;
  padding: 5px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: var(--sf);
  box-shadow: var(--sh-sm);
}
.ctk-root .tabs button {
  min-height: 36px;
  padding: 6px 16px;
  border: 0;
  border-radius: var(--rad-md);
  background: transparent;
  color: var(--tx-muted);
  font-size: 13px;
  font-weight: 600;
  box-shadow: none;
  cursor: pointer;
  transition: all var(--trans);
}
.ctk-root .tabs button:hover { color: var(--ac); background: var(--ac2); box-shadow: none; border: 0; }
.ctk-root .tabs button.on {
  background: var(--ac-gradient);
  color: var(--on-ac);
  font-weight: 700;
  box-shadow: var(--ac-glow);
  transform: none;
}
.ctk-root .ck-card {
  position: relative;
  margin: 0 0 22px;
  padding: 24px 26px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: var(--sf);
  box-shadow: var(--sh-sm);
  transition: border-color var(--trans), box-shadow var(--trans);
}
.ctk-root .ck-card:hover { box-shadow: var(--sh); border-color: var(--bd); }
.ctk-root .card-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--bd2);
}
.ctk-root h3 {
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
.ctk-root .card-h h3 { margin: 0; }
.ctk-root .mt { color: var(--mt); font-size: 12.5px; }
.ctk-root p.mt { max-width: 90ch; line-height: 1.65; margin: 6px 0 14px; }
.ctk-root .upload-dropzone {
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
.ctk-root .upload-dropzone:hover, .ctk-root .upload-dropzone.dragging {
  border-color: var(--ac);
  background: var(--ac2);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px -10px var(--ac-ring);
}
.ctk-root .upload-dropzone-icon {
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
.ctk-root .upload-dropzone strong {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 750;
  color: var(--tx);
}
.ctk-root .upload-dropzone span {
  font-size: 12.5px;
  color: var(--mt);
}
.ctk-root button {
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
.ctk-root button:hover {
  background: var(--sf2);
  border-color: var(--ac-bd);
  color: var(--ac);
  box-shadow: var(--sh-sm);
}
.ctk-root button:active { transform: translateY(1px); }
.ctk-root button.on, .ctk-root button.pri {
  background: var(--ac-gradient);
  color: var(--on-ac);
  border: 1px solid transparent;
  box-shadow: var(--ac-glow), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.ctk-root button.on:hover, .ctk-root button.pri:hover {
  background: var(--ac-gradient-hover);
  color: var(--on-ac);
  border-color: transparent;
  box-shadow: var(--ac-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}
.ctk-root button.on:active, .ctk-root button.pri:active { transform: translateY(1px); }
.ctk-root button.sm {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: var(--rad-sm);
  font-weight: 600;
}
.ctk-root button.dg {
  color: var(--wr);
  border-color: var(--wb-bd);
  background: transparent;
}
.ctk-root button.dg:hover {
  background: var(--wb);
  color: var(--wr);
  border-color: var(--wr);
}
.ctk-root button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
  pointer-events: none;
}
.ctk-root label {
  display: block;
  margin-bottom: 14px;
  color: var(--tx-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.ctk-root input, .ctk-root select, .ctk-root textarea {
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
.ctk-root input:hover, .ctk-root select:hover, .ctk-root textarea:hover { border-color: var(--ac-bd); }
.ctk-root input:focus, .ctk-root select:focus, .ctk-root textarea:focus {
  border-color: var(--ac);
  box-shadow: 0 0 0 4px var(--ac-ring);
  background: var(--sf);
}
.ctk-root input::placeholder, .ctk-root textarea::placeholder { color: var(--mt-light); opacity: 0.9; }
.ctk-root input[type="checkbox"] {
  width: 18px;
  min-height: 18px;
  height: 18px;
  margin: 0;
  border-radius: var(--rad-xs);
  accent-color: var(--ac);
  cursor: pointer;
}
.ctk-root input[type="file"] {
  min-height: 72px;
  padding: 14px 16px;
  border: 2px dashed var(--ac-bd);
  border-radius: var(--rad-lg);
  background: var(--ac2);
  color: var(--tx-muted);
  cursor: pointer;
  transition: all var(--trans);
}
.ctk-root input[type="file"]:hover { border-color: var(--ac); background: var(--sf-hover); }
.ctk-root input[type="file"]::file-selector-button {
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
.ctk-root input[type="file"]::file-selector-button:hover { background: var(--ac-gradient-hover); }
.ctk-root textarea {
  min-height: 88px;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
}
.ctk-root select {
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2362718d' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.6' d='M6 8l4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 18px;
  padding-right: 38px;
  appearance: none;
  -webkit-appearance: none;
}
.ctk-root .ck-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ctk-root .kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 16px;
  margin: 0 0 22px;
}
.ctk-root .kpi {
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
.ctk-root .kpi::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: var(--kpi-accent);
}
.ctk-root .kpi::after {
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
.ctk-root .kpi:hover { transform: translateY(-3px); box-shadow: var(--sh-md); border-color: var(--ac-bd); }
.ctk-root .kpi-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ctk-root .kpi-header svg {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  padding: 8px;
  border-radius: 10px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  opacity: 1 !important;
}
.ctk-root .kpi .kl {
  color: var(--mt);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ctk-root .kpi .kv {
  margin-top: 10px;
  color: var(--tx);
  font-size: 26px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.035em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.ctk-root .kpi .ks {
  margin-top: 8px;
  color: var(--mt);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
}
.ctk-root .kpi.ok { --kpi-accent: var(--ok); }
.ctk-root .kpi.ok .kv { color: var(--ok); }
.ctk-root .kpi.am { --kpi-accent: var(--am); }
.ctk-root .kpi.am .kv { color: var(--am); }
.ctk-root .kpi.wr { --kpi-accent: var(--wr); }
.ctk-root .kpi.wr .kv { color: var(--wr); }
.ctk-root .chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-height: 124px;
  overflow-y: auto;
  margin: 18px 0;
  padding: 4px 2px;
}
.ctk-root .chips button {
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
.ctk-root .chips button:hover { background: var(--ac2); color: var(--ac); border-color: var(--ac-bd); }
.ctk-root .chips button.on {
  background: var(--ac-gradient);
  color: var(--on-ac);
  border-color: transparent;
  box-shadow: var(--ac-glow);
  font-weight: 700;
}
.ctk-root .scroll {
  overflow: auto;
  max-height: 600px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-md);
  background: var(--sf);
  box-shadow: var(--sh-xs);
}
.ctk-root table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12.5px;
  font-family: var(--font-sans);
}
.ctk-root td, .ctk-root th {
  padding: 11px 16px;
  border-bottom: 1px solid var(--bd2);
  white-space: nowrap;
}
.ctk-root th {
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
.ctk-root tbody tr:where(:nth-child(even)) td { background: var(--zebra); }
.ctk-root tbody tr { transition: background-color 0.12s ease; }
.ctk-root tbody tr:last-child td { border-bottom: 0; }
.ctk-root .ct-chip {
  display: inline-block; padding: 2px 9px; border-radius: var(--rad-full);
  font-size: 11.5px; font-weight: 700; border: 1px solid transparent; white-space: nowrap;
}
.ctk-root .ct-chip.t-ac { background: var(--ac2); color: var(--ac); border-color: var(--ac-bd); }
.ctk-root .ct-chip.t-violet { background: var(--violet-bg); color: var(--violet); border-color: var(--violet-bd); }
.ctk-root .ct-chip.t-cyan { background: var(--cyan-bg); color: var(--cyan); border-color: var(--cyan-bd); }
.ctk-root .ct-chip.t-teal { background: var(--teal-bg); color: var(--teal); border-color: var(--teal-bd); }
.ctk-root .ct-chip.t-ok { background: var(--ok-bg); color: var(--ok); border-color: var(--ok-bd); }
.ctk-root .ct-chip.t-am { background: var(--am-bg); color: var(--am); border-color: var(--am-bd); }
.ctk-root .ct-chip.t-wr { background: var(--wb); color: var(--wr); border-color: var(--wb-bd); }
.ctk-root .ct-chip.t-mt { background: var(--sf2); color: var(--mt); border-color: var(--bd2); }
.ctk-root .ct-table th, .ctk-root .ct-table td { white-space: nowrap; }
.ctk-root .ct-table .ct-num { text-align: right; font-variant-numeric: tabular-nums; }
.ctk-root .ct-note { color: var(--mt); font-size: 12.5px; margin: 6px 0; }
.ctk-root .ct-bar { height: 7px; min-width: 90px; background: var(--bd2); border-radius: var(--rad-full); overflow: hidden; }
.ctk-root .ct-bar i { display: block; height: 100%; background: var(--ok); border-radius: var(--rad-full); }
.ctk-root .ct-bar-wrap { display: flex; align-items: center; gap: 8px; }
.ctk-root .ct-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 18px;
  padding: 14px 18px;
  border: 1px solid var(--bd2);
  border-radius: var(--rad-lg);
  background: var(--sf);
  box-shadow: var(--sh-sm);
}
.ctk-root .ct-toolbar > label { display: flex; flex-direction: column; gap: 4px; margin: 0; font-size: 11.5px; font-weight: 700; color: var(--mt); }
.ctk-root .ct-toolbar > label select, .ctk-root .ct-toolbar > label input { min-height: 38px; margin-top: 2px; }
.ctk-root .ct-toolbar .ct-spacer { margin-left: auto; }
.ctk-root .ct-filter-card { padding: 16px 18px; }
.ctk-root .ct-filter-card .ct-stage-chips {
  flex-wrap: nowrap;
  max-height: none;
  overflow-x: auto;
  overflow-y: hidden;
  margin: 0 0 10px;
  padding: 2px 1px 6px;
}
.ctk-root .ct-filter-card .ct-stage-chips button { flex: 0 0 auto; }
.ctk-root .ct-filter-row { flex-wrap: nowrap; gap: 10px; }
.ctk-root .ct-filter-row label { flex: 1 1 0; min-width: 130px; margin: 0; }
.ctk-root .ct-filter-row label select, .ctk-root .ct-filter-row label input { min-width: 0; }
@media (max-width: 1100px) {
.ctk-root .ct-filter-row { flex-wrap: wrap; }
.ctk-root .ct-filter-row label { flex: 1 1 180px; }
}
.ctk-root .ct-menu-wrap { position: relative; display: inline-block; }
.ctk-root .ct-menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 40; min-width: 270px; padding: 6px;
  background: var(--sf); border: 1px solid var(--bd); border-radius: var(--rad-md); box-shadow: var(--sh-lg);
}
.ctk-root .ct-menu button {
  display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 12px; text-align: left;
  background: none; border: 0; box-shadow: none; padding: 8px 10px; border-radius: var(--rad-sm); color: var(--tx);
}
.ctk-root .ct-menu button:hover { background: var(--sf-hover); }
.ctk-root .ct-menu hr { border: 0; border-top: 1px solid var(--bd2); margin: 4px 0; }
.ctk-root .ct-drop {
  border: 2px dashed var(--bd); border-radius: var(--rad-lg); padding: 48px 20px; text-align: center; background: var(--sf);
}
.ctk-root .ct-drop.on { border-color: var(--ac); background: var(--ac2); }
.ctk-root .kpi.ct-click { cursor: pointer; text-align: left; }
.ctk-root .kpi.ct-click.on { border-color: var(--ac); background: var(--ac2); }

@media print {
  body * { visibility: hidden !important; }
  .ctk-root, .ctk-root * { visibility: visible !important; }
  .ctk-root { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #000 !important; }
  .ctk-root .no-print { display: none !important; }
}

`;

/* ---------- page ---------- */
export default function CardTracker() {
  const user = useMemo(() => {
    try { return { is_admin: String(jwtDecode(localStorage.getItem("token") || "").role || "").toUpperCase() === "ADMIN" }; }
    catch { return { is_admin: false }; }
  }, []);
  return (
    <div className="ctk-root">
      <style>{CSS}</style>
      <CardTrackerInner user={user} />
    </div>
  );
}
