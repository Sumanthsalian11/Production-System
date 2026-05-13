const mongoose = require("mongoose");
const XLSX = require("xlsx");
mongoose.connect("mongodb://127.0.0.1:27017/production-system");

// ✅ USE SAME MODEL NAME
const locationSchema = new mongoose.Schema({
  locationName: { type: String, required: true },
  address: { type: String, required: true }
});

const Location = mongoose.model("LocationMaster", locationSchema);

// Read Excel
const workbook = XLSX.readFile("Location.xlsx");
const sheet = workbook.Sheets["Sheet1"];
const data = XLSX.utils.sheet_to_json(sheet);

// Import
async function importData() {
  try {
    await Location.deleteMany();

    const formatted = data.map(row => ({
      locationName: row["Location"],
      address: row["Delivery Address"]   // ⚠️ check spelling
    }));

    await Location.insertMany(formatted);

    console.log("✅ Location Excel Imported Successfully");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

importData();