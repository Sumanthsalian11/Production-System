import { useEffect, useState, useMemo, useRef, Fragment } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

// ---------- caches: dates/times repeat heavily, so parse each distinct string once ----------
const dateCache = new Map();
const parseDateCached = (str) => {
  let v = dateCache.get(str);
  if (v === undefined) {
    const ms = new Date(str).getTime();
    v = {
      ms,
      key: Number.isNaN(ms) ? null : new Date(ms).toISOString().split("T")[0]
    };
    dateCache.set(str, v);
  }
  return v;
};

const minutesCache = new Map();
const getTimeDiff = (from, to) => {
  if (!from || !to) return 0;
  const ck = from + "|" + to;
  let v = minutesCache.get(ck);
  if (v !== undefined) return v;

  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const fromMinutes = fh * 60 + fm;
  let toMinutes = th * 60 + tm;
  if (toMinutes <= fromMinutes) toMinutes += 24 * 60;

  v = toMinutes - fromMinutes;
  minutesCache.set(ck, v);
  return v;
};

const joinUnique = (arr) => [...new Set((arr || []).filter(Boolean))].join(", ");

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

// Keep only what the page reads + precomputed values (used for the stage-wise tree of one work order)
const slimRecord = (item) => {
  const d = parseDateCached(item.productionDate);
  const names = (item.machiness || []).map((p) => p.machineId?.machineName);
  return {
    workOrder: item.workOrder,
    customerName: item.customerName,
    orderQty: item.orderQty,
    productionDate: item.productionDate,
    productionFromTime: item.productionFromTime,
    productionToTime: item.productionToTime,
    productionQty: item.productionQty,
    wastageQty: item.wastageQty,
    wastePercent: item.wastePercent,
    machineStatus: item.machineStatus,
    userLocations: item.userLocations,
    productType: item.productType,
    createdAt: item.createdAt,
    _pairs: (item.machiness || []).map((p) => ({
      act: String(p.activityId?._id || p.activityId || ""),
      actName: p.activityId?.activityName || "",
      machine: p.machineId?.machineName || "Unassigned"
    })),
    // precomputed
    _woLower: String(item.workOrder).toLowerCase(),
    _cust: item.customerName?.trim(),
    _dateMs: d.ms,
    _dateKey: d.key,
    _createdMs:
      item.machineStatus === "PRODUCTION" ? new Date(item.createdAt).getTime() : 0,
    _minutes: getTimeDiff(item.productionFromTime, item.productionToTime),
    _names: names,
    _namesLower: names.map((n) => n?.toLowerCase())
  };
};

// Stable top-N (same result as sort(cmp).slice(0, n), without sorting everything)
const topN = (arr, n, cmp) => {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    if (out.length === n && !(cmp(x, out[n - 1]) < 0)) continue;
    let pos = out.length;
    for (let j = 0; j < out.length; j++) {
      if (cmp(x, out[j]) < 0) {
        pos = j;
        break;
      }
    }
    out.splice(pos, 0, x);
    if (out.length > n) out.pop();
  }
  return out;
};

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const useDebounced = (value, delay = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

function ProductionReport() {
  const [summary, setSummary] = useState({ kpi: {}, jobs: [], util: [], machineOrder: [], customers: [], locations: [] });
  const [woRows, setWoRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const token = localStorage.getItem("token");
  const [machines, setMachines] = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [searchWO, setSearchWO] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [fromDate, setFromDate] = useState(monthStart()); // first load = current month only
  const [toDate, setToDate] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [expandedHeader, setExpandedHeader] = useState(null);
  const [usedMachines, setUsedMachines] = useState([]);
  const [wastageVisible, setWastageVisible] = useState(50);
  const [itemStages, setItemStages] = useState([]);
  const [woDetail, setWoDetail] = useState(null);
  const [activities, setActivities] = useState([]);
  const reqId = useRef(0);
  const debouncedSearchWO = useDebounced(searchWO, 300);

  // ---------- Detail Records (from ProductionReal) ----------
  const DETAIL_PAGE_SIZE = 50;
  const [detailRows, setDetailRows] = useState([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);

  // back to page 1 whenever a filter changes
  useEffect(() => {
    setDetailPage(1);
  }, [fromDate, toDate, debouncedSearchWO, customerFilter, machineFilter, locationFilter]);

  useEffect(() => {
    let live = true;
    setDetailLoading(true);
    axios
      .get(`${BASE_URL}/api/production-real`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          from: fromDate || undefined,
          to: toDate || undefined,
          workOrder: debouncedSearchWO || undefined,
          customer: customerFilter || undefined,
          machine: machineFilter || undefined,
          location: locationFilter || undefined,
          limit: DETAIL_PAGE_SIZE,
          page: detailPage,
          withCount: 1
        }
      })
      .then((r) => {
        if (!live) return;
        const rows = Array.isArray(r.data) ? r.data : r.data.data || [];
        setDetailRows(rows);
        setDetailTotal(Array.isArray(r.data) ? rows.length : r.data.total || 0);
      })
      .catch((e) => console.error("Error fetching detail records:", e))
      .finally(() => live && setDetailLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, debouncedSearchWO, customerFilter, machineFilter, locationFilter, detailPage]);

  const normStatus = (s) => String(s || "").trim().toLowerCase();

  // one From/To/Total group per status in the Machine Status master
  const detailStatusColumns = useMemo(() => {
    const seen = new Map();
    machineStatuses.forEach((s) => {
      const k = normStatus(s.statusName);
      if (k && !seen.has(k)) seen.set(k, String(s.statusName).trim());
    });
    return [...seen].map(([key, label]) => ({ key, label }));
  }, [machineStatuses]);

  const detailTotals = useMemo(() => {
    const t = { qty: 0, waste: 0, all: 0, status: {} };
    detailRows.forEach((r) => {
      const mins = getTimeDiff(r.productionFromTime, r.productionToTime);
      t.qty += Number(r.productionQty) || 0;
      t.waste += Number(r.wastageQty) || 0;
      t.all += mins;
      const k = normStatus(r.machineStatus);
      t.status[k] = (t.status[k] || 0) + mins;
    });
    return t;
  }, [detailRows]);

  const detailTotalPages = Math.max(1, Math.ceil(detailTotal / DETAIL_PAGE_SIZE));

  // merge rows with the same Date + WO + Shift + Activity + Machine + Customer + Product Type
  const groupedRows = useMemo(() => {
    const map = new Map();
    detailRows.forEach((r) => {
      const activity = joinUnique((r.machiness || []).map((p) => p.activityId?.activityName));
      const machine = joinUnique((r.machiness || []).map((p) => p.machineId?.machineName));
      const dateKey = String(r.productionDate || "").split("T")[0];
      const key = [dateKey, r.workOrder, r.shift || "", activity, machine, (r.customerName || "").trim(), r.productType || ""].join("||");

      let g = map.get(key);
      if (!g) {
        g = {
          key,
          productionDate: r.productionDate,
          workOrder: r.workOrder,
          activity,
          machine,
          customerName: r.customerName,
          productType: r.productType,
          shifts: [],
          remarks: [],
          productionQty: 0,
          wastageQty: 0,
          totalMins: 0,
          status: {}
        };
        map.set(key, g);
      }

      const mins = getTimeDiff(r.productionFromTime, r.productionToTime);
      g.productionQty += Number(r.productionQty) || 0;
      g.wastageQty += Number(r.wastageQty) || 0;
      g.totalMins += mins;
      g.shifts.push(r.shift);
      g.remarks.push(r.remarks);

      const k = normStatus(r.machineStatus);
      const s = g.status[k] || (g.status[k] = { from: [], to: [], mins: 0 });
      if (r.productionFromTime) s.from.push(r.productionFromTime);
      if (r.productionToTime) s.to.push(r.productionToTime);
      s.mins += mins;
    });
    return [...map.values()];
  }, [detailRows]);

  const fetchProduction = async (from = fromDate, to = toDate) => {
    const id = ++reqId.current; // ignore stale responses
    setLoading(true);
    setProgress(0);

    // smooth progress (eases toward 90%) in case the server sends no total size
    const timer = setInterval(() => {
      setProgress((p) => (p < 90 ? p + (90 - p) * 0.06 : p));
    }, 200);

    try {
      const res = await axios.get(`${BASE_URL}/api/production-real/report-summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          from: from || undefined,
          to: to || undefined,
          wo: debouncedSearchWO || undefined,
          customer: customerFilter || undefined,
          machine: machineFilter || undefined,
          location: locationFilter || undefined
        },
        // real progress when the browser knows the total size
        onDownloadProgress: (e) => {
          if (e.total && id === reqId.current) {
            const real = Math.min(90, (e.loaded / e.total) * 90);
            setProgress((p) => Math.max(p, real));
          }
        }
      });
      if (id !== reqId.current) return;

      setSummary(res.data);
      setLocationOptions(res.data.locations || []);
      setProgress(100);
      // let the bar show 100% for a moment before the overlay closes
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.log(err);
    } finally {
      clearInterval(timer);
      if (id === reqId.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, debouncedSearchWO, customerFilter, machineFilter, locationFilter]);

  // stage-wise tree: load only this work order's rows when opened
  useEffect(() => {
    if (woDetail === null) {
      setWoRows([]);
      return;
    }
    let live = true;
    axios
      .get(`${BASE_URL}/api/production-real`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { workOrderExact: woDetail, machineStatus: "PRODUCTION" }
      })
      .then((r) => {
        if (live) setWoRows((r.data || []).map(slimRecord));
      })
      .catch((e) => console.error(e));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [woDetail]);

  useEffect(() => {
    fetchMachines();
    fetchMachineStatuses();
    fetchItemStages();
    fetchActivities();
  }, []);

  const clearFilters = () => {
    setSearchWO("");
    setCustomerFilter("");
    setMachineFilter("");
    setFromDate(monthStart());
    setToDate("");
    setLocationFilter("");
  };

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/machines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMachines(res.data || []);
    } catch (err) {
      console.error("Error fetching machines:", err);
    }
  };

  const fetchMachineStatuses = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/machine-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMachineStatuses(res.data || []);
    } catch (err) {
      console.error("Error fetching machine statuses:", err);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/activities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(res.data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    }
  };

  const fetchItemStages = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/item-stages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItemStages(res.data || []);
    } catch (err) {
      console.error("Error fetching item stages:", err);
    }
  };

  // Item Stages master: product type -> rank of each activity in its stage order
  const stageRankByType = useMemo(() => {
    const map = new Map();
    itemStages.forEach((rec) => {
      const key = String(rec.itemName || "").trim().toUpperCase();
      if (!key || !rec.stages?.length) return;
      const rank = new Map();
      [...rec.stages]
        .sort((a, b) => a.order - b.order)
        .forEach((s, idx) => {
          const id = String(s.activityId?._id || s.activityId || "");
          if (id) rank.set(id, idx);
        });
      map.set(key, rank);
    });
    return map;
  }, [itemStages]);

  // ================= SERVER SUMMARY (filters are applied in MongoDB) =================

  // ================= USED MACHINES: earliest-seen timestamp per machine =================
  const machineFirstSeen = useMemo(() => new Map(summary.machineOrder || []), [summary]);

  useEffect(() => {
    setUsedMachines(
      [...machineFirstSeen.keys()].sort(
        (a, b) => machineFirstSeen.get(a) - machineFirstSeen.get(b)
      )
    );
  }, [machineFirstSeen]);

  const customers = summary.customers || [];

  // ================= JOB-LEVEL AGGREGATION (sums come from the server) =================
  const jobAggregates = useMemo(() => {
    const map = {};
    (summary.jobs || []).forEach((e) => {
      map[e.workOrder] = e;
    });

    // figure shown per work order: last-stage entry if matched, else latest entry
    Object.values(map).forEach((e) => {
      const rankMap = stageRankByType.get(String(e.productType || "").trim().toUpperCase());
      let lastActId = null;
      if (rankMap) {
        let best = -1;
        Object.keys(e.byActivity).forEach((a) => {
          const r = rankMap.get(a);
          if (r !== undefined && r > best) {
            best = r;
            lastActId = a;
          }
        });
      }
      const machinesInLast = lastActId ? e.byActivity[lastActId] : null;
      if (machinesInLast) {
        let p = 0;
        let w = 0;
        Object.values(machinesInLast).forEach((m) => {
          p += m.production;
          w += m.wastage;
        });
        e.finalProduction = p;
        e.finalWastage = w;
      } else {
        e.finalProduction = e.latestProduction;
        e.finalWastage = e.latestWastage;
      }
    });

    return map;
  }, [summary, stageRankByType]);

  const jobPerformance = useMemo(
    () =>
      Object.values(jobAggregates).map((j) => ({
        workOrder: j.workOrder,
        customer: j.customer,
        orderQty: j.orderQty,
        production: j.finalProduction
      })),
    [jobAggregates]
  );

  const jobMachinePerformance = useMemo(
    () =>
      Object.values(jobAggregates).map((j) => {
        const machines = {};
        Object.keys(j.machines).forEach((m) => {
          machines[m] = j.machines[m].production;
        });
        return {
          workOrder: j.workOrder,
          customer: j.customer,
          orderQty: j.orderQty,
          machines,
          lastMachine: j.lastMachine,
          finalProduction: j.finalProduction,
          finalWastage: j.finalWastage
        };
      }),
    [jobAggregates]
  );

  const jobWastage = useMemo(
    () =>
      Object.values(jobAggregates).map((j) => {
        const machines = {};
        Object.keys(j.machines).forEach((m) => {
          machines[m] = j.machines[m].wastage;
        });
        return {
          workOrder: j.workOrder,
          customer: j.customer,
          orderQty: j.orderQty,
          machines
        };
      }),
    [jobAggregates]
  );

  const jobWastagePercent = useMemo(
    () =>
      Object.values(jobAggregates).map((j) => {
        const machines = {};
        Object.keys(j.machines).forEach((m) => {
          machines[m] = j.machines[m].wastePercent;
        });
        return {
          workOrder: j.workOrder,
          customer: j.customer,
          orderQty: j.orderQty,
          machines
        };
      }),
    [jobAggregates]
  );

  const jobWastageMap = useMemo(() => {
    const map = new Map();
    jobWastage.forEach((w) => {
      map.set(w.workOrder, w);
    });
    return map;
  }, [jobWastage]);

  // ================= WORK ORDER PRODUCTION (memoized) =================
  const woCustomerProduction = useMemo(() => {
    const woQ = debouncedSearchWO ? debouncedSearchWO.toLowerCase() : "";
    const custQ = customerFilter ? customerFilter.trim() : "";

    return jobMachinePerformance
      .filter((job) => {
        if (woQ && !String(job.workOrder).toLowerCase().includes(woQ)) return false;
        if (custQ && job.customer?.trim() !== custQ) return false;
        return true;
      })
      .map((job) => ({
        workOrder: job.workOrder,
        customer: job.customer,
        production: job.finalProduction,
        wastage: job.finalWastage,
        orderQty: job.orderQty
      }));
  }, [jobMachinePerformance, debouncedSearchWO, customerFilter]);

  // ================= MACHINE PRODUCTION (memoized) =================
  const machineProduction = useMemo(() => {
    const acc = {};

    jobMachinePerformance.forEach((job) => {
      let matchWO = debouncedSearchWO
        ? String(job.workOrder).toLowerCase().includes(debouncedSearchWO.toLowerCase())
        : true;

      let matchCustomer = customerFilter
        ? job.customer?.trim() === customerFilter.trim()
        : true;

      let matchMachine = true;
      if (machineFilter) {
        matchMachine = Object.keys(job.machines || {}).some(
          (m) => m.toLowerCase() === machineFilter.toLowerCase()
        );
      }

      if (!(matchWO && matchCustomer && matchMachine)) return;

      const wastageForJob = jobWastageMap.get(job.workOrder);

      Object.keys(job.machines || {}).forEach((machine) => {
        const production = job.machines?.[machine] || 0;
        const wastage = wastageForJob?.machines?.[machine] || 0;

        if (!acc[machine]) {
          acc[machine] = { machine, production: 0, wastage: 0, orderQty: 0 };
        }

        acc[machine].production += Number(production);
        acc[machine].wastage += Number(wastage);

        if (production > 0 || wastage > 0) {
          acc[machine].orderQty += Number(job.orderQty || 0);
        }
      });
    });

    return Object.values(acc).filter((m) => m.production > 0 || m.wastage > 0);
  }, [jobMachinePerformance, debouncedSearchWO, customerFilter, machineFilter, jobWastageMap]);

  // ================= MACHINE UTILIZATION (from the server) =================
  const machineUtilizationDatewise = summary.util || [];

  // ================= KPI TOTALS (from the server) =================
  const kpiTotals = {
    totalOrderQty: 0,
    totalOrders: 0,
    totalProduction: 0,
    totalWastage: 0,
    ...summary.kpi
  };

  const { totalOrderQty, totalOrders, totalProduction, totalWastage } = kpiTotals;

  const avgWaste = totalProduction
    ? ((totalWastage / totalProduction) * 100).toFixed(2)
    : 0;

  // ================= MEMOIZED TOP-N VIEWS FOR RENDER =================
  const sortedJobPerformance = useMemo(
    () => topN(jobPerformance, 10, (a, b) => b.workOrder - a.workOrder),
    [jobPerformance]
  );

  const sortedJobMachinePerformance = useMemo(
    () => topN(jobMachinePerformance, 10, (a, b) => b.workOrder - a.workOrder),
    [jobMachinePerformance]
  );

  const sortedJobWastagePercent = useMemo(
    () => topN(jobWastagePercent, 10, (a, b) => b.workOrder - a.workOrder),
    [jobWastagePercent]
  );

  const sortedMachineUtilization = useMemo(
    () =>
      topN(
        machineUtilizationDatewise,
        15,
        (a, b) => parseDateCached(b.date).ms - parseDateCached(a.date).ms
      ),
    [machineUtilizationDatewise]
  );

  const fmtD = (v) => (v ? new Date(v).toLocaleDateString("en-IN") : "-");
  const fmtDT = (v) =>
    v
      ? new Date(v).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
      : "-";

  const woTree = useMemo(() => {
    if (woDetail === null) return null;
    const rows = woRows;
    if (!rows.length) return null;

    const typeKey = String(rows.find((r) => r.productType)?.productType || "")
      .trim()
      .toUpperCase();

    let latestMs = -1;
    rows.forEach((r) => {
      if (r._createdMs > latestMs) latestMs = r._createdMs;
    });

    const acts = new Map();
    const recentActs = new Set();
    const recentKeys = new Set();

    rows.forEach((r) => {
      const prod = Number(r.productionQty) || 0;
      r._pairs.forEach(({ act, actName, machine }) => {
        if (!act) return;
        let a = acts.get(act);
        if (!a) {
          a = { id: act, name: "", qty: 0, lastMs: -1, prodDate: null, entryDate: null, machines: new Map() };
          acts.set(act, a);
        }
        if (actName && !a.name) a.name = actName;
        a.qty += prod;
        if (r._createdMs >= a.lastMs) {
          a.lastMs = r._createdMs;
          a.prodDate = r.productionDate;
          a.entryDate = r.createdAt;
        }
        let m = a.machines.get(machine);
        if (!m) {
          m = { name: machine, qty: 0, lastMs: -1, prodDate: null, entryDate: null };
          a.machines.set(machine, m);
        }
        m.qty += prod;
        if (r._createdMs >= m.lastMs) {
          m.lastMs = r._createdMs;
          m.prodDate = r.productionDate;
          m.entryDate = r.createdAt;
        }
        if (r._createdMs === latestMs) {
          recentActs.add(act);
          recentKeys.add(act + "|" + machine);
        }
      });
    });

    // stages from Item Stages (in order); activities not in the list are added at the end
    const rec = itemStages.find(
      (s) => String(s.itemName || "").trim().toUpperCase() === typeKey
    );
    let stages = [];
    if (rec?.stages?.length) {
      stages = [...rec.stages]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          id: String(s.activityId?._id || s.activityId || ""),
          name: s.activityId?.activityName || ""
        }));
    }
    const listed = new Set(stages.map((s) => s.id));
    [...acts.values()]
      .filter((a) => !listed.has(a.id))
      .sort((a, b) => a.lastMs - b.lastMs)
      .forEach((a) => stages.push({ id: a.id, name: a.name }));

    const first = rows[0];
    return {
      workOrder: woDetail,
      customer: first.customerName,
      orderQty: first.orderQty,
      productType: rows.find((r) => r.productType)?.productType || "-",
      total: jobAggregates[woDetail]?.finalProduction ?? 0,
      stages: stages.map((s, i) => {
        const a = acts.get(s.id);
        return {
          id: s.id,
          label:
            activities.find((x) => String(x._id) === s.id)?.activityName ||
            s.name ||
            a?.name ||
            `Stage ${i + 1}`,
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
      })
    };
  }, [woDetail, woRows, itemStages, jobAggregates, activities]);

  useEffect(() => setWastageVisible(50), [jobWastage]);

  // ================= EXCEL EXPORT =================
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    /* KPI */
    const kpiData = [
      {
        "Total Orders": totalOrders,
        "Total Production": totalProduction,
        "Total Wastage": totalWastage,
        "Average Waste %": avgWaste
      }
    ];
    const kpiSheet = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, kpiSheet, "KPI");

    /* JOB PERFORMANCE */
    const jobPerfData = jobPerformance.map((j) => ({
      "WO No": j.workOrder,
      Customer: j.customer,
      "Order Qty": j.orderQty,
      Production: j.production,
      "Completion %": ((j.production / j.orderQty) * 100).toFixed(2)
    }));

    const jobPerfSheet = XLSX.utils.json_to_sheet(jobPerfData);
    XLSX.utils.book_append_sheet(wb, jobPerfSheet, "Job Performance");

    /* JOB MACHINE PERFORMANCE */
    const jobMachineData = jobMachinePerformance.map((j) => {
      let row = {
        "WO No": j.workOrder,
        Customer: j.customer,
        "Order Qty": j.orderQty
      };

      Object.keys(j.machines || {}).forEach((machine) => {
        const value = j.machines?.[machine];
        if (value > 0) {
          row[machine + " Production"] = value;
        }
      });
      return row;
    });

    const jobMachineSheet = XLSX.utils.json_to_sheet(jobMachineData);
    XLSX.utils.book_append_sheet(wb, jobMachineSheet, "Job Machine Performance");

    /* JOB WASTAGE */
    const jobWastageData = jobWastage.map((j) => {
      let row = {
        "WO No": j.workOrder,
        Customer: j.customer,
        "Order Qty": j.orderQty
      };

      Object.keys(j.machines || {}).forEach((machine) => {
        const value = j.machines?.[machine];
        if (value > 0) {
          row[machine + " Wastage"] = value;
        }
      });
      return row;
    });

    const jobWastageSheet = XLSX.utils.json_to_sheet(jobWastageData);
    XLSX.utils.book_append_sheet(wb, jobWastageSheet, "Job Wastage");

    /* JOB WASTAGE % */
    const jobWastePercentData = jobWastagePercent.map((j) => {
      let row = {
        "WO No": j.workOrder,
        Customer: j.customer,
        "Order Qty": j.orderQty
      };

      Object.keys(j.machines || {}).forEach((machine) => {
        const value = j.machines?.[machine];
        if (value > 0) {
          row[machine + " Waste %"] = value.toFixed(2);
        }
      });
      return row;
    });

    const jobWastePercentSheet = XLSX.utils.json_to_sheet(jobWastePercentData);
    XLSX.utils.book_append_sheet(wb, jobWastePercentSheet, "Job Waste %");

    /* MACHINE PRODUCTION */
    const machineProdData = machineProduction.map((m) => {
      const percent = m.production
        ? ((m.wastage / m.production) * 100).toFixed(2)
        : 0;

      return {
        Machine: m.machine,
        Production: m.production,
        Wastage: m.wastage,
        "Order Qty": m.orderQty,
        "Wastage %": percent
      };
    });

    const machineProdSheet = XLSX.utils.json_to_sheet(machineProdData);
    XLSX.utils.book_append_sheet(wb, machineProdSheet, "Machine Production");

    /* WORK ORDER PRODUCTION */
    const woProductionData = woCustomerProduction.map((m) => {
      const percent = m.production
        ? ((m.wastage / m.production) * 100).toFixed(2)
        : 0;

      return {
        "Work Order": m.workOrder,
        Customer: m.customer,
        Production: m.production,
        Wastage: m.wastage,
        "Wastage %": percent
      };
    });

    const woProductionSheet = XLSX.utils.json_to_sheet(woProductionData);
    XLSX.utils.book_append_sheet(wb, woProductionSheet, "WO Production");

    /* MACHINE UTILIZATION */
    const machineUtilData = machineUtilizationDatewise.map((m) => {
      let row = {
        Date: m.date,
        Machine: m.machine
      };

      machineStatuses.forEach((s) => {
        row[s.statusName] = formatTime(m[s.statusName] || 0);
      });

      const productionMinutes = m["PRODUCTION"] || 0;
      const productionHours = productionMinutes / 60;

      row["Utilization %"] = ((productionHours / 24) * 100).toFixed(2);
      return row;
    });

    const machineUtilSheet = XLSX.utils.json_to_sheet(machineUtilData);
    XLSX.utils.book_append_sheet(wb, machineUtilSheet, "Machine Utilization");

    /* DOWNLOAD */
    XLSX.writeFile(wb, "Production_Report.xlsx");
  };

  return (
    <div
      className="container production-report-universe"
      style={{
        maxWidth: "100%",
        fontSize: "14px",
        background: "#ffffff",
        border: "1px solid rgba(12, 90, 130, 0.38)",
        borderRadius: "0px"
      }}
    >
      {/* ======================================================================
          🎨 INTEGRATED STYLES MATCHING THE OVERALL SYSTEM THEME
          ====================================================================== */}
      <style>{`
        .production-report-universe {
          min-height: 100vh;
          padding: 18px;
          color: #08283d;
          background: #ffffff !important;
        }

        .production-report-universe .report-hero-title {
          color: #06324d;
          letter-spacing: 0;
          font-size: 28px;
          font-weight: 800;
          text-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .production-report-universe .card {
          border: 1px solid rgba(20, 111, 156, 0.42) !important;
          border-radius: 12px !important;
          background: rgba(221, 243, 252, 0.94) !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 12px 28px rgba(14, 86, 122, 0.22) !important;
        }

        .production-report-universe h5,
        .production-report-universe h6 {
          color: #062b42 !important;
          font-weight: 800;
          padding: 6px 0;
        }

        .production-report-universe .form-label {
          color: #092f47 !important;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .production-report-universe .form-control,
        .production-report-universe .form-select {
          min-height: 38px;
          border: 1px solid rgba(14, 94, 135, 0.62) !important;
          border-radius: 8px;
          background-color: rgba(255, 255, 255, 0.98) !important;
          color: #071f31;
          font-weight: 600;
          box-shadow: inset 0 1px 2px rgba(8, 55, 83, 0.08);
        }

        .production-report-universe .form-control:focus,
        .production-report-universe .form-select:focus {
          border-color: #087fb5 !important;
          box-shadow: 0 0 0 3px rgba(8, 127, 181, 0.22) !important;
        }

        .production-report-universe .btn {
          border: 0;
          border-radius: 8px;
          font-weight: 700;
          min-height: 38px;
          box-shadow: 0 7px 15px rgba(10, 78, 115, 0.24);
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }

        .production-report-universe .btn:active {
          transform: translateY(2px);
          box-shadow: 0 2px 6px rgba(10, 78, 115, 0.2);
        }

        .production-report-universe .btn-primary {
          background: linear-gradient(135deg, #0877ad, #16a4dc) !important;
          color: #ffffff !important;
        }

        .production-report-universe .btn-danger {
          background: linear-gradient(135deg, #e05252, #ff7b7b) !important;
          color: #ffffff !important;
        }

        .production-report-universe .card-header {
          border: 0;
          border-radius: 12px 12px 0 0 !important;
          background: #a9dcf3 !important;
          color: #06324d !important;
          padding: 12px 16px;
        }

        .production-report-universe .table-responsive {
          background: #ffffff !important;
          border-radius: 0 0 12px 12px;
        }

        .production-report-universe table {
          color: #09283d;
          background: #ffffff;
        }

        .production-report-universe thead th {
          background: #bfe6f8 !important;
          color: #06324d !important;
          border-color: rgba(20, 111, 156, 0.25) !important;
          font-size: 13px;
          vertical-align: middle;
          white-space: nowrap;
          text-align: center;
        }

        .production-report-universe tbody td {
          border-color: rgba(20, 93, 130, 0.28) !important;
          vertical-align: middle;
          text-align: center;
          font-weight: 500;
        }

        .production-report-universe tbody tr:hover td {
          background: #d9f2fc !important;
        }

        /* 3D Elevated KPI Tiles */
        .kpi-tile-3d {
          background: rgba(255, 255, 255, 0.95);
          border: 1px solid rgba(20, 111, 156, 0.35);
          border-radius: 14px;
          padding: 18px 14px;
          text-align: center;
          flex: 1;
          box-shadow: 
            0 8px 18px rgba(14, 86, 122, 0.15),
            inset 0 1px 0 #ffffff;
          transition: transform 0.15s ease;
        }

        .kpi-tile-3d:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(14, 86, 122, 0.22);
        }

        .kpi-title-label {
          font-size: 12px;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 4px;
        }

        .kpi-number-stat {
          font-size: 26px;
          font-weight: 900;
          color: #06324d;
          letter-spacing: -0.5px;
        }

        /* ── PAGE ANIMATIONS ── */
        @keyframes prFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes prRowIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes prKpiPop {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Sections slide up one after the other:
           1 = filters, 2 = KPI row, 3-9 = the seven table cards */
        .production-report-universe > div:nth-of-type(1) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
        }

        .production-report-universe > div:nth-of-type(2) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.12s backwards;
        }

        .production-report-universe > div:nth-of-type(3) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.24s backwards;
        }

        .production-report-universe > div:nth-of-type(4) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.34s backwards;
        }

        .production-report-universe > div:nth-of-type(5) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.44s backwards;
        }

        .production-report-universe > div:nth-of-type(6) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.54s backwards;
        }

        .production-report-universe > div:nth-of-type(7) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.64s backwards;
        }

        .production-report-universe > div:nth-of-type(8) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.74s backwards;
        }

        .production-report-universe > div:nth-of-type(9) {
          animation: prFadeUp 0.55s cubic-bezier(0.22, 0.8, 0.3, 1) 0.84s backwards;
        }

        /* KPI tiles pop in one by one */
        .kpi-tile-3d {
          animation: prKpiPop 0.5s cubic-bezier(0.22, 0.8, 0.3, 1) backwards;
        }

        .kpi-tile-3d:nth-child(1) { animation-delay: 0.20s; }
        .kpi-tile-3d:nth-child(2) { animation-delay: 0.28s; }
        .kpi-tile-3d:nth-child(3) { animation-delay: 0.36s; }
        .kpi-tile-3d:nth-child(4) { animation-delay: 0.44s; }

        /* Table rows fade in with a short stagger */
        .production-report-universe tbody tr {
          animation: prRowIn 0.4s ease-out backwards;
        }

        .production-report-universe tbody tr:nth-child(1)  { animation-delay: 0.30s; }
        .production-report-universe tbody tr:nth-child(2)  { animation-delay: 0.34s; }
        .production-report-universe tbody tr:nth-child(3)  { animation-delay: 0.38s; }
        .production-report-universe tbody tr:nth-child(4)  { animation-delay: 0.42s; }
        .production-report-universe tbody tr:nth-child(5)  { animation-delay: 0.46s; }
        .production-report-universe tbody tr:nth-child(6)  { animation-delay: 0.50s; }
        .production-report-universe tbody tr:nth-child(7)  { animation-delay: 0.54s; }
        .production-report-universe tbody tr:nth-child(8)  { animation-delay: 0.58s; }
        .production-report-universe tbody tr:nth-child(9)  { animation-delay: 0.62s; }
        .production-report-universe tbody tr:nth-child(10) { animation-delay: 0.66s; }
        .production-report-universe tbody tr:nth-child(n+11) { animation-delay: 0.70s; }

        .production-report-universe .dt-table td.left { text-align: left; }
        .production-report-universe .dt-table td.mono { font-variant-numeric: tabular-nums; }
        .production-report-universe .dt-table th.dt-group { background: #a9dcf3 !important; }
        .production-report-universe .dt-table tfoot td {
          background: #bfe6f8 !important; color: #06324d; font-weight: 800;
        }
        .production-report-universe .dt-muted { color: #94a3b8; }

        /* Respect users who prefer no motion */
        @media (prefers-reduced-motion: reduce) {
          .production-report-universe > div,
          .kpi-tile-3d,
          .production-report-universe tbody tr {
            animation: none !important;
          }
        }

        @media (max-width: 768px) {
          .production-report-universe {
            padding: 12px;
            border-radius: 14px !important;
          }

          .production-report-universe .report-hero-title {
            font-size: 23px;
          }

          .kpi-row-flex {
            flex-direction: column !important;
          }
        }
      `}</style>

      {/* ======================================================================
          FILTER BAR CARD
          ====================================================================== */}
      <div className="card shadow-lg p-3 mb-4">
        <h5 className="mb-2" style={{ color: "#06324d" }}>
          Filters
        </h5>

        <div className="row g-2">
          <div className="col-md-2">
            <label className="form-label">WO Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search WO"
              value={searchWO}
              onChange={(e) => setSearchWO(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">Customer Name</label>
            <select
              className="form-select"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label">Machine</label>
            <select
              className="form-select"
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
            >
              <option value="">All Machines</option>
              {machines.map((m) => (
                <option key={m._id} value={m.machineName}>
                  {m.machineName}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-2">
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label">User Location</label>
            <select
              className="form-select"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All Locations</option>
              {locationOptions.map((loc, i) => (
                <option key={i} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-2 d-flex align-items-end mt-2">
            <button className="btn btn-danger w-100" onClick={clearFilters}>
              Clear
            </button>
          </div>
  <div className="col-md-2 d-flex align-items-end mt-2">
          <button className="btn btn-primary px-4" onClick={exportExcel}>
            Export Excel
          </button>
        </div>
        </div>
      </div>

      {/* ======================================================================
          3D KPI METRIC TILES
          ====================================================================== */}
      <div className="d-flex gap-3 flex-nowrap kpi-row-flex mb-4">
        <div className="kpi-tile-3d">
          <div className="kpi-title-label">Total Orders</div>
          <div className="kpi-number-stat">{totalOrders}</div>
        </div>

        <div className="kpi-tile-3d">
          <div className="kpi-title-label">Total Production</div>
          <div className="kpi-number-stat">
            {totalProduction.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="kpi-tile-3d">
          <div className="kpi-title-label">Total Wastage</div>
          <div className="kpi-number-stat">
            {totalWastage.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="kpi-tile-3d">
          <div className="kpi-title-label">Average Waste %</div>
          <div className="kpi-number-stat text-danger">{avgWaste}%</div>
        </div>
      </div>

      {/* ======================================================================
          TABLE 1: JOB PERFORMANCE
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Job Performance</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "280px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th>WO No</th>
                <th>Customer</th>
                <th>Order Qty</th>
                <th>Production Qty</th>
                <th>Completion %</th>
              </tr>
            </thead>

            <tbody>
              {sortedJobPerformance.map((j, i) => {
                const completion = (
                  (j.production / j.orderQty) *
                  100
                ).toFixed(2);

                return (
                  <tr
                    key={i}
                    style={{ cursor: "pointer" }}
                    title="Double-click to see stage-wise details"
                    onDoubleClick={() => setWoDetail(j.workOrder)}
                  >
                    <td className="fw-bold">#{j.workOrder}</td>
                    <td className="fw-semibold">{j.customer}</td>
                    <td>
                      {j.orderQty ? j.orderQty.toLocaleString("en-IN") : "-"}
                    </td>
                    <td className="fw-bold">
                      {j.production
                        ? j.production.toLocaleString("en-IN")
                        : "-"}
                    </td>
                    <td className="fw-bold text-success">{completion}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          TABLE 2: JOBWISE MACHINE PERFORMANCE
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Jobwise Machine Performance</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "280px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th>WO No</th>
                <th>Customer</th>
                <th>Order Qty</th>

                {usedMachines.map((machine) => (
                  <th key={machine} style={{ minWidth: "170px" }}>
                    <span
                      title={machine}
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        maxWidth:
                          expandedHeader === machine + "prod"
                            ? "400px"
                            : "110px",
                        whiteSpace:
                          expandedHeader === machine + "prod"
                            ? "normal"
                            : "nowrap",
                        wordBreak: "break-word",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                      onClick={() =>
                        setExpandedHeader(
                          expandedHeader === machine + "prod"
                            ? null
                            : machine + "prod"
                        )
                      }
                    >
                      {machine} Production
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedJobMachinePerformance.map((j, i) => {
                return (
                  <tr key={i}>
                    <td className="fw-bold">#{j.workOrder}</td>
                    <td style={{ maxWidth: "150px" }}>
                      <span
                        title={j.customer}
                        style={{
                          cursor: "pointer",
                          display: "inline-block",
                          maxWidth:
                            expandedHeader === j.workOrder + "customer"
                              ? "300px"
                              : "100px",
                          whiteSpace:
                            expandedHeader === j.workOrder + "customer"
                              ? "normal"
                              : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          wordBreak: "break-word"
                        }}
                        onClick={() =>
                          setExpandedHeader(
                            expandedHeader === j.workOrder + "customer"
                              ? null
                              : j.workOrder + "customer"
                          )
                        }
                      >
                        {j.customer}
                      </span>
                    </td>
                    <td>{j.orderQty.toLocaleString("en-IN")}</td>

                    {usedMachines.map((machine) => (
                      <td key={machine}>
                        {j.machines?.[machine] || j.machines?.[machine] === 0
                          ? Number(j.machines[machine]).toLocaleString(
                              "en-IN"
                            )
                          : "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          TABLE 3: JOBWISE WASTAGE PERFORMANCE
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Jobwise Wastage Performance</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "280px", overflowY: "auto" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
              setWastageVisible((v) => Math.min(v + 100, jobWastage.length));
            }
          }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th>WO No</th>
                <th>Customer</th>
                <th>Order Qty</th>

                {usedMachines.map((machine) => (
                  <th key={machine} style={{ maxWidth: "170px" }}>
                    <span
                      title={machine}
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        maxWidth:
                          expandedHeader === machine ? "400px" : "110px",
                        whiteSpace:
                          expandedHeader === machine ? "normal" : "nowrap",
                        wordBreak: "break-word",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                      onClick={() =>
                        setExpandedHeader(
                          expandedHeader === machine ? null : machine
                        )
                      }
                    >
                      {machine} Wastage
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {jobWastage.slice(0, wastageVisible).map((j, i) => (
                <tr key={i}>
                  <td className="fw-bold">#{j.workOrder}</td>
                  <td style={{ maxWidth: "150px" }}>
                    <span
                      title={j.customer}
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        maxWidth:
                          expandedHeader === j.workOrder + "wastageCustomer"
                            ? "300px"
                            : "100px",
                        whiteSpace:
                          expandedHeader === j.workOrder + "wastageCustomer"
                            ? "normal"
                            : "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        wordBreak: "break-word"
                      }}
                      onClick={() =>
                        setExpandedHeader(
                          expandedHeader === j.workOrder + "wastageCustomer"
                            ? null
                            : j.workOrder + "wastageCustomer"
                        )
                      }
                    >
                      {j.customer}
                    </span>
                  </td>
                  <td>{j.orderQty.toLocaleString("en-IN")}</td>

                  {usedMachines.map((machine) => (
                    <td key={machine} className="text-danger fw-bold">
                      {j.machines?.[machine] || j.machines?.[machine] === 0
                        ? j.machines[machine]
                        : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          TABLE 4: JOBWISE WASTAGE %
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Jobwise Wastage %</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "280px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th>WO No</th>
                <th>Customer</th>
                <th>Order Qty</th>

                {usedMachines.map((machine) => (
                  <th key={machine + "percent"} style={{ maxWidth: "170px" }}>
                    <span
                      title={machine}
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        maxWidth:
                          expandedHeader === machine + "percent"
                            ? "400px"
                            : "110px",
                        whiteSpace:
                          expandedHeader === machine + "percent"
                            ? "normal"
                            : "nowrap",
                        wordBreak: "break-word",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                      onClick={() =>
                        setExpandedHeader(
                          expandedHeader === machine + "percent"
                            ? null
                            : machine + "percent"
                        )
                      }
                    >
                      {machine} Waste %
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedJobWastagePercent.map((j, i) => (
                <tr key={i}>
                  <td className="fw-bold">#{j.workOrder}</td>
                  <td style={{ maxWidth: "150px" }}>
                    <span
                      title={j.customer}
                      style={{
                        cursor: "pointer",
                        display: "inline-block",
                        maxWidth:
                          expandedHeader ===
                          j.workOrder + "wastePercentCustomer"
                            ? "300px"
                            : "100px",
                        whiteSpace:
                          expandedHeader ===
                          j.workOrder + "wastePercentCustomer"
                            ? "normal"
                            : "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        wordBreak: "break-word"
                      }}
                      onClick={() =>
                        setExpandedHeader(
                          expandedHeader ===
                            j.workOrder + "wastePercentCustomer"
                            ? null
                            : j.workOrder + "wastePercentCustomer"
                        )
                      }
                    >
                      {j.customer}
                    </span>
                  </td>
                  <td>{j.orderQty.toLocaleString("en-IN")}</td>

                  {usedMachines.map((machine) => (
                    <td key={machine} className="fw-bold">
                      {j.machines?.[machine]
                        ? j.machines[machine].toFixed(2) + "%"
                        : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          TABLE 5: MACHINE PRODUCTION
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Machine Production</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "280px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th>Machine</th>
                <th>Production</th>
                <th>Wastage</th>
                <th>Wastage %</th>
              </tr>
            </thead>

            <tbody>
              {machineProduction.slice(0, 10).map((m, i) => {
                const percent = totalOrderQty
                  ? ((m.wastage / m.production) * 100).toFixed(2)
                  : 0;

                return (
                  <tr key={i}>
                    <td className="fw-bold">{m.machine}</td>
                    <td>
                      {m.production || m.production === 0
                        ? m.production.toLocaleString("en-IN")
                        : "-"}
                    </td>
                    <td className="text-danger fw-bold">
                      {m.wastage || m.wastage === 0
                        ? m.wastage.toLocaleString("en-IN")
                        : "-"}
                    </td>
                    <td className="fw-bold">{percent}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          TABLE 6: WORK ORDER PRODUCTION
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Work Order Production</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "280px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th>Work Order</th>
                <th>Customer</th>
                <th>Production</th>
                <th>Wastage</th>
                <th>Wastage %</th>
              </tr>
            </thead>

            <tbody>
              {woCustomerProduction.slice(0, 10).map((m, i) => {
                const percent = m.production
                  ? ((m.wastage / m.production) * 100).toFixed(2)
                  : 0;

                return (
                  <tr key={i}>
                    <td className="fw-bold">#{m.workOrder}</td>
                    <td className="fw-semibold">{m.customer}</td>
                    <td>
                      {m.production || m.production === 0
                        ? m.production.toLocaleString("en-IN")
                        : "-"}
                    </td>
                    <td className="text-danger fw-bold">
                      {m.wastage || m.wastage === 0
                        ? m.wastage.toLocaleString("en-IN")
                        : "-"}
                    </td>
                    <td className="fw-bold">{percent}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================================
          TABLE 7: MACHINE UTILIZATION
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Machine Utilization</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "300px", overflowY: "auto" }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle">
            <thead className="table-dark sticky-top">
              <tr>
                <th>Date</th>
                <th>Machine</th>
                {machineStatuses.slice(0, 10).map((s) => (
                  <th key={s._id}>{s.statusName}</th>
                ))}
                <th>Utilization</th>
              </tr>
            </thead>

            <tbody>
              {sortedMachineUtilization.map((m, i) => {
                const productionMinutes = m["PRODUCTION"] || 0;
                const productionHours = productionMinutes / 60;
                const utilization = ((productionHours / 24) * 100).toFixed(2);

                return (
                  <tr key={i}>
                    <td>{m.date ? new Date(m.date).toLocaleDateString("en-IN") : "-"}</td>
                    <td className="fw-bold">{m.machine}</td>
                    {machineStatuses.map((s) => (
                      <td key={s._id}>{formatTime(m[s.statusName] || 0)}</td>
                    ))}
                    <td className="fw-bold text-success">{utilization}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* ======================================================================
          TABLE 8: DETAIL RECORDS (from Production Entry)
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Detail Records</strong>
          <span className="ms-2 small">({detailTotal.toLocaleString("en-IN")} records)</span>
        </div>

        <div className="table-responsive" style={{ maxHeight: "480px", overflow: "auto" }}>
          {detailLoading ? (
            <div className="p-4 text-center fw-bold">Loading…</div>
          ) : detailRows.length === 0 ? (
            <div className="p-4 text-center fw-bold">No records for selected filters</div>
          ) : (
            <table className="table table-bordered table-hover mb-0 align-middle dt-table" style={{ whiteSpace: "nowrap" }}>
              <thead className="sticky-top">
                <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2}>Date</th>
                  <th rowSpan={2}>WO No.</th>
                  <th rowSpan={2}>Shift</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Activity</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Machine</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Customer</th>
                  <th rowSpan={2} style={{ textAlign: "left" }}>Product Type</th>
                  <th rowSpan={2}>Production Qty</th>
                  <th rowSpan={2}>Wastage</th>
                  {detailStatusColumns.map((s) => (
                    <th key={s.key} colSpan={3} className="dt-group">{s.label.toUpperCase()}</th>
                  ))}
                  <th rowSpan={2}>Remarks</th>
                  <th rowSpan={2}>Grand Total</th>
                </tr>
                <tr>
                  {detailStatusColumns.map((s) => (
                    <Fragment key={s.key}>
                      <th className="dt-group">FROM</th>
                      <th className="dt-group">TO</th>
                      <th className="dt-group">TOTAL</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>

              <tbody>
                {groupedRows.map((g, i) => {
                  const dash = <span className="dt-muted">—</span>;

                  return (
                    <tr key={g.key}>
                      <td>{i + 1}</td>
                      <td className="mono">{fmtD(g.productionDate)}</td>
                      <td className="mono">{g.workOrder || dash}</td>
                      <td>{joinUnique(g.shifts) || dash}</td>
                      <td className="left">{g.activity || dash}</td>
                      <td className="left">{g.machine || dash}</td>
                      <td className="left">{g.customerName || dash}</td>
                      <td className="left">{g.productType || dash}</td>
                      <td className="mono">{g.productionQty.toLocaleString("en-IN")}</td>
                      <td className="mono">{g.wastageQty.toLocaleString("en-IN")}</td>

                      {detailStatusColumns.map((s) => {
                        const c = g.status[s.key];
                        return (
                          <Fragment key={s.key}>
                            <td className="mono">{c?.from.length ? c.from.join(", ") : dash}</td>
                            <td className="mono">{c?.to.length ? c.to.join(", ") : dash}</td>
                            <td className="mono">{c?.mins ? formatTime(c.mins) : dash}</td>
                          </Fragment>
                        );
                      })}

                      <td className="left" style={{ maxWidth: 160, whiteSpace: "normal", fontSize: 11 }}>
                        {joinUnique(g.remarks) || dash}
                      </td>
                      <td className="mono">{formatTime(g.totalMins)}</td>
                    </tr>
                  );
                })}
              </tbody>


              <tfoot>
                <tr>
                  <td colSpan={8} style={{ textAlign: "right" }}>PAGE TOTAL</td>
                  <td>{detailTotals.qty.toLocaleString("en-IN")}</td>
                  <td>{detailTotals.waste.toLocaleString("en-IN")}</td>
                  {detailStatusColumns.map((s) => (
                    <Fragment key={s.key}>
                      <td>—</td>
                      <td>—</td>
                      <td>{formatTime(detailTotals.status[s.key] || 0)}</td>
                    </Fragment>
                  ))}
                  <td>—</td>
               
                  <td>{formatTime(detailTotals.all)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="d-flex justify-content-between align-items-center p-2">
          <small>
            Page {detailPage} of {detailTotalPages}
          </small>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-primary" disabled={detailPage <= 1} onClick={() => setDetailPage((p) => p - 1)}>
              Prev
            </button>
            <button className="btn btn-sm btn-primary" disabled={detailPage >= detailTotalPages} onClick={() => setDetailPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      </div>

      {woDetail !== null && (
        <div className="wt-backdrop" onClick={() => setWoDetail(null)}>
          <style>{`
            .wt-backdrop{position:fixed;inset:0;background:rgba(6,40,61,.55);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px}
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
          `}</style>

          <div className="wt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wt-head">
              <strong>Work Order #{woDetail} - Stage &amp; Machine Flow</strong>
              <button className="btn btn-sm btn-danger" onClick={() => setWoDetail(null)}>
                Close
              </button>
            </div>

            {!woTree ? (
              <div className="p-4 text-center text-muted">
                No production entries for this work order in the current filters.
              </div>
            ) : (
              <>
                <div className="wt-legend">
                  <span></span>Light green = stage / machine of the latest production entry
                </div>
                <div className="wt-scroll">
                  <div className="wt-node root">
                    <div className="wt-box wt-wo">
                      <div className="wt-title">WO #{woTree.workOrder}</div>
                      <div>{woTree.customer}</div>
                      <div>Product type: {woTree.productType}</div>
                      <div>
                        Order Qty: {Number(woTree.orderQty || 0).toLocaleString("en-IN")} | Production:{" "}
                        {Number(woTree.total || 0).toLocaleString("en-IN")}
                      </div>
                    </div>

                    <div className="wt-children">
                      {woTree.stages.map((s, i) => (
                        <div className="wt-node" key={s.id || i}>
                          <div className={"wt-box" + (s.recent ? " recent" : "") + (s.has ? "" : " empty")}>
                            <div className="wt-title">
                              S{i + 1}: {s.label}
                            </div>
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
      )}

      {loading && (
        <div className="pr-loader-overlay">
          <style>{`
            .pr-loader-overlay{position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.75);backdrop-filter:blur(2px)}
            .pr-loader-box{width:min(90vw,380px);display:flex;flex-direction:column;gap:12px;padding:26px 30px;border-radius:12px;background:#fff;border:1px solid rgba(20,111,156,.35);box-shadow:0 16px 36px rgba(14,86,122,.25)}
            .pr-loader-top{display:flex;justify-content:space-between;align-items:center}
            .pr-loader-text{font-size:13px;font-weight:700;color:#06324d}
            .pr-loader-pct{font-size:18px;font-weight:900;color:#0877ad;font-variant-numeric:tabular-nums}
            .pr-bar{height:12px;border-radius:999px;background:#d9f2fc;overflow:hidden}
            .pr-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#0877ad,#16a4dc);transition:width .25s ease}
          `}</style>
          <div className="pr-loader-box">
            <div className="pr-loader-top">
              <span className="pr-loader-text">Loading production report…</span>
              <span className="pr-loader-pct">{Math.round(progress)}%</span>
            </div>
            <div className="pr-bar">
              <div className="pr-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionReport;