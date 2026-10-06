import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/adminPro.css";
import BASE_URL from "../config/api";

import { motion } from "framer-motion";
import {
  Package,
  MapPin,
  Layers,
  Activity,
  PlusCircle,
  LogOut,
  Factory,
  Search,
  X,
  Filter,
} from "lucide-react";

/* ---------- Light aqua-glass design (same family as the User Register page) ---------- */
const AD_CSS = `
  .pro-container.ad-root {
    --ink: #0b2f4f; --muted: #4a6f8c; --hint: #8fb0c8;
    min-height: 100vh;
    max-width: 100%;
    margin: 0;
    padding: 12px 18px 36px;
    box-sizing: border-box;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
    color: var(--ink);
    background:
      radial-gradient(circle at 12% 6%, rgba(255,255,255,0.9) 0, rgba(255,255,255,0) 30%),
      radial-gradient(circle at 88% 18%, rgba(160,222,250,0.7) 0, rgba(160,222,250,0) 32%),
      radial-gradient(circle at 50% 100%, rgba(255,255,255,0.7) 0, rgba(255,255,255,0) 45%),
      linear-gradient(165deg, #eaf8ff 0%, #d2eefb 45%, #bde5f7 80%, #dff4fd 100%) !important;
    background-attachment: fixed !important;
  }
  .ad-root * { box-sizing: border-box; }

  /* header */
  .ad-root .pro-header {
    display: flex !important; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    margin: 0 0 12px !important; padding: 8px 20px !important; border-radius: 28px !important;
    background: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(222,244,254,0.8) 100%) !important;
    border: 1px solid rgba(255,255,255,0.95) !important;
    backdrop-filter: blur(14px);
    box-shadow: 0 14px 30px rgba(40,120,170,0.18), inset 0 1px 0 #fff, inset 0 -10px 22px rgba(140,210,245,0.2) !important;
  }
  .ad-brand { display: flex; align-items: center; gap: 14px; }
  .ad-emblem {
    width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0a6fb8;
    background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 50%, #8fd0f0 100%);
    border: 1px solid #86c6e8; box-shadow: 0 6px 14px rgba(40,120,170,0.22), inset 0 2px 3px rgba(255,255,255,0.9);
  }
  .ad-root .pro-header h1 { margin: 0 !important; font-size: 22px !important; font-weight: 800 !important; letter-spacing: -0.3px; color: #0a4f8c !important; border: none !important; padding: 0 !important; background: none !important; }
  .ad-root .pro-header h1::before, .ad-root .pro-header h1::after { content: none !important; display: none !important; }
  .ad-brand p { margin: 0; font-size: 12px; font-weight: 600; color: var(--muted); }

  /* section tabs -> soft cards with pastel icon bubbles */
  .ad-root .admin-section-tabs {
    display: grid !important; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 10px; margin: 0 0 14px !important;
    padding: 0 !important; background: none !important; border: none !important;
  }
  .ad-root .admin-section-tab {
    display: flex !important; align-items: center; gap: 10px; text-align: left; cursor: pointer;
    padding: 7px 12px !important; border-radius: 18px !important; font-family: inherit;
    background: linear-gradient(180deg, #ffffff 0%, #f1faff 100%) !important; color: #0a4f8c !important;
    border: 1.5px solid #cfe8f6 !important;
    box-shadow: 0 6px 14px rgba(40,120,170,0.1), inset 0 1px 0 #fff !important;
    font-size: 13px !important; font-weight: 800 !important; transition: all 0.16s ease;
  }
  .ad-root .admin-section-tab:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(40,120,170,0.18) !important; }
  .ad-root .admin-section-tab.active {
    border-color: #5fb4de !important;
    background: linear-gradient(180deg, #ffffff 0%, #dff2fd 100%) !important;
    box-shadow: 0 0 0 4px rgba(27,155,224,0.16), 0 10px 20px rgba(40,120,170,0.2), inset 0 1px 0 #fff !important;
    transform: translateY(-2px);
  }
  .ad-tab-ico {
    width: 32px; height: 32px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 9px rgba(40,90,130,0.16), inset 0 2px 3px rgba(255,255,255,0.85), inset 0 -3px 4px rgba(0,0,0,0.05);
  }
  .ad-tab-ico.lavender { background: linear-gradient(145deg, #efe7ff, #c9b8fb); color: #6d4fd6; }
  .ad-tab-ico.peach    { background: linear-gradient(145deg, #fff0d1, #ffc978); color: #c2650a; }
  .ad-tab-ico.mint     { background: linear-gradient(145deg, #dcf9ea, #8fe0b8); color: #107a4d; }
  .ad-tab-ico.sky      { background: linear-gradient(145deg, #e0f3ff, #9fd6f7); color: #0a6fb8; }
  .ad-tab-ico.rose     { background: linear-gradient(145deg, #ffe4ec, #f9a8c0); color: #be1e55; }
  .ad-tab-ico.lemon    { background: linear-gradient(145deg, #fffbd1, #f6e27a); color: #8a6d00; }

  /* cards */
  .ad-root .pro-card {
    background: linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(228,246,255,0.9) 100%) !important;
    border: 1px solid rgba(255,255,255,0.95) !important; border-radius: 22px !important;
    box-shadow: 0 14px 32px rgba(40,120,170,0.16), inset 0 1px 0 #fff !important;
    padding: 14px 18px 16px !important; margin-bottom: 14px;
  }
  .ad-root .pro-card-header { margin: 0 0 12px !important; padding: 0 !important; border: none !important; background: transparent !important; }
  .ad-root .pro-card-header > span {
    display: inline-flex !important; align-items: center; gap: 9px;
    font-size: 12px; font-weight: 800; color: #0a4f8c !important; text-transform: uppercase; letter-spacing: 0.7px;
    padding: 5px 16px 5px 12px; border-radius: 999px;
    background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%); border: 1px solid #a9d9f2;
    box-shadow: 0 3px 8px rgba(40,120,170,0.12), inset 0 1px 0 #fff;
  }
  .ad-root .pro-card-header > span svg { color: #0a6fb8; }

  /* form controls */
  .ad-root .pro-input, .ad-root select.pro-input, .ad-root textarea.pro-input {
    min-height: 34px; padding: 6px 12px; border: 1.5px solid #9ccbe6 !important; border-radius: 12px !important;
    background: #fff !important; color: var(--ink) !important; font-size: 13.5px; font-weight: 600; outline: none; font-family: inherit;
    box-shadow: inset 0 2px 5px rgba(10,80,130,0.1) !important; transition: border-color .18s ease, box-shadow .18s ease;
  }
  .ad-root .pro-input::placeholder { color: var(--hint); font-weight: 600; }
  .ad-root .pro-input:hover { border-color: #5fb4de !important; }
  .ad-root .pro-input:focus { border-color: #1b9be0 !important; box-shadow: 0 0 0 4px rgba(27,155,224,0.2), 0 6px 14px rgba(27,155,224,0.12) !important; }

  /* buttons */
  .ad-root .pro-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 5px 16px;
    border: 1px solid #9fcfe9 !important; border-radius: 12px !important; cursor: pointer; text-decoration: none;
    background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%) !important; color: #08406b !important;
    font-size: 13px; font-weight: 800; font-family: inherit;
    box-shadow: 0 3px 0 #b3dcf0, 0 7px 12px rgba(40,120,170,0.14), inset 0 1px 0 #fff !important; transition: all .15s ease;
  }
  .ad-root .pro-btn:hover { transform: translateY(-1px); }
  .ad-root .pro-btn:active { transform: translateY(2px); }
  .ad-root .pro-btn.primary {
    background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%) !important; border-color: #7fc3e8 !important;
    box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40,120,170,0.18), inset 0 1px 0 rgba(255,255,255,0.8) !important;
  }
  .ad-root .pro-header .pro-btn.primary {
    background: linear-gradient(180deg, #ffe3df 0%, #f7a79f 100%) !important; color: #8f1414 !important; border-color: #ee8f8f !important;
    box-shadow: 0 3px 0 #e08a8a, 0 7px 12px rgba(220,38,38,0.2), inset 0 1px 0 rgba(255,255,255,0.8) !important;
  }

  /* lists, toggles */
  .ad-root .material-toggle {
    display: inline-flex; align-items: center; gap: 6px; margin: 10px 0 2px; padding: 5px 16px; border-radius: 999px; cursor: pointer;
    background: linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%) !important; color: #08406b !important;
    border: 1px solid #86c6e8 !important; font-size: 12.5px; font-weight: 800; box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
  }
  .ad-root .pro-list { list-style: none; }
  .ad-root .pro-list li {
    padding: 8px 12px; margin-bottom: 6px; border-radius: 14px; gap: 10px;
    background: #fff !important; border: 1px solid #d3e8f4 !important; color: var(--ink) !important; font-weight: 600; font-size: 13px;
  }
  .ad-root .pro-list li:nth-child(even) { background: #f3faff !important; }
  .ad-root .pro-list li:hover { background: #d9f2fc !important; }
  .ad-root .search-block { margin: 10px 0; }
  .ad-root .search-block label { color: #0b2f4f; font-size: 13px; }

  /* activity / tax pickers */
  .ad-root .activity-builder, .ad-root .machine-picker {
    background: rgba(255,255,255,0.7) !important; border: 1px solid #cfe8f6 !important; border-radius: 16px !important;
  }
  .ad-root .activity-name-field label, .ad-root .picker-header { color: #0a4f8c !important; font-weight: 800; }
  .ad-root .machine-tile {
    background: #fff !important; border: 1px solid #cfe8f6 !important; border-radius: 12px !important; color: #0b2f4f !important; font-weight: 700;
  }
  .ad-root .machine-tile.selected {
    background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%) !important; border-color: #5fb4de !important; color: #08406b !important;
  }

  .ad-hint { text-align: center; margin: 18px 0; font-size: 14px; font-weight: 700; color: #4a6f8c; }

  /* master form popup (split card, same look as the Add New User popup) */
  .ad-overlay {
    position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px;
    background: rgba(40,90,130,0.38); backdrop-filter: blur(6px); animation: adFade .18s ease;
  }
  @keyframes adFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes adPop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
  .ad-modal {
    position: relative; display: flex; width: 100%; max-width: 1180px; height: 90vh; max-height: 90vh;
    background: #f7fcff; border-radius: 34px; overflow: hidden; border: 1px solid #fff;
    box-shadow: 0 30px 70px rgba(30,70,110,0.35); animation: adPop .22s ease;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
  }
  .ad-left {
    position: relative; flex: 0 0 25%; margin: 14px 0 14px 14px; padding: 18px 20px 18px;
    display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;
    border-radius: 28px; border: 5px solid #fff; color: #08406b;
    background:
      radial-gradient(circle at 20% 15%, rgba(255,255,255,0.85) 0, rgba(255,255,255,0) 40%),
      radial-gradient(circle at 80% 85%, rgba(255,214,150,0.55) 0, rgba(255,214,150,0) 45%),
      linear-gradient(160deg, #bfe5f8 0%, #8fd0f0 55%, #6fbbe8 100%);
    box-shadow: 0 10px 30px rgba(40,120,170,0.25), inset 0 2px 0 rgba(255,255,255,0.7);
  }
  .ad-left::after { content: ""; position: absolute; right: -70px; top: -12%; height: 124%; width: 110px; background: #f7fcff; border-radius: 50%; }
  .ad-left-top, .ad-left-center, .ad-left-bottom { position: relative; z-index: 2; }
  .ad-left-label { font-size: 12px; font-weight: 800; letter-spacing: 0.3px; }
  .ad-left-center { text-align: center; padding-right: 22px; }
  .ad-left-emblem {
    width: 76px; height: 76px; margin: 0 auto 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0a6fb8;
    background: radial-gradient(circle at 30% 25%, #ffffff 0%, #e4f5ff 55%, #b6e0f6 100%); border: 2px solid #fff;
    box-shadow: 0 14px 30px rgba(10,80,130,0.28), inset 0 3px 5px rgba(255,255,255,0.9);
  }
  .ad-left-center h2 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.4px; color: #07406b; line-height: 1.15; }
  .ad-left-center p { margin: 6px auto 0; font-size: 12px; font-weight: 600; color: #1c5a85; line-height: 1.45; }
  .ad-left-bottom {
    align-self: flex-start; padding: 6px 16px; border-radius: 999px; background: rgba(255,255,255,0.75);
    border: 1px solid rgba(255,255,255,0.95); box-shadow: 0 6px 16px rgba(40,120,170,0.18);
  }
  .ad-left-bottom b { display: block; font-size: 13px; font-weight: 800; color: #07406b; line-height: 1.1; }
  .ad-left-bottom small { font-size: 10.5px; font-weight: 600; color: #2f6d96; }
  .ad-planet { position: absolute; border-radius: 50%; z-index: 1; }
  .ad-planet-1 { width: 110px; height: 110px; right: 6px; top: 60px; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.05) 70%); }
  .ad-planet-2 { width: 46px; height: 46px; left: 18px; bottom: 80px; background: radial-gradient(circle at 30% 30%, #ffe3b0, #ffb347 80%); opacity: 0.85; box-shadow: 0 6px 14px rgba(255,160,0,0.3); }

  .ad-right { position: relative; flex: 1; min-width: 0; overflow-y: auto; padding: 18px 26px 22px 12px; }
  .ad-close {
    position: absolute; top: 12px; right: 14px; z-index: 5; width: 32px; height: 32px; border-radius: 50%;
    border: 1px solid #a9d9f2; background: linear-gradient(180deg, #ffffff, #e4f4fd); color: #08406b; font-size: 13px; font-weight: 800; cursor: pointer;
  }
  .ad-close:hover { background: #d6effc; }
  .ad-right .pro-card { background: transparent !important; box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; }
  @media (max-width: 900px) { .ad-left { display: none; } .ad-right { padding: 16px; } .ad-modal { height: 94vh; max-height: 94vh; } }

  /* message box (replaces the browser alert / confirm) */
  .ad-msg-overlay {
    position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 16px;
    background: rgba(40,90,130,0.38); backdrop-filter: blur(6px); animation: adFade .15s ease;
  }
  .ad-msg-box {
    width: 380px; max-width: 94vw; padding: 22px 26px 20px; text-align: center; border-radius: 28px;
    background: linear-gradient(180deg, #ffffff 0%, #e8f6fe 100%); border: 1px solid #fff;
    box-shadow: 0 26px 60px rgba(30,70,110,0.35), inset 0 1px 0 #fff; animation: adPop .2s ease;
    font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif;
  }
  .ad-msg-ico {
    width: 58px; height: 58px; margin: 0 auto 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 900; color: #0a6fb8;
    background: radial-gradient(circle at 30% 25%, #ffffff 0%, #bfe5f8 55%, #8fd0f0 100%);
    box-shadow: 0 10px 22px rgba(40,120,170,0.25), inset 0 2px 4px rgba(255,255,255,0.9);
  }
  .ad-msg-box.success .ad-msg-ico { color: #107a4d; background: radial-gradient(circle at 30% 25%, #ffffff 0%, #c8f3dd 55%, #8fe0b8 100%); }
  .ad-msg-box.error   .ad-msg-ico { color: #b91c1c; background: radial-gradient(circle at 30% 25%, #ffffff 0%, #fdd0d0 55%, #f7a3a3 100%); }
  .ad-msg-box.warning .ad-msg-ico { color: #b45309; background: radial-gradient(circle at 30% 25%, #ffffff 0%, #ffedb8 55%, #fcd477 100%); }
  .ad-msg-box h3 { margin: 0; font-size: 19px; font-weight: 900; color: #0a4f8c; }
  .ad-msg-box p { margin: 6px 0 16px; font-size: 14px; font-weight: 600; color: #34526b; line-height: 1.45; word-break: break-word; }
  .ad-msg-actions { display: flex; gap: 10px; justify-content: center; }
  .ad-msg-btn {
    min-width: 96px; padding: 8px 20px; border-radius: 12px; border: 1px solid #9fcfe9; cursor: pointer;
    background: linear-gradient(180deg, #ffffff 0%, #d6effc 100%); color: #08406b; font-size: 13.5px; font-weight: 800; font-family: inherit;
    box-shadow: 0 3px 0 #b3dcf0, 0 7px 12px rgba(40,120,170,0.14), inset 0 1px 0 #fff;
  }
  .ad-msg-btn.primary { background: linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%); border-color: #7fc3e8; box-shadow: 0 3px 0 #7fbbe0, 0 7px 12px rgba(40,120,170,0.18); }
  .ad-msg-btn.danger  { background: linear-gradient(180deg, #ffe3df 0%, #f7a79f 100%); color: #8f1414; border-color: #ee8f8f; box-shadow: 0 3px 0 #e08a8a, 0 7px 12px rgba(220,38,38,0.2); }
  .ad-msg-btn:hover { transform: translateY(-1px); }
  .ad-msg-btn:active { transform: translateY(2px); }

  @media (max-width: 768px) {
    .pro-container.ad-root { padding: 10px; }
    .ad-root .pro-header { border-radius: 20px !important; }
  }
`;

const TAB_TINTS = ["lavender", "peach", "mint", "sky", "rose", "lemon"];

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null); // which master form popup is open

  // ---- message box (replaces the browser alert / confirm popups) ----
  const [msgBox, setMsgBox] = useState(null); // { kind: "alert" | "confirm", type, message }
  const msgResolveRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [editingData, setEditingData] = useState({});
  const [searchItemCode, setSearchItemCode] = useState("");
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [showMachineCapacity, setShowMachineCapacity] = useState(false);
  const [activities, setActivities] = useState([]);
  const [searchMaterialCode, setSearchMaterialCode] = useState("");
  const [newActivity, setNewActivity] = useState({ activityName: "", machines: [] });
  const [machines, setMachines] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [machineStatuses, setMachineStatuses] = useState([]);
  const [newMachineStatus, setNewMachineStatus] = useState("");
  const [transportations, setTransportations] = useState([]);
  const [newTransportation, setNewTransportation] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [orders, setOrders] = useState([]);
  const [paperSizes, setPaperSizes] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [showInspectionList, setShowInspectionList] = useState(false);
  const [uploadingInspections, setUploadingInspections] = useState(false);
  const [inspectionUploadResult, setInspectionUploadResult] = useState(null);
  const [newPaperSize, setNewPaperSize] = useState("");
    const [gstTaxes, setGstTaxes] = useState([]);
  const [newGst, setNewGst] = useState({ machineId: "", taxes: {} }); // taxes: { GST: "18", SGST: "9" }
  const [showGstList, setShowGstList] = useState(false);
  const [newPaperWastage, setNewPaperWastage] = useState("");
  const [newPaperRate, setNewPaperRate] = useState("");
  const [newPrinter, setNewPrinter] = useState({ printerName: "", machineName: "" });
  const [showPaperSizeList, setShowPaperSizeList] = useState(false);
  const [showPrinterList, setShowPrinterList] = useState(false);
  const [newLocation, setNewLocation] = useState({
    locationName: "",
    address: "",
    machines: [],
  });

  const [freightChargeTypes, setFreightChargeTypes] = useState([]);
  const [freightTypes, setFreightTypes] = useState([]);
  const [newFreightCharge, setNewFreightCharge] = useState("");
  const [newFreightType, setNewFreightType] = useState("");
  const [showFreightChargeList, setShowFreightChargeList] = useState(false);
  const [showFreightTypeList, setShowFreightTypeList] = useState(false);

  const [newItem, setNewItem] = useState({
    itemCode: "",
    customerName: "",
    description: "",
    materialType: "",
    colorFront: "",
    colorBack: "",
    wasteQty: "",
    jobSize: "",
    inkDetails: "",
  });
  const [newItemPdf, setNewItemPdf] = useState(null);

  const [branches, setBranches] = useState([]);
  const [newBranch, setNewBranch] = useState({
    branchCode: "",
    dispatchAddress: "",
  });
  const [uploadingItems, setUploadingItems] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showBranchList, setShowBranchList] = useState(false);
  const [showItemList, setShowItemList] = useState(false);
  const [showPriorityList, setShowPriorityList] = useState(false);
  const [showTransportationList, setShowTransportationList] = useState(false);
  const [showMachineStatusList, setShowMachineStatusList] = useState(false);
  const [showMachineList, setShowMachineList] = useState(false);
  const [showActivityList, setShowActivityList] = useState(false);
  const [showLocationList, setShowLocationList] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [machineCapacity, setMachineCapacity] = useState({});
  const [newCustomer, setNewCustomer] = useState("");
  const [newMachine, setNewMachine] = useState({ machineName: "", ups: [], fixed: false });
  const [newMachineUpsText, setNewMachineUpsText] = useState("");
  const [editingUpsText, setEditingUpsText] = useState("");
  const UPS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
  const [innerPackings, setInnerPackings] = useState([]);
  const [newInnerPacking, setNewInnerPacking] = useState({
    type: "",
    leavesPerInner: "",
    innerPack: "",
    outerPack: "",
    innerPerOuter: "",
  });
  const [showInnerPackingList, setShowInnerPackingList] = useState(false);

  const [newMaterial, setNewMaterial] = useState({
    code: "",
    description: "",
    group: "",
    mill: "",
    gsm: "",
    paperSize: "",
    length: "",
    width: "",
  });
  const [showMaterialList, setShowMaterialList] = useState(false);
  const [uploadingMaterials, setUploadingMaterials] = useState(false);
  const [materialUploadResult, setMaterialUploadResult] = useState(null);

  // ==================== FILTER STATES ====================
  const [priorityFilter, setPriorityFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState({ branchCode: "", dispatchAddress: "" });
  const [innerPackingFilter, setInnerPackingFilter] = useState({
    type: "",
    leavesPerInner: "",
    innerPack: "",
    outerPack: "",
    innerPerOuter: "",
  });
  const [itemFilter, setItemFilter] = useState({
    itemCode: "",
    customerName: "",
    description: "",
    materialType: "",
    colorFront: "",
    colorBack: "",
    wasteQty: "",
    jobSize: "",
    inkDetails: "",
  });
  const [transportationFilter, setTransportationFilter] = useState("");
  const [freightChargeFilter, setFreightChargeFilter] = useState("");
  const [freightTypeFilter, setFreightTypeFilter] = useState("");
  const [machineStatusFilter, setMachineStatusFilter] = useState("");
  const [paperSizeFilter, setPaperSizeFilter] = useState("");
  const [printerFilter, setPrinterFilter] = useState({ machineName: "", printerName: "" });
  const [iqcFilter, setIqcFilter] = useState({
    slNo: "",
    description: "",
    qualityParameter: "",
    specification: "",
    uom: "",
    tolerance: "",
  });
  const [machineFilter, setMachineFilter] = useState({ machineName: "", ups: "", fixedStatus: "all" });
  const [capacityFilter, setCapacityFilter] = useState({ machineName: "", capacity: "" });
  const [activityFilter, setActivityFilter] = useState({ activityName: "", machineName: "" });
  const [locationFilter, setLocationFilter] = useState({ locationName: "", address: "" });
  const [materialFilter, setMaterialFilter] = useState({
    code: "",
    description: "",
    group: "",
    mill: "",
    gsm: "",
    paperSize: "",
    length: "",
    width: "",
  });

  const token = localStorage.getItem("token");

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const showAlert = (message) => {
    const m = String(message ?? "");
    const low = m.toLowerCase();
    const type = /success/.test(low) ? "success" : /(fail|error)/.test(low) ? "error" : "warning";
    setMsgBox({ kind: "alert", type, message: m });
  };

  const askConfirm = (message) =>
    new Promise((resolve) => {
      msgResolveRef.current = resolve;
      setMsgBox({ kind: "confirm", type: "confirm", message });
    });

  const closeMsg = (result) => {
    if (msgResolveRef.current) {
      msgResolveRef.current(result);
      msgResolveRef.current = null;
    }
    setMsgBox(null);
  };

  // Clears every half-typed form, filter, open list and upload message so a form always opens fresh
  const resetForms = () => {
    // inline editing
    setEditingId(null);
    setEditingValue("");
    setEditingData({});
    setEditingUpsText("");

    // "add new" forms
    setNewPriority("");
    setNewBranch({ branchCode: "", dispatchAddress: "" });
    setNewInnerPacking({ type: "", leavesPerInner: "", innerPack: "", outerPack: "", innerPerOuter: "" });
    setNewItem({
      itemCode: "",
      customerName: "",
      description: "",
      materialType: "",
      colorFront: "",
      colorBack: "",
      wasteQty: "",
      jobSize: "",
      inkDetails: "",
    });
    setNewItemPdf(null);
    setNewTransportation("");
    setNewFreightCharge("");
    setNewFreightType("");
    setNewMachineStatus("");
    setNewPaperSize("");
    setNewPaperWastage("");
    setNewPaperRate("");
    setNewPrinter({ printerName: "", machineName: "" });
    setNewMachine({ machineName: "", ups: [], fixed: false });
    setNewMachineUpsText("");
    setNewActivity({ activityName: "", machines: [] });
    setNewLocation({ locationName: "", address: "", machines: [] });
    setNewMaterial({ code: "", description: "", group: "", mill: "", gsm: "", paperSize: "", length: "", width: "" });
    setNewGst({ machineId: "", taxes: {} });

    // stored-record lists back to hidden
    setShowPriorityList(false);
    setShowBranchList(false);
    setShowInnerPackingList(false);
    setShowItemList(false);
    setShowTransportationList(false);
    setShowFreightChargeList(false);
    setShowFreightTypeList(false);
    setShowMachineStatusList(false);
    setShowPaperSizeList(false);
    setShowPrinterList(false);
    setShowInspectionList(false);
    setShowGstList(false);
    setShowMachineList(false);
    setShowMachineCapacity(false);
    setShowActivityList(false);
    setShowLocationList(false);
    setShowMaterialList(false);

    // upload results + searches + filters
    setUploadResult(null);
    setInspectionUploadResult(null);
    setMaterialUploadResult(null);
    setSearchItemCode("");
    setSearchMaterialCode("");
    setPriorityFilter("");
    setBranchFilter({ branchCode: "", dispatchAddress: "" });
    setInnerPackingFilter({ type: "", leavesPerInner: "", innerPack: "", outerPack: "", innerPerOuter: "" });
    setItemFilter({
      itemCode: "",
      customerName: "",
      description: "",
      materialType: "",
      colorFront: "",
      colorBack: "",
      wasteQty: "",
      jobSize: "",
      inkDetails: "",
    });
    setTransportationFilter("");
    setFreightChargeFilter("");
    setFreightTypeFilter("");
    setMachineStatusFilter("");
    setPaperSizeFilter("");
    setPrinterFilter({ machineName: "", printerName: "" });
    setIqcFilter({ slNo: "", description: "", qualityParameter: "", specification: "", uom: "", tolerance: "" });
    setMachineFilter({ machineName: "", ups: "", fixedStatus: "all" });
    setCapacityFilter({ machineName: "", capacity: "" });
    setActivityFilter({ activityName: "", machineName: "" });
    setLocationFilter({ locationName: "", address: "" });
    setMaterialFilter({ code: "", description: "", group: "", mill: "", gsm: "", paperSize: "", length: "", width: "" });
  };

  // Opening a card: start from a clean form and reload the latest data
  const openSection = (id) => {
    resetForms();
    setActiveSection(id);
    fetchMasters();
    fetchMachineCapacity();
    fetchGst();
  };

  const closeSection = () => {
    setActiveSection(null);
    resetForms();
  };

  useEffect(() => {
    fetchMasters();
    fetchMachineCapacity();
  }, []);

     const GST_TYPES = ["GST", "SGST", "CGST", "IGST"];

  const fetchGst = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/gst/machine-taxes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGstTaxes(res.data);
    } catch (err) {
      console.error("Error fetching GST master:", err);
    }
  };

  useEffect(() => {
    fetchGst();
  }, []);

  const taxesToArray = (obj) =>
    Object.entries(obj).map(([name, rate]) => ({ name, rate: Number(rate) || 0 }));

  const toggleTaxType = (obj, name) => {
    const next = { ...obj };
    if (name in next) delete next[name];
    else next[name] = "";
    return next;
  };

  const addGst = async () => {
    const machine = machines.find((m) => m._id === newGst.machineId);
    if (!machine) return showAlert("Select a machine");
    const keys = Object.keys(newGst.taxes);
    if (keys.length === 0) return showAlert("Tick at least one tax");
    if (keys.some((k) => newGst.taxes[k] === "")) return showAlert("Enter a rate for every ticked tax");
    try {
      await axios.post(
        `${BASE_URL}/api/master/gst/machine-taxes`,
        {
          machineId: machine._id,
          machineName: machine.machineName,
          taxes: taxesToArray(newGst.taxes),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewGst({ machineId: "", taxes: {} });
      fetchGst();
    } catch (err) {
      showAlert(err.response?.data?.message || "Failed to save GST");
    }
  };

  const saveGst = async (id) => {
    const taxes = editingData.taxes || {};
    if (Object.keys(taxes).length === 0) return showAlert("Tick at least one tax");
    if (Object.keys(taxes).some((k) => taxes[k] === "")) return showAlert("Enter a rate for every ticked tax");
    try {
      await axios.put(
        `${BASE_URL}/api/master/gst/machine-taxes/${id}`,
        { taxes: taxesToArray(taxes) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingId(null);
      setEditingData({});
      fetchGst();
    } catch (err) {
      showAlert("Failed to update");
    }
  };

  const deleteGst = async (id) => {
    if (!(await askConfirm("Are you sure you want to delete?"))) return;
    try {
      await axios.delete(`${BASE_URL}/api/master/gst/machine-taxes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchGst();
    } catch (err) {
      showAlert("Failed to delete");
    }
  };

  const renderTaxPicker = (taxes, onToggle, onRate) => (
    <div className="machine-picker">
      <div className="picker-header">
        <span>Taxes</span>
        <strong>{Object.keys(taxes).length} selected</strong>
      </div>
      <div className="machine-grid">
        {GST_TYPES.map((name) => {
          const selected = name in taxes;
          return (
            <div key={name} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label className={`machine-tile ${selected ? "selected" : ""}`}>
                <input type="checkbox" checked={selected} onChange={() => onToggle(name)} />
                <span>{name}</span>
              </label>
              {selected && (
                <input
                  className="pro-input"
                  type="number"
                  placeholder="Rate %"
                  value={taxes[name]}
                  onChange={(e) => onRate(name, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
  const thStyle = {
    padding: "10px",
    border: "1px solid #7fbfe4",
    textAlign: "left",
    color: "#08406b",
    background: "linear-gradient(180deg, #c9eafb 0%, #96d3f2 100%)",
  };

  const stickyThStyle = {
    ...thStyle,
    position: "sticky",
    top: 0,
    zIndex: 2,
  };

  const tdStyle = {
    padding: "10px",
    border: "1px solid #d3e8f4",
  };

  const inputStyle = {
    padding: "6px 10px",
    width: "100%",
    borderRadius: "10px",
    border: "1.5px solid #9ccbe6",
    background: "#fff",
    color: "#0b2f4f",
    fontWeight: 600,
  };

  const btnStyle = {
    padding: "6px 14px",
    background: "linear-gradient(180deg, #d6f0fd 0%, #9ed6f4 100%)",
    color: "#08406b",
    border: "1px solid #7fc3e8",
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 3px 0 #7fbbe0",
  };

  // Soft green upload label (replaces the repeated inline green style)
  const uploadLabelStyle = {
    padding: "7px 16px",
    background: "linear-gradient(180deg, #d4f6e5 0%, #9ee3c0 100%)",
    color: "#07583b",
    border: "1px solid #7fd3ab",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    boxShadow: "0 3px 0 #84cba9",
  };

  // Reusable styles for Filter and Scrollbars
  const filterBoxStyle = {
    background: "rgba(255,255,255,0.7)",
    border: "1px solid #cfe8f6",
    borderRadius: "16px",
    padding: "10px 14px",
    margin: "12px 0 10px 0",
  };

  const filterTitleStyle = {
    fontSize: "13px",
    fontWeight: "800",
    color: "#0a4f8c",
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const filterGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "8px",
  };

  const filterInputStyle = {
    padding: "6px 10px",
    borderRadius: "10px",
    border: "1.5px solid #9ccbe6",
    background: "#fff",
    fontSize: "12.5px",
    fontWeight: 600,
    color: "#0b2f4f",
    width: "100%",
    boxSizing: "border-box",
  };

  const clearBtnStyle = {
    padding: "3px 10px",
    background: "linear-gradient(180deg, #ffffff 0%, #fee2e2 100%)",
    border: "1px solid #f3a5a5",
    color: "#b91c1c",
    borderRadius: "999px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
  };

  const scrollContainerStyle = {
    maxHeight: "380px",
    overflowY: "auto",
    overflowX: "hidden",
    border: "1px solid #a9d9f2",
    borderRadius: "16px",
    padding: "8px",
    marginTop: "10px",
    background: "rgba(255,255,255,0.8)",
    scrollbarWidth: "thin",
    scrollbarColor: "#96d3f2 #eaf7ff",
  };

  const tableScrollContainerStyle = {
    maxHeight: "380px",
    overflowY: "auto",
    overflowX: "auto",
    border: "1px solid #a9d9f2",
    borderRadius: "16px",
    marginTop: "10px",
    background: "#fff",
    scrollbarWidth: "thin",
    scrollbarColor: "#96d3f2 #eaf7ff",
  };

  const masterSections = [
    { id: "priorities", label: "Priorities", icon: Activity },
    { id: "branch", label: "Branch Master", icon: MapPin },
    { id: "innerPacking", label: "Inner Packing", icon: Package },
    { id: "items", label: "Items", icon: Package },
    { id: "transportation", label: "Transportation", icon: Factory },
    { id: "freightCharge", label: "Freight Charge Type", icon: Layers },
    { id: "freightType", label: "Freight Type", icon: Layers },
    { id: "machineStatus", label: "Machine Status", icon: Activity },
    { id: "machines", label: "Machines", icon: Factory },
    { id: "machineCapacity", label: "Machine Capacity", icon: Factory },
    { id: "activities", label: "Activities", icon: Activity },
    { id: "locations", label: "Locations", icon: MapPin },
    { id: "materials", label: "Materials", icon: Layers },
    { id: "paperSize", label: "Paper Size", icon: Layers },
    { id: "printerName", label: "Printer Master", icon: Factory },
    { id: "inspection", label: "RM-IQC Specs", icon: Layers },
    { id: "gstMaster", label: "GST Master", icon: Layers },
  ];

  const fetchMasters = async () => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const [
      cust,
      item,
      mach,
      loc,
      mat,
      act,
      pri,
      trans,
      status,
      inner,
      branches,
      fcharge,
      ftype,
      paperSizesRes,
      printersRes,
      rmIqcRes,
    ] = await Promise.all([
      axios.get(`${BASE_URL}/api/master/customers`, config),
      axios.get(`${BASE_URL}/api/master/items`, config),
      axios.get(`${BASE_URL}/api/master/machines`, config),
      axios.get(`${BASE_URL}/api/master/locations`, config),
      axios.get(`${BASE_URL}/api/master/materials`, config),
      axios.get(`${BASE_URL}/api/master/activities`, config),
      axios.get(`${BASE_URL}/api/master/priorities`, config),
      axios.get(`${BASE_URL}/api/master/transportations`, config),
      axios.get(`${BASE_URL}/api/master/machine-status`, config),
      axios.get(`${BASE_URL}/api/master/inner-packing`, config),
      axios.get(`${BASE_URL}/api/master/branch`, config),
      axios.get(`${BASE_URL}/api/master/freight-charge-types`, config),
      axios.get(`${BASE_URL}/api/master/freight-types`, config),
      axios.get(`${BASE_URL}/api/master/paper-sizes`, config),
      axios.get(`${BASE_URL}/api/master/printers`, config),
      axios.get(`${BASE_URL}/api/master/rm-iqc`, config),
    ]);

    setBranches(branches.data);
    setCustomers(cust.data);
    setItems(item.data);
    setMachines(mach.data);
    setLocations(loc.data);
    setMaterials(mat.data);
    setActivities(act.data);
    setPriorities(pri.data);
    setTransportations(trans.data);
    setMachineStatuses(status.data);
    setInnerPackings(inner.data);
    setFreightChargeTypes(fcharge.data);
    setFreightTypes(ftype.data);
    setPaperSizes(paperSizesRes.data);
    setPrinters(printersRes.data);
    setInspections(rmIqcRes.data);
  };

  const fetchOrdersByCustomer = async (id) => {
    if (!id) return setOrders([]);
    const res = await axios.get(`${BASE_URL}/api/customer-orders?customerId=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setOrders(res.data);
  };

  const fetchMachineCapacity = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/capacity`);
      const capacityMap = {};
      res.data.forEach((item) => {
        capacityMap[item.machineId] = item.capacityPerHour;
      });
      setMachineCapacity(capacityMap);
    } catch (err) {
      console.error("Error fetching capacity:", err);
    }
  };

  const addCustomer = async () => {
    if (!newCustomer) return;
    await axios.post(
      `${BASE_URL}/api/master/customer`,
      { name: newCustomer },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewCustomer("");
    fetchMasters();
  };

  const addFreightCharge = async () => {
    if (!newFreightCharge.trim()) return;
    await axios.post(
      `${BASE_URL}/api/master/freight-charge-types`,
      { name: newFreightCharge },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewFreightCharge("");
    fetchMasters();
  };

  const addFreightType = async () => {
    if (!newFreightType.trim()) return;
    await axios.post(
      `${BASE_URL}/api/master/freight-types`,
      { name: newFreightType },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewFreightType("");
    fetchMasters();
  };

  const addBranch = async () => {
    if (!newBranch.branchCode) return;
    await axios.post(`${BASE_URL}/api/master/branch`, newBranch, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewBranch({ branchCode: "", dispatchAddress: "" });
    fetchMasters();
  };

  const addPaperSize = async () => {
    if (!newPaperSize.trim()) return;
    await axios.post(
      `${BASE_URL}/api/master/paper-sizes`,
      {
        name: newPaperSize.trim(),
        wastage: Number(newPaperWastage) || 0,
        rate: Number(newPaperRate) || 0,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewPaperSize("");
    setNewPaperWastage("");
    setNewPaperRate("");
    fetchMasters();
  };

  const addPrinter = async () => {
    if (!newPrinter.printerName.trim() || !newPrinter.machineName) return;
    await axios.post(`${BASE_URL}/api/master/printers`, newPrinter, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewPrinter({ printerName: "", machineName: "" });
    fetchMasters();
  };

  const addInnerPacking = async () => {
    if (!newInnerPacking.type) return;
    await axios.post(`${BASE_URL}/api/master/inner-packing`, newInnerPacking, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewInnerPacking({
      type: "",
      leavesPerInner: "",
      innerPack: "",
      outerPack: "",
      innerPerOuter: "",
    });
    fetchMasters();
  };

  const addTransportation = async () => {
    if (!newTransportation.trim()) return;
    await axios.post(
      `${BASE_URL}/api/master/transportations`,
      { name: newTransportation.trim() },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewTransportation("");
    fetchMasters();
  };

  const addItem = async () => {
    if (!newItem.itemCode) return;
    await axios.post(`${BASE_URL}/api/master/items`, newItem, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (newItemPdf) {
      const formData = new FormData();
      formData.append("pdf", newItemPdf);
      await axios.post(
        `${BASE_URL}/api/master/items/${newItem.itemCode}/pdf`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }
      );
    }

    setNewItem({
      itemCode: "",
      customerName: "",
      description: "",
      materialType: "",
      colorFront: "",
      colorBack: "",
      wasteQty: "",
      jobSize: "",
      inkDetails: "",
    });
    setNewItemPdf(null);
    fetchMasters();
  };

  const addPriority = async () => {
    if (!newPriority.trim()) return;
    axios.post(
      `${BASE_URL}/api/master/priorities`,
      { name: newPriority.trim() },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewPriority("");
    fetchMasters();
  };

  const addMachine = async () => {
    const upsArray = parseUpsInput(newMachineUpsText);
    if (!newMachine.machineName || upsArray.length === 0) return;

    const existing = machines.find(
      (m) =>
        m.machineName.trim().toLowerCase() ===
        newMachine.machineName.trim().toLowerCase()
    );

    try {
      if (existing) {
        const mergedUps = Array.from(
          new Set([...(existing.ups || []), ...upsArray])
        );
        await axios.put(
          `${BASE_URL}/api/master/machine/${existing._id}`,
          {
            machineName: existing.machineName,
            ups: mergedUps,
            fixed: existing.fixed,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${BASE_URL}/api/master/machine`,
          { machineName: newMachine.machineName, ups: upsArray, fixed: newMachine.fixed },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (err) {
      console.error("Error saving machine:", err);
      showAlert("Failed to save machine");
      return;
    }

    setNewMachine({ machineName: "", ups: [], fixed: false });
    setNewMachineUpsText("");
    fetchMasters();
  };

  const toggleNewMachineUps = (val) => {
    setNewMachine((prev) => ({
      ...prev,
      ups: prev.ups.includes(val) ? prev.ups.filter((u) => u !== val) : [...prev.ups, val],
    }));
  };

  const toggleEditingMachineUps = (val) => {
    setEditingData((prev) => ({
      ...prev,
      ups: (prev.ups || []).includes(val)
        ? prev.ups.filter((u) => u !== val)
        : [...(prev.ups || []), val],
    }));
  };

  const toggleMachineFixed = async (machine) => {
    try {
      await axios.put(
        `${BASE_URL}/api/master/machine/${machine._id}`,
        {
          machineName: machine.machineName,
          ups: machine.ups,
          fixed: !machine.fixed,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchMasters();
    } catch (err) {
      console.error("Error updating fixed status:", err);
      showAlert("Failed to update Fixed status");
    }
  };

  const parseUpsInput = (str) =>
    str
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number)
      .filter((n) => !isNaN(n));

  const handleActivityMachineChange = (id) => {
    setNewActivity((prev) => ({
      ...prev,
      machines: prev.machines.includes(id)
        ? prev.machines.filter((m) => m !== id)
        : [...prev.machines, id],
    }));
  };

  const addActivity = async () => {
    if (!newActivity.activityName || newActivity.machines.length === 0) return;
    axios.post(`${BASE_URL}/api/master/activities`, newActivity, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewActivity({ activityName: "", machines: [] });
    fetchMasters();
  };

  const addMachineStatus = async () => {
    if (!newMachineStatus.trim()) return;
    const exists = machineStatuses.some(
      (s) => s.statusName.toLowerCase() === newMachineStatus.toLowerCase()
    );
    if (exists) {
      showAlert("Status already exists");
      return;
    }
    axios.post(
      `${BASE_URL}/api/master/machine-status`,
      { statusName: newMachineStatus.trim() },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewMachineStatus("");
    fetchMasters();
  };

  const toggleLocationMachine = (setter, id) =>
    setter((prev) => ({
      ...prev,
      machines: (prev.machines || []).includes(id)
        ? prev.machines.filter((m) => m !== id)
        : [...(prev.machines || []), id],
    }));

  const addLocation = async () => {
    if (!newLocation.locationName || !newLocation.address) return;
    await axios.post(`${BASE_URL}/api/master/location`, newLocation, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewLocation({ locationName: "", address: "", machines: [] });
    fetchMasters();
  };

  const addMaterial = async () => {
    if (!newMaterial.code) return;
    axios.post(`${BASE_URL}/api/master/materials`, newMaterial, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewMaterial({ code: "", description: "", group: "", mill: "", gsm: "", paperSize: "", length: "", width: "" });
    fetchMasters();
  };

  const updateMaster = async (url, id, data) => {
    if (
      (typeof data === "string" && !data.trim()) ||
      (typeof data === "object" && Object.keys(data).length === 0)
    ) {
      showAlert("Value cannot be empty");
      return;
    }

    const payload = typeof data === "string" ? { name: data } : data;

    try {
      axios.put(`${BASE_URL}/api/master/${url}/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEditingId(null);
      setEditingValue("");
      setEditingData({});
      fetchMasters();
    } catch (err) {
      console.error("Update failed:", err.response?.data || err.message);
      showAlert("Update failed: " + (err.response?.data?.message || err.message));
    }
  };

  const deleteMaster = async (url, id) => {
    if (!(await askConfirm("Are you sure you want to delete?"))) return;
    axios.delete(`${BASE_URL}/api/master/${url}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchMasters();
  };

  const getMachineNameById = (id) => {
    const machine = machines.find((m) => m._id === id);
    return machine ? machine.machineName : "Unknown";
  };

  // ==================== FILTERING LOGIC ====================
  const filteredPriorities = priorities.filter((p) =>
    (p.name || "").toLowerCase().includes(priorityFilter.toLowerCase())
  );

  const filteredBranches = branches.filter((b) => {
    const matchCode = (b.branchCode || "").toLowerCase().includes(branchFilter.branchCode.toLowerCase());
    const matchAddress = (b.dispatchAddress || "").toLowerCase().includes(branchFilter.dispatchAddress.toLowerCase());
    return matchCode && matchAddress;
  });

  const filteredInnerPackings = innerPackings.filter((i) => {
    return (
      String(i.type || "").toLowerCase().includes(innerPackingFilter.type.toLowerCase()) &&
      String(i.leavesPerInner || "").toLowerCase().includes(innerPackingFilter.leavesPerInner.toLowerCase()) &&
      String(i.innerPack || "").toLowerCase().includes(innerPackingFilter.innerPack.toLowerCase()) &&
      String(i.outerPack || "").toLowerCase().includes(innerPackingFilter.outerPack.toLowerCase()) &&
      String(i.innerPerOuter || "").toLowerCase().includes(innerPackingFilter.innerPerOuter.toLowerCase())
    );
  });

  const filteredItems = items.filter((item) => {
    const codeSearch = (searchItemCode || itemFilter.itemCode || "").toLowerCase();
    const matchCode = (item.itemCode || "").toLowerCase().includes(codeSearch);
    const matchCustomer = (item.customerName || "").toLowerCase().includes(itemFilter.customerName.toLowerCase());
    const matchDesc = (item.description || "").toLowerCase().includes(itemFilter.description.toLowerCase());
    const matchMat = (item.materialType || "").toLowerCase().includes(itemFilter.materialType.toLowerCase());
    const matchFront = (item.colorFront || "").toLowerCase().includes(itemFilter.colorFront.toLowerCase());
    const matchBack = (item.colorBack || "").toLowerCase().includes(itemFilter.colorBack.toLowerCase());
    const matchWaste = String(item.wasteQty || "").toLowerCase().includes(itemFilter.wasteQty.toLowerCase());
    const matchJob = (item.jobSize || "").toLowerCase().includes(itemFilter.jobSize.toLowerCase());
    const matchInk = (item.inkDetails || "").toLowerCase().includes(itemFilter.inkDetails.toLowerCase());

    return (
      matchCode &&
      matchCustomer &&
      matchDesc &&
      matchMat &&
      matchFront &&
      matchBack &&
      matchWaste &&
      matchJob &&
      matchInk
    );
  });

  const filteredTransportations = transportations.filter((t) =>
    (t.name || "").toLowerCase().includes(transportationFilter.toLowerCase())
  );

  const filteredFreightChargeTypes = freightChargeTypes.filter((f) =>
    (f.name || "").toLowerCase().includes(freightChargeFilter.toLowerCase())
  );

  const filteredFreightTypes = freightTypes.filter((f) =>
    (f.name || "").toLowerCase().includes(freightTypeFilter.toLowerCase())
  );

  const filteredMachineStatuses = machineStatuses.filter((s) =>
    (s.statusName || "").toLowerCase().includes(machineStatusFilter.toLowerCase())
  );

  const filteredPaperSizes = paperSizes.filter((ps) =>
    (ps.name || "").toLowerCase().includes(paperSizeFilter.toLowerCase())
  );

  const filteredPrinters = printers
    .filter((p) =>
      (p.machineName || "").toLowerCase().includes(printerFilter.machineName.toLowerCase())
    )
    .map((p) => {
      if (!printerFilter.printerName.trim()) return p;
      return {
        ...p,
        printerNames: (p.printerNames || []).filter((name) =>
          name.toLowerCase().includes(printerFilter.printerName.toLowerCase())
        ),
      };
    })
    .filter((p) => !printerFilter.printerName.trim() || p.printerNames.length > 0);

  const filteredInspections = inspections
    .map((group) => {
      const matchSlNo = String(group.slNo || "").toLowerCase().includes(iqcFilter.slNo.toLowerCase());
      const matchDesc = (group.description || "").toLowerCase().includes(iqcFilter.description.toLowerCase());
      if (!matchSlNo || !matchDesc) return null;

      const matchedParams = (group.parameters || []).filter((p) => {
        const matchQP = (p.qualityParameter || "").toLowerCase().includes(iqcFilter.qualityParameter.toLowerCase());
        const matchSpec = (p.specification || "").toLowerCase().includes(iqcFilter.specification.toLowerCase());
        const matchUom = (p.uom || "").toLowerCase().includes(iqcFilter.uom.toLowerCase());
        const matchTol = (p.tolerance || "").toLowerCase().includes(iqcFilter.tolerance.toLowerCase());
        return matchQP && matchSpec && matchUom && matchTol;
      });

      if (matchedParams.length === 0) return null;
      return { ...group, parameters: matchedParams };
    })
    .filter(Boolean);

  const filteredMachines = machines.filter((m) => {
    const matchName = (m.machineName || "").toLowerCase().includes(machineFilter.machineName.toLowerCase());
    const upsStr = Array.isArray(m.ups) ? m.ups.join(", ") : String(m.ups || "");
    const matchUps = upsStr.toLowerCase().includes(machineFilter.ups.toLowerCase());
    const matchFixed =
      machineFilter.fixedStatus === "all" ||
      (machineFilter.fixedStatus === "fixed" && m.fixed) ||
      (machineFilter.fixedStatus === "flexible" && !m.fixed);
    return matchName && matchUps && matchFixed;
  });

  const filteredCapacityMachines = machines.filter((m) => {
    const matchName = (m.machineName || "").toLowerCase().includes(capacityFilter.machineName.toLowerCase());
    const capVal = String(machineCapacity[m._id] || "");
    const matchCap = !capacityFilter.capacity || capVal.includes(capacityFilter.capacity);
    return matchName && matchCap;
  });

  const filteredActivities = activities.filter((a) => {
    const matchName = (a.activityName || "").toLowerCase().includes(activityFilter.activityName.toLowerCase());
    if (!activityFilter.machineName.trim()) return matchName;
    const machNames = (a.machines || [])
      .map((m) => (m?.machineName ? m.machineName : machines.find((mach) => mach._id === (m?._id || m))?.machineName))
      .filter(Boolean)
      .join(", ");
    const matchMach = machNames.toLowerCase().includes(activityFilter.machineName.toLowerCase());
    return matchName && matchMach;
  });

  const filteredLocations = locations.filter((l) => {
    const matchName = (l.locationName || "").toLowerCase().includes(locationFilter.locationName.toLowerCase());
    const matchAddress = (l.address || "").toLowerCase().includes(locationFilter.address.toLowerCase());
    return matchName && matchAddress;
  });

  const filteredMaterials = materials.filter((m) => {
    const codeSearch = (searchMaterialCode || materialFilter.code || "").toLowerCase();
    const matchCode = String(m.code || "").toLowerCase().includes(codeSearch);
    const matchDesc = String(m.description || "").toLowerCase().includes(materialFilter.description.toLowerCase());
    const matchGroup = String(m.group || "").toLowerCase().includes(materialFilter.group.toLowerCase());
    const matchMill = String(m.mill || "").toLowerCase().includes(materialFilter.mill.toLowerCase());
    const matchGsm = String(m.gsm || "").toLowerCase().includes(materialFilter.gsm.toLowerCase());
    const matchPaper = String(m.paperSize || "").toLowerCase().includes(materialFilter.paperSize.toLowerCase());
    const matchLength = String(m.length || "").toLowerCase().includes(materialFilter.length.toLowerCase());
    const matchWidth = String(m.width || "").toLowerCase().includes(materialFilter.width.toLowerCase());

    return (
      matchCode &&
      matchDesc &&
      matchGroup &&
      matchMill &&
      matchGsm &&
      matchPaper &&
      matchLength &&
      matchWidth
    );
  });

  return (
    <motion.div
      className="pro-container ad-root"
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <style>{AD_CSS}</style>

      {/* ===================== MESSAGE BOX ===================== */}
      {msgBox && (
        <div
          className="ad-msg-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeMsg(false); }}
        >
          <div className={`ad-msg-box ${msgBox.type}`}>
            <div className="ad-msg-ico">
              {msgBox.type === "success" ? "✓" : msgBox.type === "error" ? "✕" : msgBox.type === "confirm" ? "?" : "!"}
            </div>
            <h3>
              {msgBox.type === "success"
                ? "Success"
                : msgBox.type === "error"
                ? "Something went wrong"
                : msgBox.type === "confirm"
                ? "Are you sure?"
                : "Please check"}
            </h3>
            <p>{msgBox.message}</p>
            <div className="ad-msg-actions">
              {msgBox.kind === "confirm" ? (
                <>
                  <button type="button" className="ad-msg-btn" onClick={() => closeMsg(false)}>Cancel</button>
                  <button type="button" className="ad-msg-btn danger" onClick={() => closeMsg(true)}>Yes, Delete</button>
                </>
              ) : (
                <button type="button" className="ad-msg-btn primary" onClick={() => closeMsg(true)} autoFocus>OK</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="pro-header">
        <div className="ad-brand">
          <div className="ad-emblem">
            <Factory size={22} />
          </div>
          <div>
            <h1>Admin Control Center</h1>
            <p>Manage master data used across the ERP</p>
          </div>
        </div>
        <button className="pro-btn primary" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="admin-section-tabs">
        {masterSections.map(({ id, label, icon: Icon }, idx) => (
          <button
            key={id}
            type="button"
            className={`admin-section-tab ${activeSection === id ? "active" : ""}`}
            onClick={() => openSection(id)}
          >
            <span className={`ad-tab-ico ${TAB_TINTS[idx % TAB_TINTS.length]}`}>
              <Icon size={17} />
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {!activeSection && (
        <div className="ad-hint">👆 Click any card above to open its form</div>
      )}

      {/* ===================== MASTER FORM POPUP ===================== */}
      {activeSection && (() => {
        const meta = masterSections.find((x) => x.id === activeSection);
        const metaIdx = masterSections.findIndex((x) => x.id === activeSection);
        const MetaIcon = meta ? meta.icon : Layers;
        return (
      <div className="ad-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeSection(); }}>
        <div className="ad-modal">

          {/* LEFT: brand panel */}
          <div className="ad-left">
            <div className="ad-left-top">
              <span className="ad-left-label">Admin Control Center</span>
            </div>
            <div className="ad-left-center">
              <div className="ad-left-emblem"><MetaIcon size={34} /></div>
              <h2>{meta ? meta.label : ""}</h2>
              <p>Add, edit and manage these master records</p>
            </div>
            <div className="ad-left-bottom">
              <b>{metaIdx + 1} / {masterSections.length}</b>
              <small>master forms</small>
            </div>
            <span className="ad-planet ad-planet-1"></span>
            <span className="ad-planet ad-planet-2"></span>
          </div>

          {/* RIGHT: the section form + stored records */}
          <div className="ad-right">
            <button type="button" className="ad-close" onClick={closeSection} aria-label="Close">✕</button>

      {/* 1. PRIORITIES */}
      {activeSection === "priorities" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Activity size={18} /> Priorities
            </span>
          </div>

          <div className="pro-form-row">
            <input
              className="pro-input"
              placeholder="Priority Name"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
            />
            <button className="pro-btn primary" onClick={addPriority}>
              <PlusCircle size={16} /> Add
            </button>
          </div>

          <div
            className="material-toggle"
            onClick={() => setShowPriorityList(!showPriorityList)}
          >
            {showPriorityList ? "Hide Priorities ▲" : "Show Priorities ▼"}
          </div>

          {showPriorityList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Priorities
                  </span>
                  {priorityFilter && (
                    <button
                      type="button"
                      onClick={() => setPriorityFilter("")}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <input
                  style={filterInputStyle}
                  placeholder="Filter by Priority Name..."
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                />
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredPriorities.map((p) => (
                    <li key={p._id} className="d-flex justify-content-between align-items-center">
                      {editingId === p._id ? (
                        <>
                          <input
                            className="pro-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <button
                            className="pro-btn primary"
                            onClick={() => updateMaster("priorities", p._id, { name: editingValue })}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{p.name}</span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(p._id);
                                setEditingValue(p.name);
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("priorities", p._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredPriorities.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching priorities found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 2. BRANCH MASTER */}
      {activeSection === "branch" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <MapPin size={18} /> Branch Master
            </span>
          </div>

          <div className="pro-grid">
            <input
              className="pro-input"
              placeholder="Branch Code"
              value={newBranch.branchCode}
              onChange={(e) => setNewBranch({ ...newBranch, branchCode: e.target.value })}
            />
            <textarea
              className="pro-input"
              placeholder="Dispatch Address"
              value={newBranch.dispatchAddress}
              onChange={(e) => setNewBranch({ ...newBranch, dispatchAddress: e.target.value })}
            />
          </div>

          <button className="pro-btn primary" onClick={addBranch}>
            Add Branch
          </button>

          <div className="material-toggle" onClick={() => setShowBranchList(!showBranchList)}>
            {showBranchList ? "Hide Branches ▲" : "Show Branches ▼"}
          </div>

          {showBranchList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Branches
                  </span>
                  {(branchFilter.branchCode || branchFilter.dispatchAddress) && (
                    <button
                      type="button"
                      onClick={() => setBranchFilter({ branchCode: "", dispatchAddress: "" })}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Branch Code..."
                    value={branchFilter.branchCode}
                    onChange={(e) => setBranchFilter({ ...branchFilter, branchCode: e.target.value })}
                  />
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Dispatch Address..."
                    value={branchFilter.dispatchAddress}
                    onChange={(e) => setBranchFilter({ ...branchFilter, dispatchAddress: e.target.value })}
                  />
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredBranches.map((b) => (
                    <li key={b._id} className="d-flex justify-content-between align-items-center">
                      {editingId === b._id ? (
                        <>
                          <div className="pro-grid">
                            <input
                              className="pro-input"
                              value={editingData.branchCode || ""}
                              onChange={(e) =>
                                setEditingData({ ...editingData, branchCode: e.target.value })
                              }
                            />
                            <textarea
                              className="pro-input"
                              value={editingData.dispatchAddress || ""}
                              onChange={(e) =>
                                setEditingData({ ...editingData, dispatchAddress: e.target.value })
                              }
                            />
                          </div>
                          <button
                            className="pro-btn primary"
                            onClick={() => updateMaster("branch", b._id, editingData)}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            <strong>{b.branchCode}</strong> • {b.dispatchAddress}
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(b._id);
                                setEditingData({
                                  branchCode: b.branchCode,
                                  dispatchAddress: b.dispatchAddress,
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("branch", b._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredBranches.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching branches found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 3. INNER PACKING */}
      {activeSection === "innerPacking" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Package size={18} /> Inner Packing
            </span>
          </div>

          <div className="pro-grid">
            {[
              ["type", "Type"],
              ["leavesPerInner", "Leaves Per Inner"],
              ["innerPack", "Inner Pack"],
              ["outerPack", "Outer Pack"],
              ["innerPerOuter", "Inner Per Outer"],
            ].map(([key, placeholder]) => (
              <input
                key={key}
                className="pro-input"
                placeholder={placeholder}
                value={newInnerPacking[key]}
                onChange={(e) => setNewInnerPacking({ ...newInnerPacking, [key]: e.target.value })}
              />
            ))}
          </div>

          <button className="pro-btn primary" onClick={addInnerPacking}>
            Add Inner Packing
          </button>

          <div
            className="material-toggle"
            onClick={() => setShowInnerPackingList(!showInnerPackingList)}
          >
            {showInnerPackingList ? "Hide Inner Packing ▲" : "Show Inner Packing ▼"}
          </div>

          {showInnerPackingList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Inner Packing
                  </span>
                  {Object.values(innerPackingFilter).some((v) => v) && (
                    <button
                      type="button"
                      onClick={() =>
                        setInnerPackingFilter({
                          type: "",
                          leavesPerInner: "",
                          innerPack: "",
                          outerPack: "",
                          innerPerOuter: "",
                        })
                      }
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  {[
                    ["type", "Filter Type..."],
                    ["leavesPerInner", "Filter Leaves/Inner..."],
                    ["innerPack", "Filter Inner Pack..."],
                    ["outerPack", "Filter Outer Pack..."],
                    ["innerPerOuter", "Filter Inner/Outer..."],
                  ].map(([key, placeholder]) => (
                    <input
                      key={key}
                      style={filterInputStyle}
                      placeholder={placeholder}
                      value={innerPackingFilter[key]}
                      onChange={(e) =>
                        setInnerPackingFilter({ ...innerPackingFilter, [key]: e.target.value })
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredInnerPackings.map((i) => (
                    <li key={i._id} className="d-flex justify-content-between align-items-center">
                      {editingId === i._id ? (
                        <>
                          <div className="pro-grid">
                            {["type", "leavesPerInner", "innerPack", "outerPack", "innerPerOuter"].map(
                              (key) => (
                                <input
                                  key={key}
                                  className="pro-input"
                                  value={editingData[key] || ""}
                                  onChange={(e) =>
                                    setEditingData({ ...editingData, [key]: e.target.value })
                                  }
                                />
                              )
                            )}
                          </div>
                          <button
                            className="pro-btn primary"
                            onClick={() => updateMaster("inner-packing", i._id, editingData)}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            <strong>{i.type}</strong> • {i.leavesPerInner} • {i.innerPack} •{" "}
                            {i.outerPack} • {i.innerPerOuter}
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(i._id);
                                setEditingData({
                                  type: i.type,
                                  leavesPerInner: i.leavesPerInner,
                                  innerPack: i.innerPack,
                                  outerPack: i.outerPack,
                                  innerPerOuter: i.innerPerOuter,
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="pro-btn"
                              onClick={() => deleteMaster("inner-packing", i._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredInnerPackings.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching inner packing records found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 4. ITEMS */}
      {activeSection === "items" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Package size={18} /> Items
            </span>
          </div>

          <div className="pro-grid">
            {[
              ["itemCode", "Item Code (SFG Code)"],
              ["customerName", "Customer Name"],
              ["description", "Description"],
              ["materialType", "Material Type"],
              ["colorFront", "Front Colors"],
              ["colorBack", "Back Colors"],
              ["wasteQty", "Waste Quantity"],
              ["jobSize", "Job Size"],
              ["inkDetails", "Ink Details"],
            ].map(([key, placeholder]) => (
              <input
                key={key}
                className="pro-input"
                placeholder={placeholder}
                value={newItem[key]}
                onChange={(e) => setNewItem({ ...newItem, [key]: e.target.value })}
              />
            ))}
          </div>

          {/* Attach PDF + Add Item + Upload Excel on one line */}
          <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label className="pro-btn" style={{ cursor: "pointer", display: "inline-block" }}>
              {newItemPdf ? `📄 ${newItemPdf.name}` : "Attach PDF (optional)"}
              <input
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                onChange={(e) => setNewItemPdf(e.target.files[0] || null)}
              />
            </label>

            <button className="pro-btn primary" onClick={addItem}>
              Add Item
            </button>

            <label style={uploadLabelStyle}>
              📥 Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setUploadingItems(true);
                  setUploadResult(null);
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await axios.post(
                      `${BASE_URL}/api/master/items/bulk-upload`,
                      formData,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "multipart/form-data",
                        },
                      }
                    );
                    setUploadResult(res.data);
                    fetchMasters();
                  } catch (err) {
                    setUploadResult({ error: err.response?.data?.message || "Upload failed" });
                  } finally {
                    setUploadingItems(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {uploadingItems && <span style={{ fontSize: "13px", color: "#08406b" }}>Uploading...</span>}
          </div>

          {uploadResult && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                marginBottom: "10px",
                background: uploadResult.error ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${uploadResult.error ? "#fca5a5" : "#86efac"}`,
                fontSize: "13px",
                color: uploadResult.error ? "#dc2626" : "#16a34a",
              }}
            >
              {uploadResult.error
                ? `❌ ${uploadResult.error}`
                : `✅ Inserted: ${uploadResult.inserted} | Skipped (duplicates): ${uploadResult.skipped}${
                    uploadResult.errors?.length ? ` | Errors: ${uploadResult.errors.length}` : ""
                  }`}
            </div>
          )}

          <div className="material-toggle" onClick={() => setShowItemList(!showItemList)}>
            {showItemList ? "Hide Stored Items ▲" : "Show Stored Items ▼"}
          </div>

          {showItemList && (
            <>
              {/* Field-by-Field Filters for Items */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Items by Respective Fields
                  </span>
                  {(searchItemCode || Object.values(itemFilter).some((v) => v)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchItemCode("");
                        setItemFilter({
                          itemCode: "",
                          customerName: "",
                          description: "",
                          materialType: "",
                          colorFront: "",
                          colorBack: "",
                          wasteQty: "",
                          jobSize: "",
                          inkDetails: "",
                        });
                      }}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear Filters
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  {[
                    ["itemCode", "Item Code..."],
                    ["customerName", "Customer Name..."],
                    ["description", "Description..."],
                    ["materialType", "Material Type..."],
                    ["jobSize", "Job Size..."],
                    ["colorFront", "Front Colors..."],
                    ["colorBack", "Back Colors..."],
                    ["wasteQty", "Waste Qty..."],
                    ["inkDetails", "Ink Details..."],
                  ].map(([key, placeholder]) => (
                    <input
                      key={key}
                      style={filterInputStyle}
                      placeholder={placeholder}
                      value={key === "itemCode" ? (searchItemCode || itemFilter.itemCode) : itemFilter[key]}
                      onChange={(e) => {
                        if (key === "itemCode") {
                          setSearchItemCode(e.target.value);
                        }
                        setItemFilter({ ...itemFilter, [key]: e.target.value });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredItems.map((i) => (
                    <li key={i._id} className="d-flex justify-content-between align-items-center">
                      {editingId === i._id ? (
                        <>
                          <div className="pro-grid">
                            {[
                              "itemCode",
                              "customerName",
                              "description",
                              "materialType",
                              "colorFront",
                              "colorBack",
                              "wasteQty",
                              "jobSize",
                              "inkDetails",
                            ].map((key) => (
                              <input
                                key={key}
                                className="pro-input"
                                value={editingData[key] || ""}
                                onChange={(e) =>
                                  setEditingData({ ...editingData, [key]: e.target.value })
                                }
                              />
                            ))}
                          </div>
                          <button
                            className="pro-btn primary"
                            onClick={() => updateMaster("items", i._id, editingData)}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            <strong>{i.itemCode}</strong> • {i.customerName} • {i.description} •{" "}
                            {i.materialType} • {i.colorFront} • {i.colorBack} • {i.wasteQty} •{" "}
                            {i.jobSize}
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            {i.pdfPath && (
                              <a
                                href={`${BASE_URL}${i.pdfPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="pro-btn"
                              >
                                View PDF
                              </a>
                            )}
                            <label className="pro-btn" style={{ cursor: "pointer" }}>
                              Upload PDF
                              <input
                                type="file"
                                accept=".pdf"
                                style={{ display: "none" }}
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const formData = new FormData();
                                  formData.append("pdf", file);
                                  await axios.post(
                                    `${BASE_URL}/api/master/items/${i.itemCode}/pdf`,
                                    formData,
                                    {
                                      headers: {
                                        Authorization: `Bearer ${token}`,
                                        "Content-Type": "multipart/form-data",
                                      },
                                    }
                                  );
                                  fetchMasters();
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(i._id);
                                setEditingData({
                                  itemCode: i.itemCode,
                                  customerName: i.customerName,
                                  description: i.description,
                                  materialType: i.materialType,
                                  colorFront: i.colorFront,
                                  colorBack: i.colorBack,
                                  wasteQty: i.wasteQty,
                                  jobSize: i.jobSize,
                                  inkDetails: i.inkDetails,
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("items", i._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredItems.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching items found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 5. TRANSPORTATION */}
      {activeSection === "transportation" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Factory size={18} /> Transportation
            </span>
          </div>

          <div className="pro-form-row">
            <input
              className="pro-input"
              placeholder="Transportation Name"
              value={newTransportation}
              onChange={(e) => setNewTransportation(e.target.value)}
            />
            <button className="pro-btn primary" onClick={addTransportation}>
              <PlusCircle size={16} /> Add
            </button>
          </div>

          <div
            className="material-toggle"
            onClick={() => setShowTransportationList(!showTransportationList)}
          >
            {showTransportationList
              ? "Hide Stored Transportations ▲"
              : "Show Stored Transportations ▼"}
          </div>

          {showTransportationList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Transportation
                  </span>
                  {transportationFilter && (
                    <button
                      type="button"
                      onClick={() => setTransportationFilter("")}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <input
                  style={filterInputStyle}
                  placeholder="Filter by Transportation Name..."
                  value={transportationFilter}
                  onChange={(e) => setTransportationFilter(e.target.value)}
                />
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredTransportations.map((t) => (
                    <li key={t._id} className="d-flex justify-content-between align-items-center">
                      {editingId === t._id ? (
                        <>
                          <input
                            className="pro-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <button
                            className="pro-btn primary"
                            onClick={() =>
                              updateMaster("transportations", t._id, { name: editingValue })
                            }
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{t.name}</span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(t._id);
                                setEditingValue(t.name);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="pro-btn"
                              onClick={() => deleteMaster("transportations", t._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredTransportations.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching transportation records found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 6. FREIGHT CHARGE TYPE */}
      {activeSection === "freightCharge" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Layers size={18} /> Freight Charge Type
            </span>
          </div>

          <div className="pro-form-row">
            <input
              className="pro-input"
              placeholder="Freight Charge Type"
              value={newFreightCharge}
              onChange={(e) => setNewFreightCharge(e.target.value)}
            />
            <button className="pro-btn primary" onClick={addFreightCharge}>
              Add
            </button>
          </div>

          <div
            className="material-toggle"
            onClick={() => setShowFreightChargeList(!showFreightChargeList)}
          >
            {showFreightChargeList ? "Hide ▲" : "Show ▼"}
          </div>

          {showFreightChargeList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Freight Charge Types
                  </span>
                  {freightChargeFilter && (
                    <button
                      type="button"
                      onClick={() => setFreightChargeFilter("")}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <input
                  style={filterInputStyle}
                  placeholder="Filter by Freight Charge Type..."
                  value={freightChargeFilter}
                  onChange={(e) => setFreightChargeFilter(e.target.value)}
                />
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredFreightChargeTypes.map((f) => (
                    <li key={f._id} className="d-flex justify-content-between align-items-center">
                      {editingId === f._id ? (
                        <>
                          <input
                            className="pro-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <button
                            className="pro-btn primary"
                            onClick={() =>
                              updateMaster("freight-charge-types", f._id, { name: editingValue })
                            }
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{f.name}</span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(f._id);
                                setEditingValue(f.name);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="pro-btn"
                              onClick={() => deleteMaster("freight-charge-types", f._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredFreightChargeTypes.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching freight charge types found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 7. FREIGHT TYPE */}
      {activeSection === "freightType" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Layers size={18} /> Freight Type
            </span>
          </div>

          <div className="pro-form-row">
            <input
              className="pro-input"
              placeholder="Freight Type"
              value={newFreightType}
              onChange={(e) => setNewFreightType(e.target.value)}
            />
            <button className="pro-btn primary" onClick={addFreightType}>
              Add
            </button>
          </div>

          <div
            className="material-toggle"
            onClick={() => setShowFreightTypeList(!showFreightTypeList)}
          >
            {showFreightTypeList ? "Hide ▲" : "Show ▼"}
          </div>

          {showFreightTypeList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Freight Types
                  </span>
                  {freightTypeFilter && (
                    <button
                      type="button"
                      onClick={() => setFreightTypeFilter("")}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <input
                  style={filterInputStyle}
                  placeholder="Filter by Freight Type..."
                  value={freightTypeFilter}
                  onChange={(e) => setFreightTypeFilter(e.target.value)}
                />
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredFreightTypes.map((f) => (
                    <li key={f._id} className="d-flex justify-content-between align-items-center">
                      {editingId === f._id ? (
                        <>
                          <input
                            className="pro-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <button
                            className="pro-btn primary"
                            onClick={() =>
                              updateMaster("freight-types", f._id, { name: editingValue })
                            }
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{f.name}</span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(f._id);
                                setEditingValue(f.name);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="pro-btn"
                              onClick={() => deleteMaster("freight-types", f._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredFreightTypes.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching freight types found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 8. MACHINE STATUS */}
      {activeSection === "machineStatus" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Activity size={18} /> Machine Status
            </span>
          </div>

          <div className="pro-form-row">
            <input
              className="pro-input"
              placeholder="Machine Status"
              value={newMachineStatus}
              onChange={(e) => setNewMachineStatus(e.target.value)}
            />
            <button className="pro-btn primary" onClick={addMachineStatus}>
              <PlusCircle size={16} /> Add
            </button>
          </div>

          <div
            className="material-toggle"
            onClick={() => setShowMachineStatusList(!showMachineStatusList)}
          >
            {showMachineStatusList ? "Hide Machine Status ▲" : "Show Machine Status ▼"}
          </div>

          {showMachineStatusList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Machine Statuses
                  </span>
                  {machineStatusFilter && (
                    <button
                      type="button"
                      onClick={() => setMachineStatusFilter("")}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <input
                  style={filterInputStyle}
                  placeholder="Filter by Status Name..."
                  value={machineStatusFilter}
                  onChange={(e) => setMachineStatusFilter(e.target.value)}
                />
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredMachineStatuses.map((s) => (
                    <li key={s._id} className="d-flex justify-content-between align-items-center">
                      {editingId === s._id ? (
                        <>
                          <input
                            className="pro-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <button
                            className="pro-btn primary"
                            onClick={() =>
                              updateMaster("machine-status", s._id, { statusName: editingValue })
                            }
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{s.statusName}</span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(s._id);
                                setEditingValue(s.statusName);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="pro-btn"
                              onClick={() => deleteMaster("machine-status", s._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredMachineStatuses.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching machine statuses found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 9. PAPER SIZE */}
      {activeSection === "paperSize" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Layers size={18} /> Paper Size
            </span>
          </div>
          <div className="pro-form-row">
            <input
              className="pro-input"
              placeholder="Paper Size (e.g. A4, A3)"
              value={newPaperSize}
              onChange={(e) => setNewPaperSize(e.target.value)}
            />
            <input
              className="pro-input"
              type="number"
              placeholder="Wastage"
              value={newPaperWastage}
              onChange={(e) => setNewPaperWastage(e.target.value)}
            />
            <input
              className="pro-input"
              type="number"
              placeholder="Rate"
              value={newPaperRate}
              onChange={(e) => setNewPaperRate(e.target.value)}
            />
            <button className="pro-btn primary" onClick={addPaperSize}>
              <PlusCircle size={16} /> Add
            </button>
          </div>
          <div className="material-toggle" onClick={() => setShowPaperSizeList(!showPaperSizeList)}>
            {showPaperSizeList ? "Hide Paper Sizes ▲" : "Show Paper Sizes ▼"}
          </div>

          {showPaperSizeList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Paper Sizes
                  </span>
                  {paperSizeFilter && (
                    <button
                      type="button"
                      onClick={() => setPaperSizeFilter("")}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <input
                  style={filterInputStyle}
                  placeholder="Filter by Paper Size (e.g. A4, A3)..."
                  value={paperSizeFilter}
                  onChange={(e) => setPaperSizeFilter(e.target.value)}
                />
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredPaperSizes.map((ps) => (
                    <li key={ps._id} className="d-flex justify-content-between align-items-center">
                      {editingId === ps._id ? (
                        <>
                          <input
                            className="pro-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                          />
                          <input
                            className="pro-input"
                            type="number"
                            placeholder="Wastage"
                            value={editingData.wastage ?? ""}
                            onChange={(e) => setEditingData({ ...editingData, wastage: e.target.value })}
                          />
                          <input
                            className="pro-input"
                            type="number"
                            placeholder="Rate"
                            value={editingData.rate ?? ""}
                            onChange={(e) => setEditingData({ ...editingData, rate: e.target.value })}
                          />
                          <button
                            className="pro-btn primary"
                            onClick={() =>
                              updateMaster("paper-sizes", ps._id, {
                                name: editingValue,
                                wastage: Number(editingData.wastage) || 0,
                                rate: Number(editingData.rate) || 0,
                              })
                            }
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            <strong>{ps.name}</strong> • Wastage: {ps.wastage ?? 0} • Rate: {ps.rate ?? 0}
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(ps._id);
                                setEditingValue(ps.name);
                                setEditingData({ wastage: ps.wastage ?? 0, rate: ps.rate ?? 0 });
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("paper-sizes", ps._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredPaperSizes.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching paper sizes found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 10. PRINTER MASTER */}
      {activeSection === "printerName" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Factory size={18} /> Printer Master
            </span>
          </div>

          <div className="pro-grid">
            <select
              className="pro-input"
              value={newPrinter.machineName}
              onChange={(e) => setNewPrinter({ ...newPrinter, machineName: e.target.value })}
            >
              <option value="">Select Machine</option>
              {machines.map((m) => (
                <option key={m._id} value={m.machineName}>
                  {m.machineName}
                </option>
              ))}
            </select>
            <input
              className="pro-input"
              placeholder="Printer Name"
              value={newPrinter.printerName}
              onChange={(e) => setNewPrinter({ ...newPrinter, printerName: e.target.value })}
            />
            <button className="pro-btn primary" onClick={addPrinter}>
              <PlusCircle size={16} /> Add Printer
            </button>
          </div>

          <div className="material-toggle" onClick={() => setShowPrinterList(!showPrinterList)}>
            {showPrinterList ? "Hide Printers ▲" : "Show Printers ▼"}
          </div>

          {showPrinterList && (
            <>
              {/* Field Filter */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Printers
                  </span>
                  {(printerFilter.machineName || printerFilter.printerName) && (
                    <button
                      type="button"
                      onClick={() => setPrinterFilter({ machineName: "", printerName: "" })}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Machine Name..."
                    value={printerFilter.machineName}
                    onChange={(e) => setPrinterFilter({ ...printerFilter, machineName: e.target.value })}
                  />
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Printer Name..."
                    value={printerFilter.printerName}
                    onChange={(e) => setPrinterFilter({ ...printerFilter, printerName: e.target.value })}
                  />
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredPrinters.map((p) => (
                    <li key={p._id}>
                      <div style={{ fontWeight: 800, color: "#0a4f8c", marginBottom: "8px" }}>
                        {p.machineName}
                      </div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {p.printerNames.map((name, idx) => (
                          <li
                            key={idx}
                            className="d-flex justify-content-between align-items-center"
                            style={{ marginBottom: "6px" }}
                          >
                            {editingId === `${p._id}_${idx}` ? (
                              <>
                                <input
                                  className="pro-input"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                />
                                <div style={{ display: "flex", gap: "8px", marginLeft: "8px" }}>
                                  <button
                                    className="pro-btn primary"
                                    onClick={async () => {
                                      await axios.put(
                                        `${BASE_URL}/api/master/printers/${p.machineName}/${name}`,
                                        { newName: editingValue },
                                        { headers: { Authorization: `Bearer ${token}` } }
                                      );
                                      setEditingId(null);
                                      setEditingValue("");
                                      fetchMasters();
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="pro-btn"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditingValue("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span>{name}</span>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    className="pro-btn"
                                    onClick={() => {
                                      setEditingId(`${p._id}_${idx}`);
                                      setEditingValue(name);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="pro-btn"
                                    onClick={async () => {
                                      if (!(await askConfirm(`Delete "${name}" from ${p.machineName}?`)))
                                        return;
                                      await axios.delete(
                                        `${BASE_URL}/api/master/printers/${p.machineName}/${name}`,
                                        { headers: { Authorization: `Bearer ${token}` } }
                                      );
                                      fetchMasters();
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                        {p.printerNames.length === 0 && (
                          <li style={{ color: "#8fb0c8", fontSize: "0.85rem" }}>No matching printers</li>
                        )}
                      </ul>
                    </li>
                  ))}
                  {filteredPrinters.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching printers found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 11. RM-IQC TESTING SPECIFICATIONS */}
      {activeSection === "inspection" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Layers size={18} /> RM-IQC Testing Specifications
            </span>
          </div>

          <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label style={uploadLabelStyle}>
              📥 Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setUploadingInspections(true);
                  setInspectionUploadResult(null);
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await axios.post(
                      `${BASE_URL}/api/master/rm-iqc/bulk-upload`,
                      formData,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "multipart/form-data",
                        },
                      }
                    );
                    setInspectionUploadResult(res.data);
                    fetchMasters();
                  } catch (err) {
                    setInspectionUploadResult({ error: err.response?.data?.message || "Upload failed" });
                  } finally {
                    setUploadingInspections(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {uploadingInspections && <span style={{ fontSize: "13px", color: "#08406b" }}>Uploading...</span>}
          </div>

          {inspectionUploadResult && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                marginBottom: "10px",
                background: inspectionUploadResult.error ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${inspectionUploadResult.error ? "#fca5a5" : "#86efac"}`,
                fontSize: "13px",
                color: inspectionUploadResult.error ? "#dc2626" : "#16a34a",
              }}
            >
              {inspectionUploadResult.error
                ? `❌ ${inspectionUploadResult.error}`
                : `✅ Inserted: ${inspectionUploadResult.inserted} | Skipped (duplicates): ${
                    inspectionUploadResult.skipped
                  }${inspectionUploadResult.errors?.length ? ` | Errors: ${inspectionUploadResult.errors.length}` : ""}`}
            </div>
          )}

          <div className="material-toggle" onClick={() => setShowInspectionList(!showInspectionList)}>
            {showInspectionList ? "Hide Specs ▲" : "Show Specs ▼"}
          </div>

          {showInspectionList && (
            <>
              {/* Field-by-Field Filters for RM-IQC */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter RM-IQC Specifications
                  </span>
                  {Object.values(iqcFilter).some((v) => v) && (
                    <button
                      type="button"
                      onClick={() =>
                        setIqcFilter({
                          slNo: "",
                          description: "",
                          qualityParameter: "",
                          specification: "",
                          uom: "",
                          tolerance: "",
                        })
                      }
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  {[
                    ["slNo", "Filter Sl. No..."],
                    ["description", "Filter Description..."],
                    ["qualityParameter", "Filter Quality Param..."],
                    ["specification", "Filter Specification..."],
                    ["uom", "Filter UOM..."],
                    ["tolerance", "Filter Tolerance..."],
                  ].map(([key, placeholder]) => (
                    <input
                      key={key}
                      style={filterInputStyle}
                      placeholder={placeholder}
                      value={iqcFilter[key]}
                      onChange={(e) => setIqcFilter({ ...iqcFilter, [key]: e.target.value })}
                    />
                  ))}
                </div>
              </div>

              {/* Scrollable Table Records with Sticky Header */}
              <div style={tableScrollContainerStyle}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={stickyThStyle}>Sl. No</th>
                      <th style={stickyThStyle}>Description</th>
                      <th style={stickyThStyle}>Quality Parameter</th>
                      <th style={stickyThStyle}>Specification</th>
                      <th style={stickyThStyle}>UOM</th>
                      <th style={stickyThStyle}>Tol.</th>
                      <th style={stickyThStyle}>Action</th>
                    </tr>
                  </thead>
                  {filteredInspections.map((group) => (
                    <tbody key={group._id}>
                      {group.parameters.map((p, idx) => (
                        <tr key={idx}>
                          {idx === 0 && (
                            <>
                              <td style={tdStyle} rowSpan={group.parameters.length}>
                                {group.slNo}
                              </td>
                              <td style={tdStyle} rowSpan={group.parameters.length}>
                                {group.description}
                              </td>
                            </>
                          )}
                          <td style={tdStyle}>{p.qualityParameter}</td>
                          <td style={tdStyle}>{p.specification}</td>
                          <td style={tdStyle}>{p.uom}</td>
                          <td style={tdStyle}>{p.tolerance}</td>
                          {idx === 0 && (
                            <td style={tdStyle} rowSpan={group.parameters.length}>
                              <button className="pro-btn" onClick={() => deleteMaster("rm-iqc", group._id)}>
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  ))}
                  {filteredInspections.length === 0 && (
                    <tbody>
                      <tr>
                        <td colSpan={7} style={{ padding: "14px", textAlign: "center", color: "#4a6f8c" }}>
                          No matching inspection specifications found
                        </td>
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>
            </>
          )}
        </motion.div>
      )}
    
          {/* GST MASTER */}
      {activeSection === "gstMaster" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Layers size={18} /> GST Master
            </span>
          </div>

          <div className="activity-builder">
            <div className="activity-name-field">
              <label>Machine</label>
              <select
                className="pro-input"
                value={newGst.machineId}
                onChange={(e) => setNewGst({ ...newGst, machineId: e.target.value })}
              >
                <option value="">Select Machine</option>
                {machines.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.machineName}
                  </option>
                ))}
              </select>
            </div>

            {renderTaxPicker(
              newGst.taxes,
              (name) => setNewGst((prev) => ({ ...prev, taxes: toggleTaxType(prev.taxes, name) })),
              (name, val) => setNewGst((prev) => ({ ...prev, taxes: { ...prev.taxes, [name]: val } }))
            )}
          </div>

          <button className="pro-btn primary" onClick={addGst}>
            Add GST
          </button>

          <div className="material-toggle" onClick={() => setShowGstList(!showGstList)}>
            {showGstList ? "Hide Stored GST ▲" : "Show Stored GST ▼"}
          </div>

          {showGstList && (
            <div style={scrollContainerStyle}>
              <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                {gstTaxes.map((g) => (
                  <li key={g._id} className="d-flex justify-content-between align-items-center">
                    {editingId === g._id ? (
                      <>
                        <div className="activity-builder edit-mode">
                          <div className="activity-name-field">
                            <label>Machine</label>
                            <strong>{g.machineName}</strong>
                          </div>
                          {renderTaxPicker(
                            editingData.taxes || {},
                            (name) =>
                              setEditingData((prev) => ({ ...prev, taxes: toggleTaxType(prev.taxes || {}, name) })),
                            (name, val) =>
                              setEditingData((prev) => ({ ...prev, taxes: { ...(prev.taxes || {}), [name]: val } }))
                          )}
                        </div>
                        <button className="pro-btn primary" onClick={() => saveGst(g._id)}>
                          Save
                        </button>
                        <button
                          className="pro-btn"
                          onClick={() => {
                            setEditingId(null);
                            setEditingData({});
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span>
                          <strong>{g.machineName}</strong> •{" "}
                          {(g.taxes || []).map((t) => `${t.name} ${t.rate}%`).join(" • ") || "-"}
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="pro-btn"
                            onClick={() => {
                              setEditingId(g._id);
                              setEditingData({
                                taxes: Object.fromEntries((g.taxes || []).map((t) => [t.name, t.rate])),
                              });
                            }}
                          >
                            Edit
                          </button>
                          <button className="pro-btn" onClick={() => deleteGst(g._id)}>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
                {gstTaxes.length === 0 && (
                  <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                    No GST records found
                  </li>
                )}
              </ul>
            </div>
          )}
        </motion.div>
      )}
      {/* 12. MACHINES */}
      {activeSection === "machines" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Factory size={18} /> Machines
            </span>
          </div>

          <input
            className="pro-input"
            style={{ marginBottom: "10px" }}
            value={newMachine.machineName}
            onChange={(e) => setNewMachine({ ...newMachine, machineName: e.target.value })}
            placeholder="Machine name"
          />

          <input
            className="pro-input"
            style={{ marginBottom: "10px" }}
            placeholder="Enter UPS values, comma separated (e.g. 1,2,4,8)"
            value={newMachineUpsText}
            onChange={(e) => setNewMachineUpsText(e.target.value)}
          />

          <div className="pro-form-row">
            <label style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
              <input
                type="checkbox"
                checked={newMachine.fixed}
                onChange={(e) => setNewMachine({ ...newMachine, fixed: e.target.checked })}
              />
              Fixed
            </label>
            <button className="pro-btn primary" onClick={addMachine}>
              <PlusCircle size={16} /> Add
            </button>
          </div>

          <div className="material-toggle" onClick={() => setShowMachineList(!showMachineList)}>
            {showMachineList ? "Hide Machines ▲" : "Show Machines ▼"}
          </div>

          {showMachineList && (
            <>
              {/* Field Filter for Machines */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Machines
                  </span>
                  {(machineFilter.machineName || machineFilter.ups || machineFilter.fixedStatus !== "all") && (
                    <button
                      type="button"
                      onClick={() => setMachineFilter({ machineName: "", ups: "", fixedStatus: "all" })}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Machine Name..."
                    value={machineFilter.machineName}
                    onChange={(e) => setMachineFilter({ ...machineFilter, machineName: e.target.value })}
                  />
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by UPS (e.g. 1, 2)..."
                    value={machineFilter.ups}
                    onChange={(e) => setMachineFilter({ ...machineFilter, ups: e.target.value })}
                  />
                  <select
                    style={filterInputStyle}
                    value={machineFilter.fixedStatus}
                    onChange={(e) => setMachineFilter({ ...machineFilter, fixedStatus: e.target.value })}
                  >
                    <option value="all">All Types (Fixed & Flexible)</option>
                    <option value="fixed">Fixed Only</option>
                    <option value="flexible">Flexible Only</option>
                  </select>
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredMachines.map((m) => (
                    <li key={m._id} className="d-flex justify-content-between align-items-center">
                      {editingId === m._id ? (
                        <>
                          <input
                            className="pro-input"
                            value={editingData.machineName || ""}
                            onChange={(e) => setEditingData({ ...editingData, machineName: e.target.value })}
                          />
                          <input
                            className="pro-input"
                            placeholder="Enter UPS values, comma separated (e.g. 1,2,4,8)"
                            value={editingUpsText}
                            onChange={(e) => setEditingUpsText(e.target.value)}
                          />
                          <button
                            className="pro-btn primary"
                            onClick={() =>
                              updateMaster("machine", m._id, {
                                ...editingData,
                                ups: parseUpsInput(editingUpsText),
                              })
                            }
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            {m.machineName} • UPS: {Array.isArray(m.ups) && m.ups.length ? m.ups.join(", ") : "-"}
                            {" • "}
                            <strong style={{ color: m.fixed ? "#16a34a" : "#8a5a00" }}>
                              {m.fixed ? "Fixed" : "Flexible"}
                            </strong>
                          </span>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                              <input
                                type="checkbox"
                                checked={!!m.fixed}
                                onChange={() => toggleMachineFixed(m)}
                              />
                              Fixed
                            </label>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(m._id);
                                setEditingData({
                                  machineName: m.machineName,
                                  ups: Array.isArray(m.ups) ? m.ups : [],
                                  fixed: m.fixed || false,
                                });
                                setEditingUpsText(Array.isArray(m.ups) ? m.ups.join(",") : "");
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("machine", m._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredMachines.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching machines found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 13. MACHINE CAPACITY */}
      {activeSection === "machineCapacity" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Factory size={18} /> Machine Capacity
            </span>
          </div>

          <div
            className="material-toggle"
            onClick={() => setShowMachineCapacity(!showMachineCapacity)}
          >
            {showMachineCapacity ? "Hide Machine Capacity ▲" : "Show Machine Capacity ▼"}
          </div>

          {showMachineCapacity && (
            <>
              {/* Field Filter for Machine Capacity */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Machine Capacities
                  </span>
                  {(capacityFilter.machineName || capacityFilter.capacity) && (
                    <button
                      type="button"
                      onClick={() => setCapacityFilter({ machineName: "", capacity: "" })}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Machine Name..."
                    value={capacityFilter.machineName}
                    onChange={(e) => setCapacityFilter({ ...capacityFilter, machineName: e.target.value })}
                  />
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Capacity (/hr)..."
                    value={capacityFilter.capacity}
                    onChange={(e) => setCapacityFilter({ ...capacityFilter, capacity: e.target.value })}
                  />
                </div>
              </div>

              {/* Scrollable Table Records with Sticky Header */}
              <div style={tableScrollContainerStyle}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={stickyThStyle}>Machine Name</th>
                      <th style={stickyThStyle}>Stored Capacity</th>
                      <th style={stickyThStyle}>Edit Capacity</th>
                      <th style={stickyThStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCapacityMachines.map((m) => (
                      <tr key={m._id}>
                        <td style={tdStyle}>{m.machineName}</td>
                        <td style={tdStyle}>
                          {machineCapacity[m._id] ? (
                            <span style={{ color: "#0a4f8c", fontWeight: "700" }}>
                              {machineCapacity[m._id]} /hr
                            </span>
                          ) : (
                            <span style={{ color: "#8fb0c8" }}>Not set</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number"
                            placeholder="Enter capacity"
                            value={machineCapacity[m._id] || ""}
                            onChange={(e) =>
                              setMachineCapacity({
                                ...machineCapacity,
                                [m._id]: e.target.value,
                              })
                            }
                            style={inputStyle}
                          />
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={async () => {
                              try {
                                await axios.post(`${BASE_URL}/api/capacity`, {
                                  machineId: m._id,
                                  capacityPerHour: machineCapacity[m._id],
                                });
                                fetchMachineCapacity();
                                showAlert("Capacity saved successfully");
                              } catch (err) {
                                console.error(err);
                                showAlert("Error saving capacity");
                              }
                            }}
                            style={btnStyle}
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredCapacityMachines.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: "14px", textAlign: "center", color: "#4a6f8c" }}>
                          No matching machines found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 14. ACTIVITIES */}
      {activeSection === "activities" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Activity size={18} /> Activities
            </span>
          </div>

          <div className="activity-builder">
            <div className="activity-name-field">
              <label>Activity Name</label>
              <input
                className="pro-input"
                placeholder="Enter activity name"
                value={newActivity.activityName}
                onChange={(e) => setNewActivity({ ...newActivity, activityName: e.target.value })}
              />
            </div>

            <div className="machine-picker">
              <div className="picker-header">
                <span>Machines</span>
                <strong>{newActivity.machines.length} selected</strong>
              </div>

              <div className="machine-grid">
                {machines.map((m) => {
                  const selected = newActivity.machines.includes(m._id);

                  return (
                    <label
                      key={m._id}
                      className={`machine-tile ${selected ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => handleActivityMachineChange(m._id)}
                      />
                      <span>{m.machineName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <button className="pro-btn primary" onClick={addActivity}>
            Add Activity
          </button>

          <div
            className="material-toggle"
            onClick={() => setShowActivityList(!showActivityList)}
          >
            {showActivityList ? "Hide Stored Activities ▲" : "Show Stored Activities ▼"}
          </div>

          {showActivityList && (
            <>
              {/* Field Filter for Activities */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Activities
                  </span>
                  {(activityFilter.activityName || activityFilter.machineName) && (
                    <button
                      type="button"
                      onClick={() => setActivityFilter({ activityName: "", machineName: "" })}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Activity Name..."
                    value={activityFilter.activityName}
                    onChange={(e) => setActivityFilter({ ...activityFilter, activityName: e.target.value })}
                  />
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Assigned Machine..."
                    value={activityFilter.machineName}
                    onChange={(e) => setActivityFilter({ ...activityFilter, machineName: e.target.value })}
                  />
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredActivities.map((a) => (
                    <li key={a._id} className="d-flex justify-content-between align-items-center">
                      {editingId === a._id ? (
                        <>
                          <div className="activity-builder edit-mode">
                            <div className="activity-name-field">
                              <label>Activity Name</label>
                              <input
                                className="pro-input"
                                value={editingData.activityName || ""}
                                onChange={(e) =>
                                  setEditingData({ ...editingData, activityName: e.target.value })
                                }
                              />
                            </div>

                            <div className="machine-picker">
                              <div className="picker-header">
                                <span>Machines</span>
                                <strong>{editingData.machines?.length || 0} selected</strong>
                              </div>

                              <div className="machine-grid">
                                {machines.map((m) => {
                                  const selected = editingData.machines?.includes(m._id);

                                  return (
                                    <label
                                      key={m._id}
                                      className={`machine-tile ${selected ? "selected" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => {
                                          setEditingData((prev) => ({
                                            ...prev,
                                            machines: prev.machines.includes(m._id)
                                              ? prev.machines.filter((id) => id !== m._id)
                                              : [...prev.machines, m._id],
                                          }));
                                        }}
                                      />
                                      <span>{m.machineName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <button
                            className="pro-btn primary"
                            onClick={() => updateMaster("activities", a._id, editingData)}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            {a.activityName} •{" "}
                            {a.machines
                              ?.map((m) => {
                                if (m?.machineName) return m.machineName;
                                const machine = machines.find((mach) => mach._id === (m._id || m));
                                return machine?.machineName;
                              })
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(a._id);
                                setEditingData({
                                  activityName: a.activityName,
                                  machines: a.machines?.map((m) => (m._id ? m._id : m)) || [],
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("activities", a._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredActivities.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching activities found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 15. LOCATIONS */}
      {activeSection === "locations" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <MapPin size={18} /> Locations
            </span>
          </div>

          <div className="pro-grid">
            <input
              className="pro-input"
              placeholder="Location Name"
              value={newLocation.locationName}
              onChange={(e) => setNewLocation({ ...newLocation, locationName: e.target.value })}
            />
            <textarea
              className="pro-input"
              placeholder="Address"
              value={newLocation.address}
              onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
            />
          </div>

          <div className="machine-picker" style={{ margin: "10px 0" }}>
            <div className="picker-header">
              <span>Machines at this location</span>
              <strong>{newLocation.machines.length} selected</strong>
            </div>
            <div className="machine-grid">
              {machines.map((m) => {
                const selected = newLocation.machines.includes(m._id);
                return (
                  <label key={m._id} className={`machine-tile ${selected ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleLocationMachine(setNewLocation, m._id)}
                    />
                    <span>{m.machineName}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button className="pro-btn primary" onClick={addLocation}>
            <PlusCircle size={16} /> Add
          </button>

          <div
            className="material-toggle"
            onClick={() => setShowLocationList(!showLocationList)}
          >
            {showLocationList ? "Hide Stored Locations ▲" : "Show Stored Locations ▼"}
          </div>

          {showLocationList && (
            <>
              {/* Field Filter for Locations */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Locations
                  </span>
                  {(locationFilter.locationName || locationFilter.address) && (
                    <button
                      type="button"
                      onClick={() => setLocationFilter({ locationName: "", address: "" })}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Location Name..."
                    value={locationFilter.locationName}
                    onChange={(e) => setLocationFilter({ ...locationFilter, locationName: e.target.value })}
                  />
                  <input
                    style={filterInputStyle}
                    placeholder="Filter by Address..."
                    value={locationFilter.address}
                    onChange={(e) => setLocationFilter({ ...locationFilter, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredLocations.map((l) => (
                    <li key={l._id} className="d-flex justify-content-between align-items-center">
                      {editingId === l._id ? (
                        <>
                          <div style={{ flex: 1 }}>
                          <div className="pro-grid">
                            <input
                              className="pro-input"
                              value={editingData.locationName || ""}
                              onChange={(e) =>
                                setEditingData({ ...editingData, locationName: e.target.value })
                              }
                            />
                            <textarea
                              className="pro-input"
                              value={editingData.address || ""}
                              onChange={(e) =>
                                setEditingData({ ...editingData, address: e.target.value })
                              }
                            />
                          </div>

                          <div className="machine-picker" style={{ margin: "10px 0" }}>
                            <div className="picker-header">
                              <span>Machines at this location</span>
                              <strong>{editingData.machines?.length || 0} selected</strong>
                            </div>
                            <div className="machine-grid">
                              {machines.map((m) => {
                                const selected = editingData.machines?.includes(m._id);
                                return (
                                  <label key={m._id} className={`machine-tile ${selected ? "selected" : ""}`}>
                                    <input
                                      type="checkbox"
                                      checked={!!selected}
                                      onChange={() => toggleLocationMachine(setEditingData, m._id)}
                                    />
                                    <span>{m.machineName}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                          </div>
                          <button
                            className="pro-btn primary"
                            onClick={() => updateMaster("location", l._id, editingData)}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            <strong>{l.locationName}</strong> • {l.address} •{" "}
                            {(l.machines || [])
                              .map((id) => machines.find((m) => m._id === (id._id || id))?.machineName)
                              .filter(Boolean)
                              .join(", ") || "No machines"}
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(l._id);
                                setEditingData({
                                  locationName: l.locationName,
                                  address: l.address,
                                  machines: (l.machines || []).map((m) => m._id || m),
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("location", l._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredLocations.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching locations found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* 16. MATERIALS */}
      {activeSection === "materials" && (
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span>
              <Layers size={18} /> Materials
            </span>
          </div>

          <div className="pro-grid">
            {[
              ["code", "Code"],
              ["description", "Description"],
              ["group", "Group"],
              ["mill", "Mill"],
              ["gsm", "GSM"],
              ["paperSize", "PaperSize"],
              ["length", "Length"],
              ["width", "Width"],
            ].map(([key, placeholder]) => (
              <input
                key={key}
                className="pro-input"
                placeholder={placeholder}
                value={newMaterial[key]}
                onChange={(e) => setNewMaterial({ ...newMaterial, [key]: e.target.value })}
              />
            ))}
          </div>

          <button className="pro-btn primary" onClick={addMaterial}>
            Add Material
          </button>

          <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label style={uploadLabelStyle}>
              📥 Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setUploadingMaterials(true);
                  setMaterialUploadResult(null);
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await axios.post(
                      `${BASE_URL}/api/master/materials/bulk-upload`,
                      formData,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "multipart/form-data",
                        },
                      }
                    );
                    setMaterialUploadResult(res.data);
                    fetchMasters();
                  } catch (err) {
                    setMaterialUploadResult({ error: err.response?.data?.message || "Upload failed" });
                  } finally {
                    setUploadingMaterials(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {uploadingMaterials && <span style={{ fontSize: "13px", color: "#08406b" }}>Uploading...</span>}
          </div>

          {materialUploadResult && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                marginBottom: "10px",
                background: materialUploadResult.error ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${materialUploadResult.error ? "#fca5a5" : "#86efac"}`,
                fontSize: "13px",
                color: materialUploadResult.error ? "#dc2626" : "#16a34a",
              }}
            >
              {materialUploadResult.error
                ? `❌ ${materialUploadResult.error}`
                : `✅ Inserted: ${materialUploadResult.inserted} | Updated: ${
                    materialUploadResult.updated || 0
                  }${materialUploadResult.errors?.length ? ` | Errors: ${materialUploadResult.errors.length}` : ""}`}
            </div>
          )}

          <div
            className="material-toggle"
            onClick={() => setShowMaterialList(!showMaterialList)}
          >
            {showMaterialList ? "Hide Stored Materials ▲" : "Show Stored Materials ▼"}
          </div>

          {showMaterialList && (
            <>
              {/* Field-by-Field Filters for Materials */}
              <div style={filterBoxStyle}>
                <div style={filterTitleStyle}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={14} /> Filter Materials by Respective Fields
                  </span>
                  {(searchMaterialCode || Object.values(materialFilter).some((v) => v)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMaterialCode("");
                        setMaterialFilter({
                          code: "",
                          description: "",
                          group: "",
                          mill: "",
                          gsm: "",
                          paperSize: "",
                          length: "",
                          width: "",
                        });
                      }}
                      style={clearBtnStyle}
                    >
                      <X size={12} /> Clear Filters
                    </button>
                  )}
                </div>
                <div style={filterGridStyle}>
                  {[
                    ["code", "Code..."],
                    ["description", "Description..."],
                    ["group", "Group..."],
                    ["mill", "Mill..."],
                    ["gsm", "GSM..."],
                    ["paperSize", "Paper Size..."],
                    ["length", "Length..."],
                    ["width", "Width..."],
                  ].map(([key, placeholder]) => (
                    <input
                      key={key}
                      style={filterInputStyle}
                      placeholder={placeholder}
                      value={key === "code" ? (searchMaterialCode || materialFilter.code) : materialFilter[key]}
                      onChange={(e) => {
                        if (key === "code") {
                          setSearchMaterialCode(e.target.value);
                        }
                        setMaterialFilter({ ...materialFilter, [key]: e.target.value });
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Scrollable Records */}
              <div style={scrollContainerStyle}>
                <ul className="pro-list" style={{ margin: 0, padding: 0 }}>
                  {filteredMaterials.map((m) => (
                    <li key={m._id} className="d-flex justify-content-between align-items-center">
                      {editingId === m._id ? (
                        <>
                          <div className="pro-grid">
                            {[
                              "code",
                              "description",
                              "group",
                              "mill",
                              "gsm",
                              "paperSize",
                              "length",
                              "width",
                            ].map((key) => (
                              <input
                                key={key}
                                className="pro-input"
                                value={editingData[key] || ""}
                                onChange={(e) =>
                                  setEditingData({ ...editingData, [key]: e.target.value })
                                }
                              />
                            ))}
                          </div>
                          <button
                            className="pro-btn primary"
                            onClick={() => updateMaster("materials", m._id, editingData)}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            <strong>{m.code}</strong> • {m.description} • {m.group} • {m.mill} •{" "}
                            {m.gsm} • {m.paperSize} • {m.length} • {m.width}
                          </span>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              className="pro-btn"
                              onClick={() => {
                                setEditingId(m._id);
                                setEditingData({
                                  code: m.code,
                                  description: m.description,
                                  group: m.group,
                                  mill: m.mill,
                                  gsm: m.gsm,
                                  paperSize: m.paperSize,
                                  length: m.length,
                                  width: m.width,
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button className="pro-btn" onClick={() => deleteMaster("materials", m._id)}>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {filteredMaterials.length === 0 && (
                    <li style={{ padding: "10px", color: "#4a6f8c", textAlign: "center" }}>
                      No matching materials found
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </motion.div>
      )}
          </div>
        </div>
      </div>
        );
      })()}
    </motion.div>
  );
}

export default AdminDashboard;