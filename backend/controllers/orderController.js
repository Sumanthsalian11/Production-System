const CustomerOrder = require("../models/CustomerOrder");


// ========================================
// CREATE NEW ORDER
// ========================================
exports.createOrder = async (req, res) => {
  try {

    const {
      purchaseOrderNo,
      poDate,
      expectedDeliveryDate,
      productCode,
      materialType,
      description,
      customerName,

      colorFront,
      colorBack,
      wasteQty,
      jobSize,
      inkDetails,

      quantity,
      location,
      orderType,
      remarks
    } = req.body;

    const order = await CustomerOrder.create({
      purchaseOrderNo,
      poDate,
      expectedDeliveryDate,
      productCode,
      materialType,
      description,
      customerName,

      colorFront,
      colorBack,
      wasteQty,
      jobSize,
      inkDetails,

      quantity,
      location,
      orderType,
      remarks,

      user: req.user?.name || "System",
      status: "ORDER_RECEIVED"
    });

    res.status(201).json({
      message: "Order created successfully",
      order
    });

  } catch (error) {

    if (error.code === 11000) {
      return res.status(400).json({
        message: "PO Number already exists"
      });
    }

    res.status(500).json({ message: error.message });
  }
};


// ========================================
// GET CUSTOMER ORDERS
// ========================================
exports.getCustomerOrders = async (req, res) => {
  try {

    const { status, orderType } = req.query;

    let filter = {};

    if (status) filter.status = status;
    if (orderType) filter.orderType = orderType;

    const orders = await CustomerOrder.find(filter)
      .populate("location", "locationName")
      .sort({ createdAt: -1 });

    res.json(orders);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ========================================
// UPDATE ORDER STATUS
// ========================================
exports.updateOrderStatus = async (req, res) => {
  try {

    const { status } = req.body;

    const order = await CustomerOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    res.json(order);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};