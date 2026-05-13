const mongoose = require("mongoose");
const XLSX = require("xlsx");
const Material = require("./models/Material");

// connect DB
mongoose.connect("mongodb://127.0.0.1:27017/production-system");

const workbook = XLSX.readFile("Paper Specs.xlsx");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

async function importData() {
  for (let row of data) {
    await Material.updateOne(
      { code: String(row.Material) },
      {
        code: String(row.Material),
        description: row["Material Description"],
        group: row["Material Group Desc."],
        mill: row["MILL"],
        gsm: row["GSM"],
        paperSize:row["Paper Size"]
      },
      { upsert: true }
    );
  }

  console.log("✅ Materials Imported Successfully");
  process.exit();
}

importData();