const WorkOrder = require("../models/WorkOrder");
const Dispatch = require("../models/Dispatch");

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

    // 🔹 Get Work Order
    const workOrder = await WorkOrder.findOne({
      efiWoNumber: existingDispatch.efiWoNumber
    });

    const totalQty = Number(workOrder.qtyInLvs) || 0;

    // 🔹 Sum all OTHER dispatches (exclude current)
    const otherDispatches = await Dispatch.find({
      efiWoNumber: existingDispatch.efiWoNumber,
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