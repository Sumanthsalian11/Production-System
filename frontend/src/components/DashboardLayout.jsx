import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import BASE_URL from "../config/api";
import menuItems from "../config/menuItems";

// 6 Organized Categories for the 3D App Launcher Grid (Admin Only)
const APP_CATEGORIES = [
  {
    title: "Admin & Setup",
    icon: "bi-shield-lock",
    color: "#0e7490",
    bgLight: "#ecfeff",
    borderGlow: "#a5f3fc",
    routes: ["/internal-register", "/admin"]
  },
  {
    title: "Planning & Prepress",
    icon: "bi-calendar2-range",
    color: "#2563eb",
    bgLight: "#eff6ff",
    borderGlow: "#bfdbfe",
    routes: ["/customer-dashboard", "/planner", "/scheduler", "/print", "/preprocess", "/plate-request", "/kas"]
  },
  {
    title: "Production",
    icon: "bi-gear-wide-connected",
    color: "#0369a1",
    bgLight: "#f0f9ff",
    borderGlow: "#bae6fd",
    routes: ["/new-in", "/production", "/production-real", "/perso", "/ocr-scan", "/shredding", "/click-report"]
  },
  {
    title: "Reports & Analytics",
    icon: "bi-bar-chart-line",
    color: "#db2777",
    bgLight: "#fdf2f8",
    borderGlow: "#fbcfe8",
    routes: ["/waste", "/summary", "/production-report", "/perso-report", "/perso-machine-report", "/billing-report", "/welcome-board", "/production-portal"]
  },
  {
    title: "Inward & Quality Control",
    icon: "bi-clipboard2-check",
    color: "#059669",
    bgLight: "#ecfdf5",
    borderGlow: "#a7f3d0",
    routes: ["/inward-register", "/receiving-inspection", "/inventory-dashboard", "/calibration", "/new-inspection", "/certificate-numbering"]
  },
  {
    title: "Dispatch & Logistics",
    icon: "bi-truck",
    color: "#7c3aed",
    bgLight: "#f5f3ff",
    borderGlow: "#ddd6fe",
    routes: ["/dispatch", "/manual-box", "/po-details", "/scan"]
  }
];

// Helper: Department branding & icon for non-admin roles (100% offline)
const getRoleTheme = (role) => {
  const r = (role || "").toLowerCase();
  if (r.includes("plan") || r.includes("sched")) {
    return { department: "Planning & Prepress", icon: "bi-calendar2-range-fill" };
  }
  if (r.includes("prod") || r.includes("operat")) {
    return { department: "Production Division", icon: "bi-gear-wide-connected" };
  }
  if (r.includes("disp") || r.includes("logis")) {
    return { department: "Dispatch & Logistics", icon: "bi-truck" };
  }
  if (r.includes("qc") || r.includes("qual") || r.includes("inspect")) {
    return { department: "Quality Inspection", icon: "bi-clipboard2-check-fill" };
  }
  if (r.includes("store") || r.includes("inven")) {
    return { department: "Inventory & Store", icon: "bi-boxes" };
  }
  if (r.includes("prep") || r.includes("print")) {
    return { department: "Prepress & Printing", icon: "bi-printer-fill" };
  }
  if (r.includes("perso")) {
    return { department: "Personalization Bureau", icon: "bi-credit-card-2-front-fill" };
  }
  if (r.includes("account") || r.includes("bill") || r.includes("report")) {
    return { department: "Reports & Accounts", icon: "bi-bar-chart-line-fill" };
  }
  if (r.includes("waste") || r.includes("shred")) {
    return { department: "Disposal & Shredding", icon: "bi-trash3-fill" };
  }
  return { department: "Operations Console", icon: "bi-person-workspace" };
};

// Crystal Synth Ambient Chime (Native Web Audio API, Zero dependencies)
const playChimeAudio = (type = "broadcast") => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const freqs = type === "critical" ? [880, 587.33, 880] : [587.33, 880, 1174.66];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.0001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.45);
    });
  } catch {
    // Silent ignore if audio is blocked
  }
};

export default function DashboardLayout() {
  const [loggedInUser, setLoggedInUser] = useState("");
  const [userModules, setUserModules] = useState([]);
  const [userName, setUserName] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // App Launcher State (Admin only)
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [launcherSearch, setLauncherSearch] = useState("");
  const searchInputRef = useRef(null);

  // Change Password State
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpForm, setCpForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [cpErrors, setCpErrors] = useState({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Role filter state
  const [selectedRole, setSelectedRole] = useState("all");

  // Focus & hover states
  const [focusedInput, setFocusedInput] = useState(null);
  const [toggleHover, setToggleHover] = useState(false);
  const [profileHover, setProfileHover] = useState(false);
  const [cpItemHover, setCpItemHover] = useState(false);
  const [logoutItemHover, setLogoutItemHover] = useState(false);
  const [cpFormHover, setCpFormHover] = useState(false);
  const [cpCancelHover, setCpCancelHover] = useState(false);
  const [eyeCurrentHover, setEyeCurrentHover] = useState(false);
  const [eyeNewHover, setEyeNewHover] = useState(false);
  const [eyeConfirmHover, setEyeConfirmHover] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = loggedInUser === "admin";

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
      try {
        const decoded = jwtDecode(token);
        setLoggedInUser((decoded.role || "user").toLowerCase());
        setUserName(decoded.name || decoded.username || decoded.userName || decoded.email || "");
        setUserModules(decoded.modules || []);
      } catch {
        setLoggedInUser("user");
      }
    }

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Smooth scroll lock when launcher is open
  useEffect(() => {
    if (showAppLauncher) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAppLauncher]);

  // Keyboard shortcut: Ctrl + K or / toggles the 3D App Launcher (Admin only)
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.key === "k") || (e.key === "/" && document.activeElement.tagName !== "INPUT")) {
        e.preventDefault();
        setShowAppLauncher((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowAppLauncher(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && showAppLauncher) {
      setTimeout(() => searchInputRef.current?.focus(), 120);
    } else {
      setLauncherSearch("");
    }
  }, [showAppLauncher, isAdmin]);

  // ==========================================
  // ANNOUNCEMENT STATE
  // ==========================================
  const [rawAnnouncement, setRawAnnouncement] = useState("");
  const [tickerPaused, setTickerPaused] = useState(false);
  const [isTickerMuted, setIsTickerMuted] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const lastAnnouncedTextRef = useRef("");

  const announcementData = useMemo(() => {
    if (!rawAnnouncement) return null;
    try {
      const parsed = JSON.parse(rawAnnouncement);
      if (parsed && typeof parsed === "object" && parsed.text) {
        return {
          text: parsed.text,
          type: parsed.type || "broadcast",
          badge: parsed.badge || (parsed.type === "critical" ? "CRITICAL ALERT" : "LIVE BROADCAST"),
          speed: parsed.speed || "normal",
          sound: parsed.sound !== false,
          timestamp: parsed.timestamp || null
        };
      }
    } catch {
      // Legacy plain text fallback
    }
    return {
      text: rawAnnouncement,
      type: "broadcast",
      badge: "LIVE BROADCAST",
      speed: "normal",
      sound: true,
      timestamp: null
    };
  }, [rawAnnouncement]);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${BASE_URL}/api/auth/announcement`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const newText = res.data?.text || "";
        setRawAnnouncement(newText);

        if (newText && newText !== lastAnnouncedTextRef.current) {
          lastAnnouncedTextRef.current = newText;
          if (!isTickerMuted) {
            playChimeAudio(announcementData?.type || "broadcast");
          }
        }
      } catch {
        setRawAnnouncement("");
      }
    };

    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 15000);
    return () => clearInterval(interval);
  }, [isTickerMuted, announcementData?.type]);

  const themeColors = useMemo(() => {
    const t = announcementData?.type || "broadcast";
    switch (t) {
      case "critical":
        return { primary: "#dc2626", secondary: "#991b1b", glow: "rgba(220, 38, 38, 0.25)", bg: "#fef2f2" };
      case "maintenance":
        return { primary: "#0284c7", secondary: "#0369a1", glow: "rgba(2, 132, 199, 0.25)", bg: "#f0f9ff" };
      case "celebration":
        return { primary: "#16a34a", secondary: "#15803d", glow: "rgba(22, 163, 74, 0.25)", bg: "#f0fdf4" };
      case "info":
        return { primary: "#7c3aed", secondary: "#6d28d9", glow: "rgba(124, 58, 237, 0.25)", bg: "#faf5ff" };
      default:
        return { primary: "#1d4ed8", secondary: "#1e40af", glow: "rgba(29, 78, 216, 0.25)", bg: "#eff6ff" };
    }
  }, [announcementData?.type]);

  const baseDuration = useMemo(() => {
    const sp = announcementData?.speed || "normal";
    if (sp === "fast") return 12;
    if (sp === "slow") return 30;
    return 20;
  }, [announcementData?.speed]);

  const actualDuration = baseDuration / speedMultiplier;

  const cycleSpeed = () => {
    setSpeedMultiplier((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 0.6 : 1));
  };

  const copyAnnouncement = () => {
    if (announcementData?.text) {
      navigator.clipboard.writeText(announcementData.text);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

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

  const sidebarWidth = collapsed ? "68px" : "230px";

  const allowedModules = useMemo(() => {
    return menuItems.filter((item) => {
      const hasRole = !loggedInUser || loggedInUser === "admin" || item.roles.includes(loggedInUser);
      if (!hasRole) return false;
      if (loggedInUser !== "admin" && userModules.length > 0 && !userModules.includes(item.to)) {
        return false;
      }
      if (selectedRole !== "all" && !item.roles.includes(selectedRole)) {
        return false;
      }
      return true;
    });
  }, [loggedInUser, userModules, selectedRole]);

  const sidebarItems = useMemo(() => {
    if (!isAdmin) {
      return allowedModules;
    }
    const activeCategory = APP_CATEGORIES.find((cat) =>
      cat.routes.some((r) => location.pathname === r || location.pathname.startsWith(r + "/"))
    );
    if (activeCategory) {
      return allowedModules.filter((m) => activeCategory.routes.includes(m.to));
    }
    return allowedModules.slice(0, 6);
  }, [isAdmin, allowedModules, location.pathname]);

  // Current page info for the header
  const currentPage = useMemo(() => {
    const path = location.pathname;
    const match = menuItems.find((m) => path === m.to || path.startsWith(m.to + "/"));
    const cat = APP_CATEGORIES.find((c) =>
      c.routes.some((r) => path === r || path.startsWith(r + "/"))
    );
    return {
      title: match?.label || "Dashboard",
      icon: match?.icon || "bi-speedometer2",
      color: cat?.color || "#1d4ed8"
    };
  }, [location.pathname]);

  const inputStyle = (inputName, hasError) => {
    const isFocused = focusedInput === inputName;
    return {
      backgroundColor: "#f8fafc",
      border: "1px solid",
      borderColor: hasError ? "#ef4444" : isFocused ? "#1e40af" : "#cbd5e1",
      color: "#0f172a",
      boxShadow: isFocused ? "0 0 0 3px rgba(30, 64, 175, 0.12)" : "none",
      transition: "all 0.2s ease",
      borderRadius: "8px 0 0 8px",
      padding: "9px 12px"
    };
  };

  const eyeButtonStyle = (hoverState) => ({
    backgroundColor: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderLeft: "none",
    color: hoverState ? "#0f172a" : "#64748b",
    transition: "all 0.2s ease",
    borderRadius: "0 8px 8px 0"
  });

  const displayName = userName || loggedInUser || "User";
  const firstLetter = displayName.charAt(0).toUpperCase();
  const topOffset = isMobile ? 52 : 0;

  return (
    <div className="d-flex" style={{ overflowX: "hidden", backgroundColor: "#f8fafc", color: "#0f172a" }}>
      <style>{`
        /* Seamless Infinite Ticker */
        @keyframes infiniteTicker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }

        @keyframes pulsePingLive {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* ===== EXECUTIVE TOP BAR ===== */
        .page-header-bar {
          position: fixed;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 24px;
          min-height: 58px;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03), 0 4px 12px rgba(15, 23, 42, 0.02);
          overflow: visible;
          z-index: 1028;
          transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.2s ease;
        }

        /* Left Logo Presentation */
        .header-logo-dock {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* CAPS Header Title - Executive Corporate Look */
        .page-header-title {
          margin: 0;
          font-size: 1.12rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #0f172a;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ===== CLICK-TO-LOGOUT USER PILL ===== */
        .header-user-logout-pill {
          display: inline-flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 50px;
          padding: 4px 12px 4px 4px;
          gap: 9px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          user-select: none;
        }

        .header-user-logout-pill:hover {
          border-color: #ef4444;
          background: #fef2f2;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
          transform: translateY(-1px);
        }

        .user-avatar-badge {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
          color: #ffffff;
          font-weight: 700;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .header-user-logout-pill:hover .user-avatar-badge {
          background: #ef4444;
        }

        .avatar-initial {
          display: block;
        }
        .avatar-logout-icon {
          display: none;
          font-size: 0.82rem;
        }
        .header-user-logout-pill:hover .avatar-initial {
          display: none;
        }
        .header-user-logout-pill:hover .avatar-logout-icon {
          display: block;
        }

        .header-user-meta {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
          text-align: left;
        }

        .header-user-name {
          font-size: 0.8rem;
          font-weight: 700;
          color: #0f172a;
          max-width: 120px;
          transition: color 0.2s ease;
        }

        .header-user-logout-pill:hover .header-user-name {
          color: #dc2626;
        }

        .header-user-subtext {
          font-size: 0.64rem;
          font-weight: 600;
          color: #16a34a;
          letter-spacing: 0.2px;
          transition: color 0.2s ease;
        }

        .header-user-logout-pill:hover .header-user-subtext {
          color: #ef4444;
        }

        /* Nav links */
        .sidebar-nav-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }

        .sidebar-nav-link {
          transition: all 0.18s ease;
          border-left: 3px solid transparent;
          text-decoration: none;
          border-radius: 8px;
        }
        .sidebar-nav-link:hover:not(.active-nav-link) {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
        .sidebar-nav-link.active-nav-link {
          background-color: #f1f5f9;
          color: #0f172a !important;
          border-left-color: #1e3a8a;
          font-weight: 700 !important;
        }

        /* 3D Application Launcher Modal */
        .launcher-overlay-3d {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1070;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .launcher-panel-3d-smooth {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 16px;
          width: 100%;
          max-width: 1120px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
          padding: 30px;
          color: #0f172a;
        }
        .search-well-3d-smooth {
          position: relative;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
        }
        .search-well-3d-smooth input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          padding: 8px 12px 8px 36px;
          color: #0f172a;
          font-size: 0.84rem;
          font-weight: 600;
        }
        .category-deck-3d {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 16px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .app-keycap-3d {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #334155;
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .app-keycap-3d:hover {
          color: #0f172a;
          background: #f8fafc;
          border-color: #94a3b8;
          transform: translateY(-1px);
        }
        .app-keycap-3d.active-3d {
          background: #0f172a;
          color: #ffffff !important;
          border-color: #0f172a;
        }

        /* Ticker Action Buttons */
        .ticker-action-btn {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #1e3a8a;
          border-radius: 5px;
          padding: 2px 7px;
          font-size: 0.72rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }
        .ticker-action-btn:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }

        @media (max-width: 767px) {
          .page-header-bar { padding: 6px 14px; min-height: 52px; }
          .page-header-title { font-size: 0.95rem; }
          .header-user-meta { display: none; }
        }
      `}</style>

      {/* MOBILE OVERLAY */}
      {isMobile && !collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 1040
          }}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className="position-fixed d-flex flex-column"
        style={{
          width: sidebarWidth,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 1050,
          left: isMobile ? (collapsed ? "-260px" : "0") : "0",
          top: 0,
          height: "100vh",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          borderRight: "1px solid #e2e8f0",
          boxShadow: "none"
        }}
      >
        {/* BRAND HEADER + COLLAPSE TOGGLE */}
        <div
          className="d-flex align-items-center"
          style={{
            height: "58px",
            padding: collapsed ? "0" : "0 14px 0 18px",
            justifyContent: collapsed ? "center" : "space-between",
            borderBottom: "1px solid #e2e8f0",
            flexShrink: 0
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#0f172a", letterSpacing: "0.8px" }}>
              MPI CONSOLE
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="btn d-flex align-items-center justify-content-center"
            style={{
              width: "32px",
              height: "32px",
              padding: 0,
              borderRadius: "6px",
              border: "none",
              background: "transparent",
              color: "#475569"
            }}
          >
            <i className={`bi ${collapsed ? "bi-layout-sidebar" : "bi-layout-sidebar-inset"}`} style={{ fontSize: "1.05rem" }}></i>
          </button>
        </div>

        {/* Floating round edge handle (desktop only) */}
        {!isMobile && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            onMouseEnter={() => setToggleHover(true)}
            onMouseLeave={() => setToggleHover(false)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              position: "absolute",
              top: "70px",
              right: "-12px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              background: toggleHover ? "#0f172a" : "#ffffff",
              color: toggleHover ? "#ffffff" : "#475569",
              border: "1px solid #cbd5e1",
              boxShadow: "0 1px 4px rgba(15, 23, 42, 0.12)",
              zIndex: 1060,
              transition: "all 0.15s ease"
            }}
          >
            <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`} style={{ fontSize: "0.72rem" }}></i>
          </button>
        )}

        {/* All Modules button (admin only) */}
        {isAdmin && (
          <div className="p-3" style={{ borderBottom: "1px solid #e2e8f0" }}>
            {collapsed ? (
              <button
                className="btn w-100 p-2 d-flex justify-content-center align-items-center rounded-2"
                onClick={() => setShowAppLauncher(true)}
                title="Open App Launcher (Ctrl+K)"
                style={{ background: "#0f172a", border: "none", color: "#ffffff" }}
              >
                <i className="bi bi-grid-3x3-gap-fill fs-6"></i>
              </button>
            ) : (
              <button
                className="btn w-100 d-flex align-items-center justify-content-center gap-2 fw-bold"
                onClick={() => setShowAppLauncher(true)}
                style={{ background: "#0f172a", border: "none", color: "#ffffff", fontSize: "0.82rem", padding: "8px 12px", borderRadius: "8px" }}
              >
                <i className="bi bi-grid-3x3-gap-fill"></i>
                <span>All Modules</span>
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav
          className="nav flex-column flex-nowrap p-2 gap-1 flex-grow-1 w-100 sidebar-nav-scroll"
          style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
        >
          {/* Header indicator ONLY for Admin; Removed "Assigned Modules" for non-admin */}
          {!collapsed && isAdmin && (
            <div className="d-flex align-items-center justify-content-between px-2 py-1 mb-1">
              <div
                className="small fw-bold text-uppercase d-flex align-items-center gap-1"
                style={{ fontSize: "0.66rem", letterSpacing: "0.6px", color: "#64748b" }}
              >
                <i className="bi bi-grid-fill" style={{ color: "#0f172a", fontSize: "0.7rem" }}></i>
                <span>Active Category</span>
              </div>
              <span
                className="badge rounded-pill"
                style={{
                  backgroundColor: "#f1f5f9",
                  color: "#0f172a",
                  border: "1px solid #e2e8f0",
                  fontSize: "0.62rem",
                  padding: "2px 6px"
                }}
              >
                {sidebarItems.length}
              </span>
            </div>
          )}

          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => isMobile && setCollapsed(true)}
                className={`nav-link py-2 px-3 rounded d-flex align-items-center gap-3 mb-1 sidebar-nav-link ${isActive ? "active-nav-link" : ""}`}
                style={{
                  color: isActive ? "#0f172a" : "#334155",
                  fontSize: "0.84rem",
                  fontWeight: isActive ? "700" : "500",
                  justifyContent: collapsed ? "center" : "flex-start"
                }}
              >
                <i className={`bi ${item.icon}`} style={{ fontSize: "0.95rem", color: isActive ? "#0f172a" : "#64748b" }}></i>
                {!collapsed && <span className="text-truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer: user menu (Change Password / Logout) */}
        <div
          className="p-3 border-top"
          style={{ borderColor: "#e2e8f0", backgroundColor: "#ffffff" }}
        >
          <div className="dropup">
            {collapsed ? (
              <div className="d-flex justify-content-center">
                <button
                  className="btn d-flex align-items-center justify-content-center fw-bold"
                  data-bs-toggle="dropdown"
                  title={displayName}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    padding: 0,
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.2)"
                  }}
                >
                  {firstLetter}
                </button>
              </div>
            ) : (
              <button
                className="btn d-flex align-items-center gap-2 w-100 text-start"
                data-bs-toggle="dropdown"
                onMouseEnter={() => setProfileHover(true)}
                onMouseLeave={() => setProfileHover(false)}
                style={{
                  backgroundColor: profileHover ? "#f8fafc" : "#ffffff",
                  border: "1px solid",
                  borderColor: profileHover ? "#94a3b8" : "#e2e8f0",
                  borderRadius: "10px",
                  padding: "7px 10px",
                  transition: "all 0.15s ease"
                }}
              >
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                  style={{
                    width: "30px",
                    height: "30px",
                    background: "#0f172a",
                    color: "#ffffff",
                    fontSize: "0.82rem",
                    flexShrink: 0
                  }}
                >
                  {firstLetter}
                </div>
                <div className="text-truncate flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="fw-bold text-capitalize text-truncate" style={{ fontSize: "0.78rem", color: "#0f172a" }}>
                    {displayName}
                  </div>
                  <div className="small" style={{ fontSize: "0.64rem", color: "#16a34a", fontWeight: 600 }}>
                    ● ONLINE
                  </div>
                </div>
                <i className="bi bi-chevron-up" style={{ color: "#94a3b8", fontSize: "0.75rem" }}></i>
              </button>
            )}

            <ul
              className="dropdown-menu py-2 shadow-sm"
              style={{
                backgroundColor: "#ffffff",
                minWidth: "200px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                padding: "8px 6px"
              }}
            >
              <li
                className="dropdown-item-text fw-semibold text-capitalize mb-2 px-3 py-2 rounded"
                style={{ color: "#0f172a", fontSize: "0.9rem", backgroundColor: "#f8fafc" }}
              >
                <div className="small fw-normal text-muted" style={{ fontSize: "0.72rem" }}>
                  Signed In As
                </div>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <i className="bi bi-shield-check" style={{ color: "#1e3a8a" }}></i>
                  <span>{displayName}</span>
                </div>
              </li>

              <li>
                <hr className="dropdown-divider" style={{ borderColor: "#e2e8f0" }} />
              </li>

              <li>
                <button
                  className="dropdown-item d-flex align-items-center gap-2 rounded"
                  onClick={() => setShowChangePassword(true)}
                  onMouseEnter={() => setCpItemHover(true)}
                  onMouseLeave={() => setCpItemHover(false)}
                  style={{
                    color: cpItemHover ? "#0f172a" : "#475569",
                    backgroundColor: cpItemHover ? "#f1f5f9" : "transparent",
                    transition: "all 0.15s ease",
                    padding: "8px 14px",
                    fontSize: "0.82rem",
                    fontWeight: "500"
                  }}
                >
                  <i className="bi bi-key-fill text-secondary"></i> Change Password
                </button>
              </li>

              <li>
                <button
                  className="dropdown-item text-danger d-flex align-items-center gap-2 rounded"
                  onClick={logout}
                  onMouseEnter={() => setLogoutItemHover(true)}
                  onMouseLeave={() => setLogoutItemHover(false)}
                  style={{
                    backgroundColor: logoutItemHover ? "#fef2f2" : "transparent",
                    transition: "all 0.15s ease",
                    padding: "8px 14px",
                    fontSize: "0.82rem",
                    fontWeight: "500"
                  }}
                >
                  <i className="bi bi-box-arrow-right"></i> Logout
                </button>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div
        className="flex-grow-1"
        style={{
          marginLeft: isMobile ? "0" : sidebarWidth,
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          width: "100%",
          minHeight: "100vh",
          overflowX: "hidden"
        }}
      >
        {/* Mobile only: floating button to open the sidebar */}
        {isMobile && collapsed && (
          <button
            className="btn d-flex align-items-center justify-content-center"
            onClick={() => setCollapsed(false)}
            style={{
              position: "fixed",
              top: "8px",
              left: "8px",
              zIndex: 1045,
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              padding: "7px 11px",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
            }}
          >
            <i className="bi bi-list fs-5"></i>
          </button>
        )}

        {/* =========================================================================
            ANNOUNCEMENT TICKER (CONTROLS VISIBLE ONLY TO ADMIN)
            ========================================================================= */}
        {announcementData?.text && !isMinimized && (
          <div
            style={{
              position: "fixed",
              top: `${topOffset}px`,
              left: isMobile ? 0 : sidebarWidth,
              right: 0,
              height: "36px",
              backgroundColor: themeColors.bg,
              borderBottom: `1px solid ${themeColors.primary}`,
              boxShadow: `0 2px 10px ${themeColors.glow}`,
              zIndex: 1029,
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              transition: "all 0.3s ease"
            }}
          >
            {/* Left Badge */}
            <div
              style={{
                background: `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.secondary} 100%)`,
                color: "#ffffff",
                padding: "0 14px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.72rem",
                fontWeight: "800",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                zIndex: 4,
                flexShrink: 0
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#ffffff",
                  animation: "pulsePingLive 1.4s infinite"
                }}
              />
              <span>{announcementData.badge}</span>
            </div>

            {/* Seamless Dual-Track Infinite Loop Container */}
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                height: "100%",
                display: "flex",
                alignItems: "center",
                position: "relative",
                cursor: isAdmin ? "pointer" : "default"
              }}
              onMouseEnter={() => setTickerPaused(true)}
              onMouseLeave={() => setTickerPaused(false)}
              onClick={() => {
                if (isAdmin) setShowDetailModal(true);
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "max-content",
                  animation: `infiniteTicker ${actualDuration}s linear infinite`,
                  animationPlayState: tickerPaused ? "paused" : "running"
                }}
              >
                {/* Track 1 */}
                <div style={{ display: "flex", alignItems: "center", paddingRight: "60px" }}>
                  <span
                    style={{
                      color: "#0f172a",
                      fontWeight: "700",
                      fontSize: "0.82rem",
                      letterSpacing: "0.2px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {announcementData.text}
                  </span>
                  <span style={{ color: "#94a3b8", margin: "0 26px" }}>❖</span>
                </div>

                {/* Track 2 */}
                <div style={{ display: "flex", alignItems: "center", paddingRight: "60px" }}>
                  <span
                    style={{
                      color: "#0f172a",
                      fontWeight: "700",
                      fontSize: "0.82rem",
                      letterSpacing: "0.2px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {announcementData.text}
                  </span>
                  <span style={{ color: "#94a3b8", margin: "0 26px" }}>❖</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Controls - ONLY FOR ADMIN */}
            {isAdmin && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "0 10px",
                  height: "100%",
                  zIndex: 4,
                  flexShrink: 0
                }}
              >
                {/* Play / Pause Toggle */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTickerPaused(!tickerPaused);
                  }}
                  title={tickerPaused ? "Resume scrolling" : "Pause scrolling"}
                >
                  <i className={`bi ${tickerPaused ? "bi-play-fill" : "bi-pause-fill"}`}></i>
                </button>

                {/* Speed Multiplier */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleSpeed();
                  }}
                  title={`Current speed: ${speedMultiplier}x (Click to cycle)`}
                >
                  <span>{speedMultiplier}x</span>
                </button>

                {/* Audio Chime Mute/Unmute */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTickerMuted(!isTickerMuted);
                    if (isTickerMuted) playChimeAudio(announcementData?.type);
                  }}
                  title={isTickerMuted ? "Sound chime muted" : "Sound chime active (Click to test)"}
                >
                  <i className={`bi ${isTickerMuted ? "bi-volume-mute text-secondary" : "bi-volume-up"}`}></i>
                </button>

                {/* View Details */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailModal(true);
                  }}
                  title="Full Announcement Details"
                >
                  <i className="bi bi-arrows-fullscreen"></i>
                </button>

                {/* Minimize Strip */}
                <button
                  className="ticker-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(true);
                  }}
                  title="Minimize ticker"
                >
                  <i className="bi bi-dash-lg"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Minimized Pill Restore Button (Only for Admin) */}
        {isAdmin && announcementData?.text && isMinimized && (
          <div
            onClick={() => setIsMinimized(false)}
            style={{
              position: "fixed",
              top: `${topOffset + 6}px`,
              right: "20px",
              zIndex: 1035,
              background: "#0f172a",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "4px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "0.72rem",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.18)"
            }}
            title="Click to restore broadcast ticker"
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#22c55e",
                animation: "pulsePingLive 1.4s infinite"
              }}
            />
            <span>RESTORE BULLETIN</span>
          </div>
        )}

        {/* Content Outlet */}
        <div
          className="p-3 p-md-0"
          style={{
            minHeight: `calc(100vh - ${topOffset + (announcementData?.text && !isMinimized ? 36 : 0)}px)`,
            marginTop: `${topOffset + (announcementData?.text && !isMinimized ? 36 : 0)}px`,
            transition: "margin-top 0.2s ease"
          }}
        >
          {/* =========================================================================
              CLEAN TOP PAGE HEADER
              ========================================================================= */}
          <div
            className="page-header-bar"
            style={{
              top: `${topOffset + (announcementData?.text && !isMinimized ? 36 : 0)}px`,
              left: isMobile ? 0 : sidebarWidth,
              right: 0
            }}
          >
            {/* LEFT SIDE: Exact Logo & Current Page Title */}
            <div className="header-logo-dock" style={{ minWidth: 0 }}>
              <img
                src="Logo.png"
                alt="MPI Logo"
                style={{
                  height: "28px",
                  width: "auto",
                  maxWidth: "115px",
                  objectFit: "contain"
                }}
              />
              <div style={{ height: "20px", width: "1px", backgroundColor: "#e2e8f0" }} />
              <h1
                className="page-header-title"
                title={currentPage.title}
                style={{ textAlign: "left" }}
              >
                {currentPage.title}
              </h1>
            </div>

            {/* RIGHT SIDE: CLICKABLE USER PILL */}
            <div className="d-flex align-items-center">
              <div
                className="header-user-logout-pill"
                onClick={logout}
                title={`Logged in as ${displayName} (${loggedInUser || "User"}) • Click to Logout`}
              >
                <div className="user-avatar-badge">
                  <span className="avatar-initial">{firstLetter}</span>
                  <i className="bi bi-box-arrow-right avatar-logout-icon"></i>
                </div>

                <div className="header-user-meta">
                  <span className="header-user-name text-truncate">
                    {displayName}
                  </span>
                  <span className="header-user-subtext text-capitalize">
                    ● {loggedInUser || "Online"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Spacer for header */}
          <div style={{ height: isMobile ? 64 : 58 }} />

          <Outlet />
        </div>
      </div>

      {/* ANNOUNCEMENT FULL DETAIL POPUP MODAL (ADMIN ONLY) */}
      {isAdmin && showDetailModal && announcementData?.text && (
        <>
          <div
            onClick={() => setShowDetailModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 1080
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1085,
              width: "92%",
              maxWidth: "500px",
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.2)",
              padding: "24px",
              color: "#0f172a"
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2" style={{ borderColor: "#e2e8f0" }}>
              <div className="d-flex align-items-center gap-2">
                <span
                  className="badge"
                  style={{
                    background: themeColors.primary,
                    color: "#ffffff",
                    fontWeight: "800",
                    fontSize: "0.72rem",
                    padding: "5px 10px",
                    borderRadius: "6px"
                  }}
                >
                  {announcementData.badge}
                </span>
                <span className="small text-muted">
                  {announcementData.timestamp ? new Date(announcementData.timestamp).toLocaleTimeString() : "Live Notice"}
                </span>
              </div>
              <button
                className="btn btn-sm btn-link p-0 text-muted"
                onClick={() => setShowDetailModal(false)}
              >
                <i className="bi bi-x-lg fs-6"></i>
              </button>
            </div>

            <div
              style={{
                fontSize: "0.96rem",
                lineHeight: "1.6",
                color: "#1e293b",
                fontWeight: "500",
                background: "#f8fafc",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                marginBottom: "20px"
              }}
            >
              {announcementData.text}
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <button
                className="btn btn-sm fw-bold d-flex align-items-center gap-2"
                onClick={copyAnnouncement}
                style={{
                  background: "#ffffff",
                  color: copiedNotification ? "#16a34a" : "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "7px 14px",
                  fontSize: "0.82rem"
                }}
              >
                <i className={`bi ${copiedNotification ? "bi-check2 text-success" : "bi-clipboard"}`}></i>
                <span>{copiedNotification ? "Copied!" : "Copy Text"}</span>
              </button>
              <button
                className="btn btn-sm fw-bold"
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "7px 18px",
                  fontSize: "0.82rem"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* 3D LIGHT APPLICATION LAUNCHER MODAL */}
      {isAdmin && showAppLauncher && (
        <div className="launcher-overlay-3d" onClick={() => setShowAppLauncher(false)}>
          <div className="launcher-panel-3d-smooth" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: "#e2e8f0" }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ background: "#f1f5f9", color: "#0f172a", padding: "8px 12px", borderRadius: "8px" }}>
                  <i className="bi bi-grid-3x3-gap-fill fs-5"></i>
                </div>
                <div>
                  <h5 className="mb-0 fw-bold text-dark text-uppercase" style={{ letterSpacing: "0.5px" }}>
                    MODULE LAUNCHER
                  </h5>
                  <div className="text-secondary small fw-semibold">
                    MPI Enterprise Modules Console (All 29 Services)
                  </div>
                </div>
              </div>

              <div className="search-well-3d-smooth" style={{ width: "320px" }}>
                <i
                  className="bi bi-search position-absolute text-muted"
                  style={{ left: "12px", top: "50%", transform: "translateY(-50%)" }}
                ></i>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Quick find module... (Type name or URL)"
                  value={launcherSearch}
                  onChange={(e) => setLauncherSearch(e.target.value)}
                />
              </div>

              <button
                className="btn btn-sm btn-light border rounded-circle"
                style={{ width: "34px", height: "34px" }}
                onClick={() => setShowAppLauncher(false)}
                title="Close (Esc)"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="row g-3">
              {APP_CATEGORIES.map((cat) => {
                const q = launcherSearch.toLowerCase().trim();
                const catItems = allowedModules.filter((m) => {
                  if (!cat.routes.includes(m.to)) return false;
                  if (q) return m.label.toLowerCase().includes(q) || m.to.toLowerCase().includes(q);
                  return true;
                });

                if (catItems.length === 0) return null;

                return (
                  <div key={cat.title} className="col-lg-4 col-md-6">
                    <div className="category-deck-3d">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className={`bi ${cat.icon}`} style={{ color: cat.color }}></i>
                          <div className="fw-bold small text-uppercase" style={{ color: cat.color, letterSpacing: "0.5px" }}>
                            {cat.title}
                          </div>
                        </div>
                        <span className="badge bg-light border text-secondary small px-2 py-1 rounded-pill">
                          {catItems.length}
                        </span>
                      </div>

                      <div className="d-flex flex-column gap-2 flex-grow-1">
                        {catItems.map((item) => {
                          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setShowAppLauncher(false)}
                              className={`app-keycap-3d ${isActive ? "active-3d" : ""}`}
                            >
                              <i className={`bi ${item.icon}`} style={{ fontSize: "0.95rem" }}></i>
                              <span className="text-truncate">{item.label}</span>
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {showChangePassword && (
        <>
          <div
            onClick={() => setShowChangePassword(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 1060
            }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1065,
              width: "90%",
              maxWidth: "400px",
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #cbd5e1",
              boxShadow: "0 15px 40px rgba(15, 23, 42, 0.15)",
              padding: "28px",
              color: "#0f172a"
            }}
          >
            <h5 className="text-center fw-bold mb-4" style={{ color: "#0f172a" }}>
              🔐 Change Password
            </h5>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Current Password</label>
              <div className="input-group">
                <input
                  type={showCurrent ? "text" : "password"}
                  className={`form-control ${cpErrors.currentPassword ? "is-invalid" : ""}`}
                  style={inputStyle("currentPassword", cpErrors.currentPassword)}
                  onFocus={() => setFocusedInput("currentPassword")}
                  onBlur={() => setFocusedInput(null)}
                  value={cpForm.currentPassword}
                  onChange={(e) => setCpForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  className="btn"
                  onMouseEnter={() => setEyeCurrentHover(true)}
                  onMouseLeave={() => setEyeCurrentHover(false)}
                  onClick={() => setShowCurrent((p) => !p)}
                  style={eyeButtonStyle(eyeCurrentHover)}
                >
                  {showCurrent ? <i className="bi bi-eye"></i> : <i className="bi bi-eye-slash"></i>}
                </button>
                {cpErrors.currentPassword && <div className="invalid-feedback">{cpErrors.currentPassword}</div>}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">New Password</label>
              <div className="input-group">
                <input
                  type={showNew ? "text" : "password"}
                  className={`form-control ${cpErrors.newPassword ? "is-invalid" : ""}`}
                  style={inputStyle("newPassword", cpErrors.newPassword)}
                  onFocus={() => setFocusedInput("newPassword")}
                  onBlur={() => setFocusedInput(null)}
                  value={cpForm.newPassword}
                  onChange={(e) => setCpForm((p) => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min 12 characters"
                />
                <button
                  type="button"
                  className="btn"
                  onMouseEnter={() => setEyeNewHover(true)}
                  onMouseLeave={() => setEyeNewHover(false)}
                  onClick={() => setShowNew((p) => !p)}
                  style={eyeButtonStyle(eyeNewHover)}
                >
                  {showNew ? <i className="bi bi-eye"></i> : <i className="bi bi-eye-slash"></i>}
                </button>
                {cpErrors.newPassword && <div className="invalid-feedback">{cpErrors.newPassword}</div>}
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary">Confirm New Password</label>
              <div className="input-group">
                <input
                  type={showConfirm ? "text" : "password"}
                  className={`form-control ${cpErrors.confirmPassword ? "is-invalid" : ""}`}
                  style={inputStyle("confirmPassword", cpErrors.confirmPassword)}
                  onFocus={() => setFocusedInput("confirmPassword")}
                  onBlur={() => setFocusedInput(null)}
                  value={cpForm.confirmPassword}
                  onChange={(e) => setCpForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  className="btn"
                  onMouseEnter={() => setEyeConfirmHover(true)}
                  onMouseLeave={() => setEyeConfirmHover(false)}
                  onClick={() => setShowConfirm((p) => !p)}
                  style={eyeButtonStyle(eyeConfirmHover)}
                >
                  {showConfirm ? <i className="bi bi-eye"></i> : <i className="bi bi-eye-slash"></i>}
                </button>
                {cpErrors.confirmPassword && <div className="invalid-feedback">{cpErrors.confirmPassword}</div>}
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                className="btn w-100 fw-semibold text-white"
                onClick={handleChangePassword}
                onMouseEnter={() => setCpFormHover(true)}
                onMouseLeave={() => setCpFormHover(false)}
                style={{
                  background: "#0f172a",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px",
                  fontSize: "0.85rem"
                }}
              >
                Update Password
              </button>
              <button
                className="btn w-100 fw-semibold"
                onClick={() => setShowChangePassword(false)}
                onMouseEnter={() => setCpCancelHover(true)}
                onMouseLeave={() => setCpCancelHover(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid #cbd5e1",
                  color: "#64748b",
                  borderRadius: "8px",
                  padding: "9px",
                  fontSize: "0.85rem"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}