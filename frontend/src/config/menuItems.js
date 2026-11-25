// Single source of truth for sidebar modules + role access.
// Used by DashboardLayout.jsx (to render/filter the sidebar)
// and InternalRegister.jsx (to build the per-user module picker).

const menuItems = [
  { to: "/internal-register", icon: "bi-person-plus", label: "User Register", roles: ["admin"] },
  { to: "/admin", icon: "bi-grid", label: "Masters", roles: ["admin"] },
  { to: "/new-in", icon: "bi-grid", label: "Stationary Indent", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
   { to: "/artwork-repository", icon: "bi-images", label: "Artwork Repository", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/customer-dashboard", icon: "bi-card-list", label: "Order Management", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/planner", icon: "bi-calendar-check", label: "Planning", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/production", icon: "bi-receipt-cutoff", label: "Reel Register", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/waste", icon: "bi-box-seam", label: "Reel Waste Reports", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/summary", icon: "bi-bar-chart", label: "Reel Reports", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/production-real", icon: "bi-gear-fill", label: "Production", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/production-report", icon: "bi-bar-chart", label: "Production Report", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/dispatch", icon: "bi-truck", label: "Dispatch Management", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/scheduler", icon: "bi-printer", label: "Scheduler", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/print", icon: "bi-printer", label: "Printing Instructions", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  // { to: "/manual-box", icon: "bi-file-earmark-spreadsheet", label: "Excel Upload", roles: ["admin", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  // { to: "/po-details", icon: "bi-box-seam", label: "Dispatch Entry", roles: ["admin", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  // { to: "/scan", icon: "bi-qr-code-scan", label: "Dispatch Scan", roles: ["admin", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/perso", icon: "bi-gear-fill", label: "Perso Production", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/perso-report", icon: "bi-bar-chart", label: "Perso Report", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/perso-machine-report", icon: "bi-file-earmark-text", label: "Perso Detailed Report", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/shredding", icon: "bi-scissors", label: "Shredding", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/inward-register", icon: "bi-journal-plus", label: "Inward Register", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/plate-request", icon: "bi-file-earmark-plus", label: "Plate Request", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/preprocess", icon: "bi-gear-wide-connected", label: "Prepress", roles: ["admin", "prepress", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/ocr-scan", icon: "bi-file-earmark-text", label: "OCR Scan", roles: ["admin", "prepress", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/billing-report", icon: "bi-file-earmark-spreadsheet", label: "Billing Report", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/welcome-board", icon: "bi-card-image", label: "Welcome Board", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/kas", icon: "bi-palette", label: "Artwork Ticket", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/inventory-dashboard", icon: "bi-boxes", label: "Inventory Dashboard", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/receiving-inspection", icon: "bi-card-checklist", label: "Quality Control", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/production-portal", icon: "bi-gear-fill", label: "Overall Summary", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/click-report", icon: "bi-graph-up", label: "Click Report", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/customer-onboarding", icon: "bi-person-check", label: "Customer Onboarding", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/certificate-numbering", icon: "bi-file-earmark-text", label: "Special Job", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  { to: "/job-validation", icon: "bi-clipboard2-data", label: "Job Validation", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"] },
  {to:"/raw-material-indent", icon: "bi-file-earmark-plus", label: "Raw Material Indent", roles: ["admin", "kas", "planner", "order management", "supervisor","dispatch","production"]},
];

export const BASE_ROLES = [
  { value: "ADMIN", label: "Admin" },
  { value: "PLANNER", label: "Planner" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "PRODUCTION", label: "Production" },
  { value: "ORDER MANAGEMENT", label: "Order Management" },
  { value: "DISPATCH", label: "Dispatch" },
  { value: "KAS", label: "KAS" },
];

// Returns the modules a given role (e.g. "PLANNER", case-insensitive) can access
export const getModulesForRole = (role) => {
  if (!role) return [];
  const normalized = role.toLowerCase();
  return menuItems.filter((item) => item.roles.includes(normalized));
};

// Returns every module in the system, regardless of role — used when
// admin wants to assign ANY module to ANY user, not just role-matched ones.
export const getAllModules = () => menuItems;

export const getModuleLabel = (to) => {
  const item = menuItems.find((m) => m.to === to);
  return item ? item.label : to;
};

export default menuItems;