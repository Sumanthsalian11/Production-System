import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { Plus, Send, ArrowLeft, RotateCcw, CheckCircle2, Paperclip, Inbox } from "lucide-react";
import BASE_URL from "../config/api";

// KAS (requester) view of the Artwork Docket — restyled to the aqua-glass look
// of the Reel Register / Prepress pages. All data logic unchanged.

const GLOSSY_BLUE = "#fde3d8"; // light orange (active chips / send)
const BRAND = "#e4572e";

const kasArtworkStyles = `
  /* font loaded locally */
  .paw-container{position:relative;width:100%!important;max-width:none!important;box-sizing:border-box;min-height:100%;margin:0!important;padding:16px 18px 28px;overflow:hidden;border:0;font-family:'Source Sans 3','Segoe UI',system-ui,-apple-system,sans-serif;color:#1f2d3a;background:#f3f5f7}
  .paw-container>*{position:relative}

  .paw-heading{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 14px;padding:9px 18px;border-radius:6px;color:#1f2d3a;background:#fff;border:1px solid #dfe4e9;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .paw-heading h3{position:relative;z-index:1;margin:0;font-size:21px;font-weight:700;letter-spacing:-.4px;color:#043a45}
  .paw-heading p{position:relative;z-index:1;margin:2px 0 0;color:#5f6c7a;font-size:.85rem;font-weight:600}
  .paw-userchip{display:flex;align-items:center;gap:10px}
  .paw-avatar{width:32px;height:32px;border-radius:50%;background:#0f6b7c;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:600;flex-shrink:0;box-shadow:none}
  .paw-userinfo{font-size:12.5px;color:#1f2d3a;text-align:right;line-height:1.3}
  .paw-userinfo b{display:block;font-weight:700}.paw-userinfo span{color:#5f6c7a;font-size:11px;text-transform:uppercase;letter-spacing:.04em}

  .filter-bar{display:flex;justify-content:flex-end;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;border-radius:6px;background:#f8f9fa;border:1px solid #dfe4e9;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .filter-bar:before{content:"FILTER TICKETS";margin-right:auto;padding-left:5px;color:#043a45;font-size:.7rem;font-weight:600;letter-spacing:.12em}
  .filter-bar .form-control{min-height:36px;padding:6px 12px;border:1.5px solid #cfd6dd;border-radius:4px;color:#1f2d3a;background:#fff;font-size:13px;font-weight:600;box-shadow:none}
  .filter-bar .form-control::placeholder{color:#9aa5b1;font-weight:600;opacity:1}
  .filter-bar .form-control:focus{border-color:#0f6b7c;outline:none;box-shadow:0 0 0 3px rgba(15,107,124,.15)}

  .paw-container .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid transparent;border-radius:4px;font-weight:700;color:#fff;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,filter .12s ease}
  .paw-container .btn:hover:not(:disabled){transform:none;filter:brightness(1.04)}
  .paw-container .btn:active:not(:disabled){transform:none}
  .paw-container .btn:disabled{cursor:not-allowed;opacity:.5}
  .paw-container .btn-primary{background:#043a45;border-color:#043a45;box-shadow:none}
  .paw-container .btn-success{background:#e4572e;border-color:#e4572e;box-shadow:none}
  .paw-container .btn-secondary{background:#fff;color:#1f2d3a;border-color:#cfd6dd;box-shadow:none}
  .paw-container .btn-outline{background:#fff;color:#1f2d3a;border-color:#cfd6dd;box-shadow:none}

  .production-real-table-wrap{background:#fff;border:1px solid #dfe4e9;border-radius:6px;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .production-real-table-wrap::-webkit-scrollbar{width:8px;height:8px}
  .production-real-table-wrap::-webkit-scrollbar-track{background:#f1f3f5;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb{background:#c2ccd4;border-radius:8px}
  .production-real-table-wrap::-webkit-scrollbar-thumb:hover{background:#9fb0bd}
  .production-real-table{width:100%;min-width:0;margin:0;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:.81rem;color:#1f2d3a;background:#fff}
  .production-real-table th,.production-real-table td{overflow-wrap:anywhere;word-break:break-word;vertical-align:middle}
  .production-real-table thead th{position:sticky;top:0;z-index:1;padding:11px 10px;background:#f4f6f8!important;color:#5f6c7a!important;border:0!important;border-bottom:1px solid #dfe4e9!important;font-size:.7rem;font-weight:600;letter-spacing:.4px;text-transform:uppercase;white-space:nowrap}
  .production-real-table tbody td{padding:9px 10px;border:0!important;border-bottom:1px solid #edf0f3!important;border-right:1px solid #f3f5f7!important;font-weight:400;color:#1f2d3a;background:#fff}
  .production-real-table tbody tr{cursor:pointer;transition:background .12s ease}
  .production-real-table tbody tr:nth-child(even) td{background:#fff}
  .production-real-table tbody tr:hover td{background:#f1f7f8!important}
  .production-real-table .empty-state{padding:42px!important;color:#5f6c7a!important;font-weight:600;text-align:center}

  .paw-status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .paw-status .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
  .paw-detail-card{border-radius:6px;overflow:hidden;background:#fff;border:1px solid #dfe4e9;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .paw-detail-head{padding:16px 22px;border-bottom:1px solid #dfe4e9;background:#f8f9fa}
  .paw-thread{padding:20px 22px;display:flex;flex-direction:column;gap:14px;max-height:52vh;overflow-y:auto;background:#f8f9fa}
  .paw-thread::-webkit-scrollbar{width:8px}.paw-thread::-webkit-scrollbar-thumb{background:#c2ccd4;border-radius:8px}
  .paw-composer{border-top:1px solid #dfe4e9;background:#fff;padding:14px 18px}
  .paw-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#043a45;background:#e6f1f3;border:1px solid #dfe4e9;border-radius:4px;padding:5px 10px;max-width:220px;text-decoration:none}
  .paw-icon-btn{width:40px;height:40px;flex-shrink:0;border:1.5px solid #cfd6dd;border-radius:4px;background:#fff;color:#043a45;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:none}
  .paw-icon-btn:disabled{opacity:.5;cursor:not-allowed}
  .paw-back-btn{width:34px;height:34px;border-radius:50%;border:1px solid transparent;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;background:#0f6b7c;box-shadow:none}

  .paw-form-card{max-width:560px;margin:0 auto;padding:22px;border-radius:6px;background:#fff;border:1px solid #dfe4e9;box-shadow:0 1px 2px rgba(16,40,56,.06)}
  .paw-field-label{font-size:12px;font-weight:700;color:#1f2d3a;display:block;margin-bottom:6px;letter-spacing:.2px}
  .paw-form-input{width:100%;padding:10px 14px;border:1.5px solid #cfd6dd;border-radius:4px;font-size:14px;font-weight:600;outline:none;box-sizing:border-box;background:#fff;color:#1f2d3a;box-shadow:none;transition:all .2s cubic-bezier(.4,0,.2,1)}
  .paw-form-input::placeholder{color:#9aa5b1;font-weight:600}
  .paw-form-input:focus{border-color:#0f6b7c;box-shadow:0 0 0 3px rgba(15,107,124,.15)}
  .paw-form-input[readonly]{background:#f1f3f5;color:#6b7782;border-color:#cfd6dd;cursor:not-allowed;box-shadow:none}
  .paw-fab{position:fixed;bottom:28px;right:28px;width:54px;height:54px;border-radius:50%;color:#fff;border:1px solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#e4572e;box-shadow:0 4px 12px rgba(16,40,56,.25);transition:transform .12s ease}
  .paw-fab:hover{transform:none}
  .paw-fab:active{transform:none}

  /* =====================================================================
     PLANNER PAGE LOOK (appended override, presentation only)
     ===================================================================== */
  .paw-container{font-family:'Noto Sans','Segoe UI',system-ui,-apple-system,Arial,sans-serif;font-size:12.5px;color:#000;background:#f4f6f8;padding:24px 28px 40px}
  .dashboard-container .paw-container{background:none;padding:0;overflow:visible}
  .paw-heading{border-radius:8px;border:1px solid #e3e7ec;box-shadow:0 1px 3px rgba(16,24,40,.06);backdrop-filter:none;-webkit-backdrop-filter:none}
  .paw-heading h3{font-size:17px;color:#000;letter-spacing:0}
  .paw-heading p{font-size:12px;color:#000;font-weight:500}
  .paw-avatar{background:#d5e9ee;color:#000;border:1px solid #a9cdd6}
  .paw-userinfo,.paw-userinfo span{color:#000}
  .paw-back-btn{background:#d5e9ee;color:#000;border:1px solid #a9cdd6}
  .paw-detail-card{border-radius:8px;border-color:#e3e7ec}
  .paw-detail-head{background:#fafbfc;border-bottom-color:#e3e7ec}
  .paw-detail-head div,.paw-thread div{color:#000}
  .paw-thread{background:#f4f6f8}
  .paw-composer{border-top-color:#e3e7ec}
  .paw-chip{color:#000;background:#e8f3f6;border-color:#b9d6dd}
  .paw-icon-btn{width:38px;height:38px;border:1px solid #cfd6de;border-radius:6px;color:#000}
  .paw-status{font-size:11px;color:#000}
  .paw-fab{background:#e4572e;color:#fff}
  .paw-composer .btn:disabled{color:#9DA2B0!important}

  /* ---- outlined floating-label fields (Planner look) ---- */
  .paw-container .po-field{position:relative;display:flex;align-items:center;min-height:36px;background:#fff;border:1px solid #cfd6de;border-radius:6px;transition:border-color .15s ease,box-shadow .15s ease}
  .paw-container .po-field:focus-within{border-color:#0f5560;box-shadow:0 0 0 3px rgba(15,85,96,.15)}
  .paw-container .po-field.po-invalid{border-color:#d64545}
  .paw-container .po-field-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#000;font-size:.8rem;pointer-events:none;z-index:1}
  .paw-container .po-field .po-input{width:100%;min-height:34px;padding:6px 8px 6px 32px;border:none!important;outline:none;background:transparent!important;box-shadow:none!important;border-radius:6px;font-family:inherit;font-size:.8rem;font-weight:500;color:#000}
  .paw-container .po-field .po-input[readonly]{background:#f7f9fb!important}
  .paw-container .po-field textarea.po-input{min-height:34px;padding-top:10px;resize:vertical}
  .paw-container .po-field select.po-input{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:28px}
  .paw-container .po-field .po-input:disabled{background:#f1f3f5!important;cursor:not-allowed}
  .paw-container .po-field .po-input::placeholder{color:#6b7685;opacity:1}
  .paw-container .po-caret{position:absolute;right:10px;font-size:.7rem;color:#000;pointer-events:none}
  .paw-container .po-field-label{position:absolute;left:32px;top:50%;transform:translateY(-50%);max-width:calc(100% - 34px);overflow:hidden;text-overflow:ellipsis;padding:0 4px;background:#fff;color:#000;font-size:.8rem;font-weight:500;white-space:nowrap;pointer-events:none;transition:all .15s ease}
  .paw-container .po-field:focus-within .po-field-label,.paw-container .po-field.is-floated .po-field-label{top:0;left:24px;font-size:.62rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
  .paw-container .po-req{color:#d64545}

  /* ---- small light buttons, black text ---- */
  .paw-container .btn{font-size:12px;font-weight:600;border-radius:6px;color:#000!important;box-shadow:none}
  .paw-container .btn-sm{font-size:11px;min-height:26px;padding:3px 11px}
  .paw-container .btn:hover:not(:disabled){filter:none;color:#000!important}
  .paw-container .btn-primary{background:#fde3d8;border-color:#f5b9a1}
  .paw-container .btn-primary:hover:not(:disabled){background:#fbd0bf}
  .paw-container .btn-success{background:#d9f2e6;border-color:#a9dcc3}
  .paw-container .btn-success:hover:not(:disabled){background:#c5ebd6}
  .paw-container .btn-info{background:#e8f3f6;border-color:#b9d6dd}
  .paw-container .btn-info:hover:not(:disabled){background:#d5e9ee}
  .paw-container .btn-danger{background:#fbdcdc;border-color:#f0b4b4}
  .paw-container .btn-danger:hover:not(:disabled){background:#f7c7c7}
  .paw-container .btn-secondary,.paw-container .btn-outline{background:#fff;border-color:#cfd6de}

  /* ---- table: column heading colour, black text ---- */
  .paw-container .production-real-table{font-size:12px}
  .paw-container .production-real-table thead th{background:#a9d0d9!important;color:#000!important;border:1px solid #8fbcc7!important;font-size:10.5px;font-weight:700;letter-spacing:.4px;padding:9px 10px}
  .paw-container .production-real-table tbody td{color:#000!important;padding:7px 10px;border-bottom:1px solid #eef1f4!important;border-right:1px solid #f3f5f7!important}
  .paw-container .production-real-table tbody tr:nth-child(even) td{background:#fafbfc}
  .paw-container .production-real-table tbody tr:hover td{background:#fdeee8!important}
  .paw-container .production-real-table-wrap{border:1px solid #e3e7ec;border-radius:8px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
  .paw-container .production-real-table .empty-state{color:#000!important}

  /* ---- filter bar ---- */
  .paw-container .filter-bar{justify-content:flex-start;align-items:center;background:#fff;border:1px solid #e3e7ec;border-radius:8px;gap:12px 10px;padding:14px 16px 12px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
  .paw-container .filter-bar:before{display:none}
  .paw-container .pp-filter-title{flex:0 0 100%;display:flex;align-items:center;gap:7px;padding-left:8px;border-left:3px solid #e4572e;font-size:13px;font-weight:700;color:#000;margin-bottom:2px}
  .paw-container .pp-filter-title i{color:#e4572e;font-size:14px}
  .paw-container .filter-bar .pp-ffield{flex:1 1 170px;min-width:150px;max-width:230px}
  .paw-container .filter-bar .btn{height:34px}

  .paw-split.po-split{max-width:1000px;margin:0 auto 22px}
  .paw-split .paw-attach{display:flex;align-items:center;gap:8px;width:100%;padding:10px 13px;border:1px dashed #8fbcc7;border-radius:6px;font-size:12px;font-weight:600;color:#000;cursor:pointer;background:#e8f3f6}
  .paw-split .paw-attach:hover{background:#d5e9ee}
  .paw-split .paw-sublabel{font-size:11px;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:.4px;margin:2px 0 6px}
  .paw-split .paw-codeerr{font-size:11.5px;color:#d64545;margin-top:5px;font-weight:600}

  /* ---- split form card (teal info panel + white form) ---- */
  .paw-split.po-split{display:flex;background:#fff;border:1px solid #e3e7ec;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.07)}
  .paw-split .po-side{flex:0 0 28%;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:24px;color:#fff;background:linear-gradient(170deg,#0b3a45 0%,#0f5560 100%)}
  .paw-split .po-side::before{content:'';position:absolute;width:260px;height:260px;border-radius:50%;right:-110px;top:-90px;background:rgba(255,255,255,.06)}
  .paw-split .po-side::after{content:'';position:absolute;width:200px;height:200px;border-radius:50%;left:-90px;bottom:-80px;background:rgba(228,87,46,.18)}
  .paw-split .po-side>*{position:relative;z-index:1}
  .paw-split .po-side-brand{font-weight:700;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;color:#ffb59c}
  .paw-split .po-side-hero h2{margin:0;padding:0;color:#fff!important;font-size:21px;font-weight:600;line-height:1.15}
  .paw-split .po-side-hero h1{margin:0 0 12px;color:#fff!important;font-size:36px;font-weight:700;line-height:1;letter-spacing:-.5px}
  .paw-split .po-side-hero p{margin:0;max-width:210px;font-size:12px;line-height:1.55;color:#c9dde1}
  .paw-split .po-side-foot{color:#ffb59c;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
  .paw-split .po-main{flex:1;min-width:0;padding:22px 28px;background:#fff}
  .paw-split .po-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#000;font-size:17px;font-weight:700;padding-bottom:10px;margin-bottom:16px;border-bottom:1px solid #e3e7ec}
  .paw-split .po-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}
  .paw-split .po-grid .po-full{grid-column:1/-1}
  .paw-split .po-actions{display:flex;justify-content:center;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid #e3e7ec}
  .paw-split .po-actions .btn{min-width:150px;height:38px;padding:0 18px;font-size:12.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
  .paw-split .po-actions .btn-po-save{background:#e4572e!important;border:1px solid #e4572e!important;color:#fff!important;box-shadow:0 1px 2px rgba(228,87,46,.35)}
  .paw-split .po-actions .btn-po-save:hover:not(:disabled){background:#c9461f!important;border-color:#c9461f!important}
  .paw-split .po-actions .btn-po-save:disabled{background:#e2e4ea!important;border-color:#e2e4ea!important;color:#9DA2B0!important;box-shadow:none}
  @media(max-width:992px){.paw-split.po-split{flex-direction:column}.paw-split .po-side{flex:none;min-height:150px;padding:20px;gap:14px}.paw-split .po-side-hero h1{font-size:28px;margin-bottom:6px}.paw-split .po-main{padding:18px 14px}.paw-split .po-grid{grid-template-columns:1fr}}

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
  .paw-container { animation: pgfade 0.45s ease-out backwards; }

  /* header drops in */
  .paw-container .paw-heading {
    animation: pgfadedown 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
  }

  /* list view: filters + table */
  .paw-container .filter-bar {
    animation: pgfadeup 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
  }
  .paw-container .production-real-table-wrap {
    animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.3s backwards;
  }

  /* table rows: quick stagger on the first rows */
  .paw-container .production-real-table tbody tr { animation: pgrow 0.35s ease-out backwards; }
  .paw-container .production-real-table tbody tr:nth-child(1)  { animation-delay: 0.45s; }
  .paw-container .production-real-table tbody tr:nth-child(2)  { animation-delay: 0.50s; }
  .paw-container .production-real-table tbody tr:nth-child(3)  { animation-delay: 0.55s; }
  .paw-container .production-real-table tbody tr:nth-child(4)  { animation-delay: 0.60s; }
  .paw-container .production-real-table tbody tr:nth-child(5)  { animation-delay: 0.65s; }
  .paw-container .production-real-table tbody tr:nth-child(6)  { animation-delay: 0.70s; }
  .paw-container .production-real-table tbody tr:nth-child(7)  { animation-delay: 0.75s; }
  .paw-container .production-real-table tbody tr:nth-child(8)  { animation-delay: 0.80s; }
  .paw-container .production-real-table tbody tr:nth-child(n+9) { animation-delay: 0.85s; }

  /* floating + button */
  .paw-container .paw-fab { animation: pgfab 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.55s backwards; }

  /* new ticket form (plays every time it opens) */
  .paw-container .paw-split {
    animation: pgpop 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.1s backwards;
  }
  .paw-container .paw-split .po-side {
    animation: pgslideright 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.25s backwards;
  }
  .paw-container .paw-split .po-heading,
  .paw-container .paw-split .po-grid,
  .paw-container .paw-split .po-actions { animation: pgfadeup 0.45s ease-out backwards; }
  .paw-container .paw-split .po-heading { animation-delay: 0.30s; }
  .paw-container .paw-split .po-grid    { animation-delay: 0.38s; }
  .paw-container .paw-split .po-actions { animation-delay: 0.46s; }

  /* ticket detail / chat */
  .paw-container .paw-detail-card {
    animation: pgfadeup 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.2s backwards;
  }
  .paw-container .paw-thread > div { animation: pgrow 0.35s ease-out 0.35s backwards; }

  /* respect users who disable motion */
  @media (prefers-reduced-motion: reduce) {
    .paw-container,
    .paw-container * {
      animation: none !important;
    }
  }
`;

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

const STATUS_META = {
  open: { label: "New", fg: "#000", bg: "#FCF1DC", dot: "#E3A63D" },
  in_progress: { label: "In progress", fg: "#000", bg: "#e6f1f3", dot: "#0f6b7c" },
  changes_submitted: { label: "In review", fg: "#000", bg: "#F1ECFD", dot: "#8B5CF6" },
  closed: { label: "Closed", fg: "#000", bg: "#E6F6F0", dot: "#1FA37B" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "changes_submitted", label: "Review" },
  { key: "closed", label: "Closed" },
];

function StatusPill({ status }) {
  const s = STATUS_META[status] || STATUS_META.open;
  return (
    <span className="paw-status" style={{ background: s.bg, color: s.fg }}>
      <span className="dot" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  if (isYesterday) return "Yesterday · " + time;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  return date + " · " + time;
}

export default function KasArtworkDashboard() {
  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;
  const config = { headers: { Authorization: `Bearer ${token}` } };

  const [tickets, setTickets] = useState([]);
  const [view, setView] = useState("list"); // list | new | detail
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [ticketFilter, setTicketFilter] = useState("");
  const [form, setForm] = useState({ materialCode: "", customerName: "", variant: "", remarks: "" });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgFiles, setMsgFiles] = useState([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [items, setItems] = useState([]);
  const [codeNotFound, setCodeNotFound] = useState(false);
  const threadEndRef = useRef(null);
  const msgFileInputRef = useRef(null);
  const newFileInputRef = useRef(null);
  const active = tickets.find((t) => t.ticketId === activeId);

  useEffect(() => {
    fetchTickets();
    fetchItems();
  }, []);

  useEffect(() => {
    if (view === "detail") threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [view, active?.messages?.length]);

  async function fetchTickets() {
    const res = await axios.get(BASE_URL + "/api/artwork/tickets", config);
    setTickets(res.data);
  }

  async function fetchOne(ticketId) {
    const res = await axios.get(BASE_URL + "/api/artwork/tickets/" + ticketId, config);
    setTickets((prev) => {
      const others = prev.filter((t) => t.ticketId !== ticketId);
      return [res.data, ...others];
    });
  }

  async function fetchItems() {
    const res = await axios.get(BASE_URL + "/api/master/items", config);
    setItems(res.data);
  }

  function handleMaterialCodeChange(value) {
    const match = items.find((i) => i.itemCode?.toLowerCase() === value.trim().toLowerCase());
    if (match) {
      setForm((f) => ({ ...f, materialCode: value, customerName: match.customerName || "", variant: match.materialType || "" }));
      setCodeNotFound(false);
    } else {
      setForm((f) => ({ ...f, materialCode: value, customerName: "", variant: "" }));
      setCodeNotFound(value.trim().length > 0);
    }
  }

  function handleFileChange(e) {
    setFiles(Array.from(e.target.files || []));
    e.target.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMsgFileChange(e) {
    const picked = Array.from(e.target.files || []);
    setMsgFiles((prev) => [...prev, ...picked]);
    e.target.value = "";
  }

  function removeMsgFile(index) {
    setMsgFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function createTicket() {
    if (!form.materialCode.trim() || !form.customerName.trim() || !form.remarks.trim()) return;
    try {
      setUploading(true);
      const data = new FormData();
      data.append("materialCode", form.materialCode);
      data.append("customerName", form.customerName);
      data.append("variant", form.variant);
      data.append("remarks", form.remarks);
      files.forEach((f) => data.append("attachments", f));

      const res = await axios.post(BASE_URL + "/api/artwork/tickets", data, {
        headers: config.headers,
      });
      setTickets((prev) => [res.data, ...prev]);
      setForm({ materialCode: "", customerName: "", variant: "", remarks: "" });
      setFiles([]);
      setCodeNotFound(false);
      setActiveId(res.data.ticketId);
      setView("detail");
    } catch (err) {
      console.error("createTicket failed:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Failed to raise ticket. Check the file type/size and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage() {
    if ((!msgText.trim() && msgFiles.length === 0) || !active) return;

    const textToSend = msgText;
    const filesToSend = msgFiles;

    try {
      setSendingMsg(true);
      const data = new FormData();
      data.append("text", textToSend);
      filesToSend.forEach((f) => data.append("attachments", f));

      const res = await axios.post(
        BASE_URL + "/api/artwork/tickets/" + active.ticketId + "/messages",
        data,
        { headers: config.headers }
      );

      setTickets((prev) => prev.map((t) => (t.ticketId === active.ticketId ? res.data : t)));
      setMsgText("");
      setMsgFiles([]);

      const lastMsg = res.data.messages[res.data.messages.length - 1];
      if (filesToSend.length > 0 && (!lastMsg.attachments || lastMsg.attachments.length === 0)) {
        console.warn("[sendMessage] Files were sent but the server saved the message with NO attachments. This points to a backend issue (multer/file filter/route), not the frontend.");
      }
    } catch (err) {
      console.error("sendMessage failed:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Failed to send message. Check the file type/size and try again.");
    } finally {
      setSendingMsg(false);
    }
  }

  async function doAction(action) {
    const res = await axios.patch(BASE_URL + "/api/artwork/tickets/" + active.ticketId + "/status", { action }, config);
    setTickets((prev) => prev.map((t) => (t.ticketId === active.ticketId ? res.data : t)));
  }

  const visibleTickets = tickets.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (customerFilter.trim() && !(t.customerName || "").toLowerCase().includes(customerFilter.trim().toLowerCase())) return false;
    if (ticketFilter.trim() && !(t.ticketId || "").toLowerCase().includes(ticketFilter.trim().toLowerCase())) return false;
    return true;
  });

  const initials = (name) =>
    (name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  const HeadingBar = ({ title, subtitle, onBack, center }) => (
    <div
      className="paw-heading"
      style={center ? { justifyContent: "center", textAlign: "center" } : undefined}
    >
      <div className="d-flex align-items-center gap-3">
        {onBack && (
          <button
            className="paw-back-btn"
            onClick={onBack}
            style={center ? { position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)" } : undefined}
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {/* <div className="paw-userchip">
        <div className="paw-avatar">{initials(user?.name)}</div>
        <div className="paw-userinfo">
          <b>{user?.name}</b>
          <span>Requester</span>
        </div>
      </div> */}
    </div>
  );

  // ---------- New ticket ----------
  if (view === "new") {
    const canSubmit = form.materialCode.trim() && form.customerName.trim() && form.remarks.trim() && !uploading;
    return (
      <div style={{ width: "100%", padding: 0, margin: 0 }}>
        <style>{kasArtworkStyles}</style>
        <div className="paw-container">
          <HeadingBar title="New ticket" subtitle="Raise a new artwork request." onBack={() => setView("list")} center />

          <div className="paw-split po-split">
            {/* Left info panel */}
            <div className="po-side">
              <div className="po-side-brand">Artwork Docket</div>

              <div className="po-side-hero">
                <h2>Let's Raise</h2>
                <h1>Ticket</h1>
                <p>
                  Enter the item code to auto-fill the customer and variant,
                  describe the artwork change and attach the files.
                </p>
              </div>

              <div className="po-side-foot">New Ticket</div>
            </div>

            {/* Right form panel */}
            <div className="po-main">
              <div className="po-heading">Raise a New Artwork Ticket</div>

              <div className="po-grid">
                <div className="po-full">
                  <PoField
                    icon="bi-upc-scan"
                    label="Material code (item code)"
                    required
                    filled={has(form.materialCode)}
                    invalid={codeNotFound}
                  >
                    <input
                      className="po-input"
                      list="item-code-options"
                      value={form.materialCode}
                      onChange={(e) => handleMaterialCodeChange(e.target.value)}
                      placeholder="e.g. MC-90112-B"
                    />
                  </PoField>
                  <datalist id="item-code-options">
                    {items.map((i) => (
                      <option key={i._id} value={i.itemCode} />
                    ))}
                  </datalist>
                  {codeNotFound && (
                    <div className="paw-codeerr">
                      No item found with this code — customer/variant won't auto-fill.
                    </div>
                  )}
                </div>

                <PoField icon="bi-person" label="Customer name" alwaysFloat>
                  <input className="po-input" value={form.customerName} readOnly placeholder="Auto-filled from item code" />
                </PoField>

                <PoField icon="bi-tag" label="Variant (material type)" alwaysFloat>
                  <input className="po-input" value={form.variant} readOnly placeholder="Auto-filled from item code" />
                </PoField>

                <div className="po-full">
                  <PoField icon="bi-chat-left-text" label="Remarks" required alwaysFloat>
                    <textarea
                      className="po-input"
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                      placeholder="Describe the new artwork or the change needed"
                      rows={3}
                    />
                  </PoField>
                </div>

                <div className="po-full">
                  <div className="paw-sublabel">Attachments (PDF, Excel, images)</div>
                  <button
                    type="button"
                    className="paw-attach"
                    onClick={() => newFileInputRef.current?.click()}
                  >
                    <Paperclip size={14} />
                    {files.length > 0 ? files.length + " file" + (files.length !== 1 ? "s" : "") + " selected" : "Click to attach files"}
                  </button>
                  <input
                    ref={newFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.xls,.xlsx,image/png,image/jpeg"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  {files.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {files.map((f, i) => (
                        <span key={i} className="paw-chip">
                          <Paperclip size={12} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <button onClick={() => removeFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#000", padding: 0, marginLeft: 2 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="po-actions">
                <button
                  className="btn btn-po-save"
                  onClick={createTicket}
                  disabled={!canSubmit}
                >
                  {uploading ? "Raising ticket…" : "Raise ticket"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Detail / chat ----------
  if (view === "detail" && active) {
    const canRequestRevision = active.status === "changes_submitted";
    const canClose = active.status === "changes_submitted";
    const canReopen = active.status === "closed";
    const isClosed = active.status === "closed";

    return (
      <div style={{ width: "100%", padding: 0, margin: 0 }}>
        <style>{kasArtworkStyles}</style>
        <div className="paw-container">
          <HeadingBar title={active.ticketId} subtitle={`${active.materialCode} · ${active.customerName}`} onBack={() => setView("list")} />

          <div className="paw-detail-card">
            <div className="paw-detail-head">
              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <div style={{ fontWeight: 700, color: "#043a45", fontSize: 13 }}>{active.materialCode}</div>
                  <div style={{ fontSize: 13, color: "#3b4a58", marginTop: 3 }}>
                    {active.customerName} <span style={{ color: "#c2ccd4" }}>·</span> {active.variant || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#5f6c7a", marginTop: 4 }}>
                    Raised by {active.createdBy} · {formatTime(active.createdAt)}
                  </div>
                </div>
                <StatusPill status={active.status} />
              </div>

              {active.attachments && active.attachments.length > 0 ? (
                <div className="d-flex flex-wrap gap-2 mt-3">
                  {active.attachments.map((a, i) => (
                    <a key={i} className="paw-chip" href={BASE_URL + a.url} target="_blank" rel="noreferrer">
                      <Paperclip size={12} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.originalName}</span>
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="d-flex flex-wrap gap-2 mt-3">
                {canRequestRevision && (
                  <button className="btn btn-sm btn-outline" onClick={() => doAction("revise")}>
                    <RotateCcw size={13} style={{ marginRight: 5 }} /> Request revision
                  </button>
                )}
                {canClose && (
                  <button className="btn btn-sm btn-success" onClick={() => doAction("close")}>
                    <CheckCircle2 size={13} style={{ marginRight: 5 }} /> Close ticket
                  </button>
                )}
                {canReopen && (
                  <button className="btn btn-sm btn-outline" onClick={() => doAction("reopen")}>
                    <RotateCcw size={13} style={{ marginRight: 5 }} /> Reopen ticket
                  </button>
                )}
              </div>
            </div>

            <div className="paw-thread">
              {active.messages.map((m) => {
                const mine = m.sender === user?.name;
                if (m.type === "status") {
                  return (
                    <div key={m._id} style={{ textAlign: "center", fontSize: 11.5, color: "#5f6c7a", fontWeight: 600, display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
                      <span style={{ flex: 1, height: 1, background: "#dfe4e9" }} />
                      <span style={{ whiteSpace: "nowrap" }}>{m.sender} {m.text.toLowerCase()} · {formatTime(m.time)}</span>
                      <span style={{ flex: 1, height: 1, background: "#dfe4e9" }} />
                    </div>
                  );
                }
                return (
                  <div key={m._id} style={{ display: "flex", gap: 8, justifyContent: mine ? "flex-end" : "flex-start" }}>
                    {!mine && (
                      <div className="paw-avatar" style={{ width: 28, height: 28, fontSize: 10.5 }}>
                        {initials(m.sender)}
                      </div>
                    )}
                    <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                      <div style={{ fontSize: 11, color: "#5f6c7a", marginBottom: 4, fontWeight: 600, padding: "0 2px" }}>
                        {mine ? "You" : m.sender} <span style={{ color: "#c2ccd4" }}>·</span> {m.role === "PREPRESS" ? "Prepress" : "KAS"}
                      </div>
                      <div
                        style={{
                          background: mine ? "#d5e9ee" : "#fff",
                          color: "#000",
                          border: mine ? "1px solid #a9cdd6" : "1px solid #e3e7ec",
                          borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          padding: "10px 13px",
                          boxShadow: "0 1px 2px rgba(16,24,40,.06)",
                        }}
                      >
                        {m.text ? <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.text}</div> : null}
                        {m.attachments && m.attachments.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: m.text ? 8 : 0 }}>
                            {m.attachments.map((a, ai) => (
                              
                               <a key={ai}
                                href={BASE_URL + a.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500,
                                  color: "#000",
                                  border: mine ? "1px solid #a9cdd6" : "1px solid #e3e7ec",
                                  borderRadius: 8, padding: "6px 10px",
                                  background: mine ? "rgba(255,255,255,0.6)" : "#f1f7f8",
                                  maxWidth: 220, overflow: "hidden", textDecoration: "none",
                                }}
                              >
                                <Paperclip size={12} style={{ flexShrink: 0, opacity: .8 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.originalName}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#9aa5b1", marginTop: 4, padding: "0 2px" }}>{formatTime(m.time)}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            <div className="paw-composer">
              {msgFiles.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {msgFiles.map((f, i) => (
                    <span key={i} className="paw-chip">
                      <Paperclip size={12} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button onClick={() => removeMsgFile(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9aa5b1", padding: 0, marginLeft: 2 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="d-flex gap-2 align-items-center">
                <button
                  type="button"
                  className="paw-icon-btn"
                  onClick={() => !isClosed && msgFileInputRef.current?.click()}
                  disabled={isClosed}
                >
                  <Paperclip size={16} />
                </button>
                <input
                  ref={msgFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xls,.xlsx,image/png,image/jpeg"
                  onChange={handleMsgFileChange}
                  disabled={isClosed}
                  style={{ display: "none" }}
                />
                <input
                  className="form-control"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={isClosed ? "Ticket is closed" : "Write a note..."}
                  disabled={isClosed}
                  style={{ flex: 1, height: 38, borderRadius: 6, border: "1px solid #cfd6de", fontWeight: 500, fontSize: 12.5, color: "#000", boxShadow: "none" }}
                />
                <button
                  className="btn"
                  onClick={sendMessage}
                  disabled={(!msgText.trim() && msgFiles.length === 0) || isClosed || sendingMsg}
                  style={{
                    padding: "0 16px", height: 38, borderRadius: 6,
                    border: (msgText.trim() || msgFiles.length > 0) && !isClosed ? "1px solid #f5b9a1" : "none",
                    background: (msgText.trim() || msgFiles.length > 0) && !isClosed ? GLOSSY_BLUE : "#e2e4ea",
                    boxShadow: (msgText.trim() || msgFiles.length > 0) && !isClosed ? "none" : "none",
                    color: (msgText.trim() || msgFiles.length > 0) && !isClosed ? "#000" : "#9DA2B0",
                    display: "flex", alignItems: "center", flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- List ----------
  return (
    <div style={{ width: "100%", padding: 0, margin: 0 }}>
      <style>{kasArtworkStyles}</style>
      <div className="paw-container">
        <div className="d-flex gap-2 flex-wrap mb-3">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="btn btn-sm"
              onClick={() => setFilter(f.key)}
              style={{
                border: "1px solid " + (filter === f.key ? "#f5b9a1" : "#cfd6de"),
                background: filter === f.key ? GLOSSY_BLUE : "#fff",
                color: "#000",
                textShadow: filter === f.key ? undefined : "none",
                boxShadow: "none",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <div className="pp-filter-title"><i className="bi bi-funnel"></i> Filter Tickets</div>
          <PoField className="pp-ffield" icon="bi-person" label="Customer" filled={has(customerFilter)}>
            <input
              type="text"
              className="po-input"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            />
          </PoField>
          <PoField className="pp-ffield" icon="bi-ticket-perforated" label="Ticket ID" filled={has(ticketFilter)}>
            <input
              type="text"
              className="po-input"
              value={ticketFilter}
              onChange={(e) => setTicketFilter(e.target.value)}
            />
          </PoField>
          {(customerFilter || ticketFilter || filter !== "all") && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => { setCustomerFilter(""); setTicketFilter(""); setFilter("all"); }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="production-real-table-wrap" style={{ maxHeight: 380, overflowY: "auto", overflow: "auto" }}>
          <table className="production-real-table">
            <thead>
              <tr>
                <th style={{ width: "110px" }}>Ticket</th>
                <th style={{ minWidth: "120px" }}>Material code</th>
                <th style={{ minWidth: "180px" }}>Customer</th>
                <th style={{ minWidth: "100px" }}>Variant</th>
                <th style={{ width: "110px" }}>Status</th>
                <th style={{ width: "80px", textAlign: "center" }}>Notes</th>
                <th style={{ minWidth: "150px" }}>Last update</th>
                <th style={{ width: "80px", textAlign: "center" }}>Files</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.length === 0 && (
                <tr>
                  <td className="empty-state" colSpan={8}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <Inbox size={26} strokeWidth={1.5} />
                      No tickets in this queue yet.
                    </div>
                  </td>
                </tr>
              )}
              {visibleTickets.slice(0, 30).map((t) => (
                <tr
                  key={t.ticketId}
                  onClick={() => {
                    setActiveId(t.ticketId);
                    fetchOne(t.ticketId);
                    setView("detail");
                  }}
                >
                  <td style={{ fontWeight: 700, color: "#043a45" }}>{t.ticketId}</td>
                  <td>{t.materialCode}</td>
                  <td style={{ fontWeight: 600 }}>{t.customerName}</td>
                  <td>{t.variant || "—"}</td>
                  <td><StatusPill status={t.status} /></td>
                  <td style={{ textAlign: "center" }}>{t.messages?.length || 0}</td>
                  <td>{formatTime(t.updatedAt)}</td>
                  <td style={{ textAlign: "center" }}>
                    {t.attachments && t.attachments.length > 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Paperclip size={12} /> {t.attachments.length}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="paw-fab" onClick={() => setView("new")} aria-label="New ticket">
          <Plus size={22} />
        </button>
      </div>
    </div>
  );
}