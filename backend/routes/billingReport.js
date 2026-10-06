const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const router = express.Router();
const XLSX = require("xlsx");
const protect = require("../middleware/authMiddleware"); // adjust path if different
const BillingReport = require("../models/Billingreport");
const BillingReportCounter = require("../models/BillingReportCounter");

const upload = multer({ storage: multer.memoryStorage() });

const UPLOADS_DIR = path.join(__dirname, "..", "uploads", "billing-reports");

// Strip characters that are invalid/unsafe in Windows & Unix filenames,
// collapse whitespace to underscores, and trim to a reasonable length.
function sanitizeForFilename(str) {
  return String(str)
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

// Atomically get the next report number, e.g. "BR-2026-00001".
// Sequence resets per calendar year (counter key includes the year).
async function getNextReportNumber() {
  const year = new Date().getFullYear();
  const counterKey = `billingReport-${year}`;
  const counter = await BillingReportCounter.findByIdAndUpdate(
    counterKey,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const seq = String(counter.seq).padStart(5, "0");
  return `BR-${year}-${seq}`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseExcelLikeDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const dc = XLSX.SSF.parse_date_code(value);
    return dc ? new Date(Date.UTC(dc.y, dc.m - 1, dc.d, dc.H, dc.M, Math.round(dc.S))) : null;
  }

  const s = normalizeText(value);
  const match = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
}

function parseCanaraLoadDate(value) {
  if (value instanceof Date) {
    const day = value.getUTCDate();
    const month = value.getUTCMonth() + 1;
    const year = value.getUTCFullYear();

    // Canara's uploaded .xls is an HTML table with dd-mm-yyyy dates.
    // Some parsers read 01-07-2026 as Jan 7, so swap ambiguous Date objects back.
    if (day <= 12) {
      return new Date(Date.UTC(year, day - 1, month));
    }

    return new Date(Date.UTC(year, value.getUTCMonth(), day));
  }

  return parseExcelLikeDate(value);
}

function addDaysUTC(date, days) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function nextProcessingDate(date) {
  if (!date) return "";
  const next = addDaysUTC(date, 1);
  // Keep the sample pattern: Sunday processing moves to Monday.
  return next.getUTCDay() === 0 ? addDaysUTC(next, 1) : next;
}

function firstDayOfMonth(date) {
  return date ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)) : "";
}

function financialYearLabel(date) {
  if (!date) return "";
  const billingMonth = firstDayOfMonth(date);
  const year = billingMonth.getUTCFullYear();
  const startYear = billingMonth.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function canaraWoSortValue(wono) {
  const match = normalizeText(wono).match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function extractCanaraOrderNo(fileName) {
  const s = normalizeText(fileName);
  const match = s.match(/^ORD-(\d+)/i);
  return match ? match[1] : s;
}

function extractCanaraLocation(fileName) {
  const s = normalizeText(fileName);
  const match = s.match(/_([^_.]+)\.[^.]+$/);
  return match ? match[1] : "";
}

function findRequiredColumn(headerRow, columnName) {
  const idx = headerRow.findIndex(
    (h) => normalizeText(h).toLowerCase() === columnName.toLowerCase()
  );
  if (idx === -1) {
    throw new Error(`Could not find "${columnName}" column needed for the Canara Bank reports.`);
  }
  return idx;
}

function styleCanaraSheet(ws) {
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });
}

function buildCanaraReports(rows) {
  const headerRow = rows[0] || [];
  const indexes = {
    wono: findRequiredColumn(headerRow, "WONO"),
    leaves: findRequiredColumn(headerRow, "NumberOfLeavesPerbook"),
    books: findRequiredColumn(headerRow, "NumberOfBooks"),
    lvs: findRequiredColumn(headerRow, "NumberOfLvs"),
    product: findRequiredColumn(headerRow, "Product"),
    fileName: findRequiredColumn(headerRow, "MasterFileName"),
    loadDate: findRequiredColumn(headerRow, "LoadDate"),
  };

  const regularRows = rows
    .slice(1)
    .filter((row) => normalizeText(row[indexes.product]).toLowerCase() === "regular ii");

  if (!regularRows.length) {
    throw new Error('No "Regular II" rows found for the Canara Bank reports.');
  }

  const leafBuckets = [20, 25, 50, 100];
  const groupsByWoFile = new Map();

  regularRows.forEach((row) => {
    const wono = normalizeText(row[indexes.wono]);
    const fileName = normalizeText(row[indexes.fileName]);
    const key = `${wono}||${fileName}`;
    if (!groupsByWoFile.has(key)) {
      const loadDate = parseCanaraLoadDate(row[indexes.loadDate]);
      groupsByWoFile.set(key, {
        wono,
        fileName,
        orderNo: extractCanaraOrderNo(fileName),
        location: extractCanaraLocation(fileName),
        loadDate,
        lvsByLeaves: { 20: 0, 25: 0, 50: 0, 100: 0 },
        booksByLeaves: { 20: 0, 25: 0, 50: 0, 100: 0 },
      });
    }

    const group = groupsByWoFile.get(key);
    const leaves = asNumber(row[indexes.leaves]);
    if (leafBuckets.includes(leaves)) {
      group.lvsByLeaves[leaves] += asNumber(row[indexes.lvs]);
      group.booksByLeaves[leaves] += asNumber(row[indexes.books]);
    }
  });

  const detailGroups = Array.from(groupsByWoFile.values()).sort((a, b) => {
    const woDiff = canaraWoSortValue(a.wono) - canaraWoSortValue(b.wono);
    if (woDiff !== 0) return woDiff;
    return a.wono.localeCompare(b.wono, undefined, { numeric: true, sensitivity: "base" });
  });

  const billingWorkbook = new ExcelJS.Workbook();
  const billingSheet = billingWorkbook.addWorksheet("Sheet1");
  billingSheet.getRow(2).values = [
    "Billing Month",
    "Financial Year",
    "Received Date  ",
    "WO No.",
    "Job Order No",
    "File Name",
    "Printing Location",
    "Total Quantity of Data Received\n(in Books)",
    "Total Data Received\n(20 lvs in Books)",
    "Total Data Received\n(25 lvs in Books)",
    "Total Data Received\n(50 lvs in Books)",
    "Total Data Received\n(100 lvs in Books)",
    "Total Quantity Despatched\n(in Books)",
    "Total Quantity\n(in 20 lvs)",
    "Total Quantity\n(in 25 lvs)",
    "Total Quantity\n(in 50 lvs)",
    "Total Quantity\n(in 100 lvs)",
    "Total Quantity\n(in Lvs)",
    "Remarks",
  ];
  billingSheet.getRow(2).font = { bold: true };
  billingSheet.columns = [
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 18 },
    { width: 42 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  detailGroups.forEach((group, i) => {
    const rowNumber = i + 3;
    const row = billingSheet.getRow(rowNumber);
    row.getCell(1).value = firstDayOfMonth(group.loadDate);
    row.getCell(2).value = financialYearLabel(group.loadDate);
    row.getCell(3).value = group.loadDate;
    row.getCell(4).value = group.wono;
    row.getCell(5).value = group.orderNo;
    row.getCell(6).value = group.fileName;
    row.getCell(7).value = group.location;
    row.getCell(8).value = { formula: `M${rowNumber}` };
    row.getCell(9).value = { formula: `N${rowNumber}/20` };
    row.getCell(10).value = { formula: `O${rowNumber}/25` };
    row.getCell(11).value = { formula: `P${rowNumber}/50` };
    row.getCell(12).value = { formula: `Q${rowNumber}/100` };
    row.getCell(13).value = { formula: `SUM(I${rowNumber}:L${rowNumber})` };
    row.getCell(14).value = group.lvsByLeaves[20];
    row.getCell(15).value = group.lvsByLeaves[25];
    row.getCell(16).value = group.lvsByLeaves[50];
    row.getCell(17).value = group.lvsByLeaves[100];
    row.getCell(18).value = { formula: `SUM(N${rowNumber}:Q${rowNumber})` };
  });

  const billingLastRow = detailGroups.length + 2; // last row with data (rows start at 3)
  const billingTotalRow = billingLastRow + 1;
  const billingTotal = billingSheet.getRow(billingTotalRow);
  billingTotal.getCell(7).value = "Total";
  billingTotal.getCell(8).value = { formula: `SUM(H3:H${billingLastRow})` };
  billingTotal.getCell(9).value = { formula: `SUM(I3:I${billingLastRow})` };
  billingTotal.getCell(10).value = { formula: `SUM(J3:J${billingLastRow})` };
  billingTotal.getCell(11).value = { formula: `SUM(K3:K${billingLastRow})` };
  billingTotal.getCell(12).value = { formula: `SUM(L3:L${billingLastRow})` };
  billingTotal.getCell(13).value = { formula: `SUM(M3:M${billingLastRow})` };
  billingTotal.getCell(14).value = { formula: `SUM(N3:N${billingLastRow})` };
  billingTotal.getCell(15).value = { formula: `SUM(O3:O${billingLastRow})` };
  billingTotal.getCell(16).value = { formula: `SUM(P3:P${billingLastRow})` };
  billingTotal.getCell(17).value = { formula: `SUM(Q3:Q${billingLastRow})` };
  billingTotal.getCell(18).value = { formula: `SUM(R3:R${billingLastRow})` };
  billingTotal.font = { bold: true };

  billingSheet.getColumn(1).numFmt = "dd-mm-yyyy";
  billingSheet.getColumn(3).numFmt = "dd-mm-yyyy";
  styleCanaraSheet(billingSheet);

  const orderGroups = new Map();
  detailGroups.forEach((group) => {
    if (!orderGroups.has(group.orderNo)) {
      orderGroups.set(group.orderNo, {
        orderNo: group.orderNo,
        loadDate: group.loadDate,
        booksByLeaves: { 20: 0, 25: 0, 50: 0, 100: 0 },
      });
    }
    const order = orderGroups.get(group.orderNo);
    leafBuckets.forEach((leaves) => {
      order.booksByLeaves[leaves] += group.booksByLeaves[leaves];
    });
  });

  const orderRows = Array.from(orderGroups.values()).sort((a, b) =>
    a.orderNo.localeCompare(b.orderNo, undefined, { numeric: true, sensitivity: "base" })
  );

  const misWorkbook = new ExcelJS.Workbook();
  const misSheet = misWorkbook.addWorksheet("Sheet1");
  misSheet.getRow(2).values = [
    "Date of order by Bank",
    "Order No",
    "Total No. of Records Book wise received",
    "",
    "",
    "",
    "Outfile Received Date from printer",
    "Outfile Processed Date by bank",
    "Rejected in books",
    "",
    "",
    "",
    "",
    "Total No. of Records Book wise post rejection",
    "",
    "",
    "",
    "",
    "Status of Printing and Dispatch",
    "",
    "",
    "",
  ];
  misSheet.getRow(3).values = [
    "",
    "",
    "20LV Books",
    "25LV Books",
    "50LV Books",
    "100LV Books",
    "Outfile Received Date from printer",
    "Outfile Processed Date by bank",
    "20 LV Books",
    "25 LV Books",
    "50 LV Books",
    "100 LV Books",
    "Total Rejected Records",
    "20LV Books",
    "25LV Books",
    "50LV Books",
    "100LV Books",
    "No. of Successful Records in Books",
    "DATE OF PRINTING",
    "DATE OF BINDING",
    "DATE OF DISPATCH",
    "Remarks",
  ];
  [2, 3].forEach((rn) => (misSheet.getRow(rn).font = { bold: true }));
  for (let c = 1; c <= 22; c++) misSheet.getColumn(c).width = c === 2 ? 18 : 16;

  orderRows.forEach((group, i) => {
    const rowNumber = i + 4;
    const row = misSheet.getRow(rowNumber);
    const printingDate = group.loadDate || "";
    const completionDate = group.loadDate ? nextProcessingDate(group.loadDate) : "";
    row.getCell(1).value = group.loadDate;
    row.getCell(2).value = group.orderNo;
    row.getCell(3).value = group.booksByLeaves[20];
    row.getCell(4).value = group.booksByLeaves[25];
    row.getCell(5).value = group.booksByLeaves[50];
    row.getCell(6).value = group.booksByLeaves[100];
    row.getCell(7).value = group.loadDate;
    row.getCell(8).value = group.loadDate;
    row.getCell(9).value = 0;
    row.getCell(10).value = 0;
    row.getCell(11).value = 0;
    row.getCell(12).value = 0;
    row.getCell(13).value = { formula: `I${rowNumber}+J${rowNumber}+K${rowNumber}+L${rowNumber}` };
    row.getCell(14).value = group.booksByLeaves[20];
    row.getCell(15).value = group.booksByLeaves[25];
    row.getCell(16).value = group.booksByLeaves[50];
    row.getCell(17).value = group.booksByLeaves[100];
    row.getCell(18).value = { formula: `N${rowNumber}+O${rowNumber}+P${rowNumber}+Q${rowNumber}` };
    row.getCell(19).value = printingDate;
    row.getCell(20).value = completionDate;
    row.getCell(21).value = completionDate;
  });

  const misLastRow = orderRows.length + 3; // last row with data (rows start at 4)
  const misTotalRow = misLastRow + 1;
  const misTotal = misSheet.getRow(misTotalRow);
  misTotal.getCell(2).value = "Total";
  misTotal.getCell(13).value = { formula: `SUM(M4:M${misLastRow})` };
  misTotal.getCell(14).value = { formula: `SUM(N4:N${misLastRow})` };
  misTotal.getCell(15).value = { formula: `SUM(O4:O${misLastRow})` };
  misTotal.getCell(16).value = { formula: `SUM(P4:P${misLastRow})` };
  misTotal.getCell(17).value = { formula: `SUM(Q4:Q${misLastRow})` };
  misTotal.getCell(18).value = { formula: `SUM(R4:R${misLastRow})` };
  misTotal.font = { bold: true };

  [1, 7, 8, 19, 20, 21].forEach((col) => {
    misSheet.getColumn(col).numFmt = "dd-mm-yyyy";
  });
  styleCanaraSheet(misSheet);

  const pivotHeaders = [
    "Row Labels",
    "Sum of Total Data Received\n(20 lvs in Books)",
    "Sum of Total Data Received\n(25 lvs in Books)",
    "Sum of Total Data Received\n(50 lvs in Books)",
    "Sum of Total Data Received\n(100 lvs in Books)",
    "Sum of Total Quantity Despatched\n(in Books)",
  ];

  const addPivotSheet = (wb, startRow) => {
    const ws = wb.addWorksheet("Sheet3");
    ws.getRow(startRow).values = pivotHeaders;
    ws.getRow(startRow).font = { bold: true };
    ws.columns = [{ width: 18 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 24 }];

    let rowNumber = startRow + 1;
    orderRows.forEach((group) => {
      const books20 = group.booksByLeaves[20];
      const books25 = group.booksByLeaves[25];
      const books50 = group.booksByLeaves[50];
      const books100 = group.booksByLeaves[100];
      const total = books20 + books25 + books50 + books100;

      ws.getRow(rowNumber).values = [group.loadDate, books20, books25, books50, books100, total];
      ws.getCell(rowNumber, 1).numFmt = "dd-mm-yyyy";
      rowNumber++;
      ws.getRow(rowNumber).values = [group.orderNo, books20, books25, books50, books100, total];
      rowNumber++;
    });

    ws.getRow(rowNumber).values = [
      "Grand Total",
      { formula: `SUM(B${startRow + 1}:B${rowNumber - 1})/2` },
      { formula: `SUM(C${startRow + 1}:C${rowNumber - 1})/2` },
      { formula: `SUM(D${startRow + 1}:D${rowNumber - 1})/2` },
      { formula: `SUM(E${startRow + 1}:E${rowNumber - 1})/2` },
      { formula: `SUM(F${startRow + 1}:F${rowNumber - 1})/2` },
    ];
    ws.getRow(rowNumber).font = { bold: true };
    styleCanaraSheet(ws);
  };

  addPivotSheet(billingWorkbook, 3);
  addPivotSheet(misWorkbook, 1);

  return [
    {
      workbook: billingWorkbook,
      label: "Billing MIS",
      fileNamePrefix: "Billing_MIS_Canara_Bank_Perso_Cheques",
    },
    {
      workbook: misWorkbook,
      label: "MIS",
      fileNamePrefix: "MIS_Canara_Bank_Perso_Cheque",
    },
  ];
}

router.post("/generate", protect, upload.single("file"), async (req, res) => {
  try {
    const { customerName } = req.body;
    if (!req.file) return res.status(400).json({ message: "Excel file is required" });
    if (!customerName) return res.status(400).json({ message: "customerName is required" });

    console.log("Uploaded file:", req.file.originalname, req.file.mimetype, req.file.size);

    const isXlsx = req.file.originalname.toLowerCase().endsWith(".xlsx");
    const isXls = req.file.originalname.toLowerCase().endsWith(".xls");

    if (!isXlsx && !isXls) {
      return res.status(400).json({
        message: "Please upload a .xlsx or .xls file.",
      });
    }

    // Read the uploaded file (works for both .xls and .xlsx) using SheetJS,
    // then extract raw rows and rebuild a fresh ExcelJS worksheet from them.
    // (We avoid loading a SheetJS-written buffer into ExcelJS's own loader —
    // that round-trip produces files Excel flags as "unreadable content".)
    // NOTE: cellDates:true is intentionally NOT used here. SheetJS's cellDates
    // parsing uses the server's local timezone when converting an Excel date
    // serial into a JS Date, which silently corrupts dates on any server not
    // running in UTC (e.g. IST servers shift every date back by ~5:30).
    // Instead we parse date cells ourselves in a timezone-independent way.
    const sourceWorkbook = XLSX.read(req.file.buffer, { type: "buffer", cellNF: true });
    const sourceSheetName = sourceWorkbook.SheetNames[0];
    const sourceSheet = sourceWorkbook.Sheets[sourceSheetName];

    if (!sourceSheet) {
      return res.status(400).json({
        message: "Could not read any worksheet from the uploaded file. Make sure it's a valid Excel file.",
      });
    }

    function excelSerialToUTCDate(serial) {
      const dc = XLSX.SSF.parse_date_code(serial);
      if (!dc) return null;
      return new Date(Date.UTC(dc.y, dc.m - 1, dc.d, dc.H, dc.M, Math.round(dc.S)));
    }

    const range = XLSX.utils.decode_range(sourceSheet["!ref"]);
    const rows = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sourceSheet[XLSX.utils.encode_cell({ r, c })];
        if (!cell) {
          row.push("");
        } else if (cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z)) {
          row.push(excelSerialToUTCDate(cell.v));
        } else {
          row.push(cell.v !== undefined ? cell.v : "");
        }
      }
      rows.push(row);
    }

    const workbook = new ExcelJS.Workbook();
    const dataSheet = workbook.addWorksheet(sourceSheetName);
    rows.forEach((row) => {
      const addedRow = dataSheet.addRow(row);
      addedRow.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value instanceof Date) {
          cell.numFmt = "dd-mm-yyyy";
        }
      });
    });

    const sheetName = dataSheet.name;
    const q = (s) => `'${s.replace(/'/g, "''")}'`;
    const ref = (col) => `${q(sheetName)}!${col}:${col}`;

    const sumifs = (sumCol, criteria) => {
      const parts = criteria.map(([col, val]) => `${ref(col)},${val}`).join(",");
      return `SUMIFS(${ref(sumCol)},${parts})`;
    };

    const isFederalBank = customerName.trim().toUpperCase() === "FEDERAL BANK";
    const isKarnatakaBank = customerName.trim().toUpperCase() === "KARNATAKA BANK";
    const isCanaraBank = customerName.trim().toUpperCase() === "CANARA BANK";

    // Shared by Federal Bank + Karnataka Bank branches
    const headerRow = rows[0] || [];
    const colLetter = (idx) => {
      let letter = "";
      let n = idx + 1;
      while (n > 0) {
        const rem = (n - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        n = Math.floor((n - 1) / 26);
      }
      return letter;
    };
    const findCol = (name) =>
      headerRow.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
    const criteriaStr = (v) => `"${String(v).replace(/"/g, '""')}"`;

    if (isCanaraBank) {
      // ---------- Canara Bank: generate two separate Excel reports ----------
      const canaraReports = buildCanaraReports(rows);

      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

      const reportNumber = await getNextReportNumber();
      const generatedFiles = [];
      for (const report of canaraReports) {
        const buffer = await report.workbook.xlsx.writeBuffer();
        const generatedFileName = `${report.fileNamePrefix}_${reportNumber}.xlsx`;
        const absoluteFilePath = path.join(UPLOADS_DIR, generatedFileName);

        fs.writeFileSync(absoluteFilePath, Buffer.from(buffer));

        generatedFiles.push({
          reportNumber,
          label: report.label,
          fileName: generatedFileName,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          base64: Buffer.from(buffer).toString("base64"),
        });
      }

      const reportDoc = await BillingReport.create({
        reportNumber,
        customerName,
        originalFileName: req.file.originalname,
        generatedFileName: `Canara_Bank_Reports_${reportNumber}.xlsx`,
        filePath: path.join("uploads", "billing-reports", generatedFiles[0].fileName),
        generatedBy: req.user?._id,
        generatedByName: req.user?.name || "",
      });

      return res.json({
        message: "Canara Bank reports generated successfully.",
        reportNumber,
        reportId: reportDoc._id.toString(),
        files: generatedFiles,
      });
    }

    if (isFederalBank) {
      // ---------- Federal Bank: one sheet per Product value ----------
      const productColIdx = headerRow.findIndex(
        (h) => String(h).trim().toLowerCase() === "product"
      );

      if (productColIdx === -1) {
        return res.status(400).json({
          message: 'Could not find a "Product" column in the uploaded file for Federal Bank.',
        });
      }

      const groups = new Map(); // product value -> its rows, in first-seen order
      rows.slice(1).forEach((row) => {
        const key =
          row[productColIdx] !== undefined && row[productColIdx] !== ""
            ? String(row[productColIdx])
            : "Unspecified";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });

      const usedSheetNames = new Set([sheetName.toLowerCase()]);
      const sanitizeSheetName = (name) => {
        const base = String(name).replace(/[:\\/?*\[\]]/g, " ").trim().slice(0, 31) || "Product";
        let candidate = base;
        let n = 1;
        while (usedSheetNames.has(candidate.toLowerCase())) {
          const suffix = ` (${++n})`;
          candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
        }
        usedSheetNames.add(candidate.toLowerCase());
        return candidate;
      };

      for (const [productValue, productRows] of groups.entries()) {
        const productSheet = workbook.addWorksheet(sanitizeSheetName(productValue));
        productSheet.addRow(headerRow);
        productRows.forEach((row) => {
          const addedRow = productSheet.addRow(row);
          addedRow.eachCell({ includeEmpty: false }, (cell) => {
            if (cell.value instanceof Date) cell.numFmt = "dd-mm-yyyy";
          });
        });
        productSheet.getRow(1).font = { bold: true };
      }

      // ---------- Summarry + Detailed summarry (pivot-style) ----------
      const leavesColIdx = findCol("NumberOfLeavesPerbook");
      const booksColIdx = findCol("NumberOfBooks");
      const lvsColIdx = findCol("NumberOfLvs");
      const variantColIdx = findCol("VariantName");

      if ([leavesColIdx, booksColIdx, lvsColIdx, variantColIdx].some((i) => i === -1)) {
        return res.status(400).json({
          message:
            "Could not find NumberOfLeavesPerbook / NumberOfBooks / NumberOfLvs / VariantName columns needed for the Federal Bank summary sheets.",
        });
      }

      const LEAVES_COL = colLetter(leavesColIdx);
      const BOOKS_COL = colLetter(booksColIdx);
      const LVS_COL = colLetter(lvsColIdx);
      const PRODUCT_COL = colLetter(productColIdx);
      const VARIANT_COL = colLetter(variantColIdx);

      const bodyRows = rows.slice(1);

      const leavesSet = new Set();
      let hasBlankLeaves = false;
      bodyRows.forEach((row) => {
        const v = row[leavesColIdx];
        if (v === undefined || v === null || v === "") hasBlankLeaves = true;
        else leavesSet.add(Number(v));
      });
      const leavesValues = Array.from(leavesSet).sort((a, b) => a - b);

      const productsSorted = Array.from(groups.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );

      // ---- Summarry ----
      const summarySheet = workbook.addWorksheet("Summarry");
      summarySheet.getCell("B3").value = "NumberOfLeavesPerbook";
      summarySheet.getCell("C3").value = "Data";

      let col = 2;
      const leavesColStart = {};
      leavesValues.forEach((v) => {
        summarySheet.getCell(4, col).value = v;
        leavesColStart[v] = col;
        summarySheet.getCell(5, col).value = "Sum of NumberOfBooks";
        summarySheet.getCell(5, col + 1).value = "Sum of NumberOfLvs";
        col += 2;
      });
      let blankLeavesCol = null;
      if (hasBlankLeaves) {
        summarySheet.getCell(4, col).value = "(blank)";
        blankLeavesCol = col;
        summarySheet.getCell(5, col).value = "Sum of NumberOfBooks";
        summarySheet.getCell(5, col + 1).value = "Sum of NumberOfLvs";
        col += 2;
      }
      const totalBooksCol = col;
      const totalLvsCol = col + 1;
      summarySheet.getCell(4, totalBooksCol).value = "Total Sum of NumberOfBooks";
      summarySheet.getCell(4, totalLvsCol).value = "Total Sum of NumberOfLvs";
      summarySheet.getCell(5, 1).value = "Product";

      let rowNum = 6;
      productsSorted.forEach((product) => {
        const r = summarySheet.getRow(rowNum);
        r.getCell(1).value = product;
        leavesValues.forEach((v) => {
          const c = leavesColStart[v];
          r.getCell(c).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, v]]) };
          r.getCell(c + 1).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, v]]) };
        });
        if (blankLeavesCol) {
          r.getCell(blankLeavesCol).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, '""']]) };
          r.getCell(blankLeavesCol + 1).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, '""']]) };
        }
        r.getCell(totalBooksCol).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)]]) };
        r.getCell(totalLvsCol).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)]]) };
        rowNum++;
      });

      const summaryGrandTotal = summarySheet.getRow(rowNum);
      summaryGrandTotal.getCell(1).value = "Grand Total";
      leavesValues.forEach((v) => {
        const c = leavesColStart[v];
        summaryGrandTotal.getCell(c).value = { formula: sumifs(BOOKS_COL, [[LEAVES_COL, v]]) };
        summaryGrandTotal.getCell(c + 1).value = { formula: sumifs(LVS_COL, [[LEAVES_COL, v]]) };
      });
      if (blankLeavesCol) {
        summaryGrandTotal.getCell(blankLeavesCol).value = { formula: sumifs(BOOKS_COL, [[LEAVES_COL, '""']]) };
        summaryGrandTotal.getCell(blankLeavesCol + 1).value = { formula: sumifs(LVS_COL, [[LEAVES_COL, '""']]) };
      }
      summaryGrandTotal.getCell(totalBooksCol).value = { formula: `SUM(${ref(BOOKS_COL)})` };
      summaryGrandTotal.getCell(totalLvsCol).value = { formula: `SUM(${ref(LVS_COL)})` };

      [3, 4, 5].forEach((rn) => (summarySheet.getRow(rn).font = { bold: true }));
      summaryGrandTotal.font = { bold: true };

      // ---- Detailed summarry (Product + VariantName) ----
      const detailedSheet = workbook.addWorksheet("Detailed summarry");
      detailedSheet.getCell("C3").value = "NumberOfLeavesPerbook";
      detailedSheet.getCell("D3").value = "Data";

      let dcol = 3;
      const dLeavesColStart = {};
      leavesValues.forEach((v) => {
        detailedSheet.getCell(4, dcol).value = v;
        dLeavesColStart[v] = dcol;
        detailedSheet.getCell(5, dcol).value = "Sum of NumberOfBooks";
        detailedSheet.getCell(5, dcol + 1).value = "Sum of NumberOfLvs";
        dcol += 2;
      });
      let dBlankLeavesCol = null;
      if (hasBlankLeaves) {
        detailedSheet.getCell(4, dcol).value = "(blank)";
        dBlankLeavesCol = dcol;
        detailedSheet.getCell(5, dcol).value = "Sum of NumberOfBooks";
        detailedSheet.getCell(5, dcol + 1).value = "Sum of NumberOfLvs";
        dcol += 2;
      }
      const dTotalBooksCol = dcol;
      const dTotalLvsCol = dcol + 1;
      detailedSheet.getCell(4, dTotalBooksCol).value = "Total Sum of NumberOfBooks";
      detailedSheet.getCell(4, dTotalLvsCol).value = "Total Sum of NumberOfLvs";
      detailedSheet.getCell(5, 1).value = "Product";
      detailedSheet.getCell(5, 2).value = "VariantName";

      let dRowNum = 6;
      productsSorted.forEach((product) => {
        const productRows = groups.get(product);
        const variantSet = new Set();
        productRows.forEach((row) => {
          const v = row[variantColIdx];
          variantSet.add(v === undefined || v === null || v === "" ? "(blank)" : String(v));
        });
        const variantsSorted = Array.from(variantSet).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );

        variantsSorted.forEach((variant, i) => {
          const r = detailedSheet.getRow(dRowNum);
          if (i === 0) r.getCell(1).value = product;
          r.getCell(2).value = variant;
          const variantCriteria = variant === "(blank)" ? '""' : criteriaStr(variant);

          leavesValues.forEach((v) => {
            const c = dLeavesColStart[v];
            r.getCell(c).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)], [VARIANT_COL, variantCriteria], [LEAVES_COL, v]]) };
            r.getCell(c + 1).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)], [VARIANT_COL, variantCriteria], [LEAVES_COL, v]]) };
          });
          if (dBlankLeavesCol) {
            r.getCell(dBlankLeavesCol).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)], [VARIANT_COL, variantCriteria], [LEAVES_COL, '""']]) };
            r.getCell(dBlankLeavesCol + 1).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)], [VARIANT_COL, variantCriteria], [LEAVES_COL, '""']]) };
          }
          r.getCell(dTotalBooksCol).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)], [VARIANT_COL, variantCriteria]]) };
          r.getCell(dTotalLvsCol).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)], [VARIANT_COL, variantCriteria]]) };
          dRowNum++;
        });

        const subtotal = detailedSheet.getRow(dRowNum);
        subtotal.getCell(1).value = `${product} Total`;
        leavesValues.forEach((v) => {
          const c = dLeavesColStart[v];
          subtotal.getCell(c).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, v]]) };
          subtotal.getCell(c + 1).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, v]]) };
        });
        if (dBlankLeavesCol) {
          subtotal.getCell(dBlankLeavesCol).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, '""']]) };
          subtotal.getCell(dBlankLeavesCol + 1).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)], [LEAVES_COL, '""']]) };
        }
        subtotal.getCell(dTotalBooksCol).value = { formula: sumifs(BOOKS_COL, [[PRODUCT_COL, criteriaStr(product)]]) };
        subtotal.getCell(dTotalLvsCol).value = { formula: sumifs(LVS_COL, [[PRODUCT_COL, criteriaStr(product)]]) };
        subtotal.font = { bold: true };
        dRowNum++;
      });

      const detailedGrandTotal = detailedSheet.getRow(dRowNum);
      detailedGrandTotal.getCell(1).value = "Grand Total";
      leavesValues.forEach((v) => {
        const c = dLeavesColStart[v];
        detailedGrandTotal.getCell(c).value = { formula: sumifs(BOOKS_COL, [[LEAVES_COL, v]]) };
        detailedGrandTotal.getCell(c + 1).value = { formula: sumifs(LVS_COL, [[LEAVES_COL, v]]) };
      });
      if (dBlankLeavesCol) {
        detailedGrandTotal.getCell(dBlankLeavesCol).value = { formula: sumifs(BOOKS_COL, [[LEAVES_COL, '""']]) };
        detailedGrandTotal.getCell(dBlankLeavesCol + 1).value = { formula: sumifs(LVS_COL, [[LEAVES_COL, '""']]) };
      }
      detailedGrandTotal.getCell(dTotalBooksCol).value = { formula: `SUM(${ref(BOOKS_COL)})` };
      detailedGrandTotal.getCell(dTotalLvsCol).value = { formula: `SUM(${ref(LVS_COL)})` };
      detailedGrandTotal.font = { bold: true };

      [3, 4, 5].forEach((rn) => (detailedSheet.getRow(rn).font = { bold: true }));
    } else if (isKarnatakaBank) {
      // ---------- Karnataka Bank: MIS + WK Legal Account book count ----------
      const wonoColIdx = findCol("WONO");
      const accountTypeColIdx = findCol("AccountType");
      const leavesColIdx = findCol("NumberOfLeavesPerbook");
      const booksColIdx = findCol("NumberOfBooks");
      const productColIdx = findCol("Product");
      const fileNameColIdx = findCol("MasterFileName");
      const loadDateColIdx = findCol("LoadDate");

      if (
        [wonoColIdx, accountTypeColIdx, leavesColIdx, booksColIdx, productColIdx, fileNameColIdx, loadDateColIdx].some(
          (i) => i === -1
        )
      ) {
        return res.status(400).json({
          message:
            "Could not find WONO / AccountType / NumberOfLeavesPerbook / NumberOfBooks / Product / MasterFileName / LoadDate columns needed for the Karnataka Bank report.",
        });
      }

      const LEAVES_COL = colLetter(leavesColIdx);
      const BOOKS_COL = colLetter(booksColIdx);
      const ACCOUNT_TYPE_COL = colLetter(accountTypeColIdx);
      const bodyRows = rows.slice(1);

      // ---- WK Legal Account book count: pivot of NumberOfBooks by leaves x AccountType ----
      const leavesSet = new Set();
      const accountTypesSet = new Set();
      bodyRows.forEach((row) => {
        if (row[leavesColIdx] !== undefined && row[leavesColIdx] !== "") leavesSet.add(Number(row[leavesColIdx]));
        if (row[accountTypeColIdx] !== undefined && row[accountTypeColIdx] !== "")
          accountTypesSet.add(String(row[accountTypeColIdx]));
      });
      const leavesValues = Array.from(leavesSet).sort((a, b) => a - b);
      const accountTypesSorted = Array.from(accountTypesSet).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );

      const wkSheet = workbook.addWorksheet("WK Legal Account book count");
      wkSheet.getCell("A2").value = "Sum of NumberOfBooks";
      wkSheet.getCell("B2").value = "Column Labels";
      wkSheet.getCell("A3").value = "Row Labels";
      accountTypesSorted.forEach((type, i) => (wkSheet.getCell(3, 2 + i).value = type));
      const grandTotalCol = 2 + accountTypesSorted.length;
      wkSheet.getCell(3, grandTotalCol).value = "Grand Total";

      leavesValues.forEach((leaves, i) => {
        const r = 4 + i;
        wkSheet.getCell(r, 1).value = leaves;
        accountTypesSorted.forEach((type, j) => {
          wkSheet.getCell(r, 2 + j).value = {
            formula: sumifs(BOOKS_COL, [[LEAVES_COL, leaves], [ACCOUNT_TYPE_COL, criteriaStr(type)]]),
          };
        });
        const rowCells = accountTypesSorted.map((_, j) => `${colLetter(1 + j)}${r}`).join("+");
        wkSheet.getCell(r, grandTotalCol).value = { formula: rowCells };
      });

      const totalRow = 4 + leavesValues.length;
      wkSheet.getCell(totalRow, 1).value = "Grand Total";
      accountTypesSorted.forEach((_, j) => {
        const col = colLetter(1 + j);
        wkSheet.getCell(totalRow, 2 + j).value = { formula: `SUM(${col}4:${col}${totalRow - 1})` };
      });
      const gtCol = colLetter(grandTotalCol - 1);
      wkSheet.getCell(totalRow, grandTotalCol).value = { formula: `SUM(${gtCol}4:${gtCol}${totalRow - 1})` };
      [2, 3].forEach((rn) => (wkSheet.getRow(rn).font = { bold: true }));
      wkSheet.getRow(totalRow).font = { bold: true };

      // ---- MIS: one row per WONO/MasterFileName, books split into 10/25/50/100 buckets ----
      const misSheet = workbook.addWorksheet("MIS");
      misSheet.getRow(1).values = [
        "ORDER DATE", "WEEK", "FILE NAME", "PO NO", "WO NO",
        "BOOK(10)", "LEAVES(10)", "BOOKS(25)", "LEAVES(25)",
        "BOOKS(50)", "LEAVES(50)", "BOOKS(100)", "LEAVES(100)",
        "TOTAL BOOKS", "TOTAL LEAVES", "Location",
        "Product type (ie. Perso/Non Perso/new branch/legal account/welcome kit/special order) ",
      ];
      misSheet.getRow(1).font = { bold: true };
      for (let c = 1; c <= 17; c++) misSheet.getColumn(c).width = 20;

      const weekLabels = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth"];
      const weekOf = (date) => {
        if (!(date instanceof Date)) return "";
        const firstOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        const firstSunday = new Date(firstOfMonth);
        firstSunday.setUTCDate(1 - firstOfMonth.getUTCDay());
        const weekIndex = Math.floor((date - firstSunday) / (7 * 24 * 60 * 60 * 1000));
        return weekLabels[weekIndex] || `Week ${weekIndex + 1}`;
      };

      const groupsByWono = new Map();
      bodyRows.forEach((row) => {
        const key = `${row[wonoColIdx]}||${row[fileNameColIdx]}`;
        if (!groupsByWono.has(key)) groupsByWono.set(key, []);
        groupsByWono.get(key).push(row);
      });

      const groups = Array.from(groupsByWono.values()).sort((a, b) => {
        const da = a[0][loadDateColIdx] instanceof Date ? a[0][loadDateColIdx] : new Date(0);
        const db = b[0][loadDateColIdx] instanceof Date ? b[0][loadDateColIdx] : new Date(0);
        return da - db;
      });

      let misRowNum = 2;
      groups.forEach((groupRows) => {
        const first = groupRows[0];
        const orderDate = first[loadDateColIdx] instanceof Date ? first[loadDateColIdx] : null;
        const product = String(first[productColIdx] || "");
        // Assumption: any Product containing "Legal" is a legal-account welcome kit;
        // adjust this mapping if Karnataka Bank sends other product categories.
        const productType = /legal/i.test(product) ? "Welcome Kits (Legal Accounts)" : "Welcome Kit";

        const booksByLeaves = { 10: 0, 25: 0, 50: 0, 100: 0 };
        groupRows.forEach((row) => {
          const leaves = Number(row[leavesColIdx]);
          if (booksByLeaves[leaves] !== undefined) booksByLeaves[leaves] += Number(row[booksColIdx]) || 0;
        });

        const r = misSheet.getRow(misRowNum);
        r.getCell(1).value = orderDate;
        if (orderDate) r.getCell(1).numFmt = "dd-mm-yyyy";
        r.getCell(2).value = weekOf(orderDate);
        r.getCell(3).value = first[fileNameColIdx];
        r.getCell(4).value = "NA";
        r.getCell(5).value = first[wonoColIdx];
        r.getCell(6).value = booksByLeaves[10];
        r.getCell(7).value = { formula: `F${misRowNum}*10` };
        r.getCell(8).value = booksByLeaves[25];
        r.getCell(9).value = { formula: `H${misRowNum}*25` };
        r.getCell(10).value = booksByLeaves[50];
        r.getCell(11).value = { formula: `J${misRowNum}*50` };
        r.getCell(12).value = booksByLeaves[100];
        r.getCell(13).value = { formula: `L${misRowNum}*100` };
        r.getCell(14).value = { formula: `F${misRowNum}+H${misRowNum}+J${misRowNum}+L${misRowNum}` };
        r.getCell(15).value = { formula: `G${misRowNum}+I${misRowNum}+K${misRowNum}+M${misRowNum}` };
        r.getCell(16).value = "Manipal";
        r.getCell(17).value = productType;
        misRowNum++;
      });
    } else {
      // ---------- Existing UBI Manipal/Kolkata logic — unchanged ----------
      // Remove previously generated sheets if the same file is re-uploaded/regenerated
      ["Manipal count", "Kolkata count"].forEach((name) => {
        const existing = workbook.getWorksheet(name);
        if (existing) workbook.removeWorksheet(existing.id);
      });

      const PROD_KIT = `"Personalized Welcome Kit - ILM"`;
      const PROD_LETTERS = `"Personalized Welcome Kit Letters - ILM"`;
      const PROD_USSA = `"Regular - USSA"`;
      const PROD_TIER = `"Tier Products"`;
      const LOC_M = `"MANIPAL"`;
      const LOC_K = `"KOLKATA"`;
      const PROD_LOCKER = `"Locker Overdue Notices"`;
      const PROD_BBCII = `"Non personalised-BBCII"`;
      const PROD_SBCA = `"Non personalised- SB/CA"`;

      // ---------- Manipal count ----------
      const manipal = workbook.addWorksheet("Manipal count");
      manipal.columns = [
        { header: "Item", key: "item", width: 40 },
        { header: "Count ", key: "count", width: 14 },
        { header: "", key: "desc", width: 55 },
      ];

      const mRows = [
        ["Regular cheque books SB 10lvs", sumifs("F", [["H", PROD_KIT], ["D", `"SB"`], ["E", 10], ["L", LOC_M]]), "Bks"],
        ["Regular cheque books SB 20lvs", sumifs("F", [["H", PROD_KIT], ["D", `"SB"`], ["E", 20], ["L", LOC_M]]), "Bks"],
        ["Regular cheque books SB 25lvs", sumifs("F", [["H", PROD_KIT], ["D", `"SB"`], ["E", 25], ["L", LOC_M]]), "Bks"],
        ["Regular cheque books SB 50lvs", sumifs("F", [["H", PROD_KIT], ["D", `"SB"`], ["E", 50], ["L", LOC_M]]), ""],
        ["Regular cheque books CA 20 Lvs", sumifs("F", [["H", PROD_KIT], ["D", `"CA"`], ["E", 20], ["L", LOC_M]]), "Bks"],
        ["Regular cheque books CA 50 lvs", sumifs("F", [["H", PROD_KIT], ["D", `"CA"`], ["E", 50], ["L", LOC_M]]), "Bks"],
        ["USSA cheque books SB", sumifs("F", [["H", PROD_USSA], ["D", `"SB"`], ["L", LOC_M]]), "Bks"],
        ["Tier Products cheque books SB 20LVS", sumifs("F", [["H", PROD_TIER], ["D", `"SB*"`], ["E", 20], ["L", LOC_M]]), "Bks"],
        ["Tier Products cheque books SB 25LVS", sumifs("F", [["H", PROD_TIER], ["D", `"SB*"`], ["E", 25], ["L", LOC_M]]), "Bks"],
      ];
      mRows.forEach((r) => manipal.addRow({ item: r[0], count: { formula: r[1] }, type: r[2], desc: r[3] }));

      manipal.addRow({ item: "Plastic Envelopes for Regular order", count: { formula: "SUM(B2:B7)" }, type: "Bks" });
      manipal.addRow({ item: "Plastic Envelopes for Tier Products", count: { formula: "SUM(B9:B10)" }, type: "Bks" });
      manipal.addRow({ item: "Plastic Envelopes for USSA Products", count: { formula: "B8" }, type: "Bks" });
      manipal.addRow({ item: "Paper Envelopes", count: { formula: sumifs("F", [["H", PROD_LETTERS], ["L", LOC_M]]) }, type: "Only Thanks Letters" });
      manipal.addRow({
        item: "Thanks letter ",
        count: { formula: `B14+${sumifs("F", [["H", PROD_KIT], ["J", `"WL"`], ["L", LOC_M]])}` },
        type: "Thanks letter and Cheque +Letters",
      });

      manipal.addRow({
        item: "Insertion cost",
        count: { formula: "B15" },
        type: "Letters",
      });

      const qrLvsFormula = `${sumifs("G", [["H", PROD_TIER], ["L", LOC_M]])}+${sumifs("G", [["H", PROD_KIT], ["L", LOC_M]])}+${sumifs("G", [["H", PROD_USSA], ["L", LOC_M]])}`;

      manipal.addRow({ item: "QR code printing", count: { formula: qrLvsFormula }, type: "Lvs" });
      manipal.addRow({ item: "Reverse printing of Account number", count: { formula: "B17" }, type: "Lvs" });
      manipal.addRow({ item: "Printing account number around UBI logo", count: { formula: "B17" }, type: "Lvs" });

      manipal.addRow({
        item: "LOCKER OVERDUE NOTICES",
        count: { formula: sumifs("F", [["H", PROD_LOCKER], ["L", LOC_M]]) },
        type: "Letters",
      });
      manipal.addRow({ item: "LOCKER OVERDUE NOTICES ENVELOPES", count: { formula: "B20" }, type: "Letters" });
      manipal.addRow({ item: "LOCKER OVERDUE NOTICES Insertion cost", count: { formula: "B20" }, type: "Letters" });

      manipal.addRow({});

      manipal.addRow({
        item: "BBC CHQ 100 LVS",
        count: { formula: sumifs("F", [["H", PROD_BBCII], ["E", 100], ["L", LOC_M]]) },
        type: "bks",
      });
      manipal.addRow({
        item: "Special order 5LVS SB",
        count: { formula: sumifs("F", [["H", PROD_SBCA], ["D", `"SB"`], ["E", 5], ["L", LOC_M]]) },
        type: "bks",
      });
      manipal.addRow({
        item: "Special order 10LVS CA",
        count: { formula: sumifs("F", [["H", PROD_SBCA], ["D", `"CA"`], ["E", 10], ["L", LOC_M]]) },
        type: "bks",
      });

      // ---------- Kolkata count ----------
      const kolkata = workbook.addWorksheet("Kolkata count");
      kolkata.columns = [
        { header: "Item", key: "item", width: 40 },
        { header: "Count ", key: "count", width: 14 },
      ];

      const kRows = [
        ["Regular cheque books SB 10lvs", sumifs("F", [["D", `"SB"`], ["E", 10], ["L", LOC_K]]), "Bks"],
        ["Regular cheque books SB 20lvs", sumifs("F", [["D", `"SB"`], ["E", 20], ["L", LOC_K]]), "Bks"],
        ["Regular cheque books SB 25lvs", sumifs("F", [["D", `"SB"`], ["E", 25], ["L", LOC_K]]), ""],
        ["Regular cheque books CA 20 Lvs", sumifs("F", [["D", `"CA"`], ["E", 20], ["L", LOC_K]]), "Bks"],
        ["Regular cheque books CA 50 lvs", sumifs("F", [["D", `"CA"`], ["E", 50], ["L", LOC_K]]), "Bks"],
      ];
      kRows.forEach((r) => kolkata.addRow({ item: r[0], count: { formula: r[1] }, type: r[2] }));

      kolkata.addRow({ item: "Plastic Envelopes for Regular order", count: { formula: "SUM(B2:B6)" }, type: "Bks" });
      kolkata.addRow({ item: "Paper Envelopes", count: { formula: sumifs("F", [["H", PROD_LETTERS], ["L", LOC_K]]) }, type: "Only Thanks Letters" });
      kolkata.addRow({
        item: "Thanks letter ",
        count: { formula: `B8+${sumifs("F", [["H", PROD_KIT], ["J", `"WL"`], ["L", LOC_K]])}` },
        type: "Thanks letter and Cheque +Letters",
      });
      kolkata.addRow({ item: "Insertion cost ", count: { formula: "B9" }, type: "Letters" });
      kolkata.addRow({ item: "QR code printing", count: { formula: sumifs("G", [["L", LOC_K]]) }, type: "Lvs" });
      kolkata.addRow({ item: "Reverse printing of Account number ", count: { formula: "B11" }, type: "Lvs" });
      kolkata.addRow({ item: "Printing account number around UBI logo ", count: { formula: "B11" }, type: "Lvs" });

      [manipal, kolkata].forEach((ws) => (ws.getRow(1).font = { bold: true }));
    }

    const buffer = await workbook.xlsx.writeBuffer();

    // ---------- Persist to disk + DB with a unique report number ----------
    const reportNumber = await getNextReportNumber();

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const generatedFileName = `${sanitizeForFilename(customerName)}_${reportNumber}.xlsx`;
    const absoluteFilePath = path.join(UPLOADS_DIR, generatedFileName);
    fs.writeFileSync(absoluteFilePath, buffer);

    const reportDoc = await BillingReport.create({
      reportNumber,
      customerName,
      originalFileName: req.file.originalname,
      generatedFileName,
      filePath: path.join("uploads", "billing-reports", generatedFileName),
      generatedBy: req.user?._id, // relies on `protect` middleware setting req.user
      generatedByName: req.user?.name || "",
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${generatedFileName}"`);
    // Custom headers so the frontend can read the new report number/id/filename off the blob response.
    // NOTE: also add these to Access-Control-Expose-Headers in your global CORS
    // config (server.js) or the browser will hide these headers from JS.
    res.setHeader("X-Report-Number", reportNumber);
    res.setHeader("X-Report-Id", reportDoc._id.toString());
    res.setHeader("X-Generated-File-Name", generatedFileName);
    res.setHeader("Access-Control-Expose-Headers", "X-Report-Number, X-Report-Id, X-Generated-File-Name, Content-Disposition");
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Billing report generation failed:", err);
    res.status(500).json({ message: "Failed to generate report", error: err.message });
  }
});

// List generated reports, optionally filtered by customer.
// GET /api/billing-report/list?customer=Some+Customer
router.get("/list", protect, async (req, res) => {
  try {
    const { customer } = req.query;
    const filter = {};
    if (customer && customer !== "All") filter.customerName = customer;

    const reports = await BillingReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .select("reportNumber customerName generatedFileName originalFileName createdAt generatedByName");

    res.json(reports);
  } catch (err) {
    console.error("Failed to list billing reports:", err);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
});

// Download/view a previously generated report by its DB id.
// GET /api/billing-report/:id/download
router.get("/:id/download", protect, async (req, res) => {
  try {
    const report = await BillingReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (normalizeText(report.customerName).toUpperCase() === "CANARA BANK") {
      const files = [
        {
          label: "Billing MIS",
          fileName: `Billing_MIS_Canara_Bank_Perso_Cheques_${report.reportNumber}.xlsx`,
        },
        {
          label: "MIS",
          fileName: `MIS_Canara_Bank_Perso_Cheque_${report.reportNumber}.xlsx`,
        },
      ];

      const missingFile = files.find((file) => {
        const absolutePath = path.join(UPLOADS_DIR, file.fileName);
        return !fs.existsSync(absolutePath);
      });

      if (missingFile) {
        return res.status(404).json({
          message: `Report file is missing on the server: ${missingFile.fileName}`,
        });
      }

      return res.json({
        reportNumber: report.reportNumber,
        files: files.map((file) => {
          const absolutePath = path.join(UPLOADS_DIR, file.fileName);
          return {
            ...file,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            base64: fs.readFileSync(absolutePath).toString("base64"),
          };
        }),
      });
    }

    const absolutePath = path.join(__dirname, "..", report.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: "Report file is missing on the server" });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${report.generatedFileName}"`);
    res.sendFile(absolutePath);
  } catch (err) {
    console.error("Failed to download billing report:", err);
    res.status(500).json({ message: "Failed to download report" });
  }
});

// Delete a previously generated report — only the user who generated it can delete it.
// DELETE /api/billing-report/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const report = await BillingReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    if (report.generatedByName !== req.user?.name) {
      return res.status(403).json({ message: "You can only delete reports you generated" });
    }

    if (normalizeText(report.customerName).toUpperCase() === "CANARA BANK") {
      [
        `Billing_MIS_Canara_Bank_Perso_Cheques_${report.reportNumber}.xlsx`,
        `MIS_Canara_Bank_Perso_Cheque_${report.reportNumber}.xlsx`,
      ].forEach((fileName) => {
        const absolutePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
      });
    } else {
      const absolutePath = path.join(__dirname, "..", report.filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }

    await report.deleteOne();
    res.json({ message: "Report deleted" });
  } catch (err) {
    console.error("Failed to delete billing report:", err);
    res.status(500).json({ message: "Failed to delete report" });
  }
});

module.exports = router;