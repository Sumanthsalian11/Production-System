const CustomerOrder = require("../models/CustomerOrder");

// Create New Order
exports.createOrder = async (req, res) => {
  try {
    const {
      customerName,
      email,
      phoneNo,
      productName,
      quantity,
      deliveryDate,
      specialInstructions
    } = req.body;

    const order = await CustomerOrder.create({
      customer: req.user.id,
      customerName,
      email,
      phoneNo,
      productName,
      quantity,
      deliveryDate,
      specialInstructions,
      status: "ORDER_RECEIVED"
    });

    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Orders for Logged-in Customer or filtered by status (for Planner Dashboard)
exports.getCustomerOrders = async (req, res) => {
  try {
    const { status } = req.query; // ✅ optional status filter
    let filter = {};

    // If the request comes from planner dashboard, filter by status
    if (status) {
      filter.status = status;
    }

    // If the request comes from logged-in customer, only show their orders
    if (!req.user.isPlanner) {
      filter.customer = req.user.id;
    }

    const orders = await CustomerOrder.find(filter).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Order Status (used when converting to work order)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await CustomerOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
