import { useNavigate } from "react-router-dom";

function SupervisorDashboard() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/"); // Redirect to internal login
  };

  return (
    <div>
      <h2>Supervisor Dashboard</h2>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default SupervisorDashboard;
