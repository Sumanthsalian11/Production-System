import { useEffect, useState, useRef, useMemo, useDeferredValue, Fragment } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { saveAs } from "file-saver";
import BASE_URL from "../config/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiHash, FiCalendar, FiClock, FiLayers, FiCpu, FiSun, FiActivity, FiPackage,
  FiTrash2, FiEdit2, FiEdit3, FiSave, FiSearch, FiFilter, FiX, FiDownload,
  FiFileText, FiUser, FiMapPin, FiTag, FiMessageSquare, FiBox, FiPercent,
  FiAlertTriangle, FiBookOpen, FiMaximize, FiGrid, FiList, FiBarChart2,
  FiClipboard, FiTrendingUp, FiBriefcase, FiPower,
  FiChevronsLeft, FiChevronLeft, FiChevronRight, FiChevronsRight
} from "react-icons/fi";

// ---- field icons (presentation only) ----
const FIELD_ICONS = {
  "WO number": FiHash, "WO Number": FiHash,
  "Production Date": FiCalendar, "From date": FiCalendar, "To date": FiCalendar, "Month": FiCalendar,
  "Activity": FiLayers, "Machine": FiCpu, "Machines": FiCpu,
  "From Time": FiClock, "To Time": FiClock,
  "Shift": FiSun, "Shifts": FiSun,
  "Machine Status": FiActivity,
  "Production Impression": FiTrendingUp, "Waste Impression": FiAlertTriangle,
  "Production UPS": FiGrid, "Production Qty": FiPackage, "Booklet Quantity": FiBookOpen,
  "Wastage Qty": FiTrash2, "Waste %": FiPercent, "Remarks": FiMessageSquare,
  "Product Type": FiTag, "Customer": FiUser, "User Location": FiMapPin,
  "Wo Date:": FiCalendar, "Customer Name:": FiUser, "Job Description:": FiFileText,
  "Product Type:": FiTag, "Job Size:": FiMaximize, "Material Code:": FiHash,
  "Pages:": FiBookOpen, "Material Description:": FiList, "Material Group Desc.:": FiLayers,
  "Mill:": FiBriefcase, "GSM:": FiBox, "Paper Size:": FiMaximize,
  "Planner UPS:": FiGrid, "Order Qty:": FiPackage, "Entered By": FiUser
};
const FieldIcon = ({ name }) => {
  const Icon = FIELD_ICONS[name];
  return Icon ? <Icon className="pd-ico" aria-hidden="true" /> : null;
};

// ---- table pagination bar (presentational; state lives in the page) ----
const PAGE_SIZES = [10, 25, 50, 100, 200, 500];
const Pagination = ({ page, totalPages, pageSize, total, onPage, onPageSize }) => {
  const [jump, setJump] = useState("");
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const nums = new Set([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= totalPages) nums.add(p);
  const items = [];
  let prev = 0;
  [...nums].sort((a, b) => a - b).forEach((p) => {
    if (p - prev > 1) items.push("gap-" + p);
    items.push(p);
    prev = p;
  });

  const goJump = () => {
    const n = Math.min(Math.max(parseInt(jump, 10) || 1, 1), totalPages);
    onPage(n);
    setJump("");
  };

  return (
    <div className="pd-pager">
      <div className="pd-pager-info">
        Showing {start.toLocaleString("en-IN")}–{end.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} records
      </div>

      <div className="pd-pager-nav">
        <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => onPage(1)} title="First page" aria-label="First page"><FiChevronsLeft /></button>
        <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page" aria-label="Previous page"><FiChevronLeft /></button>

        {items.map((it) =>
          typeof it === "string" ? (
            <span key={it} className="pd-pager-gap">…</span>
          ) : (
            <button
              key={it}
              type="button"
              className={`btn btn-sm ${it === page ? "btn-primary" : "btn-secondary"}`}
              onClick={() => onPage(it)}
              aria-current={it === page ? "page" : undefined}
            >
              {it.toLocaleString("en-IN")}
            </button>
          )
        )}

        <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)} title="Next page" aria-label="Next page"><FiChevronRight /></button>
        <button type="button" className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => onPage(totalPages)} title="Last page" aria-label="Last page"><FiChevronsRight /></button>
      </div>

      <div className="pd-pager-extra">
        <span className="pd-pager-jump">
          <input
            type="number"
            min="1"
            max={totalPages}
            value={jump}
            placeholder={`Page / ${totalPages.toLocaleString("en-IN")}`}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goJump(); } }}
            className="form-control form-control-sm border-dark"
            aria-label="Jump to page"
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={goJump}>Go</button>
        </span>
        <select
          className="form-select form-select-sm border-dark"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          aria-label="Rows per page"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Small presentational helper for the read-only info tiles (no logic)
const InfoTile = ({ label, col = "col-md-2", children }) => (
  <div className={col}>
    <div className="pd-tile">
      <span className="pd-tile-label"><FieldIcon name={label} />{label}</span>
      <div className="pd-tile-value">{children}</div>
    </div>
  </div>
);

// ---- machine hours helpers (same logic as the Perso consolidated report) ----
const getDurationMins = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  let mins = (th * 60 + tm) - (fh * 60 + fm);
  if (mins <= 0) mins += 24 * 60; // crosses midnight
  return mins;
};

const formatHMS = (m) => {
  const total = Math.round((m || 0) * 60);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function ProductionRealDashboard() {

  const [workOrderDetails, setWorkOrderDetails] = useState(null);
  const showAlert = (message, icon = "warning") => {

    let bgColor = "#fffafb"; // pink default

    if (icon === "success") bgColor = "#f0f2f4";   // blue
    if (icon === "error") bgColor = "#e3dede";     // red
    if (icon === "info") bgColor = "#17a2b8";      // cyan

    Swal.fire({
      toast: true,
      position: "top",
      icon: icon,
      title: message,
      width: "550px",
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      background: bgColor,
      color: "#0a0808",
      didOpen: (toast) => {
        toast.style.marginLeft = "120px"; // slight right shift
      }
    });
  };
  const [form, setForm] = useState({
    workOrderNo: "",
    productionDate: "",
    productionFromTime: "",
    productionToTime: "",
    machineStatus: "",
    shift: "",
    productionQty: "",
    wastageQty: "",
    productionImpression: "",
    wasteImpression: "",
    productionUps: "",
    pages: "",
    quantity2: "",
    remarks: ""
  });


  const [activities, setActivities] = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activityMachinePairs, setActivityMachinePairs] = useState([
    { activityId: "", machineId: "" }
  ]);
  const [productionList, setProductionList] = useState([]);
  const [expandedCell, setExpandedCell] = useState(null);
  const [wastePercent, setWastePercent] = useState(0);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [loggedInUserId, setLoggedInUserId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isOffDay, setIsOffDay] = useState(false);
  const formRef = useRef(null);
  const findCardRef = useRef(null);
  const entryPanelRef = useRef(null);
  const skipQuantityRecalc = useRef(false);
  const token = localStorage.getItem("token");
  const [userLocations, setUserLocations] = useState([]);
    const [allowedMachineIds, setAllowedMachineIds] = useState(null); // null = no restriction
  const [locationFilter, setLocationFilter] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [selectedMaterialIndex, setSelectedMaterialIndex] = useState("");
  const [recordsView, setRecordsView] = useState("details");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const tableWrapRef = useRef(null);
  const [allowedProductionUps, setAllowedProductionUps] = useState([]);
  const [showEntryModal, setShowEntryModal] = useState(false); // entry popup (opens after Fetch / Edit / Off Day)

  const selectedMaterial =
    selectedMaterialIndex !== ""
      ? workOrderDetails?.materials?.[selectedMaterialIndex] ?? null
      : null;

  const hasValue = (v) =>
    v !== undefined &&
    v !== null &&
    v !== "" &&
    v !== 0 &&
    !(Array.isArray(v) && v.length === 0);

  // selectedUps can be a scalar (raw machine.UPS from the WorkOrder is a single
  // number, not an array) or an array (e.g. in edit mode, where it's rehydrated
  // from a saved ProductionReal record's ups: [Number]). The payload always
  // needs an array — wrapping a scalar instead of discarding it is the fix.
  const toUpsArray = (v) => {
    if (Array.isArray(v)) {
      return v.filter((x) => x !== null && x !== undefined && x !== "" && x !== 0);
    }
    if (v === null || v === undefined || v === "" || v === "-" || v === 0) return [];
    return [v];
  };

  const selectedMachineData = useMemo(() => {
    if (!workOrderDetails || selectedMaterialIndex === "") return null;
    return (
      workOrderDetails.machines?.[selectedMaterialIndex] ??
      workOrderDetails.machines?.[0] ??
      null
    );
  }, [workOrderDetails, selectedMaterialIndex]);

  const selectedPages = useMemo(() => {
    if (!workOrderDetails || selectedMaterialIndex === "") return "";
    const fromMachine = selectedMachineData?.pages;
    if (hasValue(fromMachine)) return fromMachine;
    return hasValue(workOrderDetails.pages) ? workOrderDetails.pages : "";
  }, [workOrderDetails, selectedMaterialIndex, selectedMachineData]);

  const selectedUps = useMemo(() => {
    if (!workOrderDetails || selectedMaterialIndex === "") return "";

    // new work orders: machines[i].UPS
    const fromMachine = selectedMachineData?.UPS ?? selectedMachineData?.ups;
    if (hasValue(fromMachine)) return fromMachine;

    // old work orders: top-level UPS
    const fromRoot = workOrderDetails.UPS ?? workOrderDetails.ups;
    if (hasValue(fromRoot)) return fromRoot;

    return "-";
  }, [workOrderDetails, selectedMaterialIndex, selectedMachineData]);

  const isSheetFedSelected = () => {
    return activityMachinePairs.some((pair) => {
      const activity = activities.find(
        (a) => String(a._id) === String(pair.activityId?._id || pair.activityId)
      );
      const activityName = String(
        activity?.activityName || pair.activityId?.activityName || ""
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      return activityName === "sheetfed" || activityName.includes("sheetfed");
    });
  };

  const isFourByZero = () => {
    const isEmpty = (v) => v === undefined || v === null || v === "";

    // look in the material, the machine entry and the work order itself
    const sources = [selectedMaterial, selectedMachineData, workOrderDetails];

    return sources.some((src) => {
      if (!src) return false;

      // single value like "4/0" or "4 / 0"
      const combined = [
        src.color, src.colour, src.colors, src.colours,
        src.colorFrontBack, src.colourFrontBack, src.frontBack,
      ].some((v) => !isEmpty(v) && String(v).replace(/\s+/g, "") === "4/0");
      if (combined) return true;

      // separate front / back values (?? keeps 0 as a real value)
      const front = src.colorFront ?? src.frontColor ?? src.colourFront ?? src.frontColour;
      const back = src.colorBack ?? src.backColor ?? src.colourBack ?? src.backColour;
      return !isEmpty(front) && Number(front) === 4 && Number(back ?? 0) === 0;
    });
  };

  const getSheetFedDivisor = () => {
    return isFourByZero() ? 1 : 2;
  };

  const getProductionQty = (productionQty) => {
    const prodQty = Number(productionQty) || 0;

    if (prodQty <= 0) return "";

    if (isSheetFedSelected()) {
      return prodQty / getSheetFedDivisor();
    }

    return prodQty;
  };
  const getQuantity2 = (rawQty, pages) => {
    const qty = Number(rawQty) || 0;
    const pagesVal = Number(pages) || 0;

    // booklet quantity only when pages exist
    if (qty <= 0 || pagesVal <= 0) return "";

    // sheet fed: keep the undivided quantity
    if (isSheetFedSelected()) {
      return qty;
    }

    return qty / pagesVal;
  };

  useEffect(() => {
    if (skipQuantityRecalc.current) {
      skipQuantityRecalc.current = false;
      setForm((prev) => ({ ...prev, pages: selectedPages }));
      return;
    }

    setForm((prev) => {
      const pagesVal = Number(selectedPages) || 0;
      const prodImp = Number(prev.productionImpression) || 0;
      const ups = Number(prev.productionUps) || 0;
      const rawProdQty = prodImp > 0 && ups > 0 ? prodImp * ups : Number(prev.productionQty) || 0;
      const prodQty = getProductionQty(rawProdQty);

      return {
        ...prev,
        pages: selectedPages,
        productionQty: prodQty,
        quantity2: getQuantity2(rawProdQty, pagesVal)
      };
    });
  }, [selectedPages, selectedMaterial, activityMachinePairs, activities]);
  const handleEdit = (item) => {
    setShowEntryModal(true);
    setEditingId(item._id);
    skipQuantityRecalc.current = true;

    const editMachineId = item.machiness?.[0]?.machineId?._id || item.machiness?.[0]?.machineId;
    const editMachine = machines.find((m) => String(m._id) === String(editMachineId));
    setAllowedProductionUps(
      editMachine?.fixed && Array.isArray(editMachine?.ups) ? editMachine.ups : []
    );

    setForm({
      workOrderNo: item.workOrder,
      productionDate: item.productionDate?.split("T")[0],
      productionFromTime: item.productionFromTime,
      productionToTime: item.productionToTime,
      shift: item.shift,
      machineStatus: item.machineStatus || "",
      productionImpression: item.productionImpression || "",
      wasteImpression: item.wasteImpression || "",
      productionUps: item.productionUps || "",
      pages: item.pages || "",
      productionQty: item.productionQty,
      wastageQty: item.wastageQty,
      quantity2: item.quantity2 || "",
      remarks: item.remarks
    });

    // ✅ ADD THIS
    if (item.productionQty > 0) {
      setWastePercent(
        ((item.wastageQty / item.productionQty) * 100).toFixed(2)
      );
    } else {
      setWastePercent(0);
    }

    setWorkOrderDetails({
      customerName: item.customerName,
      jobDescription: item.jobDescription,
      productType: item.productType || "",
      jobSize: item.jobSize,
      materials: item.materials,
      ups: item.ups,
      colorFront: item.colorFront,
      colorBack: item.colorBack,
      machines: [
        {
          pages: item.pages || "",
          UPS: item.ups,
          component: item.materials?.[0]?.component || ""
        }
      ],
      orderQty: item.liveOrderQty ?? item.orderQty
    });

    setSelectedMaterialIndex(item.materials?.length ? 0 : "");

    setActivityMachinePairs(
      item.machiness?.map(pair => ({
        activityId: pair.activityId?._id || pair.activityId,
        machineId: pair.machineId?._id || pair.machineId
      })) || [{ activityId: "", machineId: "" }]
    );

    setTimeout(() => {
      (findCardRef.current || entryPanelRef.current || formRef.current)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 200);
  };
  const handleOffDayToggle = (e) => {
    const checked = e.target.checked;
    setIsOffDay(checked);
    if (checked) {
      setWorkOrderDetails(null);
      setSelectedMaterialIndex("");
      setForm((prev) => ({ ...prev, workOrderNo: "", machineStatus: "" }));
      setShowEntryModal(true);
    }
  };

  // closes the entry popup and clears the half-filled entry (WO number + date stay)
  const closeEntry = () => {
    setShowEntryModal(false);
    setIsOffDay(false);
    setWorkOrderDetails(null);
    setSelectedMaterialIndex("");
    setEditingId(null);
    setActivityMachinePairs([{ activityId: "", machineId: "" }]);
    setWastePercent(0);
    setAllowedProductionUps([]);
    setForm((prev) => ({
      workOrderNo: prev.workOrderNo,
      productionDate: prev.productionDate,
      productionFromTime: "",
      productionToTime: "",
      machineStatus: "",
      shift: "",
      productionQty: "",
      wastageQty: "",
      productionImpression: "",
      wasteImpression: "",
      productionUps: "",
      pages: "",
      quantity2: "",
      remarks: ""
    }));
  };

  const truncateText = (text, length = 25) => {
    if (!text) return "-";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };
  const isOwner = (item) => {
    if (item.enteredById && loggedInUserId) {
      const entryUserId = item.enteredById._id || item.enteredById;
      return String(entryUserId) === String(loggedInUserId);
    }
    return item.enteredBy === loggedInUser; // older records, or token without id
  };


  const fetchMachineStatuses = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/master/machine-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMachineStatuses(res.data || []);
    } catch (err) {
      console.error("Error fetching machine statuses:", err);
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!"
    });

    if (confirm.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/production-real/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        showAlert("Deleted successfully ✅", "success");
        fetchProductionReal(); // refresh table
      } catch (err) {
        console.error(err);
        showAlert("Delete failed", "error");
      }
    }
  };

  // ================= FILTER STATE =================
  const [filters, setFilters] = useState({
    workOrder: "",
    dateFrom: "",
    dateTo: "",
    month: "",
    shift: "",
    machine: "",
    machineStatus: "",
    productType: "",      // ⭐ ADD THIS
    customer: ""
  });

  // ================= FILTER HANDLER =================
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // ================= CLEAR FILTERS =================
  const clearFilters = () => {
    setFilters({
      workOrder: "",
      dateFrom: "",
      dateTo: "",
      month: "",
      shift: "",
      machine: "",
      productType: "",
      machineStatus: "",
      customer: ""
    });
    setLocationFilter("");
  };

  // Deferred copies: typing in a filter box stays instant while the heavy
  // re-filter over the big list runs in the background.
  const deferredFilters = useDeferredValue(filters);
  const deferredLocationFilter = useDeferredValue(locationFilter);

  // back to page 1 whenever the filters or page size change
  useEffect(() => {
    setPage(1);
  }, [deferredFilters, deferredLocationFilter, pageSize]);

  // ================= FILTER LOGIC (memoized) =================
  const filteredProductionList = useMemo(() => {
    const f = deferredFilters;

    // parse the filter bounds ONCE instead of once per record
    const needsDate = !!(f.dateFrom || f.dateTo || f.month);
    const fromTs = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
    const toTs = f.dateTo ? new Date(f.dateTo).getTime() : null;
    let monthYear = null;
    let monthNum = null;
    if (f.month) {
      const [year, month] = f.month.split("-");
      monthYear = Number(year);
      monthNum = Number(month);
    }

    return productionList.filter(item => {

      if (f.productType && item.productType !== f.productType) return false;

      if (f.customer && item.customerName !== f.customer) return false;

      // Work Order filter
      if (f.workOrder && !String(item.workOrder).includes(f.workOrder)) return false;

      // Machine Status filter
      if (f.machineStatus && item.machineStatus !== f.machineStatus) return false;

      // Shift filter
      if (f.shift && item.shift !== f.shift) return false;

      if (deferredLocationFilter) {
        const matchLocation = item.userLocations?.some(
          loc => loc === deferredLocationFilter
        );
        if (!matchLocation) return false;
      }

      // Machine filter
      if (f.machine) {
        const machineMatch = item.machiness?.some(pair =>
          pair.machineId?.machineName === f.machine
        );
        if (!machineMatch) return false;
      }

      // Date based filters (Date only built when one of them is active)
      if (needsDate) {
        const itemDate = new Date(item.productionDate);
        const itemTs = itemDate.getTime();

        if (fromTs !== null && itemTs < fromTs) return false;
        if (toTs !== null && itemTs > toTs) return false;

        if (f.month) {
          if (
            itemDate.getFullYear() !== monthYear ||
            itemDate.getMonth() + 1 !== monthNum
          ) return false;
        }
      }

      return true;
    });
  }, [productionList, deferredFilters, deferredLocationFilter]);

  // ================= DROPDOWN OPTIONS (single pass, memoized) =================
  const dropdownOptions = useMemo(() => {
    const productTypes = new Set();
    const customerNames = new Set();
    const machineNames = new Set();

    for (let i = 0; i < productionList.length; i++) {
      const item = productionList[i];
      if (item.productType) productTypes.add(item.productType);
      if (item.customerName) customerNames.add(item.customerName);
      item.machiness?.forEach(pair => machineNames.add(pair.machineId?.machineName));
    }

    return {
      productTypes: [...productTypes],
      customerNames: [...customerNames],
      machineNames: [...machineNames]
    };
  }, [productionList]);

    // ================= LAST USED PER ACTIVITY =================
  const lastUsedByActivity = useMemo(() => {
    const map = new Map();

    for (const item of productionList) {
      const dateTs = new Date(item.productionDate).getTime() || 0;
      const savedTs = new Date(item.createdAt).getTime() || 0;

      for (const pair of item.machiness || []) {
        const id = String(pair.activityId?._id || pair.activityId || "");
        if (!id) continue;

        const prev = map.get(id);
        const isNewer =
          !prev ||
          dateTs > prev.dateTs ||
          (dateTs === prev.dateTs && savedTs > prev.savedTs);

        if (isNewer) {
          map.set(id, {
            dateTs,
            savedTs,
            workOrder: item.workOrder,
            machineName: pair.machineId?.machineName || "-",
            customerName: item.customerName || "-",
            shift: item.shift || "-",
            enteredBy: item.enteredBy || "-",
          });
        }
      }
    }
    return map;
  }, [productionList]);

  const formatDate = (ts) => (ts ? new Date(ts).toLocaleDateString("en-IN") : "-");

  const formatWo = (wo) => (Number(wo) === 0 ? "Off Day" : `WO ${wo}`);

  // text shown after the activity name in the dropdown
  const getLastUsedLabel = (activityId) => {
    const info = lastUsedByActivity.get(String(activityId));
    if (!info) return "Never used";
    return `Last used ${formatDate(info.dateTs)} · ${formatWo(info.workOrder)}`;
  };

  // ================= LAST USED PER ACTIVITY + MACHINE =================
  const lastUsedByActivityMachine = useMemo(() => {
    const map = new Map();

    for (const item of productionList) {
      const dateTs = new Date(item.productionDate).getTime() || 0;
      const savedTs = new Date(item.createdAt).getTime() || 0;

      for (const pair of item.machiness || []) {
        const actId = String(pair.activityId?._id || pair.activityId || "");
        const macId = String(pair.machineId?._id || pair.machineId || "");
        if (!actId || !macId) continue;

        const key = `${actId}__${macId}`;
        const prev = map.get(key);
        const isNewer =
          !prev ||
          dateTs > prev.dateTs ||
          (dateTs === prev.dateTs && savedTs > prev.savedTs);

        if (isNewer) {
          map.set(key, {
            dateTs,
            savedTs,
            workOrder: item.workOrder,
            customerName: item.customerName || "-",
            shift: item.shift || "-",
            enteredBy: item.enteredBy || "-",
          });
        }
      }
    }
    return map;
  }, [productionList]);

  // ================= EXPORT PDF: ACTIVITY > MACHINE LAST USED =================
  const exportActivityLastUsedPdf = () => {
    if (!activities.length) {
      showAlert("No activities to export", "warning");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

    doc.setFontSize(16);
    doc.text(
      `Activity & Machine - Last Used Report (${locationFilter || "All Locations"})`,
      40,
      36
    );
    doc.setFontSize(9);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-IN")}   |   Location: ${locationFilter || "All Locations"}`,
      40,
      52
    );

    // use only the selected location's records (all records if none selected)
    const sourceList = locationFilter
      ? productionList.filter((item) => item.userLocations?.includes(locationFilter))
      : productionList;

    if (!sourceList.length) {
      showAlert(`No production records found for ${locationFilter}`, "warning");
      return;
    }

    // local copy built from sourceList; it replaces the global one inside this PDF function only
    const lastUsedByActivityMachine = new Map();

    for (const item of sourceList) {
      const dateTs = new Date(item.productionDate).getTime() || 0;
      const savedTs = new Date(item.createdAt).getTime() || 0;

      for (const pair of item.machiness || []) {
        const actId = String(pair.activityId?._id || pair.activityId || "");
        const macId = String(pair.machineId?._id || pair.machineId || "");
        if (!actId || !macId) continue;

        const key = `${actId}__${macId}`;
        const prev = lastUsedByActivityMachine.get(key);
        const isNewer =
          !prev ||
          dateTs > prev.dateTs ||
          (dateTs === prev.dateTs && savedTs > prev.savedTs);

        if (isNewer) {
          lastUsedByActivityMachine.set(key, {
            dateTs,
            savedTs,
            workOrder: item.workOrder,
            locations: item.userLocations || [],
            customerName: item.customerName || "-",
            shift: item.shift || "-",
            enteredBy: item.enteredBy || "-",
          });
        }
      }
    }

    const body = [];

    activities.forEach((activity) => {
      const machineIds = (activity.machines || []).map(String);
      const activityMachines = machines.filter((m) =>
        machineIds.includes(String(m._id))
      );

      // activity with no machines still gets one row
      if (activityMachines.length === 0) {
        body.push([
          { content: activity.activityName || "-", styles: { fontStyle: "bold", valign: "middle" } },
          "-", "Never used", "-", "-", "-", "-", "-", "-",
        ]);
        return;
      }

      activityMachines.forEach((m, idx) => {
        const info = lastUsedByActivityMachine.get(`${activity._id}__${m._id}`);

        const row = [
          m.machineName || "-",
          info ? formatDate(info.dateTs) : "Never used",
          info ? formatWo(info.workOrder) : "-",
          info?.customerName || "-",
          info?.shift || "-",
          info?.enteredBy || "-",
          info ? new Date(info.savedTs).toLocaleString("en-IN") : "-",
          info?.locations?.join(", ") || "-",
        ];

        // activity name once, merged across all its machine rows
        if (idx === 0) {
          row.unshift({
            content: activity.activityName || "-",
            rowSpan: activityMachines.length,
            styles: { fontStyle: "bold", valign: "middle", halign: "center" },
          });
        }

        body.push(row);
      });
    });

    autoTable(doc, {
      startY: 64,
      head: [[
        "Activity", "Machine", "Production Date", "Work Order",
        "Customer", "Shift", "Entered By", "Last Used On", "Location",
      ]],
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, valign: "middle", textColor: [0, 0, 0] },
      headStyles: { fillColor: [6, 76, 115], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 90 },
        4: { cellWidth: 150 },
      },
      // highlight machines never used under that activity
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          data.column.index === 2 &&
          data.cell.text[0] === "Never used"
        ) {
          data.cell.styles.textColor = [200, 0, 0];
        }
      },

    });

    doc.save(
      locationFilter
        ? `Activity_Machine_Last_Used_${locationFilter.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
        : "Activity_Machine_Last_Used.pdf"
    );
  };

  // ================= EXPORT EXCEL: ACTIVITY > MACHINE LAST USED =================
  const exportActivityLastUsedExcel = () => {
    if (!activities.length) {
      showAlert("No activities to export", "warning");
      return;
    }

    // use only the selected location's records (all records if none selected)
    const sourceList = locationFilter
      ? productionList.filter((item) => item.userLocations?.includes(locationFilter))
      : productionList;

    if (!sourceList.length) {
      showAlert(`No production records found for ${locationFilter}`, "warning");
      return;
    }

    // local copy built from sourceList; it replaces the global one inside this Excel function only
    const lastUsedByActivityMachine = new Map();

    for (const item of sourceList) {
      const dateTs = new Date(item.productionDate).getTime() || 0;
      const savedTs = new Date(item.createdAt).getTime() || 0;

      for (const pair of item.machiness || []) {
        const actId = String(pair.activityId?._id || pair.activityId || "");
        const macId = String(pair.machineId?._id || pair.machineId || "");
        if (!actId || !macId) continue;

        const key = `${actId}__${macId}`;
        const prev = lastUsedByActivityMachine.get(key);
        const isNewer =
          !prev ||
          dateTs > prev.dateTs ||
          (dateTs === prev.dateTs && savedTs > prev.savedTs);

        if (isNewer) {
          lastUsedByActivityMachine.set(key, {
            dateTs,
            savedTs,
            workOrder: item.workOrder,
            locations: item.userLocations || [],
            customerName: item.customerName || "-",
            shift: item.shift || "-",
            enteredBy: item.enteredBy || "-",
          });
        }
      }
    }

    const aoa = [[
      "Activity", "Machine", "Production Date", "Work Order",
      "Customer", "Shift", "Entered By", "Last Used On", "Location",
    ]];
    const merges = [];

    activities.forEach((activity) => {
      const machineIds = (activity.machines || []).map(String);
      const activityMachines = machines.filter((m) =>
        machineIds.includes(String(m._id))
      );

      // activity with no machines still gets one row
      if (activityMachines.length === 0) {
        aoa.push([activity.activityName || "-", "-", "Never used", "-", "-", "-", "-", "-", "-"]);
        return;
      }

      const startRow = aoa.length;

      activityMachines.forEach((m, idx) => {
        const info = lastUsedByActivityMachine.get(`${activity._id}__${m._id}`);

        aoa.push([
          idx === 0 ? activity.activityName || "-" : "",
          m.machineName || "-",
          info ? formatDate(info.dateTs) : "Never used",
          info ? formatWo(info.workOrder) : "-",
          info?.customerName || "-",
          info?.shift || "-",
          info?.enteredBy || "-",
          info ? new Date(info.savedTs).toLocaleString("en-IN") : "-",
          info?.locations?.join(", ") || "-",
        ]);
      });

      // merge the activity name across all its machine rows
      if (activityMachines.length > 1) {
        merges.push({
          s: { r: startRow, c: 0 },
          e: { r: startRow + activityMachines.length - 1, c: 0 },
        });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;
    ws["!cols"] = [
      { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 14 },
      { wch: 34 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    ];

    const side = { style: "thin", color: { rgb: "000000" } };
    const border = { top: side, bottom: side, left: side, right: side };
    const range = XLSX.utils.decode_range(ws["!ref"]);

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };

        const isHeader = r === 0;
        const neverUsed = !isHeader && c === 2 && ws[addr].v === "Never used";

        ws[addr].s = {
          border,
          alignment: {
            vertical: "center",
            horizontal: isHeader || c === 0 ? "center" : "left",
            wrapText: true,
          },
          font: {
            bold: isHeader || c <= 1,
            ...(neverUsed ? { color: { rgb: "C80000" } } : {}),
          },
          ...(isHeader ? { fill: { fgColor: { rgb: "9FC3E3" } } } : {}),
        };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activity Machine Last Used");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      locationFilter
        ? `Activity_Machine_Last_Used_${locationFilter.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`
        : "Activity_Machine_Last_Used.xlsx"
    );
  };
  const formatReportNumber = (value, hasEntry = false) => {
    const numericValue = Number(value) || 0;
    if (numericValue === 0) return hasEntry ? "0" : "-";
    return numericValue.toLocaleString("en-IN");
  };

  const getReportDateLabel = () => {
    if (filters.dateFrom && filters.dateTo) {
      return `${new Date(filters.dateFrom).toLocaleDateString("en-IN")} to ${new Date(filters.dateTo).toLocaleDateString("en-IN")}`;
    }

    if (filters.dateFrom) {
      return `From ${new Date(filters.dateFrom).toLocaleDateString("en-IN")}`;
    }

    if (filters.dateTo) {
      return `To ${new Date(filters.dateTo).toLocaleDateString("en-IN")}`;
    }

    if (filters.month) {
      const [year, month] = filters.month.split("-");
      return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
      });
    }

    return "All Dates";
  };

  const buildProductionSummary = () => {


    const groupMap = new Map();

    // seed every activity with all of its machines (zero values by default)
    activities.forEach((activity) => {
      const activityName = activity.activityName || "-";
      const activityMachineIds = (activity.machines || []).map(String);

      machines
        .filter((m) => activityMachineIds.includes(String(m._id)))
        .forEach((m) => {
          const machineName = m.machineName || "-";

          if (!groupMap.has(activityName)) {
            groupMap.set(activityName, { activityName, rows: new Map() });
          }

          const group = groupMap.get(activityName);
          const rowKey = `${activityName}__${machineName}`;

          if (!group.rows.has(rowKey)) {
            group.rows.set(rowKey, {
              machineName,
              dayQty: 0,
              nightQty: 0,
              dayEntered: false,
              nightEntered: false,
              prodMins: 0,
              idleMins: 0,
              breakdownMins: 0,
              maintMins: 0,
              dayRemarks: new Set(),
              nightRemarks: new Set()
            });
          }
        });
    });

    filteredProductionList.forEach((item) => {
      const pairs = item.machiness?.length
        ? item.machiness
        : [{ activityId: { activityName: "-" }, machineId: { machineName: "-" } }];

      pairs.forEach((pair) => {
        const activityName = pair.activityId?.activityName || "-";
        const machineName = pair.machineId?.machineName || "-";
        const groupKey = activityName;
        const rowKey = `${activityName}__${machineName}`;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            activityName,
            rows: new Map()
          });
        }

        const group = groupMap.get(groupKey);

        if (!group.rows.has(rowKey)) {
          group.rows.set(rowKey, {
            machineName,
            dayQty: 0,
            nightQty: 0,
            dayEntered: false,
            nightEntered: false,
            prodMins: 0,
            idleMins: 0,
            breakdownMins: 0,
            maintMins: 0,
            dayRemarks: new Set(),
            nightRemarks: new Set()
          });
        }

        const reportRow = group.rows.get(rowKey);
        const productionImpression =
          Number(item.productionImpression) || 0;
        const remarks = item.remarks?.trim();
        const shift = String(item.shift || "").toLowerCase();

        // machine hours by status (production / idle / breakdown / maintenance)
        const durMins = getDurationMins(item.productionFromTime, item.productionToTime);
        const statusKey = String(item.machineStatus || "").toLowerCase();
        if (statusKey === "production" || statusKey === "working") {
          reportRow.prodMins += durMins;
        } else if (statusKey === "idle" || statusKey === "idle time") {
          reportRow.idleMins += durMins;
        } else if (statusKey.includes("break")) {
          reportRow.breakdownMins += durMins;
        } else if (statusKey.includes("maint")) {
          reportRow.maintMins += durMins;
        }

        if (shift === "day") {
          reportRow.dayQty += productionImpression;
          reportRow.dayEntered = true;

          if (remarks) {
            reportRow.dayRemarks.add(remarks);
          }
        } else if (shift === "night") {
          reportRow.nightQty += productionImpression;
          reportRow.nightEntered = true;

          if (remarks) {
            reportRow.nightRemarks.add(remarks);
          }
        }
      });
    });

    return Array.from(groupMap.values())
      .filter((group) =>
        !String(group.activityName || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .includes("persoprinting")
      )
      .map((group) => ({
      ...group,
      rows: Array.from(group.rows.values()).map((row) => ({
        ...row,
        dayRemarks: Array.from(row.dayRemarks).join(", ") || "-",
        nightRemarks: Array.from(row.nightRemarks).join(", ") || "-",
        grandTotal: row.dayQty + row.nightQty,
        totalMins: row.prodMins + row.idleMins + row.breakdownMins + row.maintMins
      }))
    }));
  };

  // still only computed while the Summary view is on screen
  const productionSummaryReport = useMemo(
    () => (recordsView === "summary" ? buildProductionSummary() : []),
    [recordsView, filteredProductionList, activities, machines]
  );

  // ================= JWT =================
  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name);
      setLoggedInUserId(decoded.id || decoded._id || "");

      // If your decoded token contains locations
      if (decoded.locations) {
        setUserLocations(decoded.locations);
      }
      // OR fetch from backend
      else {
        axios
          .get(`${BASE_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => setUserLocations(res.data.locations || []))
          .catch((err) => console.error("Error fetching user locations:", err));
      }
    }
  }, [token]);

  // ================= MACHINES ALLOWED FOR THE USER'S LOCATION(S) =================
  useEffect(() => {
    if (!userLocations.length) {
      setAllowedMachineIds(null);
      return;
    }
    axios
      .get(`${BASE_URL}/api/master/locations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const ids = new Set();
        (res.data || [])
          .filter((l) => userLocations.includes(l.locationName))
          .forEach((l) => (l.machines || []).forEach((m) => ids.add(String(m._id || m))));
        setAllowedMachineIds(ids.size ? ids : null);
      })
      .catch((err) => console.error("Error fetching location machines:", err));
  }, [userLocations, token]);

  // ================= FETCH ACTIVITIES =================
  const fetchActivities = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/master/activities`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActivities(res.data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    }
  };
  const fetchProductionReal = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/production-real`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // 🔥 Sort latest first (createdAt is an ISO string, so a plain string
      // compare gives the same order without building 2 Dates per comparison)
      const sorted = res.data.sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
      );

      setProductionList(sorted);

      // single pass, no intermediate flatMap array
      const locSet = new Set();
      for (let i = 0; i < res.data.length; i++) {
        const locs = res.data[i].userLocations;
        if (locs) for (let j = 0; j < locs.length; j++) if (locs[j]) locSet.add(locs[j]);
      }
      setLocationOptions([...locSet]);
    } catch (err) {
      console.error("Error fetching Production:", err);
    }
  };
  // ================= FETCH MACHINES =================
  const fetchMachines = async () => {
    try {
      const res = await axios.get(
        `${BASE_URL}/api/master/machines`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMachines(res.data || []);
    } catch (err) {
      console.error("Error fetching machines:", err);
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchMachines();
    fetchMachineStatuses(); // 👈 ADD THIS
    fetchProductionReal();
  }, [token]);

  const exportToExcel = () => {

    // Summary view -> download ONLY the Summary Report
    if (recordsView === "summary") {
      const summarySheet = buildSummarySheet();
      if (!summarySheet) {
        showAlert("No summary data to export", "warning");
        return;
      }
      const summaryBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(summaryBook, summarySheet, "Summary Report");
      const summaryBuffer = XLSX.write(summaryBook, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([summaryBuffer], { type: "application/octet-stream" }),
        "Production_Summary.xlsx"
      );
      return;
    }

    const excelData = filteredProductionList.map((item, index) => ({

      "SL NO": index + 1,
      "WO No": item.workOrder,
      "Customer": item.customerName,
      "Job Description": item.jobDescription,
      "Job Size": item.jobSize,
      "PlannerUPS": Array.isArray(item.ups)
        ? item.ups
          .filter(v => v !== 0 && v !== null && v !== undefined && v !== "")
          .join(", ")
        : item.ups || "",
      "Product Type": item.productType || "-",
      "Date": new Date(item.productionDate).toLocaleDateString("en-IN"),
      "Shift": item.shift,
      "Machine status": item.machineStatus,
      "From Time (12H)": formatTime12Hour(item.productionFromTime),
      "To Time (12H)": formatTime12Hour(item.productionToTime),

      "Stage": item.machiness
        ?.map(pair => pair.activityId?.activityName)
        .join(", ") || "-",

      "Machine": item.machiness
        ?.map(pair => pair.machineId?.machineName)
        .join(", ") || "-",

      "Material Code": item.materials
        ?.map(m => m.materialCode)
        .join(", ") || "-",

      "Material Description": item.materials
        ?.map(m => m.materialDescription)
        .join(", ") || "-",

      "Material Group": item.materials
        ?.map(m => m.materialGroupDescription)
        .join(", ") || "-",

      "Mill": item.materials
        ?.map(m => m.mill)
        .join(", ") || "-",

      "GSM": item.materials?.map(m => m.gsm).join(", ") || "-",
      "PaperSize": item.materials?.map(m => m.paperSize).join(", ") || "-",
      "Order Qty": item.liveOrderQty ?? item.orderQty,
      "Production Impression": item.productionImpression || "-",
      "Waste Impression": item.wasteImpression || "-",
      "Production UPS": item.productionUps || "-",
      "Pages": item.pages || "-",

      "Production Qty": item.productionQty,
      "Wastage Qty": item.wastageQty,
      "Waste %": item.productionQty
        ? ((item.wastageQty / item.productionQty) * 100).toFixed(2) + "%"
        : "0%",

      "Entered By": item.enteredBy,
      "Created Date & Time": new Date(item.createdAt).toLocaleString(),

      "Remarks": item.remarks || "-"

    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ProductionReal");



    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array"
    });

    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "Production.xlsx");
  };

  // ================= SUMMARY SHEET (used by exportToExcel) =================
  const buildSummarySheet = () => {
    const summary = buildProductionSummary();
    if (!summary.length) return null;

    const aoa = [
      ["DEI Machine", "Machine", `Date ${getReportDateLabel()}`, "", "", "", "", "Machine Hours", "", "", "", ""],
      ["", "", "Day Shift", "Remarks", "Night Shift", "Remarks", "Grand Total",
        "Production Time", "Idle Time", "Breakdown Time", "Maintenance Time", "Total Timings"]
    ];

    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 0, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 0, c: 11 } }
    ];

    summary.forEach((group) => {
      const startRow = aoa.length;

      group.rows.forEach((row, rowIndex) => {
        aoa.push([
          rowIndex === 0 ? group.activityName : "",
          row.machineName,
          row.dayEntered ? row.dayQty : "-",
          row.dayRemarks,
          row.nightEntered ? row.nightQty : "-",
          row.nightRemarks,
          (row.dayEntered || row.nightEntered) ? row.grandTotal : "-",
          formatHMS(row.prodMins),
          formatHMS(row.idleMins),
          formatHMS(row.breakdownMins),
          formatHMS(row.maintMins),
          formatHMS(row.totalMins)
        ]);
      });

      if (group.rows.length > 1) {
        merges.push({
          s: { r: startRow, c: 0 },
          e: { r: startRow + group.rows.length - 1, c: 0 }
        });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;
    ws["!cols"] = [
      { wch: 16 }, { wch: 24 }, { wch: 12 },
      { wch: 38 }, { wch: 12 }, { wch: 38 }, { wch: 14 },
      { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 14 }
    ];

    const side = { style: "thin", color: { rgb: "000000" } };
    const border = { top: side, bottom: side, left: side, right: side };
    const range = XLSX.utils.decode_range(ws["!ref"]);

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };

        const isHeader = r < 2;
        const isNumberCol = c === 2 || c === 4 || c === 6;

        ws[addr].s = {
          border,
          alignment: {
            vertical: "center",
            horizontal: isHeader ? "center" : isNumberCol ? "right" : "center",
            wrapText: true
          },
          font: { bold: isHeader || c <= 1 },
          ...(isHeader ? { fill: { fgColor: { rgb: "9FC3E3" } } } : {})
        };

        if (!isHeader && isNumberCol && typeof ws[addr].v === "number") {
          ws[addr].z = "#,##0";
        }
      }
    }

    return ws;
  };

  const filteredMachinesForPair = (activityId) => {
    if (!activityId) return [];

    const activity = activities.find(a => a._id === activityId);
    if (!activity?.machines) return [];

    return machines.filter(m =>
      activity.machines.map(String).includes(String(m._id)) &&
      (!allowedMachineIds || allowedMachineIds.has(String(m._id)))
    );
  };

  // ================= HANDLE ACTIVITY CHANGE =================
  const handleActivityChange = (index, value) => {
    const pairs = [...activityMachinePairs];
    pairs[index].activityId = value;
    pairs[index].machineId = "";
    setActivityMachinePairs(pairs);
  };

  const handleMachineChangeForPair = (index, value) => {
    const pairs = [...activityMachinePairs];
    pairs[index].machineId = value;
    setActivityMachinePairs(pairs);

    if (index === 0) {
      const selectedMachine = machines.find((m) => m._id === value);
      const machineUpsList =
        selectedMachine?.fixed && Array.isArray(selectedMachine?.ups)
          ? selectedMachine.ups
          : [];
      setAllowedProductionUps(machineUpsList);

      setForm((prev) => ({
        ...prev,
        productionUps: "",
        productionQty: "",
        wastageQty: "",
        quantity2: "",
      }));
      setWastePercent(0);
    }
  };

  const addActivityMachinePair = () => {
    setActivityMachinePairs(prev => [
      ...prev,
      { activityId: "", machineId: "" }
    ]);
  };

  const removeActivityMachinePair = (index) => {
    setActivityMachinePairs(prev =>
      prev.filter((_, i) => i !== index)
    );
  };

  // ================= FETCH WORK ORDER =================
  const fetchWorkOrder = async () => {
    if (!form.workOrderNo) return showAlert("Enter Work Order No", "warning");

    try {
      const res = await axios.get(
        `${BASE_URL}/api/production/workorder/${form.workOrderNo}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );


      setWorkOrderDetails({
        ...res.data,
        orderQty: res.data.orderQty
      });
      setShowEntryModal(true);

      // Auto-select when there's exactly one material; otherwise force a manual pick
      setSelectedMaterialIndex(
        res.data.materials?.length === 1 ? 0 : ""
      );

      // Reset activity rows
      setActivityMachinePairs([{ activityId: "", machineId: "" }]);

    } catch {
      showAlert("Work Order not found", "error");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (
      name === "productionQty" ||
      name === "wastageQty" ||
      name === "productionImpression" ||
      name === "wasteImpression" ||
      name === "productionUps"
    ) {
      if (
        value.includes("-") ||
        value.includes("+") ||
        value.toLowerCase().includes("e")
      ) {
        showAlert("Invalid characters are not allowed", "warning");
        return;
      }

      if (
        name === "productionUps" &&
        value !== "" &&
        allowedProductionUps.length > 0 &&
        !allowedProductionUps.map(String).includes(String(Number(value)))
      ) {
        showAlert(`UPS must be one of: ${allowedProductionUps.join(", ")}`, "warning");
        return;
      }
      if (name === "machineStatus" && value.toLowerCase() !== "production") {
        setForm((prev) => ({
          ...prev,
          machineStatus: value,
          productionQty: "",
          wastageQty: "",
          productionImpression: "",
          wasteImpression: "",
          productionUps: ""
        }));
        setWastePercent(0);
        return;
      }
    }

    if (name === "remarks") {
      const remarksRegex = /^[a-zA-Z0-9 ]*$/;
      if (!remarksRegex.test(value)) {
        showAlert("Special characters are not allowed", "error");
        return;
      }
    }

    // Build updated form using current values + new value
    const updatedForm = { ...form, [name]: value };

    const prodImp = Number(updatedForm.productionImpression);
    const wasteImp = Number(updatedForm.wasteImpression);
    const ups = Number(updatedForm.productionUps);
    const pagesVal = Number(updatedForm.pages);
    const orderQtyForCalc = Number(workOrderDetails?.orderQty) || 0;

    let rawProductionQty = "";
    let calculatedProductionQty = "";
    let calculatedWastageQty = "";
    let calculatedQuantity2 = "";

    if (ups > 0) {
      if (prodImp > 0) rawProductionQty = prodImp * ups;
      if (wasteImp > 0) calculatedWastageQty = wasteImp * ups;
    }

    calculatedProductionQty = getProductionQty(rawProductionQty);
    calculatedQuantity2 = getQuantity2(rawProductionQty, pagesVal);

    // Single setForm call with everything
    setForm((prev) => ({
      ...prev,
      [name]: value,
      productionQty: calculatedProductionQty,
      wastageQty: calculatedWastageQty,
      quantity2: calculatedQuantity2
    }));

    // Calculate waste % from local variables only
    const finalProd = Number(calculatedProductionQty);
    const finalWaste = Number(calculatedWastageQty);

    if (finalProd > 0) {
      setWastePercent(((finalWaste / finalProd) * 100).toFixed(2));
    } else {
      setWastePercent(0);
    }
  };
  // ================= SUBMIT =================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isOffDay && !workOrderDetails) return showAlert("Fetch Work Order first", "warning");

    if (!isOffDay && !selectedMaterial) {
      showAlert("Select a Material Code", "warning");
      return;
    }

    // validate all activity-machine pairs
    for (let i = 0; i < activityMachinePairs.length; i++) {
      const pair = activityMachinePairs[i];
      if (!pair.activityId || !pair.machineId) {
        showAlert(`Select activity & machine`, "warning");
        return;
      }
    }

    // ✅ moved up so it's available for the quantity validations below
    const workOrderNumber = isOffDay
      ? 0
      : Number(workOrderDetails.efiWoNumber || form.workOrderNo);
    if (!isOffDay && !workOrderNumber) return showAlert("Invalid Work Order Number", "error");

    const sheetFedSelected = isSheetFedSelected();

    // 🚫 Production Qty cannot be 0
    if (
      form.machineStatus?.toLowerCase() === "production" &&
      Number(form.productionQty) === 0
    ) {
      showAlert("Production Quantity cannot be 0", "warning");
      return;
    }

    // 🚫 Per-activity cumulative validation (same Work Order + same Material Code + same Activity)
    // Each activity gets its own limit = Order Qty + 10%. Saving again for the same activity
    // is blocked if the running total would go past that limit.
    if (form.machineStatus?.toLowerCase() === "production") {
      const orderQty = Number(workOrderDetails?.orderQty) || 0;
      const maxAllowedQty = orderQty * 1.50;

      // quantity that counts toward the limit for ONE entry (same as your existing logic)
      // sheet fed  -> productionQty
      // has pages  -> quantity2 (booklet quantity)
      // otherwise  -> productionQty
      const qtyForLimit = ({ productionQty, quantity2, pages }) => {
        if (sheetFedSelected) return Number(productionQty) || 0;
        if (Number(pages) > 0) return Number(quantity2) || 0;
        return Number(productionQty) || 0;
      };

      if (orderQty > 0) {
        for (const pair of activityMachinePairs) {
          const pairActivity = activities.find(
            (a) => String(a._id) === String(pair.activityId)
          );

          // already-saved quantity for this WO + material + SAME activity
          const existingTotal = productionList.reduce((sum, item) => {
            if (editingId && item._id === editingId) return sum;

            if (String(item.workOrder) !== String(workOrderNumber)) return sum;

            const sameMaterial = item.materials?.some(
              (m) => m.materialCode === selectedMaterial?.materialCode
            );
            if (!sameMaterial) return sum;

            const sameActivity = item.machiness?.some(
              (m) =>
                String(m.activityId?._id || m.activityId) === String(pair.activityId)
            );
            if (!sameActivity) return sum;

            return (
              sum +
              qtyForLimit({
                productionQty: item.productionQty,
                quantity2: item.quantity2,
                pages: item.pages,
              })
            );
          }, 0);

          const currentQty = qtyForLimit({
            productionQty: form.productionQty,
            quantity2: form.quantity2,
            pages: form.pages,
          });

          const totalQty = existingTotal + currentQty;

          if (totalQty > maxAllowedQty) {
            showAlert(
              `${pairActivity?.activityName || "Activity"}: total Production Quantity for this WO & Material (${totalQty.toFixed(2)}) exceeds allowed limit (${maxAllowedQty.toFixed(2)} = Order Qty ${orderQty} +50%).`,
              "warning"
            );
            return;
          }
        }
      }
    }

    // ✅ Remarks mandatory only when wastage > production
    if (
      form.machineStatus?.toLowerCase() === "production" &&
      Number(form.wastageQty) > Number(form.productionQty) &&
      (!form.remarks || form.remarks.trim() === "")
    ) {
      showAlert(
        "Remarks is mandatory when Wastage is greater than Production Quantity",
        "warning"
      );
      return;
    }

    for (const pair of activityMachinePairs) {

      // current entry start/end
      const currentStart = new Date(
        `${form.productionDate}T${form.productionFromTime}`
      );

      const currentEnd = new Date(
        `${form.productionDate}T${form.productionToTime}`
      );

      // handle midnight crossing
      if (currentEnd < currentStart) {
        currentEnd.setDate(currentEnd.getDate() + 1);
      }

      // current entry hours
      const currentHours =
        (currentEnd - currentStart) / (1000 * 60 * 60);

      let totalHours = currentHours;

      // same day same machine entries
      const sameMachineEntries = productionList.filter((item) => {

        // skip current editing row
        if (editingId && item._id === editingId) {
          return false;
        }

        const sameMachine = item.machiness?.some(
          (m) =>
            String(m.machineId?._id || m.machineId) ===
            String(pair.machineId)
        );

        if (!sameMachine) return false;

        const itemDate = new Date(item.productionDate)
          .toISOString()
          .split("T")[0];

        return itemDate === form.productionDate;
      });

      // add existing hours
      sameMachineEntries.forEach((item) => {

        const existingStart = new Date(
          `${new Date(item.productionDate)
            .toISOString()
            .split("T")[0]}T${item.productionFromTime}`
        );

        const existingEnd = new Date(
          `${new Date(item.productionDate)
            .toISOString()
            .split("T")[0]}T${item.productionToTime}`
        );

        if (existingEnd < existingStart) {
          existingEnd.setDate(existingEnd.getDate() + 1);
        }

        const existingHours =
          (existingEnd - existingStart) /
          (1000 * 60 * 60);

        totalHours += existingHours;
      });

      // BLOCK if > 24 hrs
      if (totalHours > 24) {

        const machineName =
          sameMachineEntries[0]?.machiness?.find(
            (m) =>
              String(m.machineId?._id || m.machineId) ===
              String(pair.machineId)
          )?.machineId?.machineName || "Machine";

        showAlert(
          `${machineName} exceeds 24 hours `,
          "warning"
        );

        return;
      }
    }

    try {
      const payload = {
        workOrder: workOrderNumber,
        currentStage: activities.find(
          (a) => a._id === activityMachinePairs[0].activityId
        )?.activityName,
        machine: activityMachinePairs[0].machineId,
        productionDate: form.productionDate,
        productionFromTime: form.productionFromTime,
        productionToTime: form.productionToTime,
        shift: form.shift,
        productType: workOrderDetails?.productType || "",
        colorFront: workOrderDetails?.colorFront || 0,
        colorBack: workOrderDetails?.colorBack || 0,
        machineStatus: form.machineStatus,
        productionQty: form.machineStatus?.toLowerCase() === "production" ? Number(form.productionQty) : 0,
        wastageQty: form.machineStatus?.toLowerCase() === "production" ? Number(form.wastageQty) : 0,
        wastePercent: form.machineStatus?.toLowerCase() === "production" ? Number(wastePercent) : 0,
        quantity2:
          form.machineStatus?.toLowerCase() === "production" && Number(selectedPages) > 0
            ? (Number(form.quantity2) || 0)
            : 0,
        remarks: form.remarks,
        customerName: isOffDay ? "" : workOrderDetails.customerName,
        jobDescription: isOffDay ? "" : workOrderDetails.jobDescription,
        jobSize: workOrderDetails?.jobSize || "",
        materials: selectedMaterial ? [selectedMaterial] : [],
        ups: isOffDay ? [] : toUpsArray(selectedUps),
        productionImpression: Number(form.productionImpression),
        wasteImpression: Number(form.wasteImpression),
        productionUps: Number(form.productionUps),
        pages: Number(selectedPages) || 0,
        orderQty: workOrderDetails?.orderQty || 0,
        machiness: activityMachinePairs.map((pair) => ({
          activityId: pair.activityId,
          machineId: pair.machineId,
        })),
        enteredBy: loggedInUser,
        locations: userLocations,
      };

      // ✅ EDIT MODE
      if (editingId) {
        await axios.put(
          `${BASE_URL}/api/production-real/${editingId}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        showAlert("Production Updated Successfully ✅", "success");
      }
      // ✅ CREATE MODE
      else {
        await axios.post(
          `${BASE_URL}/api/production-real`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        showAlert("Production Saved Successfully ✅", "success");
      }

      fetchProductionReal();

      const wasEditing = !!editingId;

      // reset form – keep WO number + production date (same as Reel Register)
      setForm((prev) => ({
        workOrderNo: prev.workOrderNo,
        productionDate: prev.productionDate,
        productionFromTime: "",
        productionToTime: "",
        shift: "",
        machineStatus: "",
        productionImpression: "",
        wasteImpression: "",
        productionUps: "",
        productionQty: "",
        wastageQty: "",
        pages: selectedPages,
        quantity2: "",
        remarks: "",
      }));

      setWastePercent(0);
      setActivityMachinePairs([{ activityId: "", machineId: "" }]);
      setEditingId(null);

      // after an EDIT the work order details are only a partial copy of the
      // saved record, so clear them (WO number and date stay; click Fetch again).
      // after a NEW entry keep the fetched work order on screen.
      if (wasEditing) {
        setWorkOrderDetails(null);
        setSelectedMaterialIndex("");
      }

    } catch (err) {
      console.error("Error saving Production :", err);
      showAlert("Error saving Production", "error");
    }
  };
  const formatTime12Hour = (time) => {
    if (!time) return "";

    const [hour, minute] = time.split(":");
    let h = parseInt(hour);
    const ampm = h >= 12 ? "PM" : "AM";

    h = h % 12;
    h = h ? h : 12; // 0 becomes 12

    return `${h}:${minute} ${ampm}`;
  };

  // only the rows of the current page are drawn in the Detailed view
  const totalPages = Math.max(1, Math.ceil(filteredProductionList.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const detailRows = filteredProductionList.slice((safePage - 1) * pageSize, safePage * pageSize);

  const goToPage = (n) => {
    setPage(Math.min(Math.max(n, 1), totalPages));
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
  };

  // presentation-only helper for the Waste Overview donut
  const wastePct = Math.min(100, Math.max(0, Number(wastePercent) || 0));

  return (
    <div className="container mt-2 production-dashboard-page">
      <style>{`
        /* =====================================================================
           LIGHT AQUA-GLASS DESIGN (same family as the User Management page)
           ===================================================================== */
        .production-dashboard-page.container {
          --ink: #0b2f4f; --muted: #4a6f8c; --hint: #8fb0c8;
          max-width: 100% !important;
          min-height: 100vh;
          margin-top: 0 !important;
          padding: 12px 20px 30px;
          font-size: 14px;
          color: var(--ink);
          font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
          background:
            radial-gradient(circle at 12% 6%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%),
            radial-gradient(circle at 88% 18%, rgba(160,222,250,0.7) 0, rgba(160,222,250,0) 32%),
            radial-gradient(circle at 50% 100%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 45%),
            linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%) !important;
          border: none;
          border-radius: 0;
        }

        /* ---------- Header with round emblem ---------- */
        .production-dashboard-page .pd-header {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
          padding: 8px 22px; margin-bottom: 12px; border-radius: 28px; border-bottom: none;
          background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(222,244,254,0.8) 100%);
          border: 1px solid rgba(255,255,255,0.95);
          box-shadow: 0 14px 30px rgba(40,120,170,0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140,210,245,0.2);
        }
        .production-dashboard-page .pd-brand { display: flex; align-items: center; gap: 14px; }
        .production-dashboard-page .pd-emblem {
          width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0a6fb8; font-size: 20px;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
          border: 1px solid #86c6e8; box-shadow: 0 6px 14px rgba(40,120,170,0.22), inset 0 2px 3px rgba(255,255,255,0.9);
        }
        .production-dashboard-page .production-title {
          margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.3px; color: #0a4f8c; line-height: 1.2;
        }
        .production-dashboard-page .pd-subtitle { margin: 0; font-size: 12px; font-weight: 600; color: var(--muted); }
        .production-dashboard-page .pd-offday {
          display: flex; align-items: center; gap: 10px; margin: 0; padding: 6px 16px 6px 14px;
          border: 1px solid #a9d9f2; border-radius: 999px;
          background: linear-gradient(180deg, #ffffff 0%, #dff6ff 100%);
          box-shadow: 0 4px 12px rgba(40,120,170,0.15), inset 0 1px 0 #fff;
        }
        .production-dashboard-page .pd-offday .form-check-input {
          float: none; margin: 0; width: 2.4em; height: 1.2em; cursor: pointer; border-color: #5fb4de;
        }
        .production-dashboard-page .pd-offday .form-check-input:checked { background-color: #1b9be0; border-color: #1b9be0; }
        .production-dashboard-page .pd-offday .form-check-label {
          margin: 0; cursor: pointer; color: #0b2f4f; font-weight: 800; display: inline-flex; align-items: center;
        }

        /* ---------- Glass cards ---------- */
        .production-dashboard-page .card {
          border: 1px solid rgba(255,255,255,0.95) !important;
          border-radius: 22px !important;
          background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(228,246,255,0.9) 100%) !important;
          box-shadow: 0 14px 32px rgba(40,120,170,0.16), inset 0 1px 0 #fff !important;
        }
        .production-dashboard-page .pd-section { margin-bottom: 12px; padding: 0 0 12px; overflow: hidden; }
        .production-dashboard-page .pd-section-head {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          margin: 0 0 10px; padding: 7px 18px;
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%);
          border-bottom: 1px solid #86c6e8; border-radius: 0;
        }
        .production-dashboard-page .pd-section-head h5,
        .production-dashboard-page .pd-section-head h6 {
          margin: 0; padding: 0; color: #08406b !important; font-size: 14.5px; font-weight: 800; letter-spacing: 0.2px;
          display: flex; align-items: center;
        }
        .production-dashboard-page .pd-section-body { padding: 0 18px; }
        .production-dashboard-page .card-header,
        .production-dashboard-page .card-header.bg-primary {
          border: 0; border-bottom: 1px solid #86c6e8 !important; border-radius: 22px 22px 0 0 !important;
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important;
          color: #08406b !important; padding: 8px 20px; font-size: 14.5px;
        }
        .production-dashboard-page .card-header strong { display: inline-flex; align-items: center; color: #08406b; }
        .production-dashboard-page .pd-count {
          font-size: 11.5px; font-weight: 800; padding: 3px 12px; border-radius: 999px;
          background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%); color: #08406b; border: 1px solid #a9d9f2;
        }

        /* ---------- Labels / inputs ---------- */
        .production-dashboard-page .form-label,
        .production-dashboard-page small { color: #0b2f4f !important; font-weight: 800; }
        .production-dashboard-page .form-label {
          display: flex; align-items: center; margin-bottom: 3px; font-size: 12px;
        }
        .production-dashboard-page .form-control,
        .production-dashboard-page .form-select,
        .production-dashboard-page textarea {
          min-height: 36px; border: 1.5px solid #9ccbe6 !important; border-radius: 12px;
          background-color: #fff !important; color: var(--ink); font-weight: 600;
          box-shadow: inset 0 2px 5px rgba(10,80,130,0.1); transition: border-color .18s ease, box-shadow .18s ease;
        }
        .production-dashboard-page textarea { min-height: 58px; resize: vertical; }
        .production-dashboard-page .form-control:hover,
        .production-dashboard-page .form-select:hover { border-color: #5fb4de !important; }
        .production-dashboard-page .form-control:focus,
        .production-dashboard-page .form-select:focus,
        .production-dashboard-page textarea:focus {
          border-color: #1b9be0 !important; box-shadow: 0 0 0 4px rgba(27,155,224,0.2), 0 6px 14px rgba(27,155,224,0.12) !important;
        }
        .production-dashboard-page .form-control:read-only {
          background: linear-gradient(180deg, #eaf7ff 0%, #d6effc 100%) !important; color: #0a4f8c; font-weight: 800; cursor: not-allowed;
        }
        .production-dashboard-page .form-select:disabled { opacity: 0.6; }
        .production-dashboard-page .text-muted { color: var(--muted) !important; }

        /* ---------- Soft glossy buttons ---------- */
        .production-dashboard-page .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          border: 1px solid transparent; border-radius: 12px; font-weight: 800; min-height: 36px;
          transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
        }
        .production-dashboard-page .btn:hover { transform: translateY(-1px); }
        .production-dashboard-page .btn:active { transform: translateY(2px); }
        .production-dashboard-page .btn-sm { min-height: 28px; padding: 3px 12px; }
        .production-dashboard-page .btn .pd-ico { margin-right: 0; opacity: 1; }
        .production-dashboard-page .btn-primary {
          background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%) !important; color: #08406b !important; border-color: #7fc3e8 !important;
          box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40,120,170,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .production-dashboard-page .btn-success {
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%) !important; color: #07583b !important; border-color: #7fd3ab !important;
          box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20,168,112,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .production-dashboard-page .btn-secondary {
          background: linear-gradient(180deg, #ffffff 0%, #dcebf5 100%) !important; color: #34526b !important; border-color: #aac3d4 !important;
          box-shadow: 0 3px 0 #b6cbd9, 0 7px 12px rgba(93,124,147,0.14), inset 0 1px 0 #fff;
        }
        .production-dashboard-page .btn-warning {
          background: linear-gradient(180deg, #fff0c4 0%, #fcd477 100%) !important; color: #7a4f00 !important; border-color: #f3c35a !important;
          box-shadow: 0 3px 0 #e9b845, 0 7px 12px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .production-dashboard-page .btn-danger {
          background: linear-gradient(180deg, #ffdcdc 0%, #f7a3a3 100%) !important; color: #8f1414 !important; border-color: #ee8f8f !important;
          box-shadow: 0 3px 0 #e08a8a, 0 7px 12px rgba(220,38,38,0.15), inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .production-dashboard-page .btn:disabled { opacity: 0.5; transform: none; }

        /* ---------- Icons ---------- */
        .production-dashboard-page .pd-ico {
          width: 15px; height: 15px; margin-right: 6px; flex-shrink: 0; vertical-align: -2px; opacity: 0.9; color: #0a6fb8;
        }
        .production-dashboard-page .btn .pd-ico { color: inherit; }
        .production-dashboard-page .pd-section-head .pd-ico,
        .production-dashboard-page .card-header .pd-ico { width: 17px; height: 17px; margin-right: 8px; color: #0a6fb8; opacity: 1; }

        /* ---------- Entry area (after Fetch / Edit / Off Day) ---------- */
        
        
        .production-dashboard-page .gl-head {
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
          margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed rgba(10,111,184,0.35);
        }
        .production-dashboard-page .gl-head-left { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
        .production-dashboard-page .gl-title { margin: 0; color: #0a4f8c; font-size: 1.2rem; font-weight: 800; line-height: 1.1; }
        .production-dashboard-page .gl-pill {
          display: inline-block; padding: 3px 14px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
          color: #08406b; background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%); border: 1px solid #a9d9f2;
          box-shadow: 0 3px 8px rgba(40,120,170,0.12), inset 0 1px 0 #fff;
        }
        .production-dashboard-page .gl-mini { display: flex; align-items: center; gap: 10px; }
        .production-dashboard-page .gl-donut { flex: 0 0 auto; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .production-dashboard-page .gl-donut-inner {
          width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #fff;
          box-shadow: inset 0 1px 3px rgba(14,86,122,0.2);
        }
        .production-dashboard-page .gl-donut-inner b { color: #062b42; font-size: 0.62rem; line-height: 1; }
        .production-dashboard-page .gl-mini-stats { display: flex; gap: 14px; font-size: 11px; color: var(--muted); font-weight: 700; }
        .production-dashboard-page .gl-mini-stats b { display: block; color: #0a4f8c; font-size: 13px; }

        .production-dashboard-page .gl-inner {
          margin-top: 10px; padding: 9px 12px 11px; border-radius: 18px;
          border: 1px solid #cfe8f6; background: rgba(255,255,255,0.72);
          box-shadow: inset 0 1px 0 #fff, 0 4px 12px rgba(40,120,170,0.08);
        }
        .production-dashboard-page .gl-inner.first { margin-top:10px; }
        .production-dashboard-page .gl-group {
          display: flex; align-items: center; gap: 8px; margin-bottom: 7px; color: #0a4f8c;
          font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;
        }
        .production-dashboard-page .gl-group .pd-ico { color: #0a6fb8; margin-right: 0; width: 16px; height: 16px; opacity: 1; }

        .production-dashboard-page .pd-modal .form-label {
          display: block; margin-bottom: 3px; overflow: hidden; color: #000000 !important;
          font-size: 11px; font-weight: 800; white-space: nowrap; text-overflow: ellipsis;
        }
        .production-dashboard-page .pd-modal .form-label .pd-ico { display: inline-block; }
        .production-dashboard-page .pd-modal .form-control,
        .production-dashboard-page .pd-modal .form-select,
        .production-dashboard-page .pd-modal textarea {
          min-height: 32px; padding: 4px 10px; font-size: 0.82rem; color: var(--ink) !important; color-scheme: light;
        }
        .production-dashboard-page .pd-modal .form-select { padding-right: 26px; }
        .production-dashboard-page .pd-modal textarea { min-height: 58px; height: 58px; resize: none; }
        .production-dashboard-page .pd-modal .form-control::placeholder,
        .production-dashboard-page .pd-modal textarea::placeholder { color: var(--hint); }
        .production-dashboard-page .pd-modal select option { background: #fff; color: #0b2f4f; }

        /* work order summary tiles = soft white cards with pastel icon bubbles */
        .production-dashboard-page .pd-modal .pd-tile {
          height: 100%; padding: 5px 9px; border: 1px solid #dcedf8; border-radius: 14px;
          background: linear-gradient(180deg, #ffffff 0%, #f6fcff 100%);
          box-shadow: 0 4px 10px rgba(40,120,170,0.08), inset 0 1px 0 #fff;
        }
        .production-dashboard-page .pd-modal .pd-tile-label {
          display: flex; align-items: center; margin-bottom: 2px; color: #000000;
          font-size: 0.6rem; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase;
        }
        .production-dashboard-page .pd-modal .pd-tile-label .pd-ico {
          box-sizing: content-box; width: 12px; height: 12px; padding: 4px; margin-right: 7px; border-radius: 9px; opacity: 1;
          box-shadow: 0 3px 7px rgba(40,90,130,0.16), inset 0 1px 2px rgba(255,255,255,0.85);
        }
        .production-dashboard-page .pd-modal .row > div:nth-child(6n+1) .pd-tile-label .pd-ico { background: linear-gradient(145deg,#efe7ff,#c9b8fb); color:#6d4fd6; }
        .production-dashboard-page .pd-modal .row > div:nth-child(6n+2) .pd-tile-label .pd-ico { background: linear-gradient(145deg,#fff0d1,#ffc978); color:#c2650a; }
        .production-dashboard-page .pd-modal .row > div:nth-child(6n+3) .pd-tile-label .pd-ico { background: linear-gradient(145deg,#dcf9ea,#8fe0b8); color:#107a4d; }
        .production-dashboard-page .pd-modal .row > div:nth-child(6n+4) .pd-tile-label .pd-ico { background: linear-gradient(145deg,#e0f3ff,#9fd6f7); color:#0a6fb8; }
        .production-dashboard-page .pd-modal .row > div:nth-child(6n+5) .pd-tile-label .pd-ico { background: linear-gradient(145deg,#ffe4ec,#f9a8c0); color:#be1e55; }
        .production-dashboard-page .pd-modal .row > div:nth-child(6n+6) .pd-tile-label .pd-ico { background: linear-gradient(145deg,#fffbd1,#f6e27a); color:#8a6d00; }
        .production-dashboard-page .pd-modal .pd-tile-value { min-height: 16px; color: #062b42; font-size: 0.82rem; font-weight: 700; line-height: 1.25; word-break: break-word; }
        .production-dashboard-page .pd-modal .pd-tile .form-select { margin-top: 2px !important; }

        .production-dashboard-page .pd-modal .gl-btn {
          width: 100%; padding: 7px 18px; font-size: 0.9rem; letter-spacing: 0.3px;
          background: linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%) !important; color: #07583b !important; border: 1px solid #7fd3ab !important;
          box-shadow: 0 3px 0 #84cba9, 0 7px 12px rgba(20,168,112,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
        }

        /* ---------- Messages / validation toasts must show above the entry popup ---------- */
        .swal2-container { z-index: 5000 !important; }

        /* ---------- Entry popup (split card, same look as Add New User) ---------- */
        .pd-overlay {
          position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 14px;
          background: rgba(40,90,130,0.5); animation: pdFade .18s ease;
        }
        @keyframes pdFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pdPop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
        .pd-modal {
          position: relative; display: flex; width: 100%; max-width: 1280px; max-height: 94vh;
          background: #f7fcff; border-radius: 34px; overflow: hidden; border: 1px solid #fff;
          box-shadow: 0 30px 70px rgba(30,70,110,0.35); animation: pdPop .22s ease;
          font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
        }
        .pd-left {
          position: relative; flex: 0 0 23%; margin: 14px 0 14px 14px; padding: 16px 18px 16px;
          display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;
          border-radius: 28px; border: 5px solid #fff; color: #08406b;
          background:
            radial-gradient(circle at 20% 15%, rgba(255,255,255,0.85) 0, rgba(255,255,255,0) 40%),
            radial-gradient(circle at 80% 85%, rgba(255,214,150,0.55) 0, rgba(255,214,150,0) 45%),
            linear-gradient(160deg, #bfe5f8 0%, #8fd0f0 55%, #6fbbe8 100%);
          box-shadow: 0 10px 30px rgba(40,120,170,0.25), inset 0 2px 0 rgba(255,255,255,0.7);
        }
        .pd-left::after { content: ""; position: absolute; right: -70px; top: -12%; height: 124%; width: 110px; background: #f7fcff; border-radius: 50%; }
        .pd-left-top, .pd-left-center, .pd-left-bottom { position: relative; z-index: 2; }
        .pd-left-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
        .pd-left-label { font-size: 12px; font-weight: 800; letter-spacing: 0.3px; }
        .pd-left-pill {
          font-size: 10.5px; font-weight: 800; padding: 3px 10px; border-radius: 999px;
          background: rgba(255,255,255,0.75); border: 1px solid rgba(255,255,255,0.95); color: #0a4f8c;
        }
        .pd-left-center { text-align: center; padding-right: 20px; }
        .pd-left-emblem {
          width: 70px; height: 70px; margin: 0 auto 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; color: #0a6fb8;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #e4f5ff 55%, #b6e0f6 100%); border: 2px solid #fff;
          box-shadow: 0 14px 30px rgba(10,80,130,0.28), inset 0 3px 5px rgba(255,255,255,0.9);
        }
        .pd-left-center h2 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.4px; color: #07406b; line-height: 1.15; word-break: break-word; }
        .pd-left-center p { margin: 6px auto 0; font-size: 12px; font-weight: 600; color: #1c5a85; line-height: 1.45; }
        .pd-left-stats { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 12px; }
        .pd-left-stat-list { display: flex; flex-direction: column; gap: 2px; text-align: left; font-size: 10.5px; font-weight: 700; color: #1c5a85; }
        .pd-left-stat-list b { margin-left: 6px; color: #07406b; font-size: 12.5px; }
        .production-dashboard-page .gl-donut { flex: 0 0 auto; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
        .pd-left-bottom {
          align-self: flex-start; display: flex; align-items: center; gap: 10px; padding: 5px 14px 5px 5px; border-radius: 999px;
          background: rgba(255,255,255,0.75); border: 1px solid rgba(255,255,255,0.95); box-shadow: 0 6px 16px rgba(40,120,170,0.18);
        }
        .pd-left-avatar {
          width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #c2650a;
          background: linear-gradient(145deg, #fff0d1, #ffc978);
        }
        .pd-left-bottom b { display: block; font-size: 12.5px; font-weight: 800; color: #07406b; line-height: 1.1; }
        .pd-left-bottom small { font-size: 10px; font-weight: 600; color: #2f6d96; }
        .pd-planet { position: absolute; border-radius: 50%; z-index: 1; }
        .pd-planet-1 { width: 100px; height: 100px; right: 4px; top: 56px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.05) 70%); }
        .pd-planet-2 { width: 42px; height: 42px; left: 16px; bottom: 78px; background: radial-gradient(circle at 30% 30%, #ffe3b0, #ffb347 80%); opacity: 0.85; box-shadow: 0 6px 14px rgba(255,160,0,0.3); }
        .pd-right { position: relative; flex: 1; min-width: 0; overflow-y: auto; padding: 16px 26px 20px 12px; }
        .pd-close {
          position: absolute; top: 12px; right: 14px; z-index: 5; width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid #a9d9f2; background: linear-gradient(180deg, #ffffff, #e4f4fd); color: #08406b; font-size: 13px; font-weight: 800; cursor: pointer;
        }
        .pd-close:hover { background: #d6effc; }
        @media (max-width: 900px) { .pd-left { display: none; } .pd-right { padding: 14px; } .pd-modal { max-height: 96vh; border-radius: 24px; } }

        /* ===== ENTRY FORM: FULL SCREEN + LARGER UI ===== */
.production-dashboard-page .pd-overlay { padding: 0; background: #f7fcff; }
.production-dashboard-page .pd-modal {
  max-width: none; width: 100vw; height: 100vh; max-height: 100vh;
  border-radius: 0; border: none; box-shadow: none;
}
.production-dashboard-page .pd-right { padding: 18px 32px 20px 16px; }
.production-dashboard-page .pd-close { top: 14px; right: 20px; width: 42px; height: 42px; font-size: 16px; }

.production-dashboard-page .pd-left { flex: 0 0 20%; margin: 12px 0 12px 12px; padding: 20px; }
.production-dashboard-page .pd-left-label { font-size: 14px; }
.production-dashboard-page .pd-left-pill { font-size: 12px; padding: 4px 12px; }
.production-dashboard-page .pd-left-emblem { width: 84px; height: 84px; font-size: 36px; }
.production-dashboard-page .pd-left-center h2 { font-size: 30px; }
.production-dashboard-page .pd-left-center p { font-size: 14px; }
.production-dashboard-page .pd-left-stat-list { font-size: 13px; }
.production-dashboard-page .pd-left-stat-list b { font-size: 16px; }
.production-dashboard-page .gl-donut { width: 68px; height: 68px; }
.production-dashboard-page .gl-donut-inner { width: 50px; height: 50px; }
.production-dashboard-page .gl-donut-inner b { font-size: 0.8rem; }
.production-dashboard-page .pd-left-avatar { width: 42px; height: 42px; font-size: 20px; }
.production-dashboard-page .pd-left-bottom b { font-size: 14px; }
.production-dashboard-page .pd-left-bottom small { font-size: 12px; }

.production-dashboard-page .gl-title { font-size: 1.7rem; }
.production-dashboard-page .gl-pill { font-size: 13px; padding: 4px 16px; }
.production-dashboard-page .gl-group { font-size: 14px; margin-bottom: 8px; }
.production-dashboard-page .gl-group .pd-ico { width: 18px; height: 18px; }
.production-dashboard-page .gl-inner { margin-top: 12px; padding: 12px 16px 14px; }

.production-dashboard-page .pd-modal .form-label { font-size: 14px; margin-bottom: 4px; }
.production-dashboard-page .pd-modal .form-label .pd-ico { width: 16px; height: 16px; }
.production-dashboard-page .pd-modal .form-control,
.production-dashboard-page .pd-modal .form-select,
.production-dashboard-page .pd-modal textarea {
  min-height: 44px; padding: 6px 12px; font-size: 1rem; border-radius: 12px;
}
.production-dashboard-page .pd-modal .form-select { padding-right: 32px; }
.production-dashboard-page .pd-modal textarea { min-height: 84px; height: 84px; }

.production-dashboard-page .pd-modal .pd-tile { padding: 8px 12px; }
.production-dashboard-page .pd-modal .pd-tile-label { font-size: 0.75rem; margin-bottom: 4px; }
.production-dashboard-page .pd-modal .pd-tile-label .pd-ico { width: 14px; height: 14px; padding: 5px; }
.production-dashboard-page .pd-modal .pd-tile-value { font-size: 1rem; min-height: 20px; }

.production-dashboard-page .pd-modal .gl-btn { min-height: 52px; font-size: 1.15rem; padding: 10px 18px; }

@media (max-height: 800px) {
  .production-dashboard-page .pd-modal .form-control,
  .production-dashboard-page .pd-modal .form-select { min-height: 38px; font-size: 0.92rem; }
  .production-dashboard-page .pd-modal textarea { min-height: 60px; height: 60px; }
  .production-dashboard-page .gl-inner { margin-top: 8px; padding: 9px 14px 11px; }
  .production-dashboard-page .pd-modal .form-label { font-size: 13px; }
  .production-dashboard-page .pd-modal .pd-tile-value { font-size: 0.92rem; }
}
@media (max-width: 900px) {
  .production-dashboard-page .pd-right { padding: 14px; }
}

/* ===== WORK ORDER SUMMARY: COLOURED TILES ===== */
.production-dashboard-page .pd-modal .row > div:nth-child(6n+1) .pd-tile { background: linear-gradient(180deg, #f6f1ff 0%, #e6dcfd 100%); border-color: #d3c4f7; }
.production-dashboard-page .pd-modal .row > div:nth-child(6n+2) .pd-tile { background: linear-gradient(180deg, #fff6e3 0%, #ffe6bd 100%); border-color: #f5d194; }
.production-dashboard-page .pd-modal .row > div:nth-child(6n+3) .pd-tile { background: linear-gradient(180deg, #e9fbf2 0%, #c9f0dd 100%); border-color: #a8e2c5; }
.production-dashboard-page .pd-modal .row > div:nth-child(6n+4) .pd-tile { background: linear-gradient(180deg, #eaf6ff 0%, #cfe9fb 100%); border-color: #a9d6f3; }
.production-dashboard-page .pd-modal .row > div:nth-child(6n+5) .pd-tile { background: linear-gradient(180deg, #fff0f4 0%, #ffdbe6 100%); border-color: #f5b9cc; }
.production-dashboard-page .pd-modal .row > div:nth-child(6n+6) .pd-tile { background: linear-gradient(180deg, #fffbe0 0%, #f8f0b0 100%); border-color: #ecdf84; }
.production-dashboard-page .pd-modal .pd-tile { box-shadow: 0 4px 10px rgba(40,120,170,0.12), inset 0 1px 0 rgba(255,255,255,0.9); }
.production-dashboard-page .pd-modal .pd-tile-value { color: #04243a; font-weight: 800; }

/* ===== WORK ORDER SUMMARY: ONE UNIFORM COLOUR ===== */
.production-dashboard-page .pd-modal .pd-right .gl-inner .row > div .pd-tile {
  background: linear-gradient(180deg, #f4fbff 0%, #d9effc 100%);
  border-color: #a9d9f2;
}
.production-dashboard-page .pd-modal .pd-right .gl-inner .row > div .pd-tile-label .pd-ico {
  background: linear-gradient(145deg, #e0f3ff, #9fd6f7);
  color: #0a6fb8;
}

/* ===== WORK ORDER SUMMARY: COMPACT ===== */
.production-dashboard-page .pd-modal .gl-inner.first { padding: 8px 12px 10px; }
.production-dashboard-page .pd-modal .gl-inner.first .gl-group { font-size: 13px; margin-bottom: 5px; }
.production-dashboard-page .pd-modal .gl-inner.first .gl-group .pd-ico { width: 15px; height: 15px; }
.production-dashboard-page .pd-modal .gl-inner.first .row.g-2 { --bs-gutter-x: 0.45rem; --bs-gutter-y: 0.35rem; }

.production-dashboard-page .pd-modal .gl-inner.first .pd-tile { padding: 4px 10px; border-radius: 12px; }
.production-dashboard-page .pd-modal .gl-inner.first .pd-tile-label { font-size: 0.66rem; margin-bottom: 1px; }
.production-dashboard-page .pd-modal .gl-inner.first .pd-tile-label .pd-ico { width: 11px; height: 11px; padding: 4px; margin-right: 6px; border-radius: 8px; }
.production-dashboard-page .pd-modal .gl-inner.first .pd-tile-value { font-size: 0.9rem; min-height: 16px; line-height: 1.2; }

.production-dashboard-page .pd-modal .gl-inner.first .pd-tile .form-select {
  min-height: 30px; padding: 2px 28px 2px 10px; font-size: 0.88rem; margin-top: 1px !important;
}

/* ---------- Filters ---------- */
        .production-dashboard-page .pd-filter .form-label { margin-bottom: 3px; overflow: hidden; font-size: 11px; white-space: nowrap; text-overflow: ellipsis; display: block; }
        .production-dashboard-page .pd-filter .form-control,
        .production-dashboard-page .pd-filter .form-select { min-height: 32px; padding: 4px 10px; font-size: 0.8rem; }
        .production-dashboard-page .pd-filter .form-select { padding-right: 26px; }
        .production-dashboard-page .pd-filter-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .production-dashboard-page .pd-filter-btns .btn { min-height: 30px; padding: 3px 8px; font-size: 11.5px; line-height: 1.15; }

        /* ---------- View toggle ---------- */
        .production-dashboard-page .report-toggle-wrap { display: flex; justify-content: center; margin-top: 16px; }
        .production-dashboard-page .report-toggle {
          display: inline-flex; padding: 5px; border-radius: 999px;
          background: rgba(255,255,255,0.75); border: 1px solid #cfe8f6; box-shadow: inset 0 1px 0 #fff, 0 6px 16px rgba(40,120,170,0.1);
        }
        .production-dashboard-page .report-toggle .btn { min-width: 160px; border-radius: 999px; }

        /* ---------- Tables ---------- */
        .production-dashboard-page .table-responsive { background: #fff !important; border-radius: 0 0 22px 22px; }
        .production-dashboard-page table { color: var(--ink); background: #fff; margin-bottom: 0; }
        .production-dashboard-page thead th {
          background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important; color: #08406b !important;
          border: 1px solid #7fbfe4 !important; font-size: 12.5px; font-weight: 800; padding: 9px 12px; vertical-align: middle; white-space: nowrap;
        }
        .production-dashboard-page .table > :not(caption) > * > * { box-shadow: none !important; }
        .production-dashboard-page tbody td {
          border: 1px solid #d3e8f4 !important; padding: 7px 12px; vertical-align: middle; font-size: 13px; font-weight: 600;
          background-color: #fff !important; color: var(--ink);
        }
        .production-dashboard-page tbody tr:nth-child(even) td { background-color: #f3faff !important; }
        .production-dashboard-page tbody tr:hover td { background-color: #d9f2fc !important; }
        .production-dashboard-page .pd-status {
          display: inline-block; padding: 3px 12px; border-radius: 999px; font-weight: 800; font-size: 12px;
          background: rgba(255,255,255,0.9); border: 1px solid currentColor;
        }
        .production-dashboard-page .pd-empty { padding: 28px 12px; text-align: center; color: var(--muted); font-weight: 700; }

        /* summary report table */
        .production-dashboard-page .production-summary-table { font-size: 12px; table-layout: fixed; }
        .production-dashboard-page .production-summary-table thead { position: sticky; top: 0; z-index: 2; }
        .production-dashboard-page .production-summary-table th { text-align: center; white-space: normal; font-size: 12px; padding: 8px 4px; word-break: normal; overflow-wrap: normal; }
        .production-dashboard-page .production-summary-table td { padding: 6px 8px; vertical-align: middle; }
        .production-dashboard-page .production-summary-table .report-group-cell,
        .production-dashboard-page .production-summary-table .report-machine-cell { font-weight: 800; text-align: center; color: #0a4f8c; }
        .production-dashboard-page .production-summary-table .report-number-cell { text-align: right; font-variant-numeric: tabular-nums; }
        .production-dashboard-page .production-summary-table .report-remarks-cell {
          font-size: 11px; text-align: center; word-break: break-word; overflow: hidden; text-overflow: ellipsis; max-width: 0;
        }
        .production-dashboard-page .production-summary-table .report-empty-row td { height: 42px; text-align: center; font-weight: 800; }

        /* ---------- Pagination ---------- */
        .production-dashboard-page .pd-pager {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 16px; border-top: 1px solid #cfe8f6; background: rgba(247,253,255,0.98); border-radius: 0 0 22px 22px;
        }
        .production-dashboard-page .pd-pager-info { color: #0b2f4f; font-size: 13px; font-weight: 700; }
        .production-dashboard-page .pd-pager-nav,
        .production-dashboard-page .pd-pager-extra,
        .production-dashboard-page .pd-pager-jump { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .production-dashboard-page .pd-pager .btn { min-width: 34px; min-height: 30px; padding: 3px 10px; }
        .production-dashboard-page .pd-pager .btn:disabled { opacity: 0.45; }
        .production-dashboard-page .pd-pager-gap { padding: 0 4px; color: var(--muted); font-weight: 800; }
        .production-dashboard-page .pd-pager input.form-control { width: 112px; min-height: 30px; }
        .production-dashboard-page .pd-pager select.form-select { width: auto; min-height: 30px; }

        @media (max-width: 768px) {
          .production-dashboard-page.container { padding: 10px; }
          .production-dashboard-page .pd-header { border-radius: 20px; }
          .production-dashboard-page .report-toggle { width: 100%; }
          .production-dashboard-page .report-toggle .btn { min-width: 0; flex: 1; }
        }
      `}</style>

      {/* PAGE HEADER */}
      <div className="pd-header">
        <div className="pd-brand">
          <div className="pd-emblem"><FiClipboard aria-hidden="true" /></div>
          <div>
            <h1 className="production-title"><b>Production Entry</b></h1>
            <p className="pd-subtitle">Record machine production, wastage and status for each work order</p>
          </div>
        </div>
        <div className="form-check form-switch pd-offday">
          <input
            type="checkbox"
            className="form-check-input"
            id="offDayCheck"
            checked={isOffDay}
            onChange={handleOffDayToggle}
          />
          <label className="form-check-label text-black fw-bold" htmlFor="offDayCheck">
            <FiPower className="pd-ico" aria-hidden="true" />Off Day
          </label>
        </div>
      </div>


         {/* WORK ORDER INPUT */}
      {!isOffDay && (
        <div
          ref={findCardRef}
          className="card pd-section"
        >
          <div className="pd-section-head">
            <h6><FiSearch className="pd-ico" /> Find work order</h6>
          </div>
          <div className="pd-section-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-9">
                <label className="form-label text-black"><FieldIcon name="WO number" />WO number</label>
                <input
                  type="text"
                  name="workOrderNo"
                  value={form.workOrderNo}
                  onChange={handleChange}
                  placeholder="Enter Work Order No"
                  className="form-control border-dark"
                />
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <button className="btn btn-primary w-100" type="button" onClick={fetchWorkOrder}>
                  <FiSearch className="pd-ico" /> Fetch Work Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ENTRY POPUP: opens after Fetch / Edit / Off Day (same split-card design as Add New User) */}
      {showEntryModal && (workOrderDetails || isOffDay) && (
        <div className="pd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeEntry(); }}>
          <div className="pd-modal" ref={entryPanelRef}>

            {/* LEFT: brand panel */}
            <div className="pd-left">
              <div className="pd-left-top">
                <span className="pd-left-label">Production Entry</span>
                <span className="pd-left-pill">
                  {isOffDay ? "Off Day" : editingId ? "Editing entry" : "New entry"}
                </span>
              </div>

              <div className="pd-left-center">
                <div className="pd-left-emblem"><FiClipboard aria-hidden="true" /></div>
                <h2>
                  {isOffDay
                    ? "Off Day"
                    : `WO ${workOrderDetails?.efiWoNumber || form.workOrderNo || ""}`}
                </h2>
                <p>Record machine production, wastage and status</p>

                {workOrderDetails && (
                  <div className="pd-left-stats">
                    <div
                      className="gl-donut"
                      style={{
                        background: `conic-gradient(#e8734a ${wastePct * 3.6}deg, rgba(255, 255, 255, 0.55) 0deg)`
                      }}
                    >
                      <div className="gl-donut-inner">
                        <b>{wastePct}%</b>
                      </div>
                    </div>
                    <div className="pd-left-stat-list">
                      <span>Order Qty<b>{workOrderDetails.orderQty ?? "-"}</b></span>
                      <span>Production<b>{form.productionQty === "" ? 0 : form.productionQty}</b></span>
                      <span>Wastage<b>{form.wastageQty === "" ? 0 : form.wastageQty}</b></span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pd-left-bottom">
                <div className="pd-left-avatar"><FiUser aria-hidden="true" /></div>
                <div>
                  <b>{loggedInUser || "-"}</b>
                  <small>entering as</small>
                </div>
              </div>

              <span className="pd-planet pd-planet-1"></span>
              <span className="pd-planet pd-planet-2"></span>
            </div>

            {/* RIGHT: summary + entry form */}
            <div className="pd-right">
              <button type="button" className="pd-close" onClick={closeEntry} aria-label="Close">✕</button>

              <div className="gl-head">
                <div className="gl-head-left">
                  <h3 className="gl-title">Production Entry</h3>
                  {(workOrderDetails?.efiWoNumber || form.workOrderNo) && !isOffDay && (
                    <span className="gl-pill">
                      WO {workOrderDetails?.efiWoNumber || form.workOrderNo}
                    </span>
                  )}
                  {isOffDay && <span className="gl-pill">Off Day</span>}
                  {editingId && <span className="gl-pill">Editing entry</span>}
                </div>
              </div>

              {/* WORK ORDER DETAILS */}
              {workOrderDetails && (
                <div className="gl-inner first">
                  <div className="gl-group">
                    <FiClipboard className="pd-ico" />
                    <span>Work Order Summary</span>
                  </div>

                  <div className="row g-2">

                      <InfoTile label="Wo Date:" col="col-6 col-md-2">
                        {workOrderDetails.date
                          ? new Date(workOrderDetails.date).toLocaleDateString("en-IN")
                          : "-"}
                      </InfoTile>

                      <InfoTile label="Customer Name:" col="col-6 col-md-4">
                        {workOrderDetails.customerName}
                      </InfoTile>

                      <InfoTile label="Job Description:" col="col-12 col-md-6">
                        {workOrderDetails.jobDescription}
                      </InfoTile>

                      <InfoTile label="Product Type:" col="col-6 col-md-3">
                        {workOrderDetails.productType || "-"}
                      </InfoTile>

                      <InfoTile label="Job Size:" col="col-6 col-md-3">
                        {workOrderDetails.jobSize}
                      </InfoTile>

                      <InfoTile label="Material Code:" col="col-12 col-md-4">
                        <select
                          className="form-select"
                          value={selectedMaterialIndex}
                          onChange={(e) => setSelectedMaterialIndex(e.target.value)}
                        >
                          <option value="">Select Material Code</option>
                          {workOrderDetails.materials?.map((m, i) => (
                            <option key={i} value={i}>
                              {m.materialCode}
                              {workOrderDetails.machines?.[i]?.component
                                ? ` (${workOrderDetails.machines[i].component})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </InfoTile>

                      <InfoTile label="Pages:" col="col-6 col-md-2">
                        {selectedPages || "-"}
                      </InfoTile>

                      <InfoTile label="Material Description:" col="col-12 col-md-6">
                        <select
                          className="form-select"
                          value={selectedMaterialIndex}
                          onChange={(e) => setSelectedMaterialIndex(e.target.value)}
                        >
                          <option value="">Select Material Description</option>
                          {workOrderDetails.materials?.map((m, i) => (
                            <option key={i} value={i}>
                              {m.materialDescription || "-"}
                            </option>
                          ))}
                        </select>
                      </InfoTile>

                      <InfoTile label="Material Group Desc.:" col="col-12 col-md-4">
                        {selectedMaterial?.materialGroupDescription || "-"}
                      </InfoTile>

                      <InfoTile label="Mill:" col="col-6 col-md-2">
                        {selectedMaterial?.mill || "-"}
                      </InfoTile>

                      <InfoTile label="GSM:" col="col-6 col-md-2">
                        {selectedMaterial?.gsm || "-"}
                      </InfoTile>

                      <InfoTile label="Paper Size:" col="col-6 col-md-2">
                        {selectedMaterial?.paperSize || "-"}
                      </InfoTile>

                      <InfoTile label="Planner UPS:" col="col-6 col-md-2">
                        {Array.isArray(selectedUps)
                          ? selectedUps
                            .filter(v => v !== 0 && v !== null && v !== undefined && v !== "")
                            .join(", ")
                          : selectedUps || ""}
                      </InfoTile>

                      <InfoTile label="Order Qty:" col="col-6 col-md-2">
                        {workOrderDetails.orderQty}
                      </InfoTile>

                    </div>
                </div>
              )}

              {/* PRODUCTION FORM */}
              <form ref={formRef} onSubmit={handleSubmit}>

                  <div className="gl-inner mt-4">
                    <div className="row g-3 align-items-end">

                      <div className="col-6 col-md-4 col-xl-2">
                        <label className="form-label"><FieldIcon name="Production Date" />Production Date</label>
                        <input
                          type="date"
                          name="productionDate"
                          value={form.productionDate}
                          onChange={handleChange}
                          required
                          className="form-control"
                        />
                      </div>

                      {activityMachinePairs.map((pair, index) => (
                        <Fragment key={index}>

                          <div className="col-6 col-md-4 col-xl-3" key={`activity-${index}`}>
                            <label className="form-label"><FieldIcon name="Activity" />Activity</label>
                            <select
                              value={pair.activityId}
                              onChange={(e) => handleActivityChange(index, e.target.value)}
                              className="form-select"
                              required
                            >
                              <option value="">Select Activity</option>
                              {activities.map(a => (
                                <option key={a._id} value={a._id}>
                                  {a.activityName}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-6 col-md-4 col-xl-3" key={`machine-${index}`}>
                            <label className="form-label"><FieldIcon name="Machine" />Machine</label>
                            <select
                              value={pair.machineId}
                              onChange={(e) => handleMachineChangeForPair(index, e.target.value)}
                              className="form-select"
                              disabled={!pair.activityId}
                              required
                            >
                              <option value="">Select Machine</option>
                              {filteredMachinesForPair(pair.activityId).map(m => (
                                <option key={m._id} value={m._id}>
                                  {m.machineName}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-6 col-md-4 col-xl-2">
                            <label className="form-label"><FieldIcon name="From Time" />From Time</label>
                            <input
                              type="time"
                              name="productionFromTime"
                              value={form.productionFromTime}
                              onChange={handleChange}
                              required
                              className="form-control"
                            />
                          </div>
                          <div className="col-6 col-md-4 col-xl-2">
                            <label className="form-label"><FieldIcon name="To Time" />To Time</label>
                            <input
                              type="time"
                              name="productionToTime"
                              value={form.productionToTime}
                              onChange={handleChange}
                              required
                              className="form-control"
                            />
                          </div>

                        </Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="gl-inner">
            
                    <div className="row g-3">
                      <div className="col-6 col-md-4 col-xl-2">
                        <label className="form-label"><FieldIcon name="Shift" />Shift</label>
                        <select
                          name="shift"
                          value={form.shift}
                          onChange={handleChange}
                          required
                          className="form-select"
                        >
                          <option value="">Select Shift</option>
                          <option value="Day">Day</option>
                          <option value="Night">Night</option>
                        </select>
                      </div>
                      <div className="col-6 col-md-4 col-xl-3">
                        <label className="form-label"><FieldIcon name="Machine Status" />Machine Status</label>
                        <select
                          name="machineStatus"
                          value={form.machineStatus}
                          onChange={handleChange}
                          required
                          className="form-select"
                        >
                          <option value="">Select Status</option>
                          {machineStatuses
                            .filter((s) => !isOffDay || s.statusName?.toLowerCase() !== "production")
                            .map((s) => (
                              <option key={s._id} value={s.statusName}>
                                {s.statusName}
                              </option>
                            ))}
                        </select>
                      </div>

                      {form.machineStatus?.toLowerCase() === "production" && (
                        <>
                          <div className="col-6 col-md-4 col-xl-3">
                            <label className="form-label" title="Production Impression"><FieldIcon name="Production Impression" />Production Impression</label>
                            <input
                              type="number"
                              name="productionImpression"
                              value={form.productionImpression}
                              onChange={handleChange}
                              className="form-control"
                              required
                            />
                          </div>

                          <div className="col-6 col-md-4 col-xl-2">
                            <label className="form-label" title="Waste Impression"><FieldIcon name="Waste Impression" />Waste Impression</label>
                            <input
                              type="number"
                              name="wasteImpression"
                              value={form.wasteImpression}
                              onChange={handleChange}
                              className="form-control"
                              required
                            />
                          </div>

                          <div className="col-6 col-md-4 col-xl-2">
                            <label className="form-label"><FieldIcon name="Production UPS" />Production UPS</label>
                            <input
                              type="number"
                              name="productionUps"
                              list="production-ups-options"
                              value={form.productionUps}
                              onChange={handleChange}
                              className="form-control"
                              placeholder={allowedProductionUps.length ? `Allowed: ${allowedProductionUps.join(", ")}` : ""}
                              required
                            />
                            <datalist id="production-ups-options">
                              {allowedProductionUps.map((u) => (
                                <option key={u} value={u} />
                              ))}
                            </datalist>
                          </div>

                          <div className="col-6 col-md-4 col-xl-3">
                            <label className="form-label"><FieldIcon name="Production Qty" />Production Qty</label>
                            <input type="number" value={form.productionQty} readOnly className="form-control" />
                          </div>

                          {Number(form.pages) > 0 && (
                            <div className="col-6 col-md-4 col-xl-3">
                              <label className="form-label"><FieldIcon name="Booklet Quantity" />Booklet Quantity</label>
                              <input type="number" value={form.quantity2} readOnly className="form-control" />
                            </div>
                          )}

                          <div className="col-6 col-md-4 col-xl-3">
                            <label className="form-label"><FieldIcon name="Wastage Qty" />Wastage Qty</label>
                            <input type="number" value={form.wastageQty} readOnly className="form-control" />
                          </div>

                          <div className="col-6 col-md-4 col-xl-3">
                            <label className="form-label"><FieldIcon name="Waste %" />Waste %</label>
                            <input type="text" value={wastePercent + "%"} readOnly className="form-control" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="gl-inner">
                    <div className="gl-group">
                      <FiMessageSquare className="pd-ico" />
                      <span>Remarks</span>
                    </div>
                    <div className="row g-2 align-items-end">
                      <div className="col-md-9">
                        <textarea
                          name="remarks"
                          value={form.remarks}
                          onChange={handleChange}
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-3">
                        <button className="btn gl-btn" type="submit">
                          <FiSave className="pd-ico" /> Save
                        </button>
                      </div>
                    </div>
                  </div>

                </form>
            </div>
          </div>
        </div>
      )}

        {/* FILTERS */}
      <div className="card pd-section pd-filter mt-3">
        <div className="pd-section-head">
          <h5><FiFilter className="pd-ico" /> Filters</h5>
          <span className="pd-count">
            {filteredProductionList.length.toLocaleString("en-IN")} / {productionList.length.toLocaleString("en-IN")} records
          </span>
        </div>

        <div className="pd-section-body">
          <div className="row g-2 align-items-end">

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="WO Number" />WO Number</label>
              <input
                type="text"
                name="workOrder"
                placeholder="WO No"
                value={filters.workOrder}
                onChange={handleFilterChange}
                className="form-control border-dark"
              />
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="From date" />From date</label>
              <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="form-control border-dark" />
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="To date" />To date</label>
              <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="form-control border-dark" />
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="Month" />Month</label>
              <input type="month" name="month" value={filters.month} onChange={handleFilterChange} className="form-control border-dark" />
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="Product Type" />Product Type</label>
              <select name="productType" value={filters.productType} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Product Types</option>
                {dropdownOptions.productTypes.map((type, i) => (
                  <option key={i} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="Customer" />Customer</label>
              <select name="customer" value={filters.customer} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Customers</option>
                {dropdownOptions.customerNames.map((cust, i) => (
                  <option key={i} value={cust}>{cust}</option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="User Location" />User Location</label>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="form-select border-dark">
                <option value="">All Locations</option>
                {locationOptions.map((loc, i) => (
                  <option key={i} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="Shifts" />Shifts</label>
              <select name="shift" value={filters.shift} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Shifts</option>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
              </select>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="Machines" />Machines</label>
              <select name="machine" value={filters.machine} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Machines</option>
                {dropdownOptions.machineNames.map((machine, i) => (
                  <option key={i} value={machine}>{machine}</option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-4 col-xl-2">
              <label className="form-label text-black"><FieldIcon name="Machine Status" />Machine Status</label>
              <select name="machineStatus" value={filters.machineStatus} onChange={handleFilterChange} className="form-select border-dark">
                <option value="">All Status</option>
                {machineStatuses.map((s) => (
                  <option key={s._id} value={s.statusName}>{s.statusName}</option>
                ))}
              </select>
            </div>

            {/* action buttons (2 x 2) */}
            <div className="col-12 col-xl-4">
              <div className="pd-filter-btns">
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  <FiX className="pd-ico" /> Clear
                </button>
                <button className="btn btn-success" onClick={exportToExcel}>
                  <FiDownload className="pd-ico" /> Export Excel
                </button>
                <button type="button" className="btn btn-primary" onClick={exportActivityLastUsedPdf}>
                  <FiFileText className="pd-ico" /> Activity Last Used PDF
                </button>
                <button type="button" className="btn btn-success" onClick={exportActivityLastUsedExcel}>
                  <FiDownload className="pd-ico" /> Activity Last Used Excel
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* VIEW TOGGLE */}
      <div className="report-toggle-wrap">
        <div className="report-toggle">
          <button
            type="button"
            className={`btn ${recordsView === "summary" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setRecordsView("summary")}
          >
            <FiBarChart2 className="pd-ico" /> Summary Report
          </button>
          <button
            type="button"
            className={`btn ${recordsView === "details" ? "btn-primary" : "btn-secondary"} ms-2`}
            onClick={() => setRecordsView("details")}
          >
            <FiList className="pd-ico" /> Detailed Records
          </button>
        </div>
      </div>

      {recordsView === "summary" && productionList.length > 0 && (
        <div className="card mt-4 shadow-lg">
          <div className="card-header bg-primary text-white text-center">
            <strong><FiBarChart2 className="pd-ico" /> Production Summary Report</strong>
          </div>

          <div className="table-responsive" style={{ maxHeight: "500px", overflowY: "auto" }}>
            <table className="table table-bordered mb-0 production-summary-table">
              <thead>
                <tr>
                  <th rowSpan="2" style={{ width: "8%" }}>DEI Machine</th>
                  <th rowSpan="2" style={{ width: "12%" }}>Machine</th>
                  <th colSpan="5">Date {getReportDateLabel()}</th>
                  <th colSpan="5">Machine Hours</th>
                </tr>
                <tr>
                  <th style={{ width: "7%" }}>Day Shift</th>
                  <th style={{ width: "11%" }}>Remarks</th>
                  <th style={{ width: "7%" }}>Night Shift</th>
                  <th style={{ width: "11%" }}>Remarks</th>
                  <th style={{ width: "8%" }}>Grand Total</th>
                  <th style={{ width: "7.2%" }}>Production Time</th>
                  <th style={{ width: "7.2%" }}>Idle Time</th>
                  <th style={{ width: "7.2%" }}>Breakdown Time</th>
                  <th style={{ width: "7.2%" }}>Maintenance Time</th>
                  <th style={{ width: "7.2%" }}>Total Timings</th>
                </tr>
              </thead>
              <tbody>
                {productionSummaryReport.length === 0 ? (
                  <tr className="report-empty-row">
                    <td colSpan="12">No production found for selected filters</td>
                  </tr>
                ) : (
                  productionSummaryReport.map((group) =>
                    group.rows.map((row, rowIndex) => (
                      <tr key={`${group.activityName}-${row.machineName}`}>
                        {rowIndex === 0 && (
                          <td rowSpan={group.rows.length} className="report-group-cell">
                            {group.activityName}
                          </td>
                        )}
                        <td className="report-machine-cell">{row.machineName}</td>
                        <td className="report-number-cell">{formatReportNumber(row.dayQty, row.dayEntered)}</td>
                        <td
  className="report-remarks-cell"
  style={{
    cursor: "pointer",
    whiteSpace:
      expandedCell === `sumday-${group.activityName}-${row.machineName}` ? "normal" : "nowrap"
  }}
  title={row.dayRemarks}
  onClick={() =>
    setExpandedCell(
      expandedCell === `sumday-${group.activityName}-${row.machineName}`
        ? null
        : `sumday-${group.activityName}-${row.machineName}`
    )
  }
>
  {expandedCell === `sumday-${group.activityName}-${row.machineName}`
    ? row.dayRemarks
    : truncateText(row.dayRemarks)}
</td>
                        <td className="report-number-cell">{formatReportNumber(row.nightQty, row.nightEntered)}</td>
                        <td
  className="report-remarks-cell"
  style={{
    cursor: "pointer",
    whiteSpace:
      expandedCell === `sumnight-${group.activityName}-${row.machineName}` ? "normal" : "nowrap"
  }}
  title={row.nightRemarks}
  onClick={() =>
    setExpandedCell(
      expandedCell === `sumnight-${group.activityName}-${row.machineName}`
        ? null
        : `sumnight-${group.activityName}-${row.machineName}`
    )
  }
>
  {expandedCell === `sumnight-${group.activityName}-${row.machineName}`
    ? row.nightRemarks
    : truncateText(row.nightRemarks)}
</td>
                        <td className="report-number-cell">{formatReportNumber(row.grandTotal, row.dayEntered || row.nightEntered)}</td>
                        <td className="report-number-cell" style={{ textAlign: "center" }}>{formatHMS(row.prodMins)}</td>
                        <td className="report-number-cell" style={{ textAlign: "center" }}>{formatHMS(row.idleMins)}</td>
                        <td className="report-number-cell" style={{ textAlign: "center" }}>{formatHMS(row.breakdownMins)}</td>
                        <td className="report-number-cell" style={{ textAlign: "center" }}>{formatHMS(row.maintMins)}</td>
                        <td className="report-number-cell" style={{ textAlign: "center", fontWeight: 700 }}>{formatHMS(row.totalMins)}</td>
                      </tr>
                    ))
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recordsView === "details" && productionList.length > 0 && (
        <div className="card mt-4 shadow-lg">

          <div className="card-header bg-primary text-white text-center" >
            <strong><FiList className="pd-ico" /> Production Records</strong>
            <span className="pd-count ms-2">{filteredProductionList.length.toLocaleString("en-IN")} records</span>
          </div>

          <div className="table-responsive" ref={tableWrapRef} style={{ maxHeight: "62vh", overflowY: "auto" }}>
            <table className="table  border-dark table-striped table-bordered table-hover mb-0">
              <thead className="table-dark sticky-top">
                <tr>
                  <th>SL NO</th>
                  <th>WO No</th>
                  <th>Customer</th>
                  <th>Product Type</th>
                  <th>Job Description</th>
                  <th>Job Size</th>
                  <th>Planner UPS</th>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>From Time</th>
                  <th>To Time</th>
                  <th>Activity</th>
                  <th>Machine</th>
                  <th>Material Code</th>
                  <th>Material Description</th>
                  <th>Material Group</th>
                  <th>Mill</th>
                  <th>GSM</th>
                  <th>Paper Size</th>
                  <th>Order Qty</th>
                  <th>Production Impression</th>
                  <th>Waste Impression</th>
                  <th>Production UPS</th>
                  <th>Pages</th>
                  <th>Production Qty</th>
                  <th>Booklet Quantity</th>
                  <th>Wastage</th>
                  <th>Waste %</th>
                  <th>Machine Status</th>
                  <th>User</th>
                  <th>Remarks</th>
                  <th>User Location</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length === 0 && (
                  <tr>
                    <td colSpan="33" className="pd-empty">No records match the selected filters</td>
                  </tr>
                )}
                {detailRows
                  .map((item, index) => (
                    <tr key={item._id}>
                      <td>{(safePage - 1) * pageSize + index + 1}</td>
                      <td>{item.workOrder}</td>
                      <td style={{
                        cursor: "pointer",
                        maxWidth: "250px",
                        whiteSpace: expandedCell === `customer-${item._id}` ? "normal" : "nowrap"
                      }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `customer-${item._id}` ? null : `customer-${item._id}`
                          )
                        }
                      >
                        {expandedCell === `customer-${item._id}`
                          ? item.customerName
                          : truncateText(item.customerName)}
                      </td>
                      <td>{item.productType || "-"}</td>

                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "250px",
                          whiteSpace:
                            expandedCell === `jobdesc-${item._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `jobdesc-${item._id}` ? null : `jobdesc-${item._id}`
                          )
                        }
                      >
                        {expandedCell === `jobdesc-${item._id}`
                          ? item.jobDescription
                          : truncateText(item.jobDescription)}
                      </td>
                      <td>{item.jobSize}</td>
                      <td>
                        {Array.isArray(item.ups)
                          ? item.ups
                            .filter(v => v !== 0 && v !== null && v !== undefined && v !== "")
                            .join(", ")
                          : item.ups || ""}
                      </td>
                      <td>{new Date(item.productionDate).toLocaleDateString("en-IN")}</td>
                      <td>{item.shift}</td>
                      <td>{formatTime12Hour(item.productionFromTime)}</td>
                      <td>{formatTime12Hour(item.productionToTime)}</td>
                      <td>
                        {item.machiness
                          ?.map(pair => pair.activityId?.activityName)
                          .join(", ") || "-"}
                      </td>

                      <td
                        style={{
                          maxWidth: "180px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `machine-${item._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `machine-${item._id}` ? null : `machine-${item._id}`
                          )
                        }
                      >
                        {item.machiness
                          ?.map(pair => pair.machineId?.machineName)
                          .join(", ") || "-"}
                      </td>


                      <td>{item.materials?.[0]?.materialCode}</td>
                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "220px",
                          whiteSpace:
                            expandedCell === `matdesc-${item._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `matdesc-${item._id}` ? null : `matdesc-${item._id}`
                          )
                        }
                      >
                        {expandedCell === `matdesc-${item._id}`
                          ? item.materials?.[0]?.materialDescription
                          : truncateText(item.materials?.[0]?.materialDescription)}
                      </td>
                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "200px",
                          whiteSpace:
                            expandedCell === `matgroup-${item._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `matgroup-${item._id}` ? null : `matgroup-${item._id}`
                          )
                        }
                      >
                        {expandedCell === `matgroup-${item._id}`
                          ? item.materials?.[0]?.materialGroupDescription
                          : truncateText(item.materials?.[0]?.materialGroupDescription)}
                      </td>
                      <td>{item.materials?.[0]?.mill}</td>
                      <td>{item.materials?.[0]?.gsm}</td>
                      <td>{item.materials?.[0]?.paperSize}</td>
                      <td>{item.liveOrderQty ?? item.orderQty}</td>
                      <td>{item.productionImpression || "-"}</td>
                      <td>{item.wasteImpression || "-"}</td>
                      <td>{item.productionUps || "-"}</td>
                      <td>{item.pages || "-"}</td>
                      <td>{item.productionQty}</td>
                      <td>{item.quantity2 || "-"}</td>
                      <td>{item.wastageQty}</td>
                      <td>{item.wastePercent ? item.wastePercent + "%" : "0%"}</td>
                      <td>
                        <span
                          className="pd-status"
                          style={{
                            fontWeight: "bold",
                            color:
                              item.machineStatus?.toLowerCase() === "production"
                                ? "green"
                                : item.machineStatus?.toLowerCase() === "idle"
                                  ? "orange"
                                  : item.machineStatus?.toLowerCase() === "breakdown"
                                    ? "red"
                                    : "black"
                          }}
                        >
                          {item.machineStatus}
                        </span>
                      </td>

                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "180px",
                          whiteSpace:
                            expandedCell === `user-${item._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `user-${item._id}` ? null : `user-${item._id}`
                          )
                        }
                      >
                        {expandedCell === `user-${item._id}` ? (
                          <>
                            {item.enteredBy}
                            <br />
                            <small className="text-muted">
                              {new Date(item.createdAt).toLocaleString()}
                            </small>
                          </>
                        ) : (
                          <>
                            {truncateText(item.enteredBy)}
                            <br />
                            <small className="text-muted">
                              {truncateText(new Date(item.createdAt).toLocaleString(), 15)}
                            </small>
                          </>
                        )}
                      </td>
                      <td
                        style={{
                          cursor: "pointer",
                          maxWidth: "220px",
                          whiteSpace:
                            expandedCell === `remarks-${item._id}` ? "normal" : "nowrap"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `remarks-${item._id}` ? null : `remarks-${item._id}`
                          )
                        }
                      >
                        {expandedCell === `remarks-${item._id}`
                          ? item.remarks
                          : truncateText(item.remarks)}
                      </td>
                      <td>{item.userLocations?.join(", ")}</td>
                      <td>
                        {isOwner(item) ? (
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => handleEdit(item)}
                            >
                              <FiEdit2 className="pd-ico" /> Edit
                            </button>

                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(item._id)}
                            >
                              <FiTrash2 className="pd-ico" /> Delete
                            </button>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={filteredProductionList.length}
            onPage={goToPage}
            onPageSize={setPageSize}
          />
        </div>
      )}
    </div>
  );
}

export default ProductionRealDashboard;