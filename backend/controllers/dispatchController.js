const WorkOrder = require("../models/WorkOrder");
const Dispatch = require("../models/Dispatch");
const CustomerOrder = require("../models/CustomerOrder");

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
  userLocations: data.userLocations || [] 
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