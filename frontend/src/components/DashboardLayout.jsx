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

  // Theme (light aqua-glass / dark aqua-glass)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("mpi-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("mpi-theme", theme);
    } catch {
      // Silent ignore if storage is blocked
    }
  }, [theme]);

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
      backgroundColor: "var(--surface)",
      border: "1px solid",
      borderColor: hasError ? "var(--danger)" : isFocused ? "var(--accent)" : "var(--border-strong)",
      color: "var(--text)",
      boxShadow: isFocused ? "0 0 0 3px var(--accent-soft)" : "none",
      transition: "all 0.2s ease",
      borderRadius: "8px 0 0 8px",
      padding: "9px 12px"
    };
  };

  const eyeButtonStyle = (hoverState) => ({
    backgroundColor: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderLeft: "none",
    color: hoverState ? "var(--text)" : "var(--muted)",
    transition: "all 0.2s ease",
    borderRadius: "0 8px 8px 0"
  });

  const displayName = userName || loggedInUser || "User";
  const firstLetter = displayName.charAt(0).toUpperCase();
  const topOffset = isMobile ? 52 : 0;
  const isDark = theme === "dark";

  return (
    <div
      className="d-flex mpi-shell"
      data-theme={theme}
      style={{ overflowX: "hidden", color: "var(--text)" }}
    >
      <style>{`
        /* =====================================================
           AQUA-GLASS DESIGN TOKENS  (light + dark)
           Child pages can reuse these via var(--token)
           ===================================================== */
        .mpi-shell {
          --page-bg: linear-gradient(160deg, #eafaff 0%, #d6f2fc 42%, #bde6f6 100%);
          --glass: rgba(255, 255, 255, 0.62);
          --glass-strong: rgba(255, 255, 255, 0.88);
          --glass-soft: rgba(255, 255, 255, 0.42);
          --surface: #ffffff;
          --surface-2: rgba(232, 248, 255, 0.92);
          --border: rgba(103, 200, 226, 0.55);
          --border-strong: rgba(56, 170, 205, 0.7);
          --text: #0b3a52;
          --text-2: #2c5a70;
          --muted: #5b8397;
          --accent: #0891b2;
          --accent-2: #0ea5e9;
          --accent-grad: linear-gradient(135deg, #1fb6d4 0%, #0e9bd8 100%);
          --accent-soft: rgba(14, 165, 233, 0.16);
          --hover: rgba(14, 165, 233, 0.10);
          --active-bg: rgba(14, 165, 233, 0.17);
          --shadow: 0 10px 30px rgba(8, 110, 150, 0.14);
          --shadow-sm: 0 2px 8px rgba(8, 110, 150, 0.10);
          --overlay: rgba(8, 47, 73, 0.36);
          --danger: #dc2626;
          --danger-soft: rgba(239, 68, 68, 0.12);
          --ok: #059669;
          --scroll: rgba(8, 145, 178, 0.35);
          --logo-bg: transparent;
          --avatar-bg: linear-gradient(135deg, #1fb6d4 0%, #0b86b8 100%);
          background: var(--page-bg);
          background-attachment: fixed;
          min-height: 100vh;
          color-scheme: light;
        }

        .mpi-shell[data-theme="dark"] {
          --page-bg: linear-gradient(160deg, #04121c 0%, #072232 45%, #0a2d40 100%);
          --glass: rgba(11, 38, 54, 0.66);
          --glass-strong: rgba(8, 28, 42, 0.9);
          --glass-soft: rgba(255, 255, 255, 0.045);
          --surface: #0c2a3b;
          --surface-2: rgba(14, 48, 68, 0.85);
          --border: rgba(56, 189, 248, 0.2);
          --border-strong: rgba(56, 189, 248, 0.42);
          --text: #e3f8ff;
          --text-2: #b6dbe8;
          --muted: #7fa9bb;
          --accent: #22d3ee;
          --accent-2: #38bdf8;
          --accent-grad: linear-gradient(135deg, #0e9bb8 0%, #0b79b0 100%);
          --accent-soft: rgba(34, 211, 238, 0.16);
          --hover: rgba(56, 189, 248, 0.10);
          --active-bg: rgba(34, 211, 238, 0.16);
          --shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.4);
          --overlay: rgba(1, 10, 18, 0.62);
          --danger: #f87171;
          --danger-soft: rgba(248, 113, 113, 0.15);
          --ok: #34d399;
          --scroll: rgba(56, 189, 248, 0.35);
          --logo-bg: rgba(255, 255, 255, 0.92);
          --avatar-bg: linear-gradient(135deg, #0e9bb8 0%, #0b6a9c 100%);
          color-scheme: dark;
        }

        /* Bootstrap helper overrides so they follow the theme */
        .mpi-shell .text-muted,
        .mpi-shell .text-secondary { color: var(--muted) !important; }
        .mpi-shell .text-dark { color: var(--text) !important; }
        .mpi-shell .bg-light { background: var(--surface-2) !important; }
        .mpi-shell .border,
        .mpi-shell .border-top,
        .mpi-shell .border-bottom { border-color: var(--border) !important; }
        .mpi-shell .btn-light {
          background: var(--glass-strong);
          border-color: var(--border);
          color: var(--text);
        }
        .mpi-shell .btn-light:hover { background: var(--hover); color: var(--text); }
        .mpi-shell .dropdown-divider { border-color: var(--border); }
        .mpi-shell .form-control::placeholder { color: var(--muted); opacity: 0.8; }
        .mpi-shell .dropdown-item:hover,
        .mpi-shell .dropdown-item:focus { background-color: var(--hover); color: var(--text); }

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

        /* ===== AQUA-GLASS TOP BAR ===== */
        .page-header-bar {
          position: fixed;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 24px;
          min-height: 58px;
          background: var(--glass-strong);
          backdrop-filter: blur(16px) saturate(140%);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          border-bottom: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
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

        .header-logo-chip {
          display: flex;
          align-items: center;
          background: var(--logo-bg);
          border-radius: 8px;
          padding: 2px 8px;
          transition: background 0.2s ease;
        }

        /* CAPS Header Title */
        .page-header-title {
          margin: 0;
          font-size: 1.12rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--text);
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ===== THEME TOGGLE ===== */
        .theme-toggle-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--glass-strong);
          border: 1px solid var(--border);
          color: var(--accent);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
          margin-right: 10px;
          transition: all 0.2s ease;
        }
        .theme-toggle-btn:hover {
          background: var(--hover);
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }

        /* ===== CLICK-TO-LOGOUT USER PILL ===== */
        .header-user-logout-pill {
          display: inline-flex;
          align-items: center;
          background: var(--glass-strong);
          border: 1px solid var(--border);
          border-radius: 50px;
          padding: 4px 12px 4px 4px;
          gap: 9px;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          user-select: none;
        }

        .header-user-logout-pill:hover {
          border-color: var(--danger);
          background: var(--danger-soft);
          box-shadow: 0 4px 12px var(--danger-soft);
          transform: translateY(-1px);
        }

        .user-avatar-badge {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--avatar-bg);
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
          background: var(--danger);
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
          color: var(--text);
          max-width: 120px;
          transition: color 0.2s ease;
        }

        .header-user-logout-pill:hover .header-user-name {
          color: var(--danger);
        }

        .header-user-subtext {
          font-size: 0.64rem;
          font-weight: 600;
          color: var(--ok);
          letter-spacing: 0.2px;
          transition: color 0.2s ease;
        }

        .header-user-logout-pill:hover .header-user-subtext {
          color: var(--danger);
        }

        /* Nav links */
        .sidebar-nav-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-nav-scroll::-webkit-scrollbar-thumb { background: var(--scroll); border-radius: 6px; }

        .sidebar-nav-link {
          transition: all 0.18s ease;
          border-left: 3px solid transparent;
          text-decoration: none;
          border-radius: 8px;
        }
        .sidebar-nav-link:hover:not(.active-nav-link) {
          background-color: var(--hover) !important;
          color: var(--text) !important;
        }
        .sidebar-nav-link.active-nav-link {
          background-color: var(--active-bg);
          color: var(--text) !important;
          border-left-color: var(--accent);
          font-weight: 700 !important;
        }

        /* 3D Application Launcher Modal */
        .launcher-overlay-3d {
          position: fixed;
          inset: 0;
          background: var(--overlay);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1070;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .launcher-panel-3d-smooth {
          background: var(--glass-strong);
          backdrop-filter: blur(18px) saturate(140%);
          -webkit-backdrop-filter: blur(18px) saturate(140%);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%;
          max-width: 1120px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow);
          padding: 30px;
          color: var(--text);
        }
        .search-well-3d-smooth {
          position: relative;
          background: var(--surface-2);
          border-radius: 8px;
          border: 1px solid var(--border-strong);
        }
        .search-well-3d-smooth input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          padding: 8px 12px 8px 36px;
          color: var(--text);
          font-size: 0.84rem;
          font-weight: 600;
        }
        .search-well-3d-smooth input::placeholder { color: var(--muted); }
        .category-deck-3d {
          background: var(--glass);
          border-radius: 12px;
          border: 1px solid var(--border);
          padding: 16px;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-sm);
        }
        .app-keycap-3d {
          background: var(--glass-strong);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-2);
          text-decoration: none;
          font-size: 0.82rem;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .app-keycap-3d:hover {
          color: var(--text);
          background: var(--hover);
          border-color: var(--border-strong);
          transform: translateY(-1px);
        }
        .app-keycap-3d.active-3d {
          background: var(--accent-grad);
          color: #ffffff !important;
          border-color: transparent;
        }

        /* Ticker Action Buttons */
        .ticker-action-btn {
          background: var(--glass-strong);
          border: 1px solid var(--border-strong);
          color: var(--accent);
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
          background: var(--hover);
          border-color: var(--accent);
          color: var(--text);
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
            background: "var(--overlay)",
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
          background: "var(--glass-strong)",
          backdropFilter: "blur(16px) saturate(140%)",
          WebkitBackdropFilter: "blur(16px) saturate(140%)",
          color: "var(--text)",
          borderRight: "1px solid var(--border)",
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
            borderBottom: "1px solid var(--border)",
            flexShrink: 0
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text)", letterSpacing: "0.8px" }}>
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
              color: "var(--text-2)"
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
              background: toggleHover ? "var(--accent)" : "var(--glass-strong)",
              color: toggleHover ? "#ffffff" : "var(--text-2)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-sm)",
              zIndex: 1060,
              transition: "all 0.15s ease"
            }}
          >
            <i className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`} style={{ fontSize: "0.72rem" }}></i>
          </button>
        )}

        {/* All Modules button (admin only) */}
        {isAdmin && (
          <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            {collapsed ? (
              <button
                className="btn w-100 p-2 d-flex justify-content-center align-items-center rounded-2"
                onClick={() => setShowAppLauncher(true)}
                title="Open App Launcher (Ctrl+K)"
                style={{ background: "var(--accent-grad)", border: "none", color: "#ffffff", boxShadow: "var(--shadow-sm)" }}
              >
                <i className="bi bi-grid-3x3-gap-fill fs-6"></i>
              </button>
            ) : (
              <button
                className="btn w-100 d-flex align-items-center justify-content-center gap-2 fw-bold"
                onClick={() => setShowAppLauncher(true)}
                style={{
                  background: "var(--accent-grad)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "0.82rem",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  boxShadow: "var(--shadow-sm)"
                }}
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
                style={{ fontSize: "0.66rem", letterSpacing: "0.6px", color: "var(--muted)" }}
              >
                <i className="bi bi-grid-fill" style={{ color: "var(--accent)", fontSize: "0.7rem" }}></i>
                <span>Active Category</span>
              </div>
              <span
                className="badge rounded-pill"
                style={{
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
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
                  color: isActive ? "var(--text)" : "var(--text-2)",
                  fontSize: "0.84rem",
                  fontWeight: isActive ? "700" : "500",
                  justifyContent: collapsed ? "center" : "flex-start"
                }}
              >
                <i className={`bi ${item.icon}`} style={{ fontSize: "0.95rem", color: isActive ? "var(--accent)" : "var(--muted)" }}></i>
                {!collapsed && <span className="text-truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer: user menu (Change Password / Logout) */}
        <div
          className="p-3 border-top"
          style={{ borderColor: "var(--border)", backgroundColor: "transparent" }}
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
                    background: "var(--avatar-bg)",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: "var(--shadow-sm)"
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
                  backgroundColor: profileHover ? "var(--hover)" : "var(--glass)",
                  border: "1px solid",
                  borderColor: profileHover ? "var(--border-strong)" : "var(--border)",
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
                    background: "var(--avatar-bg)",
                    color: "#ffffff",
                    fontSize: "0.82rem",
                    flexShrink: 0
                  }}
                >
                  {firstLetter}
                </div>
                <div className="text-truncate flex-grow-1" style={{ minWidth: 0 }}>
                  <div className="fw-bold text-capitalize text-truncate" style={{ fontSize: "0.78rem", color: "var(--text)" }}>
                    {displayName}
                  </div>
                  <div className="small" style={{ fontSize: "0.64rem", color: "var(--ok)", fontWeight: 600 }}>
                    ● ONLINE
                  </div>
                </div>
                <i className="bi bi-chevron-up" style={{ color: "var(--muted)", fontSize: "0.75rem" }}></i>
              </button>
            )}

            <ul
              className="dropdown-menu py-2 shadow-sm"
              style={{
                backgroundColor: "var(--glass-strong)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                minWidth: "200px",
                borderRadius: "10px",
                border: "1px solid var(--border-strong)",
                padding: "8px 6px"
              }}
            >
              <li
                className="dropdown-item-text fw-semibold text-capitalize mb-2 px-3 py-2 rounded"
                style={{ color: "var(--text)", fontSize: "0.9rem", backgroundColor: "var(--surface-2)" }}
              >
                <div className="small fw-normal text-muted" style={{ fontSize: "0.72rem" }}>
                  Signed In As
                </div>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <i className="bi bi-shield-check" style={{ color: "var(--accent)" }}></i>
                  <span>{displayName}</span>
                </div>
              </li>

              <li>
                <hr className="dropdown-divider" style={{ borderColor: "var(--border)" }} />
              </li>

              <li>
                <button
                  className="dropdown-item d-flex align-items-center gap-2 rounded"
                  onClick={() => setShowChangePassword(true)}
                  onMouseEnter={() => setCpItemHover(true)}
                  onMouseLeave={() => setCpItemHover(false)}
                  style={{
                    color: cpItemHover ? "var(--text)" : "var(--text-2)",
                    backgroundColor: cpItemHover ? "var(--hover)" : "transparent",
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
                  className="dropdown-item d-flex align-items-center gap-2 rounded"
                  onClick={logout}
                  onMouseEnter={() => setLogoutItemHover(true)}
                  onMouseLeave={() => setLogoutItemHover(false)}
                  style={{
                    color: "var(--danger)",
                    backgroundColor: logoutItemHover ? "var(--danger-soft)" : "transparent",
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
              backgroundColor: "var(--glass-strong)",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
              padding: "7px 11px",
              borderRadius: "8px",
              boxShadow: "var(--shadow-sm)"
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
              backgroundColor: `color-mix(in srgb, ${themeColors.primary} 12%, var(--glass-strong))`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
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
                      color: "var(--text)",
                      fontWeight: "700",
                      fontSize: "0.82rem",
                      letterSpacing: "0.2px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {announcementData.text}
                  </span>
                  <span style={{ color: "var(--muted)", margin: "0 26px" }}>❖</span>
                </div>

                {/* Track 2 */}
                <div style={{ display: "flex", alignItems: "center", paddingRight: "60px" }}>
                  <span
                    style={{
                      color: "var(--text)",
                      fontWeight: "700",
                      fontSize: "0.82rem",
                      letterSpacing: "0.2px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {announcementData.text}
                  </span>
                  <span style={{ color: "var(--muted)", margin: "0 26px" }}>❖</span>
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
              background: "var(--accent-grad)",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "4px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontWeight: "700",
              fontSize: "0.72rem",
              boxShadow: "var(--shadow)"
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
              <div className="header-logo-chip">
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
              </div>
              <div style={{ height: "20px", width: "1px", backgroundColor: "var(--border-strong)" }} />
              <h1
                className="page-header-title"
                title={currentPage.title}
                style={{ textAlign: "left" }}
              >
                {currentPage.title}
              </h1>
            </div>

            {/* RIGHT SIDE: THEME TOGGLE + CLICKABLE USER PILL */}
            <div className="d-flex align-items-center">
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                <i className={`bi ${isDark ? "bi-sun-fill" : "bi-moon-stars-fill"}`}></i>
              </button>

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
              background: "var(--overlay)",
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
              background: "var(--glass-strong)",
              backdropFilter: "blur(18px) saturate(140%)",
              WebkitBackdropFilter: "blur(18px) saturate(140%)",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              padding: "24px",
              color: "var(--text)"
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2" style={{ borderColor: "var(--border)" }}>
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
                color: "var(--text)",
                fontWeight: "500",
                background: "var(--surface-2)",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
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
                  background: "var(--glass-strong)",
                  color: copiedNotification ? "var(--ok)" : "var(--text)",
                  border: "1px solid var(--border-strong)",
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
                  background: "var(--accent-grad)",
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
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: "var(--border)" }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "8px 12px", borderRadius: "8px" }}>
                  <i className="bi bi-grid-3x3-gap-fill fs-5"></i>
                </div>
                <div>
                  <h5 className="mb-0 fw-bold text-uppercase" style={{ letterSpacing: "0.5px", color: "var(--text)" }}>
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

                const catText = `color-mix(in srgb, ${cat.color} 62%, var(--text))`;

                return (
                  <div key={cat.title} className="col-lg-4 col-md-6">
                    <div className="category-deck-3d" style={{ borderTop: `3px solid ${cat.color}` }}>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className={`bi ${cat.icon}`} style={{ color: catText }}></i>
                          <div className="fw-bold small text-uppercase" style={{ color: catText, letterSpacing: "0.5px" }}>
                            {cat.title}
                          </div>
                        </div>
                        <span
                          className="badge border small px-2 py-1 rounded-pill"
                          style={{ background: "var(--accent-soft)", color: "var(--text-2)", borderColor: "var(--border)" }}
                        >
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
              background: "var(--overlay)",
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
              background: "var(--glass-strong)",
              backdropFilter: "blur(18px) saturate(140%)",
              WebkitBackdropFilter: "blur(18px) saturate(140%)",
              borderRadius: "14px",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow)",
              padding: "28px",
              color: "var(--text)"
            }}
          >
            <h5 className="text-center fw-bold mb-4" style={{ color: "var(--text)" }}>
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
                  background: "var(--accent-grad)",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px",
                  fontSize: "0.85rem",
                  filter: cpFormHover ? "brightness(1.08)" : "none",
                  transition: "filter 0.15s ease"
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
                  backgroundColor: cpCancelHover ? "var(--hover)" : "transparent",
                  border: "1px solid var(--border-strong)",
                  color: "var(--muted)",
                  borderRadius: "8px",
                  padding: "9px",
                  fontSize: "0.85rem",
                  transition: "all 0.15s ease"
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