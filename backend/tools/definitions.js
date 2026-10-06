// tools/definitions.js
// Gemini functionDeclarations for each ERP module.
// Each tool is a flexible read-only query tool. Field names match your
// Mongoose schemas and the executors in tools/executor.js.

const commonPaging = {
  sortBy: {
    type: "STRING",
    description: "Field to sort by, prefix with '-' for descending, e.g. '-createdAt'",
  },
  limit: {
    type: "NUMBER",
    description: "Max records to return, default 20 and max 100",
  },
};

function queryTool(name, description, filterProperties) {
  return {
    name,
    description,
    parameters: {
      type: "OBJECT",
      properties: {
        filters: {
          type: "OBJECT",
          properties: filterProperties,
        },
        ...commonPaging,
      },
    },
  };
}

const dateFromTo = (fieldName) => ({
  [`${fieldName}From`]: { type: "STRING", description: "YYYY-MM-DD" },
  [`${fieldName}To`]: { type: "STRING", description: "YYYY-MM-DD" },
});

const tools = [
  {
    functionDeclarations: [
      queryTool(
        "query_work_orders",
        `Query Work Orders. Use for work order status, total quantity, order quantity
(qtyInLvs - this is the "Planned Qty" for a work order), customer, product, PO number,
dates, dispatch location, priority, planning user, etc.`,
        {
          efiWoNumber: { type: "NUMBER", description: "Exact EFI work order number" },
          workorder2: { type: "STRING" },
          customer: { type: "STRING", description: "Partial match ok" },
          purchaseOrderNo: { type: "STRING" },
          productName: { type: "STRING", description: "Partial match ok" },
          productType: { type: "STRING" },
          productCode: { type: "NUMBER" },
          status: { type: "STRING" },
          priority: { type: "STRING" },
          location: { type: "STRING" },
          dispatchLocation: { type: "STRING" },
          planningUser: { type: "STRING" },
          ...dateFromTo("poDate"),
          ...dateFromTo("woDate"),
          ...dateFromTo("expectedDeliveryDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_customer_orders",
        `Query Customer/Purchase Orders. Use for purchase orders, order status,
delivery dates, customer, product, ticket number, source, or order type.`,
        {
          purchaseOrderNo: { type: "STRING" },
          customerName: { type: "STRING", description: "Partial match ok" },
          productCode: { type: "NUMBER" },
          materialType: { type: "STRING" },
          description: { type: "STRING" },
          status: { type: "STRING" },
          orderType: { type: "STRING", enum: ["Inhouse", "Out Source", "PMS"] },
          source: { type: "STRING", enum: ["newIndent", "purchaseOrder"] },
          ticketNo: { type: "STRING" },
          user: { type: "STRING" },
          ...dateFromTo("poDate"),
          ...dateFromTo("expectedDeliveryDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_printing_instructions",
        `Query Printing Instructions. Use for print tickets, PO, work order,
branch, material, packing, freight, transport, billing, KAM, delivery date, or status.`,
        {
          ticketId: { type: "STRING" },
          purchaseOrderNo: { type: "STRING" },
          workorder2: { type: "STRING" },
          branchCode: { type: "STRING" },
          orderType: { type: "STRING" },
          status: { type: "STRING" },
          modeOfTransport: { type: "STRING" },
          kam: { type: "STRING" },
          materialCode: { type: "STRING" },
          materialDescription: { type: "STRING" },
          accountNumber: { type: "STRING" },
          ...dateFromTo("poDate"),
          ...dateFromTo("expectedDeliveryDate"),
          ...dateFromTo("deliveryDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_production",
        `Query Production (reel/mill production log - NOT the same as query_production_real).
This is the record behind the Reel Summary Report and Wastage Report screens. Use for
reel numbers, mill, GSM, paper size, material/material group, gross weight, mill net
weight, actual net weight, production output, waste breakdown (matt waste, print waste,
end waste, core weight), total waste, balance, waste %, make-ready vs production run
type, production user, user location, or production/work-order dates. Do not use this
for shift-wise quantity, wastage %, impressions, UPS, or machine status against a work
order - use query_production_real for those instead.`,
        {
          efiWoNumber: { type: "NUMBER" },
          customerName: { type: "STRING" },
          jobDescription: { type: "STRING" },
          jobSize: { type: "STRING" },
          reelNo: { type: "STRING" },
          mill: { type: "STRING" },
          "materials.gsm": { type: "STRING" },
          "materials.paperSize": { type: "STRING" },
          "materials.materialGroupDescription": { type: "STRING" },
          productionType: { type: "STRING", enum: ["Make Ready", "Production"] },
          productionUser: { type: "STRING" },
          userLocations: { type: "STRING", description: "Exact user location, e.g. a branch/location name" },
          ...dateFromTo("date"),
          ...dateFromTo("productionDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_production_summary",
        `Pre-aggregated summary of Production (reel) records, grouped and summed in the
database - ALWAYS use this instead of manually fetching raw query_production records and
adding them up yourself whenever the question asks for a total BY customer, BY mill, or
BY work order (e.g. "customer waste summary", "mill summary", "which customer has the
most waste", "planned vs achieved by work order", "work order summary"). Manual summation
over raw records is unreliable once there are more groups than the record limit covers -
this tool is always complete and accurate because the database does the grouping.
Returns, per group: total actual net weight, total waste, waste %, and record count.
When groupBy is "workOrder", each group also includes plannedQty (the work order's
qtyInLvs) and achievedQty (sum of productionOutput x ups) so you can answer "planned vs
achieved" directly from the results without any extra tool calls or manual math.`,
        {
          groupBy: {
            type: "STRING",
            enum: ["customer", "mill", "workOrder"],
            description: "Required. What to group and sum the records by.",
          },
          customerName: { type: "STRING", description: "Optional - narrow to one customer" },
          mill: { type: "STRING", description: "Optional - narrow to one mill" },
          efiWoNumber: { type: "NUMBER", description: "Optional - narrow to one work order" },
          topN: {
            type: "NUMBER",
            description: "Max number of groups to return, sorted by total waste descending. Default 20, max 50.",
          },
          ...dateFromTo("productionDate"),
        },
      ),

      queryTool(
        "query_dispatch",
        `Query Dispatch. Use for shipments, dispatch quantities, invoices,
courier, tracking, delays, delivery address, PO, customer, or work order.`,
        {
          efiWoNumber: { type: "NUMBER" },
          purchaseOrderNo: { type: "STRING" },
          customer: { type: "STRING" },
          productName: { type: "STRING" },
          invoiceNo: { type: "STRING" },
          trackingNumber: { type: "STRING" },
          courier: { type: "STRING" },
          location: { type: "STRING" },
          deliveryAddress: { type: "STRING" },
          enteredBy: { type: "STRING" },
          ...dateFromTo("createdAt"),
          ...dateFromTo("updatedAt"),
        },
      ),

      queryTool(
        "query_schedule",
        `Query the Scheduler/Gantt schedule. This is the ONLY place a work order's actual
assigned date, time, and machine live - a work order having query_work_orders.status =
"PLANNED" does NOT mean it has been scheduled yet, it only means it's eligible and
waiting to be scheduled. Use this tool for: "when/what time is WO X scheduled", "which
machine is WO X assigned to", scheduled/blocked machine slots, schedule start/end times,
work order schedule, customer schedule, priority, or location. Filter by efiWoNumber to
look up a specific work order's schedule. Zero results means that work order has not
been given a schedule date/time yet, NOT that the work order doesn't exist.`,
        {
          efiWoNumber: { type: "NUMBER", description: "Exact EFI work order number to look up its scheduled date/time/machine" },
          customer: { type: "STRING" },
          productName: { type: "STRING" },
          productType: { type: "STRING" },
          priority: { type: "STRING" },
          location: { type: "STRING" },
          isBlocked: { type: "BOOLEAN" },
          schedulerHidden: { type: "BOOLEAN" },
          planningUser: { type: "STRING" },
          blockReason: { type: "STRING" },
          ...dateFromTo("startTime"),
          ...dateFromTo("endTime"),
          ...dateFromTo("scheduleDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_items",
        `Query Item Master. Use for item code, customer, description,
material type, color, job size, ink details, or item PDF.`,
        {
          itemCode: { type: "STRING" },
          customerName: { type: "STRING" },
          materialType: { type: "STRING" },
          description: { type: "STRING" },
          jobSize: { type: "STRING" },
          inkDetails: { type: "STRING" },
        },
      ),

      queryTool("query_activity_masters", "Query Activity Master by activity name or machine names.", {
        activityName: { type: "STRING" },
        machines: { type: "STRING" },
      }),

      queryTool("query_branches", "Query Branch master by branch code or dispatch address.", {
        branchCode: { type: "STRING" },
        dispatchAddress: { type: "STRING" },
      }),

      queryTool("query_counters", "Query counters by name or sequence.", {
        name: { type: "STRING" },
        sequence: { type: "NUMBER" },
      }),

      queryTool("query_customer_masters", "Query Customer Master by customer name, address, contact, phone, or email.", {
        name: { type: "STRING" },
        address: { type: "STRING" },
        contactPerson: { type: "STRING" },
        phone: { type: "STRING" },
        email: { type: "STRING" },
      }),

      queryTool("query_freight_charge_types", "Query Freight Charge Type master by name.", {
        name: { type: "STRING" },
      }),

      queryTool("query_freight_types", "Query Freight Type master by name.", {
        name: { type: "STRING" },
      }),

      queryTool(
        "query_indent_requests",
        "Query Indent Requests by indent number, item fields, status, order type, user, approval date, or created date.",
        {
          indentNo: { type: "STRING" },
          status: { type: "STRING", enum: ["PENDING_PO", "APPROVED", "REJECTED"] },
          orderType: { type: "STRING" },
          user: { type: "STRING" },
          userEmail: { type: "STRING" },
          "items.productCode": { type: "STRING" },
          "items.customerName": { type: "STRING" },
          "items.description": { type: "STRING" },
          "items.customerPoNo": { type: "STRING" },
          ...dateFromTo("approvedAt"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_inward_registers",
        "Query Inward Register by work order, customer, item, material, inward date, received quantity, pending quantity, issuer, receiver, or document number.",
        {
          efiWoNumber: { type: "NUMBER" },
          customerName: { type: "STRING" },
          itemDescription: { type: "STRING" },
          materialCode: { type: "STRING" },
          materialDocumentNo: { type: "STRING" },
          issuer: { type: "STRING" },
          receiver: { type: "STRING" },
          remarks: { type: "STRING" },
          ...dateFromTo("workOrderDate"),
          ...dateFromTo("dateOfInward"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool("query_locations", "Query Location Master by location name or address.", {
        locationName: { type: "STRING" },
        address: { type: "STRING" },
      }),

      queryTool("query_machine_capacities", "Query Machine Capacity by machine, capacity per hour, or shift time.", {
        machineId: { type: "STRING" },
        capacityPerHour: { type: "NUMBER" },
        shiftStart: { type: "NUMBER" },
        shiftEnd: { type: "NUMBER" },
      }),

      queryTool("query_machine_masters", "Query Machine Master by machine name.", {
        machineName: { type: "STRING" },
      }),

      queryTool("query_machine_statuses", "Query Machine Status master by status name.", {
        statusName: { type: "STRING" },
      }),

      queryTool(
        "query_manual_boxes",
        "Query Manual Box records by PO, article, EAN, delivery address, GSTIN, material, quantity, entered by, or user location.",
        {
          ponumber: { type: "STRING" },
          articleNo: { type: "STRING" },
          eanNo: { type: "STRING" },
          deliveryAddress: { type: "STRING" },
          gstinNo: { type: "STRING" },
          materialDescription: { type: "STRING" },
          enteredBy: { type: "STRING" },
          userLocations: { type: "STRING" },
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool("query_materials", "Query Material master by code, description, group, mill, GSM, or paper size.", {
        code: { type: "STRING" },
        description: { type: "STRING" },
        group: { type: "STRING" },
        mill: { type: "STRING" },
        gsm: { type: "STRING" },
        paperSize: { type: "STRING" },
      }),

      queryTool("query_inner_packings", "Query Inner Packing master by packing type and quantities.", {
        type: { type: "STRING" },
        leavesPerInner: { type: "NUMBER" },
        innerPack: { type: "NUMBER" },
        outerPack: { type: "NUMBER" },
        innerPerOuter: { type: "NUMBER" },
      }),

      queryTool("query_paper_sizes", "Query Paper Size master by name.", {
        name: { type: "STRING" },
      }),

      queryTool(
        "query_plate_requests",
        "Query Plate Requests by work order, job name, customer, product type, activities, machines, requested by, reviewed by, or status.",
        {
          efiWoNumber: { type: "STRING" },
          jobName: { type: "STRING" },
          customerName: { type: "STRING" },
          jobDescription: { type: "STRING" },
          productType: { type: "STRING" },
          activities: { type: "STRING" },
          machineNames: { type: "STRING" },
          requestedBy: { type: "STRING" },
          status: { type: "STRING", enum: ["PENDING", "APPROVED", "REJECTED"] },
          reviewedBy: { type: "STRING" },
          ...dateFromTo("reviewedAt"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool("query_po_detail_records", "Query PO Detail Records by PO number, box quantity, total quantity, remaining quantity, entered by, or user location.", {
        ponumber: { type: "STRING" },
        eachBoxQty: { type: "NUMBER" },
        qty: { type: "NUMBER" },
        totalQty: { type: "NUMBER" },
        remainingQty: { type: "NUMBER" },
        enteredBy: { type: "STRING" },
        userLocations: { type: "STRING" },
        ...dateFromTo("createdAt"),
      }),

      queryTool(
        "query_preprocess",
        "Query Preprocess/Prepress assignments by work order, customer, product, PO, priority, status, assigned by, planning user, material, or date.",
        {
          efiWoNumber: { type: "NUMBER" },
          productCode: { type: "STRING" },
          purchaseOrderNo: { type: "STRING" },
          priority: { type: "STRING" },
          customer: { type: "STRING" },
          productType: { type: "STRING" },
          productName: { type: "STRING" },
          location: { type: "STRING" },
          status: { type: "STRING", enum: ["ASSIGNED", "IN_PROGRESS", "COMPLETED"] },
          assignedBy: { type: "STRING" },
          planningUser: { type: "STRING" },
          destinationFolder: { type: "STRING" },
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool("query_printer_masters", "Query Printer Master by machine name or printer name.", {
        machineName: { type: "STRING" },
        printerNames: { type: "STRING" },
      }),

      queryTool("query_priorities", "Query Priority master by priority name.", {
        name: { type: "STRING" },
      }),

      queryTool(
        "query_production_machine_statuses",
        "Query Production Machine Status by date, shift, machine status, customer, material, work order number, wastage, reason, paper size, printer, or entered by.",
        {
          shift: { type: "STRING" },
          machineStatus: { type: "STRING" },
          customerName: { type: "STRING" },
          materialType: { type: "STRING" },
          woNumber: { type: "STRING" },
          reason: { type: "STRING" },
          paperSize: { type: "STRING" },
          printerName: { type: "STRING" },
          enteredBy: { type: "STRING" },
          ...dateFromTo("productionDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_production_real",
        `Query the shift-wise Production Real entry log (NOT the same as query_production).
This is the primary tool for questions about actual production entries against a work
order: production quantity, wastage quantity, wastage %, production impression, waste
impression, production UPS, shift (Day/Night), machine status (e.g. PRODUCTION, IDLE,
BREAKDOWN), the activity+machine pairs used, product type, order quantity, materials
used, remarks, entered-by user, user location, and production date / from-time / to-time.
Use this tool whenever the question is about "production real", shift output, wastage,
impressions, UPS, or machine status for a specific work order or date range.`,
        {
          workOrder: { type: "NUMBER", description: "efiWoNumber this production entry is against" },
          customerName: { type: "STRING" },
          jobDescription: { type: "STRING" },
          jobSize: { type: "STRING" },
          shift: { type: "STRING", enum: ["Day", "Night"] },
          machineStatus: { type: "STRING" },
          productType: { type: "STRING" },
          enteredBy: { type: "STRING" },
          ...dateFromTo("productionDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_production_real_summary",
        `Pre-aggregated summary of the shift-wise Production Real log (this is the
Production Report screen's data source - NOT the reel/mill query_production data, and
NOT the same as query_production_summary which aggregates that different model). Only
PRODUCTION-status entries are included (matching this report's own logic).

This tool has TWO distinct usage patterns - pick the one matching what was actually
asked, they return very different shapes of data for the same work order:

1. groupBy: "workOrder" (optionally with workOrder set to one efiWoNumber) -> ONE ROW
PER WORK ORDER matching the "Job Performance" table's exact logic: it does NOT sum
across entries. It returns customerName, orderQty, and production from ONLY the single
LATEST entry (by creation time) for that work order, plus completionPercent
(production / orderQty x 100) and entryCount (how many PRODUCTION entries exist in
total, for context - not a count of what was summed, since nothing was summed). Use it
for "job performance for WO X", "latest production entry for WO X". Do not describe
"production" here as a total or a sum - say it is the latest recorded entry.

2. groupBy: "machine" WITH workOrder set to one efiWoNumber -> ONE ROW PER MACHINE
USED ON THAT SPECIFIC WORK ORDER, each with production quantity and wastage quantity
SUMMED across every entry that used that machine (some machines may show 0 if only used
for non-production activities). This matches the "Jobwise Machine Performance" and
"Jobwise Wastage Performance" tables - use it whenever the question asks for a
machine-wise / machine-by-machine breakdown FOR A SPECIFIC WORK ORDER, e.g. "jobwise
wastage performance for WO X", "wastage by machine for WO X". Do NOT use groupBy
"workOrder" for these - it only returns the latest entry and loses the per-machine
breakdown entirely.

groupBy: "machine" WITHOUT a workOrder filter instead returns totals per machine summed
across ALL work orders (matches the "Machine Production" table) - use this only for
"which machine has the most production/wastage overall", not for a single-WO breakdown.

Each "machine" result includes TWO different percentage fields, matching two different
tables - use the right one:
- wastePercent = freshly computed (total wastage / total production) x 100. This matches
  the "Machine Production" table (cross-work-order totals).
- wastePercentStoredSum = the sum of each entry's own stored wastePercent field. This
  matches the "Jobwise Wastage %" table (per-work-order, per-machine breakdown) - use
  this field, not wastePercent, when answering a "Jobwise Wastage %" question.
  3. groupBy: "kpi" (no workOrder filter, optional date range filters) -> ONE ROW with
overall dashboard totals matching the Production Report screen's KPI cards exactly:
totalOrders (distinct work orders with at least one PRODUCTION-status entry),
totalProduction (sum of productionQty), totalWastage (sum of wastageQty), and
avgWastePercent (totalWastage / totalProduction x 100). Use this for "what is the
production KPI", "total production and wastage", "average waste %", or "how many
orders are in production" - do not use groupBy "workOrder" or "machine" for these,
and never compute these totals yourself from raw query_production_real records.

Numbers are computed in the database so they are complete regardless of record count.
`,
        {
          groupBy: {
            type: "STRING",
            enum: ["workOrder", "machine", "kpi"],
            description: "Required. What to group and sum the records by.",
          },
          workOrder: {
            type: "NUMBER",
            description: "efiWoNumber. Required for a per-machine breakdown of one specific work order (groupBy: machine). Optional narrowing filter for groupBy: workOrder.",
          },
          customerName: { type: "STRING", description: "Optional - narrow to one customer" },
          topN: {
            type: "NUMBER",
            description: "Max number of groups to return, sorted by total production descending. Default 20, max 50.",
          },
          ...dateFromTo("productionDate"),
        },
      ),

      queryTool(
        "query_scan_logs",
        "Query Scan Logs by PO number, barcode, box number, total boxes, username, scan date, delivery date, or remaining quantity.",
        {
          poNumber: { type: "STRING" },
          barcodeNo: { type: "STRING" },
          currentBox: { type: "NUMBER" },
          totalBoxes: { type: "NUMBER" },
          username: { type: "STRING" },
          ...dateFromTo("scannedAt"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool(
        "query_shredding",
        "Query Shredding by work order, reel number, waste values, shredding date, planning user, or user location.",
        {
          efiWoNumber: { type: "NUMBER" },
          reelNo: { type: "STRING" },
          planningUser: { type: "STRING" },
          userLocations: { type: "STRING" },
          ...dateFromTo("shreddingDate"),
          ...dateFromTo("createdAt"),
        },
      ),

      queryTool("query_transportation_masters", "Query Transportation Master by name or active status.", {
        name: { type: "STRING" },
        status: { type: "BOOLEAN" },
      }),

      queryTool(
        "query_users",
        "Query users by name, email, role, internal flag, or location. Password is never returned.",
        {
          name: { type: "STRING" },
          email: { type: "STRING" },
          role: { type: "STRING" },
          locations: { type: "STRING" },
          isInternal: { type: "BOOLEAN" },
          ...dateFromTo("createdAt"),
        },
      ),
    ],
  },
];

module.exports = { tools };