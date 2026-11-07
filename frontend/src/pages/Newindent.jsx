import { useState, useEffect, useRef, useMemo } from "react";
import { jwtDecode } from "jwt-decode";
import WoStageChartModal, { fetchWoStageTree } from "./Wostagechart";
import Swal from "sweetalert2";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import BASE_URL from "../config/api";

// Outlined floating-label field with a leading icon (Planner styling)
function PoField({ icon, label, required, hide, filled, alwaysFloat, caret, area, className = "", after, children }) { if (hide) return null;
  return (
    <div className={className}>
      <div className={`po-field ${filled || alwaysFloat ? "is-floated" : ""} ${area ? "po-area" : ""}`}>
        {icon && <i className={`bi ${icon} po-field-icon`}></i>}
        {children}
        <label className="po-field-label">
          {label}
          {required && <span className="po-req"> *</span>}
        </label>
        {caret && <i className="bi bi-chevron-down po-caret"></i>}
      </div>
      {after}
    </div>
  );
}
const has = (v) => v !== "" && v !== null && v !== undefined;
const norm = (v) => String(v ?? "").trim();

// Production indents (not samples) must have an uploaded artwork version before saving.
// The PO reviewer approves it later. Set to false to switch that rule off.
const REQUIRE_ARTWORK_UPLOAD = true;

// form key -> field name in the Materials master
const PAPER_FIELDS = {
  millName: "mill",
  paperGroup: "group",
  paperSize: "paperSize",
  gsm: "gsm",
};

// ===== TRACKING pipeline (same stages as the HTML page) =====

const flatDoc = (v, p, out) => {
  if (v === null || v === undefined) { out[p] = ""; return out; }
  if (Array.isArray(v)) {
    if (!v.length) out[p] = "";
    v.forEach((x, i) => flatDoc(x, p + "[" + (i + 1) + "]", out));
    return out;
  }
  if (typeof v === "object") {
    Object.keys(v).forEach((k) => flatDoc(v[k], p ? p + "." + k : k, out));
    return out;
  }
  out[p] = /^\d{4}-\d\d-\d\dT/.test(String(v))
  ? (/T00:00:00(\.000)?Z$/.test(String(v)) || /T18:30:00(\.000)?Z$/.test(String(v))
      ? new Date(v).toLocaleDateString("en-IN")
      : new Date(v).toLocaleString("en-IN"))
  : String(v);
  return out;
};
const HIDE_RX = /(^|\.)(_id|__v|slNo|rowIndex|isBooklet|isPerfecting|schedulerHidden|sentToPrepress|printingId|activityId|machineId|customerOrderId|updatedAt|delayDays|delayLabel|userLocations\[\d+\])$|artworkVersions\[\d+\]\.filePath$|(^|\.)artwork\.filePath$/;
const prettyKey = (k) =>
  k
    .replace(/\[(\d+)\]/g, " $1")
    .split(".")
    .map((s) => s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()))
    .join(" › ");

const FlowKV = ({ doc }) => {
  if (!doc) return <div className="py-2">No record yet for this stage.</div>;
  const rows = Object.entries(flatDoc(doc, "", {}))
    .filter(([k, v]) => !HIDE_RX.test(k) && v !== "");
  // fields inside arrays (machines[1].x, materials[2].y) get their own section
  const groups = [];
  const map = {};
  rows.forEach(([k, v]) => {
    const m = k.match(/^(.*?\[\d+\])\.?(.*)$/);
    const g = m ? prettyKey(m[1]) : "Details";
    const label = m ? prettyKey(m[2] || m[1]) : prettyKey(k);
    if (!map[g]) { map[g] = []; groups.push(g); }
    map[g].push([k, label, String(v)]);
  });
  return (
    <>
      {groups.map((g) => (
        <div key={g} className="mb-3">
          <div className="gl-group">
            <i className="bi bi-info-circle"></i>
            <span>{g}</span>
          </div>
          <div className="row g-2">
            {map[g].map(([k, label, v]) => (
              <PoField key={k} className={v.length > 45 ? "col-12" : "col-6 col-md-3"} icon="bi-dot" label={label} alwaysFloat>
                <input className="po-input" value={v} title={v} readOnly />
              </PoField>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};
const FlowMulti = ({ docs }) => {
  if (!docs || !docs.length) return <div className="py-2">No record yet for this stage.</div>;
  return (
    <>
      {docs.map((d, i) => (
        <div key={i} className="mb-3">
          {docs.length > 1 && <b className="d-block mb-1">Record {i + 1} of {docs.length}</b>}
          <FlowKV doc={d} />
        </div>
      ))}
    </>
  );
};
const FlowList = ({ docs }) => {
  if (!docs || !docs.length) return <div className="py-2">No entries yet for this stage.</div>;
  return (
    <>
      {docs.map((d, i) => (
        <div key={i} className="mb-3 p-2" style={{ border: "1px solid #e3e7ec", borderRadius: 8 }}>
          <b className="d-block mb-2">Entry {i + 1} of {docs.length}</b>
          <FlowKV doc={d} />
        </div>
      ))}
    </>
  );
};
const PIPE = {
  production: [
    ["raised", "Indent raised"], ["po", "PO received"], ["appr", "Approved for production"],
    ["wo", "Work order generated"], ["print", "Printing"], ["post", "Finishing"],
    ["qc", "Quality check"], ["disp", "Dispatched"], ["done", "Delivered"]
  ],
  sample: [
    ["req", "Sample requested"], ["art", "Artwork approved"], ["cost", "Costing confirmed"],
    ["wo", "Work order generated"], ["print", "Printing"], ["qc", "Quality check"],
    ["sent", "Sample sent"], ["sign", "Customer sign-off"]
  ]
};
const TRACK_EX = {
  po: [["Customer PO no", "text"]],
  wo: [["Work order no", "text"]],
  print: [["Machine", "select", ["Web press", "Sheet-fed", "Digital"]]],
  disp: [["Challan / LR no", "text"]],
  sent: [["Courier / AWB no", "text"]],
  sign: [["Outcome", "select", ["Approved for live production", "Changes needed"]]]
};
const STAGE_OPTIONS = (() => {
  const seen = new Map();
  [...PIPE.production, ...PIPE.sample].forEach(([k, l]) => { if (!seen.has(k)) seen.set(k, l); });
  return [...seen.entries()];
})();

const LIVE_STAGES = ["New Indent", "Purchase Order", "Planner (Work Order)", "Production Entry", "Dispatch", "Completed"];



const isExtOrder = (ind) => ["Out Source", "PMS"].includes(ind?.orderType);

// Out Source / PMS: progress bar and stage follow the ticket dispatches
const withExt = (fl, ind, ext) => {
  if (!fl || !isExtOrder(ind) || !ext || !ext.totalQty) return fl;
  const sent = ext.dispatchedQty || 0;
  if (sent <= 0) return fl;
  const all = sent >= ext.totalQty;
  return {
    ...fl,
    current: all ? "Completed" : "Dispatch",
    stages: (fl.stages || []).map((st) => {
      if (st.key === "dispatch") return { ...st, state: all ? "done" : "partial" };
      if (st.state === "current") return { ...st, state: "done" };
      return st;
    })
  };
};

const typeKey = (ind) => (ind.indentType === "sample" ? "sample" : "production");

const getTrackLog = (ind) => {
  if (ind.trackLog?.length) return ind.trackLog;
  const item = ind.items?.[0] || {};
  const isSample = typeKey(ind) === "sample";
  const log = [{ stage: PIPE[typeKey(ind)][0][0], at: ind.createdAt, by: ind.user || "", note: "" }];
  if (!isSample) {
    if (item.customerPoNo || ind.status === "APPROVED")
      log.push({ stage: "po", at: ind.createdAt, by: ind.user || "", note: item.customerPoNo ? "Customer PO no: " + item.customerPoNo : "" });
    if (ind.status === "APPROVED")
      log.push({ stage: "appr", at: ind.approvedAt || ind.createdAt, by: ind.user || "", note: "" });
  }
  return log;
};
const getStageIdx = (ind) => {
  const log = getTrackLog(ind);
  const i = PIPE[typeKey(ind)].findIndex((s) => s[0] === log[log.length - 1].stage);
  return i < 0 ? 0 : i;
};
const fmtWhen = (d) => (d ? new Date(d).toLocaleString("en-IN") : "");

// latest artwork version of an indent (ignores Superseded unless nothing else exists)
const latestArtOf = (ind) => {
  const vers = ind.items?.[0]?.artworkVersions || [];
  const live = vers.filter((v) => v.status !== "Superseded");
  return live[live.length - 1] || vers[vers.length - 1] || null;
};

const BLANK_ITEM = {
  itemCode: "", uniqueCode: "", customerName: "", description: "", materialType: "",
  colorFront: "", colorBack: "", wasteQty: "5", jobSize: "", inkDetails: "CMYK"
};

function NewIndent() {
  const [locations, setLocations] = useState([]);
  const [woTrees, setWoTrees] = useState({}); // stage tree + completion per work order
  const [chartWo, setChartWo] = useState(null); // work order whose chart is open
  const [materials, setMaterials] = useState([]);
  const [loggedInUser, setLoggedInUser] = useState("");
  const [errors, setErrors] = useState({});
  const [indents, setIndents] = useState([]);
  const [filteredIndents, setFilteredIndents] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const token = localStorage.getItem("token");
  const [expandedCell, setExpandedCell] = useState(null);
  const productCodeRef = useRef();
  const stageRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  // entry form is hidden until "Create New Indent" is clicked (or an indent is edited)
  const [showForm, setShowForm] = useState(false);
  const [showTrack, setShowTrack] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null); // { url, name } for the watermarked PDF viewer
  const [showBell, setShowBell] = useState(true);
  // Lamination to Customer Copy columns are collapsed by default
  const [showExtraCols, setShowExtraCols] = useState(false);
  const routerLoc = useLocation();
  const navigate = useNavigate();
  const quantityRef = useRef();
  const locationRef = useRef();

  const [form, setForm] = useState({
    // ===== SAMPLE REQUEST =====
    sampleRequestType: "",
    provisionalCustomerId: "",
    productFamily: "",
    physicalReference: "",
    expectedOrderValue: "",
    specification: "",

    productCode: "",
    materialType: "",
    description: "",
    customerName: "",
    colorFront: "",
    colorBack: "",
    wasteQty: "",
    jobSize: "",
    inkDetails: "",
    quantity: "",
    location: "",
    unitRate: "",
    remark: "",
    deliveryDate: "",

    // ===== NEW FIELDS =====
    lamination: "",
    finish: "",
    jobNo: "",
    soNo: "",
    soDate: "",
    sampleType: "",
    costingConfirmation: "",
    customerPoNo: "",
    customerPoDate: "",
    typeOfBilling: "",
    itemPdfPath: "",
    millName: "",
    paperGroup: "",
    paperSize: "",
    gsm: ""
  });

  // ===== UPLOADED FILES =====
  const [customerCopyFile, setCustomerCopyFile] = useState(null);
  const [artworkFile, setArtworkFile] = useState(null);
  const [existingCustomerCopy, setExistingCustomerCopy] = useState(null);
  const [existingArtwork, setExistingArtwork] = useState(null);

  // ===== ARTWORK MANAGEMENT (versions) =====
  // each version: { version, file (new upload only), fileName, filePath, note, status, comment, uploadedBy, uploadedAt }
  const [artworkVersions, setArtworkVersions] = useState([]);
  const [awFile, setAwFile] = useState(null);
  const [awNote, setAwNote] = useState("");
  const awFileInputRef = useRef(null);

  // artwork saved against the item code (loads when a product code / description is picked)
  const [masterArt, setMasterArt] = useState([]);
  const masterArtInputRef = useRef(null);

  // confirm-before-upload popup for artwork files
  const [artConfirm, setArtConfirm] = useState(null); // { file, kind, url, isPdf, isImg }
  const [artRead, setArtRead] = useState(false);


  // ===== FILTER STATES =====
  const [indentNoFilter, setIndentNoFilter] = useState("");
  const [productCodeFilter, setProductCodeFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [indenterFilter, setIndenterFilter] = useState("");

  // ===== TRACK TABLE =====
  const [searchQ, setSearchQ] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [trackId, setTrackId] = useState(null);
  const [trackExtra, setTrackExtra] = useState({});
  const [trackNote, setTrackNote] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [trackErr, setTrackErr] = useState("");
  const [flowRaw, setFlow] = useState({});
  const [flowSel, setFlowSel] = useState("");
  const [flowData, setFlowData] = useState({});
  const [extTickets, setExtTickets] = useState({}); // indentNo -> [ticketNo]
  const [extDetail, setExtDetail] = useState({});   // indentNo -> { orders } | { error }

  // ===== PRODUCT SEARCH MODE: "code" (normal) or "customer" (customer + description dropdowns) =====
  const flow = useMemo(() => {
    const out = { ...flowRaw };
    indents.forEach((ind) => {
      if (out[ind.indentNo]) out[ind.indentNo] = withExt(out[ind.indentNo], ind, extTickets[ind.indentNo]);
    });
    return out;
  }, [flowRaw, indents, extTickets]);

  const [searchMode, setSearchMode] = useState("code");
  const [itemList, setItemList] = useState([]);
  const [custSearch, setCustSearch] = useState("");
  const [descSearch, setDescSearch] = useState("");
  const [showAddCust, setShowAddCust] = useState(false);
  const [newItem, setNewItem] = useState(BLANK_ITEM);

  const itemCodeOf = (it) => String(it.productCode || it.itemCode || it.code || "");
  const descLabelOf = (it) => `${itemCodeOf(it)} - ${norm(it.description)}`;

  useEffect(() => {
    axios
      .get(`${BASE_URL}/api/master/items`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setItemList(Array.isArray(res.data) ? res.data : (res.data?.data || [])))
      .catch(() => setItemList([]));
  }, []);

  const customerNames = useMemo(
    () =>
      [...new Set(itemList.map((it) => norm(it.customerName)).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [itemList]
  );

  // next running product code: P01, P02, ... (looks at the Items master and saved indents)
  const nextProductCode = useMemo(() => {
    let max = 0;
    [
      ...itemList.map((it) => itemCodeOf(it)),
      ...indents.map((x) => String(x.items?.[0]?.productCode || ""))
    ].forEach((c) => {
      const m = /^P(\d+)$/i.exec(c);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return "P" + String(max + 1).padStart(2, "0");
  }, [itemList, indents]);

  // Sample Request: Customer and Product Type dropdowns filter each other
  const sampleCustomerNames = useMemo(
    () =>
      [...new Set(
        itemList
          .filter((it) => !form.materialType || norm(it.materialType) === norm(form.materialType))
          .map((it) => norm(it.customerName))
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [itemList, form.materialType]
  );

  const sampleTypeOptions = useMemo(
    () =>
      [...new Set(
        itemList
          .filter((it) => form.sampleRequestType === "new" || !form.customerName || norm(it.customerName) === norm(form.customerName))
          .map((it) => norm(it.materialType))
          .filter(Boolean)
      )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [itemList, form.customerName, form.sampleRequestType]
  );

  // Sample Request: product code of the item that matches the selected Customer / Product Type
  const sampleMatchCode = useMemo(() => {
    if (!form.customerName && !form.materialType) return "";
    const list = itemList.filter(
      (it) =>
        (!form.customerName || norm(it.customerName) === norm(form.customerName)) &&
        (!form.materialType || norm(it.materialType) === norm(form.materialType))
    );
    const codes = [...new Set(list.map((it) => itemCodeOf(it)).filter(Boolean))];
    if (form.productCode && codes.includes(form.productCode)) return form.productCode;
    if (codes.length === 1) return codes[0];
    // several items match: pick the first only when both dropdowns are chosen
    return form.customerName && form.materialType ? codes[0] || "" : "";
  }, [itemList, form.customerName, form.materialType, form.productCode]);

  // code used for artwork: the matched item in Sample Request, the typed code otherwise
  const artCode = searchMode === "sample" ? sampleMatchCode : form.productCode;

  useEffect(() => {
    let live = true;
    if (!artCode) { setMasterArt([]); return; }
    axios
      .get(`${BASE_URL}/api/master/items/${artCode}`)
      .then((r) => { if (live) setMasterArt(r.data?.artworkVersions || []); })
      .catch(() => { if (live) setMasterArt([]); });
    return () => { live = false; };
  }, [artCode]);

  // Sample Request: Description dropdown options follow the selected Customer / Product Type
  const sampleDescOptions = useMemo(
    () =>
      itemList.filter(
        (it) =>
          itemCodeOf(it) &&
          norm(it.description) &&
          (!form.customerName || norm(it.customerName) === norm(form.customerName)) &&
          (!form.materialType || norm(it.materialType) === norm(form.materialType))
      ),
    [itemList, form.customerName, form.materialType]
  );

  const pickSampleDesc = (code) => {
    const it = code ? itemList.find((x) => itemCodeOf(x) === code) : null;
    if (!it) {
      setForm((prev) => ({ ...prev, productCode: "", description: "" }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      productCode: code,
      customerName: it.customerName || prev.customerName,
      materialType: it.materialType || prev.materialType,
      description: it.description || "",
      colorFront: it.colorFront ?? "",
      colorBack: it.colorBack ?? "",
      jobSize: it.jobSize || ""
    }));
  };

  // Sample Request: fill Description, colours and job size from the matched item
  useEffect(() => {
    if (searchMode !== "sample" || editingId) return;
    const it = sampleMatchCode ? itemList.find((x) => itemCodeOf(x) === sampleMatchCode) : null;
    if (it) {
      setForm((prev) => ({
        ...prev,
        description: it.description || "",
        colorFront: it.colorFront ?? "",
        colorBack: it.colorBack ?? "",
        jobSize: it.jobSize || ""
      }));
    } else if (form.sampleRequestType !== "new") {
      // no matching item: clear the auto-filled values
      setForm((prev) => ({ ...prev, description: "", colorFront: "", colorBack: "", jobSize: "" }));
    }
  }, [sampleMatchCode, searchMode]);

  // product types available in the Items master (used by the Sample Request dropdown)
  const materialTypeOptions = useMemo(
    () =>
      [...new Set(itemList.map((it) => norm(it.materialType)).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [itemList]
  );

  // only the products of the chosen customer
  const customerItems = useMemo(
    () => itemList.filter((it) => custSearch && norm(it.customerName) === norm(custSearch)),
    [itemList, custSearch]
  );

  // sends the chosen code through the existing handleChange (so all current logic runs)
  const pickItemCode = (code) => {
    if (!code) return;
    handleChange({ target: { name: "productCode", value: code } });
  };

  const onDescPick = (val) => {
    setDescSearch(val);
    const it = customerItems.find((x) => descLabelOf(x) === val);
    if (it) pickItemCode(itemCodeOf(it));
  };

  // clear the search boxes when the form is reset / code cleared
  useEffect(() => {
    if (!form.productCode) {
      setCustSearch("");
      setDescSearch("");
    }
  }, [form.productCode]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name || decoded.username);
      setIndenterFilter(decoded.name || decoded.username);
      setIndenterFilter(decoded.name || decoded.username);
    }
    fetchLocations();
    fetchIndents();
    fetchMaterials();
  }, []);

  const fetchIndents = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/newindent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIndents(res.data);
      fetchFlow();
      fetchExtTickets();
    } catch {
      setIndents([]);
    }
  };
  const fetchExtTickets = async () => {
    try {
      const r = await axios.get(`${BASE_URL}/api/newindent/external-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExtTickets(r.data || {});
    } catch {
      setExtTickets({});
    }
  };
  const fetchExtDetail = async (indentNo) => {
    try {
      const r = await axios.get(
        `${BASE_URL}/api/newindent/external-track/${encodeURIComponent(indentNo)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExtDetail((p) => ({ ...p, [indentNo]: r.data }));
    } catch {
      setExtDetail((p) => ({ ...p, [indentNo]: { error: true } }));
    }
  };
  const fetchFlowDetail = async (indentNo) => {
    if (flowData[indentNo] && !flowData[indentNo].error) return;
    try {
      const r = await axios.get(`${BASE_URL}/api/tracking/detail`, { headers: { Authorization: `Bearer ${token}` }, params: { indentNo } });
      setFlowData((p) => ({ ...p, [indentNo]: r.data }));
    } catch {
      setFlowData((p) => ({ ...p, [indentNo]: { error: true } }));
    }
  };
  // work order of the indent whose Track popup is open
  const trackWoNo = (() => {
    const i = indents.find((x) => x._id === trackId);
    return i ? flow[i.indentNo]?.woNo : null;
  })();
  useEffect(() => {
    if (!trackWoNo) return;
    let live = true;
    fetchWoStageTree(trackWoNo, token)
      .then((t) => { if (live) setWoTrees((p) => ({ ...p, [trackWoNo]: t })); })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWoNo, trackId]);

  useEffect(() => {
    const ind = indents.find((x) => x._id === trackId);
    if (ind && isExtOrder(ind)) fetchExtDetail(ind.indentNo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  useEffect(() => {
    const id = routerLoc.state?.openTrack;
    if (!id) return;
    setShowTrack(true);
    setShowForm(false);
    setTrackId(id);
    setTrackExtra({}); setTrackNote(""); setHoldReason(""); setTrackErr("");
    navigate(routerLoc.pathname, { replace: true, state: null });
  }, [routerLoc.state]);

  const fetchFlow = async () => {
    try {
      const r = await axios.get(`${BASE_URL}/api/tracking`, { headers: { Authorization: `Bearer ${token}` }, params: { limit: 300 } });
      const m = {};
      (r.data || []).forEach((x) => { m[x.ref] = { ...x, stages: (x.stages || []).filter((s) => s.key !== "qc") }; });
      setFlow(m);
    } catch {
      setFlow({});
    }
  };
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) fetchIndents();
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const truncateText = (text, length = 30) => {
    if (!text) return "-";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/locations`);
      setLocations(res.data);
    } catch {
      setLocations([]);
    }
  };

  const fetchProductDetails = async (code) => {
    if (!code) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/master/items/${code}`);
      setForm(prev => ({
        ...prev,
        materialType: res.data.materialType || "",
        description: res.data.description || "",
        customerName: res.data.customerName || "",
        colorFront: res.data.colorFront ?? "",
        colorBack: res.data.colorBack ?? "",
        wasteQty: res.data.wasteQty ?? "",
        jobSize: res.data.jobSize || "",
        inkDetails: res.data.inkDetails || "",
        itemPdfPath: res.data.pdfPath || ""
      }));
    } catch {
      setForm(prev => ({
        ...prev,
        materialType: "",
        description: "",
        customerName: "",
        colorFront: "",
        colorBack: "",
        wasteQty: "",
        jobSize: "",
        inkDetails: "",
        itemPdfPath: ""
      }));
    }
  };

  const onlyAlphaNumeric = (value) => value.replace(/[^a-zA-Z0-9]/g, "");

  // Sample Request: fills every product field from the Items master if the code exists.
  // If the code is not found the form is left as typed.
  const autofillSample = async (code) => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/items/${code}`);
      const d = res.data || {};
      setForm((prev) =>
        prev.productCode !== code ? prev : {
          ...prev,
          materialType: d.materialType || "",
          description: d.description || "",
          customerName: d.customerName || "",
          colorFront: d.colorFront ?? "",
          colorBack: d.colorBack ?? "",
          wasteQty: d.wasteQty ?? "",
          jobSize: d.jobSize || "",
          inkDetails: d.inkDetails || "",
          itemPdfPath: d.pdfPath || ""
        }
      );
    } catch {
      /* code not in master: keep what the user typed */
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files?.[0] || null;
    if (name === "customerCopy") setCustomerCopyFile(file);
    if (name === "artwork") setArtworkFile(file);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "productCode") {
      newValue = onlyAlphaNumeric(value);

      // Sample Request: product code is optional free text and must not overwrite customer / type
      if (searchMode === "sample") {
        setErrors(prev => ({ ...prev, productCode: "" }));
        setForm(prev => ({ ...prev, productCode: newValue }));
        if (newValue) autofillSample(newValue);
        return;
      }

      if (!newValue) {
        setForm(prev => ({
          ...prev,
          productCode: "",
          materialType: "",
          description: "",
          customerName: "",
          colorFront: "",
          colorBack: "",
          wasteQty: "",
          jobSize: "",
          inkDetails: "",
          itemPdfPath: ""
        }));
        return;
      }

      fetchProductDetails(newValue);
    }

    if (name === "quantity" && value < 0) return;

    setErrors(prev => ({ ...prev, [name]: "" }));
    setForm(prev => ({ ...prev, [name]: newValue }));
  };

  const fetchMaterials = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/materials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMaterials(res.data);
    } catch {
      setMaterials([]);
    }
  };

  // each dropdown shows only values that match the OTHER selected dropdowns
  const paperOptions = useMemo(() => {
    const out = {};
    Object.keys(PAPER_FIELDS).forEach((fk) => {
      const set = new Set();
      materials.forEach((m) => {
        const match = Object.entries(PAPER_FIELDS).every(
          ([k, mk]) => k === fk || !form[k] || norm(m[mk]) === form[k]
        );
        const val = norm(m[PAPER_FIELDS[fk]]);
        if (match && val) set.add(val);
      });
      if (form[fk]) set.add(form[fk]); // keep saved value visible when editing
      out[fk] = [...set].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
    });
    return out;
  }, [materials, form.millName, form.paperGroup, form.paperSize, form.gsm]);

  const handlePaperChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (!value) return next;

      // clear any other selection that no longer fits with the new choice
      let pool = materials.filter((m) => norm(m[PAPER_FIELDS[name]]) === value);
      Object.keys(PAPER_FIELDS).forEach((k) => {
        if (k === name || !next[k]) return;
        const mk = PAPER_FIELDS[k];
        const narrowed = pool.filter((m) => norm(m[mk]) === next[k]);
        if (narrowed.length) pool = narrowed;
        else next[k] = "";
      });
      return next;
    });
  };

  const validateForm = () => {
    let newErrors = {};
    if (searchMode !== "sample" && !form.productCode) newErrors.productCode = "Required";
    if (!form.quantity) newErrors.quantity = "Required";
    if (!form.location) newErrors.location = "Required";
if (!form.deliveryDate) newErrors.deliveryDate = "Required";
    if (searchMode === "sample") {
      if (!form.sampleRequestType) newErrors.sampleRequestType = "Required";
      if (!form.sampleType) newErrors.sampleType = "Required";
    } else if (REQUIRE_ARTWORK_UPLOAD && !masterArt.length && !artworkVersions.some((v) => v.status === "Pending" || v.status === "Approved")) {
      newErrors.artwork = "Upload an artwork version. The PO reviewer will approve or reject it.";
      Swal.fire({
        icon: "warning",
        title: "Artwork needed",
        text: "Upload an artwork version (the PO reviewer approves it), or use Sample Request.",
        confirmButtonColor: "#3085d6"
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value ?? "");
      });
      if (searchMode === "sample") formData.set("productCode", sampleMatchCode);
      if (customerCopyFile) formData.append("customerCopy", customerCopyFile);
      if (artworkFile) formData.append("artwork", artworkFile);

      // artwork versions: details as JSON, newly picked files appended in the same order
      const newArtFiles = [];
      const artMeta = artworkVersions.map((v) => {
        let fileIndex = null;
        if (v.file) { fileIndex = newArtFiles.length; newArtFiles.push(v.file); }
        const { file, ...rest } = v;
        return { ...rest, fileIndex };
      });
      formData.append("artworkMeta", JSON.stringify(artMeta));
      newArtFiles.forEach((f) => formData.append("artworkFiles", f));
      formData.append("indentType", searchMode === "sample" ? "sample" : "production");

      const res = editingId
        ? await axios.put(
            `${BASE_URL}/api/newindent/${editingId}`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data"
              }
            }
          )
        : await axios.post(
            `${BASE_URL}/api/newindent`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "multipart/form-data"
              }
            }
          );

      if (res.status === 201 || res.status === 200) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: editingId ? "Indent Updated Successfully" : "Indent Created Successfully",
          width: "350px",
          confirmButtonColor: "#3085d6"
        });

        resetForm();
        fetchIndents();
      }
    } catch (err) {
      console.error("Save Error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Server error while saving indent",
        confirmButtonColor: "#d33"
      });
    }
  };

  const resetForm = () => {
    setForm({
      sampleRequestType: "",
      provisionalCustomerId: "",
      productFamily: "",
      physicalReference: "",
      expectedOrderValue: "",
      productCode: "",
      materialType: "",
      description: "",
      customerName: "",
      colorFront: "",
      colorBack: "",
      specification: "",
      wasteQty: searchMode === "sample" ? "5" : "",
      jobSize: "",
      inkDetails: searchMode === "sample" ? "CMYK" : "",
      quantity: "",
      location: "",
      unitRate: "",
      remark: "",
      deliveryDate: "",

      // ===== NEW FIELDS =====
      lamination: "",
      finish: "",
      jobNo: "",
      soNo: "",
      soDate: "",
      sampleType: "",
      costingConfirmation: "",
      customerPoNo: "",
      customerPoDate: "",
      typeOfBilling: "",
      millName: "",
      paperGroup: "",
      paperSize: "",
      gsm: ""
    });
    setCustomerCopyFile(null);
    setArtworkFile(null);
    setExistingCustomerCopy(null);
    setExistingArtwork(null);
    setArtworkVersions([]);
    setAwFile(null);
    setAwNote("");
    if (awFileInputRef.current) awFileInputRef.current.value = "";
    setErrors({});
    setEditingId(null);
  };

  // ===== EDIT ACTION =====
  const handleEdit = (ind) => {
    if (ind.user !== loggedInUser) {
      Swal.fire({ icon: "warning", title: "Not allowed", text: "Only the user who raised this indent can edit it.", confirmButtonColor: "#3085d6" });
      return;
    }
    const item = ind.items?.[0] || {};
    setForm({
      sampleRequestType: item.sampleRequestType || "",
      provisionalCustomerId: item.provisionalCustomerId || "",
      productFamily: item.productFamily || "",
      physicalReference: item.physicalReference || "",
      expectedOrderValue: item.expectedOrderValue || "",
      specification: item.specification || "",
      productCode: item.productCode || "",
      materialType: item.materialType || "",
      description: item.description || "",
      customerName: item.customerName || "",
      colorFront: item.colorFront || "",
      colorBack: item.colorBack || "",
      wasteQty: item.wasteQty || "",
      jobSize: item.jobSize || "",
      inkDetails: item.inkDetails || "",
      quantity: item.quantity || "",
      location: ind.location?._id || "",
      unitRate: item.unitRate || "",
      remark: item.remark || "",
      deliveryDate: (item.deliveryDate || ind.deliveryDate)
  ? String(item.deliveryDate || ind.deliveryDate).substring(0, 10)
  : "",

      // ===== NEW FIELDS =====
      lamination: item.lamination || "",
      finish: item.finish || "",
      jobNo: item.jobNo || "",
      soNo: item.soNo || "",
      soDate: item.soDate ? item.soDate.substring(0, 10) : "",
      sampleType: item.sampleType || "",
      costingConfirmation: item.costingConfirmation || "",
      customerPoNo: item.customerPoNo || "",
      customerPoDate: item.customerPoDate ? item.customerPoDate.substring(0, 10) : "",
      typeOfBilling: item.typeOfBilling || "",
      itemPdfPath: item.itemPdfPath || "",
      millName: item.millName || "",
      paperGroup: item.paperGroup || "",
      paperSize: item.paperSize || "",
      gsm: item.gsm || ""
    });

    setCustomerCopyFile(null);
    setArtworkFile(null);
    setExistingCustomerCopy(item.customerCopy?.filePath ? item.customerCopy : null);
    setExistingArtwork(item.artwork?.filePath ? item.artwork : null);

    // artwork versions (an old single artwork is shown as an approved v1 so it is not lost)
    const vers = (item.artworkVersions || []).map((v) => ({ ...v, file: null }));
    if (!vers.length && item.artwork?.filePath) {
      vers.push({
        version: 1,
        file: null,
        fileName: item.artwork.fileName,
        filePath: item.artwork.filePath,
        note: "Carried over (earlier upload)",
        status: "Approved",
        comment: "",
        uploadedBy: ind.user || "",
        uploadedAt: ind.createdAt
      });
    }
    setArtworkVersions(vers);
    setAwFile(null);
    setAwNote("");
    setSearchMode(ind.indentType === "sample" ? "sample" : "code");
    setEditingId(ind._id);
    setShowForm(true);
    setShowTrack(false);

    // bring the whole form panel into view, then auto-focus first input field
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    productCodeRef.current?.focus({ preventScroll: true });
  };

  // ===== DELETE ACTION =====
  const handleDelete = async (id) => {
    const target = indents.find((x) => x._id === id);
    if (target && target.user !== loggedInUser) {
      Swal.fire({ icon: "warning", title: "Not allowed", text: "Only the user who raised this indent can delete it.", confirmButtonColor: "#3085d6" });
      return;
    }
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`${BASE_URL}/api/newindent/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          Swal.fire({
            icon: "success",
            title: "Deleted!",
            text: "Indent has been successfully deleted.",
            confirmButtonColor: "#3085d6"
          });
          fetchIndents();
        } catch (err) {
          console.error("Delete Error:", err);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: err.response?.data?.message || "Server error while deleting indent",
            confirmButtonColor: "#d33"
          });
        }
      }
    });
  };

  // ===== APPLY FILTERS (Create New Indent table) =====
  useEffect(() => {
    let result = [...indents];

    if (indentNoFilter) {
      result = result.filter(ind =>
        ind.indentNo?.toLowerCase().includes(indentNoFilter.toLowerCase())
      );
    }

    if (productCodeFilter) {
      result = result.filter(ind =>
        ind.items?.[0]?.productCode?.toLowerCase().includes(productCodeFilter.toLowerCase())
      );
    }
    if (fromDate) {
      result = result.filter((ind) => {
        const created = new Date(ind.createdAt);
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);

        return created >= from;
      });
    }

    if (toDate) {
      result = result.filter((ind) => {
        const created = new Date(ind.createdAt);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);

        return created <= to;
      });
    }
    if (customerFilter) {
      result = result.filter(ind =>
        ind.items?.[0]?.customerName?.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }

    if (indenterFilter) {
      result = result.filter(ind => ind.user === indenterFilter);
    }

    if (locationFilter) {
      result = result.filter(ind => ind.location?._id === locationFilter);
    }

    setFilteredIndents(result);
  }, [indents, indentNoFilter, productCodeFilter, customerFilter, locationFilter, indenterFilter, fromDate, toDate]);

  // everyone who has raised an indent (plus the logged-in user, so the default is always in the list)
  const indenterOptions = [...new Set([loggedInUser, ...indents.map((i) => i.user)].filter(Boolean))].sort();

  const clearFilters = () => {
    setIndentNoFilter("");
    setIndenterFilter("");
    setProductCodeFilter("");
    setCustomerFilter("");
    setLocationFilter("");

    setFromDate("");
    setToDate("");

    fetchIndents();
  };

  // ===== TRACK TABLE (separate list and filters) =====
  const trackIndents = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return indents.filter((ind) => {
      const it = ind.items?.[0] || {};
      const hay = [ind.indentNo, it.customerName, it.productCode, it.description].join(" ").toLowerCase();
      const t = typeKey(ind);
      return (
        (!q || hay.includes(q)) &&
        (!typeFilter || t === typeFilter) &&
        (!stageFilter || (flow[ind.indentNo]?.current || "") === stageFilter)
      );
    });
  }, [indents, searchQ, stageFilter, typeFilter, flow]);



  const clearTrackFilters = () => {
    setSearchQ("");
    setStageFilter("");
    setTypeFilter("");
    fetchIndents();
  };

  // ===== TRACKING actions =====
  const runTrack = async (ind, payload) => {
    try {
      await axios.put(`${BASE_URL}/api/newindent/${ind._id}/track`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrackExtra({});
      setTrackNote("");
      setHoldReason("");
      setTrackErr("");
      await fetchIndents();
    } catch (err) {
      setTrackErr(err.response?.data?.message || "Could not update tracking");
    }
  };

  const advanceStage = (ind) => {
    const nx = PIPE[typeKey(ind)][getStageIdx(ind) + 1];
    if (!nx) return;
    const need = TRACK_EX[nx[0]] || [];
    if (need.some(([l]) => !norm(trackExtra[l]))) {
      setTrackErr("Fill every field marked * to move to this stage.");
      return;
    }
    runTrack(ind, { action: "advance", details: trackExtra, note: trackNote });
  };
  const exportToExcel = () => {
    const data = filteredIndents.map((ind) => ({
      "Indent No": ind.indentNo,
      "Product Code": ind.items?.[0]?.productCode,
      Description: ind.items?.[0]?.description,
      Customer: ind.items?.[0]?.customerName,
      Type: ind.items?.[0]?.materialType,
      Quantity: ind.items?.[0]?.quantity,

      Location: ind.location?.locationName,
      Status: ind.status,
      Stage: PIPE[typeKey(ind)][getStageIdx(ind)][1],
      "On Hold": ind.holdReason || "",
      Remark: ind.items?.[0]?.remark,
      Specification: ind.items?.[0]?.specification,

      // ===== NEW FIELDS =====
      Lamination: ind.items?.[0]?.lamination,
      Finish: ind.items?.[0]?.finish,
      Group: ind.items?.[0]?.paperGroup,
      Size: ind.items?.[0]?.paperSize,
      GSM: ind.items?.[0]?.gsm,
      "Job No": ind.items?.[0]?.jobNo,
      "SO No": ind.items?.[0]?.soNo,
      "SO Date": ind.items?.[0]?.soDate
        ? new Date(ind.items[0].soDate).toLocaleDateString("en-IN")
        : "",
      "Sample Type": ind.items?.[0]?.sampleType,
      "Product Family": ind.items?.[0]?.productFamily || "",
      "Physical Reference": ind.items?.[0]?.physicalReference || "",
      "Expected Order Value (₹)": ind.items?.[0]?.expectedOrderValue || "",
      "Costing Confirmation": ind.items?.[0]?.costingConfirmation,
      "Customer PO No": ind.items?.[0]?.customerPoNo,
      "Customer PO Date": ind.items?.[0]?.customerPoDate
        ? new Date(ind.items[0].customerPoDate).toLocaleDateString("en-IN")
        : "",
      "Type of Billing": ind.items?.[0]?.typeOfBilling,
      "Customer Copy": ind.items?.[0]?.customerCopy?.fileName || "",
      "Artwork": ind.items?.[0]?.artwork?.fileName || "",

      "Saved By": ind.user,
      "User Location": (ind.userLocations || []).join(", "),
      "Saved At": new Date(ind.createdAt).toLocaleString("en-IN")
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Indents");

    XLSX.writeFile(wb, "Indent_Report.xlsx");
  };
  // ===== SAMPLE REQUEST helpers =====
  const PRODUCT_FIELDS_BLANK = {
    productCode: "", materialType: "", description: "", customerName: "",
    colorFront: "", colorBack: "", wasteQty: "", jobSize: "", inkDetails: "", itemPdfPath: ""
  };

  // switching to / from Sample Request starts the product block clean
  const switchMode = (m) => {
    const touchesSample = true; // always start the product block clean on every mode switch

    // full refresh of the rest of the form on every mode switch
    setCustomerCopyFile(null);
    setArtworkFile(null);
    setExistingCustomerCopy(null);
    setExistingArtwork(null);
    setArtworkVersions([]);
    setAwFile(null);
    setAwNote("");
    setEditingId(null);
    if (awFileInputRef.current) awFileInputRef.current.value = "";
    setForm((prev) => ({
      ...prev,
      quantity: "",
      location: "",
      unitRate: "",
      remark: "",
      specification: "",
      deliveryDate: "",
      lamination: "",
      finish: "",
      jobNo: "",
      soNo: "",
      soDate: "",
      sampleType: "",
      costingConfirmation: "",
      customerPoNo: "",
      customerPoDate: "",
      typeOfBilling: "",
      millName: "",
      paperGroup: "",
      paperSize: "",
      gsm: ""
    }));
    setSearchMode(m);
    if (touchesSample) {
      setForm((prev) => ({
        ...prev,
        ...PRODUCT_FIELDS_BLANK,
        wasteQty: m === "sample" ? "5" : "",
        inkDetails: m === "sample" ? "CMYK" : "",
        sampleRequestType: "",
        provisionalCustomerId: "",
        productFamily: "",
        physicalReference: "",
        expectedOrderValue: ""
      }));
      setCustSearch("");
      setDescSearch("");
      setErrors({});
    }
  };

  const handleRequestTypeChange = (e) => {
    const v = e.target.value;
    setErrors((prev) => ({ ...prev, sampleRequestType: "" }));
    setForm((prev) => ({
      ...prev,
      sampleRequestType: v,
      // a brand-new customer is not in the master yet, so the name is typed instead of picked
      customerName: v === "new" || prev.sampleRequestType === "new" ? "" : prev.customerName,
      provisionalCustomerId: v === "new" ? prev.provisionalCustomerId : ""
    }));
  };

  // ===== ADD CUSTOMER + ITEM TO THE ITEMS MASTER =====
  const saveNewItem = async () => {
    if (!norm(newItem.customerName)) {
      Swal.fire({ icon: "warning", title: "Required", text: "Customer name is required.", confirmButtonColor: "#3085d6" });
      return;
    }
    try {
      // read the latest master so the serial continues correctly: P01, P02, P03 ...
      const cur = await axios.get(`${BASE_URL}/api/master/items`, { headers: { Authorization: `Bearer ${token}` } });
      const curList = Array.isArray(cur.data) ? cur.data : (cur.data?.data || []);
      let max = 0;
      [...curList.map((it) => itemCodeOf(it)), ...indents.map((x) => String(x.items?.[0]?.productCode || ""))].forEach((c) => {
        const m = /^P(\d+)$/i.exec(c);
        if (m) max = Math.max(max, Number(m[1]));
      });
      const code = "P" + String(max + 1).padStart(2, "0");

      // no unique code is sent; ink is always CMYK
      const { uniqueCode, ...rest } = newItem;
      const payload = { ...rest, itemCode: code, inkDetails: "CMYK" };
      payload.wasteQty = newItem.wasteQty === "" ? undefined : Number(newItem.wasteQty);
      await axios.post(`${BASE_URL}/api/master/items`, payload);

      // refresh the master lists so the customer / product type show up as normal
      const res = await axios.get(`${BASE_URL}/api/master/items`, { headers: { Authorization: `Bearer ${token}` } });
      setItemList(Array.isArray(res.data) ? res.data : (res.data?.data || []));

      // put the new item into the sample form
      setForm((prev) => ({
        ...prev,
        productCode: code,
        materialType: newItem.materialType,
        description: newItem.description,
        customerName: newItem.customerName,
        colorFront: newItem.colorFront,
        colorBack: newItem.colorBack,
        wasteQty: newItem.wasteQty,
        jobSize: newItem.jobSize,
        inkDetails: "CMYK"
      }));
      setShowAddCust(false);
      setNewItem(BLANK_ITEM);
      Swal.fire({ icon: "success", title: "Saved", text: `Customer item added to the master as ${code}.`, width: "350px", confirmButtonColor: "#3085d6" });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.message || "Could not save the item", confirmButtonColor: "#d33" });
    }
  };

  // customer is a master dropdown in Sample Request, except for a brand-new customer
  const custIsSelect = searchMode === "sample" && form.sampleRequestType !== "new";

  // ===== ARTWORK MANAGEMENT helpers =====
  const awBadge = (s) =>
    "custom-badge " +
    (s === "Approved" ? "badge-approved" : s === "Rejected" ? "badge-rejected" : s === "Pending" ? "badge-pending" : "badge-secondary");

  const liveArtwork = artworkVersions.filter((v) => v.status !== "Superseded");
  const latestArtwork = liveArtwork[liveArtwork.length - 1] || artworkVersions[artworkVersions.length - 1] || null;

  const nextMasterVer = masterArt.length ? Math.max(...masterArt.map((v) => v.version || 0)) + 1 : 1;

  const changeMasterArtwork = async (file, noteText) => {
    if (!file || !artCode) return;
    const fd = new FormData();
    fd.append("artwork", file);
    fd.append("note", (noteText !== undefined ? noteText : awNote) || "");
    try {
      const res = await axios.post(`${BASE_URL}/api/master/items/${artCode}/artwork`, fd, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMasterArt(res.data?.artworkVersions || []);

      // the new item version is also added to this indent as Pending (goes back to the PO reviewer on save)
      const savedList = res.data?.artworkVersions || [];
      const newest = savedList[savedList.length - 1];
      if (newest) {
        setArtworkVersions((prev) => [
          ...prev.map((v) => (v.status === "Pending" ? { ...v, status: "Superseded" } : v)),
          {
            version: Math.max(0, ...prev.map((v) => v.version || 0)) + 1,
            file: null,
            fileName: newest.fileName,
            filePath: newest.filePath,
            note: newest.note || "From item artwork V" + newest.version,
            status: "Pending",
            comment: "",
            uploadedBy: newest.uploadedBy || loggedInUser,
            uploadedAt: newest.uploadedAt || new Date().toISOString()
          }
        ]);
        setErrors((prev) => ({ ...prev, artwork: "" }));
      }
      setAwNote("");
      Swal.fire({ icon: "success", title: "Artwork saved as V" + nextMasterVer, timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.response?.data?.message || "Could not save artwork" });
    }
    if (masterArtInputRef.current) masterArtInputRef.current.value = "";
  };

  // opens the preview window; nothing is saved until the user confirms
  const openArtConfirm = (file, kind) => {
    if (!file) return;
    setArtRead(false);
    if (kind === "master") setAwNote("");
    setArtConfirm({
      file,
      kind,
      url: URL.createObjectURL(file),
      isPdf: /\.pdf$/i.test(file.name),
      isImg: /\.(png|jpe?g)$/i.test(file.name)
    });
  };

  const openLatestConfirm = () => {
    const last = masterArt[masterArt.length - 1];
    if (!last) return;
    setArtRead(false);
    setArtConfirm({
      file: { name: "V" + last.version + " - " + last.fileName },
      kind: "latest",
      url: BASE_URL + last.filePath,
      isPdf: /\.pdf$/i.test(last.fileName || ""),
      isImg: /\.(png|jpe?g)$/i.test(last.fileName || "")
    });
  };

  const closeArtConfirm = () => {
    if (artConfirm?.url) URL.revokeObjectURL(artConfirm.url);
    setArtConfirm(null);
    setArtRead(false);
    if (masterArtInputRef.current) masterArtInputRef.current.value = "";
  };

  const saveArtConfirm = () => {
    if (!artConfirm || !artRead) return;
    const { file, kind } = artConfirm;
    if (kind === "master") changeMasterArtwork(file, awNote);
    else addArtworkVersion(true);
    if (artConfirm.url) URL.revokeObjectURL(artConfirm.url);
    setArtConfirm(null);
    setArtRead(false);
  };

  const addArtworkVersion = (confirmed) => {
    // item already has saved artwork: send its LATEST version with this indent (no new version is created)
    if (artCode && masterArt.length > 0) {
      // show the latest saved artwork first; attach it only after the confirm checkbox + Save
      if (confirmed !== true) { openLatestConfirm(); return; }
      const last = masterArt[masterArt.length - 1];
      setArtworkVersions([
        {
          version: last.version,
          file: null,
          fileName: last.fileName,
          filePath: last.filePath,
          note: last.note || "From item artwork V" + last.version,
          status: "Pending",
          comment: "",
          uploadedBy: last.uploadedBy || loggedInUser,
          uploadedAt: last.uploadedAt || new Date().toISOString()
        }
      ]);
      setErrors((prev) => ({ ...prev, artwork: "" }));
      return;
    }
    if (!awFile) { awFileInputRef.current?.focus(); return; }

    // show the file first; the real save runs only after the confirm checkbox + Save
    if (confirmed !== true) { openArtConfirm(awFile, "version"); return; }

    // production indent with a product code: save the file against the item (V1, V2, V3...)
    if (artCode) {
      changeMasterArtwork(awFile).then(() => {
        setAwFile(null);
        if (awFileInputRef.current) awFileInputRef.current.value = "";
        setErrors((prev) => ({ ...prev, artwork: "" }));
      });
      return;
    }
    setArtworkVersions((prev) => {
      const nextNo = prev.length ? Math.max(...prev.map((v) => v.version)) + 1 : 1;
      // a newer upload replaces the previous pending one
      const older = prev.map((v) => (v.status === "Pending" ? { ...v, status: "Superseded" } : v));
      return [
        ...older,
        {
          version: nextNo,
          file: awFile,
          fileName: awFile.name,
          filePath: "",
          note: awNote,
          status: "Pending",
          comment: "",
          uploadedBy: loggedInUser,
          uploadedAt: new Date().toISOString()
        }
      ];
    });
    setErrors((prev) => ({ ...prev, artwork: "" }));
    setAwFile(null);
    setAwNote("");
    if (awFileInputRef.current) awFileInputRef.current.value = "";
  };



  // ---- Double-click protection for Save Indent ----
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSafeSubmit = async (e) => {
    e.preventDefault();
    if (isSavingRef.current) return; // ignore the 2nd click instantly
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await handleSubmit(e);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <>
      <style>{`
        /* font loaded locally */

        /* ============ Theme tokens ============ */
        .indent-app-container {
          --brand: #e4572e;
          --brand-dark: #c9461f;
          --brand-soft: #fdeee8;
          --teal: #0b3a45;
          --teal-mid: #0f5560;
          --teal-soft: #e3f1f4;
          --ink: #1f2937;
          --ink-soft: #5b6676;
          --ink-mute: #8a94a3;
          --line: #e3e7ec;
          --line-soft: #eef1f4;
          --field-line: #cfd6de;
          --page: #f4f6f8;
          --ok: #1f9d6b;
          --danger: #d64545;
        }

        /* ============ Page shell ============ */
        .indent-app-container {
          max-width: 100%;
          min-height: 100vh;
          padding: 20px 28px 36px;
          font-family: 'Noto Sans', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
          font-size: 14px;
          color: var(--ink);
          border: none;
          border-radius: 0px;
          background: var(--page);
          box-shadow: none;
        }

        /* ============ Page header ============ */
        .indent-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px 8px;
          margin-bottom: 12px;
          border-bottom: 1px solid var(--line);
        }

        .indent-title {
          margin: 0;
          color: var(--ink);
          font-size: 20px;
          font-weight: 700;
          line-height: 1.15;
          text-shadow: none;
        }

        .user-pill {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-60%);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: #ffffff;
          box-shadow: none;
          color: var(--ink);
          font-size: 0.78rem;
          font-weight: 600;
        }

        /* ============ Entry panel ============ */
        .indent-app-container .gl-stage {
          position: relative;
          overflow: visible;
          margin-bottom: 16px;
          padding: 0;
          border-radius: 0;
          border: none;
          background: transparent;
          box-shadow: none;
        }

        .indent-app-container .gl-stage::before,
        .indent-app-container .gl-stage::after {
          content: none;
        }

        .indent-app-container .gl-card {
          position: relative;
          z-index: 1;
          padding: 18px 22px 20px;
          color: var(--ink);
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #ffffff;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          box-shadow: 0 2px 8px rgba(16, 24, 40, 0.07);
        }

        .indent-app-container .gl-head {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--line);
        }

        .indent-app-container .gl-title {
          margin: 0;
          color: var(--ink);
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.1px;
        }

        .indent-app-container .gl-pill {
          display: inline-block;
          padding: 3px 14px;
          border-radius: 4px;
          border: 1px solid #bdd9df;
          background: var(--teal-soft);
          color: var(--teal-mid);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .indent-app-container .gl-inner {
          margin-top: 12px;
          padding: 12px 14px 14px;
          border-radius: 8px;
          border: 1px solid var(--line);
          background: #ffffff;
          box-shadow: none;
        }

        .indent-app-container .gl-inner.first {
          margin-top: 0;
        }

        .indent-app-container .gl-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: var(--ink);
          font-size: 13px;
          font-weight: 700;
          padding-left: 8px;
          border-left: 3px solid var(--brand);
        }

        .indent-app-container .gl-group i {
          color: var(--brand);
          font-size: 0.95rem;
          background: transparent;
          border-radius: 50%;
          line-height: 1;
        }

        /* ============ Labels / inputs ============ */
        .custom-label {
          display: block !important;
          margin-bottom: 4px !important;
          overflow: hidden;
          color: var(--ink-soft) !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .required-star {
          margin-left: 0.2rem;
          color: var(--danger);
          font-weight: 700;
        }

        .indent-app-container .custom-input,
        .indent-app-container select.custom-input,
        .indent-app-container textarea.custom-input {
          display: block;
          width: 100%;
          min-height: 36px;
          padding: 5px 10px !important;
          border: 1px solid var(--field-line) !important;
          border-radius: 6px !important;
          background-color: #ffffff !important;
          color: var(--ink) !important;
          font-family: inherit;
          font-size: 0.82rem !important;
          font-weight: 500 !important;
          line-height: 1.5 !important;
          box-shadow: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
          color-scheme: light;
        }

        .indent-app-container select.custom-input {
          padding-right: 26px !important;
        }

        .indent-app-container .custom-input:focus,
        .indent-app-container select.custom-input:focus,
        .indent-app-container textarea.custom-input:focus {
          border-color: var(--teal-mid) !important;
          background-color: #ffffff !important;
          outline: none !important;
          box-shadow: 0 0 0 3px rgba(15, 85, 96, 0.15) !important;
        }

        .indent-app-container .custom-input-readonly {
          border: 1px solid var(--line) !important;
          background-color: #f7f9fb !important;
          color: var(--ink-soft) !important;
          cursor: not-allowed !important;
        }

        .indent-app-container .custom-input::placeholder {
          color: var(--ink-mute) !important;
          font-weight: 400 !important;
          opacity: 1 !important;
        }

        .indent-app-container .custom-textarea {
          min-height: 58px;
          resize: vertical;
        }

        .indent-app-container input[type="file"].custom-input {
          padding: 4px 8px !important;
        }

        .indent-app-container small,
        .indent-app-container .text-muted {
          font-size: 0.72rem;
        }
        .indent-app-container .text-muted { color: var(--ink-mute) !important; }
        .indent-app-container .text-primary { color: var(--teal-mid) !important; }
        .indent-app-container a { color: var(--teal-mid); font-weight: 600; }
        .indent-app-container a:hover { color: var(--brand); }

        .indent-error-text {
          display: block;
          margin-top: 0.2rem;
          color: var(--danger);
          font-size: 0.72rem;
          font-weight: 600;
        }

        .indent-app-container .btn-submit-indent {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 200px;
          justify-content: center;
          padding: 9px 28px;
          border: 1px solid var(--brand);
          border-radius: 6px;
          background: var(--brand);
          color: #ffffff;
          font-size: 0.88rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .indent-app-container .btn-submit-indent:hover {
          color: #ffffff;
          background: var(--brand-dark);
          border-color: var(--brand-dark);
          filter: none;
          transform: none;
        }

        /* ============ Section cards (filters / table) ============ */
        .bar-card {
          margin-top: 16px;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(16, 24, 40, 0.06);
        }

        .bar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 20px;
          background: #ffffff;
          border-bottom: 1px solid var(--line);
          color: var(--ink);
        }

        .bar-head h5 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: var(--ink);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0;
        }

        .bar-head h5 svg { color: var(--brand); }

        .bar-body {
          padding: 14px 20px 16px;
        }

        .bar-count {
          padding: 3px 12px;
          border-radius: 999px;
          background: var(--page);
          border: 1px solid var(--line);
          color: var(--ink-soft);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .indent-app-container .btn-export {
          min-height: 36px;
          border: 1px solid var(--brand);
          border-radius: 6px;
          background: var(--brand);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(228, 87, 46, 0.35);
        }

        .indent-app-container .btn-export:hover {
          color: #ffffff;
          background: var(--brand-dark);
          border-color: var(--brand-dark);
          filter: none;
        }

        .indent-app-container .btn-clear-filters {
          min-height: 36px;
          border: 1px solid var(--field-line);
          border-radius: 6px;
          background: #ffffff;
          color: var(--ink);
          font-size: 0.82rem;
          font-weight: 600;
          box-shadow: none;
          cursor: pointer;
        }

        .indent-app-container .btn-clear-filters:hover {
          color: var(--teal-mid);
          background: var(--page);
          border-color: var(--teal-mid);
          filter: none;
        }

        /* Action Buttons */
        .btn-action-edit {
          background-color: #ffffff !important;
          color: var(--teal-mid) !important;
          border: 1px solid var(--teal-mid) !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          padding: 0.25rem 0.7rem !important;
          border-radius: 6px !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-edit:hover {
          background-color: var(--teal-mid) !important;
          color: #ffffff !important;
        }

        .btn-action-delete {
          background-color: #fdecec !important;
          color: #b42323 !important;
          border: 1px solid #f3c1c1 !important;
          font-weight: 600 !important;
          font-size: 0.75rem !important;
          padding: 0.25rem 0.7rem !important;
          border-radius: 6px !important;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-delete:hover {
          background-color: var(--danger) !important;
          color: #ffffff !important;
          border-color: var(--danger) !important;
        }

        /* ============ Table ============ */
        .custom-table-container {
          width: 100%;
          max-height: 560px;
          overflow-y: auto;
          overflow-x: auto;
          background: #ffffff;
        }

        .custom-table-container table {
          margin-bottom: 0;
          color: var(--ink);
          background: #ffffff;
        }

        .custom-table-container thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 0.7rem 0.8rem;
          background: #f7f9fb !important;
          color: var(--ink-soft) !important;
          border-color: var(--line) !important;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          white-space: nowrap;
          vertical-align: middle;
        }

        .custom-table-container tbody td {
          padding: 0.55rem 0.8rem;
          border-color: var(--line-soft) !important;
          font-size: 0.82rem;
          font-weight: 500;
          vertical-align: middle;
          background-color: #ffffff;
          color: var(--ink);
        }

        .custom-table-container tbody tr:nth-child(even) td { background-color: #fafbfc; }

        .custom-table-container tbody tr:hover td {
          background: var(--brand-soft) !important;
        }

        .custom-badge {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 600;
        }

        .badge-pending {
          background-color: #fff3d6;
          color: #8a5a00;
          border: 1px solid #f2d291;
        }

        .badge-approved {
          background-color: #e4f6ee;
          color: #167a52;
          border: 1px solid #b7e4d0;
        }

        .badge-rejected {
          background-color: #fdecec;
          color: #b42323;
          border: 1px solid #f3c1c1;
        }

        .badge-secondary {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .custom-table-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-table-container::-webkit-scrollbar-track {
          background: #f1f3f6;
        }
        .custom-table-container::-webkit-scrollbar-thumb {
          background: #c5ccd5;
          border-radius: 8px;
        }
        .custom-table-container::-webkit-scrollbar-thumb:hover {
          background: #a9b4c0;
        }

        @media (max-width: 768px) {
          .indent-app-container {
            padding: 12px;
            border-radius: 0;
          }

          .indent-header {
            flex-direction: column;
            gap: 6px;
          }

          .user-pill {
            position: static;
            transform: none;
          }

          .indent-app-container .gl-card {
            padding: 14px;
            border-radius: 8px;
          }
        }

        /* ---------- Small field icons (CSS-only, no markup changes) ---------- */
.indent-app-container select.custom-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="productCode"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h16M4 15h16M10 3L8 21M16 3l-2 18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="quantity"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z'/%3E%3Cpath d='M3.3 7L12 12l8.7-5M12 22V12'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container select.custom-input[name="location"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="unitRate"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4.5 4.5 0 0 0 0-10'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="lamination"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2l10 5-10 5L2 7z'/%3E%3Cpath d='M2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="finish"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="jobNo"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h16M4 15h16M10 3L8 21M16 3l-2 18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[name="soNo"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpath d='M14 2v6h6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container select.custom-input[name="sampleType"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z'/%3E%3Ccircle cx='7' cy='7' r='1.5'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="costingConfirmation"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container select.custom-input[name="typeOfBilling"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 2v20l3-2 2 2 3-2 3 2 2-2 3 2V2l-3 2-2-2-3 2-3-2-2 2z'/%3E%3Cpath d='M8 8h8M8 12h8'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}

.indent-app-container input.custom-input[name="customerPoNo"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/%3E%3Cpath d='M14 2v6h6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container textarea.custom-input[name="remark"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px 11px;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[type="date"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[placeholder*="Indent No"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M21 21l-4.3-4.3'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[placeholder*="Search Code"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h16M4 15h16M10 3L8 21M16 3l-2 18'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container input.custom-input[placeholder*="Customer"] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 15px;
  padding-left: 33px !important;
}

.indent-app-container .bar-body select.custom-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a94a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat, no-repeat;
  background-position: 10px center, right 10px center;
  background-size: 15px, 14px;
  padding-left: 33px !important;
  padding-right: 30px !important;
}


        /* =====================================================================
           PLANNER PAGE LOOK (appended override, presentation only)
           ===================================================================== */
        .indent-app-container{--ink:#000;--ink-soft:#000;--ink-mute:#000;font-size:12.5px;padding:24px 28px 40px}
        .indent-app-container .text-muted,.indent-app-container .text-primary,.indent-app-container small{color:#000!important}
        .indent-app-container a{color:#0f5560}
        .indent-app-container .gl-title{font-size:16px}
        .indent-app-container .gl-pill{font-size:10.5px;color:#000;background:#e3f1f4;border-color:#b9d6dd}
        .indent-error-text{color:#d64545!important}

        /* split entry form */
        .indent-app-container .gl-card.indent-split{display:flex;padding:0;overflow:hidden;max-width:1180px;margin-left:auto;margin-right:auto}
        .indent-app-container .indent-split .po-main{padding:22px 28px 22px}
        .indent-app-container .indent-split .gl-inner{border:0;padding:0;margin-top:14px;background:transparent}
        .indent-app-container .indent-split .gl-inner.first{margin-top:0}
        .indent-app-container .indent-split .gl-group{font-size:13px;margin-bottom:10px}
        .indent-app-container .indent-split .gl-group i{font-size:.9rem}
        .indent-app-container .indent-split .btn-submit-indent{font-size:12.5px;padding:9px 36px;min-width:190px}
        .indent-app-container .indent-split .po-heading .gl-pill{font-size:10.5px}
        .po-field.po-area .po-field-label{top:17px}
        .po-field.po-area.is-floated .po-field-label,.po-field.po-area:focus-within .po-field-label{top:0}
        .po-field.po-area .po-field-icon{top:15px;transform:none}

        /* filter / table cards */
        .bar-head h5{font-size:14px;padding-left:8px;border-left:3px solid #e4572e}
        .bar-head h5 svg{color:#e4572e}
        .bar-count{font-size:11px;color:#000}
        .indent-app-container .btn-export{background:#d9f2e6;border-color:#a9dcc3;color:#000;box-shadow:none;font-size:12px;min-height:34px}
        .indent-app-container .btn-export:hover{background:#c5ebd6;border-color:#8fceb0;color:#000}
        .indent-app-container .btn-clear-filters{font-size:12px;min-height:34px;color:#000}
        .btn-action-edit{background-color:#e8f3f6!important;color:#000!important;border:1px solid #b9d6dd!important}
        .btn-action-edit:hover{background-color:#d5e9ee!important;color:#000!important}
        .btn-action-edit:disabled,.btn-action-delete:disabled{opacity:.45;cursor:not-allowed!important}
        .btn-action-delete{background-color:#fbdcdc!important;color:#000!important;border:1px solid #f0b4b4!important}
        .btn-action-delete:hover{background-color:#f7c7c7!important;color:#000!important;border-color:#f0b4b4!important}

        /* table */
        .custom-table-container thead th{background:#a9d0d9!important;color:#000!important;border:1px solid #8fbcc7!important;font-size:10.5px}
        .custom-table-container tbody td{font-size:12px;color:#000}
        .custom-badge{font-size:11px;color:#000!important}
        .badge-pending{background-color:#fff3d6}
        .badge-approved{background-color:#d9f2e6;border-color:#a9dcc3}
        .badge-rejected{background-color:#fbdcdc;border-color:#f0b4b4}

  /* ---- outlined floating-label fields (Planner look) ---- */
  .indent-app-container .po-field{position:relative;display:flex;align-items:center;min-height:36px;background:#fff;border:1px solid #cfd6de;border-radius:6px;transition:border-color .15s ease,box-shadow .15s ease}
  .indent-app-container .po-field:focus-within{border-color:#0f5560;box-shadow:0 0 0 3px rgba(15,85,96,.15)}
  .indent-app-container .po-field.po-invalid{border-color:#d64545}
  .indent-app-container .po-field-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#000;font-size:.8rem;pointer-events:none;z-index:1}
  .indent-app-container .po-field .po-input{width:100%;min-height:34px;padding:6px 8px 6px 32px;border:none!important;outline:none;background:transparent!important;box-shadow:none!important;border-radius:6px;font-family:inherit;font-size:.8rem;font-weight:500;color:#000}
  .indent-app-container .po-field .po-input[readonly]{background:#f7f9fb!important}
  .indent-app-container .po-field textarea.po-input{min-height:34px;padding-top:10px;resize:vertical}
  .indent-app-container .po-field select.po-input{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:28px}
  .indent-app-container .po-field .po-input:disabled{background:#f1f3f5!important;cursor:not-allowed}
  .indent-app-container .po-field .po-input::placeholder{color:#6b7685;opacity:1}
  .indent-app-container .po-caret{position:absolute;right:10px;font-size:.7rem;color:#000;pointer-events:none}
  .indent-app-container .po-field-label{position:absolute;left:32px;top:50%;transform:translateY(-50%);max-width:calc(100% - 34px);overflow:hidden;text-overflow:ellipsis;padding:0 4px;background:#fff;color:#000;font-size:.8rem;font-weight:500;white-space:nowrap;pointer-events:none;transition:all .15s ease}
  .indent-app-container .po-field:focus-within .po-field-label,.indent-app-container .po-field.is-floated .po-field-label{top:0;left:24px;font-size:.62rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
  .indent-app-container .po-req{color:#d64545}

  /* ---- split form card (teal info panel + white form) ---- */
  .indent-app-container .indent-split.po-split{display:flex;background:#fff;border:1px solid #e3e7ec;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.07)}
  .indent-app-container .indent-split .po-side{flex:0 0 28%;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:24px;color:#fff;background:linear-gradient(170deg,#0b3a45 0%,#0f5560 100%)}
  .indent-app-container .indent-split .po-side::before{content:'';position:absolute;width:260px;height:260px;border-radius:50%;right:-110px;top:-90px;background:rgba(255,255,255,.06)}
  .indent-app-container .indent-split .po-side::after{content:'';position:absolute;width:200px;height:200px;border-radius:50%;left:-90px;bottom:-80px;background:rgba(228,87,46,.18)}
  .indent-app-container .indent-split .po-side>*{position:relative;z-index:1}
  .indent-app-container .indent-split .po-side-brand{font-weight:700;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;color:#ffb59c}
  .indent-app-container .indent-split .po-side-hero h2{margin:0;padding:0;color:#fff!important;font-size:21px;font-weight:600;line-height:1.15}
  .indent-app-container .indent-split .po-side-hero h1{margin:0 0 12px;color:#fff!important;font-size:36px;font-weight:700;line-height:1;letter-spacing:-.5px}
  .indent-app-container .indent-split .po-side-hero p{margin:0;max-width:210px;font-size:12px;line-height:1.55;color:#c9dde1}
  .indent-app-container .indent-split .po-side-foot{color:#ffb59c;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
  .indent-app-container .indent-split .po-main{flex:1;min-width:0;padding:22px 28px;background:#fff}
  .indent-app-container .indent-split .po-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#000;font-size:17px;font-weight:700;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #e3e7ec}
  .indent-app-container .indent-split .po-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}
  .indent-app-container .indent-split .po-grid .po-full{grid-column:1/-1}
  .indent-app-container .indent-split .po-actions{display:flex;justify-content:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e3e7ec}
  .indent-app-container .indent-split .po-actions .btn{min-width:150px;height:38px;padding:0 18px;font-size:12.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
  .indent-app-container .indent-split .po-actions .btn-po-save{background:#e4572e!important;border:1px solid #e4572e!important;color:#fff!important;box-shadow:0 1px 2px rgba(228,87,46,.35)}
  .indent-app-container .indent-split .po-actions .btn-po-save:hover:not(:disabled){background:#c9461f!important;border-color:#c9461f!important}
  .indent-app-container .indent-split .po-actions .btn-po-save:disabled{background:#e2e4ea!important;border-color:#e2e4ea!important;color:#9DA2B0!important;box-shadow:none}
  @media(max-width:992px){.indent-app-container .indent-split.po-split{flex-direction:column}.indent-app-container .indent-split .po-side{flex:none;min-height:150px;padding:20px;gap:14px}.indent-app-container .indent-split .po-side-hero h1{font-size:28px;margin-bottom:6px}.indent-app-container .indent-split .po-main{padding:18px 14px}.indent-app-container .indent-split .po-grid{grid-template-columns:1fr}}

        /* "Create New Indent" toggle button (same tab style as the Planner / Customer pages) */
        .indent-app-container .mode-toggle-bar{display:flex;justify-content:center;gap:4px;width:fit-content;margin:0 auto 18px;padding:4px;border-radius:8px;background:#fff;border:1px solid #e3e7ec;box-shadow:0 1px 2px rgba(16,24,40,.05)}
        .indent-app-container .mode-pill-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid transparent;background:transparent;color:#000;border-radius:6px;padding:6px 18px;font-weight:600;font-size:12px;cursor:pointer;transition:all .15s ease}
        .indent-app-container .mode-pill-btn:hover{background:#f4f6f8}
        .indent-app-container .mode-pill-btn.active{background:#fde3d8;border-color:#f5b9a1;color:#000}
        .indent-app-container .mode-pill-btn i{color:#e4572e}
        .indent-app-container .gl-stage:empty{display:none}

/* show the full label on hover/focus */
.indent-app-container .po-field:hover .po-field-label,
.indent-app-container .po-field:focus-within .po-field-label,
.indent-app-container .po-field.is-floated .po-field-label {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  z-index: 3;
}
.indent-app-container .po-field .po-input {
  text-overflow: ellipsis;
  min-width: 0;
}
.indent-app-container .po-field input[type="date"].po-input {
  padding-right: 6px;
}

        /* =====================================================================
           page entrance animation (appended, css only)
           ===================================================================== */
        @keyframes pgfadeup {
          from { opacity: 0; transform: translatey(18px); }
          to   { opacity: 1; transform: translatey(0); }
        }
        @keyframes pgfadedown {
          from { opacity: 0; transform: translatey(-14px); }
          to   { opacity: 1; transform: translatey(0); }
        }
        @keyframes pgpop {
          from { opacity: 0; transform: translatey(16px) scale(0.98); }
          to   { opacity: 1; transform: translatey(0) scale(1); }
        }
        @keyframes pgslideright {
          from { opacity: 0; transform: translatex(-18px); }
          to   { opacity: 1; transform: translatex(0); }
        }
        @keyframes pgfade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pgrow {
          from { opacity: 0; transform: translatey(8px); }
          to   { opacity: 1; transform: translatey(0); }
        }

        /* page container (fade only) */
        .indent-app-container { animation: pgfade 0.45s ease-out backwards; }

        /* top button drops in */
        .indent-app-container .mode-toggle-bar {
          animation: pgfadedown 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
        }

        /* entry form (plays every time it opens) */
        .indent-app-container .indent-split {
          animation: pgpop 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s backwards;
        }
        .indent-app-container .indent-split .po-side {
          animation: pgslideright 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
        }
        .indent-app-container .indent-split .po-heading,
        .indent-app-container .indent-split .gl-inner,
        .indent-app-container .indent-split .text-center {
          animation: pgfadeup 0.45s ease-out backwards;
        }
        .indent-app-container .indent-split .po-heading { animation-delay: 0.25s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(1) { animation-delay: 0.32s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(2) { animation-delay: 0.40s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(3) { animation-delay: 0.48s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(4) { animation-delay: 0.56s; }
        .indent-app-container .indent-split form > .gl-inner:nth-child(5) { animation-delay: 0.64s; }
        .indent-app-container .indent-split form > .text-center { animation-delay: 0.72s; }

        /* filter card + table card */
        .indent-app-container .bar-card {
          animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.25s backwards;
        }
        .indent-app-container .bar-card + .bar-card { animation-delay: 0.38s; }

        /* table rows: quick stagger on the first rows */
        .indent-app-container .custom-table-container tbody tr { animation: pgrow 0.35s ease-out backwards; }
        .indent-app-container .custom-table-container tbody tr:nth-child(1)  { animation-delay: 0.55s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(2)  { animation-delay: 0.60s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(3)  { animation-delay: 0.65s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(4)  { animation-delay: 0.70s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(5)  { animation-delay: 0.75s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(6)  { animation-delay: 0.80s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(7)  { animation-delay: 0.85s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(8)  { animation-delay: 0.90s; }
        .indent-app-container .custom-table-container tbody tr:nth-child(n+9) { animation-delay: 0.95s; }

        /* ---- tracking table ---- */
        .custom-badge.badge-info{background:#fdeee8;border:1px solid #f5b9a1}
        .trk-bar{width:90px;height:6px;border-radius:9px;background:#e3e7ec}
        .trk-bar i{display:block;height:100%;border-radius:9px;background:#e4572e}
        .custom-table-container tbody tr.trk-selected td{background:#fde3d8!important}
        .trk-panel{border-top:1px solid #e3e7ec}
        .trk-steps{list-style:none;display:flex;flex-wrap:wrap;gap:10px 18px;padding:0;margin:10px 0}
        .trk-steps li{display:flex;gap:8px;align-items:flex-start;color:#5b6676;font-size:12.5px;min-width:130px}
        .trk-steps span{width:22px;height:22px;border-radius:50%;border:2px solid #cfd6de;display:grid;place-items:center;font-size:11px;font-weight:700;flex:none}
        .trk-steps li.done{color:#000}
        .trk-steps li.done span{background:#1f9d6b;border-color:#1f9d6b;color:#fff}
        .trk-steps li.now{color:#000;font-weight:700}
        .trk-steps li.now span{border-color:#e4572e;color:#e4572e}
        .trk-steps small{display:block;color:#5b6676;font-weight:400}

        .trk-boxes{display:flex;gap:4px;align-items:center;flex-wrap:nowrap}
        .trk-box{padding:3px 8px;border-radius:4px;font-size:10.5px;font-weight:600;white-space:nowrap;color:#000;background:#f1f3f5;border:1px solid #d5dbe1}
        .trk-box.trk-done{background:#d9f2e6;border-color:#1f9d6b}
        .trk-box.trk-partial{background:#fff3d6;border-color:#d98a00}
        .trk-box.trk-current{background:#fde3d8;border-color:#e4572e;box-shadow:0 0 0 2px rgba(228,87,46,.25)}
        .trk-box.trk-stopped{background:#fbdcdc;border-color:#d64545}
        .trk-box.trk-na{background:#f8f9fa;border-style:dashed;color:#6b7685}

        .trk-line{display:flex;align-items:center}
        .trk-step{display:inline-flex;align-items:center}
        .trk-seg{display:inline-block;width:22px;height:3px;background:#d5dbe1}
        .trk-seg.on{background:#1f9d6b}
        .trk-dot{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid #b8c0cb;background:#fff;cursor:default}
        .trk-d-done{background:#1f9d6b;border-color:#1f9d6b}
        .trk-d-partial{background:#fff3d6;border-color:#d98a00}
        .trk-d-current{background:#fff;border-color:#e4572e;box-shadow:0 0 0 3px rgba(228,87,46,.25)}
        .trk-d-stopped{background:#d64545;border-color:#d64545}
        .trk-d-na{border-style:dashed;background:#f8f9fa}

        /* ---- bell (artwork updates) ---- */
        .indent-app-container{position:relative}
        .bell-btn{position:absolute;top:24px;right:28px;z-index:50;width:38px;height:38px;border-radius:50%;border:1px solid #e3e7ec;background:#fff;color:#0f5560;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(16,24,40,.1)}
        .bell-btn:hover{background:#e8f3f6}
        .bell-badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#d64545;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
        .bell-backdrop{position:fixed;inset:0;z-index:1990}
        .bell-panel{position:absolute;top:70px;right:28px;z-index:2000;width:min(460px,92vw);max-height:70vh;overflow:auto;background:#fff;border:1px solid #e3e7ec;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
        .bell-btn{z-index:1995}

        /* ---- bigger entry form ---- */
        .indent-app-container .gl-card.indent-split{max-width:1500px}
        .indent-app-container .indent-split .po-side{flex:0 0 24%;padding:30px}
        .indent-app-container .indent-split .po-side-hero h2{font-size:24px}
        .indent-app-container .indent-split .po-side-hero h1{font-size:42px}
        .indent-app-container .indent-split .po-side-hero p{font-size:13.5px;max-width:240px}
        .indent-app-container .indent-split .po-main{padding:30px 40px}
        .indent-app-container .indent-split .po-heading{font-size:20px;margin-bottom:20px}
        .indent-app-container .indent-split .gl-group{font-size:15px;margin-bottom:14px}
        .indent-app-container .indent-split .gl-inner{margin-top:22px}
        .indent-app-container .indent-split .po-field{min-height:44px}
        .indent-app-container .indent-split .po-field .po-input{font-size:.95rem;min-height:42px}
        .indent-app-container .indent-split .po-field-label{font-size:.92rem}
        .indent-app-container .indent-split .po-field:focus-within .po-field-label,
        .indent-app-container .indent-split .po-field.is-floated .po-field-label{font-size:.7rem}
        .indent-app-container .indent-split .po-field-icon{font-size:.95rem}
        .indent-app-container .indent-split .btn-submit-indent{font-size:14px;padding:12px 44px;min-width:220px}
        .indent-app-container .indent-split .btn-export{font-size:13.5px;min-height:42px}
        .indent-app-container .indent-split .table{font-size:13px}
        .indent-app-container .indent-split .form-check-label{font-size:14px}

        /* ---- Track popup (style only) ---- */
        .trk-overlay{position:fixed;inset:0;z-index:1996;display:flex;align-items:center;justify-content:center;background:rgba(11,58,69,.55);backdrop-filter:blur(3px);animation:pgfade .2s ease-out}
        .trk-modal{width:94vw;max-width:1400px;max-height:90vh;overflow:auto;background:#fff;border-radius:12px;border-top:4px solid #e4572e!important;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:18px 24px 24px!important;animation:pgpop .3s cubic-bezier(.22,1,.36,1)}
        .trk-modal>div:first-child{padding-bottom:12px;margin-bottom:16px!important;border-bottom:1px solid #e3e7ec}
        .trk-modal>div:first-child>b{font-size:17px;font-weight:700;color:#0b3a45;background:#e3f1f4;border:1px solid #b9d6dd;border-radius:6px;padding:3px 12px}
        .trk-modal>div:first-child>span{font-size:14px;font-weight:600}
        .trk-modal .btn-action-delete{padding:6px 18px!important;font-size:12px!important}
        .trk-flow-title{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px}
        .trk-flow-h{font-size:13px;text-transform:uppercase;letter-spacing:.6px;padding-left:8px;border-left:3px solid #e4572e;margin-right:6px}
        .trk-chip{padding:3px 12px;border-radius:999px;background:#f4f6f8;border:1px solid #e3e7ec;font-size:12px}
        .trk-chip.trk-now{background:#fde3d8;border-color:#f5b9a1}
        .trk-cards{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 10px}
        .trk-card{cursor:pointer;flex:1 1 0;min-width:170px;background:var(--c-bg,#f4f6f8);border:1px solid var(--c-bd,#b8c0cb);border-top:4px solid var(--c-bd,#b8c0cb);border-radius:8px;padding:10px 12px;transition:transform .15s ease,box-shadow .15s ease}
        .trk-card:hover{transform:translateY(-3px);box-shadow:0 6px 16px rgba(16,24,40,.15)}
        .trk-card>b{display:block;font-size:13px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px dashed rgba(0,0,0,.18)}
        .trk-ln{font-size:12px;line-height:1.55;color:#000}
        @media(max-width:768px){.trk-cards{flex-direction:column}.trk-card{min-width:0}}

        /* collapse Lamination (col 10) to Customer Copy (col 26) */
        .saved-indents-table.collapse-extra thead th:nth-child(n+9):nth-child(-n+25),
        .saved-indents-table.collapse-extra tbody td:nth-child(n+9):nth-child(-n+25) {
          display: none;
        }

        /* respect users who disable motion */
        @media (prefers-reduced-motion: reduce) {
          .indent-app-container,
          .indent-app-container * {
            animation: none !important;
          }
        }
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

        {/* HEADER SECTION */}

        {/* ===== ENTRY FORM (glass panel) ===== */}
        <div className="mode-toggle-bar">
          <button
            type="button"
            className={`mode-pill-btn ${showForm ? "active" : ""}`}
            onClick={() => { setShowForm((prev) => !prev); setShowTrack(false); }}
          >
            <i className="bi bi-plus-circle"></i> Create New Indent
          </button>
          <button
            type="button"
            className={`mode-pill-btn ${showTrack ? "active" : ""}`}
            onClick={() => { setShowTrack((prev) => !prev); setShowForm(false); }}
          >
            <i className="bi bi-truck"></i> Track
          </button>
        </div>

        <div className="gl-stage" ref={stageRef}>
          {showForm && (
          <div className="gl-card indent-split po-split">
            {/* Left info panel */}
            <div className="po-side">
              <div className="po-side-brand">Indent</div>

              <div className="po-side-hero">
                <h2>Let's Raise</h2>
                <h1>{editingId ? "Update" : "Indent"}</h1>
                <p>
                  Enter the product code to auto-fill the product details, then
                  add the order, billing and file details.
                </p>
              </div>

              <div className="po-side-foot">
                {editingId ? "Updating Indent" : "New Indent"}
              </div>
            </div>

            {/* Right form panel */}
            <div className="po-main">
            <div className="po-heading">
              <span>Indent Details</span>
              <span className="gl-pill">{editingId ? "Editing indent" : "New indent"}</span>
            </div>

            <form onSubmit={handleSafeSubmit} onWheel={(e) => { if (e.target.type === "number") e.target.blur(); }}>

              {/* SECTION 1: PRODUCT INFO */}
              <div className="gl-inner first">
                <div className="gl-group">
                  <i className="bi bi-box-seam"></i>
                  <span>Product Details</span>
                </div>

                <div className="row g-2">
                  <div className="col-12 d-flex justify-content-center">
                  <div
                    className="d-flex gap-4 align-items-center"
                    style={{
                      border: "1px solid #070809",
                      borderRadius: "8px",
                      background: "#dde6f0b5",
                      padding: "6px 16px"
                    }}
                  >
                    <div className="form-check form-check-inline m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="productSearchMode"
                        id="psm-code"
                        checked={searchMode === "code"}
                        onChange={() => switchMode("code")}
                      />
                      <label className="form-check-label fw-bold" htmlFor="psm-code">
                        Product Code
                      </label>
                    </div>
                    <div className="form-check form-check-inline m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="productSearchMode"
                        id="psm-customer"
                        checked={searchMode === "customer"}
                        onChange={() => switchMode("customer")}
                      />
                      <label className="form-check-label fw-bold" htmlFor="psm-customer">
                        Customer / Description
                      </label>
                    </div>
                    <div className="form-check form-check-inline m-0">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="productSearchMode"
                        id="psm-sample"
                        checked={searchMode === "sample"}
                        onChange={() => switchMode("sample")}
                      />
                      <label className="form-check-label fw-bold" htmlFor="psm-sample">
                        Sample Request
                      </label>
                    </div>
                  </div>

                  </div>

                  {searchMode === "sample" && (
                    <div className="col-12 d-flex justify-content-end">
                      <button
                        type="button"
                        className="btn btn-export"
                        onClick={() => { setNewItem({ ...BLANK_ITEM, customerName: form.customerName || "" }); setShowAddCust(true); }}
                      >
                        Add Customer +
                      </button>
                    </div>
                  )}

                  {searchMode === "customer" && (
                    <>
                      <PoField className="col-12 col-md-4" icon="bi-person" label="Select Customer" alwaysFloat>
                        <input
                          className="po-input"
                          list="indent-customer-list"
                          value={custSearch}
                          placeholder="Type to search customer"
                          onChange={(e) => {
                            setCustSearch(e.target.value);
                            setDescSearch("");
                          }}
                        />
                        <datalist id="indent-customer-list">
                          {customerNames.map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </PoField>

                      <PoField className="col-12 col-md-8" icon="bi-card-text" label="Search Description" alwaysFloat>
                        <input
                          className="po-input"
                          list="indent-desc-list"
                          value={descSearch}
                          disabled={!customerItems.length}
                          placeholder={customerItems.length ? "Type to search description or code, then pick from the list" : "Select a customer first"}
                          onChange={(e) => onDescPick(e.target.value)}
                        />
                        <datalist id="indent-desc-list">
                          {customerItems.map((it, i) => (
                            <option key={`${itemCodeOf(it)}-${i}`} value={descLabelOf(it)} />
                          ))}
                        </datalist>
                      </PoField>
                    </>
                  )}
                  <PoField className="col-6 col-md-4"
                    icon="bi-upc-scan"
                    label="Product Code"
                    alwaysFloat
                    
                    filled={has(form.productCode)}
                    after={
                    <>
    {errors.productCode && <small className="indent-error-text">{errors.productCode}</small>}
                    </>
                  }
                  >
                    <input
                      ref={productCodeRef}
                      readOnly={searchMode !== "code"}
                      type="text"
                      name="productCode"
                      className="po-input"
                      value={searchMode === "sample" ? sampleMatchCode : form.productCode}
 title={form.productCode}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && quantityRef.current.focus()}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-tag" label="Product Type" filled={has(form.materialType)} alwaysFloat={searchMode === "sample"} caret={searchMode === "sample"}>
                    {searchMode === "sample" ? (
                      <select
                        name="materialType"
                        className="po-input"
                        value={form.materialType}
                        title={form.materialType}
                        onChange={handleChange}
                      >
                        <option value="">Select Product Type</option>
                        {form.materialType && !sampleTypeOptions.includes(form.materialType) && (
                          <option value={form.materialType}>{form.materialType}</option>
                        )}
                        {sampleTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <input className="po-input" value={form.materialType} title={form.materialType} readOnly />
                    )}
                  </PoField>

                  <PoField className="col-12 col-md-4" icon="bi-person" label="Customer" filled={has(form.customerName)} alwaysFloat={custIsSelect} caret={custIsSelect}>
                    {custIsSelect ? (
                      <select
                        name="customerName"
                        className="po-input"
                        value={form.customerName}
                        title={form.customerName}
                        onChange={handleChange}
                      >
                        <option value="">Select Customer</option>
                        {form.customerName && !sampleCustomerNames.includes(form.customerName) && (
                          <option value={form.customerName}>{form.customerName}</option>
                        )}
                        {sampleCustomerNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : searchMode === "sample" ? (
                      <input
                        name="customerName"
                        className="po-input"
                        value={form.customerName}
                        title={form.customerName}
                        placeholder="New customer name"
                        onChange={handleChange}
                      />
                    ) : (
                      <input className="po-input" value={form.customerName} title={form.customerName} readOnly />
                    )}
                  </PoField>

                  <PoField className="col-12" icon="bi-card-text" label="Description" filled={has(form.description)} alwaysFloat={custIsSelect} caret={custIsSelect}>
                    {custIsSelect ? (
                      <select
                        name="description"
                        className="po-input"
                        value={sampleMatchCode && form.description ? sampleMatchCode : ""}
                        title={form.description}
                        onChange={(e) => pickSampleDesc(e.target.value)}
                      >
                        <option value="">Select Description</option>
                        {sampleDescOptions.map((it) => (
                          <option key={itemCodeOf(it)} value={itemCodeOf(it)}>{norm(it.description)}</option>
                        ))}
                      </select>
                    ) : (
                      <input name="description" className="po-input" value={form.description} title={form.description} readOnly={searchMode !== "sample"} onChange={handleChange} />
                    )}
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-palette" label="Color Front" filled={has(form.colorFront)}>
                    <input name="colorFront" className="po-input" value={form.colorFront} title={form.colorFront} readOnly={searchMode !== "sample"} onChange={handleChange} />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-palette2" label="Color Back" filled={has(form.colorBack)}>
                    <input name="colorBack" className="po-input" value={form.colorBack} title={form.colorBack} readOnly={searchMode !== "sample"} onChange={handleChange} />
                  </PoField>
                  <PoField className="col-12 col-md-4" icon="bi-aspect-ratio" label="Job Size" hide filled={has(form.jobSize)}>
                    <input name="jobSize" className="po-input" value={form.jobSize} title={form.jobSize} readOnly={searchMode !== "sample"} onChange={handleChange} />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-recycle" label="Waste Qty" hide filled={has(form.wasteQty)}>
                    <input type="number" name="wasteQty" className="po-input" value={form.wasteQty} title={form.wasteQty} readOnly={searchMode !== "sample"} onChange={handleChange} />
                  </PoField>
                  <PoField className="col-12 col-md-8" icon="bi-droplet" label="Ink Details" hide filled={has(form.inkDetails)}>
                    <input name="inkDetails" className="po-input" value={form.inkDetails} title={form.inkDetails} readOnly={searchMode !== "sample"} onChange={handleChange} />
                  </PoField>
                </div>
              </div>

              {/* SECTION 2: ORDER INFO */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-list-check"></i>
                  <span>Order Specifications</span>
                </div>

                <div className="row g-2">
                  <PoField className="col-6 col-md-3"
                    icon="bi-123"
                    label={searchMode === "sample" ? "Sample Quantity" : "Order Quantity"}
                    required
                    filled={has(form.quantity)}
                    after={
                    <>
    {errors.quantity && <small className="indent-error-text">{errors.quantity}</small>}
                    </>
                  }
                  >
                    <input
                      ref={quantityRef}
                      type="number"
                      name="quantity"
                      className="po-input"
                      value={form.quantity}
 title={form.quantity}
                      onChange={handleChange}
                      onKeyDown={(e) => e.key === "Enter" && locationRef.current.focus()}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-3"
                    icon="bi-geo-alt"
                    label="Location"
                    required
                    alwaysFloat
                    caret
                    after={
                    <>
    {errors.location && <small className="indent-error-text">{errors.location}</small>}
                    </>
                  }
                  >
                    <select
                      ref={locationRef}
                      name="location"
                      className="po-input"
                      value={form.location}
 title={locations.find(l => l._id === form.location)?.locationName || ""}
                      onChange={handleChange}
                      >
                      <option value="">Select Location</option>
                      {locations.map(loc => (
                      <option key={loc._id} value={loc._id}>{loc.locationName}</option>
                      ))}
                      </select>
                  </PoField>

                  {searchMode !== "sample" && (
<PoField className="col-6 col-md-3" icon="bi-currency-rupee" label="Unit Rate" hide filled={has(form.unitRate)}>
                    <input
                      type="number"
                      name="unitRate"
                      className="po-input"
                      value={form.unitRate}
 title={form.unitRate}
                      onChange={handleChange}
                      />
                  </PoField>
)}

                  <PoField
  className="col-6 col-md-3"
  icon="bi-calendar-event"
  label={searchMode === "sample" ? "Required Date" : "Delivery Date"}
  required
  alwaysFloat
  after={
    <>
      {errors.deliveryDate && <small className="indent-error-text">{errors.deliveryDate}</small>}
    </>
  }
>
                    <input
                      type="date"
                      name="deliveryDate"
                      className="po-input"
                      value={form.deliveryDate}
 title={form.deliveryDate}
                      onChange={handleChange}
                      />
                  </PoField>
                </div>
              </div>

              {/* PAPER DETAILS */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-file-earmark-richtext"></i>
                  <span>Paper Details</span>
                </div>

                <div className="row g-2">
                  {/* <PoField className="col-6 col-md-3" icon="bi-building" label="Mill Name" alwaysFloat caret>
                    <select name="millName" className="po-input" value={form.millName}
                            title={form.millName} onChange={handlePaperChange}>
                      <option value="">Select Mill</option>
                      {paperOptions.millName.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField> */}

                  <PoField className="col-6 col-md-3" icon="bi-collection" label="Group" alwaysFloat caret>
                    <select name="paperGroup" className="po-input" value={form.paperGroup}
                            title={form.paperGroup} onChange={handlePaperChange}>
                      <option value="">Select Group</option>
                      {paperOptions.paperGroup.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField>

                  <PoField className="col-6 col-md-3" icon="bi-aspect-ratio" label="Size" hide alwaysFloat caret>
                    <select name="paperSize" className="po-input" value={form.paperSize}
                            title={form.paperSize} onChange={handlePaperChange}>
                      <option value="">Select Size</option>
                      {paperOptions.paperSize.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField>

                  <PoField className="col-6 col-md-3" icon="bi-speedometer2" label="GSM" alwaysFloat caret>
                    <select name="gsm" className="po-input" value={form.gsm}
                            title={form.gsm} onChange={handlePaperChange}>
                      <option value="">Select GSM</option>
                      {paperOptions.gsm.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </PoField>
                </div>
              </div>

              {/* SAMPLE DETAILS (Sample Request only) */}
              {searchMode === "sample" && (
                <div className="gl-inner">
                  <div className="gl-group">
                    <i className="bi bi-clipboard-check"></i>
                    <span>Sample Details</span>
                  </div>

                  <div className="row g-2">
                    <PoField
                      className="col-12 col-md-4"
                      icon="bi-person-plus"
                      label="Request Type"
                      required
                      alwaysFloat
                      caret
                      after={errors.sampleRequestType && <small className="indent-error-text">{errors.sampleRequestType}</small>}
                    >
                      <select
                        name="sampleRequestType"
                        className="po-input"
                        value={form.sampleRequestType || ""}
                        onChange={handleRequestTypeChange}
                      >
                        <option value="">Select Request Type</option>
                        <option value="new">New customer</option>
                        <option value="design">Existing customer, design change</option>
                        <option value="product">Existing customer, new product</option>
                      </select>
                    </PoField>

                    {form.sampleRequestType === "new" && (
                      <PoField className="col-12 col-md-4" icon="bi-hash" label="Provisional Customer ID" alwaysFloat>
                        <input className="po-input" value={form.provisionalCustomerId || "Generated on save"} readOnly />
                      </PoField>
                    )}

                    <PoField className="col-12 col-md-4" icon="bi-person" label="Raised By" alwaysFloat hide>
                      <input className="po-input" value={loggedInUser} readOnly />
                    </PoField>

                    <PoField className="col-12 col-md-4" icon="bi-diagram-2" label="Product Family" alwaysFloat caret>
                      <select
                        name="productFamily"
                        className="po-input"
                        value={form.productFamily || ""}
                        onChange={handleChange}
                      >
                        <option value="">Select Product Family</option>
                        <option value="Secure cards (EMV/ metal)">Secure cards (EMV/ metal)</option>
                        <option value="VDP (cheque/statement)">VDP (cheque/statement)</option>
                      </select>
                    </PoField>

                    <PoField className="col-12 col-md-4" icon="bi-box-seam" label="Physical Reference Provided" alwaysFloat caret>
                      <select
                        name="physicalReference"
                        className="po-input"
                        value={form.physicalReference || ""}
                        onChange={handleChange}
                      >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </PoField>

                    <PoField className="col-12 col-md-4" icon="bi-currency-rupee" label="Expected Order Value (₹)" hide filled={has(form.expectedOrderValue)}>
                      <input
                        type="text"
                        inputMode="decimal"
                        name="expectedOrderValue"
                        className="po-input"
                        value={form.expectedOrderValue || ""}
                        title={form.expectedOrderValue}
                        onChange={(e) =>
                          handleChange({
                            target: {
                              name: "expectedOrderValue",
                              value: e.target.value.replace(/[^0-9.]/g, "")
                            }
                          })
                        }
                      />
                    </PoField>
                  </div>
                </div>
              )}

              {/* SECTION 3: SALES ORDER / BILLING DETAILS (NEW) */}
              <div className="gl-inner" style={searchMode === "sample" ? { marginTop: 8 } : undefined}>
                <div className="gl-group" style={searchMode === "sample" ? { display: "none" } : undefined}>
                  <i className="bi bi-receipt-cutoff"></i>
                  <span>Sales Order / Billing Details</span>
                </div>

                <div className="row g-2">
                  <PoField className="col-6 col-md-4" icon="bi-layers" label="Lamination" filled={has(form.lamination)}>
                    <input
                      type="text"
                      name="lamination"
                      className="po-input"
                      value={form.lamination}
 title={form.lamination}
                      onChange={handleChange}
                      />
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-stars" label="Finish" filled={has(form.finish)}>
                    <input
                      type="text"
                      name="finish"
                      className="po-input"
                      value={form.finish}
 title={form.finish}
                      onChange={handleChange}
                      />
                  </PoField>
                  {searchMode !== "sample" && (
<PoField className="col-6 col-md-4" icon="bi-hash" label="Job No" filled={has(form.jobNo)}>
                    <input
                      type="text"
                      name="jobNo"
                      className="po-input"
                      value={form.jobNo}
 title={form.jobNo}
                      onChange={handleChange}
                      />
                  </PoField>
)}

                  {searchMode !== "sample" && (
<PoField className="col-6 col-md-4" icon="bi-file-earmark-text" label="SO No" filled={has(form.soNo)}>
                    <input
                      type="text"
                      name="soNo"
                      className="po-input"
                      value={form.soNo}
 title={form.soNo}
                      onChange={handleChange}
                      />
                  </PoField>
)}

                  {searchMode !== "sample" && (
<PoField className="col-6 col-md-4" icon="bi-calendar-date" label="SO Date" alwaysFloat>
                    <input
                      type="date"
                      name="soDate"
                      className="po-input"
                      value={form.soDate}
 title={form.soDate}
                      onChange={handleChange}
                      />
                  </PoField>
)}

                  <PoField className="col-6 col-md-4" icon="bi-tag" label="Sample Type" required={searchMode === "sample"} alwaysFloat caret after={errors.sampleType && <small className="indent-error-text">{errors.sampleType}</small>}>
                    <select
                      name="sampleType"
                      className="po-input"
                      value={form.sampleType}
 title={form.sampleType}
                      onChange={handleChange}
                      >
                      <option value="">Select Type</option>
                      <option value="Offset">Offset</option>
                      <option value="Digital">Digital</option>
                      </select>
                  </PoField>

                  <PoField className="col-6 col-md-4" icon="bi-check2-circle" label="Costing Confirmation" filled={has(form.costingConfirmation)}>
                    <input
                      type="text"
                      name="costingConfirmation"
                      className="po-input"
                      value={form.costingConfirmation}
 title={form.costingConfirmation}
                      onChange={handleChange}
                      />
                  </PoField>

                  {searchMode !== "sample" && (
<PoField className="col-6 col-md-4" icon="bi-receipt" label="Type of Billing" alwaysFloat caret>
                    <select
                      name="typeOfBilling"
                      className="po-input"
                      value={form.typeOfBilling}
 title={form.typeOfBilling === "Billing" ? "Readiness Billing" : form.typeOfBilling}
                      onChange={handleChange}
                      >
                      <option value="">Select Billing</option>
                      <option value="Billing">Readiness Billing</option>
                      <option value="Kit Billing">Kit Billing</option>
                      </select>
                  </PoField>
)}

                  {searchMode !== "sample" && (
<PoField className="col-6 col-md-4" icon="bi-receipt" label="Customer PO No" filled={has(form.customerPoNo)}>
                    <input
                      type="text"
                      name="customerPoNo"
                      className="po-input"
                      value={form.customerPoNo}
 title={form.customerPoNo}
                      onChange={handleChange}
                      />
                  </PoField>
)}

                  {searchMode !== "sample" && (
<PoField className="col-6 col-md-4" icon="bi-calendar-check" label="Customer PO Date" alwaysFloat>
                    <input
                      type="date"
                      name="customerPoDate"
                      className="po-input"
                      value={form.customerPoDate}
 title={form.customerPoDate}
                      onChange={handleChange}
                      />
                  </PoField>
)}
                </div>
              </div>

              {/* ARTWORK MANAGEMENT */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-palette"></i>
                  <span>Artwork Management</span>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="fw-semibold">Latest status:</span>
                  <span className={awBadge(latestArtwork ? latestArtwork.status : "Pending")}>
                    {latestArtwork ? "v" + latestArtwork.version + " " + latestArtwork.status : "No artwork"}
                  </span>
                  <small>
                    {searchMode === "sample"
                      ? "Sample can go ahead with pending artwork."
                      : "Production indent needs an artwork version. The PO reviewer approves or rejects it."}
                  </small>
                </div>

                <div className="row g-2 mb-2">
                  <PoField className="col-12 col-md-4" icon="bi-paperclip" label="Artwork File" alwaysFloat>
                    {artCode && masterArt.length > 0 && (
                      <input
                        type="text"
                        className="po-input"
                        readOnly
                        value={`V${masterArt[masterArt.length - 1].version} - ${masterArt[masterArt.length - 1].fileName}`}
                        title={masterArt[masterArt.length - 1].fileName}
                      />
                    )}
                    <input
                      ref={awFileInputRef}
                      style={artCode && masterArt.length > 0 ? { display: "none" } : undefined}
                      type="file"
                      className="po-input"
                      accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.cdr,.zip"
                      onChange={(e) => setAwFile(e.target.files?.[0] || null)}
                    />
                  </PoField>

                  <PoField className="col-12 col-md-5" icon="bi-pencil" label="Version Note" filled={has(awNote)}>
                    <input
                      type="text"
                      className="po-input"
                      value={awNote}
                      title={awNote}
                      onChange={(e) => setAwNote(e.target.value)}
                    />
                  </PoField>

                  <div className="col-12 col-md-3">
                    <button type="button" className="btn btn-export w-100" onClick={addArtworkVersion}>
                      Upload Version
                    </button>
                  </div>


                </div>

                {errors.artwork && <small className="indent-error-text mb-2">{errors.artwork}</small>}

                {artCode && (
                  <div className="mb-2 p-2" style={{ border: "1px dashed #b8c0cb", borderRadius: 8, fontSize: 12 }}>
                    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                      <b>Item artwork (saved against {form.productCode})</b>
                      <span className={awBadge("Approved")}>
                        {masterArt.length ? "Latest V" + masterArt[masterArt.length - 1].version : "No artwork yet"}
                      </span>
                      <span>{masterArt.length} version{masterArt.length === 1 ? "" : "s"}</span>
                      <input
                        ref={masterArtInputRef}
                        type="file"
                        style={{ display: "none" }}
                        accept=".pdf,.ai,.psd,.png,.jpg,.jpeg,.cdr,.zip"
                        onChange={(e) => openArtConfirm(e.target.files?.[0], "master")}
                      />
                      <button
                        type="button"
                        className="btn btn-export btn-sm"
                        onClick={() => masterArtInputRef.current?.click()}
                      >
                        {masterArt.length ? "Change (upload V" + nextMasterVer + ")" : "Upload V1"}
                      </button>
                    </div>
                    {masterArt.length > 0 && (
                      <table className="table table-bordered table-sm align-middle mb-0">
                        <thead className="table-light">
                          <tr><th>Ver</th><th>File</th><th>Uploaded</th><th>Note</th></tr>
                        </thead>
                        <tbody>
                          {[...masterArt].reverse().map((v) => (
                            <tr key={v.version}>
                              <td>V{v.version}</td>
                              <td><a href={BASE_URL + v.filePath} target="_blank" rel="noreferrer">{v.fileName}</a></td>
                              <td>
                                {v.uploadedAt ? new Date(v.uploadedAt).toLocaleString("en-IN") : "-"}
                                <br /><small>{v.uploadedBy}</small>
                              </td>
                              <td>{v.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                <div className="table-responsive" style={{ fontSize: "12px" }}>
                  <table className="table table-bordered table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Ver</th>
                        <th>File</th>
                        <th>Uploaded</th>
                        <th>Note</th>
                        <th>Status</th>
                        <th>PO reviewer comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artworkVersions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center">
                            No artwork uploaded yet. Add a file to start version 1.
                          </td>
                        </tr>
                      ) : (
                        artworkVersions.map((v) => (
                          <tr key={v.version}>
                            <td>v{v.version}</td>
                            <td>
                              {v.filePath ? (
                                <a href={BASE_URL + v.filePath} target="_blank" rel="noreferrer">{v.fileName}</a>
                              ) : (
                                v.fileName
                              )}
                            </td>
                            <td>
                              {v.uploadedAt ? new Date(v.uploadedAt).toLocaleString("en-IN") : "-"}
                              <br />
                              <small>{v.uploadedBy}</small>
                            </td>
                            <td>{v.note || "-"}</td>
                            <td><span className={awBadge(v.status)}>{v.status}</span></td>
                            <td>
                              {v.comment || "-"}
                              {v.reviewedBy && (
                                <>
                                  <br />
                                  <small>{v.reviewedBy}</small>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SPECIFICATION */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-card-checklist"></i>
                  <span>Specification</span>
                </div>
                <div className="row g-2">
                  <PoField className="col-12" icon="bi-card-checklist" label="Specification" filled={has(form.specification)} area>
                    <textarea
                      name="specification"
                      className="po-input"
                      value={form.specification}
                      title={form.specification}
                      onChange={handleChange}
                    />
                  </PoField>
                </div>
              </div>

              {/* SECTION 4: ADDITIONAL INFO */}
              <div className="gl-inner">
                <div className="gl-group">
                  <i className="bi bi-info-circle"></i>
                  <span>Additional Information</span>
                </div>

                <div className="row g-2">
                  {searchMode !== "sample" && (
<PoField className="col-md-6"
                    icon="bi-paperclip"
                    label="PO Copy (Upload)"
                    alwaysFloat
                    after={
                    <>
    {customerCopyFile && (
    <small className="text-muted d-block mt-1">Selected: {customerCopyFile.name}</small>
    )}
    {!customerCopyFile && existingCustomerCopy?.filePath && (
    <small className="d-block mt-1">
    Current: <a href={`${BASE_URL}${existingCustomerCopy.filePath}`} target="_blank" rel="noreferrer">{existingCustomerCopy.fileName}</a>
    </small>
    )}
                    </>
                  }
                  >
                    <input
                      type="file"
                      name="customerCopy"
                      className="po-input"
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      />
                  </PoField>
)}

                  <PoField className="col-12" icon="bi-chat-left-text" label="Remarks" filled={has(form.remark)} area>
                    <textarea
                      name="remark"
                      className="po-input"
                      value={form.remark}
 title={form.remark}
                      onChange={handleChange}
                      />
                  </PoField>
                </div>
              </div>

              <div className="text-center mt-3">
                <button type="submit" className="btn btn-submit-indent" disabled={isSaving}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Save Indent
                </button>
              </div>
            </form>
            </div>
          </div>
          )}
        </div>

        {/* ===== ADD CUSTOMER POPUP ===== */}
        {showAddCust && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowAddCust(false)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 8, width: "92vw", maxWidth: 900, maxHeight: "90vh", overflow: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
              <div className="d-flex align-items-center px-3 py-2" style={{ borderBottom: "1px solid #e3e7ec" }}>
                <b style={{ fontSize: 15 }}>Add Customer</b>
                <button type="button" className="btn-action-delete ms-auto" onClick={() => setShowAddCust(false)}>Close</button>
              </div>
              <div className="p-3">
                <div className="row g-2">
                  <PoField className="col-6 col-md-4" icon="bi-upc-scan" label="Product Code" alwaysFloat>
                    <input className="po-input" value={nextProductCode} readOnly />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-hash" label="Unique Code" hide>
                    <input className="po-input" value={newItem.uniqueCode} onChange={(e) => setNewItem((p) => ({ ...p, uniqueCode: e.target.value }))} />
                  </PoField>
                  <PoField className="col-12 col-md-4" icon="bi-person" label="Customer Name" required filled={has(newItem.customerName)}>
                    <input className="po-input" value={newItem.customerName} onChange={(e) => setNewItem((p) => ({ ...p, customerName: e.target.value }))} />
                  </PoField>
                  <PoField className="col-12" icon="bi-card-text" label="Description" filled={has(newItem.description)}>
                    <input className="po-input" value={newItem.description} onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} />
                  </PoField>
                  <PoField className="col-12 col-md-4" icon="bi-tag" label="Product Type" filled={has(newItem.materialType)}>
                    <input className="po-input" list="indent-newitem-types" value={newItem.materialType} onChange={(e) => setNewItem((p) => ({ ...p, materialType: e.target.value }))} />
                    <datalist id="indent-newitem-types">
                      {materialTypeOptions.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-palette" label="Color Front" filled={has(newItem.colorFront)}>
                    <input className="po-input" value={newItem.colorFront} onChange={(e) => setNewItem((p) => ({ ...p, colorFront: e.target.value }))} />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-palette2" label="Color Back" filled={has(newItem.colorBack)}>
                    <input className="po-input" value={newItem.colorBack} onChange={(e) => setNewItem((p) => ({ ...p, colorBack: e.target.value }))} />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-aspect-ratio" label="Job Size" hide filled={has(newItem.jobSize)}>
                    <input className="po-input" value={newItem.jobSize} onChange={(e) => setNewItem((p) => ({ ...p, jobSize: e.target.value }))} />
                  </PoField>
                  <PoField className="col-6 col-md-4" icon="bi-recycle" label="Waste Qty" hide filled={has(newItem.wasteQty)}>
                    <input type="number" className="po-input" value={newItem.wasteQty} onChange={(e) => setNewItem((p) => ({ ...p, wasteQty: e.target.value }))} />
                  </PoField>
                  <PoField className="col-12" icon="bi-droplet" label="Ink Details" hide>
                    <input className="po-input" value={newItem.inkDetails} onChange={(e) => setNewItem((p) => ({ ...p, inkDetails: e.target.value }))} />
                  </PoField>
                </div>
                <div className="text-center mt-3">
                  <button type="button" className="btn btn-submit-indent" onClick={saveNewItem}>Save Customer</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== ARTWORK CONFIRM POPUP (preview before upload) ===== */}
        {artConfirm && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 2200, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={closeArtConfirm}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 8, width: "94vw", maxWidth: 1100, height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}
            >
              <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #e3e7ec" }}>
                <i className="bi bi-file-earmark-pdf" style={{ color: "#e4572e" }}></i>
                <b style={{ fontSize: 14 }}>Review artwork before upload</b>
                <span>{artConfirm.file.name}</span>
                <button type="button" className="btn-action-delete ms-auto" onClick={closeArtConfirm}>Cancel</button>
              </div>

              <div style={{ flex: 1, overflow: "hidden", background: "#f4f6f8" }}>
                {artConfirm.isPdf ? (
                  <iframe title="Artwork preview" src={artConfirm.url} style={{ width: "100%", height: "100%", border: "none" }} />
                ) : artConfirm.isImg ? (
                  <div style={{ width: "100%", height: "100%", overflow: "auto", textAlign: "center", padding: 12 }}>
                    <img src={artConfirm.url} alt="Artwork preview" style={{ maxWidth: "100%" }} />
                  </div>
                ) : (
                  <div className="d-flex align-items-center justify-content-center h-100 text-center p-4">
                    Preview is not available for this file type ({artConfirm.file.name}).
                    <br />
                    You can still confirm and save it.
                  </div>
                )}
              </div>

              <div className="px-3 py-3 d-flex flex-wrap align-items-center gap-3" style={{ borderTop: "1px solid #e3e7ec" }}>
                {artConfirm.kind === "master" && (
                  <input
                    type="text"
                    placeholder="Version note (optional)"
                    value={awNote}
                    onChange={(e) => setAwNote(e.target.value)}
                    style={{ flex: "1 1 260px", minWidth: 220, height: 40, padding: "6px 12px", border: "1px solid #cfd6de", borderRadius: 6, fontSize: 14, color: "#000", background: "#fff" }}
                  />
                )}
                <div className="form-check m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="art-read-check"
                    style={{ width: 22, height: 22, minWidth: 22, float: "none", margin: "0 10px 0 0", cursor: "pointer", appearance: "auto", WebkitAppearance: "checkbox", accentColor: "#e4572e", border: "2px solid #000", opacity: 1, display: "inline-block", verticalAlign: "middle" }}
                    checked={artRead}
                    onChange={(e) => setArtRead(e.target.checked)}
                  />
                  <label className="form-check-label fw-bold" htmlFor="art-read-check">
                    I have read and checked this artwork file.
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-submit-indent ms-auto"
                  style={{ opacity: artRead ? 1 : 0.5, cursor: artRead ? "pointer" : "not-allowed" }}
                  disabled={!artRead}
                  onClick={saveArtConfirm}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== PDF VIEWER WITH SPECIMEN WATERMARK ===== */}
        {pdfPreview && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setPdfPreview(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#fff", borderRadius: 8, width: "94vw", maxWidth: 1100, height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}
            >
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

        {/* ===== ARTWORK CHAT POPUP ===== */}
        {(() => {
          const ind = indents.find((x) => x._id === chatId);
          if (!ind) return null;
          const it = ind.items?.[0] || {};
          const vers = it.artworkVersions || [];
          const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN") : "");
          const msgs = [];
          vers.forEach((v) => {
            msgs.push({ kind: "upload", v });
            if (v.reviewedBy || v.status === "Approved" || v.status === "Rejected") {
              msgs.push({ kind: "review", v });
            } else if (v.status === "Superseded") {
              msgs.push({ kind: "sys", v });
            }
          });
          return (
            <div
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setChatId(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: "#fff", borderRadius: 8, width: "94vw", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}
              >
                <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #e3e7ec" }}>
                  <i className="bi bi-chat-dots" style={{ color: "#e4572e" }}></i>
                  <b style={{ fontSize: 15 }}>Artwork conversation</b>
                  <span>{ind.indentNo}</span>
                  <span className="text-muted">{it.customerName || ""}</span>
                  <button type="button" className="btn-action-delete ms-auto" onClick={() => setChatId(null)}>Close</button>
                </div>

                <div style={{ overflowY: "auto", padding: 16, background: "#f4f6f8", flex: 1 }}>
                  {msgs.length === 0 ? (
                    <div className="text-center py-3">No artwork conversation yet.</div>
                  ) : (
                    msgs.map((m, i) => {
                      const v = m.v;
                      if (m.kind === "sys") {
                        return (
                          <div key={i} className="text-center mb-3">
                            <small style={{ background: "#e3e7ec", borderRadius: 10, padding: "3px 10px" }}>
                              v{v.version} replaced by a newer version
                            </small>
                          </div>
                        );
                      }
                      const isUpload = m.kind === "upload";
                      return (
                        <div key={i} className="d-flex mb-3" style={{ justifyContent: isUpload ? "flex-start" : "flex-end" }}>
                          <div
                            style={{
                              maxWidth: "82%",
                              padding: "8px 12px",
                              borderRadius: 10,
                              background: isUpload ? "#ffffff" : v.status === "Rejected" ? "#fbdcdc" : "#d9f2e6",
                              border: "1px solid " + (isUpload ? "#e3e7ec" : v.status === "Rejected" ? "#f0b4b4" : "#a9dcc3")
                            }}
                          >
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <b>{isUpload ? (v.uploadedBy || "Requester") : (v.reviewedBy || "PO reviewer")}</b>
                              <small>{isUpload ? "uploaded" : "reviewed"} v{v.version}</small>
                            </div>

                            {isUpload ? (
                              <>
                                {v.filePath ? (
                                  <a href={`${BASE_URL}${v.filePath}`} target="_blank" rel="noreferrer">
                                    <i className="bi bi-paperclip"></i> {v.fileName}
                                  </a>
                                ) : (
                                  <span>{v.fileName}</span>
                                )}
                                <div style={{ marginTop: 4 }}>
                                  <small>Note:</small> {v.note || "-"}
                                </div>
                              </>
                            ) : (
                              <>
                                <span className={awBadge(v.status === "Superseded" ? "Approved" : v.status)}>
                                  {v.status === "Superseded" ? "Approved (later replaced)" : v.status}
                                </span>
                                <div style={{ marginTop: 4 }}>
                                  <small>Comment:</small> {v.comment || "-"}
                                </div>
                              </>
                            )}

                            <div style={{ textAlign: "right", marginTop: 4 }}>
                              <small>{fmt(isUpload ? v.uploadedAt : v.reviewedAt || v.uploadedAt)}</small>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ===== ARTWORK UPDATES BELL ===== */}
        {(() => {

          if (showTrack) return null; // hide bell on Track
          const mine = indents.filter((ind) => {
            if (ind.user !== loggedInUser) return false;
            const a = latestArtOf(ind);
            if (!a) return false;
            // rejected: show unless the indent is already processed (APPROVED)
            if (a.status === "Rejected") return ind.status !== "APPROVED";
            // approved: only while it is still waiting for PO processing
            if (a.status === "Approved") return ["PENDING_PO", "SAMPLE_REQUESTED"].includes(ind.status);
            return false;
          });
          return (
            <>
              <button
                type="button"
                className="bell-btn"
                title="Artwork updates on your indents"
                onClick={() => setShowBell((p) => !p)}
              >
                <i className="bi bi-bell-fill"></i>
                {mine.length > 0 && <span className="bell-badge">{mine.length}</span>}
              </button>

              {showBell && (
                <>
                  <div className="bell-backdrop" onClick={() => setShowBell(false)} />
                  <div className="bell-panel">
                    <div className="bar-head">
                      <h5>Artwork updates on your indents</h5>
                      <span className="bar-count">{mine.length}</span>
                    </div>
                    <div className="bar-body">
                      {mine.length === 0 ? (
                        <div className="text-center py-2">No artwork updates.</div>
                      ) : (
                        mine.map((ind) => {
                          const a = latestArtOf(ind);
                          return (
                            <div key={ind._id} className="d-flex flex-wrap align-items-center gap-2 mb-2">
                              <b>{ind.indentNo}</b>
                              <span className={awBadge(a.status)}>v{a.version} {a.status}</span>
                              <span>
                                {a.status === "Approved"
                                  ? "Approved" + (a.reviewedBy ? " by " + a.reviewedBy : "") + ". Waiting for PO processing."
                                  : (a.comment || "-") + (a.reviewedBy ? " (" + a.reviewedBy + ")" : "")}
                                {a.status === "Approved" && a.comment ? " Comment: " + a.comment : ""}
                              </span>
                              {a.status === "Rejected" && ind.user === loggedInUser && (
                                <button
                                  type="button"
                                  className="btn-action-edit ms-auto"
                                  onClick={() => { setShowBell(false); handleEdit(ind); }}
                                >
                                  Edit &amp; upload new version
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* ===== FILTERS (Saved Indents, shown by default) ===== */}
        <div className="bar-card" style={{ display: showTrack ? "none" : "block" }}>
          <div className="bar-head">
            <h5>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              Filter Indents
            </h5>
            <span className="bar-count">
              {filteredIndents.length} / {indents.length} indents
            </span>
          </div>

          <div className="bar-body">
            <div className="row g-2 align-items-end">
              <PoField className="col-6 col-lg-2" icon="bi-search" label="Indent No" filled={has(indentNoFilter)}>
                <input
                  type="text"
                  className="po-input"
                  value={indentNoFilter}
 title={indentNoFilter}
                  onChange={(e) => setIndentNoFilter(e.target.value)}
                  />
              </PoField>

              <PoField className="col-6 col-lg-2" icon="bi-upc-scan" label="Product Code" filled={has(productCodeFilter)}>
                <input
                  type="text"
                  className="po-input"
                  value={productCodeFilter}
 title={productCodeFilter}
                  onChange={(e) => setProductCodeFilter(e.target.value)}
                  />
              </PoField>

              <PoField className="col-12 col-lg-3" icon="bi-person" label="Customer Name" filled={has(customerFilter)}>
                <input
                  type="text"
                  className="po-input"
                  value={customerFilter}
 title={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  />
              </PoField>

              <PoField className="col-6 col-lg-2" icon="bi-person-badge" label="Indenter" alwaysFloat caret>
                <select
                  className="po-input"
                  value={indenterFilter}
                  onChange={(e) => setIndenterFilter(e.target.value)}
                >
                  <option value="">All Indenters</option>
                  {indenterOptions.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </PoField>

              <PoField className="col-6 col-lg-2" icon="bi-geo-alt" label="Location" alwaysFloat caret>
                <select
                  className="po-input"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>{loc.locationName}</option>
                  ))}
                  </select>
              </PoField>
              <PoField className="col-6 col-lg-3" icon="bi-calendar-event" label="From Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  />
              </PoField>

              <PoField className="col-6 col-lg-3" icon="bi-calendar-check" label="To Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  />
              </PoField>
              <div className="col-6 col-lg-3">
                <button
                  type="button"
                  className="btn btn-export w-100"
                  onClick={exportToExcel}
                >
                  Export Excel
                </button>
              </div>

              <div className="col-6 col-lg-3">
                <button className="btn btn-clear-filters w-100 d-flex align-items-center justify-content-center gap-2" onClick={clearFilters}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <polyline points="16 3 16 8 21 8"></polyline>
                    <line x1="21" y1="12" x2="21" y2="21"></line>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <polyline points="8 21 8 16 3 16"></polyline>
                  </svg>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== TABLE CONTAINER (Saved Indents, shown by default) ===== */}
        <div className="bar-card" style={{ display: showTrack ? "none" : "block" }}>
          <div className="bar-head">
            <h5>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              Saved Indents
            </h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn-action-edit"
                onClick={() => setShowExtraCols((p) => !p)}
              >
                <i className={`bi ${showExtraCols ? "bi-chevron-double-left" : "bi-chevron-double-right"}`}></i>{" "}
                {showExtraCols ? "Collapse columns" : "Expand columns"}
              </button>
              <span className="bar-count">
                Showing {Math.min(filteredIndents.length, 50)} of {filteredIndents.length} entries
              </span>
            </div>
          </div>

          <div className="custom-table-container">
            <table className={`table border-black table-bordered table-hover align-middle text-center bg-white saved-indents-table ${showExtraCols ? "" : "collapse-extra"}`}>
              <thead className="table-dark sticky-top">
                <tr>
                  <th>Indent No</th>
                  <th>Product Code</th>
                  <th>Description</th>
                  <th>Customer</th>
                  <th>Delivery date</th>
                  <th>Product Type</th>
                  <th>Qty</th>

                  <th> Requested Location</th>
                  <th>Lamination</th>
                  <th>Finish</th>
                  <th>Group</th>
                  <th>Size</th>
                  <th>GSM</th>
                  <th>Job No</th>
                  <th>SO No</th>
                  <th>SO Date</th>
                  <th>Sample Type</th>
                  <th>Product Family</th>
                  <th>Physical Reference</th>
                  <th>Expected Order Value (₹)</th>
                  <th>Costing Confirmation</th>
                  <th>Customer PO No</th>
                  <th>Customer PO Date</th>
                  <th>Type of Billing</th>
                  <th>Customer Copy</th>
                  <th>Artwork</th>
                
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Specification</th>
                  <th>Requested By</th>
                  <th>Requested At</th>
                  <th>User Location</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndents.length === 0 ? (
                  <tr>
                    <td colSpan={34} className="text-center text-muted py-4">
                      <div className="d-flex flex-column align-items-center gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>No indents found matching the filters</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Limit the displayed rows in view to the top 50 records as requested
                  filteredIndents.slice(0, 50).map((ind) => (
                    <tr key={ind._id}>
                      <td className="fw-bold text-primary">{ind.indentNo}</td>
                      <td className="fw-semibold">{ind.items[0]?.productCode}</td>
                      <td
                        style={{
                          maxWidth: "280px",
                          cursor: "pointer",
                          whiteSpace:
                            expandedCell === `desc-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(
                            expandedCell === `desc-${ind._id}`
                              ? null
                              : `desc-${ind._id}`
                          )
                        }
                      >
                        {expandedCell === `desc-${ind._id}`
                          ? ind.items[0]?.description || "-"
                          : truncateText(ind.items[0]?.description)}
                      </td>
                      <td
                        style={{
                          maxWidth: "140px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `cust-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `cust-${ind._id}` ? null : `cust-${ind._id}`)
                        }
                      >
                        {expandedCell === `cust-${ind._id}`
                          ? ind.items[0]?.customerName || "-"
                          : truncateText(ind.items[0]?.customerName)}
                      </td>
                      <td>
                        {ind.items[0]?.deliveryDate
                          ? new Date(ind.items[0].deliveryDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td>{ind.items[0]?.materialType || "-"}</td>
                      <td className="fw-semibold">{ind.items[0]?.quantity}</td>

                      <td>
                        <span className="text-muted fw-semibold">{ind.location?.locationName || "-"}</span>
                      </td>
                      <td>{ind.items[0]?.lamination || "-"}</td>
                      <td
                        style={{
                          maxWidth: "140px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `fin-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `fin-${ind._id}` ? null : `fin-${ind._id}`)
                        }
                      >
                        {expandedCell === `fin-${ind._id}`
                          ? ind.items[0]?.finish || "-"
                          : truncateText(ind.items[0]?.finish, 20)}
                      </td>
                      <td>{ind.items[0]?.paperGroup || "-"}</td>
                      <td>{ind.items[0]?.paperSize || "-"}</td>
                      <td>{ind.items[0]?.gsm || "-"}</td>
                      <td>{ind.items[0]?.jobNo || "-"}</td>
                      <td>{ind.items[0]?.soNo || "-"}</td>
                      <td>
                        {ind.items[0]?.soDate
                          ? new Date(ind.items[0].soDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td>{ind.items[0]?.sampleType || "-"}</td>
                      <td>{ind.items[0]?.productFamily || "-"}</td>
                      <td>{ind.items[0]?.physicalReference || "-"}</td>
                      <td>
                        {ind.items[0]?.expectedOrderValue
                          ? Number(ind.items[0].expectedOrderValue).toLocaleString("en-IN")
                          : "-"}
                      </td>
                      <td
                        style={{
                          maxWidth: "160px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `cost-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `cost-${ind._id}` ? null : `cost-${ind._id}`)
                        }
                      >
                        {expandedCell === `cost-${ind._id}`
                          ? ind.items[0]?.costingConfirmation || "-"
                          : truncateText(ind.items[0]?.costingConfirmation)}
                      </td>
                      <td>{ind.items[0]?.customerPoNo || "-"}</td>
                      <td>
                        {ind.items[0]?.customerPoDate
                          ? new Date(ind.items[0].customerPoDate).toLocaleDateString("en-IN")
                          : "-"}
                      </td>
                      <td>{ind.items[0]?.typeOfBilling || "-"}</td>
                      <td>
                        {ind.items[0]?.customerCopy?.filePath ? (
                          <a href={`${BASE_URL}${ind.items[0].customerCopy.filePath}`} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : "-"}
                      </td>
                      <td style={{ minWidth: 170, textAlign: "left" }}>
                        {(ind.items[0]?.artworkVersions || []).length ? (
                          (() => {
                            const a = latestArtOf(ind);
                            const n = ind.items[0].artworkVersions.length;
                            return (
                              <div className="d-flex flex-column gap-1 align-items-start">
                                {a && <span className={awBadge(a.status)}>v{a.version} {a.status}</span>}
                                <button type="button" className="btn-action-edit" onClick={() => setChatId(ind._id)}>
                                  <i className="bi bi-chat-dots"></i> Chat ({n})
                                </button>
                              </div>
                            );
                          })()
                        ) : ind.items[0]?.artwork?.filePath ? (
                          <a href={`${BASE_URL}${ind.items[0].artwork.filePath}`} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : "-"}
                      </td>
                    
                      <td>
                        <span className={`custom-badge ${
                          ind.status === "PENDING_PO" ? "badge-pending" :
                          ind.status === "APPROVED" ? "badge-approved" :
                          ind.status === "REJECTED" ? "badge-rejected" : "badge-secondary"
                        }`}>
                          {ind.status}
                        </span>
                      </td>
                      <td
                        style={{
                          maxWidth: "180px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `rem-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `rem-${ind._id}` ? null : `rem-${ind._id}`)
                        }
                      >
                        {expandedCell === `rem-${ind._id}`
                          ? ind.items[0]?.remark || "-"
                          : truncateText(ind.items[0]?.remark)}
                      </td>
                      <td
                        style={{
                          maxWidth: "200px",
                          cursor: "pointer",
                          whiteSpace: expandedCell === `spec-${ind._id}` ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                        onClick={() =>
                          setExpandedCell(expandedCell === `spec-${ind._id}` ? null : `spec-${ind._id}`)
                        }
                      >
                        {expandedCell === `spec-${ind._id}`
                          ? ind.items[0]?.specification || "-"
                          : truncateText(ind.items[0]?.specification)}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1 justify-content-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          <span className="small">{ind.user || "System"}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-muted small">
                          {ind.createdAt ? new Date(ind.createdAt).toLocaleString("en-IN") : ""}
                        </span>
                      </td>
                      <td>{ind.userLocations?.length ? ind.userLocations.join(", ") : "-"}</td>
                      <td>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn-action-edit"
                            disabled={ind.user !== loggedInUser}
                            title={ind.user !== loggedInUser ? "Only the user who raised this indent can edit it" : ""}
                            onClick={() => handleEdit(ind)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn-action-delete"
                            disabled={ind.user !== loggedInUser}
                            title={ind.user !== loggedInUser ? "Only the user who raised this indent can delete it" : ""}
                            onClick={() => handleDelete(ind._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>



        {/* ===== SAVED INDENTS AND TRACKING ===== */}
        <div className="bar-card" style={{ display: showTrack ? "block" : "none" }}>
          <div className="bar-head">
            <h5>Saved Indents and Tracking</h5>
            <span className="bar-count">{trackIndents.length} / {indents.length} indents</span>
          </div>

          <div className="bar-body">
            <div className="row g-2 align-items-end">
              <PoField className="col-12 col-lg-4" icon="bi-search" label="Search indent, customer, product" filled={has(searchQ)}>
                <input type="text" className="po-input" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
              </PoField>
              <PoField className="col-6 col-lg-3" icon="bi-diagram-3" label="Stage" alwaysFloat caret>
                <select className="po-input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                  <option value="">All stages</option>
                  {LIVE_STAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </PoField>
              <PoField className="col-6 col-lg-2" icon="bi-tag" label="Type" alwaysFloat caret>
                <select className="po-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">All types</option>
                  <option value="production">Production</option>
                  <option value="sample">Sample</option>
                </select>
              </PoField>
              <div className="col-6 col-lg-2">
                <button type="button" className="btn btn-clear-filters w-100" onClick={clearTrackFilters}>Clear</button>
              </div>
            </div>
          </div>

          <div className="custom-table-container">
            <table className="table table-bordered table-hover align-middle bg-white">
              <thead>
                <tr>
                  <th>Indent</th><th>Type</th><th>Customer</th><th>Product</th><th>Qty</th>
                  <th>Due</th><th>Stage</th><th>WO / Ticket</th><th></th>
                </tr>
              </thead>
              <tbody>
                {trackIndents.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-4">No indents match these filters.</td></tr>
                ) : (
                  trackIndents.map((ind) => {
                    const it = ind.items?.[0] || {};
                    const P = PIPE[typeKey(ind)];
                    const i = getStageIdx(ind);
                    const fin = flow[ind.indentNo]?.current === "Completed";
                    const due = it.deliveryDate ? String(it.deliveryDate).slice(0, 10) : "";
                    const overdue = !fin && due && due < new Date().toISOString().slice(0, 10);
                    return (
                      <tr key={ind._id} className={trackId === ind._id ? "trk-selected" : ""}>
                        <td className="fw-bold">{ind.indentNo}</td>
                        <td>{typeKey(ind) === "sample" ? "Sample" : "Production"}</td>
                        <td>{it.customerName || "-"}</td>
                        <td>{it.description || it.productCode || "-"}</td>
                        <td>{it.quantity ?? "-"}</td>
                        <td>
                          {due ? new Date(due).toLocaleDateString("en-IN") : "-"}
                          {/* {overdue && <span className="custom-badge badge-rejected ms-1">Overdue</span>} */}
                        </td>
                        <td>
                          {(() => {
                            const fl = flow[ind.indentNo];
                            if (!fl) return "-";
                            return (
                              <div>
                                <div className="trk-line">
                                  {fl.stages.map((st, k) => (
                                    <span key={st.key} className="trk-step">
                                      {k > 0 && <i className={`trk-seg ${fl.stages[k - 1].state === "done" ? "on" : ""}`} />}
                                      <b className={`trk-dot trk-d-${st.state}`} title={`${st.label}: ${st.state}`} />
                                    </span>
                                  ))}
                                </div>
                                <small className="d-block mt-1">
                                  {ind.holdReason ? "On hold" : fl.current}
                                </small>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="fw-bold">
  {flow[ind.indentNo]?.woNo || (extTickets[ind.indentNo]?.tickets || []).join(", ") || "-"}
</td>
                        
                        <td>
                          <div className="d-flex gap-1">
                            <button type="button" className="btn-action-edit"
                              onClick={() => { setTrackId(ind._id); setTrackExtra({}); setTrackNote(""); setHoldReason(""); setTrackErr(""); }}>
                              Track
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ---- Track detail panel ---- */}
          {(() => {
            const ind = indents.find((x) => x._id === trackId);
            if (!ind) return null;
            const it = ind.items?.[0] || {};
            const P = PIPE[typeKey(ind)];
            const i = getStageIdx(ind);
            const nx = P[i + 1];
            const log = getTrackLog(ind);
            return (
              <div
                className="trk-overlay"
                onClick={() => setTrackId(null)}
              >
              <div
                className="bar-body trk-panel trk-modal"
                onClick={(e) => e.stopPropagation()}
                
              >
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <b>{ind.indentNo}</b>
                  <span>{it.customerName} - {it.description || it.productCode}</span>
                  {!ind.holdReason && (
                    <input type="text" className="custom-input" style={{ display: "none" }} placeholder="Hold reason"
                      value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
                  )}
                  <button type="button" className="btn-action-edit"
                    style={{ display: ind.holdReason ? "" : "none" }} onClick={() => runTrack(ind, ind.holdReason ? { action: "resume" } : { action: "hold", reason: holdReason })}>
                    {ind.holdReason ? "Resume" : "Put on hold"}
                  </button>
                  <button type="button" className="btn-action-delete ms-auto" onClick={() => setTrackId(null)}>Close</button>
                </div>

                <ol className="trk-steps" style={{ display: "none" }}>
                  {P.map((s, k) => {
                    const l = log.find((x) => x.stage === s[0]);
                    return (
                      <li key={s[0]} className={k < i ? "done" : k === i ? "now" : ""}>
                        <span>{k <= i ? "✓" : k + 1}</span>
                        <div>{s[1]}<small>{l ? fmtWhen(l.at) : ""}</small></div>
                      </li>
                    );
                  })}
                </ol>

                {(() => {
                  const fl = flow[ind.indentNo];
                  if (!fl) return null;
                  const CL = { done: ["#d9f2e6", "#1f9d6b"], partial: ["#fff3d6", "#d98a00"], current: ["#fde3d8", "#e4572e"], stopped: ["#fbdcdc", "#d64545"] };
                  return (
                    <div className="mt-2 mb-2">
                      {chartWo && chartWo === fl.woNo && (
                        <WoStageChartModal woNo={chartWo} tree={woTrees[chartWo]} onClose={() => setChartWo(null)} />
                      )}
                      <div className="trk-flow-title"><b className="trk-flow-h">Order flow</b>{fl.woNo ? <span className="trk-chip">WO <b>{fl.woNo}</b></span> : null}{fl.poNo ? <span className="trk-chip">PO <b>{fl.poNo}</b></span> : null}<span className="trk-chip trk-now">Now: <b>{fl.current}</b></span></div>
                      <div className="trk-cards">
                        {fl.stages.map((st) => {
                          let stS = st.key === "production" && woTrees[fl.woNo]?.complete ? "done" : st.state;

// Out Source / PMS: dispatch card follows the ticket dispatches
const extD = isExtOrder(ind) && st.key === "dispatch" ? extDetail[ind.indentNo] : null;
const extOrders = extD && !extD.error && extD.orders && extD.orders.length ? extD.orders : null;
let extLines = null;
if (extOrders) {
  const allDone = extOrders.every((o) => o.totalQty > 0 && o.balanceQty <= 0);
  const anyDone = extOrders.some((o) => o.dispatchedQty > 0);
  if (allDone) stS = "done";
  else if (anyDone) stS = "partial";
  extLines = extOrders.flatMap((o) => {
    const last = o.dispatches[o.dispatches.length - 1];
    return [
      `Ticket ${o.ticketNo}: ${o.dispatchedQty} of ${o.totalQty} dispatched`,
      `Balance: ${o.balanceQty}`,
      last
        ? `Last: ${last.dispatchDate ? new Date(last.dispatchDate).toLocaleDateString("en-IN") : "-"}${last.courier ? " via " + last.courier : ""}`
        : "Not dispatched yet"
    ];
  });
}
                          const c = CL[stS] || ["#f4f6f8", "#b8c0cb"];
                          return (
                            <div key={st.key} title="Double-click for details" onDoubleClick={() => { setFlowSel(ind.indentNo + "|" + st.key); fetchFlowDetail(ind.indentNo); if (isExtOrder(ind)) fetchExtDetail(ind.indentNo); }} className="trk-card" style={{ "--c-bg": c[0], "--c-bd": c[1] }}>
                              <b style={{ color: c[1] }}>{st.label}</b>
                              {(extLines || st.lines).map((ln, q) => <div key={q} className="trk-ln">{ln}</div>)}
                            </div>
                          );
                        })}
                      </div>
                      {(() => {
                        if (!flowSel.startsWith(ind.indentNo + "|")) return null;
                        const tab = flowSel.split("|")[1];
                        const d = flowData[ind.indentNo];
                        
                        let body = <div className="py-2">Loading...</div>;
                        const extMode = tab === "dispatch" && isExtOrder(ind);
if (extMode) {
  const ex = extDetail[ind.indentNo];
  if (!ex) body = <div className="py-2">Loading...</div>;
  else if (ex.error) body = <div className="py-2">Could not load details.</div>;
  else
    body = (
      <FlowList
        docs={ex.orders.flatMap((o) =>
          o.dispatches.map((x) => ({
            ticketNo: o.ticketNo,
            ...x,
            location:
              locations.find((l) => String(l._id) === String(x.location))?.locationName ||
              x.location
          }))
        )}
      />
    );
} else if (d && d.error) body = <div className="py-2">Could not load details.</div>;
                        else if (d) {
                          if (tab === "indent") body = <FlowKV doc={d.indent} />;
                          else if (tab === "po") body = <FlowMulti docs={d.orders || (d.order ? [d.order] : [])} />;
                          else if (tab === "planner") body = <FlowMulti docs={d.workOrders || (d.workOrder ? [d.workOrder] : [])} />;
                          else if (tab === "production") body = <FlowList docs={d.production} />;
                          
                          else if (tab === "dispatch") body = <FlowList docs={(d.dispatch || []).map((x) => ({ ...x, location: locations.find((l) => String(l._id) === String(x.location))?.locationName || x.location }))} />;
                        }
                        return (
                          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setFlowSel("")}>
                            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 8, width: "94vw", maxWidth: 1400, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
                              <div className="d-flex align-items-center gap-3 px-3 py-2" style={{ borderBottom: "1px solid #e3e7ec" }}>
                                <b style={{ fontSize: 15 }}>{ind.indentNo}</b>
                                {fl.woNo ? <span>WO <b>{fl.woNo}</b></span> : null}
                                {fl.poNo ? <span>PO <b>{fl.poNo}</b></span> : null}
                                <span>{fl.customer}</span>
                                <button type="button" className="btn-action-delete ms-auto" onClick={() => setFlowSel("")}>Close</button>
                              </div>
                              <div className="d-flex flex-wrap gap-1 px-3 pt-2 pb-2">
                                {fl.woNo ? (
                                  <button type="button" className="btn btn-sm btn-success" style={{ fontWeight: 700 }}
                                    onClick={() => setChartWo(fl.woNo)}>
                                    Chart
                                  </button>
                                ) : null}
                                {fl.stages.map((x) => (
                                  <button key={x.key} type="button" className="btn btn-sm"
                    style={{
                      fontWeight: 600,
                      background: x.key === tab ? "#0f5560" : "#b9d6dd",
                      color: x.key === tab ? "#fff" : "#000",
                      border: "1px solid " + (x.key === tab ? "#0b3a45" : "#8fbcc7")
                    }}
                                    onClick={() => setFlowSel(ind.indentNo + "|" + x.key)}>{x.label}</button>
                                ))}
                              </div>
                              <div className="px-3 pb-3" style={{ overflow: "auto", flex: 1 }}>{body}</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {ind.holdReason ? (
                  <p>On hold: {ind.holdReason}. Resume to continue.</p>
                ) : nx ? (
                  <>
                    <div className="row g-2 mt-1" style={{ display: "none" }}>
                      {(TRACK_EX[nx[0]] || []).map(([l, t, opts]) => (
                        <PoField key={l} className="col-12 col-md-4" icon="bi-pencil" label={l} required
                          filled={has(trackExtra[l])} alwaysFloat={t === "select"} caret={t === "select"}>
                          {t === "select" ? (
                            <select className="po-input" value={trackExtra[l] || ""}
                              onChange={(e) => setTrackExtra((p) => ({ ...p, [l]: e.target.value }))}>
                              <option value="">Select</option>
                              {opts.map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          ) : (
                            <input type="text" className="po-input" value={trackExtra[l] || ""}
                              onChange={(e) => setTrackExtra((p) => ({ ...p, [l]: e.target.value }))} />
                          )}
                        </PoField>
                      ))}
                      <PoField className="col-12 col-md-4" icon="bi-chat-left-text" label="Remarks" filled={has(trackNote)}>
                        <input type="text" className="po-input" value={trackNote} onChange={(e) => setTrackNote(e.target.value)} />
                      </PoField>
                      <div className="col-12 col-md-4">
                        <button type="button" className="btn btn-export w-100" onClick={() => advanceStage(ind)}>
                          Mark as {nx[1]}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p>Final stage reached.</p>
                )}
                {trackErr && <small className="indent-error-text">{trackErr}</small>}
              </div>
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

export default NewIndent;