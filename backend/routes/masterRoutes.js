const express = require("express");
const router = express.Router();

const Customer = require("../models/CustomerMaster");
const Item = require("../models/Item");
const Machine = require("../models/MachineMaster");
const Location = require("../models/LocationMaster");
const Priority = require("../models/Priority");
const TransportationMaster=require("../models/TransportationMaster")
const Material = require("../models/Material");
const FreightType = require("../models/FreightType");
const FreightChargeType = require("../models/FreightChargeType");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const xlsx = require("xlsx"); // npm install xlsx
const RmIqc = require("../models/RmIqc");
// reuse the same `upload` (multer memoryStorage) you already use for items bulk-upload / pdf

// GET all
router.get("/rm-iqc",  async (req, res) => {
  try {
    const data = await RmIqc.find().sort({ slNo: 1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch RM-IQC specs", error: err.message });
  }
});

// BULK UPLOAD (Excel)
router.post("/rm-iqc/bulk-upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const dataRows = rows.slice(1); // skip header row

    const groups = [];
    let currentGroup = null;

    for (const row of dataRows) {
      const [slNoRaw, descRaw, qualityParam, specification, uom, tolerance] = row;

      // a new Sl.No or Description value = start of a new material group (matches merged cells)
      const hasNewGroupStart =
        (slNoRaw !== null && slNoRaw !== undefined && slNoRaw !== "") ||
        (descRaw !== null && descRaw !== undefined && descRaw !== "");

      if (hasNewGroupStart) {
        currentGroup = {
          slNo: slNoRaw ?? null,
          description: descRaw ? String(descRaw).trim() : "",
          parameters: [],
        };
        groups.push(currentGroup);
      }

      if (!qualityParam || !currentGroup) continue;

      currentGroup.parameters.push({
        qualityParameter: String(qualityParam).trim(),
        specification: specification ? String(specification).trim() : "",
        uom: uom ? String(uom).trim() : "",
        tolerance: tolerance ? String(tolerance).trim() : "",
      });
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const group of groups) {
      try {
        const exists = await RmIqc.findOne({ description: group.description });
        if (exists) {
          skipped++;
          continue;
        }
        await RmIqc.create(group);
        inserted++;
      } catch (err) {
        errors.push({ row: group, message: err.message });
      }
    }

    res.json({ inserted, skipped, errors });
  } catch (err) {
    console.error("RM-IQC bulk upload error:", err);
    res.status(500).json({ message: "Bulk upload failed", error: err.message });
  }
});

// UPDATE
router.put("/rm-iqc/:id", async (req, res) => {
  try {
    const updated = await RmIqc.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
});

// DELETE
router.delete("/rm-iqc/:id", async (req, res) => {
  try {
    await RmIqc.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed", error: err.message });
  }
});

// CREATE CUSTOMER
router.post("/customer", async (req, res) => {
  const data = await Customer.create(req.body);
  res.json(data);
});

// GET CUSTOMERS
router.get("/customers", async (req, res) => {
  const data = await Customer.find();
  res.json(data);
});

// UPDATE CUSTOMER
router.put("/customer/:id", async (req, res) => {
  const data = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(data);
});

// DELETE CUSTOMER
router.delete("/customer/:id", async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ message: "Customer deleted" });
});

// CREATE ITEM
router.post("/item", async (req, res) => {
  const data = await Item.create(req.body);
  res.json(data);
});

// GET ITEMS
router.get("/items", async (req, res) => {
  const data = await Item.find();
  res.json(data);
});

// UPDATE ITEM
router.put("/item/:id", async (req, res) => {
  const data = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(data);
});

// DELETE ITEM
router.delete("/item/:id", async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ message: "Item deleted" });
});

// CREATE MACHINE
router.post("/machine", async (req, res) => {
  const data = await Machine.create(req.body);
  res.json(data);
});

// GET MACHINES
router.get("/machines", async (req, res) => {
  const data = await Machine.find();
  res.json(data);
});

// UPDATE MACHINE
router.put("/machine/:id", async (req, res) => {
  const data = await Machine.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(data);
});

// DELETE MACHINE
router.delete("/machine/:id", async (req, res) => {
  await Machine.findByIdAndDelete(req.params.id);
  res.json({ message: "Machine deleted" });
});

// CREATE LOCATION
router.post("/location", async (req, res) => {
  const data = await Location.create(req.body);
  res.json(data);
});

// GET LOCATIONS
router.get("/locations", async (req, res) => {
  const data = await Location.find();
  res.json(data);
});

// UPDATE LOCATION
router.put("/location/:id", async (req, res) => {
  const data = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(data);
});

// DELETE LOCATION
router.delete("/location/:id", async (req, res) => {
  await Location.findByIdAndDelete(req.params.id);
  res.json({ message: "Location deleted" });
});
// GET priorities
router.get("/priorities", async (req, res) => {
  const data = await Priority.find().sort("name");
  res.json(data);
});

// ADD priority
router.post("/priorities", async (req, res) => {
  if (!req.body.name) {
    return res.status(400).json({ message: "Priority name required" });
  }

  const priority = new Priority({ name: req.body.name });
  await priority.save();

  res.json(priority);
});
// UPDATE priority
router.put("/priorities/:id", async (req, res) => {
  try {
    const updated = await Priority.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating priority" });
  }
});

// DELETE priority
router.delete("/priorities/:id", async (req, res) => {
  try {
    await Priority.findByIdAndDelete(req.params.id);
    res.json({ message: "Priority deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting priority" });
  }
});

// GET TRANSPORTATIONS
router.get("/transportations", async (req, res) => {
  try {
    const data = await TransportationMaster.find({ status: true });
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching transportations" });
  }
});

// ADD TRANSPORTATION
router.post("/transportations", async (req, res) => {
  try {
    const newData = await TransportationMaster.create(req.body);
    res.json(newData);
  } catch (err) {
    res.status(500).json({ message: "Error adding transportation" });
  }
});

// UPDATE TRANSPORTATION
router.put("/transportations/:id", async (req, res) => {
  try {
    const updated = await TransportationMaster.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating transportation" });
  }
});

// DELETE TRANSPORTATION
router.delete("/transportations/:id", async (req, res) => {
  try {
    await TransportationMaster.findByIdAndDelete(req.params.id);
    res.json({ message: "Transportation deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting transportation" });
  }
});



// GET
// ✅ CORRECT
router.get("/freight-charge-types", async (req, res) => {
  const data = await FreightChargeType.find(); // remove filter
  res.json(data);
});

// POST
router.post("/freight-charge-types", async (req, res) => {
  const data = await FreightChargeType.create(req.body);
  res.json(data);
});

// PUT
router.put("/freight-charge-types/:id", async (req, res) => {
  const data = await FreightChargeType.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(data);
});

// DELETE
router.delete("/freight-charge-types/:id", async (req, res) => {
  await FreightChargeType.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});



// GET
// ✅ CORRECT
router.get("/freight-types", async (req, res) => {
  const data = await FreightType.find(); // remove filter
  res.json(data);
});

// POST
router.post("/freight-types", async (req, res) => {
  const data = await FreightType.create(req.body);
  res.json(data);
});

// PUT
router.put("/freight-types/:id", async (req, res) => {
  const data = await FreightType.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(data);
});

// DELETE
router.delete("/freight-types/:id", async (req, res) => {
  await FreightType.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});
// ✅ GET UNIQUE MILL NAMES
router.get("/materials/mills", async (req, res) => {
  try {
    const mills = await Material.distinct("mill");
    res.json(mills);
  } catch (err) {
    console.error("MILL FETCH ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;