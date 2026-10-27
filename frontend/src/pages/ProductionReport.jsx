import { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";
import MachineDetailReport from "./MachineDetailReport";

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
  const [productTypeFilter, setProductTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState(monthStart()); // first load = current month only
  const [toDate, setToDate] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [expandedHeader, setExpandedHeader] = useState(null);
  const [usedMachines, setUsedMachines] = useState([]);
  const [wastageVisible, setWastageVisible] = useState(50);
  const [activityVisible, setActivityVisible] = useState(50);
  const [itemStages, setItemStages] = useState([]);
  const [woDetail, setWoDetail] = useState(null);
  const [activities, setActivities] = useState([]);
  const [showMachineDetail, setShowMachineDetail] = useState(false);
  const reqId = useRef(0);
  const debouncedSearchWO = useDebounced(searchWO, 300);

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
          productType: productTypeFilter || undefined,
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
  }, [fromDate, toDate, debouncedSearchWO, customerFilter, machineFilter, productTypeFilter, locationFilter]);

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
    setProductTypeFilter("");
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
  const productTypes = summary.productTypes || [];

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

  // per work order: activity -> totals (sum of all machines inside that activity)
  const jobActivityTotals = useMemo(() => {
    const map = {};
    Object.values(jobAggregates).forEach((j) => {
      const acts = {};
      Object.keys(j.byActivity || {}).forEach((actId) => {
        if (!actId) return;
        let p = 0;
        let w = 0;
        Object.values(j.byActivity[actId] || {}).forEach((m) => {
          p += Number(m.production) || 0;
          w += Number(m.wastage) || 0;
        });
        acts[actId] = {
          production: p,
          wastage: w,
          wastePercent: p ? (w / p) * 100 : 0
        };
      });
      map[j.workOrder] = acts;
    });
    return map;
  }, [jobAggregates]);

  // activity columns (Activity master order, unknown ones at the end)
  const usedActivities = useMemo(() => {
    const seen = new Set();
    Object.values(jobActivityTotals).forEach((a) =>
      Object.keys(a).forEach((id) => seen.add(id))
    );
    const ordered = activities.map((a) => String(a._id)).filter((id) => seen.has(id));
    seen.forEach((id) => {
      if (!ordered.includes(id)) ordered.push(id);
    });
    return ordered.map((id) => ({
      id,
      name: activities.find((a) => String(a._id) === id)?.activityName || "Unknown activity"
    }));
  }, [jobActivityTotals, activities]);

  const jobInfo = (wo) => ({
    productType: jobAggregates[wo]?.productType || "-",
    description: jobAggregates[wo]?.jobDescription || jobAggregates[wo]?.description || "-"
  });

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
          finalWastage: j.finalWastage,
          acts: jobActivityTotals[j.workOrder] || {}
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
          machines,
          acts: jobActivityTotals[j.workOrder] || {}
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
          machines,
          acts: jobActivityTotals[j.workOrder] || {}
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

  // combined activity table: all jobs, newest work order first (more rows load while scrolling)
  const sortedJobActivityAll = useMemo(
    () => [...jobMachinePerformance].sort((a, b) => b.workOrder - a.workOrder),
    [jobMachinePerformance]
  );

  useEffect(() => setActivityVisible(50), [sortedJobActivityAll]);

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
      "Product Type": jobInfo(j.workOrder).productType,
      Description: jobInfo(j.workOrder).description,
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
        "Product Type": jobInfo(j.workOrder).productType,
        Description: jobInfo(j.workOrder).description,
        "Order Qty": j.orderQty,
      };

      usedActivities.forEach(({ id, name }) => {
        const value = j.acts?.[id]?.production || 0;
        if (value > 0) {
          row[name + " Production"] = value;
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
        "Product Type": jobInfo(j.workOrder).productType,
        Description: jobInfo(j.workOrder).description,
        "Order Qty": j.orderQty,
      };

      usedActivities.forEach(({ id, name }) => {
        const value = j.acts?.[id]?.wastage || 0;
        if (value > 0) {
          row[name + " Wastage"] = value;
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
        "Product Type": jobInfo(j.workOrder).productType,
        Description: jobInfo(j.workOrder).description,
        "Order Qty": j.orderQty,
      };

      usedActivities.forEach(({ id, name }) => {
        const value = j.acts?.[id]?.wastePercent || 0;
        if (value > 0) {
          row[name + " Waste %"] = value.toFixed(2);
        }
      }); 
      return row;
    });

    const jobWastePercentSheet = XLSX.utils.json_to_sheet(jobWastePercentData);
    XLSX.utils.book_append_sheet(wb, jobWastePercentSheet, "Job Waste %");

    /* JOB ACTIVITY SUMMARY – same layout as the on-screen table
       (activity name on top, Production | Wastage | Waste % underneath) */
    const fixedHeads = ["WO No", "Customer", "Product Type", "Description", "Order Qty"];

    const headRow1 = [...fixedHeads];
    const headRow2 = fixedHeads.map(() => "");
    usedActivities.forEach(({ name }) => {
      headRow1.push(name, "", "");
      headRow2.push("Production", "Wastage", "Waste %");
    });

    const bodyRows = sortedJobActivityAll.map((j) => {
      const row = [
        j.workOrder,
        j.customer,
        jobInfo(j.workOrder).productType,
        jobInfo(j.workOrder).description,
        j.orderQty
      ];
      usedActivities.forEach(({ id }) => {
        const a = j.acts?.[id];
        row.push(
          a ? a.production : "",
          a ? a.wastage : "",
          a && a.wastePercent ? a.wastePercent.toFixed(2) : ""
        );
      });
      return row;
    });

    const actSheet = XLSX.utils.aoa_to_sheet([headRow1, headRow2, ...bodyRows]);

    // merge: fixed columns span both header rows, each activity name spans its 3 columns
    const merges = [];
    fixedHeads.forEach((_, c) => merges.push({ s: { r: 0, c }, e: { r: 1, c } }));
    usedActivities.forEach((_, i) => {
      const c = fixedHeads.length + i * 3;
      merges.push({ s: { r: 0, c }, e: { r: 0, c: c + 2 } });
    });
    actSheet["!merges"] = merges;

    // column widths
    actSheet["!cols"] = [
      { wch: 10 },
      { wch: 28 },
      { wch: 16 },
      { wch: 35 },
      { wch: 12 },
      ...usedActivities.flatMap(() => [{ wch: 13 }, { wch: 11 }, { wch: 10 }])
    ];

    XLSX.utils.book_append_sheet(wb, actSheet, "Job Activity Summary");

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

  if (showMachineDetail) {
    return (
      <MachineDetailReport
        initial={{
          machine: machineFilter,
          fromDate,
          toDate,
          wo: searchWO,
          customer: customerFilter,
          location: locationFilter
        }}
        machines={machines}
        machineStatuses={machineStatuses}
        customers={customers}
        locations={locationOptions}
        onBack={() => setShowMachineDetail(false)}
      />
    );
  }

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

        /* Clear column + row borders for ALL tables (stay visible with sticky headers) */
        .production-report-universe table {
          border-collapse: separate !important;
          border-spacing: 0;
          border-left: 1px solid #4f8aa6;
          border-top: 1px solid #4f8aa6;
        }

        .production-report-universe table th,
        .production-report-universe table td {
          border: 0 !important;
          border-right: 1px solid #4f8aa6 !important;
          border-bottom: 1px solid #4f8aa6 !important;
        }

        /* thick divider after the fixed columns and after every activity group (Activity Summary) */
        .production-report-universe table .grp-end {
          border-right: 3px solid #0877ad !important;
        }

        /* Clear column + row borders for ALL tables (stay visible with sticky headers) */
        .production-report-universe table {
          border-collapse: separate !important;
          border-spacing: 0;
          border-left: 1px solid #4f8aa6;
          border-top: 1px solid #4f8aa6;
        }

        .production-report-universe table th,
        .production-report-universe table td {
          border: 0 !important;
          border-right: 1px solid #4f8aa6 !important;
          border-bottom: 1px solid #4f8aa6 !important;
        }

        /* thick divider after the fixed columns and after every activity group (Activity Summary) */
        .production-report-universe table .grp-end {
          border-right: 3px solid #0877ad !important;
        }

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
            <label className="form-label">Product Type</label>
            <select
              className="form-select"
              value={productTypeFilter}
              onChange={(e) => setProductTypeFilter(e.target.value)}
            >
              <option value="">All Product Types</option>
              {productTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
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
  <div className="col-md-4 d-flex align-items-end mt-2">
          <button className="btn btn-primary px-4" onClick={exportExcel}>
            Export Excel
          </button>
          <button className="btn btn-primary ms-2 text-nowrap" onClick={() => setShowMachineDetail(true)}>
            Consolidated Detail
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
                <th>Product Type</th>
                <th>Description</th>
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
                    <td>{jobInfo(j.workOrder).productType}</td>
                    <td
                      title={jobInfo(j.workOrder).description}
                      style={{ maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                      {jobInfo(j.workOrder).description}
                    </td>
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

                <th>Product Type</th>
                <th>Description</th>

                <th>Order Qty</th>
                {usedActivities.map(({ id, name: machine }) => (
                  <th key={id} style={{ minWidth: "170px" }}>
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

                    <td>{jobInfo(j.workOrder).productType}</td>
                    <td
                      title={jobInfo(j.workOrder).description}
                      style={{ maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                      {jobInfo(j.workOrder).description}
                    </td>

                      <td>{j.orderQty.toLocaleString("en-IN")}</td>
                    {usedActivities.map(({ id }) => (
                      <td key={id}>
                        {j.acts?.[id]
                          ? Number(j.acts[id].production).toLocaleString("en-IN")
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

                <th>Product Type</th>
                <th>Description</th>
                <th>Order Qty</th>

                {usedActivities.map(({ id, name: machine }) => (
                  <th key={id} style={{ maxWidth: "170px" }}>
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

                  <td>{jobInfo(j.workOrder).productType}</td>
                  <td
                    title={jobInfo(j.workOrder).description}
                    style={{ maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                    {jobInfo(j.workOrder).description}
                  </td>
                    <td>{j.orderQty.toLocaleString("en-IN")}</td>

                  {usedActivities.map(({ id }) => (
                    <td key={id} className="text-danger fw-bold">
                      {j.acts?.[id] ? j.acts[id].wastage : "-"}
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

                <th>Product Type</th>
                <th>Description</th>
                <th>Order Qty</th>

                {usedActivities.map(({ id, name: machine }) => (
                  <th key={id + "percent"} style={{ maxWidth: "170px" }}>
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

                  <td>{jobInfo(j.workOrder).productType}</td>
                  <td
                    title={jobInfo(j.workOrder).description}
                    style={{ maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {jobInfo(j.workOrder).description}
                  </td>
                  <td>{j.orderQty.toLocaleString("en-IN")}</td>

                  {usedActivities.map(({ id }) => (
                    <td key={id} className="fw-bold">
                      {j.acts?.[id]?.wastePercent
                        ? j.acts[id].wastePercent.toFixed(2) + "%"
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
          NEW TABLE: JOBWISE ACTIVITY SUMMARY (production + wastage + waste % together)
          ====================================================================== */}
      <div className="card shadow-lg mb-4">
        <div className="card-header text-center">
          <strong>Jobwise Activity Summary (Production, Wastage &amp; Waste %)</strong>
        </div>

        <div
          className="table-responsive"
          style={{ maxHeight: "320px", overflow: "auto" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
              setActivityVisible((v) => Math.min(v + 100, sortedJobActivityAll.length));
            }
          }}
        >
          <table className="table table-striped table-bordered table-hover mb-0 align-middle act-summary">
            <thead className="table-dark sticky-top">
              <tr>
                <th rowSpan={2}>WO No</th>
                <th rowSpan={2}>Customer</th>
                <th rowSpan={2}>Product Type</th>
                <th rowSpan={2}>Description</th>
                <th rowSpan={2} className="grp-end">Order Qty</th>
                {usedActivities.map(({ id, name }) => (
                  <th key={id} colSpan={3} title={name} className="grp-end">
                    {name}
                  </th>
                ))}
              </tr>
              <tr>
                {usedActivities.flatMap(({ id }) => [
                  <th key={id + "p"}>Production</th>,
                  <th key={id + "w"}>Wastage</th>,
                  <th key={id + "pc"} className="grp-end">Waste %</th>
                ])}
              </tr>
            </thead>

            <tbody>
              {sortedJobActivityAll.length === 0 && (
                <tr>
                  <td colSpan={5 + usedActivities.length * 3}>No data for the selected filters</td>
                </tr>
              )}

              {sortedJobActivityAll.slice(0, activityVisible).map((j) => (
                <tr key={j.workOrder}>
                  <td className="fw-bold">#{j.workOrder}</td>
                  <td
                    title={j.customer}
                    style={{ maxWidth: "150px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {j.customer}
                  </td>
                  <td>{jobInfo(j.workOrder).productType}</td>
                  <td
                    title={jobInfo(j.workOrder).description}
                    style={{ maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {jobInfo(j.workOrder).description}
                  </td>
                  <td className="grp-end">{j.orderQty ? j.orderQty.toLocaleString("en-IN") : "-"}</td>

                  {usedActivities.flatMap(({ id }) => {
                    const a = j.acts?.[id];
                    return [
                      <td key={id + "p"}>
                        {a ? Number(a.production).toLocaleString("en-IN") : "-"}
                      </td>,
                      <td key={id + "w"} className="text-danger fw-bold">
                        {a ? Number(a.wastage).toLocaleString("en-IN") : "-"}
                      </td>,
                      <td key={id + "pc"} className="fw-bold grp-end">
                        {a && a.wastePercent ? a.wastePercent.toFixed(2) + "%" : "-"}
                      </td>
                    ];
                  })}
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