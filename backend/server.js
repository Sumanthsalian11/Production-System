const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();
require("./cron/indentMailScheduler");
require("./cron/productionMailCron");
require("./cron/Persoproductionmail")
// ================== MIDDLEWARES ==================
app.set("trust proxy", 1);

app.use(
  cors({
    origin: ["https://mpi2apps.mpimanipal.com", "http://localhost:5173"], // your frontend
    methods: ["GET", "POST", "PUT","PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(express.json());
// ================== ROUTES ==================
// Auth routes (if you have login system)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/master/items", require("./routes/items"));
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
const newIndentRoute = require("./routes/indentRoutes");
app.use("/api/newindent", newIndentRoute);
// Work Order routes
app.use("/api/workorders", require("./routes/workOrderRoutes"));
const productionRealRoutes = require("./routes/productionreal");
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

const materialRoutes = require("./routes/material");
app.use("/api/master", materialRoutes);

const machineStatusRoutes = require("./routes/machineStatusRoutes");

app.use("/api/printing-instructions", require("./routes/printingInstructions"));
app.use("/api/master", require("./routes/innerPacking"));

app.use("/api/master/machine-status", machineStatusRoutes);
const manualBoxRoutes = require("./routes/manualBox");
app.use("/api/manual-box", manualBoxRoutes);
const scanLogRouter = require("./routes/scanLog");
app.use("/api/scan-log", scanLogRouter);
const productionMachineStatusRoutes = require("./routes/productionMachineStatus");
app.use(
  "/api/production-machine-status",
  productionMachineStatusRoutes
);
const paperSizePrinterRoutes = require("./routes/paperSizePrinterRoutes");
app.use("/api/master", paperSizePrinterRoutes);
const shreddingRoutes = require("./routes/shreddingRoutes");
app.use("/api/shredding", shreddingRoutes);

const inwardRoutes = require("./routes/inwardRegisterRoutes");
app.use("/api/inward-register", inwardRoutes);
const preprocessRoutes = require("./routes/Preprocessroutes");
app.use("/api/production-log", require("./routes/productionLogRoutes"));
app.use("/api/preprocess", preprocessRoutes);
const artworkRoutes = require("./routes/Artworkroutes");
app.use("/api/artwork", artworkRoutes);
app.use("/api/platerequest", require("./routes/Platerequest"));
const ocrHandwritingRoutes = require("./routes/Ocrhandwriting"); // adjust path to wherever you save the file
app.use(ocrHandwritingRoutes);
const chatRouter = require("./routes/chat.js");
app.use(chatRouter);
const billingReportRoutes = require("./routes/billingReport"); // adjust filename/path if different
app.use("/api/billing-report", billingReportRoutes);
const inventoryDashboardRoutes = require("./routes/Inventorydashboard");
app.use("/api/inventory-dashboard", inventoryDashboardRoutes);
app.use("/api/rir", require("./routes/receivingInspection"));
app.use("/api/calibration", require("./routes/Calibrationroutes"));
const clickReportRoutes = require("./routes/Clickreport");
app.use("/api/click-report", clickReportRoutes);
app.use("/api/master/gst", require("./routes/gstMaster"));
app.use("/api/numbering-jobs", require("./routes/Numberingjobs"));
// ================== START SERVER ==================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => 
  console.log(`🚀 Server running on port ${PORT}`)
);