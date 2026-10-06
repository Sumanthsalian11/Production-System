const dateFilter = req.query.date;
const monthFilter = req.query.month;

let match = {};

if (dateFilter) {
  match.date = dateFilter;
}

if (monthFilter) {
  match.date = { $regex: monthFilter }; 
}
