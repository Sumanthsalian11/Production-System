const cron = require("node-cron");
const ProductionMachineStatus = require("../models/ProductionMachineStatus");
const Machine = require("../models/MachineMaster"); // adjust to the model your Perso machine master uses
const Activity = require("../models/ActivityMaster"); // same model as the floor production mail
const Printer = require("../models/PrinterMaster"); // the model behind /api/master/printers - adjust the file name
const sendMail = require("../utils/mailSender");
const XLSX = require("xlsx");
const mailConfig = require("../utils/productionMailConfig") || {};
const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
// accepts TO/CC or to/cc, array or single string
const TO = toArr(mailConfig.TO ?? mailConfig.to);
const CC = toArr(mailConfig.CC ?? mailConfig.cc);

// ---- time helpers (same logic as the Perso consolidated report) ----
// minutes between "HH:MM" from/to times; equal or earlier To time = crossed midnight (equal = 24h)
const getDurationMins = (from, to) => {
  if (!from || !to) return 0;
  const [fh, fm] = String(from).split(":").map(Number);
  const [th, tm] = String(to).split(":").map(Number);
  let mins = th * 60 + tm - (fh * 60 + fm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
};

// minutes -> h:mm:ss
const formatHMS = (m) => {
  const total = Math.round((m || 0) * 60);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const escapeHtml = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Runs daily at 10:00 AM and reports entries whose PRODUCTION DATE is yesterday
// (TEST: change "0 10 * * *" to a time 2 minutes ahead, restart Node, then change it back)
cron.schedule("33 9 * * *", async () => {
  try {
    // only entries whose PRODUCTION DATE is yesterday (not when they were saved)
    const yDay = new Date();
    yDay.setDate(yDay.getDate() - 1); // production date = yesterday
    const ymd = `${yDay.getFullYear()}-${String(yDay.getMonth() + 1).padStart(2, "0")}-${String(yDay.getDate()).padStart(2, "0")}`;

    const entries = await ProductionMachineStatus.find({
      productionDate: {
        $gte: new Date(`${ymd}T00:00:00.000Z`),
        $lte: new Date(`${ymd}T23:59:59.999Z`),
      },
    })
      .populate("machineId", "machineName")
      .lean();

    const dateStr = yDay.toLocaleDateString("en-GB").replace(/\//g, ".");

    // no entries for production date = yesterday: still send the mail (every row shows "No entry made")
    const htmlNoEntry = `
      <div style="font-family:Arial,sans-serif;font-size:14px;">
        <p><b>No Perso production entry was made for production date ${dateStr}.</b></p>
        <p>No machine production, idle, breakdown or maintenance records were entered in this period.</p>
      </div>`;

    if (!entries.length) {
      console.log(`⚠️ No Perso entries with production date ${dateStr} - sending "No entry made" mail.`);
    }

    // ================= CONSOLIDATE BY MACHINE + PRINTER =================
    const map = {};
    const sizeSet = new Set();

    entries.forEach((r) => {
      const machineName = r.machineId?.machineName || "Unknown";
      const printerName = r.printerName || "";
      const key = `${machineName}||${printerName}`;

      if (!map[key]) {
        map[key] = {
          machineName,
          printerName,
          counts: {},
          dayBySize: {},
          nightBySize: {},
          printingMins: 0,
          idleMins: 0,
          breakdownMins: 0,
          maintenanceMins: 0,
        };
      }

      const e = map[key];
      e.hasEntry = true;

      // PRODUCTION COUNT by paper size (total pages)
      const size = (r.paperSize || "Unknown").toUpperCase();
      const pages = Number(r.totalPages) || 0;
      e.counts[size] = (e.counts[size] || 0) + pages;
      sizeSet.add(size);

      // day / night split by paper size (production entries only, same as the app)
      const shiftKey = String(r.shift || "").toLowerCase();
      const stKey = String(r.machineStatus || "").toLowerCase();
      if (stKey === "production" || stKey === "working") {
        const bucket = shiftKey === "day" ? e.dayBySize : shiftKey === "night" ? e.nightBySize : null;
        if (bucket) bucket[size] = (bucket[size] || 0) + pages;
      }

      // time by machine status
      const dur = getDurationMins(r.fromTime, r.toTime);
      const status = String(r.machineStatus || "").toLowerCase();

      if (status === "production" || status === "working") e.printingMins += dur;
      else if (status === "idle" || status === "idle time") e.idleMins += dur;
      else if (status.includes("break")) e.breakdownMins += dur;
      else if (status.includes("maint")) e.maintenanceMins += dur;
    });

    // ===== ALL machines + printers of the PERSO PRINTING activity (same logic as the app) =====
    const persoList = await Activity.find({
      activityName: { $regex: /perso/i },
    }).lean();
    // prefer the one that has both "perso" and "print" in its name
    const persoActivity =
      persoList.find((a) => /print/i.test(a.activityName || "")) || persoList[0] || null;

    const persoMachineIds = new Set(
      (persoActivity?.machines || []).map(String)
    );

    const [machineDocs, printerDocs] = await Promise.all([
      Machine.find({}).lean(),
      Printer.find({}).lean(),
    ]);

    machineDocs
      .filter((m) => persoMachineIds.has(String(m._id)))
      .forEach((m) => {
        const machineName = m.machineName || "Unknown";
        const hasMachineRows = Object.values(map).some((x) => x.machineName === machineName);

        // printers of this machine from the Printer master (same as the app)
        const printerNames =
          printerDocs.find((p) => p.machineName === m.machineName)?.printerNames || [];
        const printers = printerNames.length ? printerNames : [""];

        printers.forEach((printerName) => {
          const key = `${machineName}||${printerName}`;
          // printer-less machines only get a blank row when they have no entries at all
          if (!map[key] && (printerName || !hasMachineRows)) {
            map[key] = {
              machineName,
              printerName,
              counts: {},
              dayBySize: {},
              nightBySize: {},
              printingMins: 0,
              idleMins: 0,
              breakdownMins: 0,
              maintenanceMins: 0,
            };
          }
        });
      });

    const consolidated = Object.values(map);
    const paperSizeColumns = [...sizeSet].sort();

    // ================= TOTALS =================
    const totals = {
      counts: {},
      printingMins: 0,
      idleMins: 0,
      breakdownMins: 0,
      maintenanceMins: 0,
    };

    paperSizeColumns.forEach((sz) => {
      totals.counts[sz] = consolidated.reduce((s, c) => s + (c.counts[sz] || 0), 0);
    });
    consolidated.forEach((c) => {
      totals.printingMins += c.printingMins;
      totals.idleMins += c.idleMins;
      totals.breakdownMins += c.breakdownMins;
      totals.maintenanceMins += c.maintenanceMins;
    });

    const allMins = (c) => c.printingMins + c.idleMins + c.breakdownMins + c.maintenanceMins;

    // ================= BUILD TABLE ROWS =================
    const td = "text-align:center;";

    let rows = "";
    consolidated.forEach((c, i) => {
      rows += `
        <tr>
          <td style="${td}">${i + 1}</td>
          <td style="font-weight:bold;">${escapeHtml(c.machineName)}</td>
          <td style="font-weight:bold;">${escapeHtml(c.printerName) || "-"}</td>
          ${paperSizeColumns
            .map(
              (sz) =>
                `<td style="text-align:right;">${(c.counts[sz] || 0).toLocaleString("en-IN")}</td>`
            )
            .join("")}
          <td style="${td}">${formatHMS(c.printingMins)}</td>
          <td style="${td}">${formatHMS(c.idleMins)}</td>
          <td style="${td}">${formatHMS(c.breakdownMins)}</td>
          <td style="${td}">${formatHMS(c.maintenanceMins)}</td>
          <td style="${td}font-weight:bold;">${formatHMS(allMins(c))}</td>
        </tr>`;
    });

    const totalRow = `
      <tr style="background:#1a2a3a;color:#ffffff;font-weight:bold;">
        <td colspan="3" style="text-align:right;">TOTAL</td>
        ${paperSizeColumns
          .map(
            (sz) =>
              `<td style="text-align:right;">${(totals.counts[sz] || 0).toLocaleString("en-IN")}</td>`
          )
          .join("")}
        <td style="${td}">${formatHMS(totals.printingMins)}</td>
        <td style="${td}">${formatHMS(totals.idleMins)}</td>
        <td style="${td}">${formatHMS(totals.breakdownMins)}</td>
        <td style="${td}">${formatHMS(totals.maintenanceMins)}</td>
        <td style="${td}">${formatHMS(allMins(totals))}</td>
      </tr>`;

    // ================= SINGLE TABLE: ALL ENTRIES =================
    const ctr = "text-align:center;";
    const numF = (v) => (v ? Number(v).toLocaleString("en-IN") : "-");
    const hmsF = (m) => (m ? formatHMS(m) : "-");

    let sumPages = 0;
    let sumWaste = 0;
    const tm = { printing: 0, idle: 0, breakdown: 0, maint: 0 };

    let allRows = "";
    entries.forEach((r, i) => {
      const dur = getDurationMins(r.fromTime, r.toTime);
      const status = String(r.machineStatus || "").toLowerCase();

      let p = 0, id = 0, b = 0, m = 0;
      if (status === "production" || status === "working") p = dur;
      else if (status === "idle" || status === "idle time") id = dur;
      else if (status.includes("break")) b = dur;
      else if (status.includes("maint")) m = dur;

      tm.printing += p;
      tm.idle += id;
      tm.breakdown += b;
      tm.maint += m;
      sumPages += Number(r.totalPages) || 0;
      sumWaste += Number(r.wastageSheets) || 0;

      allRows += `
        <tr>
          <td style="${ctr}">${i + 1}</td>
          <td style="font-weight:bold;">${escapeHtml(r.machineId?.machineName) || "-"}</td>
          <td style="font-weight:bold;">${escapeHtml(r.printerName) || "-"}</td>
          <td style="${ctr}">${escapeHtml(r.shift) || "-"}</td>
          <td style="${ctr}">${escapeHtml(r.woNumber) || "-"}</td>
          <td>${escapeHtml(r.customerName) || "-"}</td>
          <td>${escapeHtml(r.materialType) || "-"}</td>
          <td style="${ctr}">${escapeHtml(r.paperSize) || "-"}</td>
          <td style="${ctr}">${escapeHtml(r.machineStatus) || "-"}</td>
          <td style="${ctr}">${hmsF(p)}</td>
          <td style="${ctr}">${hmsF(id)}</td>
          <td style="${ctr}">${hmsF(b)}</td>
          <td style="${ctr}">${hmsF(m)}</td>
          <td style="${ctr}font-weight:bold;">${formatHMS(dur)}</td>
          <td style="text-align:right;">${numF(r.totalPages)}</td>
          <td style="text-align:right;">${numF(r.wastageSheets)}</td>
          <td style="${ctr}">${r.wastePercentage ? escapeHtml(r.wastePercentage) + "%" : "-"}</td>
          <td>${escapeHtml(r.reason) || "-"}</td>
        </tr>`;
    });

    const grandMins = tm.printing + tm.idle + tm.breakdown + tm.maint;
    const totalWastePct = sumPages > 0 ? ((sumWaste / sumPages) * 100).toFixed(2) + "%" : "-";

    const allTotalRow = `
      <tr style="background:#1a2a3a;color:#ffffff;font-weight:bold;">
        <td colspan="9" style="text-align:right;">TOTAL</td>
        <td style="${ctr}">${formatHMS(tm.printing)}</td>
        <td style="${ctr}">${formatHMS(tm.idle)}</td>
        <td style="${ctr}">${formatHMS(tm.breakdown)}</td>
        <td style="${ctr}">${formatHMS(tm.maint)}</td>
        <td style="${ctr}">${formatHMS(grandMins)}</td>
        <td style="text-align:right;">${sumPages.toLocaleString("en-IN")}</td>
        <td style="text-align:right;">${sumWaste.toLocaleString("en-IN")}</td>
        <td style="${ctr}">${totalWastePct}</td>
        <td></td>
      </tr>`;

    const htmlAll = `
    <div style="font-family:Arial,sans-serif">
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">
        <thead style="background:#a9cce3;text-align:center;">
          <tr>
            <th>#</th>
            <th style="text-align:left;">MACHINE NAME</th>
            <th style="text-align:left;">PRINTER NAME</th>
            <th>SHIFT</th>
            <th>WO NUMBER</th>
            <th style="text-align:left;">CUSTOMER NAME</th>
            <th style="text-align:left;">ITEM</th>
            <th>PAPER SIZE</th>
            <th>STATUS</th>
            <th>PRINTING TIME</th>
            <th>IDLE TIME</th>
            <th>BREAKDOWN TIME</th>
            <th>MAINTENANCE TIME</th>
            <th>TOTAL TIME</th>
            <th>PAGES</th>
            <th>WASTAGE</th>
            <th>WASTE %</th>
            <th style="text-align:left;">REASON</th>
          </tr>
        </thead>
        <tbody>${allRows}${allTotalRow}</tbody>
      </table>
    </div>`;

    // ================= DETAILED ENTRIES TABLE =================
    const tdc = "text-align:center;";
    let detailRows = "";
    entries.forEach((r, i) => {
      detailRows += `
        <tr>
          <td style="${tdc}">${i + 1}</td>
          <td>${escapeHtml(r.machineId?.machineName) || "-"}</td>
          <td>${escapeHtml(r.printerName) || "-"}</td>
          <td style="${tdc}">${escapeHtml(r.shift) || "-"}</td>
          <td style="${tdc}">${escapeHtml(r.woNumber) || "-"}</td>
          <td>${escapeHtml(r.customerName) || "-"}</td>
          <td>${escapeHtml(r.materialType) || "-"}</td>
          <td style="${tdc}">${escapeHtml(r.machineStatus) || "-"}</td>
          <td style="${tdc}">${formatHMS(getDurationMins(r.fromTime, r.toTime))}</td>
          <td style="text-align:right;">${r.totalPages ? Number(r.totalPages).toLocaleString("en-IN") : "-"}</td>
          <td style="text-align:right;">${r.wastageSheets ? Number(r.wastageSheets).toLocaleString("en-IN") : "-"}</td>
          <td style="${tdc}">${r.wastePercentage ? escapeHtml(r.wastePercentage) + "%" : "-"}</td>
          <td>${escapeHtml(r.reason) || "-"}</td>
          <td style="${tdc}">${escapeHtml(r.paperSize) || "-"}</td>
        </tr>`;
    });

    const detailTable = `
      <br/>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead style="background:#a9cce3;text-align:center;">
          <tr>
            <th>#</th>
            <th style="text-align:left;">MACHINE</th>
            <th style="text-align:left;">PRINTER</th>
            <th>SHIFT</th>
            <th>WO NUMBER</th>
            <th style="text-align:left;">CUSTOMER NAME</th>
            <th style="text-align:left;">ITEM</th>
            <th>STATUS</th>
            <th>TOTAL TIME</th>
            <th>PAGES</th>
            <th>WASTAGE</th>
            <th>WASTE %</th>
            <th style="text-align:left;">REASON</th>
            <th>PAPER SIZE</th>
          </tr>
        </thead>
        <tbody>${detailRows}</tbody>
      </table>`;

    const html = `
    <div style="font-family:Arial,sans-serif">
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead style="background:#a9cce3;text-align:center;">
          <tr>
            <th rowspan="2">#</th>
            <th rowspan="2" style="text-align:left;">MACHINE NAME</th>
            <th rowspan="2" style="text-align:left;">PRINTER NAME</th>
            <th colspan="${paperSizeColumns.length}">PRODUCTION COUNT</th>
            <th rowspan="2">PRINTING TIME</th>
            <th rowspan="2">IDLE TIME</th>
            <th rowspan="2">BREAKDOWN TIME</th>
            <th rowspan="2">MAINTENANCE TIME</th>
            <th rowspan="2">TOTAL TIMINGS</th>
          </tr>
          <tr>
            ${paperSizeColumns.map((sz) => `<th>${escapeHtml(sz)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${rows}${totalRow}</tbody>
      </table>
      ${detailTable}
    </div>`;

    // ================= SUMMARY FORMAT (same as the app's Summary Report) =================
    const shiftSizes = [...new Set(consolidated.flatMap((c) => [...Object.keys(c.dayBySize), ...Object.keys(c.nightBySize)]))].sort();
    const cols = shiftSizes.length ? shiftSizes : ["-"];

    // keep each machine's printers together
    const machineOrder = [...new Set(consolidated.map((c) => c.machineName))];
    const sorted = [...consolidated].sort(
      (a, b) => machineOrder.indexOf(a.machineName) - machineOrder.indexOf(b.machineName)
    );

    const machineCnt = {};
    sorted.forEach((c) => { machineCnt[c.machineName] = (machineCnt[c.machineName] || 0) + 1; });
    const seenM = {};

    const sumOf = (o) => Object.values(o).reduce((s, v) => s + v, 0);
    const qtyCell = (o, sz) =>
      `<td style="text-align:right;">${o[sz] !== undefined ? o[sz].toLocaleString("en-IN") : "-"}</td>`;

    let sumRows = "";
    sorted.forEach((c) => {
      const first = !seenM[c.machineName];
      seenM[c.machineName] = true;
      const entered = Object.keys(c.dayBySize).length || Object.keys(c.nightBySize).length;
      const grand = sumOf(c.dayBySize) + sumOf(c.nightBySize);

      // no entry made for this machine/printer -> one merged message cell instead of dashes/zeros
      if (!c.hasEntry) {
        sumRows += `
        <tr>
          ${first ? `<td rowspan="${machineCnt[c.machineName]}" style="${td}font-weight:bold;">${escapeHtml(c.machineName)}</td>` : ""}
          <td style="${td}font-weight:bold;">${escapeHtml(c.printerName) || "-"}</td>
          <td colspan="${2 * cols.length + 6}" style="text-align:center;font-weight:bold;color:#b45309;background:#fff7e6;">No entry made</td>
        </tr>`;
        return;
      }

      sumRows += `
        <tr>
          ${first ? `<td rowspan="${machineCnt[c.machineName]}" style="${td}font-weight:bold;">${escapeHtml(c.machineName)}</td>` : ""}
          <td style="${td}font-weight:bold;">${escapeHtml(c.printerName) || "-"}</td>
          ${cols.map((sz) => qtyCell(c.dayBySize, sz)).join("")}
          ${cols.map((sz) => qtyCell(c.nightBySize, sz)).join("")}
          <td style="text-align:right;font-weight:bold;">${entered ? grand.toLocaleString("en-IN") : "-"}</td>
          <td style="${td}">${formatHMS(c.printingMins)}</td>
          <td style="${td}">${formatHMS(c.idleMins)}</td>
          <td style="${td}">${formatHMS(c.breakdownMins)}</td>
          <td style="${td}">${formatHMS(c.maintenanceMins)}</td>
          <td style="${td}font-weight:bold;${allMins(c) < 1440 ? "color:#dc2626;background:#fee2e2;" : ""}">${formatHMS(allMins(c))}</td>
        </tr>`;
    });

    const dayTotals = {};
    const nightTotals = {};
    shiftSizes.forEach((sz) => {
      dayTotals[sz] = consolidated.reduce((s, c) => s + (c.dayBySize[sz] || 0), 0);
      nightTotals[sz] = consolidated.reduce((s, c) => s + (c.nightBySize[sz] || 0), 0);
    });
    const grandAll = sumOf(dayTotals) + sumOf(nightTotals);

    const sumTotalRow = `
      <tr style="background:#1a2a3a;color:#ffffff;font-weight:bold;">
        <td colspan="2" style="text-align:right;">TOTAL</td>
        ${cols.map((sz) => qtyCell(dayTotals, sz)).join("")}
        ${cols.map((sz) => qtyCell(nightTotals, sz)).join("")}
        <td style="text-align:right;">${grandAll.toLocaleString("en-IN")}</td>
        <td style="${td}">${formatHMS(totals.printingMins)}</td>
        <td style="${td}">${formatHMS(totals.idleMins)}</td>
        <td style="${td}">${formatHMS(totals.breakdownMins)}</td>
        <td style="${td}">${formatHMS(totals.maintenanceMins)}</td>
        <td style="${td}">${formatHMS(allMins(totals))}</td>
      </tr>`;

    const htmlSummary = `
    <div style="font-family:Arial,sans-serif">
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead style="background:#a9cce3;text-align:center;">
          <tr>
            <th rowspan="3">MACHINE</th>
            <th rowspan="3">PRINTER</th>
            <th colspan="${1 + 2 * cols.length}">DATE ${dateStr}</th>
            <th colspan="5">MACHINE HOURS</th>
          </tr>
          <tr>
            <th colspan="${cols.length}">DAY SHIFT</th>
            <th colspan="${cols.length}">NIGHT SHIFT</th>
            <th rowspan="2">GRAND TOTAL</th>
            <th rowspan="2">PRODUCTION TIME</th>
            <th rowspan="2">IDLE TIME</th>
            <th rowspan="2">BREAKDOWN TIME</th>
            <th rowspan="2">MAINTENANCE TIME</th>
            <th rowspan="2">TOTAL TIMINGS</th>
          </tr>
          <tr>
            ${cols.map((sz) => `<th>${escapeHtml(sz)}</th>`).join("")}
            ${cols.map((sz) => `<th>${escapeHtml(sz)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${sumRows}${sumTotalRow}</tbody>
      </table>
    </div>`;

    // recipients: fixed TO list only
    const recipients = TO || [];

    if (!recipients.length) {
      console.log("⚠️ The fixed TO list is empty/undefined - check utils/productionMailConfig.js. Mail not sent.");
      return;
    }

    // don't repeat an address in both TO and CC
    const ccList = (CC || []).filter((c) => !recipients.includes(c));

    // ================= EXCEL ATTACHMENT: DETAILED REPORT =================
    const xDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
    const xTime = (t) => {
      if (!t) return "";
      const [h, m] = String(t).split(":");
      let hr = Number(h);
      const ap = hr >= 12 ? "PM" : "AM";
      hr = hr % 12 || 12;
      return `${hr}:${m} ${ap}`;
    };
    const xTotal = (from, to) => {
      if (!from || !to) return "";
      const mins = getDurationMins(from, to);
      return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
    };

    const excelRows = entries.map((r, i) => ({
      "Sl No": i + 1,
      Date: xDate(r.productionDate),
      "WO Number": r.woNumber || "",
      Shift: r.shift || "",
      Printer: r.printerName || "",
      Machine: r.machineId?.machineName || "",
      Status: r.machineStatus || "",
      Customer: r.customerName || "",
      Item: r.materialType || "",
      "From Time": xTime(r.fromTime),
      "To Time": xTime(r.toTime),
      "Total Time": xTotal(r.fromTime, r.toTime),
      "Total Pages": r.totalPages || "",
      "Wastage Sheets": r.wastageSheets || "",
      "Waste %": r.wastePercentage || "",
      Reason: r.reason || "",
      "Paper Size": r.paperSize || "",
      User: r.enteredBy || "",
      Remarks: r.remarks || "",
    }));

    const xws = XLSX.utils.json_to_sheet(excelRows);
    xws["!cols"] = [
      { wch: 7 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 20 }, { wch: 22 }, { wch: 14 },
      { wch: 26 }, { wch: 22 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 14 },
      { wch: 10 }, { wch: 28 }, { wch: 12 }, { wch: 18 },
    ];
    const xwb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(xwb, xws, "Production Records");
    const excelBuffer = XLSX.write(xwb, { type: "buffer", bookType: "xlsx" });

    await sendMail({
      to: recipients,
      cc: ccList,
      subject: `PERSO PRODUCTION REPORT ${dateStr}.`,
      html: entries.length ? htmlSummary : htmlNoEntry,
      attachments: entries.length
        ? [
            {
              filename: `Perso_Production_Detailed_${dateStr}.xlsx`,
              content: excelBuffer,
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ]
        : [],
    });

    console.log(
      `✅ Perso production report mail sent for ${dateStr} | to: ${recipients.join(", ")}`
    );
  } catch (err) {
    console.error("❌ Perso Production Mail Cron Error:", err);
  }
});