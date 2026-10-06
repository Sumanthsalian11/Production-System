// tools/executor.js
// Query executors for all ERP models.

const mongoose = require("mongoose");

function getModel(modelName, modelPath) {
  return mongoose.models[modelName] || require(modelPath);
}

const ActivityMaster = getModel("ActivityMaster", "../models/ActivityMaster.js");
const Branch = getModel("Branch", "../models/Branch.js");
const Counter = getModel("Counter", "../models/Counter.js");
const CustomerMaster = getModel("CustomerMaster", "../models/CustomerMaster.js");
const CustomerOrder = getModel("CustomerOrder", "../models/CustomerOrder.js");
const Dispatch = getModel("Dispatch", "../models/Dispatch.js");
const FreightChargeType = getModel("FreightChargeType", "../models/FreightChargeType.js");
const FreightType = getModel("FreightType", "../models/FreightType.js");
const IndentRequest = getModel("IndentRequest", "../models/Indentrequest.js");
const InwardRegister = getModel("InwardRegister", "../models/InwardRegister.js");
const Item = getModel("Item", "../models/Item.js");
const LocationMaster = getModel("LocationMaster", "../models/LocationMaster.js");
const MachineCapacity = getModel("MachineCapacity", "../models/MachineCapacity.js");
const MachineMaster = getModel("MachineMaster", "../models/MachineMaster.js");
const MachineStatus = getModel("MachineStatus", "../models/MachineStatus.js");
const ManualBox = getModel("ManualBox", "../models/ManualBox.js");
const Material = getModel("Material", "../models/Material.js");
const InnerPacking = getModel("InnerPacking", "../models/Packing.js");
const PaperSize = getModel("PaperSize", "../models/PaperSize.js");
const PlateRequest = getModel("PlateRequest", "../models/Platerequest.js");
const PODetailRecord = getModel("PODetailRecord", "../models/PODetailRecord.js");
const Preprocess = getModel("Preprocess", "../models/Preprocess.js");
const PrintingInstruction = getModel("PrintingInstruction", "../models/Print.js");
const PrinterMaster = getModel("PrinterMaster", "../models/PrinterMaster.js");
const Priority = getModel("Priority", "../models/Priority.js");
const Production = getModel("Production", "../models/Production.js");
const ProductionMachineStatus = getModel(
  "ProductionMachineStatus",
  "../models/ProductionMachineStatus.js",
);
const ProductionReal = getModel("ProductionReal", "../models/ProductionReal.js");
const ScanLog = getModel("ScanLog", "../models/Scanlog.js");
const Schedule = getModel("Schedule", "../models/Schedule.js");
const Shredding = getModel("Shredding", "../models/Shredding.js");
const TransportationMaster = getModel(
  "TransportationMaster",
  "../models/TransportationMaster.js",
);
const User = getModel("User", "../models/User.js");
const WorkOrder = getModel("WorkOrder", "../models/WorkOrder.js");

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 100;

function regex(value) {
  return value ? { $regex: String(value), $options: "i" } : undefined;
}

function dateRange(from, to) {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
}

function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function pageOpts({ sortBy, limit } = {}) {
  return {
    sort: sortBy || "-createdAt",
    limit: Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT),
  };
}

function buildWhere(filters = {}, config = {}) {
  const where = {};
  const exactFields = new Set(config.exactFields || []);
  const regexFields = new Set(config.regexFields || []);
  const dateFields = new Set(config.dateFields || []);

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;

    if (key.endsWith("From")) {
      const field = key.slice(0, -4);
      if (dateFields.has(field)) {
        where[field] = dateRange(value, filters[`${field}To`]);
      }
      continue;
    }

    if (key.endsWith("To")) {
      const field = key.slice(0, -2);
      if (dateFields.has(field) && !where[field]) {
        where[field] = dateRange(filters[`${field}From`], value);
      }
      continue;
    }

    if (dateFields.has(key)) {
      where[key] = dateRange(value, value);
      continue;
    }

    if (regexFields.has(key)) {
      where[key] = regex(value);
      continue;
    }

    if (exactFields.has(key) || typeof value === "number" || typeof value === "boolean") {
      where[key] = value;
      continue;
    }

    where[key] = regex(value);
  }

  return clean(where);
}

async function runQuery(config, args = {}) {
  const { sort, limit } = pageOpts(args);
  const where = buildWhere(args.filters || {}, config);
  let query = config.model.find(where).sort(sort).limit(limit).lean();

  if (config.select) {
    query = query.select(config.select);
  }

  const results = await query;
  return { count: results.length, results };
}

async function runScheduleQuery(args = {}) {
  const filters = args.filters || {};
  const { sort, limit } = pageOpts(args);
  const scheduleFilters = { ...filters };
  const efiWoNumber = scheduleFilters.efiWoNumber ? Number(scheduleFilters.efiWoNumber) : null;

  delete scheduleFilters.efiWoNumber;

  const where = buildWhere(scheduleFilters, registry.query_schedule);

  if (efiWoNumber) {
    const workOrder = await WorkOrder.findOne({ efiWoNumber }).select("_id efiWoNumber").lean();
    const clauses = [{ efiWoNumber }];

    if (workOrder?._id) {
      clauses.push({ workOrderId: workOrder._id });
    }

    where.$or = clauses;
  }

  const results = await Schedule.find(where)
    .sort(sort)
    .limit(limit)
    .populate({ path: "machineId", select: "machineName" })
    .populate({ path: "workOrderId", select: "efiWoNumber productName customer status" })
    .lean();

  return { count: results.length, results };
}

// Custom aggregation for query_production_summary: groups Production records
// by customer, mill, or work order and sums weight/waste in the database via
// $group, rather than asking the LLM to fetch a handful of raw records and
// add them up itself (which silently breaks once there are more groups than
// the record limit covers). For groupBy "workOrder", also joins in the work
// order's qtyInLvs (Planned Qty) so planned-vs-achieved can be answered in
// one call.
async function runProductionSummary(args = {}) {
  const filters = args.filters || {};
  const groupBy = filters.groupBy;

  if (!["customer", "mill", "workOrder"].includes(groupBy)) {
    return { error: 'groupBy is required and must be one of: "customer", "mill", "workOrder"' };
  }

  const match = clean({
    customerName: filters.customerName ? regex(filters.customerName) : undefined,
    mill: filters.mill ? regex(filters.mill) : undefined,
    efiWoNumber: filters.efiWoNumber ? Number(filters.efiWoNumber) : undefined,
    productionDate: dateRange(filters.productionDateFrom, filters.productionDateTo),
  });

  const topN = Math.min(Number(filters.topN) || 20, 50);

  const groupField =
    groupBy === "customer" ? "$customerName" : groupBy === "mill" ? "$mill" : "$efiWoNumber";

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        achievedUnit: {
          $multiply: [{ $ifNull: ["$productionOutput", 0] }, { $ifNull: ["$ups", 0] }],
        },
      },
    },
    {
      $group: {
        _id: groupField,
        weight: { $sum: { $ifNull: ["$actualNetWeight", 0] } },
        waste: { $sum: { $ifNull: ["$totalWaste", 0] } },
        output: { $sum: { $ifNull: ["$productionOutput", 0] } },
        achievedQty: { $sum: "$achievedUnit" },
        recordCount: { $sum: 1 },
      },
    },
    { $sort: { waste: -1 } },
    { $limit: topN },
  ];

  const raw = await Production.aggregate(pipeline);

  if (groupBy === "workOrder") {
    const woNumbers = raw.map((r) => r._id).filter((v) => v !== null && v !== undefined);
    const workOrders = await WorkOrder.find({ efiWoNumber: { $in: woNumbers } })
      .select("efiWoNumber qtyInLvs")
      .lean();
    const plannedMap = new Map(workOrders.map((w) => [w.efiWoNumber, Number(w.qtyInLvs) || 0]));

    const results = raw.map((r) => {
      const plannedQty = plannedMap.get(r._id) || 0;
      return {
        workOrder: r._id,
        plannedQty,
        achievedQty: r.achievedQty,
        difference: r.achievedQty - plannedQty,
        weight: r.weight,
        waste: r.waste,
        wastePercent: r.weight > 0 ? Number(((r.waste / r.weight) * 100).toFixed(2)) : 0,
        recordCount: r.recordCount,
      };
    });

    return { groupBy, count: results.length, results };
  }

  const results = raw.map((r) => ({
    [groupBy]: r._id || "Unknown",
    weight: r.weight,
    waste: r.waste,
    wastePercent: r.weight > 0 ? Number(((r.waste / r.weight) * 100).toFixed(2)) : 0,
    recordCount: r.recordCount,
  }));

  return { groupBy, count: results.length, results };
}

// Custom aggregation for query_production_real_summary: the ProductionReal
// (shift entry) equivalent of runProductionSummary above, scoped to a
// completely different model/collection. Mirrors the ProductionReport
// screen's own accumulation logic exactly:
// - only machineStatus === "PRODUCTION" entries count toward output/wastage
// - for groupBy "machine", every machine listed in an entry's machiness pairs
//   gets that entry's FULL productionQty/wastageQty added (not divided across
//   machines) - this matches the frontend's forEach-based accumulation, not a
//   naive even split.
async function runProductionRealSummary(args = {}) {
  const filters = args.filters || {};
  const groupBy = filters.groupBy;

  if (!["workOrder", "machine", "kpi"].includes(groupBy)) {
    return { error: 'groupBy is required and must be one of: "workOrder", "machine", "kpi"' };
  }

  const match = clean({
    machineStatus: "PRODUCTION",
    workOrder: filters.workOrder ? Number(filters.workOrder) : undefined,
    customerName: filters.customerName ? regex(filters.customerName) : undefined,
    productionDate: dateRange(filters.productionDateFrom, filters.productionDateTo),
  });

  const topN = Math.min(Number(filters.topN) || 20, 50);

  // ✅ NEW: overall dashboard KPI totals - matches ProductionReport.jsx's
  // four KPI cards exactly (Total Orders, Total Production, Total Wastage,
  // Average Waste %). Does not touch groupBy "workOrder" or "machine" below.
  if (groupBy === "kpi") {
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $addToSet: "$workOrder" },
          totalProduction: { $sum: { $ifNull: ["$productionQty", 0] } },
          totalWastage: { $sum: { $ifNull: ["$wastageQty", 0] } },
        },
      },
    ];

    const raw = await ProductionReal.aggregate(pipeline);
    const row = raw[0] || { totalOrders: [], totalProduction: 0, totalWastage: 0 };

    const totalOrders = row.totalOrders.length;
    const totalProduction = row.totalProduction;
    const totalWastage = row.totalWastage;
    const avgWastePercent =
      totalProduction > 0 ? Number(((totalWastage / totalProduction) * 100).toFixed(2)) : 0;

    return {
      groupBy,
      results: [
        { totalOrders, totalProduction, totalWastage, avgWastePercent },
      ],
    };
  }

  if (groupBy === "workOrder") {
    // Job Performance does NOT sum across entries - it keeps only the single
    // latest entry (by createdAt) per work order and uses that entry's own
    // productionQty/orderQty. Sorting by createdAt desc before $group lets
    // $first pick the latest entry per _id, replicating that exactly.
    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$workOrder",
          customerName: { $first: "$customerName" },
          orderQty: { $first: { $ifNull: ["$orderQty", 0] } },
          production: { $first: { $ifNull: ["$productionQty", 0] } },
          latestEntryDate: { $first: "$createdAt" },
          entryCount: { $sum: 1 },
        },
      },
      { $sort: { production: -1 } },
      { $limit: topN },
    ];

    const raw = await ProductionReal.aggregate(pipeline);
    const results = raw.map((r) => ({
      workOrder: r._id,
      customerName: r.customerName,
      orderQty: r.orderQty,
      production: r.production,
      completionPercent: r.orderQty > 0 ? Number(((r.production / r.orderQty) * 100).toFixed(2)) : 0,
      latestEntryDate: r.latestEntryDate,
      entryCount: r.entryCount,
    }));

    return { groupBy, count: results.length, results };
  }

  // groupBy === "machine": unwind the machine pairs first so each machine
  // used on an entry contributes that entry's full production/wastage
  // (matching the frontend's per-machine forEach accumulation), then a
  // second group-by-(machine, workOrder) dedupes work orders before summing
  // orderQty per machine, matching how machineProduction only adds orderQty
  // once per job/machine combination rather than once per raw entry.
  const pipeline = [
    { $match: match },
    { $unwind: "$machiness" },
    {
      $lookup: {
        from: MachineMaster.collection.name,
        localField: "machiness.machineId",
        foreignField: "_id",
        as: "machineInfo",
      },
    },
    { $unwind: { path: "$machineInfo", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { machine: "$machineInfo.machineName", workOrder: "$workOrder" },
        orderQty: { $first: { $ifNull: ["$orderQty", 0] } },
        production: { $sum: { $ifNull: ["$productionQty", 0] } },
        wastage: { $sum: { $ifNull: ["$wastageQty", 0] } },
        // Jobwise Wastage % sums the STORED wastePercent field per entry
        // (not a freshly computed wastage/production ratio) - tracked
        // separately so callers scoped to one work order can match that
        // table's actual figure rather than a recalculated one.
        wastePercentStoredSum: { $sum: { $ifNull: ["$wastePercent", 0] } },
        entryCount: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.machine",
        orderQty: { $sum: "$orderQty" },
        production: { $sum: "$production" },
        wastage: { $sum: "$wastage" },
        wastePercentStoredSum: { $sum: "$wastePercentStoredSum" },
        entryCount: { $sum: "$entryCount" },
      },
    },
    { $match: { $or: [{ production: { $gt: 0 } }, { wastage: { $gt: 0 } }] } },
    { $sort: { production: -1 } },
    { $limit: topN },
  ];

  const raw = await ProductionReal.aggregate(pipeline);
  const results = raw.map((r) => ({
    machine: r._id || "Unknown",
    orderQty: r.orderQty,
    production: r.production,
    wastage: r.wastage,
    wastePercent: r.production > 0 ? Number(((r.wastage / r.production) * 100).toFixed(2)) : 0,
    wastePercentStoredSum: Number(r.wastePercentStoredSum.toFixed(2)),
    entryCount: r.entryCount,
  }));

  return { groupBy, count: results.length, results };
}

const registry = {
  query_activity_masters: {
    model: ActivityMaster,
    regexFields: ["activityName", "machines"],
  },
  query_branches: {
    model: Branch,
    exactFields: ["branchCode"],
    regexFields: ["dispatchAddress"],
  },
  query_counters: {
    model: Counter,
    exactFields: ["name", "sequence"],
  },
  query_customer_masters: {
    model: CustomerMaster,
    regexFields: ["name", "address", "contactPerson", "phone", "email"],
  },
  query_customer_orders: {
    model: CustomerOrder,
    exactFields: ["purchaseOrderNo", "productCode", "status", "orderType", "source", "ticketNo"],
    regexFields: ["customerName", "description", "materialType", "user"],
    dateFields: ["poDate", "expectedDeliveryDate", "createdAt", "updatedAt"],
  },
  query_dispatch: {
    model: Dispatch,
    exactFields: ["efiWoNumber", "purchaseOrderNo", "invoiceNo", "trackingNumber", "courier", "location"],
    regexFields: ["customer", "productName", "deliveryAddress", "remarks", "enteredBy"],
    dateFields: ["createdAt", "updatedAt"],
  },
  query_freight_charge_types: {
    model: FreightChargeType,
    regexFields: ["name"],
  },
  query_freight_types: {
    model: FreightType,
    regexFields: ["name"],
  },
  query_indent_requests: {
    model: IndentRequest,
    exactFields: ["indentNo", "status", "orderType", "user", "userEmail"],
    regexFields: ["items.productCode", "items.customerName", "items.description", "items.customerPoNo"],
    dateFields: ["approvedAt", "createdAt", "updatedAt"],
  },
  query_inward_registers: {
    model: InwardRegister,
    exactFields: ["efiWoNumber", "materialCode", "materialDocumentNo"],
    regexFields: ["customerName", "itemDescription", "issuer", "receiver", "remarks"],
    dateFields: ["workOrderDate", "dateOfInward", "createdAt", "updatedAt"],
  },
  query_items: {
    model: Item,
    exactFields: ["itemCode"],
    regexFields: ["customerName", "description", "materialType", "jobSize", "inkDetails"],
  },
  query_locations: {
    model: LocationMaster,
    regexFields: ["locationName", "address"],
  },
  query_machine_capacities: {
    model: MachineCapacity,
    exactFields: ["machineId", "capacityPerHour", "shiftStart", "shiftEnd"],
    dateFields: ["createdAt", "updatedAt"],
  },
  query_machine_masters: {
    model: MachineMaster,
    regexFields: ["machineName"],
  },
  query_machine_statuses: {
    model: MachineStatus,
    regexFields: ["statusName"],
    dateFields: ["createdAt", "updatedAt"],
  },
  query_manual_boxes: {
    model: ManualBox,
    exactFields: ["ponumber", "articleNo", "eanNo"],
    regexFields: ["deliveryAddress", "gstinNo", "materialDescription", "enteredBy", "userLocations"],
    dateFields: ["createdAt", "updatedAt"],
  },
  query_materials: {
    model: Material,
    exactFields: ["code"],
    regexFields: ["description", "group", "mill", "gsm", "paperSize"],
    dateFields: ["createdAt", "updatedAt"],
  },
  query_inner_packings: {
    model: InnerPacking,
    exactFields: ["type", "leavesPerInner", "innerPack", "outerPack", "innerPerOuter"],
  },
  query_paper_sizes: {
    model: PaperSize,
    regexFields: ["name"],
  },
  query_plate_requests: {
    model: PlateRequest,
    exactFields: ["efiWoNumber", "status", "requestedBy", "reviewedBy"],
    regexFields: ["jobName", "customerName", "jobDescription", "productType", "activities", "machineNames", "remarks"],
    dateFields: ["reviewedAt", "createdAt", "updatedAt"],
  },
  query_po_detail_records: {
    model: PODetailRecord,
    exactFields: ["ponumber", "enteredBy", "userLocations"],
    dateFields: ["createdAt", "updatedAt"],
  },
  query_preprocess: {
    model: Preprocess,
    exactFields: ["efiWoNumber", "productCode", "purchaseOrderNo", "priority", "location", "status", "assignedBy"],
    regexFields: ["customer", "productType", "productName", "remarks", "planningUser", "destinationFolder"],
    dateFields: ["createdAt", "updatedAt"],
  },
  query_printing_instructions: {
    model: PrintingInstruction,
    exactFields: ["ticketId", "purchaseOrderNo", "workorder2", "branchCode", "orderType", "status", "modeOfTransport", "kam"],
    regexFields: ["products.customerName", "products.description", "materialDescription", "accountNumber"],
    dateFields: ["poDate", "expectedDeliveryDate", "deliveryDate", "createdAt", "updatedAt"],
  },
  query_printer_masters: {
    model: PrinterMaster,
    regexFields: ["machineName", "printerNames"],
  },
  query_priorities: {
    model: Priority,
    regexFields: ["name"],
  },
  query_production: {
    model: Production,
    exactFields: ["efiWoNumber", "reelNo", "productionType", "productionUser", "userLocations"],
    regexFields: [
      "customerName",
      "jobDescription",
      "jobSize",
      "mill",
      "materials.gsm",
      "materials.paperSize",
      "materials.materialGroupDescription",
    ],
    dateFields: ["date", "productionDate", "createdAt", "updatedAt"],
  },
  query_production_machine_statuses: {
    model: ProductionMachineStatus,
    exactFields: ["shift", "machineStatus", "woNumber", "enteredBy"],
    regexFields: ["customerName", "materialType", "remarks", "reason", "paperSize", "printerName"],
    dateFields: ["productionDate", "createdAt", "updatedAt"],
  },
  query_production_real: {
    model: ProductionReal,
    exactFields: ["workOrder", "shift", "machineStatus", "enteredBy"],
    regexFields: ["customerName", "jobDescription", "jobSize", "productType", "remarks"],
    dateFields: ["productionDate", "createdAt", "updatedAt"],
  },
  query_scan_logs: {
    model: ScanLog,
    exactFields: ["poNumber", "barcodeNo", "currentBox", "totalBoxes", "username"],
    dateFields: ["scannedAt", "createdAt", "updatedAt"],
  },
  query_schedule: {
    model: Schedule,
    exactFields: ["efiWoNumber", "priority", "location", "isBlocked", "schedulerHidden"],
    regexFields: ["customer", "productName", "productType", "remarks", "planningUser", "blockReason"],
    dateFields: ["startTime", "endTime", "scheduleDate", "createdAt", "updatedAt"],
  },
  query_shredding: {
    model: Shredding,
    exactFields: ["efiWoNumber", "reelNo", "planningUser"],
    dateFields: ["shreddingDate", "createdAt", "updatedAt"],
  },
  query_transportation_masters: {
    model: TransportationMaster,
    exactFields: ["status"],
    regexFields: ["name"],
  },
  query_users: {
    model: User,
    exactFields: ["role", "isInternal"],
    regexFields: ["name", "email", "locations"],
    select: "-password",
    dateFields: ["createdAt", "updatedAt"],
  },
  query_work_orders: {
    model: WorkOrder,
    exactFields: [
      "efiWoNumber",
      "workorder2",
      "purchaseOrderNo",
      "productCode",
      "priority",
      "location",
      "dispatchLocation",
      "planningUser",
      "status",
    ],
    regexFields: ["customer", "productName", "productType", "remarks", "inkDetails"],
    dateFields: ["poDate", "woDate", "expectedDeliveryDate", "createdAt", "updatedAt"],
  },
};

const toolExecutors = Object.fromEntries(
  Object.entries(registry).map(([toolName, config]) => [
    toolName,
    (args) => runQuery(config, args),
  ]),
);

// query_production_summary and query_production_real_summary don't fit the
// generic find()-based registry pattern above (they're $group aggregations,
// not filtered finds), so they're wired in here.
toolExecutors.query_production_summary = (args) => runProductionSummary(args);
toolExecutors.query_production_real_summary = (args) => runProductionRealSummary(args);
toolExecutors.query_schedule = (args) => runScheduleQuery(args);

module.exports = { toolExecutors };
