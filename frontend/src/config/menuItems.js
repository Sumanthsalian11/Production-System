// Single source of truth for sidebar modules + role access.
// Used by DashboardLayout.jsx (to render/filter the sidebar)
// and InternalRegister.jsx (to build the per-user module picker).

const menuItems = [
  { to: "/internal-register", icon: "bi-person-plus", label: "User Register", roles: ["admin"] },
  { to: "/admin", icon: "bi-grid", label: "Masters", roles: ["admin"] },
  { to: "/new-in", icon: "bi-grid", label: "Secure Printings", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/customer-dashboard", icon: "bi-card-list", label: "Purchase Orders", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/planner", icon: "bi-calendar-check", label: "Planning", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/production", icon: "bi-receipt-cutoff", label: "Reel Register", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/waste", icon: "bi-box-seam", label: "Reel Waste Reports", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/summary", icon: "bi-bar-chart", label: "Reel Reports", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/production-real", icon: "bi-gear-fill", label: "Production", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/production-report", icon: "bi-bar-chart", label: "Production Report", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/dispatch", icon: "bi-truck", label: "Dispatch Management", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/scheduler", icon: "bi-printer", label: "Scheduler", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/print", icon: "bi-printer", label: "Printing Instructions", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  // { to: "/manual-box", icon: "bi-file-earmark-spreadsheet", label: "Excel Upload", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  // { to: "/po-details", icon: "bi-box-seam", label: "Dispatch Entry", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  // { to: "/scan", icon: "bi-qr-code-scan", label: "Dispatch Scan", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/perso", icon: "bi-gear-fill", label: "Perso Production", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/perso-report", icon: "bi-bar-chart", label: "Perso Report", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/perso-machine-report", icon: "bi-file-earmark-text", label: "Perso Detailed Report", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/shredding", icon: "bi-scissors", label: "Shredding", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/inward-register", icon: "bi-journal-plus", label: "Inward Register", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/plate-request", icon: "bi-file-earmark-plus", label: "Plate Request", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/preprocess", icon: "bi-gear-wide-connected", label: "Prepress", roles: ["admin", "prepress", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner"] },
  { to: "/ocr-scan", icon: "bi-file-earmark-text", label: "OCR Scan", roles: ["admin", "prepress", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner"] },
  { to: "/billing-report", icon: "bi-file-earmark-spreadsheet", label: "Billing Report", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/welcome-board", icon: "bi-card-image", label: "Welcome Board", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/kas", icon: "bi-palette", label: "Artwork Ticket", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/inventory-dashboard", icon: "bi-boxes", label: "Inventory Dashboard", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/receiving-inspection", icon: "bi-card-checklist", label: "Quality Control", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/production-portal", icon: "bi-gear-fill", label: "Overall Summary", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/click-report", icon: "bi-graph-up", label: "Click Report", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
  { to: "/certificate-numbering", icon: "bi-file-earmark-text", label: "Special Job", roles: ["admin", "indenter", "kas", "planner", "purchase order", "supervisor","dispatch","production","scanner","prepress"] },
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