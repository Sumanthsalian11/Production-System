const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { tools } = require("../tools/definitions.js");
const { toolExecutors } = require("../tools/executor.js");

const WorkOrder = require("../models/WorkOrder.js");
require("../models/MachineMaster.js");
const Schedule = require("../models/Schedule.js");
const Dispatch = require("../models/Dispatch.js");

const router = express.Router();
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstruction = `You are a focused AI assistant embedded in a printing/packaging
manufacturing ERP system. Your job is to help people look up and understand this
company's live ERP data.

You have access to tools that let you look up real, live data from this company's ERP:
Work Orders, Customer/Purchase Orders, Printing Instructions, Production, Dispatch,
Scheduler, and Item Master.

Scope - this is important:
- Only answer questions about this company's ERP data/operations, or brief courteous
  exchanges (greetings, thanks, "what can you help with"). You may also explain ERP
  concepts and terms used in this system (e.g. what a status means, how planned vs
  achieved qty is calculated).
- Do NOT answer general-knowledge, trivia, entertainment, current-events, or any other
  question unrelated to this ERP system (e.g. movies, actors, sports, celebrities,
  history, general how-to questions unrelated to this app). For those, politely decline
  and say you're built to help with this company's work orders, production, dispatch,
  and related ERP data, and ask if they have a question about that.
- Do not perform open-ended tasks unrelated to ERP data (creative writing, coding help
  for other projects, general research, etc.) even if the person asks nicely - redirect
  them the same way.

Rules:
- If the question is about company data (an order, a work order number, dispatch/delivery
  status, production output, schedule, item specs, etc.), call the matching query_* tool.
  Never guess or invent ERP data - always fetch it from a tool.
- query_production and query_production_real are DIFFERENT modules - do not treat them as
  interchangeable, and their summary/aggregation tools are equally separate:
  - query_production is the reel/mill production log (reel numbers, GSM, mill, make-ready
    vs production runs, gross/net weight, waste breakdown, total waste, waste %). Its
    aggregation tool is query_production_summary (groupBy customer/mill/workOrder).
  - query_production_real is the shift-wise production entry log - this is the
    Production Report screen's data source: production quantity, wastage quantity,
    wastage %, production/waste impression, production UPS, shift, machine status (e.g.
    PRODUCTION/IDLE/BREAKDOWN), the activity+machine pairs used, product type, entered-by
    user, and production date/from-time/to-time for a work order. Its aggregation tool is
    query_production_real_summary (groupBy workOrder/machine) - use this, not
    query_production_summary, for "job performance", "machine performance",
    "work order production", or "wastage by machine" questions about actual shift entries.
  - Use query_production_real / query_production_real_summary for questions about shift
    output, wastage, impressions, UPS, machine status, or per-machine performance tied to
    a work order or date. Never answer a query_production_real-shaped question (machine
    performance, job performance, shift wastage) using query_production or
    query_production_summary data, or vice versa - they are different collections with
    different numbers, even though the field names sound similar.
- For any total, summary, or comparison grouped BY customer, BY mill, or BY reel-level
  work order (e.g. "customer waste summary", "mill summary", "which customer has the
  most waste", "reel planned vs achieved by work order"), ALWAYS call
  query_production_summary with the matching groupBy value FIRST.
- For any total, summary, or comparison grouped BY work order or BY machine from actual
  shift production entries (e.g. "job performance", "machine production summary",
  "wastage by machine", "work order production report"), ALWAYS call
  query_production_real_summary with the matching groupBy value FIRST.
  - For overall dashboard KPI questions with no single work order or machine in mind
  (e.g. "what's the production KPI", "total production and wastage today", "average
  waste percentage", "how many orders are in production"), call
  query_production_real_summary with groupBy: "kpi" - do not use groupBy "workOrder"
  or "machine" for these, and never sum raw query_production_real records yourself.
- Within query_production_real_summary, watch for this common mistake: "job performance
  for WO X" wants the SINGLE LATEST entry for that work order (groupBy: "workOrder" -
  this is a latest-entry lookup, NOT a sum across entries, so never describe its
  production figure as a "total"), but "jobwise machine performance for WO X", "jobwise
  wastage performance for WO X", or "wastage by machine for WO X" wants a SEPARATE row
  PER MACHINE used on that one work order, summed across every entry that used it
  (groupBy: "machine" WITH workOrder set to X) - these are different tables with
  different numbers, not two phrasings of the same question. If the person mentions
  specific machines, a machine-by-machine view, or a "jobwise machine/wastage" table by
  name, use groupBy: "machine" with the workOrder filter set, not groupBy: "workOrder".
- When groupBy: "machine" results include both wastePercent and wastePercentStoredSum,
  pick based on what was asked: "Jobwise Wastage %" wants wastePercentStoredSum;
  "Machine Production" (cross-work-order totals, no workOrder filter) wants wastePercent.
  Don't blend or average the two - they represent different calculations.
- Both summary tools return numbers already summed/selected in the database, so they are
  complete and accurate no matter how many groups exist - do not try to answer these by
  manually fetching raw records and computing this yourself, since that silently misses
  data once there are more groups than the record limit covers.
- "Planned Qty" and "Achieved Qty" for a SINGLE specific work order (reel-level, from
  query_production) are NOT stored fields - they must be fetched/computed:
  - Planned Qty = the qtyInLvs field from query_work_orders, filtered by that efiWoNumber.
  - Achieved Qty = the sum of (productionOutput x ups) across every query_production
    record for that efiWoNumber.
  - Prefer calling query_production_summary with groupBy: "workOrder" and
    efiWoNumber set to that work order - it returns plannedQty and achievedQty together
    in one call. Only fall back to calling query_work_orders and query_production
    separately and computing this yourself if the summary tool is unavailable or errors.
- Work Order status lifecycle: a work order that is "pending" has status "Order Received"
  - this means it has come in but has not yet been scheduled/planned. Once it is scheduled,
  its status converts to "Planned". So "Order Received" and "pending" refer to the same
  early stage, and "Planned" is the next stage after that. If asked what a work order's
  status means, or when/whether a pending work order will become "Planned", explain this
  lifecycle in plain terms (don't just echo the raw status string) - still fetch the
  work order's current status via query_work_orders first so your answer reflects where
  it actually sits right now, rather than assuming every pending WO is about to convert.
- IMPORTANT distinction: query_work_orders.status = "PLANNED" does NOT mean a work order
  has an actual scheduled date, time, or machine assigned yet - it only means the work
  order is eligible and waiting to be scheduled (this is what populates the "Pending Work
  Orders" list on the Scheduler screen). A real date/time/machine assignment only exists
  once a separate Schedule record has been created for that work order - this lives in
  query_schedule, a completely different collection, not on the work order itself.
  For ANY question about a work order's scheduled date, scheduled time, assigned machine,
  Gantt/scheduler entry, or whether/when it's scheduled (e.g. "when is WO X scheduled",
  "what time is WO X on the machine", "is WO X scheduled yet"), ALWAYS call query_schedule
  filtered by efiWoNumber FIRST - do not answer from query_work_orders.status alone, and
  do not infer scheduling from status even if it says "PLANNED". If query_schedule returns
  zero results for that efiWoNumber, say specifically that it has not been assigned a
  schedule date/time yet (it may still be pending in the scheduler queue) - do not say
  generically "no work order found," since the work order itself may well exist even
  though no schedule entry does yet; if useful, you can additionally check
  query_work_orders to confirm the work order exists and report its current status.
- Decide the filters yourself based on what the user asked (e.g. status, customer name,
  date range, work order number). You don't need every field filled in - only pass the
  filters relevant to the question.
- The exact-format rule below applies ONLY to a Work Order's stored totalQty field -
  it does not apply to Planned Qty, Achieved Qty, or any other computed/aggregated value.
- For total quantity questions, answer in this exact format only:
  "The total quantity for work order [work order number] is [quantity]."
  Do not mention allowances, buffer, calculations, or internal formula details unless the user specifically asks.
- Keep answers short and direct.
- Formatting: this chat UI does NOT render markdown - never use **bold**, *italics*,
  bullet points starting with * or -, or # headings, since they show up as literal
  stars/hashes instead of formatting. For multi-value answers, just use plain lines with
  a label and colon, one per line, no leading symbols. For example, write:
  Work Order 1002 wastage:
  Total Weight Produced: 245.00 kg
  Total Waste: 10.50 kg
  Waste Percentage: 4.29%
  Not a version with **bold** labels or * bullets in front of each line.
- If a query returns zero results, say so plainly - don't guess what might be there.
- If it's genuinely unclear whether the user wants live data or an ERP-concept
  explanation, ask a quick clarifying question.
- This is a read-only assistant for now - you cannot create, update, or delete records.`;

const RETRYABLE_STATUSES = [500, 503];

// Thinking is disabled by default for this route: every question here is either
// a deterministic lookup+template or a short factual answer, neither of which
// benefits from extended reasoning, and unset thinkingConfig was letting the
// model burn 60-100s of hidden "thought" tokens on the post-tool-call turn.
const NO_THINKING = { thinkingConfig: { thinkingLevel: "minimal" } };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTextFromMessage(message) {
  return message?.parts?.map((part) => part.text || "").join("") || "";
}

function getLastUserText(messages = []) {
  const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
  return getTextFromMessage(lastUserMessage);
}

// Routing (isERPQuestion / getRelevantTools) looks at more than just the latest
// message: a clarification reply like "PR_1008 wo number of this ticket id" can
// lose all its context if the prior turn ("from printing instruction") isn't
// considered too, causing the keyword router to miss the right tool entirely.
// fastERPReply intentionally still uses only the single latest message (below),
// since blending turns there risks picking up a stale WO number from earlier
// in the conversation instead of the one just typed.
function getRecentUserText(messages = [], count = 3) {
  return messages
    .filter((msg) => msg.role === "user")
    .slice(-count)
    .map(getTextFromMessage)
    .filter(Boolean)
    .join(" ");
}

// Keyword -> tool name(s) that could plausibly answer it. Used to shrink the
// tool schema we send to the model: sending all ~30 tool declarations costs
// ~8,000+ prompt tokens and was the main driver of call #1 latency (18s+ for
// only 39 output tokens). Most questions only need 1-6 of these tools.
const KEYWORD_TOOL_MAP = {
  "work order": ["query_work_orders"],
  "wo": ["query_work_orders"],
  "efi": ["query_work_orders"],
  "po": ["query_customer_orders", "query_work_orders", "query_printing_instructions", "query_po_detail_records", "query_manual_boxes", "query_scan_logs"],
  "purchase order": ["query_customer_orders", "query_work_orders", "query_printing_instructions", "query_po_detail_records", "query_manual_boxes", "query_scan_logs"],
  "dispatch": ["query_dispatch"],
  "production": ["query_production", "query_production_machine_statuses", "query_production_real", "query_production_summary", "query_production_real_summary"],
  "schedule": ["query_schedule"],
  "scheduler": ["query_schedule"],
  "scheduled": ["query_schedule"],
  "gantt": ["query_schedule"],
  "assigned": ["query_schedule"],
  "blocked": ["query_schedule"],
  "item": ["query_items"],
  "customer": ["query_customer_masters", "query_customer_orders", "query_work_orders", "query_dispatch", "query_schedule", "query_production", "query_production_real", "query_production_summary", "query_production_real_summary"],
  "quantity": ["query_work_orders", "query_po_detail_records", "query_dispatch", "query_manual_boxes", "query_scan_logs", "query_production_real", "query_production"],
  "qty": ["query_work_orders", "query_po_detail_records", "query_dispatch", "query_manual_boxes", "query_scan_logs", "query_production_real", "query_production"],
  "status": ["query_work_orders", "query_customer_orders", "query_printing_instructions", "query_preprocess", "query_plate_requests", "query_indent_requests", "query_production_real"],
  "reel": ["query_production", "query_shredding"],
  "invoice": ["query_dispatch"],
  "tracking": ["query_dispatch", "query_scan_logs"],
  "inward": ["query_inward_registers"],
  "shredding": ["query_shredding"],
  "preprocess": ["query_preprocess"],
  "prepress": ["query_preprocess"],
  "plate": ["query_plate_requests"],
  "machine": ["query_machine_masters", "query_machine_capacities", "query_machine_statuses", "query_printer_masters", "query_production_machine_statuses", "query_production_real", "query_production_real_summary"],
  "material": ["query_materials", "query_inward_registers", "query_printing_instructions", "query_production"],
  "scan": ["query_scan_logs"],
  // Fields specific to the shift-wise Production Real entry log (productionQty,
  // wastageQty, wastePercent, productionImpression, wasteImpression, productionUps,
  // shift, machineStatus) - these only exist on that model, so route them there directly.
  // Note: "waste"/"wastage" also apply to query_production (reel-level waste %,
  // matt/print/end waste, total waste, balance - source of the Wastage Report).
  "wastage": ["query_production_real", "query_production", "query_production_summary", "query_production_real_summary"],
  "waste": ["query_production_real", "query_production", "query_production_summary", "query_production_real_summary"],
  "impression": ["query_production_real"],
  "ups": ["query_production_real"],
  "shift": ["query_production_real"],
  "machine status": ["query_production_real", "query_production_machine_statuses", "query_machine_statuses"],
  "product type": ["query_production_real", "query_work_orders"],
  "from time": ["query_production_real"],
  "to time": ["query_production_real"],
  "entered by": ["query_production_real"],
  // Reel-level fields from the Summary/Wastage Report screens (query_production).
  "mill": ["query_production", "query_materials", "query_production_summary"],
  "gsm": ["query_production", "query_materials"],
  "paper size": ["query_production", "query_materials", "query_paper_sizes"],
  "weight": ["query_production"],
  "gross": ["query_production"],
  "net weight": ["query_production"],
  "balance": ["query_production"],
  "core": ["query_production"],
  "location": ["query_production", "query_dispatch", "query_shredding", "query_manual_boxes", "query_po_detail_records", "query_production_real", "query_locations"],
  // Summary Report concepts (planned vs achieved qty, aggregate customer/mill waste)
  // require joining query_production with query_work_orders and doing arithmetic -
  // see systemInstruction for the exact formulas the model must use.
  "planned": ["query_production", "query_work_orders", "query_production_summary"],
  "achieved": ["query_production", "query_work_orders", "query_production_summary"],
  "output": ["query_production", "query_production_real"],
  "summary": ["query_production", "query_work_orders", "query_production_summary", "query_production_real_summary"],
  // Job/machine performance concepts from the Production Report screen -
  // these are exclusively query_production_real_summary territory.
  "performance": ["query_production_real_summary"],
    "kpi": ["query_production_real_summary"], 
  "job": ["query_production_real_summary", "query_production_real"],
  "jobwise": ["query_production_real_summary", "query_production_real"],
  "utilization": ["query_production_real"],
  // Ticket-ID lookups (e.g. "PR_1008") are Printing Instruction records
  // (ticketId) and can also cross-reference Customer Orders (ticketNo).
  "ticket": ["query_printing_instructions", "query_customer_orders"],
  "printing instruction": ["query_printing_instructions"],
  "print ticket": ["query_printing_instructions"],
  "branch": ["query_branches"],
  "counter": ["query_counters"],
  "activity": ["query_activity_masters"],
  "freight": ["query_freight_charge_types", "query_freight_types"],
  "charge type": ["query_freight_charge_types"],
  "indent": ["query_indent_requests"],
  "indent request": ["query_indent_requests"],
  "location master": ["query_locations"],
  "capacity": ["query_machine_capacities"],
  "manual box": ["query_manual_boxes"],
  "box": ["query_manual_boxes", "query_scan_logs", "query_po_detail_records"],
  "packing": ["query_inner_packings", "query_printing_instructions"],
  "inner packing": ["query_inner_packings"],
  "paper": ["query_production", "query_materials", "query_paper_sizes"],
  "paper size": ["query_production", "query_materials", "query_paper_sizes"],
  "priority": ["query_priorities", "query_work_orders", "query_schedule"],
  "printer": ["query_printer_masters", "query_production_machine_statuses"],
  "transport": ["query_transportation_masters", "query_dispatch", "query_printing_instructions"],
  "transportation": ["query_transportation_masters", "query_dispatch", "query_printing_instructions"],
  "user": ["query_users"],
  "email": ["query_users", "query_customer_masters"],
  "customer master": ["query_customer_masters"],
  "material master": ["query_materials"],
  "po detail": ["query_po_detail_records"],
  "barcode": ["query_scan_logs"],
  "courier": ["query_dispatch"],
  "delivery": ["query_dispatch", "query_customer_orders", "query_printing_instructions", "query_work_orders"],
};

const ERP_IDENTIFIER_PATTERNS = [
  /\b(?:wo|efi|work\s*order)\s*#?\s*[:\-]?\s*\d{3,}\b/i,
  /\bPR[_-]?\d+\b/i,
  /\b(?:po|purchase\s*order)\s*#?\s*[:\-]?\s*[a-z0-9/_-]{3,}\b/i,
  /\b(?:invoice|tracking|barcode|indent)\s*#?\s*[:\-]?\s*[a-z0-9/_-]{3,}\b/i,
];

function hasERPIdentifier(text = "") {
  return ERP_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(text));
}

function hasCrossModuleWorkOrderIntent(text = "") {
  return /\b(schedule|scheduled|scheduler|gantt|assigned|machine|production|waste|wastage|dispatch|invoice|tracking|preprocess|prepress|plate|inward|shredding|printing|ticket|po|purchase\s*order|customer\s*order|shift|impression|ups|performance|planned|achieved|summary|reel|mill|gsm|paper|material|scan|barcode|delivery|courier)\b/i.test(
    text,
  );
}

function isERPQuestion(text = "") {
  const value = text.toLowerCase();

  return hasERPIdentifier(text) || Object.keys(KEYWORD_TOOL_MAP).some((word) => value.includes(word));
}

// Returns a narrowed `tools` array containing only the function declarations
// relevant to the question. Falls back to the full catalog if, for some
// reason, no keyword matched (shouldn't happen since isERPQuestion already
// gates on the same keyword set) so behavior never regresses to "no tools".
function getRelevantTools(text = "") {
  const value = text.toLowerCase();
  const relevantNames = new Set();
  const hasWorkOrderIdentifier = /\b(?:wo|efi|work\s*order)\s*#?\s*[:\-]?\s*\d{3,}\b/i.test(text);

  for (const [keyword, toolNames] of Object.entries(KEYWORD_TOOL_MAP)) {
    if (value.includes(keyword)) {
      toolNames.forEach((name) => relevantNames.add(name));
    }
  }

  if (/\bPR[_-]?\d+\b/i.test(text)) {
    relevantNames.add("query_printing_instructions");
    relevantNames.add("query_customer_orders");
  }

  if (hasWorkOrderIdentifier) {
    [
      "query_work_orders",
      "query_schedule",
      "query_production",
      "query_production_real",
      "query_production_summary",
      "query_production_real_summary",
      "query_dispatch",
      "query_printing_instructions",
      "query_customer_orders",
    ].forEach((name) => relevantNames.add(name));
  }

  // A plain "WO 123 status/details/customer/qty" question should not send the
  // full cross-module work-order catalog to Gemini. Other intent words below
  // still widen the tool set for schedule, production, dispatch, etc.
  if (hasWorkOrderIdentifier && !hasCrossModuleWorkOrderIntent(text)) {
    relevantNames.clear();
    relevantNames.add("query_work_orders");
  }

  if (/\b(?:po|purchase\s*order)\s*#?\s*[:\-]?\s*[a-z0-9/_-]{3,}\b/i.test(text)) {
    [
      "query_customer_orders",
      "query_work_orders",
      "query_printing_instructions",
      "query_po_detail_records",
      "query_manual_boxes",
      "query_scan_logs",
      "query_dispatch",
    ].forEach((name) => relevantNames.add(name));
  }

  if (/\b(?:invoice|tracking|courier)\b/i.test(text)) {
    relevantNames.add("query_dispatch");
  }

  if (/\bbarcode\b/i.test(text)) {
    relevantNames.add("query_scan_logs");
  }

  if (/\bindent\b/i.test(text)) {
    relevantNames.add("query_indent_requests");
  }

  if (relevantNames.size === 0) return tools;

  const allDeclarations = tools[0]?.functionDeclarations || [];
  const filtered = allDeclarations.filter((decl) => relevantNames.has(decl.name));

  return filtered.length ? [{ functionDeclarations: filtered }] : tools;
}

function getWorkOrderNumber(text = "") {
  const match =
    text.match(/\b(?:work\s*order|wo|efi)\s*#?\s*[:\-]?\s*(\d+)\b/i) ||
    text.match(/\b(\d{3,})\b/);

  return match ? Number(match[1]) : null;
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString("en-IN") : "0";
}

function formatDate(value) {
  if (!value) return "not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function workOrderDetailsReply(wo) {
  return [
    `Work Order ${wo.efiWoNumber}:`,
    `Status: ${wo.status || "not available"}`,
    `Customer: ${wo.customer || "not available"}`,
    `Product: ${wo.productName || "not available"}`,
    `Product Code: ${wo.productCode || "not available"}`,
    `PO Number: ${wo.purchaseOrderNo || "not available"}`,
    `Total Quantity: ${formatNumber(wo.totalQty)}`,
    `Planned Qty: ${formatNumber(wo.qtyInLvs)}`,
    `Priority: ${wo.priority || "not available"}`,
    `Location: ${wo.location || "not available"}`,
    `Expected Delivery: ${formatDate(wo.expectedDeliveryDate)}`,
  ].join("\n");
}

async function fastScheduleReply(efiWoNumber) {
  const workOrder = await WorkOrder.findOne({ efiWoNumber }).select("_id efiWoNumber status").lean();
  const clauses = [{ efiWoNumber }];

  if (workOrder?._id) {
    clauses.push({ workOrderId: workOrder._id });
  }

  const schedules = await Schedule.find({ $or: clauses })
    .sort("startTime")
    .limit(5)
    .populate({ path: "machineId", select: "machineName" })
    .lean();

  if (!schedules.length) {
    if (workOrder) {
      return `No schedule entry was found for work order ${efiWoNumber}. It has not been assigned a schedule date or time yet. Current status: ${
        workOrder.status || "not available"
      }.`;
    }

    return `No work order or schedule entry was found for ${efiWoNumber}.`;
  }

  const lines = [`Schedule for work order ${efiWoNumber}:`];

  schedules.forEach((schedule, index) => {
    const machineName =
      schedule.machineId?.machineName || schedule.machineName || String(schedule.machineId || "not available");
    const prefix = schedules.length > 1 ? `Slot ${index + 1}: ` : "";

    lines.push(`${prefix}Start: ${formatDateTime(schedule.startTime)}`);
    lines.push(`${prefix}End: ${formatDateTime(schedule.endTime)}`);
    lines.push(`${prefix}Machine: ${machineName}`);
  });

  return lines.join("\n");
}

async function fastDispatchQtyReply(efiWoNumber, text) {
  const dispatch = await Dispatch.findOne({ efiWoNumber })
    .sort("-createdAt")
    .select("efiWoNumber totalQty balanceQty dispatchQty extraQty invoiceNo dispatchDate")
    .lean();

  if (!dispatch) {
    return `No dispatch entry was found for work order ${efiWoNumber}.`;
  }

  if (text.includes("balance")) {
    return `The balance quantity to dispatch for work order ${dispatch.efiWoNumber} is ${formatNumber(
      dispatch.balanceQty,
    )}.`;
  }

  if (text.includes("dispatch qty") || text.includes("dispatch quantity") || text.includes("dispatched")) {
    return `The latest dispatch quantity for work order ${dispatch.efiWoNumber} is ${formatNumber(
      dispatch.dispatchQty,
    )}.`;
  }

  return [
    `Dispatch quantity details for work order ${dispatch.efiWoNumber}:`,
    `Order Quantity: ${formatNumber(dispatch.totalQty)}`,
    `Dispatch Quantity: ${formatNumber(dispatch.dispatchQty)}`,
    `Balance Quantity: ${formatNumber(dispatch.balanceQty)}`,
    `Extra Quantity: ${formatNumber(dispatch.extraQty)}`,
  ].join("\n");
}

async function fastERPReply(userText) {
  const text = String(userText || "").toLowerCase();
  const efiWoNumber = getWorkOrderNumber(userText);

  if (!efiWoNumber) return null;

  if (/\b(schedule|scheduled|scheduler|gantt|assigned|time|machine)\b/i.test(userText)) {
    return fastScheduleReply(efiWoNumber);
  }

  if (/\b(dispatch|dispatched|balance)\b/i.test(userText)) {
    return fastDispatchQtyReply(efiWoNumber, text);
  }

  if (hasCrossModuleWorkOrderIntent(userText)) return null;

  const asksOrderQuantity =
    text.includes("order qty") ||
    text.includes("order quantity");

  if (asksOrderQuantity) {
    const wo = await WorkOrder.findOne({ efiWoNumber })
      .select("efiWoNumber totalQty")
      .lean();

    if (!wo) return `No work order found for ${efiWoNumber}.`;

    return `The order quantity for work order ${wo.efiWoNumber} is ${formatNumber(wo.totalQty)}.`;
  }

  const asksQuantity =
    text.includes("total qty") ||
    text.includes("total quantity") ||
    /\bqty\b/.test(text);

  if (asksQuantity) {
    const wo = await WorkOrder.findOne({ efiWoNumber })
      .select("efiWoNumber totalQty")
      .lean();

    if (!wo) return `No work order found for ${efiWoNumber}.`;

    return `The total quantity for work order ${wo.efiWoNumber} is ${Number(
      wo.totalQty || 0,
    ).toLocaleString("en-IN")}.`;
  }

  const asksStatus = text.includes("status");
  const asksCustomer = hasAny(text, ["customer", "client"]);
  const asksProduct = hasAny(text, ["product", "item", "job"]);
  const asksPo = /\bpo\b/.test(text) || text.includes("purchase order");
  const asksPriority = text.includes("priority");
  const asksLocation = text.includes("location");
  const asksDelivery = hasAny(text, ["delivery", "expected date", "due date"]);
  const asksDetails = hasAny(text, ["detail", "details", "show", "tell me", "information", "info"]) || /^\s*(?:wo|efi|work\s*order)?\s*#?\s*\d{3,}\s*$/i.test(userText);

  if (asksStatus) {
    const wo = await WorkOrder.findOne({ efiWoNumber })
      .select("efiWoNumber status")
      .lean();

    if (!wo) return `No work order found for ${efiWoNumber}.`;

    return `The status for work order ${wo.efiWoNumber} is ${wo.status || "not available"}.`;
  }

  if (asksCustomer || asksProduct || asksPo || asksPriority || asksLocation || asksDelivery || asksDetails) {
    const wo = await WorkOrder.findOne({ efiWoNumber })
      .select(
        "efiWoNumber status customer productName productCode purchaseOrderNo totalQty qtyInLvs priority location expectedDeliveryDate",
      )
      .lean();

    if (!wo) return `No work order found for ${efiWoNumber}.`;

    if (asksCustomer && !asksDetails) {
      return `The customer for work order ${wo.efiWoNumber} is ${wo.customer || "not available"}.`;
    }

    if (asksProduct && !asksDetails) {
      return `The product for work order ${wo.efiWoNumber} is ${wo.productName || "not available"}.`;
    }

    if (asksPo && !asksDetails) {
      return `The PO number for work order ${wo.efiWoNumber} is ${wo.purchaseOrderNo || "not available"}.`;
    }

    if (asksPriority && !asksDetails) {
      return `The priority for work order ${wo.efiWoNumber} is ${wo.priority || "not available"}.`;
    }

    if (asksLocation && !asksDetails) {
      return `The location for work order ${wo.efiWoNumber} is ${wo.location || "not available"}.`;
    }

    if (asksDelivery && !asksDetails) {
      return `The expected delivery date for work order ${wo.efiWoNumber} is ${formatDate(
        wo.expectedDeliveryDate,
      )}.`;
    }

    return workOrderDetailsReply(wo);
  }

  return null;
}

async function generateWithRetry(params, maxRetries = 0) {
  let lastErr;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await genAI.models.generateContent(params);
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.error?.code;
      const isRetryable = RETRYABLE_STATUSES.includes(status);

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      const delay = 700 * Math.pow(2, attempt);
      console.warn(
        `Gemini call failed (status ${status}), retrying in ${delay}ms... (attempt ${
          attempt + 1
        }/${maxRetries})`,
      );
      await sleep(delay);
    }
  }

  throw lastErr;
}

router.post("/api/chat", async (req, res) => {
  const requestStart = Date.now();

  try {
    const { messages = [] } = req.body;
    let contents = [...messages];
    const userText = getLastUserText(messages);
    const routingText = getRecentUserText(messages, 3);
    const shouldUseTools = isERPQuestion(routingText);

    const fastReply = shouldUseTools ? await fastERPReply(userText) : null;
    const relevantTools = shouldUseTools ? getRelevantTools(routingText) : tools;

    if (fastReply) {
      console.log(`[chat] fastERPReply total ${Date.now() - requestStart}ms`);

      const nextMessages = [
        ...messages,
        { role: "model", parts: [{ text: fastReply }] },
      ];

      return res.json({
        reply: fastReply,
        messages: nextMessages,
      });
    }

    const maxToolLoops = shouldUseTools ? 2 : 1;

    for (let i = 0; i < maxToolLoops; i++) {
      // Only offer tools while a tool call is still a legitimate option.
      // On the final allowed iteration (or once we've already used a turn to
      // call a tool), force a plain text answer instead of re-parsing the
      // entire ~30-tool catalog against the question again - that re-eval
      // plus an unbounded thinking budget was the main source of the 90s+ stall.
      const isFinalIteration = i === maxToolLoops - 1;
      const offerTools = shouldUseTools && !isFinalIteration;

      const llmStart = Date.now();
      const response = await generateWithRetry({
        model: "gemini-3.5-flash-lite",
        contents,
        config: offerTools
          ? {
              systemInstruction,
              tools: relevantTools,
              maxOutputTokens: 500,
              ...NO_THINKING,
            }
          : {
              systemInstruction,
              maxOutputTokens: 500,
              ...NO_THINKING,
            },
      });
      console.log(`[chat] Gemini call #${i + 1} took ${Date.now() - llmStart}ms`);
      if (response.usageMetadata) {
        console.log(`[chat] Gemini call #${i + 1} usage:`, response.usageMetadata);
        console.log(
          `[chat] Gemini call #${i + 1} thoughts tokens:`,
          response.usageMetadata.thoughtsTokenCount ?? 0,
        );
      }

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      contents.push({ role: "model", parts });

      const functionCalls = offerTools
        ? parts.filter((part) => part.functionCall)
        : [];

      if (functionCalls.length === 0) {
        const text = parts.map((part) => part.text || "").join("");
        console.log(`[chat] request total ${Date.now() - requestStart}ms`);

        return res.json({
          reply: text,
          messages: contents,
        });
      }

      const responseParts = await Promise.all(
        functionCalls.map(async (part) => {
          const { name, args } = part.functionCall;
          const executor = toolExecutors[name];

          let result;
          const toolStart = Date.now();

          try {
            result = executor
              ? await executor(args)
              : { error: `Unknown tool: ${name}` };
          } catch (err) {
            console.error(`Tool ${name} failed:`, err);
            result = { error: err.message };
          }

          console.log(`[chat] Tool ${name} took ${Date.now() - toolStart}ms`);

          return {
            functionResponse: {
              name,
              response: {
                result,
              },
            },
          };
        }),
      );

      contents.push({
        role: "user",
        parts: responseParts,
      });
    }

    res.status(500).json({
      error: "Too many tool iterations without a final answer",
    });
  } catch (err) {
    console.error("Chat endpoint error:", err);

    const status = err?.status || err?.error?.code;

    if (status === 429) {
      return res.status(429).json({
        error:
          "The assistant quota is temporarily exhausted. Please try again later.",
      });
    }

    if (status === 503) {
      return res.status(503).json({
        error:
          "The assistant is experiencing high demand right now. Please try again in a moment.",
      });
    }

    res.status(500).json({
      error: "Something went wrong processing your message",
    });
  }
});

module.exports = router;
