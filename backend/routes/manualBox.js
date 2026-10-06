const express = require("express");
const router = express.Router();
const PODetailRecord = require("../models/PODetailRecord");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const multer = require("multer");
const XLSX = require("xlsx");
const ManualBox = require("../models/ManualBox");

const upload = multer({
  dest: "uploads/",
});

// ========================================
// SAVE DATA
// ========================================

router.post("/save", async (req, res) => {
  try {
    const {
      poNumber,
      dispatchLocation,
      fromNo,
      toNumber,
      qtyInBox,
      boxNumber,
    } = req.body;

    if (
      !poNumber ||
      !dispatchLocation ||
      fromNo === undefined ||
      toNumber === undefined ||
      !qtyInBox ||
      !boxNumber
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });
    }

    const qrText = `${poNumber}#${fromNo}#${toNumber}`;

    const savedData = await ManualBox.create({
      poNumber,
      dispatchLocation,
      fromNo,
      toNumber,
      qtyInBox,
      boxNumber,
      qrText,
    });

    res.status(201).json({
      success: true,
      message: "Data saved successfully",
      data: savedData,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Save failed",
    });
  }
});

// ========================================
// GET ALL DATA
// ========================================

router.get("/all", async (req, res) => {
  try {
    const data = await ManualBox.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Fetch failed",
    });
  }
});

// ========================================
// EXCEL UPLOAD
// ========================================

router.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file required",
      });
    }

    const enteredBy = req.body.enteredBy || "";
    const userLocations = req.body.userLocations
      ? JSON.parse(req.body.userLocations)
      : [];

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
      });
    }

    const ALLOWED_COLUMNS = [
      "Sl.no.",
      "Delivery Date",
      "Delivery Address",
      "GSTN No",
      "PO NO.:",
      "PO Date :",
      "Quantity",
      "Article No. HSN Code",
      "EAN No. Vendor Article No. Vendor Item No",
      "Material Description Delivery Date Site",
      "Each Box Qty",
      "Qty",
    ];

    const REQUIRED_COLUMNS = [
      "PO NO.:",
      "Quantity",
      "Each Box Qty",
      "Qty",
    ];

    const normalize = (str) =>
      str.replace(/\r\n|\r|\n/g, " ").trim();

    const actualColumns = Object.keys(data[0]).map(normalize);

    const invalidColumns = actualColumns.filter(
      (col) => !ALLOWED_COLUMNS.some((allowed) => allowed === col)
    );

    if (invalidColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Excel format. Please use the correct EXCEL template.",
      });
    }

    const missingColumns = REQUIRED_COLUMNS.filter(
      (req) => !actualColumns.some((col) => col === req)
    );

    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Excel format. Please use the correct EXCEL template.",
      });
    }

    const formattedData = data.map((row) => {
      const keys = Object.keys(row);

      const findKey = (text) =>
        keys.find((k) => k.toLowerCase().includes(text.toLowerCase()));

      const materialKey = keys.find((k) =>
        k.replace(/\s+/g, " ").toLowerCase().includes("material description")
      );

      const qtyKey = keys.find((k) => k.trim().toLowerCase() === "qty");

      return {
        deliveryDate: row[findKey("delivery date")] || "",
        deliveryAddress: row[findKey("delivery address")] || "",
        gstinNo: row[findKey("gstn")] || "",
        ponumber: row[findKey("po no")] || "",
        poDate: row[findKey("po date")] || "",
        quantity: Number(row[findKey("quantity")]) || 0,
        articleNo: row[findKey("article")] || "",
        eanNo: row[findKey("ean")] || "",
        materialDescription: materialKey ? row[materialKey] : "",
        eachBoxQty: Number(row[findKey("each box")]) || 0,
        qty: Number(qtyKey ? row[qtyKey] : 0) || 0,
        enteredBy,
        userLocations,
      };
    });

    const poNumbersInFile = formattedData.map((r) => r.ponumber).filter(Boolean);

    const duplicatesWithinFile = poNumbersInFile.filter(
      (po, index) => poNumbersInFile.indexOf(po) !== index
    );

    if (duplicatesWithinFile.length > 0) {
      const unique = [...new Set(duplicatesWithinFile)];
      return res.status(400).json({
        success: false,
        message: `Duplicate PO Number(s) found within the uploaded file: ${unique.join(", ")}`,
      });
    }

    const existingRecords = await ManualBox.find({
      ponumber: { $in: poNumbersInFile },
    }).select("ponumber");

    if (existingRecords.length > 0) {
      return res.status(400).json({
        success: false,
        message: `PO Number(s) already exist in the database`,
      });
    }

    await ManualBox.insertMany(formattedData);

    res.status(200).json({
      success: true,
      message: "Excel uploaded successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Excel upload failed",
    });
  }
});

// ========================================
// FETCH BY PO NUMBER
// ========================================

router.get("/by-po/:ponumber", async (req, res) => {
  try {
    const data = await ManualBox.findOne({
      ponumber: req.params.ponumber,
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "No record found for this PO number",
      });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Fetch failed" });
  }
});

// ========================================
// GET SAVED PO DETAIL RECORDS BY PO NUMBER
// ========================================

router.get("/saved-records/:ponumber", async (req, res) => {
  try {
    const records = await PODetailRecord.find({
      ponumber: req.params.ponumber,
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Fetch failed" });
  }
});

// ========================================
// SAVE PO DETAIL RECORD
// ========================================

router.post("/save-po-details", async (req, res) => {
  try {
    const {
      sourceId,
      ponumber,
      eachBoxQty,
      qty,
      totalQty,
      remainingQty,
      enteredBy,
      userLocations,
    } = req.body;

    if (!ponumber || eachBoxQty === undefined || qty === undefined) {
      return res.status(400).json({
        success: false,
        message: "ponumber, eachBoxQty, and qty are required",
      });
    }

    const record = await PODetailRecord.create({
      sourceId,
      ponumber,
      eachBoxQty,
      qty,
      totalQty,
      remainingQty,
      enteredBy,
      userLocations,
    });

    res.status(201).json({
      success: true,
      message: "Record saved successfully",
      data: record,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Save failed" });
  }
});

// ========================================
// UPDATE PO DETAIL RECORD
// ========================================

router.put("/update-po-details/:id", async (req, res) => {
  try {
    const { eachBoxQty, qty, totalQty, remainingQty } = req.body;

    const updated = await PODetailRecord.findByIdAndUpdate(
      req.params.id,
      {
        eachBoxQty,
        qty,
        totalQty,
        remainingQty,
      },
      {
        returnDocument: "after",
      }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Record updated successfully",
      data: updated,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Update failed",
    });
  }
});

// ========================================
// DELETE PO DETAIL RECORD
// ========================================

router.delete("/delete-po-details/:id", async (req, res) => {
  try {
    const deleted = await PODetailRecord.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Record deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
});

// ========================================
// PO DETAILS PDF
// ========================================

router.get("/po-details-pdf/:id", async (req, res) => {
  try {
    const record = await PODetailRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    let source = null;

    if (record.sourceId) {
      source = await ManualBox.findById(record.sourceId);
    }

    if (!source && record.ponumber) {
      source = await ManualBox.findOne({
        $or: [
          { ponumber: record.ponumber },
          { poNumber: record.ponumber },
        ],
      });
    }

    const poNumber =
      source?.ponumber ||
      source?.poNumber ||
      record.ponumber ||
      "";

    const poDate =
      source?.poDate ||
      record.poDate ||
      "";

    const deliveryAddress = String(
      source?.deliveryAddress ||
      source?.dispatchLocation ||
      record.deliveryAddress ||
      ""
    )
      .replace(/[\r\n]+/g, "\n")
      .replace(/Ð/g, "")
      .replace(/�/g, "")
      .trim();
const materialDescription = String(
  source?.materialDescription ||
  record.materialDescription ||
  ""
).trim();

const siteCode = materialDescription
  ? materialDescription.split(/\s+/).pop()
  : "";
    const eachBoxQty = Number(record.eachBoxQty || 1);
    const totalBoxes = Number(record.qty || 0);

    const poRecords = await PODetailRecord.find({
      ponumber: record.ponumber,
    })
      .sort({ createdAt: 1, _id: 1 })
      .select("_id qty");

    let previousBoxCount = 0;

    for (const poRecord of poRecords) {
      if (poRecord._id.toString() === record._id.toString()) {
        break;
      }

      previousBoxCount += Number(poRecord.qty || 0);
    }

    const W = 320;
    const H = 360;

    const doc = new PDFDocument({
      margin: 0,
      size: [W, H],
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=PO-${poNumber}-labels.pdf`
    );

    doc.pipe(res);

    for (let i = 0; i < totalBoxes; i++) {
      if (i !== 0) doc.addPage();

      const currentBox = i + 1;
      const runningSerialNo = previousBoxCount + currentBox;

      const qrData = `${poNumber}#${record.remainingQty}#${currentBox}/${totalBoxes}`;
      const qrImage = await QRCode.toDataURL(qrData, {
        margin: 1,
        width: 120,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      const qrBuffer = Buffer.from(
        qrImage.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );

      doc.rect(0, 0, W, H).fill("#ffffff");

      doc
        .roundedRect(6, 6, W - 12, H - 12, 5)
        .lineWidth(2.2)
        .strokeColor("#000000")
        .stroke();

      doc
        .fillColor("#000000")
        .font("Times-Bold")
        .fontSize(11)
        .text("Manipal Payment And Identity Solutions Ltd", 14, 18, {
          width: 292,
          align: "center",
          lineBreak: false,
        });

      doc
        .moveTo(12, 42)
        .lineTo(W - 12, 42)
        .lineWidth(1)
        .strokeColor("#000000")
        .stroke();

      doc
        .fillColor("#000000")
        .font("Times-Bold")
        .fontSize(10)
        .text("Delivery Address:", 16, 55);

const addressLines = (deliveryAddress || "—").split("\n");
let addressY = 70;

addressLines.forEach((line) => {
  doc
    .font("Times-Bold")
    .fontSize(7.5)
    .text(line, 16, addressY, {
      width: 180,
      lineBreak: false,
    });

  addressY += 10;
});
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("PO Date:", 16, 198, {
          continued: true,
        })
        .font("Times-Roman")
        .fontSize(10)
        .text(` ${poDate || "—"}`);

      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("PO Number", 210, 55, {
          width: 92,
          align: "center",
        });

      doc
        .fontSize(13)
        .text(poNumber || "—", 204, 72, {
          width: 104,
          align: "center",
        });

      doc
        .fontSize(10)
        .text("Serial No", 210, 104, {
          width: 92,
          align: "center",
        });

      doc
        .fontSize(18)
        .text(String(runningSerialNo), 210, 120, {
          width: 92,
          align: "center",
        });

      doc
        .roundedRect(206, 150, 98, 58, 10)
        .lineWidth(2.5)
        .strokeColor("#000000")
        .stroke();

      doc
        .font("Times-Bold")
        .fontSize(28)
        .text(`${currentBox}/${totalBoxes}`, 206, 166, {
          width: 98,
          align: "center",
        });

      doc
        .moveTo(12, 230)
        .lineTo(W - 12, 230)
        .lineWidth(1)
        .strokeColor("#000000")
        .stroke();

      doc
        .font("Times-Bold")
        .fontSize(12)
        .text("Each Box Qty:", 16, 246, {
          continued: true,
        })
        .font("Times-Roman")
        .fontSize(12)
        .text(` ${eachBoxQty}`);

      doc
        .font("Times-Bold")
        .fontSize(12)
        .text("Total Boxes:", 16, 270, {
          continued: true,
        })
        .font("Times-Roman")
        .fontSize(12)
        .text(` ${totalBoxes}`);
      doc
  .font("Times-Bold")
  .fontSize(12)
  .text("Site Code:", 16, 294, {
    continued: true,
  })
  .font("Times-Roman")
  .fontSize(12)
  .text(` ${siteCode || "-"}`);
      doc.image(qrBuffer, 220, 250, {
        fit: [72, 72],
      });

      doc
        .moveTo(12, 334)
        .lineTo(W - 12, 334)
        .lineWidth(1)
        .strokeColor("#000000")
        .stroke();
    }

    doc.end();
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      message: "PDF generation failed",
    });
  }
});

module.exports = router;