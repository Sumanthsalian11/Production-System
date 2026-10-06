import { useNavigate } from "react-router-dom";

function OperatorDashboard() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/internal/login"); // Redirect to login/home page
  };

  return (
    <div>
      <h2>Operator Dashboard</h2>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

export default OperatorDashboard;
