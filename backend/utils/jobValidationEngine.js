/**
 * Job Validation engine  (port of Code.gs buildReport_ and helpers)
 * Pure functions: no database calls. Place at  backend/utils/jobValidationEngine.js
 *
 * D = { setup:{settings,rates,routes,mats,overrides}, prod:{rows}, cons:{rows}, plan:{rows} }
 * Every row is an object whose keys are the LOWER-CASED column headers (same as table_() in Code.gs).
 */

/* ---------------------------- upload spec ---------------------------- */
const UPLOAD_SPEC = {
  production: {
    label: "Production log",
    need: [["wo no", "wo no.", "work order"], ["date"], ["machine status"], ["machine"], ["stage"], ["production qty"], ["from time (12h)", "from time"], ["to time (12h)", "to time"]],
  },
  consumption: {
    label: "SAP consumption report",
    need: [["transp name/ w.o.no", "transp name/w.o.no", "wo no", "indent/invoice no."], ["material"], ["material description"], ["issued/receipt qty", "quantity in buom"], ["total value", "ext. amount in local currency"], ["posting date", "document date"]],
  },
  planning: {
    label: "Planning (optional)",
    need: [["wo no", "wo no.", "work order"]],
  },
};

/* ---------------------------- default setup ---------------------------- */
function routeRows() {
  const P = "Printing", C = "Cutting", D = "Die", L = "Lamination", W = "Window film and envelope making";
  const BK = "Book making/stitching/gumming";
  const list = [
    ["DEFAULT", [P, C]],
    ["CHEQUE", [P, C]], ["WELCOME PAGE", [P, C]], ["WELCOME LETTER", [P, C]], ["LETTER", [P, C]], ["INSERT", [P, C]],
    ["REQUISITION SLIP", [P, C]], ["RECORDSLIP", [P, D, C]], ["LEAFLET", [P, C, "Folding"]],
    ["PASSBOOK", [P, C, BK]], ["BOOKLET", [P, C, BK]], ["USERGIDE", [P, C, BK]], ["USERGUIDE", [P, C, BK]],
    ["POUCH", [P, C, D, "Pouch making"]], ["COVER PAGE", [P, L, D, C]],
    ["ENVELOPE", [P, C, D, W, "Strip gumming"]], ["CERTIFICATE BOOK", [P, C, BK]],
    ["STAMP PAPER", [P, C]], ["CERTIFICATE", [P, C]], ["DEPOSIT RECIEPT", [P, C]], ["DEPOSIT RECEIPT", [P, C]],
    ["PAYING SLIP", [P, C]], ["MANDATE FORM", [P, C]], ["OMR", [P, C]], ["RECEIPTS", [P, C]], ["BLANK SHEETS", [P, C]],
    ["ADDRESS CHANGE", [P, C]], ["GUIDELINES SLIP", [P, C]], ["REQUEST SLIP", [P, C]], ["SECURE PRINTING", [P, C]],
    ["PLAIN PAPER", [C]], ["AADHAAR SHEET", [C]],
  ];
  return list.map(([name, st]) => {
    const other = st.filter((n) => ![P, C, D, L, W].includes(n));
    const has = (n) => st.includes(n);
    return {
      "product type": name,
      "printing": has(P) ? "ACTUAL" : "",
      "cutting": has(C) ? "CUTTING MACHINE" : "",
      "die punch": has(D) ? "HMT" : "",
      "w&d": has(W) ? "W&D" : "",
      "shrink m/c": has(L) ? "LAMINATION MACHINE" : "",
      "cutting units/hr": has(C) ? 50000 : "",
      "die punch units/hr": has(D) ? 10000 : "",
      "w&d units/hr": has(W) ? 5000 : "",
      "ink divisor": name === "CHEQUE" ? 3 : 2,
      "film rule": has(W) ? "WINDOW" : "OTHER",
      "qty from stage": has(P) ? "Printing" : "Cutting",
      "other stages (no rate)": other.join(", "),
    };
  });
}

function defaultSetup() {
  const s = (key, value, what) => ({ key, value, "what it does": what });
  const r = (machine, rate, also) => ({ machine, "rs per hour": rate, "also called": also || "" });
  return {
    settings: [
      s("HOURS_BASIS", "NORM", "NORM = cutting, die punch and W&D hours from the units/hr norms. ACTUAL = logged hours. ACTUAL_ELSE_NORM = logged hours, norm if none logged. Printing hours are always the logged hours."),
      s("COST_STATUSES", "PRODUCTION", "Machine statuses whose hours are costed (comma separated). MAKE READY is shown but not costed unless you add it here."),
      s("DEFAULT_COLOURS", 4, "Colour count used for ink and plates when the WO is not in Planning and has no override"),
      s("WASTE_LIMIT_PCT", 5, "Waste % limit when Planning has no waste % for the WO. Above the limit is flagged, above twice the limit is critical"),
      s("QTY_SHORT_PCT", 2, "Flag when production is this % below WO qty"),
      s("QTY_EXCESS_PCT", 5, "Flag when production is this % above WO qty"),
      s("PAPER_VAR_PCT", 10, "Flag when SAP paper kg differs from the planned paper kg by more than this %"),
      s("SMALL_QTY", 10000, "WO qty below this is tagged Small qty"),
      s("IDLE_SHARE_PCT", 15, "Flag when idle + breakdown is above this % of job time"),
      s("NORM_VARIANCE_PCT", 25, "Flag when logged hours differ from norm hours by more than this %"),
      s("NO_WINDOW_KEYWORDS", "COVER PAGE", "Job descriptions with these words (comma separated) get no window film"),
      s("DATE_ORDER", "DMY", "DMY for 13/10/2026, MDY for 10/13/2026 (only used for dates stored as text)"),
      s("UPLOAD_PASSCODE", "", "Optional: if set, uploading Production, Consumption or Planning data asks for this passcode"),
    ],
    rates: [
      r("CONCEPTA", 4453), r("CONCEPTA-DH91 VDP", 5136), r("CONCEPTA-1 UV PRINTING", 6223), r("CONCEPTA-1 UV PRINTING+DH91 vdp", 6905),
      r("CONCEPT-1", 2802), r("CONCEPT-1 VISAK1", 3120), r("CONCEPT-1 UV PRINTING", 3304), r("CONCEPT-1 UV PRINTING+VISAK1", 3622),
      r("CONCEPT-3", 3431), r("CONCEPT-3 +S10 VDP", 3929), r("CONCEPT-3 UV PRINTING", 5943), r("CONCEPT-3 UV PRINTING+S10 VDP", 6440),
      r("SM74- UNIT4", 3340, "SM74"), r("MOZ", 585, "KORD"), r("HMT", 424, "DIE"), r("KODAK 125", 261), r("KONIKA MENOLTA", 346), r("HP 9050", 174),
      r("BINDING MACHINE", 323), r("CUTTING MACHINE", 339, "CUTTING"), r("PINNING MACHINE", 168), r("CMC", 652), r("BOWE", 465), r("SELF MAILER", 295),
      r("LAMINATION MACHINE", 407, "SHRINK"), r("FRANKING MACHINE", 133), r("W&D", 1033), r("KONICA-4COLOR", 499), r("XEROX", 534),
      r("STRAPING MACHINE", 150), r("UNIGRAPHICA JETSTAR INKJET PRINTING SYSTEM", 1107), r("PRONTO", 2377),
    ],
    routes: routeRows(),
    mats: [
      { item: "Plate", "rate (rs)": 250, basis: "per plate", note: "Used only when SAP has no plate issue value for the WO" },
      { item: "Ink", "rate (rs)": 276, basis: "per kg", note: "Used only when SAP has no ink issue value for the WO" },
      { item: "Window film / Shrink film", "rate (rs)": 162.734, basis: "per kg", note: "Used only when SAP has no film issue value for the WO" },
      { item: "Pasting gum", "rate (rs)": 0, basis: "per kg", note: "Set a rate if gum should be costed" },
    ],
    overrides: [],
  };
}

/* ---------------------------- helpers ---------------------------- */
function pick_(row, names) {
  for (let i = 0; i < names.length; i++) {
    const v = row[names[i]];
    if (v !== undefined && v !== null && v !== "" && v !== "-") return v;
  }
  return "";
}
function num_(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v === null || v === undefined ? "" : v).replace(/[,\s%]/g, "");
  if (s === "" || s === "-") return 0;
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
const has_ = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const normName_ = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9&]/g, "");

function toDate_(v, order) {
  const s = String(v === undefined || v === null ? "" : v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return null;
  const a = +m[1], b = +m[2];
  let y = +m[3];
  if (y < 100) y += 2000;
  let d = order === "MDY" ? b : a, mo = order === "MDY" ? a : b;
  if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
  return new Date(y, mo - 1, d);
}
const monthKey_ = (d) => (d ? d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) : "");

function toMinutes_(v) {
  const s = String(v === null || v === undefined ? "" : v).trim();
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (!m) return null;
  let h = +m[1];
  const mi = +m[2], sec = m[3] ? +m[3] : 0, ap = m[4] ? m[4].toUpperCase() : "";
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + mi + (sec >= 30 ? 1 : 0);
}
function hoursOf_(from, to) {
  const a = toMinutes_(from), b = toMinutes_(to);
  if (a === null || b === null) return 0;
  let d = b - a;
  if (d < 0) d += 1440;
  return d / 60;
}
const n0_ = (n) => Math.round(n).toLocaleString("en-IN");
function round_(n, d) { const p = Math.pow(10, d === undefined ? 2 : d); return Math.round((n + 1e-12) * p) / p; }

/** Which cost stage a production entry belongs to. */
function classify_(stage, machine) {
  const st = String(stage || "").toUpperCase(), mc = String(machine || "").toUpperCase();
  const any = (s, words) => words.some((w) => s.indexOf(w) >= 0);
  if (any(st, ["PUNCH", "DIE"])) return "Die punch";
  if (any(st, ["CUT"])) return "Cutting";
  if (any(st, ["ENVELOPE", "W&D", "POUCH", "PASTING"])) return "W&D";
  if (any(st, ["SHRINK", "LAMINAT"])) return "Shrink";
  if (any(st, ["BIND", "PINN", "STRAP", "FRANK", "MAIL", "PACK"])) return "Other";
  if (any(st, ["PRINT", "OFFSET", "DIGITAL", "INKJET", "WEB", "FLEXO", "MICR", "VDP", "SHEET"])) return "Printing";
  if (mc.indexOf("W&D") === 0) return "W&D";
  if (mc.indexOf("HMT") === 0) return "Die punch";
  if (mc.indexOf("CUTTING") === 0) return "Cutting";
  return "Printing";
}

/** What an SAP consumption row is, from its description. */
function materialKind_(row) {
  const t = (String(pick_(row, ["material description"]) || "") + " " + String(pick_(row, ["material group description"]) || "") + " " + String(pick_(row, ["material type description"]) || "")).toUpperCase();
  if (/\bINK\b|INK /.test(t)) return "ink";
  if (/PLATE/.test(t)) return "plate";
  if (/SHRINK|WINDOW|FILM/.test(t)) return "film";
  if (/\bGUM\b|ADHESIVE|GLUE/.test(t)) return "gum";
  return "paper";
}

/* ---------------------------- the engine ---------------------------- */
function buildReport(D, monthWanted) {
  const S = {};
  D.setup.settings.forEach((r) => { S[String(r.key).trim()] = r.value; });
  const sv = (key, def) => { const v = S[key]; return v === undefined || v === "" || v === null ? def : v; };
  const cfg = {
    basis: String(sv("HOURS_BASIS", "NORM")).toUpperCase(),
    costStatuses: String(sv("COST_STATUSES", "PRODUCTION")).split(",").map((x) => x.trim().toUpperCase()),
    defColours: num_(sv("DEFAULT_COLOURS", 4)),
    paperVar: num_(sv("PAPER_VAR_PCT", 10)),
    wasteLimit: num_(sv("WASTE_LIMIT_PCT", 5)),
    qtyShort: num_(sv("QTY_SHORT_PCT", 2)),
    qtyExcess: num_(sv("QTY_EXCESS_PCT", 5)),
    smallQty: num_(sv("SMALL_QTY", 10000)),
    idleShare: num_(sv("IDLE_SHARE_PCT", 15)),
    normVar: num_(sv("NORM_VARIANCE_PCT", 25)),
    noWindow: String(sv("NO_WINDOW_KEYWORDS", "")).split(",").map((x) => x.trim().toUpperCase()).filter(Boolean),
    dateOrder: String(sv("DATE_ORDER", "DMY")).toUpperCase(),
  };

  // machine rates (+ "Also called" prefixes)
  const rateMap = {}, aliases = [];
  D.setup.rates.forEach((r) => {
    const name = String(r.machine || "").trim(), n = normName_(name);
    if (!n) return;
    rateMap[n] = { name, rate: num_(pick_(r, ["rs per hour", "rate"])) };
    String(r["also called"] || "").split(",").forEach((a) => { const k = normName_(a); if (k) aliases.push({ key: k, to: n }); });
  });
  aliases.sort((a, b) => b.key.length - a.key.length);
  function rateFor(machine) {
    const n = normName_(machine);
    if (!n) return null;
    if (rateMap[n]) return rateMap[n];
    for (let i = 0; i < aliases.length; i++) if (n.indexOf(aliases[i].key) === 0) return rateMap[aliases[i].to];
    return null;
  }

  // routes
  const routes = {}, routeKeys = [];
  D.setup.routes.forEach((r) => {
    const k = normName_(r["product type"]);
    if (!k) return;
    routes[k] = {
      printing: String(r["printing"] || "").trim(), cutting: String(r["cutting"] || "").trim(), die: String(r["die punch"] || "").trim(),
      wd: String(r["w&d"] || "").trim(), shrink: String(r["shrink m/c"] || "").trim(),
      cutSpeed: num_(r["cutting units/hr"]), dieSpeed: num_(r["die punch units/hr"]), wdSpeed: num_(r["w&d units/hr"]),
      inkDiv: num_(r["ink divisor"]) || 2, film: String(r["film rule"] || "OTHER").toUpperCase(),
      qtyStage: String(r["qty from stage"] || "Printing").trim(), other: String(r["other stages (no rate)"] || "").trim(),
    };
    if (k !== "DEFAULT") routeKeys.push(k);
  });
  routeKeys.sort((a, b) => b.length - a.length);
  const fallbackRoute = routes.DEFAULT || { printing: "ACTUAL", cutting: "", die: "", wd: "", shrink: "", cutSpeed: 0, dieSpeed: 0, wdSpeed: 0, inkDiv: 2, film: "OTHER", qtyStage: "Printing", other: "" };
  function routeFor(pt) {
    const n = normName_(pt);
    if (routes[n]) return { r: routes[n], found: true };
    for (let i = 0; i < routeKeys.length; i++) if (n.indexOf(routeKeys[i]) >= 0) return { r: routes[routeKeys[i]], found: true };
    return { r: fallbackRoute, found: false };
  }

  const mat = { plate: 250, ink: 276, film: 162.734, gum: 0 };
  D.setup.mats.forEach((r) => {
    const k = String(r.item || "").toUpperCase(), v = num_(r["rate (rs)"]);
    if (k.indexOf("PLATE") === 0) mat.plate = v;
    else if (k.indexOf("INK") === 0) mat.ink = v;
    else if (k.indexOf("WINDOW") === 0 || k.indexOf("SHRINK") === 0) mat.film = v;
    else if (k.indexOf("PASTING") === 0 || k.indexOf("GUM") === 0) mat.gum = v;
  });

  const ovr = {};
  D.setup.overrides.forEach((r) => { const wo = String(r["wo no"] === undefined ? "" : r["wo no"]).trim(); if (wo) ovr[wo] = r; });

  // planning: all rows per WO
  const plan = {};
  D.plan.rows.forEach((r) => {
    const wo = String(pick_(r, ["wo no", "wo no.", "work order"]) || "").trim();
    if (wo) (plan[wo] = plan[wo] || []).push(r);
  });

  // production and SAP consumption grouped by WO
  const prodByWo = {}, consByWo = {};
  D.prod.rows.forEach((r) => {
    const wo = String(pick_(r, ["wo no", "wo no.", "work order"]) || "").trim();
    if (wo) (prodByWo[wo] = prodByWo[wo] || []).push({ r, d: toDate_(pick_(r, ["date"]), cfg.dateOrder) });
  });
  D.cons.rows.forEach((r) => {
    const wo = String(pick_(r, ["transp name/ w.o.no", "transp name/w.o.no", "wo no", "indent/invoice no."]) || "").trim();
    if (wo) (consByWo[wo] = consByWo[wo] || []).push({ r, d: toDate_(pick_(r, ["posting date", "document date"]), cfg.dateOrder) });
  });

  // a job is reported in the month of its LAST production entry (SAP posting if never produced)
  function lastMonth(list) {
    let best = null;
    list.forEach((x) => { if (x.d && (!best || x.d > best)) best = x.d; });
    return monthKey_(best);
  }
  const allWos = {}, jobMonth = {}, monthsSeen = {};
  Object.keys(prodByWo).forEach((w) => { allWos[w] = 1; });
  Object.keys(consByWo).forEach((w) => { allWos[w] = 1; });
  Object.keys(allWos).forEach((w) => {
    const mk = prodByWo[w] ? lastMonth(prodByWo[w]) : lastMonth(consByWo[w] || []);
    jobMonth[w] = mk;
    if (mk) monthsSeen[mk] = true;
  });
  const months = Object.keys(monthsSeen).sort().reverse();
  let month = monthWanted || months[0] || "ALL";
  if (month !== "ALL" && !monthsSeen[month]) month = months[0] || "ALL";

  function plannedKg(pr) {
    const q = num_(pick_(pr, ["paper qty(in kg/sheets)", "paper qty"]));
    const m = String(pick_(pr, ["paper size"]) || "").toUpperCase().match(/(\d+(?:\.\d+)?)\s*[X*]\s*(\d+(?:\.\d+)?)/);
    const gsm = num_(pick_(pr, ["gsm"]));
    return m && gsm ? (q * ((+m[1] * +m[2]) / 10000) * gsm) / 1000 : q;
  }

  const rows = [];
  Object.keys(allWos).forEach((wo) => {
    if (month !== "ALL" && jobMonth[wo] !== month) return;
    const pRows = plan[wo] || [], pl = pRows[0] || {};
    const all = prodByWo[wo] || [];
    const p1 = (all[0] || { r: {} }).r;
    const customer = String(pick_(pl, ["customer name", "customer"]) || pick_(p1, ["customer"]) || "");
    const job = String(pick_(pl, ["job description"]) || pick_(p1, ["job description"]) || "");
    const productType = String(pick_(pl, ["product type"]) || pick_(p1, ["product type"]) || "");
    const rt = routeFor(productType), route = rt.r;
    const woQty = num_(pick_(pl, ["order qty", "qty in lvs"]) || pick_(p1, ["order qty"]));
    const inp = ovr[wo] || {};
    const flags = [];
    const flag = (sev, text) => flags.push({ sev, text });

    // paper codes this job should use (Planning, else Production)
    const codes = {};
    pRows.forEach((pr) => { const c = String(pick_(pr, ["paper code"]) || "").trim(); if (c) codes[c] = 1; });
    if (!Object.keys(codes).length) all.forEach((x) => { const c = String(pick_(x.r, ["material code"]) || "").trim(); if (c) codes[c] = 1; });

    // ---- production aggregation
    const hrsBy = { Printing: 0, Cutting: 0, "Die punch": 0, "W&D": 0, Shrink: 0, Other: 0 };
    const qtyBy = {}, printMachines = {}, breakdowns = {};
    let wasteAll = 0, lost = 0, costed = 0, mr = 0;
    all.forEach((x) => {
      const r = x.r;
      const status = String(pick_(r, ["machine status"]) || "").trim().toUpperCase();
      const h = hoursOf_(pick_(r, ["from time (12h)", "from time"]), pick_(r, ["to time (12h)", "to time"]));
      const machine = String(pick_(r, ["machine"]) || "").trim();
      const cat = classify_(pick_(r, ["stage"]), machine);
      if (cfg.costStatuses.indexOf(status) >= 0) {
        costed += h;
        hrsBy[cat] = (hrsBy[cat] || 0) + h;
        if (cat === "Printing") printMachines[machine] = (printMachines[machine] || 0) + h;
      }
      if (status.indexOf("MAKE READY") >= 0) mr += h;
      else if (status.indexOf("IDLE") >= 0 || status.indexOf("BREAK") >= 0) {
        lost += h;
        const why = String(pick_(r, ["remarks"]) || "").trim();
        if (status.indexOf("BREAK") >= 0 && why) breakdowns[why] = (breakdowns[why] || 0) + h;
      }
      qtyBy[cat] = (qtyBy[cat] || 0) + num_(pick_(r, ["production qty"]));
      wasteAll += num_(pick_(r, ["wastage qty"]));
    });
    // production qty = qty at the first stage that has any
    const qOrder = [route.qtyStage || "Printing", "Printing", "W&D", "Die punch", "Cutting", "Shrink"];
    let prodQty = 0;
    for (let qi = 0; qi < qOrder.length && !prodQty; qi++) prodQty = qtyBy[qOrder[qi]] || 0;
    const wasteQty = wasteAll;
    const wastePct = prodQty + wasteQty ? (wasteQty / (prodQty + wasteQty)) * 100 : 0;
    const planWaste = num_(pick_(pl, ["waste %"]));
    const wasteLimit = planWaste > 0 ? planWaste : cfg.wasteLimit;

    // ---- stage hours
    const norm = {
      cutting: route.cutting && route.cutSpeed ? prodQty / route.cutSpeed : 0,
      die: route.die && route.dieSpeed ? prodQty / route.dieSpeed : 0,
      wd: route.wd && route.wdSpeed ? prodQty / route.wdSpeed : 0,
    };
    const pickHrs = (actual, normal, applicable) => {
      if (!applicable) return 0;
      if (cfg.basis === "ACTUAL") return actual;
      if (cfg.basis === "ACTUAL_ELSE_NORM") return actual > 0 ? actual : normal;
      return normal;
    };
    const hrs = {
      printing: route.printing ? hrsBy.Printing : 0,
      cutting: pickHrs(hrsBy.Cutting, norm.cutting, !!route.cutting),
      die: pickHrs(hrsBy["Die punch"], norm.die, !!route.die),
      wd: pickHrs(hrsBy["W&D"], norm.wd, !!route.wd),
      shrink: route.shrink ? hrsBy.Shrink : 0,
    };

    // ---- machine cost
    const stageCost = { printing: 0, cutting: 0, die: 0, wd: 0, shrink: 0 }, rateInfo = [], missingRate = {};
    if (route.printing && route.printing.toUpperCase() !== "ACTUAL") {
      const fr = rateFor(route.printing);
      if (fr) { stageCost.printing = hrs.printing * fr.rate; rateInfo.push({ stage: "Printing", machine: fr.name, rate: fr.rate, hrs: hrs.printing }); }
      else missingRate[route.printing] = true;
    } else if (route.printing) {
      Object.keys(printMachines).forEach((m) => {
        const rr = rateFor(m);
        if (rr) { stageCost.printing += printMachines[m] * rr.rate; rateInfo.push({ stage: "Printing", machine: rr.name, rate: rr.rate, hrs: printMachines[m] }); }
        else missingRate[m] = true;
      });
    }
    [["cutting", "Cutting", route.cutting], ["die", "Die punch", route.die], ["wd", "W&D", route.wd], ["shrink", "Shrink", route.shrink]].forEach((st) => {
      if (!st[2]) return;
      const rr = rateFor(st[2]);
      if (rr) { stageCost[st[0]] = hrs[st[0]] * rr.rate; rateInfo.push({ stage: st[1], machine: rr.name, rate: rr.rate, hrs: hrs[st[0]] }); }
      else missingRate[st[2]] = true;
    });
    const prodCost = stageCost.printing + stageCost.cutting + stageCost.die + stageCost.wd + stageCost.shrink;

    // ---- SAP consumption (net: issues are negative, returns positive)
    const sap = { paper: { kg: 0, val: 0, n: 0 }, ink: { kg: 0, val: 0, n: 0 }, plate: { kg: 0, val: 0, n: 0 }, film: { kg: 0, val: 0, n: 0 }, gum: { kg: 0, val: 0, n: 0 } };
    const paperDescs = {}, otherPaper = {}, hasCodes = Object.keys(codes).length > 0;
    (consByWo[wo] || []).forEach((x) => {
      const r = x.r, k = materialKind_(r);
      const q = num_(pick_(r, ["issued/receipt qty", "quantity in buom"])), v = num_(pick_(r, ["total value", "ext. amount in local currency"]));
      sap[k].kg -= q; sap[k].val -= v; sap[k].n++;
      if (k === "paper") {
        const d = String(pick_(r, ["material description"]) || "").trim(); if (d) paperDescs[d] = 1;
        const mc = String(pick_(r, ["material"]) || "").trim();
        if (hasCodes && mc && !codes[mc]) otherPaper[mc] = 1;
      }
    });

    let colours, coloursEst = false;
    if (has_(inp.colours)) colours = num_(inp.colours);
    else if (has_(pick_(pl, ["color front"])) || has_(pick_(pl, ["color back"]))) colours = num_(pick_(pl, ["color front"])) + num_(pick_(pl, ["color back"]));
    else { colours = cfg.defColours; coloursEst = true; }

    const src = {};
    const paperKg = sap.paper.kg, paperCost = sap.paper.val;
    src.paper = sap.paper.n ? "SAP issue" : "not found";
    let inkKg, inkCost;
    if (has_(inp["ink kg"])) { inkKg = num_(inp["ink kg"]); inkCost = inkKg * mat.ink; src.ink = "override"; }
    else if (sap.ink.n) { inkKg = sap.ink.kg; inkCost = sap.ink.val > 0 ? sap.ink.val : inkKg * mat.ink; src.ink = "SAP issue"; }
    else { inkKg = (prodQty / route.inkDiv / 100000) * colours; inkCost = inkKg * mat.ink; src.ink = "norm"; }
    let filmRule = route.film;
    const yn = String(inp["window film (y/n)"] || "").trim().toUpperCase();
    if (yn === "Y") filmRule = "WINDOW";
    else if (yn === "N") filmRule = "OTHER";
    else if (filmRule === "WINDOW" && cfg.noWindow.some((k) => job.toUpperCase().indexOf(k) >= 0)) filmRule = "OTHER";
    let filmKg, filmCost;
    if (sap.film.n) { filmKg = sap.film.kg; filmCost = sap.film.val > 0 ? sap.film.val : filmKg * mat.film; src.film = "SAP issue"; }
    else {
      filmKg = filmRule === "WINDOW" ? prodQty / 4000 : filmRule === "NONE" ? 0 : prodQty / 2 / 2400000;
      filmCost = filmKg * mat.film; src.film = "norm";
    }
    let plates, plateCost;
    if (has_(inp["plates used"])) { plates = num_(inp["plates used"]); plateCost = plates * mat.plate; src.plate = "override"; }
    else if (sap.plate.n) { plates = sap.plate.kg; plateCost = sap.plate.val > 0 ? sap.plate.val : plates * mat.plate; src.plate = "SAP issue"; }
    else { plates = colours; plateCost = plates * mat.plate; src.plate = "colours x rate"; }
    let gumKg, gumCost;
    if (has_(inp["pasting gum kg"])) { gumKg = num_(inp["pasting gum kg"]); gumCost = gumKg * mat.gum; src.gum = "override"; }
    else if (sap.gum.n) { gumKg = sap.gum.kg; gumCost = sap.gum.val > 0 ? sap.gum.val : gumKg * mat.gum; src.gum = "SAP issue"; }
    else { gumKg = 0; gumCost = 0; src.gum = "none"; }

    const cost = {
      paper: paperCost, plate: plateCost, ink: inkCost, film: filmCost, gum: gumCost, production: prodCost,
      outsource: num_(inp["outsource charge (rs)"]), packing: num_(inp["packing & transport (rs)"]),
    };
    cost.total = cost.paper + cost.plate + cost.ink + cost.film + cost.gum + cost.production + cost.outsource + cost.packing;
    const perUnit = prodQty ? cost.total / prodQty : 0;

    let plannedPaper = 0;
    pRows.forEach((pr) => { plannedPaper += plannedKg(pr); });

    // ---- validation flags
    const started = all.length > 0, totalTime = costed + lost;
    if (D.plan.rows.length && !pRows.length) flag("warn", "WO not found in Planning");
    if (!started) flag("warn", "Paper issued in SAP but no production entries for this WO");
    if (started && !rt.found) flag("info", 'Product type "' + productType + '" not in PRODUCT ROUTES, DEFAULT route used');
    if (started && !hrs.printing && prodQty > 0 && route.printing) flag("crit", "Production qty logged but no printing hours (stage or status not recognised)");
    Object.keys(missingRate).forEach((m) => flag("crit", 'No running-cost rate for machine "' + m + '" (add it under Machine rates)'));
    if (started && !sap.paper.n) flag("warn", "No paper issue found in Consumption for this WO");
    if (started && sap.paper.n && paperKg > 0 && sap.paper.val <= 0) flag("info", "Paper has no SAP value (free-issue or non-valued), paper cost is 0");
    if (started && sap.paper.n && paperKg <= 0) flag("crit", "Net paper issue is zero or negative");
    if (Object.keys(otherPaper).length) flag("warn", "SAP paper material " + Object.keys(otherPaper).join(", ") + " is not the planned paper code " + Object.keys(codes).join(", "));
    if (started && sap.paper.n && plannedPaper > 0 && paperKg > 0) {
      const pv = ((paperKg - plannedPaper) / plannedPaper) * 100;
      if (pv > cfg.paperVar) flag("warn", "SAP paper " + n0_(paperKg) + " kg is " + round_(pv, 0) + "% above planned " + n0_(plannedPaper) + " kg");
      else if (pv < -cfg.paperVar) flag("info", "SAP paper " + n0_(paperKg) + " kg is " + round_(-pv, 0) + "% below planned " + n0_(plannedPaper) + " kg");
    }
    if (started && woQty > 0) {
      const diff = ((prodQty - woQty) / woQty) * 100;
      if (diff < -cfg.qtyShort) flag("warn", "Production " + round_(-diff, 1) + "% short of WO qty");
      if (diff > cfg.qtyExcess) flag("warn", "Production " + round_(diff, 1) + "% above WO qty");
    }
    if (started && wastePct > wasteLimit) flag(wastePct > wasteLimit * 2 ? "crit" : "warn", "Waste " + round_(wastePct, 1) + "% (limit " + wasteLimit + "%)");
    if (started && totalTime > 0 && (lost / (lost + costed + mr)) * 100 > cfg.idleShare) flag("warn", "Idle + breakdown is " + round_((lost / (lost + costed + mr)) * 100, 0) + "% of logged time");
    [["Cutting", hrsBy.Cutting, norm.cutting], ["Die punch", hrsBy["Die punch"], norm.die], ["W&D", hrsBy["W&D"], norm.wd]].forEach((c) => {
      if (c[1] > 0 && c[2] > 0 && (Math.abs(c[1] - c[2]) / c[2]) * 100 > cfg.normVar) flag("info", c[0] + " logged " + round_(c[1], 1) + " h vs norm " + round_(c[2], 1) + " h");
    });
    if (started && woQty > 0 && woQty < cfg.smallQty) flag("info", "Small qty");
    if (started && route.other) flag("info", "Route also has " + route.other + " (no rate defined, not costed)");
    if (started && src.plate === "colours x rate") flag("info", "Plates taken as " + colours + " (= no. of colours), enter actual plates under Job overrides if different");
    if (started && coloursEst && src.ink === "norm") flag("info", "Colours not in Planning, default " + cfg.defColours + " used");

    const sevOrder = { crit: 0, warn: 1, info: 2 };
    flags.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);
    const status = flags.some((f) => f.sev === "crit") ? "crit" : flags.some((f) => f.sev === "warn") ? "warn" : "ok";

    const machineNames = Object.keys(printMachines);
    const bd = Object.keys(breakdowns).map((k) => ({ why: k, hrs: round_(breakdowns[k], 2) })).sort((a, b) => b.hrs - a.hrs).slice(0, 5);

    rows.push({
      wo, machine: machineNames.join(" + "), customer, job, productType,
      materialCode: String(pick_(pl, ["product code"]) || pick_(p1, ["material code"]) || ""),
      paperDesc: Object.keys(paperDescs).join(", ") || String(pick_(pl, ["description"]) || pick_(p1, ["material description"]) || ""),
      colours, colors: colours, woQty, prodQty, cumQty: prodQty, qtyVarPct: woQty ? round_(((prodQty - woQty) / woQty) * 100, 1) : 0,
      wasteQty, wastePct: round_(wastePct, 2), plannedPaperKg: round_(plannedPaper, 0),
      paperKg: round_(paperKg, 2), plates, inkKg: round_(inkKg, 2), filmKg: round_(filmKg, 2), gumKg: round_(gumKg, 2),
      kgPerLakh: prodQty ? round_((paperKg / prodQty) * 100000, 1) : 0,
      hrs: { printing: round_(hrs.printing, 2), cutting: round_(hrs.cutting, 2), die: round_(hrs.die, 2), wd: round_(hrs.wd, 2), shrink: round_(hrs.shrink, 2) },
      actualHrs: { cutting: round_(hrsBy.Cutting, 2), die: round_(hrsBy["Die punch"], 2), wd: round_(hrsBy["W&D"], 2) },
      lostHrs: round_(lost, 2), costedHrs: round_(costed, 2), makeReadyHrs: round_(mr, 2),
      stageCost, rateInfo, cost, perUnit: round_(perUnit, 4), per1000: round_(perUnit * 1000, 2), sources: src,
      status, flags, breakdowns: bd, started,
    });
  });

  rows.sort((a, b) => (+b.wo || 0) - (+a.wo || 0));

  const sum = { jobs: rows.length, total: 0, production: 0, paper: 0, plate: 0, ink: 0, film: 0, gum: 0, other: 0, wasteQty: 0, prodQty: 0, lost: 0, costed: 0, review: 0, crit: 0, notStarted: 0 };
  const mach = {};
  rows.forEach((r) => {
    sum.total += r.cost.total; sum.production += r.cost.production; sum.paper += r.cost.paper; sum.plate += r.cost.plate;
    sum.ink += r.cost.ink; sum.film += r.cost.film; sum.gum += r.cost.gum; sum.other += r.cost.outsource + r.cost.packing;
    sum.wasteQty += r.wasteQty; sum.prodQty += r.prodQty; sum.lost += r.lostHrs; sum.costed += r.costedHrs;
    if (r.status !== "ok") sum.review++;
    if (r.status === "crit") sum.crit++;
    if (!r.started) sum.notStarted++;
    const key = r.machine || "No printing";
    const m = (mach[key] = mach[key] || { machine: key, jobs: 0, hrs: 0, lost: 0, printCost: 0, review: 0 });
    m.jobs++; m.hrs += r.hrs.printing; m.lost += r.lostHrs; m.printCost += r.stageCost.printing;
    if (r.status !== "ok") m.review++;
  });
  sum.wastePct = sum.prodQty + sum.wasteQty ? round_((sum.wasteQty / (sum.prodQty + sum.wasteQty)) * 100, 2) : 0;
  sum.lostPct = sum.lost + sum.costed ? round_((sum.lost / (sum.lost + sum.costed)) * 100, 1) : 0;

  return {
    month, months, hoursBasis: cfg.basis, costStatuses: cfg.costStatuses.join(", "),
    sources: { production: D.prod.rows.length, consumption: D.cons.rows.length, planning: D.plan.rows.length },
    rows, summary: sum,
    machines: Object.keys(mach).map((k) => {
      const m = mach[k];
      m.hrs = round_(m.hrs, 1); m.lost = round_(m.lost, 1); m.printCost = round_(m.printCost, 0);
      m.lostPct = m.hrs + m.lost ? round_((m.lost / (m.hrs + m.lost)) * 100, 1) : 0;
      return m;
    }).sort((a, b) => b.printCost - a.printCost),
  };
}

module.exports = { buildReport, defaultSetup, UPLOAD_SPEC };