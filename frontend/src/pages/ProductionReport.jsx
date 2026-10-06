import { useEffect, useState, useMemo, useRef } from "react";
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

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

// Keep only what the page reads + precomputed values (done ONCE per record on load)
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

const useDebounced = (value, delay = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

function ProductionReport() {
  const [productionData, setProductionData] = useState([]);
  const token = localStorage.getItem("token");
  const [machines, setMachines] = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [searchWO, setSearchWO] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [expandedHeader, setExpandedHeader] = useState(null);
  const [usedMachines, setUsedMachines] = useState([]);
  const [wastageVisible, setWastageVisible] = useState(50);
  const reqId = useRef(0);
  const debouncedSearchWO = useDebounced(searchWO, 300);

  const fetchProduction = async (from = fromDate, to = toDate) => {
    const id = ++reqId.current; // ignore stale responses
    try {
      const res = await axios.get(`${BASE_URL}/api/production-real`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { from: from || undefined, to: to || undefined }
      });
      if (id !== reqId.current) return;

      const raw = res.data || [];
      const slim = new Array(raw.length);
      const locs = new Set();

      for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        slim[i] = slimRecord(item);
        const ul = item.userLocations;
        if (ul) for (let k = 0; k < ul.length; k++) if (ul[k]) locs.add(ul[k]);
      }

      // sort ONCE (date desc, stable). Filtering keeps this order.
      slim.sort((a, b) => b._dateMs - a._dateMs);

      setProductionData(slim);
      setLocationOptions([...locs]);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchProduction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchMachines();
    fetchMachineStatuses();
  }, []);

  const clearFilters = () => {
    setSearchWO("");
    setCustomerFilter("");
    setMachineFilter("");
    setFromDate("");
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

  // ================= FILTERED DATA (memoized) =================
  const filteredData = useMemo(() => {
    const woQ = debouncedSearchWO ? debouncedSearchWO.toLowerCase() : "";
    const custQ = customerFilter ? customerFilter.trim() : null;
    const machQ = machineFilter ? machineFilter.toLowerCase() : "";
    const fromMs = fromDate ? new Date(fromDate).getTime() : null;
    const toMs = toDate ? new Date(toDate).getTime() : null;

    const out = [];
    for (let i = 0; i < productionData.length; i++) {
      const item = productionData[i];

      if (woQ && !item._woLower.includes(woQ)) continue;
      if (custQ !== null && item._cust !== custQ) continue;
      if (machQ && !item._namesLower.includes(machQ)) continue;
      if (locationFilter && !item.userLocations?.includes(locationFilter)) continue;
      if (fromMs !== null && !(item._dateMs >= fromMs)) continue;
      if (toMs !== null && !(item._dateMs <= toMs)) continue;

      out.push(item);
    }
    return out;
  }, [
    productionData,
    debouncedSearchWO,
    customerFilter,
    machineFilter,
    locationFilter,
    fromDate,
    toDate
  ]);

  // ================= USED MACHINES: earliest-seen timestamp per machine =================
  const machineFirstSeen = useMemo(() => {
    const map = new Map();
    const tsCache = new Map();
    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      const names = item._names;
      if (names.length === 0) continue;

      const ck = `${item.productionDate} ${item.productionFromTime || "00:00"}`;
      let ts = tsCache.get(ck);
      if (ts === undefined) {
        ts = new Date(ck).getTime();
        tsCache.set(ck, ts);
      }

      for (let k = 0; k < names.length; k++) {
        const machine = names[k];
        if (!machine) continue;
        const existingTs = map.get(machine);
        if (existingTs === undefined || ts < existingTs) map.set(machine, ts);
      }
    }
    return map;
  }, [filteredData]);

  useEffect(() => {
    if (machineFirstSeen.size === 0) return;

    setUsedMachines((prev) => {
      const existing = new Set(prev);
      const newMachines = [];

      machineFirstSeen.forEach((ts, machine) => {
        if (!existing.has(machine)) newMachines.push(machine);
      });

      if (newMachines.length === 0) return prev;

      newMachines.sort(
        (a, b) => machineFirstSeen.get(a) - machineFirstSeen.get(b)
      );

      return [...prev, ...newMachines];
    });
  }, [machineFirstSeen]);

  const customers = useMemo(
    () => [...new Set(productionData.map((p) => p.customerName))].filter(Boolean),
    [productionData]
  );

  // ================= COMBINED JOB-LEVEL AGGREGATION (single pass) =================
  const jobAggregates = useMemo(() => {
    const map = {};

    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      if (item.machineStatus !== "PRODUCTION") continue;

      const wo = item.workOrder;
      let entry = map[wo];

      if (!entry) {
        entry = map[wo] = {
          workOrder: wo,
          customer: item.customerName,
          orderQty: item.orderQty,
          latestProduction: 0,
          latestTime: -Infinity,
          machines: {},
          lastMachine: null
        };
      }

      const currentTime = item._createdMs;
      if (currentTime > entry.latestTime) {
        entry.latestTime = currentTime;
        entry.latestProduction = Number(item.productionQty) || 0;
      }

      const names = item._names;
      for (let k = 0; k < names.length; k++) {
        const machine = names[k];
        if (!entry.machines[machine]) {
          entry.machines[machine] = { production: 0, wastage: 0, wastePercent: 0 };
        }
        entry.machines[machine].production += Number(item.productionQty);
        entry.machines[machine].wastage += Number(item.wastageQty);
        entry.machines[machine].wastePercent += Number(item.wastePercent || 0);
        entry.lastMachine = machine;
      }
    }

    return map;
  }, [filteredData]);

  const jobPerformance = useMemo(
    () =>
      Object.values(jobAggregates).map((j) => ({
        workOrder: j.workOrder,
        customer: j.customer,
        orderQty: j.orderQty,
        production: j.latestProduction
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
          lastMachine: j.lastMachine
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
    const acc = {};

    jobMachinePerformance.forEach((job) => {
      let matchWO = debouncedSearchWO
        ? String(job.workOrder).toLowerCase().includes(debouncedSearchWO.toLowerCase())
        : true;

      let matchCustomer = customerFilter
        ? job.customer?.trim() === customerFilter.trim()
        : true;

      if (!(matchWO && matchCustomer)) return;

      const key = job.workOrder;

      if (!acc[key]) {
        acc[key] = {
          workOrder: job.workOrder,
          customer: job.customer,
          production: 0,
          wastage: 0,
          orderQty: job.orderQty
        };
      }

      const wastageForJob = jobWastageMap.get(job.workOrder);

      Object.keys(job.machines || {}).forEach((machine) => {
        const production = job.machines?.[machine] || 0;
        const wastage = wastageForJob?.machines?.[machine] || 0;

        acc[key].production += Number(production);
        acc[key].wastage += Number(wastage);
      });
    });

    return Object.values(acc);
  }, [jobMachinePerformance, debouncedSearchWO, customerFilter, jobWastageMap]);

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

  // ================= MACHINE UTILIZATION (memoized) =================
  const machineUtilizationDatewise = useMemo(() => {
    const acc = new Map();
    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      const minutes = item._minutes;
      const date = item._dateKey;
      const status = item.machineStatus;
      const names = item._names;

      for (let k = 0; k < names.length; k++) {
        const machine = names[k];
        const key = machine + "_" + date;
        let row = acc.get(key);
        if (!row) {
          row = { machine, date };
          for (let s = 0; s < machineStatuses.length; s++) {
            row[machineStatuses[s].statusName] = 0;
          }
          acc.set(key, row);
        }
        if (status && row[status] !== undefined) row[status] += minutes;
      }
    }
    return Array.from(acc.values());
  }, [filteredData, machineStatuses]);

  // ================= KPI TOTALS (single combined pass) =================
  const kpiTotals = useMemo(() => {
    let totalProduction = 0;
    let totalWastage = 0;
    const orderQtyByWO = new Map();
    const productionWOs = new Set();

    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];

      totalProduction += Number(item.productionQty || 0);
      totalWastage += Number(item.wastageQty || 0);

      if (!orderQtyByWO.has(item.workOrder)) {
        orderQtyByWO.set(item.workOrder, item.orderQty);
      }

      if (item.machineStatus === "PRODUCTION") {
        productionWOs.add(item.workOrder);
      }
    }

    let totalOrderQty = 0;
    orderQtyByWO.forEach((qty) => {
      totalOrderQty += Number(qty);
    });

    return {
      totalOrderQty,
      totalOrders: productionWOs.size,
      totalProduction,
      totalWastage
    };
  }, [filteredData]);

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
      className="container mt-2 production-report-universe"
      style={{
        maxWidth: "100%",
        fontSize: "14px",
        background: "#d8f1fb",
        border: "1px solid rgba(12, 90, 130, 0.38)",
        borderRadius: "20px"
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
          background:
            radial-gradient(circle at top left, rgba(34, 153, 204, 0.34), transparent 32%),
            linear-gradient(135deg, #d6f1fb 0%, #edfaff 48%, #c7e9f7 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
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
          background: linear-gradient(135deg, #075f90, #119bd2) !important;
          color: #ffffff !important;
          padding: 12px 16px;
        }

        .production-report-universe .table-responsive {
          background: #d5edf8 !important;
          border-radius: 0 0 12px 12px;
        }

        .production-report-universe table {
          color: #09283d;
          background: #ffffff;
        }

        .production-report-universe thead th {
          background: #064c73 !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.28) !important;
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
          HEADER WITH DEAD-CENTER TITLE & RIGHT-ALIGNED EXCEL BUTTON
          ====================================================================== */}
      <div className="position-relative text-center mt-2 mb-4">
        <h1 className="report-hero-title m-0">
          <b>Production Report</b>
        </h1>

        <div className="position-absolute top-50 end-0 translate-middle-y">
          <button className="btn btn-primary px-4" onClick={exportExcel}>
            Export Excel
          </button>
        </div>
      </div>

      {/* ======================================================================
          FILTER BAR CARD
          ====================================================================== */}
      <div className="card shadow-lg p-3 mb-4">
        <h5 className="mb-3" style={{ color: "#06324d" }}>
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
                  <tr key={i}>
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
    </div>
  );
}

export default ProductionReport;


// hellooooooooooo