import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

import axios from "axios";
import BASE_URL from "../config/api";
export default function DashboardLayout() {

  const [loggedInUser, setLoggedInUser] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
const [showChangePassword, setShowChangePassword] = useState(false);
const [cpForm, setCpForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
const [cpErrors, setCpErrors] = useState({});
const [showCurrent, setShowCurrent] = useState(false);
const [showNew, setShowNew] = useState(false);
const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Detect screen size
  useEffect(() => {

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) setCollapsed(true);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const token = localStorage.getItem("token");

    if (token) {
      const decoded = jwtDecode(token);
      setLoggedInUser((decoded.role || "user").toLowerCase());
    }

    return () => window.removeEventListener("resize", handleResize);

  }, []);

  const handleChangePassword = async () => {
  const newErrors = {};
  if (!cpForm.currentPassword) newErrors.currentPassword = "Required";
  if (!cpForm.newPassword) newErrors.newPassword = "Required";
  else if (cpForm.newPassword.length < 12) newErrors.newPassword = "Min 12 characters";
  if (!cpForm.confirmPassword) newErrors.confirmPassword = "Required";
  else if (cpForm.newPassword !== cpForm.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
  setCpErrors(newErrors);
  if (Object.keys(newErrors).length > 0) return;

  try {
    const token = localStorage.getItem("token");
    await axios.put(
      `${BASE_URL}/api/auth/change-password`,
      { currentPassword: cpForm.currentPassword, newPassword: cpForm.newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    alert("Password changed successfully!");
    setCpForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setCpErrors({});
    setShowChangePassword(false);
  } catch (err) {
    alert(err.response?.data?.message || "Failed to change password");
  }
};

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const sidebarWidth = collapsed ? "80px" : "240px";

  // Menu items with role permissions
  const menuItems = [
    { to: "/admin", icon: "bi-grid", label: "Masters", roles: ["admin"] },
     { to: "/internal/register", icon: "bi-person-plus", label: "User Register", roles: ["admin"] },

    { to: "/customer-dashboard", icon: "bi-card-list", label: "Purchase Orders", roles: ["admin", "planner","purchase order"] },

    { to: "/planner", icon: "bi-calendar-check", label: "Planning", roles: ["admin", "planner"] },

    { to: "/production", icon: "bi-receipt-cutoff", label: "Reel Register", roles: ["admin","production"] },

     { to: "/production-real", icon: "bi-gear-fill", label: "Production", roles: ["admin","production"] },

    { to: "/waste", icon: "bi-box-seam", label: "Reel Waste Reports", roles: ["admin","production","supervisor"] },

    { to: "/summary", icon: "bi-bar-chart", label: "Reel Reports", roles: ["admin","production","supervisor"] },

   
    {
      to: "/production-report",icon:"bi-bar-chart",label:"Production Report", roles:["admin","production","supervisor"]
    },

    { to: "/dispatch", icon: "bi-truck", label: "Dispatch Management", roles: ["admin","dispatch"] },

    { to: "/print", icon: "bi-printer", label: "Printing Instructions", roles: ["admin","printing"] },
  //  { to: "/scheduler", icon: "bi-printer", label: "scheduler", roles: ["admin"] },
  ];

  // Filter menu based on role
  const filteredMenu = menuItems.filter((item) =>
    item.roles.includes(loggedInUser)
  );

  // Dynamic Dashboard Title
const getDashboardTitle = () => {
  const path = location.pathname;

  let title = "Admin Dashboard";

  if (path.startsWith("/internal/register")) title = "User Registration";
  else if (path.startsWith("/planner")) title = "Planner Dashboard";
  else if (path.startsWith("/production-real")) title = "Production Dashboard";
  else if (path.startsWith("/production")) title = "Reel Register Dashboard";
  else if (path.startsWith("/waste")) title = "Waste Management Dashboard";
  else if (path.startsWith("/summary")) title = "Reports Dashboard";
  else if (path.startsWith("/dispatch")) title = "Dispatch Dashboard";
  else if (path.startsWith("/customer-dashboard")) title = "Purchase Orders Dashboard";
  else if (path.startsWith("/admin")) title = "Masters Dashboard";
  else if (path.startsWith("/production-report")) title = "Production Report Dashboard";
  else if (path.startsWith("/print")) title = "Printing Instructions Dashboard";

  return (
    <div className="d-flex align-items-center gap-3">
      <img
        src="/Logo.png"
        alt="logo"
        style={{
          height: "40px",   // ✅ FIXED (important)
          width: "auto",
          objectFit: "contain"
        }}
      />
      <span>{title}</span>
    </div>
  );
};

  return (
    <div className="d-flex" style={{ overflowX: "hidden" }}>

      {/* MOBILE OVERLAY */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 1040
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className="bg-dark text-white position-fixed d-flex flex-column shadow-lg"
        style={{
          width: sidebarWidth,
          transition: "all 0.3s ease",
          zIndex: 1050,
          left: isMobile ? (collapsed ? "-240px" : "0") : "0",
          top: 0,
          height: "100vh",
          overflowY: "auto"
        }}
      >

       

        {/* MENU */}
        <nav className="nav flex-column align-items-center p-2 gap-2 flex-grow-1">

          {filteredMenu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => isMobile && setCollapsed(true)}
              className={({ isActive }) =>
                `nav-link w-100 text-center d-flex flex-column align-items-center justify-content-center rounded py-2 ${
                  isActive ? "bg-primary text-white shadow-sm" : "text-white"
                }`
              }
            >
              <i className={`bi ${item.icon} fs-5`}></i>
              {!collapsed && <small className="mt-1">{item.label}</small>}
            </NavLink>
          ))}

        </nav>

        {/* FOOTER */}
        <div className="p-3 border-top border-secondary text-center">

          {!collapsed && (
            <>
              <div className="small text-secondary">Logged in as</div>
              <div className="fw-semibold mb-2 text-capitalize">
                {loggedInUser}
              </div>
            </>
          )}

          <button
            onClick={logout}
            className="btn btn-danger w-100 fw-semibold"
          >
            <i className="bi bi-box-arrow-right"></i>
            {!collapsed && " Logout"}
          </button>

        </div>

      </aside>

      {/* MAIN AREA */}
      <div
        className="flex-grow-1"
        style={{
          marginLeft: isMobile ? "0" : sidebarWidth,
          transition: "margin-left 0.3s ease",
          width: "100%",
          minHeight: "100vh",
          overflowX: "hidden"
        }}
      >

        {/* TOPBAR */}
        <div
          className="bg-white shadow-sm px-3 px-md-4 py-3 d-flex justify-content-between align-items-center sticky-top"
          style={{ zIndex: 1030 }}
        >

          <div className="d-flex align-items-center gap-3">

            <button
              className="btn btn-light border"
              onClick={() => setCollapsed(!collapsed)}
            >
              <i className="bi bi-list"></i>
            </button>

            <h5 className="mb-0 fw-semibold text-secondary d-none d-sm-block">
              {getDashboardTitle()}
            </h5>

          </div>

          {/* PROFILE */}
          <div className="dropdown">

            <button
              className="btn btn-light border dropdown-toggle"
              data-bs-toggle="dropdown"
            >
              <i className="bi bi-person-circle"></i>
            </button>

            <ul className="dropdown-menu dropdown-menu-end shadow">

              <li className="dropdown-item-text fw-semibold text-capitalize">
                {loggedInUser}
              </li>

              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
  <button className="dropdown-item" onClick={() => setShowChangePassword(true)}>
    🔐 Change Password
  </button>
</li>

              <li>
                <button
                  className="dropdown-item text-danger"
                  onClick={logout}
                >
                  Logout
                </button>
              </li>

            </ul>

          </div>

        </div>

        {/* PAGE CONTENT */}
        <div
          className="p-3 p-md-4 bg-light"
          style={{ minHeight: "calc(100vh - 70px)" }}
          
        >
          <Outlet />
        </div>

      </div>
      {/* CHANGE PASSWORD MODAL */}
{showChangePassword && (
  <>
    <div
      onClick={() => setShowChangePassword(false)}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1050 }}
    />
    <div style={{
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)", zIndex: 1055,
      width: "100%", maxWidth: "420px",
      background: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(12px)", borderRadius: "16px",
      border: "2px solid #000",
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)", padding: "30px"
    }}>
      <h5 className="text-center fw-bold mb-4">🔐 Change Password</h5>

      {/* Current Password */}
      <div className="mb-3">
        <label className="form-label fw-semibold">Current Password</label>
        <div className="input-group">
          <input
            type={showCurrent ? "text" : "password"}
            className={`form-control border-dark ${cpErrors.currentPassword ? "is-invalid" : ""}`}
            value={cpForm.currentPassword}
            onChange={(e) => setCpForm(p => ({ ...p, currentPassword: e.target.value }))}
            placeholder="Enter current password"
          />
          <button type="button" className="btn btn-outline-secondary"
            onClick={() => setShowCurrent(p => !p)}>
            {showCurrent ? "👁️" : "🙈"}
          </button>
          {cpErrors.currentPassword && <div className="invalid-feedback">{cpErrors.currentPassword}</div>}
        </div>
      </div>

      {/* New Password */}
      <div className="mb-3">
        <label className="form-label fw-semibold">New Password</label>
        <div className="input-group">
          <input
            type={showNew ? "text" : "password"}
            className={`form-control border-dark ${cpErrors.newPassword ? "is-invalid" : ""}`}
            value={cpForm.newPassword}
            onChange={(e) => setCpForm(p => ({ ...p, newPassword: e.target.value }))}
            placeholder="Min 12 characters"
          />
          <button type="button" className="btn btn-outline-secondary"
            onClick={() => setShowNew(p => !p)}>
            {showNew ? "👁️" : "🙈"}
          </button>
          {cpErrors.newPassword && <div className="invalid-feedback">{cpErrors.newPassword}</div>}
        </div>
      </div>

      {/* Confirm Password */}
      <div className="mb-4">
        <label className="form-label fw-semibold">Confirm New Password</label>
        <div className="input-group">
          <input
            type={showConfirm ? "text" : "password"}
            className={`form-control border-dark ${cpErrors.confirmPassword ? "is-invalid" : ""}`}
            value={cpForm.confirmPassword}
            onChange={(e) => setCpForm(p => ({ ...p, confirmPassword: e.target.value }))}
            placeholder="Re-enter new password"
          />
          <button type="button" className="btn btn-outline-secondary"
            onClick={() => setShowConfirm(p => !p)}>
            {showConfirm ? "👁️" : "🙈"}
          </button>
          {cpErrors.confirmPassword && <div className="invalid-feedback">{cpErrors.confirmPassword}</div>}
        </div>
      </div>

      <div className="d-flex gap-2">
        <button className="btn btn-primary w-100" onClick={handleChangePassword}>
          Update Password
        </button>
        <button className="btn btn-secondary w-100" onClick={() => setShowChangePassword(false)}>
          Cancel
        </button>
      </div>
    </div>
  </>
)}

    </div>
  );
}