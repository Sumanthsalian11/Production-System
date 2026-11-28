import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import BASE_URL from "../config/api";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const fmtDay = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

const dayKey = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

const initials = (n = "") =>
  String(n)
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

const AV_COLORS = ["#3b7ddd", "#1cbb8c", "#6f42c1", "#e8590c", "#17a2b8", "#c2255c", "#f59f00"];
const avColor = (n = "") => AV_COLORS[[...String(n)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

/* ---------- survey helpers ---------- */
const SCORE = { "NOT SATISFIED": 1, SATISFIED: 2, GOOD: 3, "VERY GOOD": 4, EXCELLENT: 5 };
const scoreOf = (a) => SCORE[String(a || "").trim().toUpperCase()] || 0;
const qNo = (q) => {
  const m = String(q || "").match(/^\s*(\d+)\s*\./);
  return m ? Number(m[1]) : 0;
};
const answerOf = (r, no) => (r.answers || []).find((x) => qNo(x.q) === no)?.a || "";
// questions 6, 7, 8 are the rating grids
const gridAnswers = (r) => (r.answers || []).filter((x) => [6, 7, 8].includes(qNo(x.q)));
const avgScore = (r) => {
  const v = gridAnswers(r).map((x) => scoreOf(x.a)).filter(Boolean);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const tone = (score) =>
  score == null ? { bg: "#eef1f5", fg: "#6c757d" }
  : score >= 4 ? { bg: "#e6f7f1", fg: "#14916c" }
  : score >= 3 ? { bg: "#eaf1fc", fg: "#2f64b1" }
  : score >= 2 ? { bg: "#fff6e5", fg: "#b77700" }
  : { bg: "#fdecee", fg: "#a71d2a" };
// "6. SALES & MARKETING [PRESENTATION]" -> section "6. SALES & MARKETING", item "PRESENTATION"
const splitQ = (q) => {
  const m = String(q).match(/^(.*?)\s*\[(.*)\]\s*$/);
  return m ? { section: m[1], item: m[2] } : { section: String(q), item: "" };
};

/* =====================================================================================
   CUSTOMER SATISFACTION REPORT (Excel in the format of the "Compiled / Graph / Pareto Chart" summary)
   Built in the browser from the survey rows on this page, using /csat_template.xlsx (public folder) as the template.
   Points follow the survey form MPi_QS_KAS_T001 (total 100):
     A, B, C : Not Satisfied 0 | Satisfied 3 | Good 4 | Very Good 5 | Excellent 6
     D       : Below par 0 | Same as competitors 8 | Better than competitors 10
     E       : Yes 15 | No 0
     F       : Not Satisfied 0 | Satisfied 9 | Good 12 | Very Good 13.5 | Excellent 15
   ===================================================================================== */
const csatReport = (() => {
  /* ---------------------------------- points ---------------------------------- */
  const GRID_PTS = { "NOT SATISFIED": 0, SATISFIED: 3, GOOD: 4, "VERY GOOD": 5, EXCELLENT: 6 };
  const COMP_PTS = { "BELOW PAR COMPARED TO COMPETITORS": 0, "SAME AS COMPETITORS": 8, "BETTER THAN COMPETITORS": 10 };
  const AGAIN_PTS = { YES: 15, NO: 0 };
  const OVERALL_PTS = { "NOT SATISFIED": 0, SATISFIED: 9, GOOD: 12, "VERY GOOD": 13.5, EXCELLENT: 15 };

  // row of the Compiled sheet for every question of the form
  const ITEM_ROWS = {
    6: [[/PRESENTATION/i, 4], [/KNOWLEDGE|PROFESSIONAL/i, 5], [/RESPONSE TO/i, 6], [/COUNT?ESY|ATTENTIVENESS/i, 7]],
    7: [[/QUALITY/i, 9], [/FULFIL/i, 10]],
    8: [[/RESPONSIVENESS/i, 12], [/FOLLOW ?-?UP/i, 13], [/VALUE ADDED/i, 14], [/PERSONALI[SZ]ED/i, 15]],
  };
  const SINGLE_ROWS = { 9: [17, COMP_PTS], 10: [19, AGAIN_PTS], 11: [21, OVERALL_PTS] };

  const qNo = (q) => {
    const m = String(q || "").match(/^\s*(\d+)\s*\./);
    return m ? Number(m[1]) : 0;
  };
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toUpperCase();

  // answers of one response -> { row: points }
  function pointsOf(response) {
    const pts = {};
    let feedback = "";
    for (const x of response.answers || []) {
      const no = qNo(x.q);
      const ans = norm(x.a);
      if (ITEM_ROWS[no]) {
        const hit = ITEM_ROWS[no].find(([re]) => re.test(x.q));
        if (hit && ans in GRID_PTS) pts[hit[1]] = GRID_PTS[ans];
      } else if (SINGLE_ROWS[no]) {
        const [row, table] = SINGLE_ROWS[no];
        if (ans in table) pts[row] = table[ans];
      } else if ((no >= 12 || /suggest|improv/i.test(x.q || "")) && String(x.a || "").trim()) {
        feedback = feedback ? `${feedback}\n${String(x.a).trim()}` : String(x.a).trim();
      }
    }
    return { pts, feedback };
  }

  /* --------------------------------- helpers --------------------------------- */
  const colLetter = (n) => {
    let s = "";
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const colIndex = (L) => [...L].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
  const splitRef = (ref) => { const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/); return { col: colIndex(m[1]), row: Number(m[2]) }; };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const num = (v) => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(15))));
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function periodLabel(dates) {
    const ds = dates.filter((d) => d && !isNaN(d)).sort((a, b) => a - b);
    if (!ds.length) return "";
    const a = ds[0], b = ds[ds.length - 1];
    const yy = (d) => String(d.getFullYear()).slice(2);
    if (a.getFullYear() === b.getFullYear()) {
      return a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]}'${yy(a)}` : `${MON[a.getMonth()]} - ${MON[b.getMonth()]}'${yy(a)}`;
    }
    return `${MON[a.getMonth()]}'${yy(a)} - ${MON[b.getMonth()]}'${yy(b)}`;
  }

  // <row> / <c> parsing of the template sheet
  function parseRows(sheetXml) {
    const rows = {};
    for (const m of sheetXml.matchAll(/<row r="(\d+)"([^>]*?)(?:\/>|>(.*?)<\/row>)/gs)) {
      const cells = {};
      for (const c of (m[3] || "").matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
        cells[colIndex(c[1])] = {
          s: (c[2].match(/\bs="(\d+)"/) || [])[1],
          t: (c[2].match(/\bt="(\w+)"/) || [])[1],
          inner: c[3] || "",
        };
      }
      rows[Number(m[1])] = { attrs: m[2], cells };
    }
    return rows;
  }

  /* ------------------------------ tiny evaluator ------------------------------ */
  // enough for the formulas of the Graph and Pareto sheets (=Compiled!X1, =H3/H9, =SUM(H3:H8), =H3)
  function makeEvaluator(sheets) {
    const cache = {};
    const get = (sheet, ref) => {
      const key = `${sheet}!${ref}`;
      if (key in cache) return cache[key];
      const cell = sheets[sheet] && sheets[sheet][ref];
      let v = 0;
      if (cell) v = cell.f != null ? evalF(sheet, cell.f) : cell.v ?? 0;
      cache[key] = typeof v === "number" ? v : 0;
      return cache[key];
    };
    const evalF = (sheet, f) => {
      let m;
      if ((m = f.match(/^Compiled!\$?([A-Z]+)\$?(\d+)$/))) return get("Compiled", m[1] + m[2]);
      if ((m = f.match(/^\$?([A-Z]+)\$?(\d+)$/))) return get(sheet, m[1] + m[2]);
      if ((m = f.match(/^SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/))) {
        let t = 0;
        for (let c = colIndex(m[1]); c <= colIndex(m[3]); c++) for (let r = Number(m[2]); r <= Number(m[4]); r++) t += get(sheet, colLetter(c) + r);
        return t;
      }
      if ((m = f.match(/^([A-Z]+\d+)\/([A-Z]+\d+)$/))) { const d = get(sheet, m[2]); return d === 0 ? 0 : get(sheet, m[1]) / d; }
      throw new Error(`csatReport: unsupported formula ${sheet}!${f}`);
    };
    return { get, evalF };
  }

  /* ---------------------------------- builder ---------------------------------- */
  async function buildCsatWorkbook(responses, templateBytes, opts = {}) {
    // only responses of the new survey (they have rating answers); oldest first
    const list = (responses || [])
      .map((r) => ({ r, ...pointsOf(r) }))
      .filter((x) => Object.keys(x.pts).length > 0)
      .sort((a, b) => new Date(a.r.submittedAt) - new Date(b.r.submittedAt));
    if (!list.length) {
      const e = new Error("No survey responses with rating answers to export");
      e.status = 400;
      throw e;
    }
    const N = list.length;
    const period = opts.period || periodLabel(list.map((x) => new Date(x.r.submittedAt)));

    const zip = await JSZip.loadAsync(templateBytes);
    const tpl = parseRows(await zip.file("xl/worksheets/sheet1.xml").async("string"));
    const sheet1 = await zip.file("xl/worksheets/sheet1.xml").async("string");

    const FIRST = 3;                 // first customer column (C)
    const LAST = FIRST + N - 1;      // last customer column
    const S = LAST + 1;              // first column of the Count table (V in the template)
    const DELTA = S - 22;            // how far the right-hand tables moved
    const R = (off) => colLetter(S + off);   // right block column letter, off 0..11 (V..AG)
    const rng = (row) => `${colLetter(FIRST)}${row}:${colLetter(LAST)}${row}`;
    const last = colLetter(LAST);

    // unique customer headers
    const seen = {};
    const names = list.map((x) => {
      const base = String(x.r.name || x.r.spocName || "Customer").trim();
      seen[base] = (seen[base] || 0) + 1;
      return seen[base] > 1 ? `${base} (${seen[base]})` : base;
    });

    /* ----- values and formulas of the Compiled sheet ----- */
    const V = {};                                  // coord -> numeric cached value, for the evaluator
    const cellsOut = {};                           // row -> { colIndex: xml }
    const put = (row, col, xml) => { (cellsOut[row] ||= {})[col] = xml; };
    const styleOf = (row, col) => (tpl[row] && tpl[row].cells[col] ? tpl[row].cells[col].s : undefined);
    const sAttr = (s) => (s != null ? ` s="${s}"` : "");
    const blank = (row, col, s) => put(row, col, `<c r="${colLetter(col)}${row}"${sAttr(s)}/>`);
    const text = (row, col, s, t) => put(row, col, `<c r="${colLetter(col)}${row}"${sAttr(s)} t="inlineStr"><is><t xml:space="preserve">${esc(t)}</t></is></c>`);
    const number = (row, col, s, v) => { V[`${colLetter(col)}${row}`] = { v }; put(row, col, `<c r="${colLetter(col)}${row}"${sAttr(s)}><v>${num(v)}</v></c>`); };
    const formula = (row, col, s, f, v) => { V[`${colLetter(col)}${row}`] = { v, f }; put(row, col, `<c r="${colLetter(col)}${row}"${sAttr(s)}><f>${esc(f)}</f><v>${num(v)}</v></c>`); };

    const custStyle = (row, k) => (k === 0 ? styleOf(row, 3) : k === N - 1 && N > 1 ? styleOf(row, 21) : styleOf(row, 4));

    const PARAM = [4, 5, 6, 7, 9, 10, 12, 13, 14, 15];
    const SINGLE = [17, 19, 21];
    const SUBTOTAL = { 8: [4, 7], 11: [9, 10], 16: [12, 15], 18: [17, 17], 20: [19, 19], 22: [21, 21] };
    // which Count columns (offset 0..4 = Excellent, Very Good, Good, Satisfied, Not Satisfied) and what is counted
    const COUNTS = {
      param: [[0, 6], [1, 5], [2, 4], [3, 3], [4, 0]],
      17: [[0, 10], [2, 8], [4, 0]],
      19: [[0, 15], [4, 0]],
      21: [[0, 15], [1, 13.5], [2, 12], [3, 9], [4, 0]],
    };
    const countSpec = (row) => (PARAM.includes(row) ? COUNTS.param : COUNTS[row]);

    // points per customer
    const pts = (row, k) => list[k].pts[row];

    // customers area
    for (let row = 1; row <= 27; row++) {
      if (!tpl[row]) continue;
      for (let k = 0; k < N; k++) {
        const col = FIRST + k, cl = colLetter(col), s = custStyle(row, k);
        if (row === 3) text(row, col, s, names[k]);
        else if (PARAM.includes(row) || SINGLE.includes(row)) pts(row, k) === undefined ? blank(row, col, s) : number(row, col, s, pts(row, k));
        else if (row === 23) {
          const total = Object.values(list[k].pts).reduce((a, b) => a + b, 0);
          formula(row, col, s, `${cl}24/${cl}25`, total / 100);
        } else if (row === 24) formula(row, col, s, `SUM(${cl}4:${cl}22)`, Object.values(list[k].pts).reduce((a, b) => a + b, 0));
        else if (row === 25) number(row, col, s, 100);
        else blank(row, col, s);
      }
    }

    // Count (V..AA) and % (AC..AG) tables
    const counted = {};   // row -> { off: count }
    const ratio = (row, off, v, total) => formula(row, S + 7 + off, styleOf(row, 29 + off), `IF($${R(5)}$${row}=0,0,${R(off)}${row}/$${R(5)}$${row})`, total ? v / total : 0);

    for (const row of [...PARAM, ...SINGLE]) {
      const spec = countSpec(row);
      counted[row] = {};
      let total = 0;
      for (const [off, val] of spec) {
        const c = list.filter((x) => x.pts[row] === val).length;
        counted[row][off] = c; total += c;
        formula(row, S + off, styleOf(row, 22 + off), `COUNTIF(${rng(row)},${val})`, c);
      }
      for (let off = 0; off < 5; off++) if (!(off in counted[row])) blank(row, S + off, styleOf(row, 22 + off));
      formula(row, S + 5, styleOf(row, 27), `SUM(${R(0)}${row}:${R(4)}${row})`, total);
      for (let off = 0; off < 5; off++) {
        if (off in counted[row]) ratio(row, off, counted[row][off], total);
        else blank(row, S + 7 + off, styleOf(row, 29 + off));
      }
      blank(row, S + 6, styleOf(row, 28));
    }

    for (const [rowStr, [a, b]] of Object.entries(SUBTOTAL)) {
      const row = Number(rowStr);
      const spec = row === 8 || row === 11 || row === 16 ? COUNTS.param : countSpec(a);
      counted[row] = {};
      let total = 0;
      for (const [off] of spec) {
        let c = 0;
        for (let r = a; r <= b; r++) c += (counted[r] && counted[r][off]) || 0;
        counted[row][off] = c; total += c;
        formula(row, S + off, styleOf(row, 22 + off), `SUM(${R(off)}${a}:${R(off)}${b})`, c);
      }
      for (let off = 0; off < 5; off++) if (!(off in counted[row])) blank(row, S + off, styleOf(row, 22 + off));
      formula(row, S + 5, styleOf(row, 27), `SUM(${R(5)}${a}:${R(5)}${b})`, total);
      for (let off = 0; off < 5; off++) {
        if (off in counted[row]) ratio(row, off, counted[row][off], total);
        else blank(row, S + 7 + off, styleOf(row, 29 + off));
      }
      blank(row, S + 6, styleOf(row, 28));
    }

    // row 23: all categories together
    {
      const row = 23, parts = [22, 18, 16, 20, 11, 8];
      let total = 0; counted[row] = {};
      for (let off = 0; off < 5; off++) {
        const c = parts.reduce((t, r) => t + ((counted[r] && counted[r][off]) || 0), 0);
        counted[row][off] = c; total += c;
        formula(row, S + off, styleOf(row, 22 + off), parts.map((r) => `${R(off)}${r}`).join("+"), c);
      }
      formula(row, S + 5, styleOf(row, 27), parts.map((r) => `${R(5)}${r}`).join("+"), total);
      for (let off = 0; off < 5; off++) ratio(row, off, counted[row][off], total);
      blank(row, S + 6, styleOf(row, 28));
    }

    // everything else on the right side (titles, headers, empty styled cells): copy from the template, shifted
    for (let row = 1; row <= 27; row++) {
      if (!tpl[row]) continue;
      for (let col = 22; col <= 33; col++) {
        const nc = col + DELTA;
        if (cellsOut[row] && cellsOut[row][nc]) continue;
        const c = tpl[row].cells[col];
        if (!c) continue;
        put(row, nc, `<c r="${colLetter(nc)}${row}"${sAttr(c.s)}${c.t ? ` t="${c.t}"` : ""}${c.inner ? `>${c.inner}</c>` : "/>"}`);
      }
    }
    // left side (A, B): copy; the period replaces A2
    for (let row = 1; row <= 27; row++) {
      if (!tpl[row]) continue;
      for (const col of [1, 2]) {
        const c = tpl[row].cells[col];
        if (!c) continue;
        if (row === 2 && col === 1) text(2, 1, c.s, `Period : ${period}`);
        else put(row, col, `<c r="${colLetter(col)}${row}"${sAttr(c.s)}${c.t ? ` t="${c.t}"` : ""}${c.inner ? `>${c.inner}</c>` : "/>"}`);
      }
    }

    // suggestions table (point G of the survey form)
    const feedback = list.map((x, k) => ({ name: names[k], text: x.feedback })).filter((x) => x.text);
    const FB_START = 30;
    const fbRows = feedback.length ? feedback : [{ name: "—", text: "No suggestions received" }];
    const rowAttrs = (n) => (tpl[n] ? tpl[n].attrs : tpl[30].attrs);
    fbRows.forEach((f, i) => {
      text(FB_START + i, 1, styleOf(30, 1), f.name);
      text(FB_START + i, 2, styleOf(30, 2), f.text);
    });
    const lastRow = FB_START + fbRows.length - 1;
    // copy row 29 header cells ("Customer Name" / "Feedback Shared")
    for (const col of [1, 2]) {
      const c = tpl[29].cells[col];
      put(29, col, `<c r="${colLetter(col)}29"${sAttr(c.s)}${c.t ? ` t="${c.t}"` : ""}${c.inner ? `>${c.inner}</c>` : "/>"}`);
    }

    /* ----- assemble sheet1.xml ----- */
    const lastCol = S + 11;
    const rowsXml = [];
    for (let n = 1; n <= lastRow; n++) {
      if (!cellsOut[n]) continue;
      const attrs = rowAttrs(n).replace(/spans="[^"]*"/, `spans="1:${lastCol}"`);
      const cells = Object.keys(cellsOut[n]).map(Number).sort((a, b) => a - b).map((c) => cellsOut[n][c]).join("");
      rowsXml.push(`<row r="${n}"${attrs}>${cells}</row>`);
    }
    const cols =
      `<cols><col min="1" max="1" width="29.28515625" style="48" customWidth="1"/><col min="2" max="2" width="69.140625" style="51" customWidth="1"/>` +
      `<col min="${FIRST}" max="${LAST}" width="14.140625" style="17" customWidth="1"/>` +
      `<col min="${S}" max="${S + 4}" width="13" style="48" customWidth="1"/>` +
      `<col min="${S + 5}" max="${S + 5}" width="11.7109375" style="48" customWidth="1"/><col min="${S + 6}" max="${S + 6}" width="0.5703125" style="18" customWidth="1"/>` +
      `<col min="${S + 7}" max="${S + 7}" width="14.42578125" style="48" customWidth="1"/><col min="${S + 8}" max="${S + 11}" width="13" style="48" customWidth="1"/>` +
      `<col min="${S + 12}" max="16384" width="9.140625" style="18"/></cols>`;
    const merges = [`${R(0)}2:${R(5)}2`, `${R(7)}2:${R(11)}2`, "A23:B23", "A4:A7", "A9:A11", "A12:A16"];

    let newSheet1 = sheet1
      .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${colLetter(lastCol)}${lastRow}"/>`)
      .replace(/<cols>.*?<\/cols>/s, cols)
      .replace(/<sheetData>.*<\/sheetData>/s, `<sheetData>${rowsXml.join("")}</sheetData>`)
      .replace(/<mergeCells[^>]*>.*?<\/mergeCells>/s, `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`);
    zip.file("xl/worksheets/sheet1.xml", newSheet1);

    /* ----- Graph and Pareto sheets: shift references, new values ----- */
    const shiftRef = (col) => (colIndex(col) >= 22 ? colLetter(colIndex(col) + DELTA) : col);
    const compiledVals = {};
    for (const [coord, o] of Object.entries(V)) compiledVals[coord] = { v: o.v };
    const sheetsForEval = { Compiled: compiledVals };
    const sheetFormulas = {};   // sheet name -> coord -> {f}

    const files = { Graph: "xl/worksheets/sheet2.xml", "Pareto Chart": "xl/worksheets/sheet3.xml" };
    const xmls = {};
    for (const [name, file] of Object.entries(files)) {
      let xml = await zip.file(file).async("string");
      sheetFormulas[name] = {};
      xml = xml.replace(/<c r="([A-Z]+\d+)"([^>]*)><f>([^<]*)<\/f>(?:<v>[^<]*<\/v>)?<\/c>/g, (all, ref, attrs, f) => {
        const nf = f.replace(/Compiled!\$?([A-Z]+)\$?(\d+)/g, (_, c, r) => `Compiled!${shiftRef(c)}${r}`);
        sheetFormulas[name][ref] = { f: nf };
        return `<c r="${ref}"${attrs.replace(/\s+t="[^"]*"/, "")}><f>${esc(nf)}</f><v>@@${name}|${ref}@@</v></c>`;
      });
      xmls[name] = xml;
      sheetsForEval[name] = sheetFormulas[name];
    }
    const ev = makeEvaluator(sheetsForEval);
    for (const name of Object.keys(files)) {
      let xml = xmls[name].replace(/@@([^|]+)\|([A-Z]+\d+)@@/g, (_, sh, ref) => num(ev.get(sh, ref)));
      if (name === "Graph") {
        xml = xml.replace(/<c r="B2"([^>]*?) t="s"><v>\d+<\/v><\/c>/, (_, a) =>
          `<c r="B2"${a} t="inlineStr"><is><t>${esc(`CUSTOMER SATISFACTION SURVEY - Period : ${period}`)}</t></is></c>`);
      }
      zip.file(files[name], xml);
    }

    // refresh the numbers cached inside the 9 charts (Excel also refreshes them on open)
    const graphVals = {};
    for (const ref of Object.keys(sheetFormulas.Graph)) graphVals[ref] = ev.get("Graph", ref);
    for (let i = 1; i <= 9; i++) {
      const file = `xl/charts/chart${i}.xml`;
      if (!zip.file(file)) continue;
      let xml = await zip.file(file).async("string");
      xml = xml.replace(/<c:numRef><c:f>Graph!([^<]+)<\/c:f><c:numCache>(.*?)<\/c:numCache><\/c:numRef>/gs, (all, range, cache) => {
        const [a, b] = range.split(":").map(splitRef);
        const refs = [];
        for (let r = a.row; r <= (b || a).row; r++) for (let c = a.col; c <= (b || a).col; c++) refs.push(colLetter(c) + r);
        const fmt = (cache.match(/<c:formatCode>.*?<\/c:formatCode>/s) || ["<c:formatCode>General</c:formatCode>"])[0];
        const pts = refs.map((ref, idx) => `<c:pt idx="${idx}"><c:v>${num(graphVals[ref] ?? 0)}</c:v></c:pt>`).join("");
        return `<c:numRef><c:f>Graph!${range}</c:f><c:numCache>${fmt}<c:ptCount val="${refs.length}"/>${pts}</c:numCache></c:numRef>`;
      });
      zip.file(file, xml);
    }

    /* ----- workbook level ----- */
    let wb = await zip.file("xl/workbook.xml").async("string");
    wb = wb
      .replace(/Compiled!\$A\$1:\$AA\$24/, `Compiled!$A$1:$${R(5)}$24`)
      .replace(/<calcPr([^>]*?)\/>/, (m, a) => (/fullCalcOnLoad/.test(a) ? m : `<calcPr${a} fullCalcOnLoad="1"/>`));
    zip.file("xl/workbook.xml", wb);
    // the old calculation chain would not match the new formulas
    zip.remove("xl/calcChain.xml");
    let rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
    rels = rels.replace(/<Relationship [^>]*calcChain[^>]*\/>/, "");
    zip.file("xl/_rels/workbook.xml.rels", rels);
    let ct = await zip.file("[Content_Types].xml").async("string");
    ct = ct.replace(/<Override [^>]*calcChain[^>]*\/>/, "");
    zip.file("[Content_Types].xml", ct);

    const buffer = await zip.generateAsync({
      type: opts.outType || "blob",
      compression: "DEFLATE",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return { buffer, count: N, period };
  }

  return { buildCsatWorkbook };
})();

export default function FormResponses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${BASE_URL}/api/form-responses`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load responses");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 15000); // quiet auto-refresh
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (q) {
        const hay = [r.name, r.spocName, r.email, r.phone, r.address, r.comments, ...(r.answers || []).map((x) => x.a)]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const k = r.submittedAt ? dayKey(r.submittedAt) : "";
      if (from && (!k || k < from)) return false;
      if (to && (!k || k > to)) return false;
      return true;
    });
  }, [rows, search, from, to]);

  // summary numbers (display only)
  const stats = useMemo(() => {
    const todayKey = dayKey(new Date());
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekKey = dayKey(weekAgo);
    let today = 0;
    let week = 0;
    let sum = 0;
    let cnt = 0;
    rows.forEach((r) => {
      if (r.submittedAt) {
        const k = dayKey(r.submittedAt);
        if (k === todayKey) today++;
        if (k >= weekKey) week++;
      }
      const a = avgScore(r);
      if (a != null) { sum += a; cnt++; }
    });
    return { total: rows.length, today, week, avg: cnt ? sum / cnt : null, latest: rows[0]?.submittedAt || null };
  }, [rows]);

  const clearFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
  };

  const exportExcel = () => {
    if (!filtered.length) return;
    // one column per question, in the order the questions first appear
    const qs = [];
    filtered.forEach((r) => (r.answers || []).forEach((x) => { if (!qs.includes(x.q)) qs.push(x.q); }));
    qs.sort((a, b) => qNo(a) - qNo(b));

    const data = filtered.map((r, i) => {
      const row = {
        "S.No": i + 1,
        "Customer Name": r.name || "",
        "SPOC Name": r.spocName || "",
        "SPOC Email ID": r.email || "",
        "SPOC Contact number": r.phone || "",
        "Feedback Date": fmtDay(r.feedbackDate),
      };
      qs.forEach((q) => { row[q] = (r.answers || []).find((x) => x.q === q)?.a || ""; });
      row["Submitted At"] = fmt(r.submittedAt);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Object.keys(data[0]).map((k) => ({ wch: Math.min(Math.max(k.length + 2, 14), 40) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Survey Responses");
    XLSX.writeFile(wb, `Customer_Satisfaction_Responses_${dayKey(new Date())}.xlsx`);
  };

  // Excel report in the format of the Customer Satisfaction summary (Compiled / Graph / Pareto Chart sheets)
  const [exporting, setExporting] = useState(false);
  const exportReport = async () => {
    if (!filtered.length || exporting) return;
    setExporting(true);
    setError("");
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}csat_template.xlsx`);
      if (!resp.ok) throw new Error("Template file csat_template.xlsx was not found in the frontend public folder");
      const out = await csatReport.buildCsatWorkbook(filtered, await resp.arrayBuffer());
      const url = URL.createObjectURL(out.buffer);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Customer_Satisfaction_Report_${dayKey(new Date())}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || "Could not create the report");
    }
    setExporting(false);
  };

  const hasFilter = search || from || to;

  const statCards = [
    { label: "Total Responses", value: stats.total, icon: "bi-inboxes-fill", color: "#3b7ddd", soft: "#eaf1fc" },
    { label: "Today", value: stats.today, icon: "bi-calendar-check-fill", color: "#1cbb8c", soft: "#e6f7f1" },
    { label: "Last 7 Days", value: stats.week, icon: "bi-graph-up-arrow", color: "#6f42c1", soft: "#f1ecfa" },
  ];

  // detail popup content: group the grid answers by section
  const detailGroups = useMemo(() => {
    if (!detail) return [];
    const map = new Map();
    (detail.answers || []).forEach((x) => {
      const { section, item } = splitQ(x.q);
      if (!map.has(section)) map.set(section, []);
      map.get(section).push({ item, a: x.a });
    });
    return [...map.entries()].sort((a, b) => qNo(a[0]) - qNo(b[0]));
  }, [detail]);

  return (
    <div className="fr-page">
      <style>{`
        .fr-page{padding:22px 26px 30px;background:#f6f8fb;min-height:calc(100vh - 58px)}
        .fr-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}
        .fr-title{display:flex;align-items:center;gap:12px}
        .fr-title-icon{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#3b7ddd,#2f64b1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.25rem;box-shadow:0 6px 14px rgba(59,125,221,.28)}
        .fr-title h4{margin:0;font-size:1.25rem;font-weight:800;color:#1f2d3d;letter-spacing:.2px}
        .fr-title p{margin:2px 0 0;font-size:.8rem;color:#6c757d}
        .fr-live{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:700;color:#14916c;background:#e6f7f1;border:1px solid #bfe9d9;border-radius:999px;padding:3px 10px;margin-left:6px}
        .fr-live i{width:7px;height:7px;border-radius:50%;background:#1cbb8c;display:inline-block;animation:frPulse 1.6s infinite}
        @keyframes frPulse{0%{transform:scale(.9);opacity:.8}50%{transform:scale(1.3);opacity:1}100%{transform:scale(.9);opacity:.8}}

        .fr-actions{display:flex;gap:10px;flex-wrap:wrap}
        .fr-btn{background:linear-gradient(135deg,#3b7ddd,#2f64b1);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:.83rem;padding:9px 18px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;box-shadow:0 4px 12px rgba(59,125,221,.28);transition:all .15s ease}
        .fr-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 16px rgba(59,125,221,.36)}
        .fr-btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
        .fr-btn-light{background:#fff;color:#1f2d3d;border:1px solid #dbe2ec;border-radius:10px;font-weight:700;font-size:.83rem;padding:9px 16px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .15s ease}
        .fr-btn-light:hover:not(:disabled){background:#f1f5fb;border-color:#b9c7dc}
        .fr-btn-light:disabled{opacity:.6;cursor:not-allowed}
        .fr-btn-sm{padding:5px 12px;font-size:.76rem;border-radius:8px}

        .fr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .fr-stat{background:#fff;border:1px solid #e5eaf2;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 1px 3px rgba(31,45,61,.05)}
        .fr-stat-ico{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0}
        .fr-stat-val{font-size:1.45rem;font-weight:800;color:#1f2d3d;line-height:1.1}
        .fr-stat-lbl{font-size:.72rem;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:.05em;margin-top:3px}

        .fr-card{background:#fff;border:1px solid #e5eaf2;border-radius:14px;box-shadow:0 2px 8px rgba(31,45,61,.06);overflow:hidden}
        .fr-filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #e5eaf2;background:#fbfcfe}
        .fr-search{position:relative;flex:1;min-width:240px;max-width:420px}
        .fr-search i{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#8a97a8;font-size:.9rem}
        .fr-input{width:100%;border:1px solid #d5dde9;background:#fff;color:#1f2d3d;border-radius:10px;padding:8px 12px;font-size:.84rem;outline:none;transition:all .15s ease}
        .fr-search .fr-input{padding-left:36px}
        .fr-input:focus{border-color:#3b7ddd;box-shadow:0 0 0 3px rgba(59,125,221,.14)}
        .fr-date{display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;color:#6c757d;text-transform:uppercase;letter-spacing:.04em}
        .fr-date .fr-input{width:auto;text-transform:none;letter-spacing:0;font-weight:500}
        .fr-count{margin-left:auto;background:#eaf1fc;color:#2f64b1;border:1px solid #cfe0f8;border-radius:999px;padding:4px 14px;font-size:.76rem;font-weight:800}

        .fr-wrap{overflow:auto;max-height:calc(100vh - 430px);min-height:240px}
        .fr-table{width:100%;border-collapse:separate;border-spacing:0;font-size:.86rem}
        .fr-table thead th{position:sticky;top:0;z-index:2;background:#eef3fa;color:#44566c;text-align:left;padding:11px 16px;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;border-bottom:2px solid #d8e2f0}
        .fr-table tbody td{padding:12px 16px;border-bottom:1px solid #edf1f7;color:#2b3a4b;vertical-align:middle;background:#fff}
        .fr-table tbody tr:nth-child(even) td{background:#fafbfd}
        .fr-table tbody tr:hover td{background:#f0f6ff}
        .fr-num{color:#8a97a8;font-weight:700;font-size:.78rem}
        .fr-person{display:flex;align-items:center;gap:11px;min-width:190px}
        .fr-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.78rem;flex-shrink:0;box-shadow:0 2px 6px rgba(31,45,61,.18)}
        .fr-name{font-weight:700;color:#1f2d3d;line-height:1.2}
        .fr-mail{color:#3b7ddd;font-size:.8rem}
        .fr-chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
        .fr-chip i{color:#8a97a8}
        .fr-date-pill{display:inline-flex;align-items:center;gap:6px;background:#f1ecfa;color:#5b34a8;border:1px solid #ddd0f3;border-radius:999px;padding:3px 11px;font-size:.76rem;font-weight:700;white-space:nowrap}
        .fr-pill{display:inline-block;border-radius:999px;padding:3px 11px;font-size:.74rem;font-weight:800;white-space:nowrap}
        .fr-muted{color:#9aa6b6}

        .fr-empty{text-align:center;padding:56px 20px;color:#6c757d}
        .fr-empty i{font-size:2.6rem;color:#b9c7dc}
        .fr-empty b{display:block;color:#1f2d3d;margin-top:10px;font-size:.98rem}
        .fr-alert{margin:14px 18px;padding:10px 14px;border-radius:10px;background:#fdecee;border:1px solid #f5c2c7;color:#a71d2a;font-size:.84rem;font-weight:600;display:flex;align-items:center;gap:8px}
        .fr-loading{text-align:center;padding:56px 20px;color:#6c757d;font-size:.9rem}

        .fr-modal-bg{position:fixed;inset:0;background:rgba(15,30,50,.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:18px}
        .fr-modal{background:#fff;border-radius:16px;width:100%;max-width:760px;max-height:90vh;overflow:auto;box-shadow:0 24px 60px rgba(15,30,50,.35)}
        .fr-modal-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 22px;border-bottom:1px solid #e5eaf2;position:sticky;top:0;background:#fff;z-index:1}
        .fr-modal-h h5{margin:0;font-size:1.05rem;font-weight:800;color:#1f2d3d}
        .fr-modal-b{padding:16px 22px 22px}
        .fr-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:14px}
        .fr-kv div{background:#f6f8fb;border:1px solid #e5eaf2;border-radius:10px;padding:8px 12px}
        .fr-kv small{display:block;color:#6c757d;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
        .fr-kv b{color:#1f2d3d;font-size:.88rem;word-break:break-word}
        .fr-sec{margin-top:14px}
        .fr-sec-t{font-size:.8rem;font-weight:800;color:#2f64b1;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
        .fr-qrow{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:7px 0;border-bottom:1px dashed #e5eaf2;font-size:.84rem}
        .fr-qrow span:first-child{color:#44566c}

        @media (max-width:1100px){.fr-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media (max-width:600px){.fr-page{padding:16px 12px}.fr-stats{grid-template-columns:1fr}.fr-count{margin-left:0}}
      `}</style>

      {/* Title + actions */}
      <div className="fr-top">
        <div className="fr-title">
          <div className="fr-title-icon"><i className="bi bi-ui-checks" /></div>
          <div>
            <h4>
              Customer Satisfaction Responses
              <span className="fr-live"><i />Live</span>
            </h4>
            <p>Survey submissions from the Google Form, updated automatically</p>
          </div>
        </div>
        <div className="fr-actions">
          <button className="fr-btn-light" onClick={() => load()} disabled={loading}>
            <i className="bi bi-arrow-clockwise" /> {loading ? "Loading…" : "Refresh"}
          </button>
          <button className="fr-btn-light" onClick={exportExcel} disabled={!filtered.length}>
            <i className="bi bi-list-ul" /> Export List
          </button>
          <button className="fr-btn" onClick={exportReport} disabled={!filtered.length || exporting}>
            <i className="bi bi-file-earmark-excel" /> {exporting ? "Creating report…" : "Export Report (Excel)"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="fr-stats">
        {statCards.map((s) => (
          <div className="fr-stat" key={s.label}>
            <div className="fr-stat-ico" style={{ background: s.soft, color: s.color }}>
              <i className={`bi ${s.icon}`} />
            </div>
            <div>
              <div className="fr-stat-val">{s.value}</div>
              <div className="fr-stat-lbl">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="fr-card">
        {/* Filters */}
        <div className="fr-filters">
          <div className="fr-search">
            <i className="bi bi-search" />
            <input
              className="fr-input"
              placeholder="Search customer, SPOC, email, phone, answers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="fr-date">
            From
            <input type="date" className="fr-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="fr-date">
            To
            <input type="date" className="fr-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {hasFilter && (
            <button className="fr-btn-light" onClick={clearFilters}>
              <i className="bi bi-x-lg" /> Clear
            </button>
          )}
          <span className="fr-count">{filtered.length} of {rows.length} shown</span>
        </div>

        {error && (
          <div className="fr-alert">
            <i className="bi bi-exclamation-triangle-fill" /> {error}
          </div>
        )}

        {/* Table */}
        <div className="fr-wrap">
          {loading ? (
            <div className="fr-loading">Loading responses…</div>
          ) : filtered.length === 0 ? (
            <div className="fr-empty">
              <i className="bi bi-inbox" />
              <b>{rows.length ? "No responses match your filters" : "No responses saved yet"}</b>
              <span className="small">
                {rows.length ? "Try a different search or date range." : "New survey submissions will appear here automatically."}
              </span>
            </div>
          ) : (
            <table className="fr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>SPOC</th>
                  <th>Phone</th>
                  <th>Feedback Date</th>
                  <th>Vs Competitors</th>
                  <th>Use Again</th>
                  <th>Overall</th>
                  <th>Submitted At</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const overall = answerOf(r, 11);
                  const ot = tone(scoreOf(overall) || null);
                  const again = answerOf(r, 10);
                  return (
                    <tr key={r._id}>
                      <td className="fr-num">{i + 1}</td>
                      <td>
                        <div className="fr-person">
                          <div className="fr-av" style={{ background: avColor(r.name) }}>{initials(r.name)}</div>
                          <div>
                            <div className="fr-name">{r.name}</div>
                            <div className="fr-mail">{r.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{r.spocName || <span className="fr-muted">—</span>}</td>
                      <td>
                        {r.phone ? <span className="fr-chip"><i className="bi bi-telephone-fill" />{r.phone}</span> : <span className="fr-muted">—</span>}
                      </td>
                      <td>{r.feedbackDate ? <span className="fr-date-pill"><i className="bi bi-calendar3" />{fmtDay(r.feedbackDate)}</span> : <span className="fr-muted">—</span>}</td>
                      <td style={{ minWidth: 150 }}>{answerOf(r, 9) || <span className="fr-muted">—</span>}</td>
                      <td>
                        {again ? <span className="fr-pill" style={{ background: again.toUpperCase() === "YES" ? "#e6f7f1" : "#fdecee", color: again.toUpperCase() === "YES" ? "#14916c" : "#a71d2a" }}>{again}</span> : <span className="fr-muted">—</span>}
                      </td>
                      <td>{overall ? <span className="fr-pill" style={{ background: ot.bg, color: ot.fg }}>{overall}</span> : <span className="fr-muted">—</span>}</td>
                      <td><span className="fr-date-pill"><i className="bi bi-clock" />{fmt(r.submittedAt)}</span></td>
                      <td>
                        <button className="fr-btn-light fr-btn-sm" onClick={() => setDetail(r)}>
                          <i className="bi bi-eye" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail popup: every answer of one survey */}
      {detail && (
        <div className="fr-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="fr-modal">
            <div className="fr-modal-h">
              <h5>{detail.name || "Response"} • {fmt(detail.submittedAt)}</h5>
              <button className="fr-btn-light fr-btn-sm" onClick={() => setDetail(null)}><i className="bi bi-x-lg" /> Close</button>
            </div>
            <div className="fr-modal-b">
              <div className="fr-kv">
                <div><small>Customer Name</small><b>{detail.name || "—"}</b></div>
                <div><small>SPOC Name</small><b>{detail.spocName || "—"}</b></div>
                <div><small>SPOC Email</small><b>{detail.email || "—"}</b></div>
                <div><small>SPOC Contact</small><b>{detail.phone || "—"}</b></div>
                <div><small>Feedback Date</small><b>{detail.feedbackDate ? fmtDay(detail.feedbackDate) : "—"}</b></div>
                {detail.address ? <div><small>Address (old form)</small><b>{detail.address}</b></div> : null}
                {detail.comments ? <div><small>Comments (old form)</small><b>{detail.comments}</b></div> : null}
              </div>

              {detailGroups.length === 0 && <div className="fr-muted">No rating answers (this response is from the old contact form).</div>}
              {detailGroups.map(([section, items]) => (
                <div className="fr-sec" key={section}>
                  <div className="fr-sec-t">{section}</div>
                  {items.map((x, k) => {
                    const sc = tone(scoreOf(x.a) || null);
                    return (
                      <div className="fr-qrow" key={k}>
                        <span>{x.item || ""}</span>
                        <span className="fr-pill" style={{ background: sc.bg, color: sc.fg }}>{x.a}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}