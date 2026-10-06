import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaTag } from "react-icons/fa";
import BASE_URL from "../config/api";
import useDelayedLoading from "../hooks/useDelayedLoading";
import LoadingOverlay from "../components/LoadingOverlay";
import "../styles/Internallogin.css";
const BASE = import.meta.env.BASE_URL;
const ROLE_ROUTES = {
  ADMIN: "/internal-register",
  PLANNER: "/planner",
  SUPERVISOR: "/waste",
  PRODUCTION: "/production",
  "PURCHASE ORDER": "/customer-dashboard",
  DISPATCH: "/dispatch",
  KAS: "/print",
  SCANNER: "/manual-box",
  INDENTER: "/new-in",
  PREPRESS: "/preprocess"
};

const TICKER_SPEED = { fast: "12s", normal: "18s", slow: "28s" };

function InternalLogin() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const showLoader = useDelayedLoading(loading, 10);

  const [rawAnnouncement, setRawAnnouncement] = useState("");
  const [loginMarqueePaused, setLoginMarqueePaused] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const announcementData = useMemo(() => {
    if (!rawAnnouncement) return null;
    try {
      const parsed = JSON.parse(rawAnnouncement);
      if (parsed && typeof parsed === "object" && parsed.text) {
        return {
          text: parsed.text,
          type: parsed.type || "broadcast",
          badge: parsed.badge || (parsed.type === "critical" ? "CRITICAL ALERT" : "BULLETIN"),
          speed: parsed.speed || "normal"
        };
      }
    } catch {
      // Legacy string
    }
    return { text: rawAnnouncement, type: "broadcast", badge: "SYSTEM BULLETIN", speed: "normal" };
  }, [rawAnnouncement]);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/auth/announcement/public`);
        setRawAnnouncement(res.data?.text || "");
      } catch {
        setRawAnnouncement("");
      }
    };
    fetchAnnouncement();
    const interval = setInterval(fetchAnnouncement, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e) => {
    const value = e.target.value.trim();
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`${BASE_URL}/api/auth/internal/login`, form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);

      const role = res.data.role;

      if (!role) {
        setError("No role is assigned to this account. Contact your administrator.");
        setLoading(false);
        return;
      }

      const target = ROLE_ROUTES[role];
      if (target) navigate(target);
      else setError("Your role is not recognised. Contact your administrator.");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials. Check your details and try again.");
    }

    setLoading(false);
  };

  const hasBar = Boolean(announcementData?.text);
  const accent = announcementData?.type === "critical" ? "#ef4444" : "#ffb000";
  const themeVars = {
    "--mpi-lgn-accent": accent,
    "--mpi-lgn-ticker-speed": TICKER_SPEED[announcementData?.speed] || TICKER_SPEED.normal
  };

  return (
    <div className={`mpi-lgn-root${hasBar ? " mpi-lgn-root--with-bar" : ""}`} style={themeVars}>
      {showLoader && <LoadingOverlay />}

      {/* ANNOUNCEMENT BAR */}
      {hasBar && (
        <div className="mpi-lgn-bar">
          <div className="mpi-lgn-bar__badge">
            <span className="mpi-lgn-bar__dot" />
            <span>{announcementData.badge}</span>
          </div>

          <div
            className="mpi-lgn-bar__viewport"
            onMouseEnter={() => setLoginMarqueePaused(true)}
            onMouseLeave={() => setLoginMarqueePaused(false)}
            onClick={() => setShowDetailModal(true)}
            title="Click to view announcement in full"
          >
            <div className={`mpi-lgn-bar__track${loginMarqueePaused ? " mpi-lgn-bar__track--paused" : ""}`}>
              {[0, 1].map((i) => (
                <div key={i} className="mpi-lgn-bar__item">
                  <span className="mpi-lgn-bar__text">{announcementData.text}</span>
                  <span className="mpi-lgn-bar__sep">❖</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LEFT: IMAGE (666 x 800) - UNTOUCHED */}
      <div className="mpi-lgn-visual" aria-hidden="true">
       <img className="mpi-lgn-visual__fill" src={`${BASE}MPI.png`} alt="" />
<img className="mpi-lgn-visual__img" src={`${BASE}MPI.png`} alt="MPI building" />
      </div>

      {/* RIGHT: FORM */}
      <div className="mpi-lgn-panel">
        <div className="mpi-lgn-decor mpi-lgn-decor--dots" aria-hidden="true" />
        <svg className="mpi-lgn-decor mpi-lgn-decor--circuit" viewBox="0 0 320 320" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M0 250 H70 L100 220 H180 L205 195 V120" />
            <path d="M0 290 H120 L150 260 H250 L280 230 V150" />
            <path d="M60 320 V280 L90 250" />
            <path d="M205 120 H260 L290 90" />
          </g>
          <g fill="currentColor">
            <circle cx="205" cy="120" r="5" />
            <circle cx="290" cy="90" r="5" />
            <circle cx="280" cy="150" r="5" />
            <circle cx="90" cy="250" r="4" />
          </g>
        </svg>

        <div className="mpi-lgn-main">
          <div className="mpi-lgn-formwrap">
            {/* CENTERED HEADER: LOGO -> WELCOME BACK -> SIGN IN INTO YOUR ACCOUNT */}
            <div className="mpi-lgn-header">
              <div className="mpi-lgn-card-brand">
              <img src={`${BASE}Logo.png`} alt="MPI" />
              </div>
              <h1 className="mpi-lgn-title">Welcome back</h1>
              <p className="mpi-lgn-subtitle">Sign in into your account</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mpi-lgn-field">
                <label className="mpi-lgn-label" htmlFor="mpi-lgn-email">
                  Email or username
                </label>
                <div className="mpi-lgn-control">
                  <i className="bi bi-person mpi-lgn-control__icon" aria-hidden="true" />
                  <input
                    id="mpi-lgn-email"
                    name="email"
                    type="text"
                    className="mpi-lgn-input"
                    placeholder="name@company.com"
                    autoComplete="username"
                    autoFocus
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="mpi-lgn-field">
                <label className="mpi-lgn-label" htmlFor="mpi-lgn-password">
                  Password
                </label>
                <div className="mpi-lgn-control">
                  <i className="bi bi-lock mpi-lgn-control__icon" aria-hidden="true" />
                  <input
                    id="mpi-lgn-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="mpi-lgn-input mpi-lgn-input--toggle"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className="mpi-lgn-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>
              </div>

              <button className="mpi-lgn-submit" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="mpi-lgn-spinner" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>

              {error && (
                <div className="mpi-lgn-error" role="alert">
                  <i className="bi bi-exclamation-circle" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
            </form>

            <div className="mpi-lgn-footer">
              <span>© 2026 Manipal Payment and Identity Solutions</span>
              <span className="mpi-lgn-version">
                <FaTag />
                V1.1.4
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ANNOUNCEMENT MODAL */}
      {showDetailModal && hasBar && (
        <>
          <div className="mpi-lgn-scrim" onClick={() => setShowDetailModal(false)} />
          <div className="mpi-lgn-modal" role="dialog" aria-modal="true">
            <div className="mpi-lgn-modal__head">
              <span className="mpi-lgn-modal__badge">{announcementData.badge}</span>
              <button
                type="button"
                className="mpi-lgn-modal__close"
                onClick={() => setShowDetailModal(false)}
                aria-label="Close announcement"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <p className="mpi-lgn-modal__text">{announcementData.text}</p>
            <button type="button" className="mpi-lgn-modal__action" onClick={() => setShowDetailModal(false)}>
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default InternalLogin;