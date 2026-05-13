import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import BASE_URL from "../config/api";

function InternalLogin() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  

  const handleChange = (e) => {
    const value = e.target.value.trim();
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(
        `${BASE_URL}/api/auth/internal/login`,
        form
      );

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role); // save role

      const role = res.data.role;

      if (!role) {
        setError("No role assigned to this user");
        setLoading(false);
        return;
      }

      if (role === "ADMIN") navigate("/admin");
      else if (role === "PLANNER") navigate("/planner");
      else if (role === "SUPERVISOR") navigate("/waste");
      else if (role === "PRODUCTION") navigate("/production");
      else if (role === "PURCHASE ORDER") navigate("/customer-dashboard");
      else if (role === "DISPATCH") navigate("/dispatch");
      else if(role ==="PRINTING") navigate("/print");
      else setError("Unknown role, cannot redirect");

    } catch (err) {
      setError(err.response?.data?.message || "Login Failed");
    }

    setLoading(false);
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center vh-100"
      style={{
         background: "linear-gradient(135deg, #216ad1d4, #0b61c4)",
      }}
    >
      <div
        className="card border-0 shadow-lg p-5"
        style={{ width: "460px", borderRadius: "12px" }}
      >
        <div className="text-center mb-2">
  <img
    src="Logo.png"
    alt="Logo"
    style={{ height: "60px", objectFit: "contain" }}
  />
</div>
        <p className="text-center text-muted mb-4" style={{ fontSize: "14px" }}>
          Please log in to continue
        </p>

    

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="mb-4 input-group">
           
            <span className="input-group-text bg-white border-dark">
              <i className="bi bi-envelope"></i>
            </span>
            
            <input
  name="email"
  type="text"
  placeholder="Email or Name"
              className="form-control border-dark"
              onChange={handleChange}
              required
            />
          </div>

          {/* Password */}
          <div className="mb-4 input-group">
            <span className="input-group-text bg-white border-dark">
              <i className="bi bi-lock"></i>
            </span>

            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="form-control border-dark"
              onChange={handleChange}
              required
            />

            <span
              className="input-group-text bg-white border-dark"
              style={{ cursor: "pointer" }}
              onClick={() => setShowPassword(!showPassword)}
            >
              <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
            </span>
          </div>

          {/* Login Button */}
          <div className="text-center">
            <button
              className="btn fw-semibold"
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: "#2565c4",
                padding: "6px 18px",
                color: "#fff",
                fontSize: "14px",
                letterSpacing: "0.3px",
                minWidth: "110px",
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-danger mt-3 text-center py-2">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default InternalLogin;