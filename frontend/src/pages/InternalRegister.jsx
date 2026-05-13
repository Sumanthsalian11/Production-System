import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import BASE_URL from "../config/api";

function InternalRegister() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [editUserId, setEditUserId] = useState(null);
  const [success, setSuccess] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [locations, setLocations] = useState([]);
const [editLocations, setEditLocations] = useState([]);
const [selectedLocations, setSelectedLocations] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "ADMIN"
  });

const [editData, setEditData] = useState({
  name: "",
  role: "",
  password: ""
});
  const fetchUsers = async () => {
    const token = localStorage.getItem("token");

    const res = await axios.get(
      `${BASE_URL}/api/auth/internal/users`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    setUsers(res.data);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value.trim() });
  };

  const validateForm = () => {
    const { email, password, confirmPassword } = form;

    const emailRegex =
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;

    if (!emailRegex.test(email)) return "Invalid email";
    if (password !== confirmPassword) return "Passwords do not match";

    return null;
  };

  const fetchLocations = async () => {
  const token = localStorage.getItem("token");

  const res = await axios.get(
    `${BASE_URL}/api/master/locations`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  setLocations(res.data);
};

useEffect(() => {
  fetchLocations(); // ✅ ADD THIS
}, []);

const handleLocationChange = (name) => {
  setSelectedLocations((prev) =>
    prev.includes(name)
      ? prev.filter((loc) => loc !== name)
      : [...prev, name]
  );
};
  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setSuccess(""); // clear previous success

  const validationError = validateForm();
  if (validationError) {
    setError(validationError);
    return;
  }

  // check duplicate email
  const emailExists = users.some(
    (u) => u.email.toLowerCase() === form.email.toLowerCase()
  );

  if (emailExists) {
    setError("User with this email already exists");
    return;
  }

  try {
   await axios.post(
  `${BASE_URL}/api/auth/internal/register`,
  {
    ...form,
    locations: selectedLocations // ✅ SEND THIS
  }
);
setSelectedLocations([]);
    // ✅ SUCCESS MESSAGE
      setSuccess("User registered successfully ✅");

  // 🔥 AUTO HIDE AFTER 3 SEC
  setTimeout(() => {
    setSuccess("");
  }, 2000);

    // clear form
    setForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "ADMIN"
    });

    fetchUsers();

  } catch (err) {
    setError(err.response?.data?.message || "Error");
  }
};

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    const token = localStorage.getItem("token");

    await axios.delete(
      `${BASE_URL}/api/auth/internal/user/${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    fetchUsers();
  };

const startEdit = (user) => {
  setEditUserId(user._id);
  setEditData({
    name: user.name,
    role: user.role,
    password: ""
  });

  // ✅ load existing locations
setEditLocations(user.locations || []);
};
const handleEditLocationChange = (name) => {
  setEditLocations((prev) =>
    prev.includes(name)
      ? prev.filter((loc) => loc !== name)
      : [...prev, name]
  );
};
const saveEdit = async (id) => {
  const token = localStorage.getItem("token");

  try {
    await axios.put(
      `${BASE_URL}/api/auth/internal/user/${id}`,
      {
        ...editData,
        locations: editLocations // ✅ send selected locations too
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setEditUserId(null);
    fetchUsers();
  } catch (err) {
    setError(err.response?.data?.message || "Failed to update user");
  }
};

  return (
    <div className="container py-4 ">

      <h2 className="mb-4 fw-bold text-dark text-center ">👨‍💼User Management</h2>

      {/* ===== REGISTER CARD ===== */}
      <div className="card shadow-sm mb-4 border-0 ">
        <div className="card-body ">
         <h5 className="card-title mb-3 ">➕ Add New User</h5>

{error && <div className="alert alert-danger">{error}</div>}

{success && (
  <div className="alert alert-success">
    {success}
  </div>
)}
          <form onSubmit={handleSubmit} className="row g-3">

            <div className="col-md-6 ">
             <input
  name="name"
  value={form.name}
  className="form-control  border-black"
  placeholder="Full Name"
  onChange={handleChange}
  required
/>
            </div>

            <div className="col-md-6">
             <input
  name="email"
  type="email"
  value={form.email}
  className="form-control  border-black"
  placeholder="Email"
  onChange={handleChange}
  required
/>
            </div>

          <div className="col-md-6 position-relative">
  <input
    name="password"
    type={showPassword ? "text" : "password"}
    value={form.password}
    className="form-control border-black pe-5"
    placeholder="Password"
    onChange={handleChange}
    required
  />

  <span
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: "absolute",
      right: "15px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer"
    }}
  >
    {showPassword ? "🙈" : "👁️"}
  </span>
</div>

           <div className="col-md-6 position-relative">
  <input
    name="confirmPassword"
    type={showConfirmPassword ? "text" : "password"}
    value={form.confirmPassword}
    className="form-control border-black pe-5"
    placeholder="Confirm Password"
    onChange={handleChange}
    required
  />

  <span
    onClick={() =>
      setShowConfirmPassword(!showConfirmPassword)
    }
    style={{
      position: "absolute",
      right: "15px",
      top: "50%",
      transform: "translateY(-50%)",
      cursor: "pointer"
    }}
  >
    {showConfirmPassword ? "🙈" : "👁️"}
  </span>
</div>

            <div className="col-md-6">
             <select
  name="role"
  value={form.role}
  className="form-select  border-black"
  onChange={handleChange}
>
                <option value="ADMIN">ADMIN</option>
                <option value="PLANNER">PLANNER</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="PURCHASE ORDER">PURCHASE ORDER</option>
                <option value="DISPATCH">DISPATCH</option>
                <option value="PRINTING">PRINTING</option>
              </select>
            </div>

<div className="col-12">
  <label className="fw-bold mb-2">Assign Locations</label>

  <div className="d-flex flex-wrap gap-3">
    {locations.map((loc) => (
      <label key={loc._id} className="form-check">
        <input
          type="checkbox"
          className="form-check-input border-black"
         checked={selectedLocations.includes(loc.locationName)}
onChange={() => handleLocationChange(loc.locationName)}
        />
        <span className="ms-1">{loc.locationName}</span>
      </label>
    ))}
  </div>
</div>
            <div className="col-12">
              <button className="btn btn-primary px-4">
                Add User
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* ===== USER TABLE ===== */}
      <div className="card shadow-sm border-0 ">
        <div className="card-body">

          <h5 className="mb-3">📋 All Users</h5>

          <div className="table-responsive">
            <table className="table table-hover align-middle">

              <thead className="table-dark">
                <tr>
                  <th>Name</th>
<th>Email</th>
<th>Role</th>
 <th>Locations</th> 
                  <th>Password Reset</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>

                    <td>
  {editUserId === user._id ? (
    <input
      className="form-control"
      value={editData.name}
      onChange={(e) =>
        setEditData({ ...editData, name: e.target.value })
      }
    />
  ) : (
    user.name
  )}
</td>

<td>{user.email}</td>

                    <td>
                      {editUserId === user._id ? (
                        <select
                          className="form-select"
                          value={editData.role}
                          onChange={(e) =>
                            setEditData({ ...editData, role: e.target.value })}>
                          <option>ADMIN</option>
                          <option>PLANNER</option>
                          <option>SUPERVISOR</option>
                          <option>PRODUCTION</option>
                          <option>PURCHASE ORDER</option>
                          <option>DISPATCH</option>
                          <option>PRINTING</option>
                        </select>
                      ) : (
                        <span className="badge bg-info text-dark">
                          {user.role}
                        </span>
                      )}
                    </td>

    <td>
  {editUserId === user._id ? (
    <div className="d-flex flex-wrap gap-2">
      {locations.map((loc) => (
        <label key={loc._id} className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
        checked={editLocations.includes(loc.locationName)}
onChange={() => handleEditLocationChange(loc.locationName)}
          />
          <span className="ms-1">{loc.locationName}</span>
        </label>
      ))}
    </div>
  ) : (
    user.locations?.join(", ")
  )}
</td>

                   <td>
  {editUserId === user._id ? (
    <input
      type="password"
      className="form-control"
      placeholder="New Password"
      onChange={(e) =>
        setEditData({ ...editData, password: e.target.value })
      }
    />
  ) : (
    <span className="text-black fw-bold">
      ********
    </span>
  )}
</td>

                    <td className="text-center">
                      {editUserId === user._id ? (
                        <>
                          <button
                            className="btn btn-success btn-sm me-2"
                            onClick={() => saveEdit(user._id)}
                          >
                            💾 Save
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditUserId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-warning btn-sm me-2"
                            onClick={() => startEdit(user)}
                          >
                            ✏️ Edit
                          </button>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteUser(user._id)}
                          >
                            ❌ Delete
                          </button>
                        </>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>

        </div>
      </div>

    </div>
  );
}

export default InternalRegister;