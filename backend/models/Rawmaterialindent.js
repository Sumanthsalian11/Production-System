const mongoose = require("mongoose");
const { Schema } = mongoose;
const opt = { versionKey: false };
const make = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

/* ---------- MB5B stock rows (one row per sheet line; summed at read time) ---------- */
const stockSchema = new Schema(
  {
    batch: { type: Schema.Types.ObjectId, index: true }, // upload batch (old batch is deleted only after the new one is fully in)
    material: String, // cleaned SAP code
    plant: String,
    desc: String,
    type: String, // Material Type  -> "family"
    matGroup: String, // Material Group
    spec: String, // optional "Spec group" column from the sheet
    uom: String, // base unit, upper case
    qty: Number, // closing stock
    group: String, // resolved spec group (override > sheet spec group > GSM + material group)
  },
  opt
);
stockSchema.index({ group: 1, material: 1 });
stockSchema.index({ material: 1 });

/* ---------- ME2N pending PO lines ---------- */
const poSchema = new Schema(
  {
    batch: { type: Schema.Types.ObjectId, index: true },
    poNo: String,
    item: String,
    material: String,
    plant: String,
    desc: String,
    uom: String,
    vendor: String,
    qty: Number, // still to be delivered
    eta: String, // yyyy-mm-dd
    group: String,
    type: String, // copied from the stock sheet when the material exists there
  },
  opt
);
poSchema.index({ material: 1 });
poSchema.index({ group: 1, eta: 1 });

/* ---------- Pre-computed (group x plant) totals. Rebuilt after every import / rule change,
   so the planning board never scans the raw rows. ---------- */
const summarySchema = new Schema(
  {
    rev: { type: Schema.Types.ObjectId },
    group: String,
    plant: String,
    fam: String,
    lead: String,
    mats: Number,
    stock: Number,
    pending: Number,
  },
  opt
);
summarySchema.index({ rev: 1, group: 1 });

/* ---------- Job demand ---------- */
const jobSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    groupGroupId: { type: String, required: true, index: true }, // spec group name
    kg: { type: Number, default: 0 },
  },
  { ...opt, timestamps: true }
);

/* ---------- Plant demand split per spec group ---------- */
const splitSchema = new Schema({ group: String, plant: String, pct: Number }, opt);
splitSchema.index({ group: 1, plant: 1 }, { unique: true });

/* ---------- Manual spec group per material ---------- */
const overrideSchema = new Schema({ material: { type: String, unique: true }, group: String }, opt);

/* ---------- Settings (single document) ---------- */
const settingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: "main" },
    workingDays: { type: Number, default: 26 },
    targetCoverDays: { type: Number, default: 30 },
    criticalDays: { type: Number, default: 12 },
    lowDays: { type: Number, default: 22 },
    overstockDays: { type: Number, default: 60 },
    lotSize: { type: Number, default: 500 },
    leadTimeDays: { type: Number, default: 10 },
    mainPlant: { type: String, default: "" },
    planningUnits: { type: [String], default: ["KG", "KGS"] }, // only rows in these units are planned
    materialTypes: { type: [String], default: [] }, // empty = all material types
    familyLots: { type: [{ family: String, lot: Number, _id: false }], default: [] }, // lot rounding per family
    indentSeq: { type: Number, default: 1000 },
    summaryRev: { type: Schema.Types.ObjectId },
    imports: { type: Schema.Types.Mixed, default: {} }, // last applied upload per sheet type
  },
  opt
);

/* ---------- Cart + register ---------- */
const lineShape = {
  groupId: String,
  plant: String,
  qty: Number,
  vendor: { type: String, default: "" },
  requiredBy: String,
  notes: { type: String, default: "" },
};
const cartSchema = new Schema({ owner: { type: String, index: true }, ...lineShape }, { ...opt, timestamps: true });
cartSchema.index({ owner: 1, groupId: 1, plant: 1 }, { unique: true });

const registerSchema = new Schema(
  {
    indentNo: { type: String, unique: true },
    owner: String,
    date: String,
    status: { type: String, default: "Draft" },
    lines: [new Schema(lineShape, { _id: false })],
    totalKG: Number,
  },
  { ...opt, timestamps: true }
);

module.exports = {
  IndentStock: make("IndentStock", stockSchema),
  IndentPO: make("IndentPO", poSchema),
  IndentSummary: make("IndentSummary", summarySchema),
  IndentJob: make("IndentJob", jobSchema),
  IndentSplit: make("IndentSplit", splitSchema),
  IndentOverride: make("IndentOverride", overrideSchema),
  IndentSettings: make("IndentSettings", settingsSchema),
  IndentCart: make("IndentCart", cartSchema),
  IndentRegister: make("IndentRegister", registerSchema),
};