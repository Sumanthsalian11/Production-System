const mongoose = require("mongoose");

// One row per SAP movement line. Short field names on purpose: this collection can hold millions of lines.
//  ds=dataset  d=posting date  cu=customer  cd=card description (as in SAP)  de=card description (normalised)
//  mt=movement type  st=stock type  pc=product category  fr=from location  to=to location
//  q=quantity  rk=rack no  dl=deletion flag
const SapMovementSchema = new mongoose.Schema(
  {
    ds: { type: mongoose.Schema.Types.ObjectId, ref: "SapDataset", required: true },
    d: { type: String, required: true },
    cu: { type: String, default: "" },
    cd: { type: String, default: "" },
    de: { type: String, default: "" },
    mt: { type: String, default: "" },
    st: { type: String, default: "" },
    pc: { type: String, default: "" },
    fr: { type: String, default: "" },
    to: { type: String, default: "" },
    q: { type: Number, default: 0 },
    rk: { type: String, default: "" },
    dl: { type: Boolean, default: false },
  },
  { collection: "sap_movements", versionKey: false }
);

SapMovementSchema.index({ ds: 1, d: 1 });
SapMovementSchema.index({ ds: 1, d: 1, de: 1 });

module.exports = mongoose.models.SapMovement || mongoose.model("SapMovement", SapMovementSchema);
