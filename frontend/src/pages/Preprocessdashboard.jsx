import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import BASE_URL from "../config/api";
import * as XLSX from "xlsx";
import { Plus } from "lucide-react";
import PrepressArtworkDashboard from "./Prepressartworkdashboard";

// ============================================================================
// 🎨 Embedded vector icons (same set as the Reel Register page – no extra deps)
// ============================================================================
const Icons = {
  Factory: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1" /><path d="M12 18h1" /><path d="M7 18h1" />
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Reel: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v5" /><path d="M12 16v5" /><path d="M3 12h5" /><path d="M16 12h5" />
    </svg>
  ),
  Alert: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Gauge: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  )
};

// 🎨 presentation helper: round icon badge + heading + small pill
const SectionHead = ({ icon: Icon, color = "blue", title, pill }) => (
  <div className="card-heading-row">
    <div className="heading-with-icon">
      <div className={`heading-icon-badge ${color}`}>
        <Icon />
      </div>
      <h2>{title}</h2>
    </div>
    {pill ? <span className="section-pill-tag">{pill}</span> : null}
  </div>
);

// Outlined floating-label field with a leading icon (Planner styling)
function PoField({ icon, label, required, filled, alwaysFloat, caret, invalid, className = "", children }) {
  return (
    <div className={className}>
      <div className={`po-field ${filled || alwaysFloat ? "is-floated" : ""} ${invalid ? "po-invalid" : ""}`}>
        {icon && <i className={`bi ${icon} po-field-icon`}></i>}
        {children}
        <label className="po-field-label">
          {label}
          {required && <span className="po-req"> *</span>}
        </label>
        {caret && <i className="bi bi-chevron-down po-caret"></i>}
      </div>
    </div>
  );
}
const has = (v) => v !== "" && v !== null && v !== undefined;

const preprocessStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');
  @keyframes pulseNotification {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    50% { transform: scale(1.03); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  @keyframes glowPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.7; } }

  /* ---------- Aqua glass backdrop ---------- */
  .dashboard-container{position:relative;width:100%!important;max-width:none!important;box-sizing:border-box;min-height:100%;margin:0!important;padding:14px 18px 28px;overflow:hidden;border:0;font-family:'Source Sans 3','Segoe UI',system-ui,-apple-system,sans-serif;color:#1f2d3a;background:#f3f5f7}
  .dashboard-container>*{position:relative}

  /* ---------- Glossy hero header ---------- */
  .dashboard-heading{position:relative;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 12px;padding:9px 18px;border-radius:6px;color:#1f2d3a;background:#fff;border:1px solid #dfe4e9;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .hero-left-branding{display:flex;align-items:center;gap:14px}
  .hero-emblem-3d{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background:#0f6b7c;box-shadow:none;flex-shrink:0}
  .dashboard-heading h3{margin:0;font-size:21px;font-weight:700;letter-spacing:-.4px;color:#043a45}
  .dashboard-heading p{margin:1px 0 0;font-size:11.5px;font-weight:600;color:#5f6c7a}
  .operator-pill-3d{display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:30px;font-size:12px;font-weight:600;color:#1f2d3a;background:#fff;border:1px solid #dfe4e9;box-shadow:none}
  .operator-pulse-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;animation:glowPulse 2s infinite}

  /* ---------- Section headings ---------- */
  .card-heading-row{display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px}
  .heading-with-icon{display:flex;align-items:center;gap:10px}
  .heading-icon-badge{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:none}
  .heading-icon-badge svg{width:16px;height:16px}
  .heading-icon-badge.blue{background:#0f6b7c}
  .heading-icon-badge.purple{background:#6d4fd6}
  .heading-icon-badge.amber{background:#d98a00}
  .heading-icon-badge.green{background:#2f9e60}
  .card-heading-row h2{font-size:15px;font-weight:700;margin:0;color:#1f2d3a}
  .section-pill-tag{font-size:11px;font-weight:700;padding:4px 11px;border-radius:6px;text-transform:uppercase;letter-spacing:.5px;background:#e6f1f3;color:#043a45;border:1px solid #dfe4e9}

  /* ---------- Glass filter bar + inset inputs ---------- */
  .filter-bar{display:flex;justify-content:flex-start;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:10px 14px;border-radius:6px;background:#f8f9fa;border:1px solid #dfe4e9;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .filter-bar .form-control,.filter-bar .form-select{min-height:36px;padding:6px 12px;border:1.5px solid #cfd6dd;border-radius:4px;color:#1f2d3a;background:#fff;font-size:13px;font-weight:600;box-shadow:none;flex:1 1 150px;min-width:110px;max-width:230px;transition:all .2s cubic-bezier(.4,0,.2,1)}
  .filter-bar .form-control::placeholder{color:#9aa5b1;font-weight:600;opacity:1}
  .filter-bar .form-control:focus,.filter-bar .form-select:focus{border-color:#0f6b7c;outline:none;box-shadow:0 0 0 3px rgba(15,107,124,.15)}
  .filter-bar .btn,.filter-bar span{flex:0 0 auto;white-space:nowrap}

  /* ---------- Glossy 3D aqua buttons ---------- */
  .dashboard-container .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:4px;font-weight:700;color:#fff;text-decoration:none;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease}
  .dashboard-container .btn:hover:not(:disabled){transform:none;filter:brightness(1.04);color:#fff}
  .dashboard-container .btn:active:not(:disabled){transform:none}
  .dashboard-container .btn:disabled{opacity:.5;cursor:not-allowed}
  .dashboard-container .btn-primary{background:#043a45;border-color:#043a45;box-shadow:none}
  .dashboard-container .btn-info{background:#0f6b7c;border-color:#0f6b7c;box-shadow:none}
  .dashboard-container .btn-success{background:#e4572e;border-color:#e4572e;box-shadow:none}
  .dashboard-container .btn-danger{background:#d64545;border-color:#d64545;box-shadow:none}
  .dashboard-container .btn-secondary{background:#fff;color:#1f2d3a;border-color:#cfd6dd;box-shadow:none}

  /* ---------- Colorful 3D tables ---------- */
  .scrollable-table-container{width:100%;overflow:auto;border-radius:6px;background:#fff}
  .production-real-table-wrap{background:#fff;border:1px solid #dfe4e9;border-radius:6px;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .production-real-table-wrap::-webkit-scrollbar{width:8px;height:8px}
  .production-real-table-wrap::-webkit-scrollbar-track{background:#f1f3f5;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb{background:#c2ccd4;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb:hover{background:#9fb0bd}
  .production-real-table{width:100%;min-width:0;margin:0;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:.81rem;color:#1f2d3a;background:#fff}
  .production-real-table th,.production-real-table td{overflow-wrap:anywhere;word-break:break-word;vertical-align:middle}
  .production-real-table thead th{position:sticky;top:0;z-index:1;padding:11px 10px;background:#f4f6f8!important;color:#5f6c7a!important;border:0!important;border-bottom:1px solid #dfe4e9!important;font-size:.7rem;font-weight:600;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap}
  .production-real-table tbody td{padding:9px 10px;border:0!important;border-bottom:1px solid #edf0f3!important;border-right:1px solid #f3f5f7!important;font-weight:400;color:#1f2d3a;background:#fff}
  .production-real-table tbody tr:nth-child(even) td{background:#fff}
  .production-real-table tbody tr:hover td{background:#f1f7f8!important}
  .production-real-table .empty-state{padding:42px!important;color:#5f6c7a!important;font-weight:600;text-align:center}
  .planned-workorders-table th,.planned-workorders-table td{overflow-wrap:anywhere;word-break:break-word}
  .empty-state{padding:42px!important;color:#5f6c7a!important;font-weight:600;text-align:center}

  /* ---------- Status pills ---------- */
  .status-pill{display:inline-block;padding:3px 10px;border-radius:4px;font-size:.7rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase}
  .status-pending{background:#fef3c7;color:#b45309;border:1px solid #fde68a}
  .status-approved{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
  .status-rejected{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}

  /* ---------- Floating "+" button ---------- */
  .pt-fab{position:fixed;bottom:28px;right:28px;width:54px;height:54px;border-radius:50%;color:#fff;border:1px solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:100;background:#e4572e;box-shadow:0 4px 12px rgba(16,40,56,.25);transition:transform .12s ease}
  .pt-fab:hover{transform:none}
  .pt-fab:active{transform:none}

  @media(max-width:768px){.dashboard-container{padding:12px}.dashboard-heading{flex-direction:column;align-items:flex-start;padding:14px}.dashboard-heading>div:last-child{width:100%;justify-content:flex-start;flex-wrap:wrap}.filter-bar{justify-content:stretch}.filter-bar .form-control,.filter-bar .form-select{width:100%!important}}

  /* =====================================================================
     PLANNER PAGE LOOK (appended override, presentation only)
     ===================================================================== */
  .dashboard-container{font-family:'Noto Sans','Segoe UI',system-ui,-apple-system,Arial,sans-serif;font-size:12.5px;color:#000;background:#f4f6f8;padding:24px 28px 40px}
  .dashboard-heading{border-radius:8px;border:1px solid #e3e7ec;box-shadow:0 1px 3px rgba(16,24,40,.06);backdrop-filter:none;-webkit-backdrop-filter:none}
  .hero-emblem-3d{width:38px;height:38px;border-radius:8px;color:#e4572e;background:#fdeee8;border:1px solid #f7d3c6}
  .dashboard-heading h3{font-size:17px;color:#000;letter-spacing:0}
  .dashboard-heading p{font-size:12px;color:#000;font-weight:500}
  .card-heading-row{margin:16px 0 8px}
  .dashboard-container .heading-icon-badge,.dashboard-container .heading-icon-badge.blue,.dashboard-container .heading-icon-badge.purple,.dashboard-container .heading-icon-badge.amber,.dashboard-container .heading-icon-badge.green{width:26px;height:26px;border-radius:6px;background:#fdeee8;color:#e4572e;border:1px solid #f7d3c6}
  .heading-icon-badge svg{width:14px;height:14px}
  .card-heading-row h2{font-size:14px;font-weight:700;color:#000}
  .section-pill-tag{font-size:10.5px;color:#000;background:#e3f1f4;border-color:#b9d6dd}
  .status-pill{font-size:11px;color:#000!important;border-radius:999px;padding:2px 10px;text-transform:none}
  .status-pending{background:#fff3d6;border-color:#f2d291}
  .status-approved{background:#d9f2e6;border-color:#a9dcc3}
  .status-rejected{background:#fbdcdc;border-color:#f0b4b4}
  .pt-fab{background:#e4572e;color:#fff}
  .pp-filter-title+.pp-ffield-wide{flex:2 1 240px;max-width:340px}
  .pp-err{color:#d64545;font-weight:600;font-size:11.5px;margin-top:4px}
  .pp-overlay{position:fixed;inset:0;background:rgba(11,58,69,.45);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:1050;padding:16px}
  .pp-modal.po-split{width:100%;max-width:900px;max-height:92vh;overflow-y:auto}

  /* ---- outlined floating-label fields (Planner look) ---- */
  .dashboard-container .po-field{position:relative;display:flex;align-items:center;min-height:36px;background:#fff;border:1px solid #cfd6de;border-radius:6px;transition:border-color .15s ease,box-shadow .15s ease}
  .dashboard-container .po-field:focus-within{border-color:#0f5560;box-shadow:0 0 0 3px rgba(15,85,96,.15)}
  .dashboard-container .po-field.po-invalid{border-color:#d64545}
  .dashboard-container .po-field-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#000;font-size:.8rem;pointer-events:none;z-index:1}
  .dashboard-container .po-field .po-input{width:100%;min-height:34px;padding:6px 8px 6px 32px;border:none!important;outline:none;background:transparent!important;box-shadow:none!important;border-radius:6px;font-family:inherit;font-size:.8rem;font-weight:500;color:#000}
  .dashboard-container .po-field .po-input[readonly]{background:#f7f9fb!important}
  .dashboard-container .po-field textarea.po-input{min-height:34px;padding-top:10px;resize:vertical}
  .dashboard-container .po-field select.po-input{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:28px}
  .dashboard-container .po-field .po-input:disabled{background:#f1f3f5!important;cursor:not-allowed}
  .dashboard-container .po-field .po-input::placeholder{color:#6b7685;opacity:1}
  .dashboard-container .po-caret{position:absolute;right:10px;font-size:.7rem;color:#000;pointer-events:none}
  .dashboard-container .po-field-label{position:absolute;left:32px;top:50%;transform:translateY(-50%);max-width:calc(100% - 34px);overflow:hidden;text-overflow:ellipsis;padding:0 4px;background:#fff;color:#000;font-size:.8rem;font-weight:500;white-space:nowrap;pointer-events:none;transition:all .15s ease}
  .dashboard-container .po-field:focus-within .po-field-label,.dashboard-container .po-field.is-floated .po-field-label{top:0;left:24px;font-size:.62rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
  .dashboard-container .po-req{color:#d64545}

  /* ---- small light buttons, black text ---- */
  .dashboard-container .btn{font-size:12px;font-weight:600;border-radius:6px;color:#000!important;box-shadow:none}
  .dashboard-container .btn-sm{font-size:11px;min-height:26px;padding:3px 11px}
  .dashboard-container .btn:hover:not(:disabled){filter:none;color:#000!important}
  .dashboard-container .btn-primary{background:#fde3d8;border-color:#f5b9a1}
  .dashboard-container .btn-primary:hover:not(:disabled){background:#fbd0bf}
  .dashboard-container .btn-success{background:#d9f2e6;border-color:#a9dcc3}
  .dashboard-container .btn-success:hover:not(:disabled){background:#c5ebd6}
  .dashboard-container .btn-info{background:#e8f3f6;border-color:#b9d6dd}
  .dashboard-container .btn-info:hover:not(:disabled){background:#d5e9ee}
  .dashboard-container .btn-danger{background:#fbdcdc;border-color:#f0b4b4}
  .dashboard-container .btn-danger:hover:not(:disabled){background:#f7c7c7}
  .dashboard-container .btn-secondary,.dashboard-container .btn-outline{background:#fff;border-color:#cfd6de}

  /* ---- table: column heading colour, black text ---- */
  .dashboard-container .production-real-table{font-size:12px}
  .dashboard-container .production-real-table thead th{background:#a9d0d9!important;color:#000!important;border:1px solid #8fbcc7!important;font-size:10.5px;font-weight:700;letter-spacing:.4px;padding:9px 10px}
  .dashboard-container .production-real-table tbody td{color:#000!important;padding:7px 10px;border-bottom:1px solid #eef1f4!important;border-right:1px solid #f3f5f7!important}
  .dashboard-container .production-real-table tbody tr:nth-child(even) td{background:#fafbfc}
  .dashboard-container .production-real-table tbody tr:hover td{background:#fdeee8!important}
  .dashboard-container .production-real-table-wrap{border:1px solid #e3e7ec;border-radius:8px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
  .dashboard-container .production-real-table .empty-state{color:#000!important}

  /* ---- filter bar ---- */
  .dashboard-container .filter-bar{justify-content:flex-start;align-items:center;background:#fff;border:1px solid #e3e7ec;border-radius:8px;gap:12px 10px;padding:14px 16px 12px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
  .dashboard-container .filter-bar:before{display:none}
  .dashboard-container .pp-filter-title{flex:0 0 100%;display:flex;align-items:center;gap:7px;padding-left:8px;border-left:3px solid #e4572e;font-size:13px;font-weight:700;color:#000;margin-bottom:2px}
  .dashboard-container .pp-filter-title i{color:#e4572e;font-size:14px}
  .dashboard-container .filter-bar .pp-ffield{flex:1 1 170px;min-width:150px;max-width:230px}
  .dashboard-container .filter-bar .btn{height:34px}

  /* ---- split form card (teal info panel + white form) ---- */
  .pp-modal.po-split{display:flex;background:#fff;border:1px solid #e3e7ec;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.07)}
  .pp-modal .po-side{flex:0 0 28%;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:24px;color:#fff;background:linear-gradient(170deg,#0b3a45 0%,#0f5560 100%)}
  .pp-modal .po-side::before{content:'';position:absolute;width:260px;height:260px;border-radius:50%;right:-110px;top:-90px;background:rgba(255,255,255,.06)}
  .pp-modal .po-side::after{content:'';position:absolute;width:200px;height:200px;border-radius:50%;left:-90px;bottom:-80px;background:rgba(228,87,46,.18)}
  .pp-modal .po-side>*{position:relative;z-index:1}
  .pp-modal .po-side-brand{font-weight:700;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;color:#ffb59c}
  .pp-modal .po-side-hero h2{margin:0;padding:0;color:#fff!important;font-size:21px;font-weight:600;line-height:1.15}
  .pp-modal .po-side-hero h1{margin:0 0 12px;color:#fff!important;font-size:36px;font-weight:700;line-height:1;letter-spacing:-.5px}
  .pp-modal .po-side-hero p{margin:0;max-width:210px;font-size:12px;line-height:1.55;color:#c9dde1}
  .pp-modal .po-side-foot{color:#ffb59c;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
  .pp-modal .po-main{flex:1;min-width:0;padding:22px 28px;background:#fff}
  .pp-modal .po-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#000;font-size:17px;font-weight:700;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #e3e7ec}
  .pp-modal .po-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}
  .pp-modal .po-grid .po-full{grid-column:1/-1}
  .pp-modal .po-actions{display:flex;justify-content:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e3e7ec}
  .pp-modal .po-actions .btn{min-width:150px;height:38px;padding:0 18px;font-size:12.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
  .pp-modal .po-actions .btn-po-save{background:#e4572e!important;border:1px solid #e4572e!important;color:#fff!important;box-shadow:0 1px 2px rgba(228,87,46,.35)}
  .pp-modal .po-actions .btn-po-save:hover:not(:disabled){background:#c9461f!important;border-color:#c9461f!important}
  .pp-modal .po-actions .btn-po-save:disabled{background:#e2e4ea!important;border-color:#e2e4ea!important;color:#9DA2B0!important;box-shadow:none}
  @media(max-width:992px){.pp-modal.po-split{flex-direction:column}.pp-modal .po-side{flex:none;min-height:150px;padding:20px;gap:14px}.pp-modal .po-side-hero h1{font-size:28px;margin-bottom:6px}.pp-modal .po-main{padding:18px 14px}.pp-modal .po-grid{grid-template-columns:1fr}}

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
  @keyframes pgfab {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* page container (fade only) */
  .dashboard-container { animation: pgfade 0.45s ease-out backwards; }

  /* header drops in */
  .dashboard-container .dashboard-heading {
    animation: pgfadedown 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
  }

  /* filters, section headings, tables (replays when you switch views) */
  .dashboard-container .filter-bar {
    animation: pgfadeup 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
  }
  .dashboard-container .card-heading-row {
    animation: pgfadeup 0.45s ease-out 0.25s backwards;
  }
  .dashboard-container .production-real-table-wrap {
    animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.35s backwards;
  }

  /* table rows: quick stagger on the first rows */
  .dashboard-container .production-real-table tbody tr { animation: pgrow 0.35s ease-out backwards; }
  .dashboard-container .production-real-table tbody tr:nth-child(1)  { animation-delay: 0.50s; }
  .dashboard-container .production-real-table tbody tr:nth-child(2)  { animation-delay: 0.55s; }
  .dashboard-container .production-real-table tbody tr:nth-child(3)  { animation-delay: 0.60s; }
  .dashboard-container .production-real-table tbody tr:nth-child(4)  { animation-delay: 0.65s; }
  .dashboard-container .production-real-table tbody tr:nth-child(5)  { animation-delay: 0.70s; }
  .dashboard-container .production-real-table tbody tr:nth-child(6)  { animation-delay: 0.75s; }
  .dashboard-container .production-real-table tbody tr:nth-child(7)  { animation-delay: 0.80s; }
  .dashboard-container .production-real-table tbody tr:nth-child(8)  { animation-delay: 0.85s; }
  .dashboard-container .production-real-table tbody tr:nth-child(n+9) { animation-delay: 0.90s; }

  /* floating + button */
  .dashboard-container .pt-fab { animation: pgfab 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.6s backwards; }

  /* plate tracker entry modal (plays each time it opens) */
  .dashboard-container .pp-overlay { animation: pgfade 0.25s ease-out backwards; }
  .dashboard-container .pp-modal   { animation: pgpop 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
  .dashboard-container .pp-modal .po-side { animation: pgslideright 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards; }
  .dashboard-container .pp-modal .po-heading,
  .dashboard-container .pp-modal .po-grid,
  .dashboard-container .pp-modal .po-actions { animation: pgfadeup 0.45s ease-out backwards; }
  .dashboard-container .pp-modal .po-heading { animation-delay: 0.20s; }
  .dashboard-container .pp-modal .po-grid    { animation-delay: 0.28s; }
  .dashboard-container .pp-modal .po-actions { animation-delay: 0.36s; }

  /* respect users who disable motion */
  @media (prefers-reduced-motion: reduce) {
    .dashboard-container,
    .dashboard-container * {
      animation: none !important;
    }
  }
`;

const emptyProductionForm = {
  date: new Date().toISOString().slice(0, 10),
  woNumber: "",
  customerName: "",
  jobName: "",
  machine: [],
  producedQty: "",
  wastageQty: "",
  reason: "",
  remark: "",
};

function PreprocessDashboard() {
  const token = localStorage.getItem("token");

  const [loggedInUser, setLoggedInUser] = useState("");
  const [userLocations, setUserLocations] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completedRecords, setCompletedRecords] = useState([]);
  const [completedLoading, setCompletedLoading] = useState(false);

  // Row hidden the moment "Done" succeeds
  const [hiddenOrders, setHiddenOrders] = useState([]);

  // Plate Requests (separate approval queue)
  const [plateRequests, setPlateRequests] = useState([]);
  const [plateRequestsLoading, setPlateRequestsLoading] = useState(false);
  const [hiddenPlateRequests, setHiddenPlateRequests] = useState([]);

  // Full Plate Request history ("My Plate Requests" style table)
  const [allPlateRequests, setAllPlateRequests] = useState([]);
  const [allPlateRequestsLoading, setAllPlateRequestsLoading] = useState(false);
  const [prFilterWoNo, setPrFilterWoNo] = useState("");
  const [prFilterCustomer, setPrFilterCustomer] = useState("");
  const [prFilterProductType, setPrFilterProductType] = useState("");
  const [prFilterStatus, setPrFilterStatus] = useState("");
  const [prFilterFromDate, setPrFilterFromDate] = useState("");
  const [prFilterToDate, setPrFilterToDate] = useState("");

  // Which view is showing: "workorders" | "platerequests" | "production"
  const [activeView, setActiveView] = useState("workorders");

  // Production Log
  const [productionEntries, setProductionEntries] = useState([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [showProductionForm, setShowProductionForm] = useState(false);
  const [productionForm, setProductionForm] = useState(emptyProductionForm);
  const [productionWoMatched, setProductionWoMatched] = useState(null);
  const [productionSearch, setProductionSearch] = useState("");
  const [productionMachineFilter, setProductionMachineFilter] = useState("all");
  const [productionFilterFromDate, setProductionFilterFromDate] = useState("");
  const [productionFilterToDate, setProductionFilterToDate] = useState("");
  const [editingProductionId, setEditingProductionId] = useState(null);
  const [expandedCellKey, setExpandedCellKey] = useState(null); // "<rowId>-<field>" | null

  // Filters
  const [filterWoNo, setFilterWoNo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterMachine, setFilterMachine] = useState("");

  const showAlert = (title, text = "", icon = "warning") => {
    Swal.fire({
      title,
      text,
      icon,
      confirmButtonColor: "#043a45",
      width: "350px"
    });
  };

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser(decoded.name);
      setUserLocations(decoded.locations || []);
    }
    fetchPending();
    fetchMachines();
    fetchCompleted();
    fetchPlateRequests();
    fetchAllPlateRequests();
    fetchProduction();

    // Auto-polling every 20 seconds to keep Plate Request notifications updated
    const interval = setInterval(() => {
      fetchPlateRequests();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  const fetchCompleted = async () => {
    setCompletedLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/preprocess`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompletedRecords(res.data || []);
    } catch (err) {
      console.error("Error fetching completed records:", err);
      setCompletedRecords([]);
    }
    setCompletedLoading(false);
  };

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/preprocess/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkOrders(res.data || []);
    } catch (err) {
      console.error("Error fetching pending work orders:", err);
      setWorkOrders([]);
    }
    setLoading(false);
  };

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/master/machines`);
      setMachines(res.data || []);
    } catch (err) {
      console.error("Error fetching machines:", err);
    }
  };

  const fetchProduction = async () => {
    setProductionLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/production-log`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductionEntries(res.data || []);
    } catch (err) {
      console.error("Error fetching production log:", err);
      setProductionEntries([]);
    }
    setProductionLoading(false);
  };

  const handleProductionWoInput = (val) => {
    setProductionForm(f => ({ ...f, woNumber: val }));
    if (!val.trim()) setProductionWoMatched(null);
  };

  const lookupProductionWo = async () => {
    const woNo = productionForm.woNumber.trim();
    if (!woNo) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/production-log/wo-lookup/${woNo}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductionWoMatched(true);
      setProductionForm(f => ({
        ...f,
        customerName: res.data.customerName,
        jobName: res.data.jobName,
        machine: res.data.machine || [],
      }));
    } catch (err) {
      setProductionWoMatched(false);
      setProductionForm(f => ({ ...f, customerName: "", jobName: "", machine: [] }));
    }
  };

  const resetProductionForm = () => {
    setProductionForm(emptyProductionForm);
    setProductionWoMatched(null);
    setEditingProductionId(null);
  };

  const startEditProduction = (entry) => {
    setEditingProductionId(entry._id);
    setProductionForm({
      date: entry.date ? new Date(entry.date).toISOString().slice(0, 10) : "",
      woNumber: entry.woNumber || "",
      customerName: entry.customerName || "",
      jobName: entry.jobName || "",
      machine: entry.machine || [],
      producedQty: entry.producedQty ?? "",
      wastageQty: entry.wastageQty ?? "",
      reason: entry.reason || "",
      remark: entry.remark || "",
    });
    setProductionWoMatched(true);
    setShowProductionForm(true);
  };

  const deleteProductionEntry = async (entry) => {
    const result = await Swal.fire({
      title: "Delete this entry?",
      text: `WO ${entry.woNumber} — this cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d64545",
      cancelButtonColor: "#5f6c7a",
      confirmButtonText: "Yes, delete",
      width: "350px"
    });
    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${BASE_URL}/api/production-log/${entry._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProduction();
      showAlert("Success", "Entry deleted successfully", "success");
    } catch (err) {
      console.error("Error deleting production entry:", err.response?.data || err);
      showAlert("Error", err.response?.data?.message || "Error deleting entry", "error");
    }
  };

  const addProductionEntry = async () => {
    if (
      !productionForm.date ||
      !productionForm.woNumber.trim() ||
      !productionForm.customerName.trim() ||
      !productionForm.jobName.trim() ||
      !productionForm.machine.length ||
      productionForm.producedQty === ""
    ) return;
    const payload = {
      date: productionForm.date,
      woNumber: productionForm.woNumber.trim(),
      customerName: productionForm.customerName.trim(),
      jobName: productionForm.jobName.trim(),
      machine: productionForm.machine,
      producedQty: Number(productionForm.producedQty) || 0,
      wastageQty: Number(productionForm.wastageQty) || 0,
      reason: productionForm.reason.trim(),
      remark: productionForm.remark.trim(),
    };

    const isEdit = Boolean(editingProductionId);
    try {
      if (isEdit) {
        await axios.put(`${BASE_URL}/api/production-log/${editingProductionId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${BASE_URL}/api/production-log`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      resetProductionForm();
      setShowProductionForm(false);
      fetchProduction();
      showAlert("Success", isEdit ? "Entry updated successfully" : "Entry saved successfully", "success");
    } catch (err) {
      console.error("Error saving production entry:", err.response?.data || err);
      showAlert("Error", err.response?.data?.message || "Error saving production entry", "error");
    }
  };

  const exportProductionToExcel = () => {
    const data = displayedProduction.map((e, i) => ({
      "Sl No": displayedProduction.length - i,
      "Date": new Date(e.date).toLocaleDateString("en-IN"),
      "WO No": e.woNumber,
      "Customer": e.customerName || "-",
      "Job Name": e.jobName || "-",
      "Machine": e.machine?.length ? e.machine.join(", ") : "-",
      "Produced": e.producedQty ?? "-",
      "Wastage": e.wastageQty || "-",
      "Reason": e.reason || "-",
      "Remark": e.remark || "-",
      "Logged By": e.loggedBy || "-",
      "Logged At": e.createdAt ? new Date(e.createdAt).toLocaleString("en-IN") : "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Production Log");
    XLSX.writeFile(wb, `Production_Log_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const fetchPlateRequests = async () => {
    setPlateRequestsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/platerequest/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlateRequests(res.data || []);
    } catch (err) {
      console.error("Error fetching plate requests:", err);
      setPlateRequests([]);
    }
    setPlateRequestsLoading(false);
  };

  const fetchAllPlateRequests = async () => {
    setAllPlateRequestsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/platerequest`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllPlateRequests(res.data || []);
    } catch (err) {
      console.error("Error fetching plate request history:", err);
      setAllPlateRequests([]);
    }
    setAllPlateRequestsLoading(false);
  };

  // ===== "Done" clicked on a row -> saves snapshot to Preprocess table =====
  const handleDone = async (wo) => {
    const result = await Swal.fire({
      title: "Mark as done?",
      text: `Work Order ${wo.efiWoNumber} will be saved to the Prepress record.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2f9e60",
      cancelButtonColor: "#5f6c7a",
      confirmButtonText: "Yes, done",
      width: "350px"
    });

    if (!result.isConfirmed) return;

    setHiddenOrders(prev => [...prev, wo._id]);

    try {
      await axios.post(
        `${BASE_URL}/api/preprocess/complete`,
        { workOrderId: wo._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert("Success", `Work Order ${wo.efiWoNumber} marked done`, "success");
      fetchPending();
      fetchCompleted();
    } catch (err) {
      console.error("Error completing work order:", err.response?.data || err);
      setHiddenOrders(prev => prev.filter(id => id !== wo._id));
      showAlert(
        "Error",
        err.response?.data?.message || "Error marking work order done",
        "error"
      );
    }
  };

  // ===== Approve / Reject a Plate Request =====
  const handlePlateRequestDecision = async (request, decision) => {
    const isApprove = decision === "approve";

    const result = await Swal.fire({
      title: isApprove ? "Approve plate request?" : "Reject plate request?",
      text: `Job "${request.jobName}" for WO ${request.efiWoNumber}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: isApprove ? "#2f9e60" : "#d64545",
      cancelButtonColor: "#5f6c7a",
      confirmButtonText: isApprove ? "Yes, approve" : "Yes, reject",
      input: "text",
      inputPlaceholder: "Optional remarks",
      width: "360px"
    });

    if (!result.isConfirmed) return;

    setHiddenPlateRequests(prev => [...prev, request._id]);

    try {
      await axios.post(
        `${BASE_URL}/api/platerequest/${request._id}/${decision}`,
        { reviewRemarks: result.value || "" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert(
        "Success",
        `Plate request ${isApprove ? "approved" : "rejected"}`,
        "success"
      );
      fetchPlateRequests();
      fetchAllPlateRequests();
    } catch (err) {
      console.error("Error updating plate request:", err.response?.data || err);
      setHiddenPlateRequests(prev => prev.filter(id => id !== request._id));
      showAlert(
        "Error",
        err.response?.data?.message || "Error updating plate request",
        "error"
      );
    }
  };

  // Combined customer options from both Pending and Completed records
  const customerOptions = [
    ...new Set([
      ...workOrders.map(wo => wo.customer?.name || wo.customer),
      ...completedRecords.map(rec => rec.customer)
    ].filter(Boolean))
  ].sort((a, b) => String(a).localeCompare(String(b)));

  // Filtered Pending Work Orders
  const displayedWorkOrders = workOrders
    .filter(wo => !hiddenOrders.includes(wo._id))
    .filter(wo => filterWoNo === "" || String(wo.efiWoNumber).toLowerCase().includes(filterWoNo.trim().toLowerCase()))
    .filter(wo => {
      const customerName = wo.customer?.name || wo.customer || "";
      return filterCustomer === "" || customerName === filterCustomer;
    })
    .filter(wo => {
      if (filterMachine === "") return true;
      return wo.machines?.some(
        m => String(m.machineId?._id || m.machineId) === String(filterMachine)
      );
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Filtered Completed Prepress Records
  const displayedCompletedRecords = completedRecords
    .filter(rec => filterWoNo === "" || String(rec.efiWoNumber).toLowerCase().includes(filterWoNo.trim().toLowerCase()))
    .filter(rec => {
      const customerName = rec.customer || "";
      return filterCustomer === "" || customerName === filterCustomer;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const displayedPlateRequests = plateRequests
    .filter(r => !hiddenPlateRequests.includes(r._id))
    .filter(r => r.userLocations?.some(loc => userLocations.includes(loc)));

  const pendingPlateCount = displayedPlateRequests.length;

  const productionMachineOptions = [
    ...new Set(productionEntries.flatMap(e => e.machine || []).filter(Boolean))
  ];

  const truncCellStyle = (key) =>
    expandedCellKey === key
      ? { maxWidth: 260, whiteSpace: "normal", wordBreak: "break-word", cursor: "pointer" }
      : { maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" };

  const prCustomerOptions = [
    ...new Set(allPlateRequests.map(r => r.customerName).filter(Boolean))
  ];
  const prProductTypeOptions = [
    ...new Set(allPlateRequests.map(r => r.productType).filter(Boolean))
  ];

  const displayedAllPlateRequests = allPlateRequests
    .filter(r => r.userLocations?.some(loc => userLocations.includes(loc)))
    .filter(r => {
    const matchWo = prFilterWoNo === "" || String(r.efiWoNumber).toLowerCase().includes(prFilterWoNo.trim().toLowerCase());
    const matchCustomer = prFilterCustomer === "" || r.customerName === prFilterCustomer;
    const matchProductType = prFilterProductType === "" || r.productType === prFilterProductType;
    const matchStatus = prFilterStatus === "" || r.status === prFilterStatus;

    let matchDate = true;
    if (r.createdAt && (prFilterFromDate || prFilterToDate)) {
      const created = new Date(r.createdAt);
      if (prFilterFromDate) {
        const from = new Date(prFilterFromDate);
        from.setHours(0, 0, 0, 0);
        if (created < from) matchDate = false;
      }
      if (prFilterToDate) {
        const to = new Date(prFilterToDate);
        to.setHours(23, 59, 59, 999);
        if (created > to) matchDate = false;
      }
    }

    return matchWo && matchCustomer && matchProductType && matchStatus && matchDate;
  });

  const exportPlateRequestsToExcel = () => {
    const data = displayedAllPlateRequests.map((r, i) => ({
      "Sl No": i + 1,
      "WO No": r.efiWoNumber,
      "Customer": r.customerName || "-",
      "Job Description": r.jobDescription || r.jobName || "-",
      "Product Type": r.productType || "-",
      "Activity": r.activities?.length ? r.activities.join(", ") : "-",
      "Machine": r.machineNames?.length ? r.machineNames.join(", ") : "-",
      "Remarks": r.remarks || "-",
      "Status": r.status,
      "Requested By": r.requestedBy || "-",
      "Requested At": r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : "-",
      "Reviewed By": r.reviewedBy || "-",
      "Review Remarks": r.reviewRemarks || "-",
      "Reviewed At": r.reviewedAt ? new Date(r.reviewedAt).toLocaleString("en-IN") : "-"
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plate Requests");
    XLSX.writeFile(wb, `Plate_Requests_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const displayedProduction = productionEntries.filter(e => {
    if (productionMachineFilter !== "all" && !(e.machine || []).includes(productionMachineFilter)) return false;

    if (e.date && (productionFilterFromDate || productionFilterToDate)) {
      const entryDate = new Date(e.date);
      if (productionFilterFromDate) {
        const from = new Date(productionFilterFromDate);
        from.setHours(0, 0, 0, 0);
        if (entryDate < from) return false;
      }
      if (productionFilterToDate) {
        const to = new Date(productionFilterToDate);
        to.setHours(23, 59, 59, 999);
        if (entryDate > to) return false;
      }
    }

    if (!productionSearch.trim()) return true;
    const q = productionSearch.trim().toLowerCase();
    return (
      String(e.woNumber).toLowerCase().includes(q) ||
      (e.customerName || "").toLowerCase().includes(q) ||
      (e.jobName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ width: "100%", padding: 0, margin: 0 }}>
      <style>{preprocessStyles}</style>
      <div className="dashboard-container">
        
        {/* ===== GLOSSY HERO HEADER WITH VISIBLE PLATE NOTIFICATION SYSTEM ===== */}
        <div className="dashboard-heading">
          <div className="hero-left-branding">
            <div className="hero-emblem-3d">
              <Icons.Factory />
            </div>
            <div>
              <h3>Switch Pages👉🏼</h3>
              <p>
                {activeView === "workorders" && "Work orders pending prepress completion."}
                {activeView === "platerequests" && "Plate requests pending approval."}
                {activeView === "production" && "Production log for completed work orders."}
                {activeView === "prepressartwork" && "Artwork docket for prepress."}
              </p>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            {/* Header Notification Badge for Plate Requests */}
            {pendingPlateCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveView("platerequests")}
                className="d-flex align-items-center gap-2 border-0 shadow-sm"
                style={{
                  background: activeView === "platerequests"
                    ? "#d9f2e6"
                    : "#fbdcdc",
                  color: "#000",
                  borderRadius: "30px",
                  padding: "8px 16px",
                  fontWeight: "700",
                  fontSize: ".82rem",
                  cursor: "pointer",
                  animation: activeView === "platerequests" ? "none" : "pulseNotification 2s infinite",
                  transition: "transform .15s ease"
                }}
                title="Click to view pending plate requests"
              >
                <span style={{ fontSize: "14px" }}>🔔</span>
                <span>Plate Requests</span>
                <span
                  className="badge rounded-pill bg-white"
                  style={{
                    color: "#000",
                    fontWeight: "800",
                    fontSize: "11px",
                    padding: "3px 8px"
                  }}
                >
                  {pendingPlateCount}
                </span>
              </button>
            )}

            {/* View Selector with Corner Notification Badge */}
            <div style={{ position: "relative" }}>
              <select
                value={activeView}
                onChange={(e) => setActiveView(e.target.value)}
                style={{
                  border: "1px solid #cfd6de",
                  borderRadius: 6,
                  padding: "7px 14px",
                  paddingRight: "34px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#000",
                  background: "#fff",
                  boxShadow: "none",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <option value="workorders" style={{ color: "#1f2d3a" }}>Work Orders</option>
                <option value="platerequests" style={{ color: "#1f2d3a" }}>
                  Plate Requests {pendingPlateCount > 0 ? `(${pendingPlateCount})` : ""}
                </option>
                <option value="production" style={{ color: "#1f2d3a" }}>Plate Tracker</option>
                <option value="prepressartwork" style={{ color: "#1f2d3a" }}>Prepress Artwork</option>
              </select>

              {/* Floating Alert Pill on Dropdown when viewing other tabs */}
              {pendingPlateCount > 0 && activeView !== "platerequests" && (
                <span
                  onClick={() => setActiveView("platerequests")}
                  className="badge rounded-pill bg-danger text-white position-absolute"
                  style={{
                    top: "-8px",
                    right: "-6px",
                    padding: "4px 7px",
                    fontSize: "10.5px",
                    fontWeight: "800",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    border: "2px solid #ffffff"
                  }}
                  title={`${pendingPlateCount} Plate Requests Pending Approval`}
                >
                  {pendingPlateCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {activeView === "workorders" ? (
          <>
            {/* ===== FILTERS (Applies to both tables) ===== */}
            <div className="filter-bar production-real-filter-bar">
              <div className="pp-filter-title"><i className="bi bi-funnel"></i> Filters</div>
              <PoField className="pp-ffield" icon="bi-search" label="WO Number" filled={has(filterWoNo)}>
                <input
                  type="text"
                  className="po-input"
                  value={filterWoNo}
                  onChange={(e) => setFilterWoNo(e.target.value)}
                />
              </PoField>
              <PoField className="pp-ffield" icon="bi-person" label="Customer" alwaysFloat caret>
                <select
                  className="po-input"
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                >
                  <option value="">All Customers</option>
                  {customerOptions.map((cust, i) => (
                    <option key={i} value={cust}>{cust}</option>
                  ))}
                </select>
              </PoField>
              {(filterWoNo || filterCustomer || filterMachine) && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => { setFilterWoNo(""); setFilterCustomer(""); setFilterMachine(""); }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* ===== PENDING WORK ORDERS TABLE ===== */}
            <SectionHead
              icon={Icons.Reel}
              color="blue"
              title="Pending Work Orders"
              pill={`${displayedWorkOrders.length} pending`}
            />
            <div className="production-real-table-wrap" style={{ maxHeight: 280, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px", textAlign: "center" }}>SL No</th>
                    <th style={{ width: "90px", textAlign: "center" }}>WO NO</th>
                    <th style={{ minWidth: "120px", textAlign: "left" }}>Product Code</th>
                    <th style={{ minWidth: "220px", textAlign: "left" }}>Customer Name</th>
                    <th style={{ minWidth: "110px", textAlign: "right", paddingRight: "18px" }}>Order Qty</th>
                    <th style={{ width: "95px", textAlign: "center" }}>View PDF</th>
                    <th style={{ minWidth: "160px", textAlign: "left" }}>Planning</th>
                    <th style={{ width: "90px", textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="empty-state" colSpan="8">Loading...</td></tr>
                  ) : displayedWorkOrders.length === 0 ? (
                    <tr><td className="empty-state" colSpan="8">No Work Orders Pending for Prepress</td></tr>
                  ) : (
                    displayedWorkOrders.map(wo => {
                      const custName = wo.customer?.name || wo.customer || "-";
                      return (
                        <tr key={wo._id}>
                          <td style={{ textAlign: "center", fontWeight: "700" }}>{wo.slNo}</td>
                          <td style={{ textAlign: "center", fontWeight: "700", color: "#043a45" }}>{wo.efiWoNumber}</td>
                          <td style={{ textAlign: "left" }}>{wo.productCode}</td>
                          <td
                            style={{ ...truncCellStyle(`${wo._id}-customer`), textAlign: "left" }}
                            onClick={() => setExpandedCellKey(k => k === `${wo._id}-customer` ? null : `${wo._id}-customer`)}
                            title={typeof custName === "string" ? custName : ""}
                          >
                            {custName}
                          </td>
                          <td style={{ textAlign: "right", paddingRight: "18px", fontWeight: "700" }}>{wo.orderQty}</td>
                          <td style={{ textAlign: "center" }}>
                            {wo.itemPdfPath ? (
                              <a
                                href={`${BASE_URL}${wo.itemPdfPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-info"
                              >
                                View
                              </a>
                            ) : "-"}
                          </td>
                          <td style={{ textAlign: "left" }}>
                            {wo.planningUser
                              ? `${wo.planningUser} - ${new Date(wo.createdAt).toLocaleString("en-IN")}`
                              : "-"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleDone(wo)}
                            >
                              Done
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== COMPLETED RECORDS TABLE (TOP 50 WITH ALIGNED HEADERS) ===== */}
            <SectionHead
              icon={Icons.Factory}
              color="green"
              title="Completed Prepress Records"
              pill="Top 50 Entries"
            />

            <div className="production-real-table-wrap" style={{ maxHeight: 360, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ width: "70px", textAlign: "center" }}>SL No</th>
                    <th style={{ width: "90px", textAlign: "center" }}>WO NO</th>
                    <th style={{ minWidth: "120px", textAlign: "left" }}>Product Code</th>
                    <th style={{ minWidth: "220px", textAlign: "left" }}>Customer Name</th>
                    <th style={{ minWidth: "110px", textAlign: "right", paddingRight: "20px" }}>Order Qty</th>
                    <th style={{ width: "95px", textAlign: "center" }}>View PDF</th>
                    <th style={{ minWidth: "120px", textAlign: "left" }}>Planning</th>
                    <th style={{ minWidth: "130px", textAlign: "left" }}>Completed By</th>
                    <th style={{ minWidth: "160px", textAlign: "left" }}>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {completedLoading ? (
                    <tr><td className="empty-state" colSpan="9">Loading...</td></tr>
                  ) : displayedCompletedRecords.length === 0 ? (
                    <tr><td className="empty-state" colSpan="9">No Completed Records Found</td></tr>
                  ) : (
                    displayedCompletedRecords.slice(0, 50).map((rec, i) => {
                      const custName = rec.customer || "-";
                      const rowKey = rec._id || `completed-${i}`;
                      return (
                        <tr key={rowKey}>
                          <td style={{ textAlign: "center", fontWeight: "700" }}>{rec.slNo}</td>
                          <td style={{ textAlign: "center", fontWeight: "700", color: "#043a45" }}>{rec.efiWoNumber}</td>
                          <td style={{ textAlign: "left" }}>{rec.productCode}</td>
                          <td
                            style={{ ...truncCellStyle(`${rowKey}-customer`), textAlign: "left", fontWeight: "600" }}
                            onClick={() => setExpandedCellKey(k => k === `${rowKey}-customer` ? null : `${rowKey}-customer`)}
                            title={typeof custName === "string" ? custName : ""}
                          >
                            {custName}
                          </td>
                          <td style={{ textAlign: "right", paddingRight: "20px", fontWeight: "700" }}>
                            {rec.orderQty ? Number(rec.orderQty).toLocaleString("en-IN") : "-"}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {rec.itemPdfPath ? (
                              <a
                                href={`${BASE_URL}${rec.itemPdfPath}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-info px-2 py-1"
                                style={{ fontSize: "11.5px" }}
                              >
                                View
                              </a>
                            ) : "-"}
                          </td>
                          <td style={{ textAlign: "left" }}>{rec.planningUser || "-"}</td>
                          <td style={{ textAlign: "left" }}>{rec.assignedBy || "-"}</td>
                          <td style={{ textAlign: "left", fontSize: "12px" }}>
                            {rec.createdAt ? new Date(rec.createdAt).toLocaleString("en-IN") : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeView === "platerequests" ? (
          <>
            {/* ===== PLATE REQUESTS TABLE ===== */}
            <SectionHead
              icon={Icons.Alert}
              color="amber"
              title="Plate Requests Pending Approval"
              pill={`${displayedPlateRequests.length} pending`}
            />
            <div className="production-real-table-wrap" style={{ maxHeight: 300, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th>WO NO</th>
                    <th>Product Type</th>
                    <th>Job Description</th>
                    <th>Activity</th>
                    <th>Machine</th>
                    <th>Remarks</th>
                    <th>Requested By</th>
                    <th>Requested At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plateRequestsLoading ? (
                    <tr><td className="empty-state" colSpan="9">Loading...</td></tr>
                  ) : displayedPlateRequests.length === 0 ? (
                    <tr><td className="empty-state" colSpan="9">No Plate Requests Pending</td></tr>
                  ) : (
                    displayedPlateRequests.map(req => (
                      <tr key={req._id}>
                        <td>{req.efiWoNumber}</td>
                        <td>{req.productType || "-"}</td>
                        <td>{req.jobName}</td>
                        <td>{req.activities?.length ? req.activities.join(", ") : "-"}</td>
                        <td>{req.machineNames?.length ? req.machineNames.join(", ") : "-"}</td>
                        <td>{req.remarks || "-"}</td>
                        <td>{req.requestedBy}</td>
                        <td>{new Date(req.createdAt).toLocaleString("en-IN")}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handlePlateRequestDecision(req, "approve")}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handlePlateRequestDecision(req, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ===== ALL PLATE REQUESTS (full history, like PlateRequestForm) ===== */}
            <SectionHead
              icon={Icons.Search}
              color="purple"
              title="All Plate Requests"
              pill={`${displayedAllPlateRequests.length} records`}
            />

            <div className="filter-bar" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              <div className="pp-filter-title"><i className="bi bi-funnel"></i> Filters &amp; Downloads</div>
              <PoField className="pp-ffield" icon="bi-search" label="WO Number" filled={has(prFilterWoNo)}>
                <input
                  type="text"
                  className="po-input"
                  value={prFilterWoNo}
                  onChange={(e) => setPrFilterWoNo(e.target.value)}
                />
              </PoField>
              <PoField className="pp-ffield" icon="bi-person" label="Customer" alwaysFloat caret>
                <select
                  className="po-input"
                  value={prFilterCustomer}
                  onChange={(e) => setPrFilterCustomer(e.target.value)}
                >
                  <option value="">All Customers</option>
                  {prCustomerOptions.map((c, i) => (
                    <option key={i} value={c}>{c}</option>
                  ))}
                </select>
              </PoField>
              <PoField className="pp-ffield" icon="bi-tag" label="Product Type" alwaysFloat caret>
                <select
                  className="po-input"
                  value={prFilterProductType}
                  onChange={(e) => setPrFilterProductType(e.target.value)}
                >
                  <option value="">All Product Types</option>
                  {prProductTypeOptions.map((t, i) => (
                    <option key={i} value={t}>{t}</option>
                  ))}
                </select>
              </PoField>
              <PoField className="pp-ffield" icon="bi-flag" label="Status" alwaysFloat caret>
                <select
                  className="po-input"
                  value={prFilterStatus}
                  onChange={(e) => setPrFilterStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </PoField>
              <PoField className="pp-ffield" icon="bi-calendar-event" label="From Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={prFilterFromDate}
                  onChange={(e) => setPrFilterFromDate(e.target.value)}
                />
              </PoField>
              <PoField className="pp-ffield" icon="bi-calendar-check" label="To Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={prFilterToDate}
                  onChange={(e) => setPrFilterToDate(e.target.value)}
                />
              </PoField>
              {(prFilterWoNo || prFilterCustomer || prFilterProductType || prFilterStatus || prFilterFromDate || prFilterToDate) && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setPrFilterWoNo("");
                    setPrFilterCustomer("");
                    setPrFilterProductType("");
                    setPrFilterStatus("");
                    setPrFilterFromDate("");
                    setPrFilterToDate("");
                  }}
                >
                  Clear
                </button>
              )}
              <button
                className="btn btn-sm btn-success"
                onClick={exportPlateRequestsToExcel}
                style={{ whiteSpace: "nowrap" }}
              >
                Export
              </button>
            </div>

            <div className="production-real-table-wrap" style={{ maxHeight: 400, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: "90px" }}>WO NO</th>
                    <th style={{ minWidth: "160px" }}>Customer</th>
                    <th style={{ minWidth: "160px" }}>Job Description</th>
                    <th style={{ minWidth: "110px" }}>Product Type</th>
                    <th style={{ minWidth: "130px" }}>Activity</th>
                    <th style={{ minWidth: "130px" }}>Machine</th>
                    <th style={{ minWidth: "130px" }}>Remarks</th>
                    <th style={{ width: "130px" }}>Status</th>
                    <th style={{ minWidth: "150px" }}>Requested By</th>
                    <th style={{ minWidth: "120px" }}>Reviewed By</th>
                    <th style={{ minWidth: "130px" }}>Review Remarks</th>
                    <th style={{ minWidth: "150px" }}>Reviewed At</th>
                  </tr>
                </thead>
                <tbody>
                  {allPlateRequestsLoading ? (
                    <tr><td className="empty-state" colSpan="12">Loading...</td></tr>
                  ) : displayedAllPlateRequests.length === 0 ? (
                    <tr><td className="empty-state" colSpan="12">No Plate Requests Found</td></tr>
                  ) : (
                    displayedAllPlateRequests.map(req => (
                      <tr key={req._id}>
                        <td>{req.efiWoNumber}</td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-customer`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-customer` ? null : `${req._id}-pr-customer`)}
                          title={req.customerName}
                        >
                          {req.customerName || "-"}
                        </td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-job`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-job` ? null : `${req._id}-pr-job`)}
                          title={req.jobDescription || req.jobName}
                        >
                          {req.jobDescription || req.jobName}
                        </td>
                        <td>{req.productType || "-"}</td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-activity`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-activity` ? null : `${req._id}-pr-activity`)}
                          title={req.activities?.join(", ")}
                        >
                          {req.activities?.length ? req.activities.join(", ") : "-"}
                        </td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-machine`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-machine` ? null : `${req._id}-pr-machine`)}
                          title={req.machineNames?.join(", ")}
                        >
                          {req.machineNames?.length ? req.machineNames.join(", ") : "-"}
                        </td>
                        <td
                          style={truncCellStyle(`${req._id}-pr-remarks`)}
                          onClick={() => setExpandedCellKey(k => k === `${req._id}-pr-remarks` ? null : `${req._id}-pr-remarks`)}
                          title={req.remarks}
                        >
                          {req.remarks || "-"}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              req.status === "APPROVED"
                                ? "status-approved"
                                : req.status === "REJECTED"
                                ? "status-rejected"
                                : "status-pending"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{req.requestedBy || "-"}</div>
                          <div style={{ fontSize: "11px", color: "#5f6c7a" }}>
                            {req.createdAt ? new Date(req.createdAt).toLocaleString("en-IN") : "-"}
                          </div>
                        </td>
                        <td>{req.reviewedBy || "-"}</td>
                        <td>{req.reviewRemarks || "-"}</td>
                        <td>{req.reviewedAt ? new Date(req.reviewedAt).toLocaleString("en-IN") : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeView === "prepressartwork" ? (
          <PrepressArtworkDashboard />
        ) : (
          <>
            {/* ===== PRODUCTION LOG ===== */}
            <div className="filter-bar">
              <div className="pp-filter-title"><i className="bi bi-funnel"></i> Filters &amp; Downloads</div>
              <PoField className="pp-ffield pp-ffield-wide" icon="bi-search" label="Search WO, customer, job" filled={has(productionSearch)}>
                <input
                  type="text"
                  className="po-input"
                  value={productionSearch}
                  onChange={(e) => setProductionSearch(e.target.value)}
                />
              </PoField>
              <PoField className="pp-ffield" icon="bi-cpu" label="Machine" alwaysFloat caret>
                <select
                  className="po-input"
                  value={productionMachineFilter}
                  onChange={(e) => setProductionMachineFilter(e.target.value)}
                >
                  <option value="all">All Machines</option>
                  {productionMachineOptions.map((m, i) => (
                    <option key={i} value={m}>{m}</option>
                  ))}
                </select>
              </PoField>
              <PoField className="pp-ffield" icon="bi-calendar-event" label="From Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={productionFilterFromDate}
                  onChange={(e) => setProductionFilterFromDate(e.target.value)}
                />
              </PoField>
              <PoField className="pp-ffield" icon="bi-calendar-check" label="To Date" alwaysFloat>
                <input
                  type="date"
                  className="po-input"
                  value={productionFilterToDate}
                  onChange={(e) => setProductionFilterToDate(e.target.value)}
                />
              </PoField>
              {(productionFilterFromDate || productionFilterToDate) && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setProductionFilterFromDate("");
                    setProductionFilterToDate("");
                  }}
                >
                  Clear
                </button>
              )}
              <button
                className="btn btn-sm btn-success"
                onClick={exportProductionToExcel}
              >
                Export to Excel
              </button>
            </div>

            <SectionHead
              icon={Icons.Gauge}
              color="purple"
              title="Plate Tracker Log"
              pill={`${displayedProduction.length} entries`}
            />

            <div className="production-real-table-wrap" style={{ maxHeight: 380, overflowY: "auto", overflow: "auto" }}>
              <table className="production-real-table">
                <thead>
                  <tr>
                    <th style={{ width: "48px" }}>Sl No</th>
                    <th>Date</th>
                    <th>WO No</th>
                    <th>Customer</th>
                    <th>Job Name</th>
                    <th>Machine</th>
                    <th>Fresh plate</th>
                    <th>Wastage plate</th>
                    <th>Reason</th>
                    <th>Remark</th>
                    <th>Logged By</th>
                    <th>Logged At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productionLoading ? (
                    <tr><td className="empty-state" colSpan="13">Loading...</td></tr>
                  ) : displayedProduction.length === 0 ? (
                    <tr><td className="empty-state" colSpan="13">No Production Entries</td></tr>
                  ) : (
                    displayedProduction.slice(0, 30).map((e, i) => (
                      <tr key={e._id || i}>
                        <td>{displayedProduction.length - i}</td>
                        <td>{new Date(e.date).toLocaleDateString("en-IN")}</td>
                        <td>{e.woNumber}</td>
                        <td style={truncCellStyle(`${e._id}-customer`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-customer` ? null : `${e._id}-customer`)} title={e.customerName}>{e.customerName || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-job`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-job` ? null : `${e._id}-job`)} title={e.jobName}>{e.jobName || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-machine`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-machine` ? null : `${e._id}-machine`)} title={e.machine?.join(", ")}>{e.machine?.length ? e.machine.join(", ") : "-"}</td>
                        <td>{e.producedQty ?? "-"}</td>
                        <td>{e.wastageQty || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-reason`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-reason` ? null : `${e._id}-reason`)} title={e.reason}>{e.reason || "-"}</td>
                        <td style={truncCellStyle(`${e._id}-remark`)} onClick={() => setExpandedCellKey(k => k === `${e._id}-remark` ? null : `${e._id}-remark`)} title={e.remark}>{e.remark || "-"}</td>
                        <td>{e.loggedBy || "-"}</td>
                        <td>{e.createdAt ? new Date(e.createdAt).toLocaleString("en-IN") : "-"}</td>
                        <td>
                          {e.loggedBy === loggedInUser ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <button className="btn btn-sm btn-info" onClick={() => startEditProduction(e)}>Edit</button>
                              <button className="btn btn-sm btn-danger" onClick={() => deleteProductionEntry(e)}>Delete</button>
                            </div>
                          ) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <button className="pt-fab" onClick={() => setShowProductionForm(true)} aria-label="New entry">
              <Plus size={22} />
            </button>

          {showProductionForm && (() => {
  const closeForm = () => {
    setShowProductionForm(false);
    resetProductionForm();
  };

  return (
    <div className="pp-overlay" onClick={closeForm}>
      <div
        id="production-entry-modal"
        onClick={(e) => e.stopPropagation()}
        className="pp-modal po-split"
      >
        {/* Left info panel */}
        <div className="po-side">
          <div className="po-side-brand">Plate Tracker</div>

          <div className="po-side-hero">
            <h2>Let's Log</h2>
            <h1>{editingProductionId ? "Update" : "Entry"}</h1>
            <p>
              Enter the work order number and press Enter. Customer, job and
              machine are filled automatically from the work order.
            </p>
          </div>

          <div className="po-side-foot">
            {editingProductionId ? "Updating Entry" : "New Entry"}
          </div>
        </div>

        {/* Right form panel */}
        <div className="po-main">
          <div className="po-heading">
            <span>{editingProductionId ? "Edit PlateTracker Entry" : "New PlateTracker Entry"}</span>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={closeForm}
            />
          </div>

          <div className="po-grid">
            <PoField icon="bi-calendar-event" label="Date" required alwaysFloat>
              <input
                type="date"
                className="po-input"
                value={productionForm.date}
                onChange={(e) => setProductionForm({ ...productionForm, date: e.target.value })}
                required
              />
            </PoField>

            <PoField icon="bi-person" label="Customer" required alwaysFloat>
              <input
                type="text"
                className="po-input"
                value={productionForm.customerName || "-"}
                readOnly
              />
            </PoField>

            <div>
              <PoField icon="bi-upc-scan" label="WO No" required alwaysFloat>
                <input
                  className="po-input"
                  value={productionForm.woNumber}
                  onChange={(e) => handleProductionWoInput(e.target.value)}
                  onBlur={lookupProductionWo}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      lookupProductionWo();
                    }
                  }}
                  placeholder="Enter WO # & press Enter"
                />
              </PoField>
              {productionWoMatched === false && (
                <div className="pp-err">✕ No matching work order found</div>
              )}
            </div>

            <PoField icon="bi-card-text" label="Job Name" required alwaysFloat>
              <input
                type="text"
                className="po-input"
                value={productionForm.jobName || "-"}
                readOnly
              />
            </PoField>

            <PoField icon="bi-layers" label="Fresh plate" required alwaysFloat>
              <input
                type="number"
                min="0"
                className="po-input"
                value={productionForm.producedQty}
                onChange={(e) => setProductionForm({ ...productionForm, producedQty: e.target.value })}
                placeholder="0"
                required
              />
            </PoField>

            <PoField icon="bi-cpu" label="Machine" required alwaysFloat>
              <input
                type="text"
                className="po-input"
                value={productionForm.machine.join(", ") || "-"}
                readOnly
              />
            </PoField>

            <PoField icon="bi-trash3" label="Wastage plate" alwaysFloat>
              <input
                type="number"
                min="0"
                className="po-input"
                value={productionForm.wastageQty}
                onChange={(e) => setProductionForm({ ...productionForm, wastageQty: e.target.value })}
                placeholder="0"
              />
            </PoField>

            {Number(productionForm.wastageQty) > 0 ? (
              <PoField icon="bi-exclamation-triangle" label="Reason" required alwaysFloat>
                <input
                  className="po-input"
                  value={productionForm.reason}
                  onChange={(e) => setProductionForm({ ...productionForm, reason: e.target.value })}
                  placeholder="State reason for wastage"
                />
              </PoField>
            ) : (
              <PoField icon="bi-chat-left-text" label="Remark" alwaysFloat>
                <input
                  className="po-input"
                  value={productionForm.remark}
                  onChange={(e) => setProductionForm({ ...productionForm, remark: e.target.value })}
                  placeholder="Optional"
                />
              </PoField>
            )}

            {Number(productionForm.wastageQty) > 0 && (
              <div className="po-full">
                <PoField icon="bi-chat-left-text" label="Remark" alwaysFloat>
                  <input
                    className="po-input"
                    value={productionForm.remark}
                    onChange={(e) => setProductionForm({ ...productionForm, remark: e.target.value })}
                    placeholder="Optional"
                  />
                </PoField>
              </div>
            )}
          </div>

          <div className="po-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeForm}
            >
              Cancel
            </button>
            <button
              className="btn btn-po-save"
              disabled={
                !productionForm.date ||
                !productionForm.woNumber.trim() ||
                !productionForm.customerName.trim() ||
                !productionForm.jobName.trim() ||
                !productionForm.machine.length ||
                productionForm.producedQty === ""
              }
              onClick={addProductionEntry}
            >
              {editingProductionId ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
})()}
          </>
        )}
      </div>
    </div>
  );
}

export default PreprocessDashboard;