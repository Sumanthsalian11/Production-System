const express = require("express");
const router = express.Router();
const InspectionReport = require("../models/InspectionReport");
const InspectionDetail = require("../models/InspectionDetail");

// getConsolidatedData equivalent
router.get("/consolidated", async (req, res) => {
  try {
    const records = await InspectionReport.find().sort({ createdAt: 1 });
    let approved = 0, rejected = 0;
    const formatted = records.map((r) => {
      const status = (r.lotStatus || "").toString().trim();
      if (status.includes("LA")) approved++;
      if (status.includes("LR")) rejected++;
      return {
        slNo: r.slNo,
        itemCode: r.itemCode,
        testedDate: r.testedDate,
        rirNo: r.rirNo,
        supplierName: r.supplierName || "Unspecified",
        materialDesc: r.materialDesc,
        invoiceDetails: r.invoiceDetails,
        recDate: r.recDate,
        receivedQty: r.receivedQty,
        poNo: r.poNo,
        girNo: r.girNo,
        lotStatus: status,
        qcRemarks: r.qcRemarks,
        materialType: r.materialType || "General",
        location: r.location || "Manipal HO",
        itemPdfPath: r.itemPdfPath || "",
      };
    });
    res.json({
      records: formatted,
      stats: { total: formatted.length, approved, rejected },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// getFullReportByRIR equivalent
router.get("/full-report/:rirNo", async (req, res) => {
  try {
    const rirNo = req.params.rirNo.toString().trim();
    const summaryDoc = await InspectionReport.findOne({ rirNo });
    const summary = summaryDoc
      ? {
          slNo: summaryDoc.slNo,
          itemCode: summaryDoc.itemCode,
          testedDate: summaryDoc.testedDate,
          rirNo: summaryDoc.rirNo,
          supplierName: summaryDoc.supplierName,
          materialDesc: summaryDoc.materialDesc,
          invoiceDetails: summaryDoc.invoiceDetails,
          recDate: summaryDoc.recDate,
          receivedQty: summaryDoc.receivedQty,
          poNo: summaryDoc.poNo,
          girNo: summaryDoc.girNo,
          lotStatus: summaryDoc.lotStatus,
          qcRemarks: summaryDoc.qcRemarks,
          materialType: summaryDoc.materialType,
          location: summaryDoc.location,
          itemPdfPath: summaryDoc.itemPdfPath || "",
        }
      : null;

    const detailDocs = await InspectionDetail.find({ rirNo });
    const items = detailDocs.map((d) => ({
      slNo: d.slNo,
      parameter: d.parameter,
      specification: d.specification,
      tolLimit: d.tolLimit,
      uom: d.uom,
      readings: d.readings,
      remarks: d.remarks,
      acceptanceCriteria: d.acceptanceCriteria,
      defectCriteria: d.defectCriteria,
      qcDoneBy: d.qcDoneBy,
      checkedBy: d.checkedBy,
    }));

    res.json({ summary, items });
  } catch (err) {
    res.json({ summary: null, items: [] });
  }
});

// submitIQCReport equivalent
router.post("/submit", async (req, res) => {
  try {
    const { meta, footer, items } = req.body;

    const lastRecord = await InspectionReport.findOne().sort({ slNo: -1 });
    const slNo = lastRecord ? lastRecord.slNo + 1 : 1;

    await InspectionReport.create({
      slNo,
      itemCode: meta.itemCode || "-",
      testedDate: meta.testedDate || "-",
      rirNo: meta.rrNo || "-",
      supplierName: meta.supplier || "-",
      materialDesc: meta.itemDescDetails || "-",
      invoiceDetails: meta.invoiceDetails || "-",
      recDate: meta.receivedDate || "-",
      receivedQty: meta.receivedQty || "-",
      poNo: meta.poNo || "-",
      girNo: meta.girNo || "-",
      lotStatus: footer.acceptanceCriteria || "-",
      qcRemarks: footer.comments || "-",
      materialType: meta.materialName || "-",
      location: meta.location || "Manipal HO",
      itemPdfPath: meta.itemPdfPath || "",
    });

    if (items && items.length > 0) {
      const detailDocs = items.map((item) => ({
        slNo,
        rirNo: meta.rrNo || "-",
        testedDate: meta.testedDate || "-",
        itemCode: meta.itemCode || "-",
        materialName: meta.materialName || "-",
        supplierName: meta.supplier || "-",
        parameter: item.parameter || "-",
        specification: item.specification || "-",
        tolLimit: item.tolLimit || "-",
        uom: item.uom || "-",
        readings: (item.readings || []).join(", "),
        remarks: item.remarks || "-",
        acceptanceCriteria: footer.acceptanceCriteria || "-",
        defectCriteria: footer.defectCriteria || "-",
        qcDoneBy: footer.qcDoneBy || "-",
        checkedBy: footer.checkedBy || "-",
      }));
      await InspectionDetail.insertMany(detailDocs);
    }

    res.json({ success: true, message: `Inspection Report successfully logged under Sl. No. ${slNo}` });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error saving report: " + error.toString() });
  }
});

module.exports = router;