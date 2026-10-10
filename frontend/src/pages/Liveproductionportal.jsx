import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Factory, Search, LayoutDashboard, ClipboardList, Route,
  Gauge, Cpu, CheckCircle2, Users, Scroll, FileStack, X, Layers,
  TrendingUp, TrendingDown, ArrowUpDown, PackageCheck, RefreshCw, AlertTriangle,
  ShieldCheck, ChevronDown,
} from "lucide-react";
import BASE_URL from "../config/api";

/* ------------------------------------------------------------------ */
/* Design tokens — 3D glassmorphism palette                            */
/* ------------------------------------------------------------------ */
const COLORS = {
  ink: "#0f172a",
  steel: "#334155",
  slate: "#64748b",
  mist: "#f1f5f9",
  paper: "#f8fafc",
  line: "#e2e8f0",
  indigo: "#0284c7",
  indigoDeep: "#0369a1",
  teal: "#0d9488",
  amber: "#f59e0b",
  rose: "#f43f5e",
  green: "#10b981",
  violet: "#6366f1",
};
const MILL_COLORS = [COLORS.indigo, COLORS.green, COLORS.amber, COLORS.violet, COLORS.rose, COLORS.steel];

const ACCENTS = {
  blue: { cls: "blue", grad: "linear-gradient(135deg, #0284c7, #38bdf8)" },
  purple: { cls: "purple", grad: "linear-gradient(135deg, #6366f1, #a855f7)" },
  emerald: { cls: "emerald", grad: "linear-gradient(135deg, #10b981, #34d399)" },
  rose: { cls: "rose", grad: "linear-gradient(135deg, #f43f5e, #fb7185)" },
  amber: { cls: "amber", grad: "linear-gradient(135deg, #f59e0b, #fbbf24)" },
};

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
};
const fmtFull = (n) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-IN"));
const fmtPct = (n) => (n === null || n === undefined || isNaN(n) ? "—" : `${n.toFixed(2)}%`);
const toNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));
const pct = (part, whole) => (whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0);
const normWO = (s) => String(s || "").trim().replace(/^WO\s*#?\s*/i, "");

/* ------------------------------------------------------------------ */
/* LIVE DATA AGGREGATION                                               */
/* ------------------------------------------------------------------ */

// Local-date (not UTC) so IST midnight timestamps don't shift a day back.
const dateOnly = (d) => {
  if (!d) return null;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const monthKey = (dStr) => {
  const dt = new Date(dStr);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (dStr) => {
  const dt = new Date(dStr);
  return dt.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

const hoursBetween = (dStr, fromTime, toTime) => {
  if (!dStr || !fromTime || !toTime) return 0;
  const start = new Date(`${dStr}T${fromTime}`);
  const end = new Date(`${dStr}T${toTime}`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) end.setDate(end.getDate() + 1);
  return (end - start) / (1000 * 60 * 60);
};

function buildDashboardData(realRows, reelRows) {
  const safeReal = Array.isArray(realRows) ? realRows : [];
  const safeReel = Array.isArray(reelRows) ? reelRows : [];

  const woMap = new Map();
  const custMap = new Map();
  const machMap = new Map();
  const stageMap = new Map();
  const monthMap = new Map();
  const stageTrackerRaw = {};      // Stage Tracker tab: every stage/machine leg, any status
  const stageTrackerProdRaw = {};  // Open details drawer: PRODUCTION legs only

  // A "production entry" = an entry whose machine status is Production.
  // (Idle / Make Ready / Breakdown / Maintenance entries carry no output.)
  const isProductionEntry = (item) =>
    String(item.machineStatus || "").toUpperCase().replace(/[^A-Z]/g, "").startsWith("PRODUC");

  // The most recently entered PRODUCTION record of each Work Order.
  // Only this entry's production / waste quantity is counted for the work
  // order (WO totals, KPI banner, completion %, customer totals) — the
  // older entries of the same work order are not summed in.
  const latestByWO = new Map();
  safeReal.forEach((item) => {
    const wo = String(item.workOrder ?? "").trim();
    if (!wo || !isProductionEntry(item)) return;
    const created = new Date(item.createdAt || 0).getTime();
    const existing = latestByWO.get(wo);
    if (!existing || created >= new Date(existing.createdAt || 0).getTime()) {
      latestByWO.set(wo, item);
    }
  });

  // Stage / machine "leg" bookkeeping. Hours and logged events are summed over
  // every entry (machine logic unchanged); the output / waste shown on a leg is
  // the quantity of that leg's latest PRODUCTION entry only.
  const touchLeg = (store, wo, activityName, machineName, dStr, status, hours, events, isProd, createdTs, prodQty, wasteQty, entryTs) => {
    if (!store[wo]) store[wo] = new Map();
    const legKey = `${activityName}__${machineName}`;
    if (!store[wo].has(legKey)) {
      store[wo].set(legKey, {
        stage: activityName, machine: machineName,
        from: dStr, to: dStr, hours: 0, events: 0,
        status, prodQty: 0, wasteQty: 0, qtyTs: -1, lastTs: -1, lastCreated: -1,
      });
    }
    const leg = store[wo].get(legKey);
    leg.hours += hours;
    leg.events += events;
    // most recent entry of this leg: production date + start time, then saved time
    if (entryTs > leg.lastTs || (entryTs === leg.lastTs && createdTs > leg.lastCreated)) {
      leg.lastTs = entryTs;
      leg.lastCreated = createdTs;
    }
    if (isProd && createdTs >= leg.qtyTs) {
      leg.qtyTs = createdTs;
      leg.prodQty = prodQty;
      leg.wasteQty = wasteQty;
    }
    leg.status = status || leg.status;
    if (dStr) {
      if (!leg.from || dStr < leg.from) leg.from = dStr;
      if (!leg.to || dStr > leg.to) leg.to = dStr;
    }
  };

  safeReal.forEach((item) => {
    const wo = String(item.workOrder ?? "").trim();
    if (!wo) return;

    const prodQty = toNum(item.productionQty);
    const wasteQty = toNum(item.wastageQty);
    const dStr = dateOnly(item.productionDate);
    const hours = hoursBetween(dStr, item.productionFromTime, item.productionToTime);
    const status = String(item.machineStatus || "").toUpperCase();
    const orderQty = toNum(item.liveOrderQty ?? item.orderQty);
    const isProd = isProductionEntry(item);
    const createdTs = new Date(item.createdAt || 0).getTime();
    const isLatestProd = latestByWO.get(wo) === item;
    // when this entry happened (production date + start time); falls back to saved time
    const entryTs = (() => {
      if (!dStr) return createdTs;
      const t = new Date(`${dStr}T${item.productionFromTime || "00:00"}`).getTime();
      return isNaN(t) ? createdTs : t;
    })();

    if (!woMap.has(wo)) {
      woMap.set(wo, {
        wo,
        customer: item.customerName || "-",
        job: item.jobDescription || "-",
        type: item.productType || "-",
        orderQty,
        totalProdQty: 0,
        totalWasteQty: 0,
        stages: new Set(),
        machines: new Set(),
        events: 0,
        startDate: dStr,
        endDate: dStr,
      });
    }
    const woEntry = woMap.get(wo);
    // work-order production / waste = its latest production entry only
    if (isLatestProd) {
      woEntry.totalProdQty += prodQty;
      woEntry.totalWasteQty += wasteQty;
    }
    woEntry.events += 1;
    if (orderQty > 0) woEntry.orderQty = orderQty;
    if (dStr) {
      if (!woEntry.startDate || dStr < woEntry.startDate) woEntry.startDate = dStr;
      if (!woEntry.endDate || dStr > woEntry.endDate) woEntry.endDate = dStr;
    }

    const custKey = item.customerName || "";
    if (!custMap.has(custKey)) {
      custMap.set(custKey, { Customer: custKey, prodQty: 0, wasteQty: 0, woSet: new Set() });
    }
    const custEntry = custMap.get(custKey);
    custEntry.woSet.add(wo);
    // Only the latest production entry for this WO contributes to the
    // customer's prodQty/wasteQty totals — earlier entries for the same WO
    // are still tracked in woSet (so WO counts stay correct) but not summed in.
    if (isLatestProd) {
      custEntry.prodQty += prodQty;
      custEntry.wasteQty += wasteQty;
    }

    if (dStr) {
      const mk = monthKey(dStr);
      if (!monthMap.has(mk)) {
        monthMap.set(mk, { Month: monthLabel(dStr), sortKey: mk, prodQty: 0, wasteQty: 0 });
      }
      const m = monthMap.get(mk);
      m.prodQty += prodQty;
      m.wasteQty += wasteQty;
    }

    const pairs = item.machiness?.length ? item.machiness : [{ activityId: null, machineId: null }];
    const legShare = pairs.length > 0 ? 1 / pairs.length : 1;

    pairs.forEach((pair) => {
      const activityName = pair.activityId?.activityName || "Unassigned";
      const machineName = pair.machineId?.machineName || "Unassigned";
      woEntry.stages.add(activityName);
      woEntry.machines.add(machineName);

      if (!machMap.has(machineName)) {
        machMap.set(machineName, {
          machine: machineName,
          production: 0, idle: 0, makeReady: 0, breakdown: 0, maintenance: 0,
          prodQty: 0, wasteQty: 0, events: 0,
        });
      }
      const mEntry = machMap.get(machineName);
      const legHours = hours * legShare;

      // Match on a short, stable prefix rather than the full word — this
      // survives spelling variants (Maintainance, Maintainence, Maintanence,
      // Breakdown, Break Down, etc.) since typos almost always happen in the
      // tail of the word, not the first few letters.
      const normStatus = status.replace(/[^A-Z]/g, "");
      if (normStatus.startsWith("PRODUC")) mEntry.production += legHours;
      else if (normStatus.startsWith("IDLE")) mEntry.idle += legHours;
      else if (normStatus.startsWith("MAKE") && normStatus.includes("READY")) mEntry.makeReady += legHours;
      else if (normStatus.startsWith("BREAK")) mEntry.breakdown += legHours;
      else if (normStatus.startsWith("MAINT")) mEntry.maintenance += legHours;

      mEntry.prodQty += prodQty * legShare;
      mEntry.wasteQty += wasteQty * legShare;
      mEntry.events += 1;

      if (!stageMap.has(activityName)) stageMap.set(activityName, { Stage: activityName, prodQty: 0 });
      stageMap.get(activityName).prodQty += prodQty * legShare;

      // Stage Tracker tab: every leg, whatever the status
      touchLeg(stageTrackerRaw, wo, activityName, machineName, dStr, status, legHours, 1, isProd, createdTs, prodQty * legShare, wasteQty * legShare, entryTs);
      // Open details drawer: production legs only
      if (isProd) {
        touchLeg(stageTrackerProdRaw, wo, activityName, machineName, dStr, status, legHours, 1, true, createdTs, prodQty * legShare, wasteQty * legShare, entryTs);
      }
    });
  });

  const ledger = Array.from(woMap.values()).map((w) => {
    const completionPct = w.orderQty > 0 ? Number(((w.totalProdQty / w.orderQty) * 100).toFixed(1)) : 0;
    let status = "N/A";
    if (w.orderQty > 0) {
      if (completionPct > 100.5) status = "Over";
      else if (completionPct < 99.5) status = "Under";
      else status = "Exact";
    }
    return {
      wo: w.wo,
      customer: w.customer,
      job: w.job,
      type: w.type,
      orderQty: Math.round(w.orderQty),
      finalOutputQty: Math.round(w.totalProdQty),
      completionPct,
      status,
      totalProdQty: Math.round(w.totalProdQty),
      totalWasteQty: Math.round(w.totalWasteQty),
      wastePct: pct(w.totalWasteQty, w.totalProdQty),
      stages: Array.from(w.stages),
      machines: Array.from(w.machines),
      events: w.events,
      startDate: w.startDate,
      endDate: w.endDate,
    };
  });

  const finishLegs = (raw) => {
    const out = {};
    Object.entries(raw).forEach(([wo, legMap]) => {
      out[wo] = Array.from(legMap.values()).map(({ qtyTs, ...leg }) => ({
        ...leg,
        hours: Number(leg.hours.toFixed(1)),
        prodQty: Math.round(leg.prodQty),
        wasteQty: Math.round(leg.wasteQty),
      }));
    });
    return out;
  };
  const stageTracker = finishLegs(stageTrackerRaw);
  const stageTrackerProd = finishLegs(stageTrackerProdRaw);

  const totalOrderQty = ledger.reduce((s, r) => s + r.orderQty, 0);
  const totalProductionQty = ledger.reduce((s, r) => s + r.totalProdQty, 0);
  const totalWasteQty = ledger.reduce((s, r) => s + r.totalWasteQty, 0);
  const avgWastePct = pct(totalWasteQty, totalProductionQty);

  const topCustomers = Array.from(custMap.values())
    .map((c) => ({ name: c.Customer, qty: Math.round(c.prodQty) }))
    .sort((a, b) => b.qty - a.qty);

  const topMachines = Array.from(machMap.values())
    .map((m) => ({ name: m.machine, qty: Math.round(m.prodQty) }))
    .sort((a, b) => b.qty - a.qty);

  const jobCompletion = ledger.reduce(
    (acc, r) => {
      if (r.status === "Under") acc.under++;
      else if (r.status === "Exact") acc.exact++;
      else if (r.status === "Over") acc.over++;
      return acc;
    },
    { under: 0, exact: 0, over: 0 }
  );

  const highWasteMachines = Array.from(machMap.values())
    .filter((m) => m.prodQty > 0)
    .map((m) => ({ Machine: m.machine, wastePct: pct(m.wasteQty, m.prodQty) }))
    .sort((a, b) => b.wastePct - a.wastePct);

  const allDates = safeReal.map((r) => dateOnly(r.productionDate)).filter(Boolean).sort();

  const dateRange = {
    start: allDates.length ? allDates[0] : "-",
    end: allDates.length ? allDates[allDates.length - 1] : "-",
  };

  const overview = {
    totalWorkOrders: ledger.length,
    totalOrderQty,
    totalProductionQty,
    totalWasteQty,
    avgWastePct,
    topCustomers,
    topMachines,
    jobCompletion,
    highWasteMachines,
    dateRange,
    uniqueCustomers: custMap.size,
    uniqueMachines: machMap.size,
  };

  const trend = Array.from(monthMap.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((m) => ({ Month: m.Month, prodQty: Math.round(m.prodQty), wastePct: pct(m.wasteQty, m.prodQty) }));

  const machineUtilization = Array.from(machMap.values())
    .map((m) => {
      const totalHours = m.production + m.idle + m.makeReady + m.breakdown + m.maintenance;
      return {
        machine: m.machine,
        production: Number(m.production.toFixed(1)),
        idle: Number(m.idle.toFixed(1)),
        makeReady: Number(m.makeReady.toFixed(1)),
        breakdown: Number(m.breakdown.toFixed(1)),
        maintenance: Number(m.maintenance.toFixed(1)),
        totalHours: Number(totalHours.toFixed(1)),
        utilizationPct: totalHours > 0 ? Number(((m.production / totalHours) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const machineProdWaste = Array.from(machMap.values())
    .map((m) => ({
      Machine: m.machine,
      prodQty: Math.round(m.prodQty),
      wasteQty: Math.round(m.wasteQty),
      wastePct: pct(m.wasteQty, m.prodQty),
      events: m.events,
    }))
    .sort((a, b) => b.prodQty - a.prodQty);

  const stages = Array.from(stageMap.values())
    .map((s) => ({ Stage: s.Stage, prodQty: Math.round(s.prodQty) }))
    .sort((a, b) => b.prodQty - a.prodQty);

  const customers = Array.from(custMap.values())
    .map((c) => ({
      Customer: c.Customer,
      prodQty: Math.round(c.prodQty),
      wasteQty: Math.round(c.wasteQty),
      wastePct: pct(c.wasteQty, c.prodQty),
      woCount: c.woSet.size,
    }))
    .sort((a, b) => b.prodQty - a.prodQty);

  const totalPages = safeReal.reduce((s, r) => s + (toNum(r.pages) > 0 ? toNum(r.pages) : 0), 0);
  const perso = {
    kpi: {
      totalWO: ledger.length,
      totalPages: Math.round(totalPages),
      totalWastage: Math.round(totalWasteQty),
      avgWastePct,
    },
    activity: stages.slice(0, 10).map((s) => ({ Activity: s.Stage, totalPages: s.prodQty })),
    utilization: machineUtilization.slice(0, 10).map((m) => ({
      machine: m.machine, production: m.production, idle: m.idle, breakdown: m.breakdown,
    })),
  };

  /* ---------------- Reel register ---------------- */
  const reelCustMap = new Map();
  const reelMillMap = new Map();
  const reelWoMap = new Map();
  let totalNetWeight = 0;
  let totalReelWaste = 0;

  const reelRecords = safeReel.map((r) => {
    const wo = String(r.efiWoNumber ?? "").trim();
    const net = toNum(r.actualNetWeight);
    const waste = toNum(
      r.totalWaste ?? (toNum(r.mattWaste) + toNum(r.printWaste) + toNum(r.realEndWaste) + toNum(r.coreWeight))
    );
    totalNetWeight += net;
    totalReelWaste += waste;

    const custKey = r.customerName || "Unknown";
    if (!reelCustMap.has(custKey)) reelCustMap.set(custKey, { Customer: custKey, netWeight: 0, waste: 0 });
    const rc = reelCustMap.get(custKey);
    rc.netWeight += net;
    rc.waste += waste;

    const millKey = r.mill || "Unknown";
    if (!reelMillMap.has(millKey)) reelMillMap.set(millKey, { Mill: millKey, netWeight: 0, waste: 0, reels: 0 });
    const rm = reelMillMap.get(millKey);
    rm.netWeight += net;
    rm.waste += waste;
    rm.reels += 1;

    if (wo) {
      if (!reelWoMap.has(wo)) {
        reelWoMap.set(wo, { WO: wo, customer: r.customerName || "-", plannedQty: toNum(r.liveOrderQty), output: 0, netWeight: 0, waste: 0 });
      }
      const rw = reelWoMap.get(wo);
      rw.output += toNum(r.productionOutput);
      rw.netWeight += net;
      rw.waste += waste;
      if (toNum(r.liveOrderQty) > 0) rw.plannedQty = toNum(r.liveOrderQty);
    }

    return {
      wo,
      customer: r.customerName || "-",
      mill: r.mill || "-",
      reelNo: r.reelNo || "-",
      actualNet: Number(net.toFixed(2)),
      totalWaste: Number(waste.toFixed(2)),
      wastePct: pct(waste, net),
      gsm: r.actualGsm ?? "-",
    };
  });

  const reelCustomers = Array.from(reelCustMap.values())
    .map((c) => ({
      Customer: c.Customer,
      netWeight: Number(c.netWeight.toFixed(1)),
      waste: Number(c.waste.toFixed(1)),
      wastePct: pct(c.waste, c.netWeight),
    }))
    .sort((a, b) => b.netWeight - a.netWeight);

  const reelMills = Array.from(reelMillMap.values())
    .map((m) => ({
      Mill: m.Mill,
      netWeight: Number(m.netWeight.toFixed(1)),
      waste: Number(m.waste.toFixed(1)),
      wastePct: pct(m.waste, m.netWeight),
      share: totalNetWeight > 0 ? Number(((m.netWeight / totalNetWeight) * 100).toFixed(1)) : 0,
      reels: m.reels,
    }))
    .sort((a, b) => b.netWeight - a.netWeight);

  const reelWOs = Array.from(reelWoMap.values())
    .map((w) => ({
      WO: w.WO,
      customer: w.customer,
      netWeight: Number(w.netWeight.toFixed(1)),
      waste: Number(w.waste.toFixed(1)),
      wastePct: pct(w.waste, w.netWeight),
      plannedQty: Math.round(w.plannedQty),
      output: Math.round(w.output),
      completionPct: pct(w.output, w.plannedQty),
    }))
    .sort((a, b) => b.netWeight - a.netWeight);

  const reel = {
    kpi: {
      totalNetWeight: Number(totalNetWeight.toFixed(1)),
      reelCount: safeReel.length,
      totalWaste: Number(totalReelWaste.toFixed(1)),
      overallWastePct: pct(totalReelWaste, totalNetWeight),
      activeWO: reelWOs.length,
      millCount: reelMills.length,
    },
    customers: reelCustomers,
    byCustomer: reelCustomers,
    mills: reelMills,
    wos: reelWOs,
    byWO: [...reelWOs].sort((a, b) => b.output - a.output),
    wasteByWO: reelWOs.filter((w) => w.netWeight > 0).slice(0, 12).map((w) => ({ WO: `WO ${w.WO}`, wastePct: w.wastePct })),
    records: reelRecords,
  };

  return { overview, ledger, stageTracker, stageTrackerProd, trend, machineUtilization, machineProdWaste, stages, customers, perso, reel };
}



/* ------------------------------------------------------------------ */
/* Global 3D glassmorphism styling                                     */
/* ------------------------------------------------------------------ */
function GlobalStyles() {
  return (
    <style>{`
      .portal-universe {
        min-height: 100vh;
        padding: 24px;
        background: radial-gradient(circle at 10% 20%, rgba(224, 242, 254, 0.5) 0%, rgba(243, 232, 255, 0.4) 40%, #f8fafc 100%);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #0f172a;
        box-sizing: border-box;
      }
      .lp-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .lp-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
      .lp-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      .lp-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

      .portal-header-3d {
        background: rgba(255, 255, 255, 0.94);
        backdrop-filter: blur(16px);
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.9);
        box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), inset 0 2px 0 rgba(255, 255, 255, 1);
        padding: 12px 18px;
        margin-bottom: 16px;
      }
      .header-top-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-bottom: 10px; border-bottom: 1.5px solid #f1f5f9; }
      .brand-group { display: flex; align-items: center; gap: 10px; }
      .brand-emblem-3d {
        width: 38px; height: 38px; border-radius: 12px;
        background: linear-gradient(135deg, #0284c7 0%, #6366f1 100%);
        display: flex; align-items: center; justify-content: center; color: #ffffff;
        box-shadow: 0 8px 20px rgba(2, 132, 199, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.6);
      }
      .brand-titles h1 { font-size: 16px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .live-badge {
        display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px;
        background: #ecfdf5; color: #059669; border: 1.5px solid #a7f3d0; font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
      }
      .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulseDot 2s infinite; }
      @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.6; } }
      .brand-titles p { margin: 2px 0 0 0; font-size: 11px; font-weight: 600; color: #64748b; }
      .controls-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .search-container { position: relative; min-width: 180px; }
      .search-container input {
        width: 100%; padding: 6px 10px 6px 30px; border-radius: 9px; border: 1.5px solid #cbd5e1;
        background: #ffffff; font-size: 11.5px; font-weight: 700; color: #0f172a; outline: none; box-sizing: border-box;
        box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.05);
      }
      .search-container input:focus { border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15); }

      .btn-3d { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 800; cursor: pointer; border: none; transition: all 0.12s; }
      .btn-3d:disabled { opacity: 0.35; cursor: not-allowed; }
      .btn-3d-primary { background: linear-gradient(180deg, #0284c7 0%, #0369a1 100%); color: #ffffff; box-shadow: 0 4px 0 #075985, 0 8px 16px rgba(2, 132, 199, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.4); }
      .btn-3d-primary:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 #075985, 0 3px 6px rgba(2, 132, 199, 0.2); }
      .btn-3d-secondary { background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%); color: #334155; border: 1.5px solid #cbd5e1; box-shadow: 0 3px 0 #cbd5e1, 0 6px 12px rgba(15, 23, 42, 0.04); }
      .btn-3d-secondary:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #cbd5e1; }
      .btn-3d-sm { padding: 6px 12px; font-size: 11px; border-radius: 9px; }

      .nav-tabs-3d { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; overflow-x: visible; padding-top: 10px; }
      .tab-btn-3d { display: inline-flex; align-items: center; gap: 5px; padding: 6px 9px; border-radius: 10px; font-size: 10.5px; font-weight: 800; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
      .tab-btn-3d.active { background: linear-gradient(135deg, #0284c7 0%, #4f46e5 100%); color: #ffffff; box-shadow: 0 6px 16px rgba(2, 132, 199, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.6); }
      .tab-btn-3d.inactive { background: transparent; color: #64748b; }
      .tab-btn-3d.inactive:hover { background: rgba(241, 245, 249, 0.8); color: #0f172a; }

      .chip-3d { padding: 7px 14px; font-size: 11.5px; font-weight: 800; border-radius: 999px; border: 1.5px solid #cbd5e1; background: #ffffff; color: #475569; cursor: pointer; transition: all .15s; white-space: nowrap; }
      .chip-3d.active { background: linear-gradient(180deg, #0284c7, #0369a1); color: #fff; border-color: #0369a1; box-shadow: 0 4px 10px rgba(2,132,199,.3); }
      .chip-3d:not(.active):hover { background: #f8fafc; }

      .select-3d { padding: 5px 8px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 700; font-size: 11px; color: #0f172a; background: #fff; outline: none; }
      .select-3d:focus { border-color: #0284c7; }

      .ms-dropdown { position: relative; }
      .ms-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; text-align: left; }
      .ms-trigger-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ms-panel { position: fixed; z-index: 3000; max-height: 320px; overflow-y: auto; background: #ffffff; border-radius: 14px; border: 1.5px solid #cbd5e1; box-shadow: 0 20px 40px rgba(15, 23, 42, 0.24); padding: 10px; }
      .filters-row { display: grid; grid-template-columns: minmax(150px, 0.7fr) repeat(4, minmax(140px, 1fr)) auto; align-items: end; gap: 10px; padding-top: 10px; margin-top: 0; border-top: none; }
      @media (max-width: 1250px) { .filters-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (max-width: 720px) { .filters-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } .filters-row .date-range-group { grid-column: 1 / -1; } }
      .filter-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .filter-label { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; padding-left: 2px; line-height: 1; }
      .filters-row .select-3d { height: 32px; box-sizing: border-box; }
      .filters-row .ms-dropdown { width: 100% !important; }
      .filters-row .search-container { min-width: 0; width: 100%; }
      .filters-row .search-container input { height: 32px; }
      .filters-row .date-range-group input.select-3d { width: 128px; }
      .ms-search { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 10px; border: 1.5px solid #e2e8f0; margin-bottom: 8px; }
      .ms-search input { border: none; outline: none; font-size: 12.5px; font-weight: 600; width: 100%; }
      .ms-actions { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .ms-actions button { background: none; border: none; color: #0284c7; font-size: 11px; font-weight: 800; cursor: pointer; padding: 2px 4px; }
      .ms-options { display: flex; flex-direction: column; gap: 2px; }
      .ms-option { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: #1e293b; cursor: pointer; }
      .ms-option:hover { background: #f0f9ff; }
      .ms-empty { padding: 10px; text-align: center; font-size: 12px; color: #94a3b8; }
      .ss-option-selected { background: #e0f2fe; color: #0369a1; font-weight: 800; }
      .date-range-group { display: flex; align-items: flex-end; gap: 6px; }
      .date-range-group .date-sep { padding-bottom: 9px; }

      .kpi-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; }
      @media (max-width: 1280px) { .kpi-grid-5 { grid-template-columns: repeat(3, 1fr); } }
      @media (max-width: 768px) { .kpi-grid-5 { grid-template-columns: 1fr; } }
      .kpi-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
      @media (max-width: 1280px) { .kpi-grid-4 { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 640px) { .kpi-grid-4 { grid-template-columns: 1fr; } }
      .kpi-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
      @media (max-width: 960px) { .kpi-grid-3 { grid-template-columns: 1fr; } }

      .kpi-card-3d {
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border-radius: 20px; padding: 22px;
        border: 1px solid rgba(226, 232, 240, 0.9); box-shadow: 0 10px 24px -4px rgba(15, 23, 42, 0.06), inset 0 2px 0 #ffffff;
        position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; min-height: 140px; box-sizing: border-box;
      }
      .kpi-card-3d::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; }
      .kpi-card-3d.blue::before { background: linear-gradient(90deg, #0284c7, #38bdf8); }
      .kpi-card-3d.purple::before { background: linear-gradient(90deg, #6366f1, #a855f7); }
      .kpi-card-3d.emerald::before { background: linear-gradient(90deg, #10b981, #34d399); }
      .kpi-card-3d.rose::before { background: linear-gradient(90deg, #f43f5e, #fb7185); }
      .kpi-card-3d.amber::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
      .kpi-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .kpi-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
      .kpi-medallion-3d { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 6px 14px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.6); }
      .kpi-value { font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; line-height: 1; }
      .kpi-sub { font-size: 12px; font-weight: 700; color: #64748b; margin-top: 8px; display: flex; align-items: center; gap: 5px; }

      .panel-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-bottom: 24px; }
      .panel-grid-3 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 20px; margin-bottom: 24px; }
      @media (max-width: 960px) { .panel-grid-2, .panel-grid-3 { grid-template-columns: minmax(0, 1fr); } }

      .panel-3d {
        background: linear-gradient(180deg, #ffffff 0%, #fcfdfe 100%); border-radius: 22px; padding: 24px;
        border: 1px solid rgba(226, 232, 240, 0.9); box-shadow: 0 10px 25px -4px rgba(15, 23, 42, 0.06), inset 0 1px 0 #ffffff;
        margin-bottom: 24px; box-sizing: border-box; min-width: 0;
      }
      .panel-header-3d { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1.5px solid #f1f5f9; flex-wrap: wrap; gap: 12px; }
      .panel-title-wrap { display: flex; align-items: center; gap: 12px; }
      .panel-icon-badge { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #ffffff; flex-shrink: 0; }
      .panel-title-text h3 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
      .panel-title-text p { font-size: 12px; font-weight: 600; color: #64748b; margin: 2px 0 0 0; }
      .panel-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

      .badge-pill { font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }

      .table-scroll-3d { overflow-x: auto; border-radius: 16px; border: 1.5px solid #cbd5e1; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04); background: #ffffff; }
      .table-3d { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 900px; }
      .table-3d thead th { background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); color: #f8fafc; padding: 12px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; white-space: nowrap; user-select: none; }
      .table-3d thead th.sortable { cursor: pointer; }
      .table-3d thead th .sort-wrap { display: inline-flex; align-items: center; gap: 5px; }
      .table-3d tbody td { padding: 11px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600; white-space: nowrap; }
      .table-3d tbody tr:hover td { background: #f0f9ff; }
      .table-3d tbody tr.clickable { cursor: pointer; }

      .pagination-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-size: 12px; font-weight: 700; color: #64748b; }
      .pagination-btns { display: flex; align-items: center; gap: 8px; }
      .pagination-btn { padding: 6px 12px; border-radius: 9px; border: 1.5px solid #cbd5e1; background: #fff; font-weight: 800; font-size: 11.5px; cursor: pointer; color: #334155; }
      .pagination-btn:disabled { opacity: 0.35; cursor: not-allowed; }

      .pipeline-scroll { display: flex; gap: 16px; overflow-x: auto; padding: 10px 0 20px 0; position: relative; }
      .pipeline-card { min-width: 230px; background: #ffffff; border-radius: 16px; border: 1.5px solid #e2e8f0; padding: 16px; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06); box-sizing: border-box; }

      .mini-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
      @media (max-width: 768px) { .mini-stat-grid { grid-template-columns: repeat(2, 1fr); } }
      .mini-stat-box { border-radius: 14px; padding: 12px 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; }
      .mini-stat-box .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: .4px; }
      .mini-stat-box .val { font-size: 17px; font-weight: 900; color: #0f172a; margin-top: 4px; display: flex; align-items: center; gap: 8px; }

      .timeline-3d { position: relative; padding-left: 22px; border-left: 2.5px solid #e2e8f0; display: flex; flex-direction: column; gap: 14px; }
      .timeline-item-3d { position: relative; }
      .timeline-dot-3d { position: absolute; left: -28.5px; top: 4px; width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 0 0 2px currentColor; }
      .timeline-card-3d { border-radius: 12px; border: 1.5px solid #e2e8f0; padding: 12px 14px; background: #fff; }

      .drawer-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(4px); z-index: 9999; display: flex; justify-content: flex-end; }
      .drawer-content { width: 100%; max-width: 680px; height: 100%; background: #ffffff; overflow-y: auto; box-shadow: -10px 0 35px rgba(0, 0, 0, 0.25); padding: 0; box-sizing: border-box; }
      .drawer-head { position: sticky; top: 0; background: #fff; border-bottom: 1.5px solid #f1f5f9; padding: 22px 24px; display: flex; align-items: flex-start; justify-content: space-between; z-index: 2; }
      .drawer-body { padding: 22px 24px; }
      .drawer-close-btn { background: #f1f5f9; border: none; border-radius: 10px; padding: 8px; cursor: pointer; display: flex; }

      @media print {
        .no-print { display: none !important; }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */
function KpiCard({ label, value, sub, icon: Icon, accent = "blue", trend }) {
  const a = ACCENTS[accent] || ACCENTS.blue;
  return (
    <div className={`kpi-card-3d ${a.cls}`}>
      <div className="kpi-top-row">
        <span className="kpi-label">{label}</span>
        {Icon && (
          <div className="kpi-medallion-3d" style={{ background: a.grad }}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div>
        <div className="kpi-value">{value}</div>
        {sub && (
          <div className="kpi-sub">
            {trend === "up" && <TrendingUp size={12} color={COLORS.rose} />}
            {trend === "down" && <TrendingDown size={12} color={COLORS.green} />}
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({ title, sub, tag, icon: Icon, iconGrad, children, className = "", actions }) {
  return (
    <div className={`panel-3d ${className}`}>
      {(title || tag || actions) && (
        <div className="panel-header-3d">
          <div className="panel-title-wrap">
            {Icon && (
              <div className="panel-icon-badge" style={{ background: iconGrad || ACCENTS.blue.grad }}>
                <Icon size={17} />
              </div>
            )}
            <div className="panel-title-text">
              {title && <h3>{title}</h3>}
              {sub && <p>{sub}</p>}
            </div>
          </div>
          {(tag || actions) && (
            <div className="panel-actions">
              {tag && <span className="badge-pill" style={{ background: COLORS.mist, color: COLORS.slate }}>{tag}</span>}
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function Tag({ bg, fg, children }) {
  return <span className="badge-pill" style={{ backgroundColor: bg, color: fg }}>{children}</span>;
}

function StatusPill({ status }) {
  const map = {
    Over: { bg: "#e0f2fe", fg: "#0369a1" },
    Exact: { bg: "#d1fae5", fg: "#047857" },
    Under: { bg: "#fef3c7", fg: "#b45309" },
    "N/A": { bg: COLORS.mist, fg: COLORS.slate },
  };
  const c = map[status] || map["N/A"];
  return <Tag bg={c.bg} fg={c.fg}>{status}</Tag>;
}

const wasteColor = (p, warn = 3, bad = 5) => (p >= bad ? "#e11d48" : p >= warn ? "#d97706" : "#059669");
const statusDot = (s) => (s === "PRODUCTION" ? COLORS.green : s === "BREAKDOWN" ? COLORS.rose : s === "IDLE" ? COLORS.slate : COLORS.amber);

function TabButton({ id, label, icon: Icon, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} className={`tab-btn-3d ${active ? "active" : "inactive"}`}>
      <Icon size={15} /> {label}
    </button>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`chip-3d ${active ? "active" : ""}`}>
      {children}
    </button>
  );
}

// Controlled from the parent (isOpen/onToggle) so only one filter dropdown can
// be open at a time, and the panel is portaled to document.body with a fixed
// position computed from the trigger's own bounding box. That means it always
// floats above every element on the page — nav tabs, KPI cards, everything —
// instead of being confined to whatever stacking context the header creates
// (portal-header-3d's backdrop-filter creates one of its own, which is why a
// bumped z-index alone couldn't lift the old absolutely-positioned panel
// above the header's own children).
function MultiSelectDropdown({ label, options, selected, onChange, width = 200, isOpen, onToggle }) {
  const [query, setQuery] = useState("");
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width });

  // useLayoutEffect (not useEffect) so the panel's real position is computed
  // and applied BEFORE the browser paints. useEffect runs after paint, which
  // is why the panel would flash once at its {0,0} default — top-left of the
  // page, overlapping the sidebar — before snapping to the right spot a frame
  // later. That flash-then-jump was the "blink" seen near the sidebar.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = Math.max(rect.width, 240);
    const maxLeft = window.innerWidth - panelWidth - 16;
    setCoords({ top: rect.bottom + 6, left: Math.min(rect.left, Math.max(maxLeft, 16)), width: panelWidth });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      onToggle(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onToggle]);

  const filteredOptions = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query]
  );

  const toggleOption = (opt) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  const summary =
    selected.length === 0 ? `All ${label}` :
    selected.length === 1 ? selected[0] :
    `${selected.length} ${label} selected`;

  return (
    <div ref={triggerRef} className="ms-dropdown" style={{ width }}>
      <button type="button" className="select-3d ms-trigger" onClick={() => onToggle(!isOpen)}>
        <span className="ms-trigger-text">{summary}</span>
        <ChevronDown size={13} />
      </button>
      {isOpen && createPortal(
        <div ref={panelRef} className="ms-panel lp-scroll" style={{ top: coords.top, left: coords.left, width: coords.width }}>
          <div className="ms-search">
            <Search size={12} color="#94a3b8" />
            <input
              id={`ms-search-${label.toLowerCase()}`}
              name={`msSearch${label}`}
              autoComplete="off"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
            />
          </div>
          <div className="ms-actions">
            <button type="button" onClick={() => onChange([])}>Clear</button>
            <button type="button" onClick={() => onChange(options)}>Select all</button>
          </div>
          <div className="ms-options">
            {filteredOptions.map((opt) => (
              <label key={opt} className="ms-option">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                <span>{opt}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && <div className="ms-empty">No matches</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Same floating, portaled, searchable panel as MultiSelectDropdown, but for a
// single choice: clicking a row selects it and closes the panel immediately —
// no checkboxes, no Clear/Select all, no isOpen prop from a parent since only
// one of these ever needs to be open at a time (there's just one per tab).
function SingleSelectDropdown({ options, value, onChange, width = 280, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width });

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = Math.max(rect.width, 260);
    const maxLeft = window.innerWidth - panelWidth - 16;
    setCoords({ top: rect.bottom + 6, left: Math.min(rect.left, Math.max(maxLeft, 16)), width: panelWidth });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  useEffect(() => { if (!isOpen) setQuery(""); }, [isOpen]);

  const filteredOptions = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query]
  );

  const selectedOption = options.find((o) => o.value === value);

  const selectOption = (opt) => {
    onChange(opt.value);
    setIsOpen(false);
  };

  return (
    <div ref={triggerRef} className="ms-dropdown" style={{ width }}>
      <button type="button" className="select-3d ms-trigger" onClick={() => setIsOpen((o) => !o)}>
        <span className="ms-trigger-text">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={13} />
      </button>
      {isOpen && createPortal(
        <div ref={panelRef} className="ms-panel lp-scroll" style={{ top: coords.top, left: coords.left, width: coords.width }}>
          <div className="ms-search">
            <Search size={12} color="#94a3b8" />
            <input
              id="ss-search-wo"
              name="ssSearchWo"
              autoComplete="off"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search work orders..."
            />
          </div>
          <div className="ms-options">
            {filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className={`ms-option ${opt.value === value ? "ss-option-selected" : ""}`}
                onClick={() => selectOption(opt)}
              >
                <span>{opt.label}</span>
              </div>
            ))}
            {filteredOptions.length === 0 && <div className="ms-empty">No matches</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function DataTable({ columns, rows, pageSize = 12, onRowClick, initialSort }) {
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [rows]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const toggleSort = (key) => {
    setPage(0);
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  return (
    <div>
      <div className="table-scroll-3d lp-scroll">
        <table className="table-3d">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} onClick={() => c.sortable !== false && toggleSort(c.key)} className={c.sortable !== false ? "sortable" : ""}>
                  <span className="sort-wrap">
                    {c.label}
                    {c.sortable !== false && <ArrowUpDown size={10} style={{ opacity: sort?.key === c.key ? 1 : 0.4 }} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} onClick={() => onRowClick && onRowClick(r)} className={onRowClick ? "clickable" : ""}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: "28px 14px", color: COLORS.slate }}>No matching records.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination-row no-print">
        <span>{sorted.length.toLocaleString("en-IN")} records</span>
        <div className="pagination-btns">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="pagination-btn">Prev</button>
          <span>Page {page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="pagination-btn">Next</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clickable legend filtering — click a legend entry to toggle it       */
/* ------------------------------------------------------------------ */
function useSeriesFilter() {
  const [hidden, setHidden] = useState(() => new Set());
  const toggle = (key) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return { hidden, toggle };
}

// Used only by the two Recharts line/area charts still in the dashboard.
function FilterableLegend({ hidden, toggle }) {
  return (props) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", paddingTop: 8 }}>
        {payload.map((entry, i) => {
          const key = entry.dataKey ?? entry.value;
          const isHidden = hidden.has(key);
          return (
            <span
              key={i}
              onClick={() => toggle(key)}
              style={{
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, fontWeight: 700, userSelect: "none",
                color: isHidden ? "#94a3b8" : "#334155",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: isHidden ? "#cbd5e1" : entry.color }} />
              {entry.value}
            </span>
          );
        })}
      </div>
    );
  };
}

/* Standalone clickable legend for the 3D bar/donut charts below — plain
   React JSX, not routed through Recharts, so clicks are never swallowed by
   an SVG hit-area or an absolute-positioned legend wrapper. Used both for
   donut slices and for bar-chart series. */
function PieLegend({ items, hidden, toggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", paddingTop: 8 }}>
      {items.map((entry, i) => {
        const key = entry.dataKey ?? entry.name;
        const isHidden = hidden.has(key);
        return (
          <span
            key={i}
            onClick={() => toggle(key)}
            style={{
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, userSelect: "none",
              color: isHidden ? "#94a3b8" : "#334155",
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: isHidden ? "#cbd5e1" : entry.color }} />
            {entry.name}
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3D chart primitives — plain SVG, isometric extruded blocks           */
/* ------------------------------------------------------------------ */
function shadeColor(hex, percent) {
  const clean = String(hex || "#64748b").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16) || 0;
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0xff) + Math.round(255 * percent);
  let b = (num & 0xff) + Math.round(255 * percent);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function niceCeil(value) {
  if (!value || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  let niceFrac;
  if (frac <= 1) niceFrac = 1;
  else if (frac <= 2) niceFrac = 2;
  else if (frac <= 2.5) niceFrac = 2.5;
  else if (frac <= 5) niceFrac = 5;
  else niceFrac = 10;
  return niceFrac * base;
}

/* Styled floating tooltip box (matches the look of a standard chart
   tooltip: white rounded card, bold title, colored value rows). Positioned
   with a left % (so it tracks correctly even though the SVG scales
   non-uniformly) and a top px (1:1 with the SVG's own pixel height). */
function ChartTooltip({ hover }) {
  if (!hover) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${hover.leftPct}%`,
        top: hover.topPx,
        transform: "translate(-50%, -100%) translateY(-10px)",
        background: "#ffffff",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
        padding: "10px 14px",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 30,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", marginBottom: hover.rows.length ? 5 : 0 }}>{hover.title}</div>
      {hover.rows.map((row, i) => (
        <div key={i} style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: 7, marginTop: i ? 3 : 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: row.color, flexShrink: 0 }} />
          {row.name} : {row.value}
        </div>
      ))}
    </div>
  );
}

/* Isometric extruded bar/column chart — grouped or stacked. Each bar is
   drawn as a prism (front face + lightened top face + darkened side face)
   to match the chunky extruded-block look of the reference design.
   Hovering a category shows a light highlight band plus a floating
   tooltip card listing every visible series' value for that category. */
function Bars3D({ data, categoryKey, series, stacked = false, height = 280, unit = "", valueFormatter, rotateLabels = -25, categoryColors, maxLabelChars = 10 }) {
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [expandedLabels, setExpandedLabels] = useState(() => new Set());
  const toggleLabel = (key) =>
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data || data.length === 0 || !series || series.length === 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 13, fontWeight: 600 }}>
        No data to display.
      </div>
    );
  }

  const fmtValue = valueFormatter || ((v) => String(Math.round(v * 100) / 100));
  const n = data.length;
  const seriesCount = Math.max(series.length, 1);
  const VISIBLE_BARS = 5;
  const AXIS_W = (() => {
    let mx = 0;
    data.forEach((row) => {
      if (stacked) {
        const sum = series.reduce((s, sr) => s + (Number(row[sr.key]) || 0), 0);
        if (sum > mx) mx = sum;
      } else {
        series.forEach((sr) => { const v = Number(row[sr.key]) || 0; if (v > mx) mx = v; });
      }
    });
    const longest = `${fmtValue(niceCeil(mx))}${unit}`.length;
    return Math.max(54, longest * 7 + 14);
  })();
  const margin = { top: 22, right: 16, bottom: rotateLabels ? 76 : 40, left: 0 };
  // Available width for the SCROLLING plot area is the container width minus
  // the fixed axis strip (the axis no longer eats into the scrolling SVG).
  const scrollAreaW = Math.max((containerWidth || 1000) - AXIS_W, 100);
  const fallbackPlotW = scrollAreaW - margin.right;
  const plotWForVisible = fallbackPlotW;
  const barUnit = Math.max(plotWForVisible / VISIBLE_BARS, 30);
  const needsScroll = n > VISIBLE_BARS;
  const VBW = needsScroll ? n * barUnit + margin.right : scrollAreaW;
  const plotW = VBW - margin.right;
  const plotH = Math.max(height - margin.top - margin.bottom, 40);
  const baseline = margin.top + plotH;

  let overallMax = 0;
  data.forEach((row) => {
    if (stacked) {
      const sum = series.reduce((s, sr) => s + (Number(row[sr.key]) || 0), 0);
      if (sum > overallMax) overallMax = sum;
    } else {
      series.forEach((sr) => {
        const v = Number(row[sr.key]) || 0;
        if (v > overallMax) overallMax = v;
      });
    }
  });
  const niceMax = niceCeil(overallMax);
  const yScale = (v) => (v / niceMax) * plotH;

  const bandW = plotW / n;
  const groupW = bandW * 0.62;
  const barW = stacked ? groupW : groupW / seriesCount;
  const depth = Math.min(barW * 0.36, 12);
  const dx = depth * 0.75;
  const dy = depth * 0.5;

  const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * niceMax);

  const showHover = (e, ci, row) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const leftPct = ((e.clientX - rect.left) / rect.width) * 100;
    const topPx = e.clientY - rect.top;
    const rows = series.map((sr, si) => ({
      name: sr.name,
      color: categoryColors ? categoryColors[ci] : sr.color,
      value: `${fmtValue(Number(row[sr.key]) || 0)}${unit}`,
    }));
    setHover({ leftPct, topPx, title: String(row[categoryKey]), rows });
  };
  const hideHover = () => setHover(null);

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative", display: "flex" }}>
      {/* Fixed axis strip — never scrolls, so values stay visible while bars scroll underneath */}
      <svg
        width={AXIS_W}
        height={height}
        style={{ display: "block", flexShrink: 0, overflow: "visible" }}
      >
        {gridTicks.map((t, i) => {
          const y = baseline - yScale(t);
          return (
            <text key={i} x={AXIS_W - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#64748b" fontWeight={600}>
              {fmtValue(t)}{unit}
            </text>
          );
        })}
      </svg>

      <div
        className={needsScroll ? "lp-scroll" : undefined}
        style={{ width: "100%", position: "relative", overflowX: needsScroll ? "auto" : "visible", minWidth: 0 }}
      >
        <svg
          viewBox={`0 0 ${VBW} ${height}`}
          width={needsScroll ? VBW : "100%"}
          height={height}
          preserveAspectRatio={needsScroll ? undefined : "none"}
          style={{ display: "block", overflow: "visible" }}
        >
          {gridTicks.map((t, i) => {
            const y = baseline - yScale(t);
            return (
              <line key={i} x1={0} x2={plotW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            );
          })}
          <line x1={0} x2={plotW} y1={baseline} y2={baseline} stroke="#cbd5e1" strokeWidth={1.5} />

          {data.map((row, ci) => {
            const bandX = ci * bandW + (bandW - groupW) / 2;
            const isHovered = hover && hover.title === String(row[categoryKey]);
            let cumulative = 0;
            return (
              <g
                key={ci}
                onMouseEnter={(e) => showHover(e, ci, row)}
                onMouseMove={(e) => showHover(e, ci, row)}
                onMouseLeave={hideHover}
                style={{ cursor: "pointer" }}
              >
                <rect x={bandX - bandW * 0.19} y={margin.top} width={groupW + bandW * 0.38} height={plotH} fill="#94a3b8" opacity={isHovered ? 0.16 : 0} rx={6} />
                {series.map((sr, si) => {
                  const raw = Number(row[sr.key]) || 0;
                  const h = yScale(raw);
                  if (h <= 0) return null;
                  const x0 = stacked ? bandX : bandX + si * barW;
                  const x1 = x0 + barW;
                  const yTop = stacked ? baseline - yScale(cumulative + raw) : baseline - h;
                  const yBase = stacked ? baseline - yScale(cumulative) : baseline;
                  cumulative += raw;
                  const color = categoryColors ? categoryColors[ci] : sr.color;
                  const top = shadeColor(color, 0.26);
                  const side = shadeColor(color, -0.24);
                  return (
                    <g key={sr.key}>
                      <rect x={x0} y={yTop} width={barW} height={Math.max(yBase - yTop, 0)} fill={color} />
                      <polygon points={`${x0},${yTop} ${x1},${yTop} ${x1 + dx},${yTop - dy} ${x0 + dx},${yTop - dy}`} fill={top} />
                      <polygon points={`${x1},${yTop} ${x1 + dx},${yTop - dy} ${x1 + dx},${yBase - dy} ${x1},${yBase}`} fill={side} />
                    </g>
                  );
                })}
                <text
                  x={bandX + groupW / 2}
                  y={baseline + 18}
                  textAnchor={rotateLabels ? "end" : "middle"}
                  fontSize={10.5}
                  fill="#475569"
                  fontWeight={600}
                  transform={rotateLabels ? `rotate(${rotateLabels}, ${bandX + groupW / 2}, ${baseline + 18})` : undefined}
                  onClick={() => toggleLabel(String(row[categoryKey]))}
                  style={{ cursor: String(row[categoryKey]).length > maxLabelChars ? "pointer" : "default" }}
                >
                  {(() => {
                    const full = String(row[categoryKey]);
                    if (full.length <= maxLabelChars || expandedLabels.has(full)) return full;
                    return full.slice(0, maxLabelChars).trimEnd() + "…";
                  })()}
                </text>
              </g>
            );
          })}
        </svg>
        <ChartTooltip hover={hover} />
      </div>
    </div>
  );
}

/* Exploded isometric donut/pie — each slice rendered as a curved prism
   (rim face + lifted top face), with a percentage label on larger slices.
   Legend and click-to-filter stay in <PieLegend />, driven externally.
   Hovering a slice shows the same floating tooltip card style as Bars3D. */
function Donut3D({ data, height = 220, innerRatio = 0.55 }) {
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);

  const total = (data || []).reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (!data || data.length === 0 || total <= 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 13, fontWeight: 600 }}>
        No data to display.
      </div>
    );
  }

  const VBW = 300;
  const cx = VBW / 2;
  const cy = height / 2;
  const outerR = Math.max(Math.min(VBW / 2 - 30, height / 2 - 26), 40);
  const innerR = outerR * innerRatio;
  const depth = Math.max(9, outerR * 0.15);
  const gapDeg = data.length > 1 ? 2.5 : 0;

  const rad = (deg) => (deg * Math.PI) / 180;
  const pt = (r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

  let cursor = -90;
  const slices = data.map((d) => {
    const value = Number(d.value) || 0;
    const sweep = (value / total) * 360;
    const start = cursor + gapDeg / 2;
    let end = cursor + sweep - gapDeg / 2;
    cursor += sweep;
    end = Math.min(end, start + 359.99); // prevent a 360° slice from collapsing to a zero-length arc
    return { name: d.name, color: d.color || "#64748b", value, pct: (value / total) * 100, start, end: Math.max(end, start + 0.01) };
  });

  function sectorPath(r1, r2, a1, a2) {
    const large = a2 - a1 > 180 ? 1 : 0;
    const [x1, y1] = pt(r2, a1);
    const [x2, y2] = pt(r2, a2);
    const [x3, y3] = pt(r1, a2);
    const [x4, y4] = pt(r1, a1);
    return `M ${x1} ${y1} A ${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z`;
  }

  function rimPath(r, a1, a2, d) {
    const large = a2 - a1 > 180 ? 1 : 0;
    const [x1, y1] = pt(r, a1);
    const [x2, y2] = pt(r, a2);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x2} ${y2 + d} A ${r} ${r} 0 ${large} 0 ${x1} ${y1 + d} Z`;
  }

  const showHover = (e, s) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const leftPct = ((e.clientX - rect.left) / rect.width) * 100;
    const topPx = e.clientY - rect.top;
    setHover({
      leftPct,
      topPx,
      title: s.name,
      rows: [{ name: "Value", color: s.color, value: `${fmtFull(s.value)} (${s.pct.toFixed(1)}%)` }],
    });
  };
  const hideHover = () => setHover(null);

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <svg viewBox={`0 0 ${VBW} ${height}`} width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
        {slices.map((s, i) => (
          <path key={`rim-${i}`} d={rimPath(outerR, s.start, s.end, depth)} fill={shadeColor(s.color, -0.32)} />
        ))}
        {slices.map((s, i) => {
          const [lx, ly] = pt((innerR + outerR) / 2, (s.start + s.end) / 2);
          return (
            <g
              key={`top-${i}`}
              onMouseEnter={(e) => showHover(e, s)}
              onMouseMove={(e) => showHover(e, s)}
              onMouseLeave={hideHover}
              style={{ cursor: "pointer" }}
            >
              <path d={sectorPath(innerR, outerR, s.start, s.end)} fill={shadeColor(s.color, 0.1)} stroke="#ffffff" strokeWidth={2} />
              {s.pct >= 6 && (
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={800} fill="#ffffff" style={{ pointerEvents: "none" }}>
                  {s.pct.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <ChartTooltip hover={hover} />
    </div>
  );
}

/* Isometric line/area chart — same design language as Bars3D/Donut3D:
   each line is drawn as a raised ribbon (a darker offset twin path behind
   the bright line), points render as small lifted beads, optional area
   fill uses a soft vertical gradient, and hovering anywhere over the plot
   snaps to the nearest category and shows the same floating tooltip card.
   Supports a second (right) y-axis for a dual-axis trend line. */
function Lines3D({ data, categoryKey, series, height = 260, area = false, rotateLabels = 0, rightUnit = "%" }) {
  const containerRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [hoverPos, setHoverPos] = useState(null);
  const [expandedLabels, setExpandedLabels] = useState(() => new Set());
  const toggleLabel = (key) =>
    setExpandedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!data || data.length === 0 || !series || series.length === 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 13, fontWeight: 600 }}>
        No data to display.
      </div>
    );
  }

  const leftSeries = series.filter((s) => (s.axis || "left") === "left");
  const rightSeries = series.filter((s) => s.axis === "right");
  const hasRight = rightSeries.length > 0;

  const nPts = data.length;
  const needsScroll = nPts > 8;
  let earlyMax = 0;
  data.forEach((row) => (leftSeries.length ? leftSeries : series).forEach((s) => {
    const v = Number(row[s.key]) || 0;
    if (v > earlyMax) earlyMax = v;
  }));
  const leftLabelLen = fmtFull(niceCeil(earlyMax)).length;
  const margin = { top: 20, right: hasRight ? 50 : 18, bottom: rotateLabels ? 66 : 34, left: Math.max(54, leftLabelLen * 7 + 14) };
  const VBW = needsScroll ? Math.max(nPts * 60 + margin.left + margin.right, containerWidth || 1000) : 1000;
  const plotW = VBW - margin.left - margin.right;
  const plotH = Math.max(height - margin.top - margin.bottom, 40);
  const baseline = margin.top + plotH;
  const n = data.length;
  const xAt = (i) => (n <= 1 ? margin.left + plotW / 2 : margin.left + (i / (n - 1)) * plotW);

  const axisMax = (list) => {
    let max = 0;
    data.forEach((row) => list.forEach((s) => { const v = Number(row[s.key]) || 0; if (v > max) max = v; }));
    return niceCeil(max);
  };
  const leftMax = axisMax(leftSeries.length ? leftSeries : series);
  const rightMax = hasRight ? axisMax(rightSeries) : leftMax;
  const yForSeries = (s) => {
    const max = s.axis === "right" ? rightMax : leftMax;
    return (v) => baseline - (v / max) * plotH;
  };

  const buildLine = (s) => {
    const yScale = yForSeries(s);
    return data.map((row, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yScale(Number(row[s.key]) || 0).toFixed(2)}`).join(" ");
  };
  const buildArea = (s) => {
    const yScale = yForSeries(s);
    const top = data.map((row, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yScale(Number(row[s.key]) || 0).toFixed(2)}`).join(" ");
    return `${top} L ${xAt(n - 1).toFixed(2)} ${baseline.toFixed(2)} L ${xAt(0).toFixed(2)} ${baseline.toFixed(2)} Z`;
  };

  const depth = 6;
  const gridFracs = [0, 0.25, 0.5, 0.75, 1];

  const updateHover = (e) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const pr = e.currentTarget.getBoundingClientRect();
    const relX = margin.left + ((e.clientX - pr.left) / (pr.width || 1)) * plotW;
    let idx = 0, best = Infinity;
    data.forEach((_, i) => { const d = Math.abs(xAt(i) - relX); if (d < best) { best = d; idx = i; } });
    setHoverIdx(idx);
    setHoverPos({ leftPct: ((e.clientX - rect.left) / rect.width) * 100, topPx: e.clientY - rect.top });
  };
  const clearHover = () => { setHoverIdx(null); setHoverPos(null); };

  const hover = hoverIdx !== null && hoverPos
    ? {
        leftPct: hoverPos.leftPct,
        topPx: hoverPos.topPx,
        title: String(data[hoverIdx][categoryKey]),
        rows: series.map((s) => ({
          name: s.name,
          color: s.color,
          value: s.format ? s.format(Number(data[hoverIdx][s.key]) || 0) : fmtFull(Number(data[hoverIdx][s.key]) || 0),
        })),
      }
    : null;

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <div className={needsScroll ? "lp-scroll" : undefined} style={{ width: "100%", overflowX: needsScroll ? "auto" : "visible" }}>
      <svg viewBox={`0 0 ${VBW} ${height}`} width={needsScroll ? VBW : "100%"} height={height} preserveAspectRatio={needsScroll ? undefined : "none"} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`lines3d-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.38} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>

        {gridFracs.map((f, i) => {
          const y = margin.top + f * plotH;
          const leftVal = leftMax * (1 - f);
          return (
            <g key={i}>
              <line x1={margin.left} x2={margin.left + plotW} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={margin.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#64748b" fontWeight={600}>
                {fmtFull(leftVal)}
              </text>
              {hasRight && (
                <text x={margin.left + plotW + 8} y={y + 4} textAnchor="start" fontSize={11} fill="#64748b" fontWeight={600}>
                  {(rightMax * (1 - f)).toFixed(0)}{rightUnit}
                </text>
              )}
            </g>
          );
        })}
        <line x1={margin.left} x2={margin.left + plotW} y1={baseline} y2={baseline} stroke="#cbd5e1" strokeWidth={1.5} />

        {hoverIdx !== null && (
          <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={margin.top} y2={baseline} stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="4 4" />
        )}

        {area && series.map((s, si) => (
          <path key={`area-${si}`} d={buildArea(s)} fill={`url(#lines3d-grad-${s.key})`} stroke="none" />
        ))}

        {series.map((s, si) => (
          <g key={`line-${si}`}>
            <path
              d={buildLine(s)}
              fill="none"
              stroke={shadeColor(s.color, -0.28)}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.55}
              transform={`translate(${depth * 0.6}, ${depth * 0.6})`}
            />
            <path d={buildLine(s)} fill="none" stroke={s.color} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
            {data.map((row, i) => {
              const yScale = yForSeries(s);
              const cx = xAt(i);
              const cy = yScale(Number(row[s.key]) || 0);
              const isHovered = hoverIdx === i;
              return (
                <g key={i}>
                  <circle cx={cx + depth * 0.6} cy={cy + depth * 0.6} r={isHovered ? 5.5 : 3.5} fill={shadeColor(s.color, -0.3)} opacity={0.5} />
                  <circle cx={cx} cy={cy} r={isHovered ? 5.5 : 3.5} fill="#ffffff" stroke={s.color} strokeWidth={2.4} />
                </g>
              );
            })}
          </g>
        ))}

        {data.map((row, i) => (
          <text
            key={i}
            x={xAt(i)}
            y={baseline + 18}
            textAnchor={rotateLabels ? "end" : "middle"}
            fontSize={10.5}
            fill="#475569"
            fontWeight={600}
            transform={rotateLabels ? `rotate(${rotateLabels}, ${xAt(i)}, ${baseline + 18})` : undefined}
            onClick={() => toggleLabel(String(row[categoryKey]))}
            style={{ cursor: String(row[categoryKey]).length > 10 ? "pointer" : "default" }}
          >
            {(() => {
              const full = String(row[categoryKey]);
              if (full.length <= 10 || expandedLabels.has(full)) return full;
              return full.slice(0, 10).trimEnd() + "…";
            })()}
          </text>
        ))}

        <rect
          x={margin.left}
          y={margin.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={updateHover}
          onMouseEnter={updateHover}
          onMouseLeave={clearHover}
          style={{ cursor: "crosshair" }}
        />
      </svg>
      </div>
      <ChartTooltip hover={hover} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared KPI banner (visible on every tab)                            */
/* ------------------------------------------------------------------ */
function KpiBanner({ data }) {
  const o = data.overview;
  const ok = o.avgWastePct < 3;
  return (
    <div className="kpi-grid-5">
      <KpiCard label="Work Orders" value={o.totalWorkOrders.toLocaleString("en-IN")} icon={ClipboardList} accent="blue"
        sub={`${o.dateRange.start} → ${o.dateRange.end}`} />
      <KpiCard label="Order Qty" value={fmt(o.totalOrderQty)} icon={PackageCheck} accent="purple" sub={`${fmtFull(o.totalOrderQty)} units booked`} />
      <KpiCard label="Production Qty" value={fmt(o.totalProductionQty)} icon={Factory} accent="emerald" sub={`${fmtFull(o.totalProductionQty)} units produced`} />
      <KpiCard label="Total Wastage" value={fmt(o.totalWasteQty)} icon={TrendingDown} accent="rose" sub={`${fmtFull(o.totalWasteQty)} wastage units`} />
      <KpiCard label="Avg Waste Rate" value={fmtPct(o.avgWastePct)} icon={Gauge} accent="amber"
        sub={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: ok ? "#059669" : "#e11d48" }}>
            {ok ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
            {ok ? "Controlled wastage margin" : "Above 3% threshold"}
          </span>
        } />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stage drilldown drawer                                              */
/* ------------------------------------------------------------------ */
function StageDrawer({ wo, data, onClose, onTrack }) {
  if (!wo) return null;
  const ledgerRow = data.ledger.find((r) => r.wo === wo);
  // Open details: production legs only, most recent entry first
  const events = [...(data.stageTrackerProd[wo] || [])]
    .map((e, idx) => ({ ...e, idx }))
    .sort((a, b) => (b.lastTs - a.lastTs) || (b.lastCreated - a.lastCreated) || (b.idx - a.idx));
  const reelRows = data.reel.records.filter((r) => r.wo === wo);

  return (
    <div className="drawer-overlay no-print" onClick={onClose}>
      <div className="drawer-content lp-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: COLORS.indigo, margin: 0 }}>Work Order</p>
            <h2 style={{ fontSize: 21, fontWeight: 900, margin: "4px 0 0 0", color: COLORS.ink }}>WO #{wo}</h2>
            {ledgerRow && <p style={{ fontSize: 12, marginTop: 4, color: COLORS.slate }}>{ledgerRow.customer} — {ledgerRow.job}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => onTrack(wo)} className="btn-3d btn-3d-secondary btn-3d-sm">Track sequence</button>
            <button onClick={onClose} className="drawer-close-btn"><X size={18} /></button>
          </div>
        </div>

        <div className="drawer-body">
          {ledgerRow && (
            <div className="mini-stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="mini-stat-box">
                <p className="lbl">Order Qty</p>
                <p className="val">{fmtFull(ledgerRow.orderQty)}</p>
              </div>
              <div className="mini-stat-box">
                <p className="lbl">Final Output</p>
                <p className="val">{fmtFull(ledgerRow.finalOutputQty)}</p>
              </div>
              <div className="mini-stat-box">
                <p className="lbl">Completion</p>
                <p className="val">{ledgerRow.completionPct}% <StatusPill status={ledgerRow.status} /></p>
              </div>
            </div>
          )}

          <h3 style={{ fontSize: 14, fontWeight: 800, margin: "4px 0 14px 0", display: "flex", alignItems: "center", gap: 8, color: COLORS.ink }}>
            <Route size={15} color={COLORS.indigo} /> Stage Routing ({events.length} stage/machine legs)
          </h3>
          <div className="timeline-3d">
            {events.map((e, i) => (
              <div key={i} className="timeline-item-3d">
                <div className="timeline-dot-3d" style={{ color: statusDot(e.status), background: "#fff" }} />
                <div className="timeline-card-3d">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink }}>{e.stage}</span>
                    <span className="badge-pill" style={{ background: COLORS.mist, color: COLORS.slate }}>{e.status || "—"}</span>
                  </div>
                  <p style={{ fontSize: 11.5, marginTop: 4, color: COLORS.slate }}>{e.machine} · {e.from}{e.to !== e.from ? ` → ${e.to}` : ""} · {e.hours}h · {e.events} logged event{e.events > 1 ? "s" : ""}</p>
                  {e.prodQty > 0 && (
                    <p style={{ fontSize: 12, marginTop: 6, color: COLORS.ink, fontWeight: 700 }}>
                      Output {fmtFull(e.prodQty)} &nbsp;·&nbsp; Waste {fmtFull(e.wasteQty)} ({fmtPct(pct(e.wasteQty, e.prodQty))})
                    </p>
                  )}
                </div>
              </div>
            ))}
            {events.length === 0 && <p style={{ fontSize: 12, color: COLORS.slate }}>No stage-level events logged for this work order.</p>}
          </div>

          {reelRows.length > 0 && (
            <div style={{ marginTop: 26 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, color: COLORS.ink }}>
                <Scroll size={15} color={COLORS.indigo} /> Reels Consumed
              </h3>
              <div className="table-scroll-3d">
                <table className="table-3d" style={{ minWidth: 0, fontSize: 11.5 }}>
                  <thead><tr>
                    {["Reel No", "Mill", "GSM", "Net (kg)", "Waste (kg)", "Waste %"].map((h) => <th key={h}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {reelRows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.reelNo}</td>
                        <td>{r.mill}</td>
                        <td>{r.gsm}</td>
                        <td>{r.actualNet}</td>
                        <td>{r.totalWaste}</td>
                        <td>{r.wastePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                 */
/* ------------------------------------------------------------------ */
function OverviewTab({ data }) {
  const o = data.overview;
  const jc = o.jobCompletion;
  const jcData = [
    { name: "Under-completed", value: jc.under, color: COLORS.amber },
    { name: "Exact", value: jc.exact, color: COLORS.green },
    { name: "Over-completed", value: jc.over, color: COLORS.indigo },
  ];
  const jcFilter = useSeriesFilter();
  const jcVisible = jcData.filter((d) => !jcFilter.hidden.has(d.name));
  const trendFilter = useSeriesFilter();

  return (
    <div>
      <div className="panel-grid-2">
        <Panel title="Top Volume Customers" icon={Users} iconGrad={ACCENTS.blue.grad} sub="Production output by client account (units)">
          <Bars3D
            data={o.topCustomers}
            categoryKey="name"
            series={[{ key: "qty", name: "Units", color: COLORS.indigo }]}
            height={280}
            valueFormatter={fmtFull}
          />
        </Panel>
        <Panel title="Highest Volume Machinery" icon={Cpu} iconGrad={ACCENTS.emerald.grad} sub="Leading machines by total produced units">
          <Bars3D
            data={o.topMachines}
            categoryKey="name"
            series={[{ key: "qty", name: "Units", color: COLORS.teal }]}
            height={280}
            valueFormatter={fmtFull}
          />
        </Panel>
      </div>

      <div className="panel-grid-3">
        <Panel title="Job Completion Profile" icon={CheckCircle2} iconGrad={ACCENTS.amber.grad} sub={`Target compliance across ${o.totalWorkOrders.toLocaleString("en-IN")} work orders`}>
          <Donut3D data={jcVisible} height={220} />
          <PieLegend items={jcData.map((d) => ({ name: d.name, color: d.color, dataKey: d.name }))} hidden={jcFilter.hidden} toggle={jcFilter.toggle} />
        </Panel>
        <Panel title="High Waste Machine Comparison" icon={TrendingUp} iconGrad={ACCENTS.rose.grad} sub="Machines ranked by waste rate (%)">
          <Bars3D
            data={o.highWasteMachines}
            categoryKey="Machine"
            series={[{ key: "wastePct", name: "Waste %", color: COLORS.rose }]}
            height={220}
            unit="%"
            rotateLabels={-20}
            valueFormatter={(v) => v.toFixed(1)}
          />
        </Panel>
      </div>

      <Panel title="Production vs Waste — Monthly Trend" icon={TrendingUp} iconGrad={ACCENTS.blue.grad} sub="Output volume and wastage rate across the dataset period">
        <Lines3D
          data={data.trend}
          categoryKey="Month"
          series={[
            { key: "prodQty", name: "Production Qty", color: COLORS.indigo, axis: "left", format: fmtFull },
            { key: "wastePct", name: "Waste %", color: COLORS.rose, axis: "right", format: (v) => `${v.toFixed(2)}%` },
          ].filter((s) => !trendFilter.hidden.has(s.key))}
          height={260}
        />
        <PieLegend
          items={[
            { name: "Production Qty", color: COLORS.indigo, dataKey: "prodQty" },
            { name: "Waste %", color: COLORS.rose, dataKey: "wastePct" },
          ]}
          hidden={trendFilter.hidden}
          toggle={trendFilter.toggle}
        />
      </Panel>
    </div>
  );
}

function StageTrackerTab({ data, wo, setWo, openWO }) {
  const options = useMemo(() => [...data.ledger].sort((a, b) => b.orderQty - a.orderQty), [data.ledger]);
  const current = data.ledger.some((r) => r.wo === wo) ? wo : options[0]?.wo;
  const row = data.ledger.find((r) => r.wo === current);

  const legs = useMemo(
    () => [...(data.stageTracker[current] || [])].sort((a, b) => String(a.from || "").localeCompare(String(b.from || ""))),
    [data.stageTracker, current]
  );
  // same stage appearing more than once → one bar, values summed
const chartData = useMemo(() => {
  const byStage = new Map();
  legs.forEach((l) => {
    if (!byStage.has(l.stage)) byStage.set(l.stage, { stage: l.stage, output: 0, wastage: 0 });
    const e = byStage.get(l.stage);
    e.output += l.prodQty;
    e.wastage += l.wasteQty;
  });
  return Array.from(byStage.values()).map((e, i) => ({
    name: `${i + 1}. ${e.stage}`,
    output: e.output,
    wastage: e.wastage,
  }));
}, [legs]);
  // cards: latest entry first (stage numbers keep their sequence order)
  const legsLatestFirst = useMemo(
    () => legs
      .map((l, i) => ({ ...l, stageNo: i + 1 }))
      .sort((a, b) => (b.lastTs - a.lastTs) || (b.lastCreated - a.lastCreated) || (b.stageNo - a.stageNo)),
    [legs]
  );
  const stageFilter = useSeriesFilter();

  if (!row) {
    return <Panel title="Stage Progress Tracker" icon={Route} iconGrad={ACCENTS.blue.grad}><p style={{ fontSize: 13, color: COLORS.slate }}>No work orders found in the production log.</p></Panel>;
  }

  return (
    <div>
      <Panel>
        <div className="panel-header-3d">
          <div>
            <span className="live-badge" style={{ marginBottom: 10 }}>Stage Progress Tracker</span>
            <h2 style={{ fontSize: 17, fontWeight: 900, margin: "8px 0 0 0", color: COLORS.ink }}>Work Order Sequence: #{current} — {row.customer}</h2>
            <p style={{ fontSize: 12, marginTop: 4, color: COLORS.slate }}>{row.job} · {row.startDate || "-"} → {row.endDate || "-"}</p>
          </div>
          <div className="panel-actions no-print">
            <SingleSelectDropdown
              options={options.map((o) => ({ value: o.wo, label: `WO ${o.wo} — ${o.customer}` }))}
              value={current}
              onChange={setWo}
              width={280}
            />
            <button onClick={() => openWO(current)} className="btn-3d btn-3d-secondary btn-3d-sm">Open details</button>
          </div>
        </div>

        <div className="mini-stat-grid">
          {[
            ["Target Order Qty", fmtFull(row.orderQty)],
            ["Final Output", fmtFull(row.finalOutputQty)],
            ["Waste", `${fmtFull(row.totalWasteQty)} (${fmtPct(row.wastePct)})`],
          ].map(([l, v]) => (
            <div key={l} className="mini-stat-box">
              <p className="lbl">{l}</p>
              <p className="val" style={{ color: COLORS.indigoDeep }}>{v}</p>
            </div>
          ))}
          <div className="mini-stat-box">
            <p className="lbl">Completion</p>
            <p className="val">{row.completionPct}% <StatusPill status={row.status} /></p>
          </div>
        </div>

        {legs.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.slate }}>No stage-level events logged for this work order.</p>
        ) : (
          <div className="pipeline-scroll lp-scroll">
            {legsLatestFirst.map((l, i) => (
              <div key={i} className="pipeline-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <span className="badge-pill" style={{ background: "#e0f2fe", color: "#0369a1", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 165 }}>
                    Stage {l.stageNo}: {l.stage}
                  </span>
                  <span title={l.status} style={{ width: 10, height: 10, borderRadius: "50%", background: statusDot(l.status), flexShrink: 0 }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 800, color: COLORS.ink, margin: 0 }}>{l.machine}</p>
                <p style={{ fontSize: 11, color: COLORS.slate, marginTop: 3 }}>{l.from}{l.to !== l.from ? ` → ${l.to}` : ""} · {l.hours}h</p>
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${COLORS.mist}`, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.slate }}>Output</span><span style={{ fontWeight: 800, color: COLORS.ink }}>{fmtFull(l.prodQty)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ color: COLORS.slate }}>wastage</span><span style={{ fontWeight: 700, color: "#e11d48" }}>{fmtFull(l.wasteQty)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ color: COLORS.slate }}>Waste %</span><span style={{ fontWeight: 700, color: wasteColor(pct(l.wasteQty, l.prodQty)) }}>{fmtPct(pct(l.wasteQty, l.prodQty))}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {legs.length > 0 && (
        <Panel title="Stage Output vs wastage" icon={Layers} iconGrad={ACCENTS.blue.grad} tag="Stage comparison" sub={`WO #${current} across ${chartData.length} stages`}>
          <Bars3D
            data={chartData}
            categoryKey="name"
            series={[
              { key: "output", name: "Good output", color: COLORS.indigo },
              { key: "wastage", name: "wastage", color: COLORS.rose },
            ].filter((s) => !stageFilter.hidden.has(s.key))}
            height={290}
            rotateLabels={-20}
            valueFormatter={fmtFull}
          />
          <PieLegend
            items={[
              { name: "Good output", color: COLORS.indigo, dataKey: "output" },
              { name: "wastage", color: COLORS.rose, dataKey: "wastage" },
            ]}
            hidden={stageFilter.hidden}
            toggle={stageFilter.toggle}
          />
        </Panel>
      )}
    </div>
  );
}

function LedgerTab({ data, search, openWO, trackWO }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const filtered = useMemo(() => {
    const q = normWO(search).toLowerCase();
    return data.ledger.filter((r) => {
      const matchesSearch = !q || r.wo.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q) || r.job.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "All" ? true :
        statusFilter === "HighWaste" ? r.wastePct > 10 :
        r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.ledger, search, statusFilter]);

  const columns = [
    { key: "wo", label: "WO #", render: (r) => <span style={{ fontWeight: 800, color: COLORS.indigoDeep }}>WO {r.wo}</span> },
    { key: "customer", label: "Customer" },
    { key: "job", label: "Job Description" },
    { key: "orderQty", label: "Order Qty", render: (r) => fmtFull(r.orderQty) },
    { key: "finalOutputQty", label: "Final Output", render: (r) => fmtFull(r.finalOutputQty) },
    { key: "completionPct", label: "Completion", render: (r) => `${r.completionPct}%` },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "wastePct", label: "Waste %", render: (r) => <span style={{ fontWeight: 800, color: wasteColor(r.wastePct, 3, 10) }}>{fmtPct(r.wastePct)}</span> },
    { key: "events", label: "Events" },
    {
      key: "track", label: "Action", sortable: false,
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); trackWO(r.wo); }} className="btn-3d btn-3d-primary btn-3d-sm no-print">
          Track sequence
        </button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {[["All", "All"], ["Under", "Under"], ["Exact", "Exact"], ["Over", "Over"], ["HighWaste", "High wastage (>10%)"]].map(([id, label]) => (
          <Chip key={id} active={statusFilter === id} onClick={() => setStatusFilter(id)}>{label}</Chip>
        ))}
      </div>
      <Panel>
        <DataTable columns={columns} rows={filtered} pageSize={14} onRowClick={(r) => openWO(r.wo)} initialSort={{ key: "orderQty", dir: "desc" }} />
      </Panel>
      <p style={{ fontSize: 12, color: COLORS.slate }}>Click a row for the routing drawer, or Track sequence to open it in the Stage Tracker.</p>
    </div>
  );
}

function UtilizationTab({ data }) {
  const rows = data.machineUtilization;
  const chartRows = rows;
  const columns = [
    { key: "machine", label: "Machine" },
    { key: "utilizationPct", label: "Utilization %", render: (r) => <span style={{ fontWeight: 800, color: COLORS.indigoDeep }}>{r.utilizationPct}%</span> },
    { key: "production", label: "Production (h)" },
    { key: "idle", label: "Idle (h)" },
    { key: "makeReady", label: "Make-Ready (h)" },
    { key: "breakdown", label: "Breakdown (h)" },
    { key: "maintenance", label: "Maint. (h)" },
    { key: "totalHours", label: "Total (h)" },
    {
      key: "tag", label: "Status", sortable: false,
      render: (r) => r.utilizationPct >= 55
        ? <Tag bg="#d1fae5" fg="#065f46">Optimal</Tag>
        : r.utilizationPct >= 40 ? <Tag bg="#fef3c7" fg="#92400e">Moderate</Tag>
        : <Tag bg="#ffe4e6" fg="#9f1239">Low</Tag>,
    },
  ];
  const utilFilter = useSeriesFilter();
  return (
    <div>
      <Panel title="Machine Time Allocation" icon={Gauge} iconGrad={ACCENTS.blue.grad} sub="Top 10 machines by logged hours — Production / Idle / Make-Ready / Breakdown / Maintenance">
        <Bars3D
          data={chartRows}
          categoryKey="machine"
          stacked
          series={[
            { key: "production", name: "Production", color: COLORS.indigo },
            { key: "idle", name: "Idle", color: "#cbd5e1" },
            { key: "makeReady", name: "Make-Ready", color: COLORS.amber },
            { key: "breakdown", name: "Breakdown", color: COLORS.rose },
            { key: "maintenance", name: "Maintenance", color: COLORS.steel },
          ].filter((s) => !utilFilter.hidden.has(s.key))}
          height={320}
          unit="h"
          rotateLabels={-25}
          valueFormatter={(v) => v.toFixed(1)}
        />
        <PieLegend
          items={[
            { name: "Production", color: COLORS.indigo, dataKey: "production" },
            { name: "Idle", color: "#cbd5e1", dataKey: "idle" },
            { name: "Make-Ready", color: COLORS.amber, dataKey: "makeReady" },
            { name: "Breakdown", color: COLORS.rose, dataKey: "breakdown" },
            { name: "Maintenance", color: COLORS.steel, dataKey: "maintenance" },
          ]}
          hidden={utilFilter.hidden}
          toggle={utilFilter.toggle}
        />
      </Panel>
      <Panel title="All Machines — Utilization Detail" icon={ClipboardList} iconGrad={ACCENTS.emerald.grad} sub={`${rows.length} machines with logged activity`}>
        <DataTable columns={columns} rows={rows} pageSize={14} initialSort={{ key: "utilizationPct", dir: "desc" }} />
      </Panel>
    </div>
  );
}

function ProdWasteTab({ data }) {
  const rows = data.machineProdWaste;
  const chartRows = rows;
  const columns = [
    { key: "Machine", label: "Machine" },
    { key: "prodQty", label: "Production Qty", render: (r) => fmtFull(r.prodQty) },
    { key: "wasteQty", label: "Waste Qty", render: (r) => fmtFull(r.wasteQty) },
    { key: "wastePct", label: "Waste %", render: (r) => fmtPct(r.wastePct) },
    { key: "events", label: "Logged Events" },
  ];
  const pwFilter = useSeriesFilter();
  return (
    <div>
      <div className="panel-grid-2">
        <Panel title="Production vs wastage by Machine" icon={Cpu} iconGrad={ACCENTS.blue.grad} sub="Top 10 machines by output volume">
          <Bars3D
            data={chartRows}
            categoryKey="Machine"
            series={[
              { key: "prodQty", name: "Production", color: COLORS.indigo },
              { key: "wasteQty", name: "wastage", color: COLORS.rose },
            ].filter((s) => !pwFilter.hidden.has(s.key))}
            height={280}
            rotateLabels={-25}
            valueFormatter={fmtFull}
          />
          <PieLegend
            items={[
              { name: "Production", color: COLORS.indigo, dataKey: "prodQty" },
              { name: "wastage", color: COLORS.rose, dataKey: "wasteQty" },
            ]}
            hidden={pwFilter.hidden}
            toggle={pwFilter.toggle}
          />
        </Panel>
        <Panel title="Highest Machine Waste Rates" icon={TrendingUp} iconGrad={ACCENTS.rose.grad} sub="Machines triggering the highest wastage rates (%)">
          <Lines3D
            data={data.overview.highWasteMachines}
            categoryKey="Machine"
            series={[{ key: "wastePct", name: "Waste %", color: COLORS.rose, format: (v) => `${v.toFixed(2)}%` }]}
            height={280}
            area
            rotateLabels={-25}
          />
        </Panel>
      </div>
      <Panel title="Output by Production Stage" icon={Route} iconGrad={ACCENTS.emerald.grad} sub="Across all logged process stages">
        <Bars3D
          data={data.stages}
          categoryKey="Stage"
          series={[{ key: "prodQty", name: "Output", color: COLORS.teal }]}
          height={280}
          rotateLabels={-25}
          valueFormatter={fmtFull}
        />
      </Panel>
      <Panel title="All Machines — Production & Waste Detail" icon={ClipboardList} iconGrad={ACCENTS.blue.grad} sub={`${rows.length} machines`}>
        <DataTable columns={columns} rows={rows} pageSize={14} initialSort={{ key: "prodQty", dir: "desc" }} />
      </Panel>
    </div>
  );
}

function JobCompletionTab({ data, openWO }) {
  const [statusFilter, setStatusFilter] = useState("Under");
  const jc = data.overview.jobCompletion;
  const total = jc.under + jc.exact + jc.over;
  const share = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : "0.0");
  const barData = [
    { name: "Under-Completed", value: jc.under, fill: COLORS.amber },
    { name: "Exact 100%", value: jc.exact, fill: COLORS.green },
    { name: "Over-Completed", value: jc.over, fill: COLORS.indigo },
  ];
  const rows = data.ledger
    .filter((r) => r.status === statusFilter)
    .sort((a, b) => Math.abs(100 - b.completionPct) - Math.abs(100 - a.completionPct));
  const columns = [
    { key: "wo", label: "WO #" },
    { key: "customer", label: "Customer" },
    { key: "orderQty", label: "Order Qty", render: (r) => fmtFull(r.orderQty) },
    { key: "finalOutputQty", label: "Final Output", render: (r) => fmtFull(r.finalOutputQty) },
    { key: "completionPct", label: "Completion", render: (r) => `${r.completionPct}%` },
  ];
  const jpFilter = useSeriesFilter();
  const barVisible = barData.filter((d) => !jpFilter.hidden.has(d.name));
  return (
    <div>
      <div className="kpi-grid-3">
        <KpiCard label="Under-completed (<100%)" value={jc.under.toLocaleString("en-IN")} accent="amber" sub={`${share(jc.under)}% of work orders`} />
        <KpiCard label="Exact completion (=100%)" value={jc.exact.toLocaleString("en-IN")} accent="emerald" sub={`${share(jc.exact)}% of work orders`} />
        <KpiCard label="Over-completed (>100%)" value={jc.over.toLocaleString("en-IN")} accent="blue" sub={`${share(jc.over)}% of work orders`} />
      </div>
      <div className="panel-grid-3">
        <Panel title="Completion Profile" icon={CheckCircle2} iconGrad={ACCENTS.amber.grad}>
          <Donut3D data={barVisible.map((d) => ({ name: d.name, value: d.value, color: d.fill }))} height={220} />
          <PieLegend items={barData.map((d) => ({ name: d.name, color: d.fill, dataKey: d.name }))} hidden={jpFilter.hidden} toggle={jpFilter.toggle} />
        </Panel>
        <Panel title="Work Orders by Completion Bucket" icon={ClipboardList} iconGrad={ACCENTS.blue.grad}>
          <Bars3D
            data={barData}
            categoryKey="name"
            series={[{ key: "value", name: "Work orders", color: COLORS.indigo }]}
            categoryColors={barData.map((d) => d.fill)}
            height={220}
            rotateLabels={0}
            valueFormatter={(v) => v.toLocaleString("en-IN")}
          />
        </Panel>
      </div>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {["Under", "Exact", "Over"].map((s) => (
            <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s}-Completed ({jc[s.toLowerCase()]})
            </Chip>
          ))}
        </div>
        <DataTable columns={columns} rows={rows} pageSize={12} onRowClick={(r) => openWO(r.wo)} />
      </Panel>
    </div>
  );
}

function CustomersTab({ data }) {
  const rows = data.customers;
  const chartRows = rows;
  const columns = [
    { key: "Customer", label: "Customer" },
    { key: "prodQty", label: "Output Qty", render: (r) => fmtFull(r.prodQty) },
    { key: "wasteQty", label: "Waste Qty", render: (r) => fmtFull(r.wasteQty) },
    { key: "wastePct", label: "Waste %", render: (r) => fmtPct(r.wastePct) },
    { key: "woCount", label: "Work Orders" },
  ];
  return (
    <div>
      <div className="panel-grid-2">
        <Panel title="Output by Customer" icon={Users} iconGrad={ACCENTS.blue.grad} sub="Top 8 accounts by produced units">
          <Bars3D
            data={chartRows}
            categoryKey="Customer"
            series={[{ key: "prodQty", name: "Output", color: COLORS.indigo }]}
            height={280}
            rotateLabels={-25}
            valueFormatter={fmtFull}
          />
        </Panel>
        <Panel title="wastage by Customer" icon={TrendingDown} iconGrad={ACCENTS.rose.grad} sub="Top 8 accounts by waste volume">
          <Bars3D
            data={[...rows].sort((a, b) => b.wasteQty - a.wasteQty)}
            categoryKey="Customer"
            series={[{ key: "wasteQty", name: "wastage", color: COLORS.rose }]}
            height={280}
            rotateLabels={-25}
            valueFormatter={fmtFull}
          />
        </Panel>
      </div>
      <Panel title="All Customers" icon={ClipboardList} iconGrad={ACCENTS.blue.grad} sub={`${rows.length} active accounts`}>
        <DataTable columns={columns} rows={rows} pageSize={14} initialSort={{ key: "prodQty", dir: "desc" }} />
      </Panel>
    </div>
  );
}

function PersoTab({ data }) {
  const k = data.perso.kpi;
  const persoFilter = useSeriesFilter();
  return (
    <div>
      <div className="kpi-grid-4">
        <KpiCard label="Work Orders" value={k.totalWO.toLocaleString("en-IN")} icon={ClipboardList} accent="blue" />
        <KpiCard label="Total Pages" value={fmt(k.totalPages)} icon={FileStack} accent="emerald" sub={`${fmtFull(k.totalPages)} pages`} />
        <KpiCard label="Wastage Qty" value={fmt(k.totalWastage)} icon={TrendingDown} accent="rose" sub={`${fmtFull(k.totalWastage)} units`} />
        <KpiCard label="Waste Rate" value={fmtPct(k.avgWastePct)} icon={Gauge} accent="amber" />
      </div>
      <div className="panel-grid-2">
        <Panel title="Activity Mix" icon={FileStack} iconGrad={ACCENTS.blue.grad} sub="Production output by activity/stage">
          <Bars3D
            data={data.perso.activity}
            categoryKey="Activity"
            series={[{ key: "totalPages", name: "Output", color: COLORS.indigo }]}
            height={220}
            rotateLabels={0}
            valueFormatter={fmtFull}
          />
        </Panel>
        <Panel title="Machine Utilization" icon={Gauge} iconGrad={ACCENTS.emerald.grad} sub="Production Entry line (ProductionReal)">
          <Bars3D
            data={data.perso.utilization}
            categoryKey="machine"
            stacked
            series={[
              { key: "production", name: "Production", color: COLORS.indigo },
              { key: "idle", name: "Idle", color: "#cbd5e1" },
              { key: "breakdown", name: "Breakdown", color: COLORS.rose },
            ].filter((s) => !persoFilter.hidden.has(s.key))}
            height={220}
            unit="h"
            rotateLabels={0}
            valueFormatter={(v) => v.toFixed(1)}
          />
          <PieLegend
            items={[
              { name: "Production", color: COLORS.indigo, dataKey: "production" },
              { name: "Idle", color: "#cbd5e1", dataKey: "idle" },
              { name: "Breakdown", color: COLORS.rose, dataKey: "breakdown" },
            ]}
            hidden={persoFilter.hidden}
            toggle={persoFilter.toggle}
          />
        </Panel>
      </div>
    </div>
  );
}

function ReelTab({ data, openWO }) {
  const [sub, setSub] = useState("customer");
  const r = data.reel;
  const k = r.kpi;
  const wasteCell = (row) => <span style={{ fontWeight: 700, color: wasteColor(row.wastePct, 3, 5) }}>{fmtPct(row.wastePct)}</span>;

  const subTables = {
    customer: {
      rows: r.customers,
      sort: { key: "netWeight", dir: "desc" },
      columns: [
        { key: "Customer", label: "Customer" },
        { key: "netWeight", label: "Net Weight (kg)", render: (x) => x.netWeight.toLocaleString("en-IN") },
        { key: "waste", label: "Waste (kg)", render: (x) => <span style={{ color: "#e11d48" }}>{x.waste}</span> },
        { key: "wastePct", label: "Waste %", render: wasteCell },
        { key: "st", label: "Status", sortable: false, render: (x) => x.wastePct < 5 ? <Tag bg="#d1fae5" fg="#065f46">Optimal</Tag> : <Tag bg="#fef3c7" fg="#92400e">Review</Tag> },
      ],
    },
    mill: {
      rows: r.mills,
      sort: { key: "netWeight", dir: "desc" },
      columns: [
        { key: "Mill", label: "Mill" },
        { key: "reels", label: "Reels" },
        { key: "netWeight", label: "Net Weight (kg)", render: (x) => x.netWeight.toLocaleString("en-IN") },
        { key: "waste", label: "Waste (kg)", render: (x) => <span style={{ color: "#e11d48" }}>{x.waste}</span> },
        { key: "wastePct", label: "Waste %", render: wasteCell },
        { key: "share", label: "Share %", render: (x) => <span style={{ fontWeight: 800, color: COLORS.indigoDeep }}>{x.share}%</span> },
      ],
    },
    wo: {
      rows: r.wos,
      sort: { key: "netWeight", dir: "desc" },
      onRowClick: (x) => openWO(x.WO),
      columns: [
        { key: "WO", label: "Work Order", render: (x) => <span style={{ fontWeight: 800, color: COLORS.indigoDeep }}>WO {x.WO}</span> },
        { key: "customer", label: "Customer" },
        { key: "netWeight", label: "Net Weight (kg)", render: (x) => x.netWeight.toLocaleString("en-IN") },
        { key: "waste", label: "Waste (kg)", render: (x) => <span style={{ color: "#e11d48" }}>{x.waste}</span> },
        { key: "wastePct", label: "Waste %", render: wasteCell },
      ],
    },
    planned: {
      rows: r.wos,
      sort: { key: "plannedQty", dir: "desc" },
      onRowClick: (x) => openWO(x.WO),
      columns: [
        { key: "WO", label: "Work Order", render: (x) => <span style={{ fontWeight: 800, color: COLORS.indigoDeep }}>WO {x.WO}</span> },
        { key: "plannedQty", label: "Planned Qty", render: (x) => fmtFull(x.plannedQty) },
        { key: "output", label: "Actual Output", render: (x) => <span style={{ fontWeight: 700, color: "#059669" }}>{fmtFull(x.output)}</span> },
        { key: "completionPct", label: "Completion Rate", render: (x) => <span style={{ fontWeight: 800, color: x.completionPct >= 100 ? "#059669" : COLORS.steel }}>{fmtPct(x.completionPct)}</span> },
      ],
    },
  };
  const active = subTables[sub];

  const recordColumns = [
    { key: "wo", label: "WO #" },
    { key: "customer", label: "Customer" },
    { key: "mill", label: "Mill" },
    { key: "reelNo", label: "Reel No" },
    { key: "gsm", label: "GSM" },
    { key: "actualNet", label: "Net (kg)" },
    { key: "totalWaste", label: "Waste (kg)" },
    { key: "wastePct", label: "Waste %", render: wasteCell },
  ];

  const wasteOk = k.overallWastePct < 5;

  const custWasteFilter = useSeriesFilter();
  const millFilter = useSeriesFilter();
  const millVisible = r.mills.filter((m) => !millFilter.hidden.has(m.Mill));
  const millColorByName = useMemo(() => {
    const map = new Map();
    r.mills.forEach((m, i) => map.set(m.Mill, MILL_COLORS[i % MILL_COLORS.length]));
    return map;
  }, [r.mills]);
  const millDonutData = millVisible.map((m) => ({ name: m.Mill, value: m.netWeight, color: millColorByName.get(m.Mill) }));
  const plannedFilter = useSeriesFilter();

  return (
    <div>
      <div className="kpi-grid-4">
        <KpiCard label="Total Net Weight" value={`${fmt(k.totalNetWeight)} kg`} icon={Scroll} accent="purple" sub={`${k.reelCount} reels from ${k.millCount} mills`} />
        <KpiCard label="Total Reel Waste" value={`${fmt(k.totalWaste)} kg`} icon={TrendingDown} accent="rose" sub={`Across ${k.activeWO} work orders`} />
        <KpiCard label="Overall Waste %" value={fmtPct(k.overallWastePct)} icon={Gauge} accent="amber"
          sub={<span style={{ fontWeight: 700, color: wasteOk ? "#059669" : "#e11d48" }}>{wasteOk ? "Within threshold (<5%)" : "Above 5% threshold"}</span>} />
        <KpiCard label="Active Work Orders" value={k.activeWO} icon={Layers} accent="emerald" sub="Reel batches evaluated" />
      </div>

      <div className="panel-grid-2">
        <Panel title="Customer Weight & Waste" icon={Users} iconGrad={ACCENTS.blue.grad} sub="Net weight vs waste across top clients (kg)">
          <Bars3D
            data={r.byCustomer}
            categoryKey="Customer"
            series={[
              { key: "netWeight", name: "Net Weight (kg)", color: COLORS.indigo },
              { key: "waste", name: "Waste (kg)", color: COLORS.rose },
            ].filter((s) => !custWasteFilter.hidden.has(s.key))}
            height={260}
            rotateLabels={-20}
            valueFormatter={(v) => v.toLocaleString("en-IN")}
          />
          <PieLegend
            items={[
              { name: "Net Weight (kg)", color: COLORS.indigo, dataKey: "netWeight" },
              { name: "Waste (kg)", color: COLORS.rose, dataKey: "waste" },
            ]}
            hidden={custWasteFilter.hidden}
            toggle={custWasteFilter.toggle}
          />
        </Panel>
        <Panel title="Mill Production Share" icon={Factory} iconGrad={ACCENTS.emerald.grad} sub="Share of net weight by mill">
          <Donut3D data={millDonutData} height={260} />
          <PieLegend items={r.mills.map((m, i) => ({ name: m.Mill, color: MILL_COLORS[i % MILL_COLORS.length], dataKey: m.Mill }))} hidden={millFilter.hidden} toggle={millFilter.toggle} />
        </Panel>
        <Panel title="Work Order Waste Rate" icon={TrendingUp} iconGrad={ACCENTS.amber.grad} sub="Reel waste % per work order">
          <Lines3D
            data={r.wasteByWO}
            categoryKey="WO"
            series={[{ key: "wastePct", name: "Waste %", color: COLORS.amber, format: (v) => `${v.toFixed(2)}%` }]}
            height={260}
            area
            rotateLabels={-20}
          />
        </Panel>
        <Panel title="Planned vs Actual Output" icon={PackageCheck} iconGrad={ACCENTS.emerald.grad} sub="Top work orders by output (units)">
          <Bars3D
            data={r.byWO}
            categoryKey="WO"
            series={[
              { key: "plannedQty", name: "Planned Qty", color: "#cbd5e1" },
              { key: "output", name: "Actual Output", color: COLORS.green },
            ].filter((s) => !plannedFilter.hidden.has(s.key))}
            height={260}
            rotateLabels={0}
            valueFormatter={fmtFull}
          />
          <PieLegend
            items={[
              { name: "Planned Qty", color: "#cbd5e1", dataKey: "plannedQty" },
              { name: "Actual Output", color: COLORS.green, dataKey: "output" },
            ]}
            hidden={plannedFilter.hidden}
            toggle={plannedFilter.toggle}
          />
        </Panel>
      </div>

      <Panel title="Reel Summary Records" icon={ClipboardList} iconGrad={ACCENTS.blue.grad} sub="Breakdown by customer, mill, work order and targets"
        actions={
          <div className="panel-actions no-print">
            {[["customer", "By customer"], ["mill", "By mill"], ["wo", "By work order"], ["planned", "Planned vs output"]].map(([id, label]) => (
              <Chip key={id} active={sub === id} onClick={() => setSub(id)}>{label}</Chip>
            ))}
          </div>
        }>
        <DataTable key={sub} columns={active.columns} rows={active.rows} pageSize={10} initialSort={active.sort} onRowClick={active.onRowClick} />
      </Panel>

      <Panel title="Reel-Level Records" icon={Scroll} iconGrad={ACCENTS.purple.grad} sub={`${r.records.length} reels across ${k.activeWO} work orders`}>
        <DataTable columns={recordColumns} rows={r.records} pageSize={12} onRowClick={(x) => x.wo && openWO(x.wo)} initialSort={{ key: "actualNet", dir: "desc" }} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                 */
/* ------------------------------------------------------------------ */
const TABS = [
  { id: "overview", label: "Overview KPIs", icon: LayoutDashboard },
  { id: "reel", label: "Reel Register", icon: Scroll },
  { id: "tracker", label: "Stage Tracker", icon: Route },
  { id: "utilization", label: "Machine Utilization", icon: Gauge },
  { id: "prodwaste", label: "Production & Waste", icon: Cpu },
  { id: "ledger", label: "Work Order Ledger", icon: ClipboardList },
  { id: "jobperf", label: "Job Completion", icon: CheckCircle2 },
  { id: "customers", label: "Customer Breakdown", icon: Users },
  // { id: "perso", label: "Production Entry Activity", icon: FileStack },
];

export default function LiveProductionPortal() {
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [drawerWO, setDrawerWO] = useState(null);
  const [trackerWO, setTrackerWO] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openFilter, setOpenFilter] = useState(null); // "customers" | "jobs" | "machines" | "locations" | null — only one open at a time

  const [realRows, setRealRows] = useState([]);
  const [reelRows, setReelRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [realRes, reelRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/production-real`, { headers }),
        axios.get(`${BASE_URL}/api/production`, { headers }),
      ]);
      setRealRows(Array.isArray(realRes.data) ? realRes.data : []);
      setReelRows(Array.isArray(reelRes.data) ? reelRes.data : []);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("Error loading portal data:", err);
      setError(err?.response?.status === 401
        ? "Session expired. Sign in again to load production data."
        : "Could not load production data. Check the API connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Options for the global Customer / Job filters, drawn from the full unfiltered dataset.
  const customerOptions = useMemo(() => {
    const set = new Set();
    realRows.forEach((r) => { if (r.customerName) set.add(r.customerName); });
    reelRows.forEach((r) => { if (r.customerName) set.add(r.customerName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [realRows, reelRows]);

  const jobOptions = useMemo(() => {
    const set = new Set();
    realRows.forEach((r) => { if (r.jobDescription) set.add(r.jobDescription); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [realRows]);

  // Machine names, drawn from the same machiness[].machineId.machineName shape
  // used throughout the rest of this file.
  const machineOptions = useMemo(() => {
    const set = new Set();
    realRows.forEach((r) => {
      (r.machiness || []).forEach((p) => { if (p.machineId?.machineName) set.add(p.machineId.machineName); });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [realRows]);

  // User locations — same `userLocations` field as the Production Entry page's
  // location filter (item.userLocations).
  const locationOptions = useMemo(() => {
    const set = new Set();
    realRows.forEach((r) => { (r.userLocations || []).forEach((loc) => { if (loc) set.add(loc); }); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [realRows]);

  // Global WO# / Customer / Job filter — applied to the raw source rows so every
  // tab (Overview, Utilization, Production & Waste, Ledger, Job Completion,
  // Customers, Reel Register, Production Entry Activity, Stage Tracker) sees the
  // same filtered dataset, not just the Work Order Ledger tab.
  const filteredRealRows = useMemo(() => {
    const q = normWO(search).toLowerCase();
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;
    return realRows.filter((row) => {
      if (selectedCustomers.length && !selectedCustomers.includes(row.customerName || "")) return false;
      if (selectedJobs.length && !selectedJobs.includes(row.jobDescription || "")) return false;

      if (selectedMachines.length) {
        const rowMachines = (row.machiness || []).map((p) => p.machineId?.machineName).filter(Boolean);
        if (!rowMachines.some((m) => selectedMachines.includes(m))) return false;
      }

      if (selectedLocations.length) {
        const rowLocations = row.userLocations || [];
        if (!rowLocations.some((l) => selectedLocations.includes(l))) return false;
      }

      if (fromDate || toDate) {
        const dStr = dateOnly(row.productionDate);
        const rowDate = dStr ? new Date(dStr) : null;
        if (!rowDate) return false;
        if (fromDate && rowDate < fromDate) return false;
        if (toDate && rowDate > toDate) return false;
      }

      if (q) {
        const wo = String(row.workOrder || "").toLowerCase();
        const cust = String(row.customerName || "").toLowerCase();
        const job = String(row.jobDescription || "").toLowerCase();
        if (!wo.includes(q) && !cust.includes(q) && !job.includes(q)) return false;
      }
      return true;
    });
  }, [realRows, search, selectedCustomers, selectedJobs, selectedMachines, selectedLocations, dateFrom, dateTo]);

  // Reel Register rows have no job field, so a job filter narrows them via the
  // set of work orders that already passed the job filter on the production log.
  const matchingWOSet = useMemo(
    () => new Set(filteredRealRows.map((r) => String(r.workOrder || "").trim()).filter(Boolean)),
    [filteredRealRows]
  );

  // Reel rows carry no machine/location/date fields of their own, so those
  // filters narrow reel rows the same way the job filter already does: via
  // the set of work orders that passed those filters on the production log.
  const hasWOGatingFilters =
    selectedJobs.length > 0 || selectedMachines.length > 0 || selectedLocations.length > 0 || Boolean(dateFrom) || Boolean(dateTo);

  const filteredReelRows = useMemo(() => {
    const q = normWO(search).toLowerCase();
    return reelRows.filter((row) => {
      if (selectedCustomers.length && !selectedCustomers.includes(row.customerName || "")) return false;
      const wo = String(row.efiWoNumber || "").trim();
      if (q) {
        const woLower = wo.toLowerCase();
        const cust = String(row.customerName || "").toLowerCase();
        if (!woLower.includes(q) && !cust.includes(q)) return false;
      }
      if (hasWOGatingFilters && (!wo || !matchingWOSet.has(wo))) return false;
      return true;
    });
  }, [reelRows, search, selectedCustomers, hasWOGatingFilters, matchingWOSet]);

  const hasActiveFilters =
    Boolean(search) || selectedCustomers.length > 0 || selectedJobs.length > 0 ||
    selectedMachines.length > 0 || selectedLocations.length > 0 || Boolean(dateFrom) || Boolean(dateTo);

  const resetFilters = () => {
    setSearch("");
    setSelectedCustomers([]);
    setSelectedJobs([]);
    setSelectedMachines([]);
    setSelectedLocations([]);
    setDateFrom("");
    setDateTo("");
  };

  // useDeferredValue lets React keep the previous (stale) dashboard data on
  // screen — and keep checkbox clicks feeling instant — while it computes the
  // new one in a lower-priority pass, instead of blocking the click's own
  // render with the full recompute synchronously.
  const deferredRealRows = useDeferredValue(filteredRealRows);
  const deferredReelRows = useDeferredValue(filteredReelRows);
  const data = useMemo(() => buildDashboardData(deferredRealRows, deferredReelRows), [deferredRealRows, deferredReelRows]);

  const openWO = (wo) => setDrawerWO(wo);
  const trackWO = (wo) => {
    setTrackerWO(wo);
    setDrawerWO(null);
    setTab("tracker");
  };

  // The WO#/customer/job box filters every tab live as you type — it no longer
  // forces a jump to the Stage Tracker tab, since that would hide the filtered
  // view on whichever tab you're actually on. Use "Track sequence" (Ledger,
  // Reel Register, or the WO drawer) to open a specific work order's sequence.
  const onSearchChange = (value) => {
    setSearch(value);
  };

  const handleGlobalSearch = (e) => {
    e.preventDefault();
  };

  if (loading) {
    return (
      <div className="portal-universe" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GlobalStyles />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 50, height: 50, border: "4px solid #e2e8f0", borderTop: "4px solid #0284c7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ fontWeight: 800, color: COLORS.ink, fontSize: 15 }}>Connecting to Shop Floor API Feeds…</p>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-universe" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GlobalStyles />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", maxWidth: 380 }}>
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: 16, borderRadius: "50%" }}>
            <AlertTriangle size={32} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 900, color: COLORS.ink, margin: 0 }}>Failed to Load Shop Floor Data</h3>
          <p style={{ color: COLORS.slate, fontSize: 13, margin: 0 }}>{error}</p>
          <button onClick={fetchAll} className="btn-3d btn-3d-primary">Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-universe">
      <GlobalStyles />

      <header className="portal-header-3d">
        <div className="header-top-row">
       

          <div className="controls-group no-print">
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="btn-3d btn-3d-secondary btn-3d-sm">
                <X size={13} /> Clear filters
              </button>
            )}
            {/* <button type="button" onClick={fetchAll} title={`Last synced: ${lastSyncTime.toLocaleTimeString()}`} className="btn-3d btn-3d-primary">
              <RefreshCw size={14} /> Refresh
            </button> */}
          </div>
        </div>

              <div className="filters-row no-print">
          <div className="filter-field">
            <label className="filter-label" htmlFor="portal-quick-search">Search WO</label>
            <form onSubmit={handleGlobalSearch} className="search-container">
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#020408" }} />
              <input id="portal-quick-search" name="portalQuickSearch" autoComplete="off" value={search} onChange={(e) => onSearchChange(e.target.value)} type="text" placeholder="Search WO#" />
            </form>
          </div>
          <div className="filter-field">
            <span className="filter-label">Customers</span>
            <MultiSelectDropdown
              label="Customers" options={customerOptions} selected={selectedCustomers} onChange={setSelectedCustomers}
              isOpen={openFilter === "customers"} onToggle={(o) => setOpenFilter(o ? "customers" : null)}
            />
          </div>
          <div className="filter-field">
            <span className="filter-label">Jobs</span>
            <MultiSelectDropdown
              label="Jobs" options={jobOptions} selected={selectedJobs} onChange={setSelectedJobs}
              isOpen={openFilter === "jobs"} onToggle={(o) => setOpenFilter(o ? "jobs" : null)}
            />
          </div>
          <div className="filter-field">
            <span className="filter-label">Machines</span>
            <MultiSelectDropdown
              label="Machines" options={machineOptions} selected={selectedMachines} onChange={setSelectedMachines}
              isOpen={openFilter === "machines"} onToggle={(o) => setOpenFilter(o ? "machines" : null)}
            />
          </div>
          <div className="filter-field">
            <span className="filter-label">Locations</span>
            <MultiSelectDropdown
              label="Locations" options={locationOptions} selected={selectedLocations} onChange={setSelectedLocations} width={190}
              isOpen={openFilter === "locations"} onToggle={(o) => setOpenFilter(o ? "locations" : null)}
            />
          </div>
          <div className="date-range-group">
            <div className="filter-field">
              <label className="filter-label" htmlFor="portal-date-from">From Date</label>
              <input id="portal-date-from" name="portalDateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="select-3d" title="From date" />
            </div>
            {/* <span className="date-sep" style={{ color: COLORS.slate, fontWeight: 700, fontSize: 12 }}>to</span> */}
            <div className="filter-field">
              <label className="filter-label" htmlFor="portal-date-to">To Date</label>
              <input id="portal-date-to" name="portalDateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="select-3d" title="To date" />
            </div>
          </div>
        </div>

        <nav className="nav-tabs-3d lp-scroll no-print">
          {TABS.map((t) => <TabButton key={t.id} {...t} active={tab === t.id} onClick={setTab} />)}
        </nav>
      </header>

      <main>
        <KpiBanner data={data} />
        {tab === "overview" && <OverviewTab data={data} />}
        {tab === "reel" && <ReelTab data={data} openWO={openWO} />}
        {tab === "tracker" && <StageTrackerTab data={data} wo={trackerWO} setWo={setTrackerWO} openWO={openWO} />}
        {tab === "utilization" && <UtilizationTab data={data} />}
        {tab === "prodwaste" && <ProdWasteTab data={data} />}
        {tab === "ledger" && <LedgerTab data={data} search={search} openWO={openWO} trackWO={trackWO} />}
        {tab === "jobperf" && <JobCompletionTab data={data} openWO={openWO} />}
        {tab === "customers" && <CustomersTab data={data} />}
        {tab === "perso" && <PersoTab data={data} />}
      </main>

      <footer style={{ padding: "18px 4px", fontSize: 11, color: COLORS.slate, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span>Built live from ProductionReal and Reel Register (Production) source data. Refreshes on demand.</span>
        <span>{data.overview.totalWorkOrders.toLocaleString("en-IN")} work orders logged</span>
      </footer>

      {drawerWO && <StageDrawer wo={drawerWO} data={data} onClose={() => setDrawerWO(null)} onTrack={trackWO} />}
    </div>
  );
}