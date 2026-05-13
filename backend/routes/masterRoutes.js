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