const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

// ================== MIDDLEWARES ==================
app.set("trust proxy", 1);


app.use(cors({
  origin: "http://localhost:5173", // your frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(express.json());

// ================== ROUTES ==================
// Auth routes (if you have login system)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/master", require("./routes/material"));
// Master data routes
app.use("/api/master", require("./routes/masterRoutes"));
app.use("/api/schedule", require("./routes/scheduleRoutes"));
app.use("/api/capacity", require("./routes/capacityRoutes"));
// At the top of server.js, with other requires
const activityRoutes = require("./routes/activityRoutes"); // ✅ Import first
app.use("/api/master", require("./routes/branchRoutes"));
// Then below, after middlewares:
app.use("/api/master/activities", activityRoutes); 

app.use("/uploads", express.static("uploads"));

// Work Order routes
app.use("/api/workorders", require("./routes/workOrderRoutes"));
const productionRealRoutes = require("./routes/productionReal");
app.use("/api/production-real", productionRealRoutes);

// Customer Order routes
const customerOrderRoutes = require("./routes/customerOrders");
app.use("/api/customer-orders", customerOrderRoutes);

app.use("/api/production", require("./routes/productionRoutes"));
// ================== TEST ROUTE ==================
app.get("/", (req, res) => {
  res.send("ERP WorkOrder API Running...");
});

const dispatchRoutes = require("./routes/dispatchRoutes");

app.use("/api/dispatch", dispatchRoutes);

app.use("/api/master/items", require("./routes/items"));
const materialRoutes = require("./routes/material");
app.use("/api/master", materialRoutes);

const machineStatusRoutes = require("./routes/machineStatusRoutes");

app.use("/api/printing-instructions", require("./routes/printingInstructions"));
app.use("/api/master", require("./routes/innerPacking"));

app.use("/api/master/machine-status", machineStatusRoutes);
// ================== START SERVER ==================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => 
  console.log(`🚀 Server running on port ${PORT}`)
);