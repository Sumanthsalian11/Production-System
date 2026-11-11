const WorkOrder = require("../models/WorkOrder");
const Dispatch = require("../models/Dispatch");
const CustomerOrder = require("../models/CustomerOrder");

// userLocations arrives as a JSON string when the form is sent as multipart
const parseLocations = (v) => {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

// 🔹 Fetch Work Order by WO Number
exports.getWorkOrderByNumber = async (req, res) => {
  try {

    const { woNumber } = req.params;

    const workOrder = await WorkOrder.findOne({
      efiWoNumber: woNumber
    });

    if (!workOrder) {
      return res.status(404).json({ message: "Work Order not found" });
    }

    // 🔹 Get all dispatch records for this WO
    const dispatches = await Dispatch.find({
      efiWoNumber: woNumber
    });

    // 🔹 Calculate total dispatched qty
    const dispatchedQty = dispatches.reduce(
      (sum, d) => sum + Number(d.dispatchQty || 0),
      0
    );

    const totalQty = Number(workOrder.qtyInLvs) || 0;

    const balanceQty = totalQty - dispatchedQty;

    res.json({
      ...workOrder.toObject(),
      dispatchedQty,
      balanceQty
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
// 🔹 Fetch Out Source / PMS order by Ticket No
exports.getOrderByTicketNo = async (req, res) => {
  try {
    const ticketNo = String(req.params.ticketNo || "").trim().toUpperCase();

    const order = await CustomerOrder.findOne({ ticketNo }).lean();
    if (!order) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!["Out Source", "PMS"].includes(order.orderType)) {
      return res.status(400).json({
        message: "Ticket fetch is only for Out Source and PMS orders"
      });
    }

    const dispatches = await Dispatch.find({ ticketNo });
    const dispatchedQty = dispatches.reduce(
      (sum, d) => sum + Number(d.dispatchQty || 0),
      0
    );
    const totalQty = Number(order.quantity) || 0;

    res.json({
      ticketNo: order.ticketNo,
      orderType: order.orderType,
      customer: order.customerName,
      productName: order.description,
      productType: order.materialType || "",
      totalQty,
      dispatchedQty,
      balanceQty: totalQty - dispatchedQty,
      purchaseOrderNo: order.purchaseOrderNo || "",
      poDate: order.poDate || "",
      expectedDeliveryDate: order.expectedDeliveryDate || ""
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔹 Create Dispatch
exports.createDispatch = async (req, res) => {
  try {

    const data = req.body;

    let delayDays = 0;
let delayLabel = "On Time";

if (data.dispatchDate && data.expectedDeliveryDate) {

const dispatch = new Date(data.dispatchDate);
const expected = new Date(data.expectedDeliveryDate);

const diffTime = dispatch - expected;

delayDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

if (delayDays > 0) {
delayLabel = delayDays + " days delay";
}
else if (delayDays < 0) {
delayLabel = Math.abs(delayDays) + " days early";
}
}
const dispatch = new Dispatch({
  ...data,
  delayDays,
  delayLabel,
  extraQty: data.extraQty,
  userLocations: parseLocations(data.userLocations),
  noOfPackets: Number(data.noOfPackets) || 0,
  noOfBoxes: Number(data.noOfBoxes) || 0,
  ...(req.file
    ? { attachment: `/uploads/dispatch/${req.file.filename}`, attachmentName: req.file.originalname }
    : {}) 
});

    await dispatch.save();

    res.status(201).json({
      message: "Dispatch Created Successfully",
      dispatch
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating dispatch" });
  }
};

// 🔹 Fetch All Dispatch Records
exports.getAllDispatches = async (req, res) => {
  try {
    const dispatches = await Dispatch.find().sort({ dispatchDate: -1 }); // latest first
    res.json(dispatches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching dispatch records" });
  }
};
// 🔹 Update Dispatch
exports.updateDispatch = async (req, res) => {
  try {

    const data = req.body;

    // 🔹 Get current dispatch (before update)
    const existingDispatch = await Dispatch.findById(req.params.id);

    if (!existingDispatch) {
      return res.status(404).json({ message: "Dispatch not found" });
    }

    let totalQty = 0;
    let sameJobFilter;

    if (existingDispatch.ticketNo) {
      const order = await CustomerOrder.findOne({ ticketNo: existingDispatch.ticketNo });
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      totalQty = Number(order.quantity) || 0;
      sameJobFilter = { ticketNo: existingDispatch.ticketNo };
    } else {
      const workOrder = await WorkOrder.findOne({
        efiWoNumber: existingDispatch.efiWoNumber
      });
      totalQty = Number(workOrder.qtyInLvs) || 0;
      sameJobFilter = { efiWoNumber: existingDispatch.efiWoNumber };
    }

    // 🔹 Sum all OTHER dispatches (exclude current)
    const otherDispatches = await Dispatch.find({
      ...sameJobFilter,
      _id: { $ne: req.params.id } // 🔥 KEY FIX
    });

    const dispatchedQty = otherDispatches.reduce(
      (sum, d) => sum + Number(d.dispatchQty || 0),
      0
    );

    // 🔹 New dispatch qty from request
    const newDispatchQty = Number(data.dispatchQty) || 0;

    // 🔴 VALIDATION
    if (dispatchedQty + newDispatchQty > totalQty) {
      return res.status(400).json({
        message: "Dispatch exceeds available balance"
      });
    }

    // 🔹 Delay logic (same as yours)
    let delayDays = 0;
    let delayLabel = "On Time";

    if (data.dispatchDate && data.expectedDeliveryDate) {
      const dispatchDate = new Date(data.dispatchDate);
      const expectedDate = new Date(data.expectedDeliveryDate);

      const diffTime = dispatchDate - expectedDate;
      delayDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (delayDays > 0) delayLabel = delayDays + " days delay";
      else if (delayDays < 0) delayLabel = Math.abs(delayDays) + " days early";
    }

    // 🔹 Final balance
    const finalBalance = totalQty - (dispatchedQty + newDispatchQty);

    const updated = await Dispatch.findByIdAndUpdate(
      req.params.id,
      {
        ...data,
        delayDays,
        delayLabel,
        balanceQty: finalBalance,
        noOfPackets: Number(data.noOfPackets) || 0,
        noOfBoxes: Number(data.noOfBoxes) || 0,
        userLocations: parseLocations(data.userLocations),
        ...(req.file
          ? { attachment: `/uploads/dispatch/${req.file.filename}`, attachmentName: req.file.originalname }
          : {}),
        extraQty: data.extraQty 
      },
      { new: true }
    );

    res.json({
      message: "Dispatch Updated Successfully",
      updated
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating dispatch" });
  }
};

// 🔹 Delete Dispatch
exports.deleteDispatch = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Dispatch.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Dispatch not found" });
    }

    res.json({ message: "Dispatch deleted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting dispatch" });
  }
};
// 🔹 Bulk import dispatches (Excel upload)
const toYMD = (v) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return String(v).split("T")[0];
};

exports.bulkImportDispatch = async (req, res) => {
  try {
    const { rows, enteredBy, userLocations } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "No rows to import" });
    }
    if (!enteredBy) {
      return res.status(400).json({ message: "User missing. Please login again." });
    }

    const jobCache = {};
    const errors = [];
    let inserted = 0;
    let skipped = 0;

    // sequential on purpose: balance must accumulate row by row
    for (const r of rows) {
      try {
        const job = String(r.job || "").trim();
        if (!job) throw new Error("WO / Ticket is missing");

        const isWo = /^\d+$/.test(job);
        const key = isWo ? `wo-${job}` : `tk-${job.toUpperCase()}`;

        // ---- load master + already dispatched qty (once per job) ----
        if (!jobCache[key]) {
          let master, filter, total, customer, productName, productType, purchaseOrderNo, poDate, expected;

          if (isWo) {
            master = await WorkOrder.findOne({ efiWoNumber: job });
            if (!master) throw new Error(`Work Order ${job} not found`);
            filter = { efiWoNumber: job };
            total = Number(master.qtyInLvs) || 0;
            customer = master.customer;
            productName = master.productName;
            productType = master.productType || "";
            purchaseOrderNo = master.purchaseOrderNo || "";
            poDate = toYMD(master.poDate);
            expected = toYMD(master.expectedDeliveryDate);
          } else {
            const ticketNo = job.toUpperCase();
            master = await CustomerOrder.findOne({ ticketNo }).lean();
            if (!master) throw new Error(`Ticket ${ticketNo} not found`);
            if (!["Out Source", "PMS"].includes(master.orderType)) {
              throw new Error(`Ticket ${ticketNo} is not Out Source / PMS`);
            }
            filter = { ticketNo };
            total = Number(master.quantity) || 0;
            customer = master.customerName;
            productName = master.description;
            productType = master.materialType || "";
            purchaseOrderNo = master.purchaseOrderNo || "";
            poDate = toYMD(master.poDate);
            expected = toYMD(master.expectedDeliveryDate);
          }

          const existing = await Dispatch.find(filter);
          const dispatched = existing.reduce((s, d) => s + Number(d.dispatchQty || 0), 0);

          jobCache[key] = {
            filter, total, dispatched, customer, productName, productType,
            purchaseOrderNo, poDate, expected
          };
        }

        const c = jobCache[key];

        // ---- validations (same rules as the form) ----
        const dispatchQty = Number(r.dispatchQty);
        if (!Number.isInteger(dispatchQty) || dispatchQty <= 0) {
          throw new Error("Dispatch Qty must be a whole number greater than 0");
        }
        const balanceNow = c.total - c.dispatched;
        if (dispatchQty > balanceNow) {
          throw new Error(`Dispatch Qty ${dispatchQty} exceeds Balance Qty ${balanceNow}`);
        }
        if (!r.dispatchDate) throw new Error("Dispatch Date is required");

        const extraQty = Number(r.extraQty || 0);
        if (isNaN(extraQty) || extraQty < 0) throw new Error("Extra Qty is invalid");

        const safe = /^[a-zA-Z0-9\s.,]*$/;
        for (const f of ["trackingNumber", "deliveryAddress", "remarks", "invoiceNo"]) {
          if (!safe.test(r[f] || "")) throw new Error(`Special characters not allowed in ${f}`);
        }

        // ---- duplicate check ----
        const dup = await Dispatch.findOne({
          ...c.filter,
          invoiceNo: r.invoiceNo,
          dispatchDate: r.dispatchDate,
          dispatchQty,
          trackingNumber: r.trackingNumber
        });
        if (dup) { skipped++; continue; }

        // ---- delay logic (same as createDispatch) ----
        const expected = c.expected || r.expectedDeliveryDate || "";
        let delayDays = 0;
        let delayLabel = "On Time";
        if (r.dispatchDate && expected) {
          delayDays = Math.round(
            (new Date(r.dispatchDate) - new Date(expected)) / (1000 * 60 * 60 * 24)
          );
          if (delayDays > 0) delayLabel = delayDays + " days delay";
          else if (delayDays < 0) delayLabel = Math.abs(delayDays) + " days early";
        }

        const doc = new Dispatch({
          ...(isWo ? { efiWoNumber: Number(job) } : { ticketNo: job.toUpperCase() }),
          purchaseOrderNo: c.purchaseOrderNo || r.purchaseOrderNo || "",
          poDate: c.poDate || r.poDate || "",
          customer: c.customer || r.customer,
          productName: c.productName || r.productName,
          productType: c.productType || "",
          totalQty: c.total,
          dispatchQty,
          balanceQty: balanceNow - dispatchQty,
          extraQty,
          dispatchDate: r.dispatchDate,
          expectedDeliveryDate: expected,
          delayDays,
          delayLabel,
          courier: r.courier,
          trackingNumber: r.trackingNumber,
          invoiceNo: r.invoiceNo,
          invoiceDate: r.invoiceDate || "",
          location: r.location || "",
          deliveryAddress: r.deliveryAddress,
          remarks: r.remarks || "",
          enteredBy,
          userLocations: userLocations || []
        });

        await doc.save();
        c.dispatched += dispatchQty;
        inserted++;
      } catch (e) {
        errors.push({ rowNo: r.rowNo, message: e.message });
      }
    }

    res.json({ inserted, skipped, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error importing dispatches" });
  }
};