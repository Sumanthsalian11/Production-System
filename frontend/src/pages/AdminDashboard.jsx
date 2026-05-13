import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import DashboardLayout from "../components/DashboardLayout";
import "../styles/adminPro.css";
import BASE_URL from "../config/api";

import { motion } from "framer-motion";
import {
  Users,
  Package,
  MapPin,
  Layers,
  Activity,
  PlusCircle,
  LogOut,
  Factory,
} from "lucide-react";

function AdminDashboard() {
  const navigate = useNavigate();
const [editingId, setEditingId] = useState(null);
const [editingValue, setEditingValue] = useState("");
const [editingData, setEditingData] = useState({});
const [searchItemCode, setSearchItemCode] = useState("");
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [showMachineCapacity, setShowMachineCapacity] = useState(false);
  const [activities, setActivities] = useState([]);
  const [searchMaterialCode, setSearchMaterialCode] = useState("");
  const [newActivity, setNewActivity] = useState({ activityName: "", machines: [] });
  const [machines, setMachines] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
 const [priorities, setPriorities] = useState([]);
 const [machineStatuses, setMachineStatuses] = useState([]);
const [newMachineStatus, setNewMachineStatus] = useState("");
 const [transportations, setTransportations] = useState([]);
const [newTransportation, setNewTransportation] = useState("");
const [newPriority, setNewPriority] = useState("");
  const [orders, setOrders] = useState([]);
  const [newLocation, setNewLocation] = useState({
  locationName: "",
  address: ""
});

const [freightChargeTypes, setFreightChargeTypes] = useState([]);
const [freightTypes, setFreightTypes] = useState([]);

const [newFreightCharge, setNewFreightCharge] = useState("");
const [newFreightType, setNewFreightType] = useState("");

const [showFreightChargeList, setShowFreightChargeList] = useState(false);
const [showFreightTypeList, setShowFreightTypeList] = useState(false);
 const [newItem, setNewItem] = useState({
  itemCode: "",
  customerName: "",
  description: "",
  materialType: "",
  colorFront: "",
  colorBack: "",
  wasteQty: "",
  jobSize: "",
  inkDetails: ""
});
const [branches, setBranches] = useState([]);

const [newBranch, setNewBranch] = useState({
  branchCode: "",
  dispatchAddress: ""
});

const [showBranchList, setShowBranchList] = useState(false);
const [showItemList, setShowItemList] = useState(false);
const [showPriorityList, setShowPriorityList] = useState(false);
const [showTransportationList, setShowTransportationList] = useState(false);
const [showMachineStatusList, setShowMachineStatusList] = useState(false);
const [showMachineList, setShowMachineList] = useState(false);
const [showActivityList, setShowActivityList] = useState(false);
const [showLocationList, setShowLocationList] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
const [machineCapacity, setMachineCapacity] = useState({});
  const [newCustomer, setNewCustomer] = useState("");
  const [newMachine, setNewMachine] = useState("");
const [innerPackings, setInnerPackings] = useState([]);
const [newInnerPacking, setNewInnerPacking] = useState({
  type: "",
  leavesPerInner: "",
  innerPack: "",
  outerPack: "",
  innerPerOuter: ""
});

const [showInnerPackingList, setShowInnerPackingList] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    code: "",
    description: "",
    group: "",
    mill: "",
    gsm: "",
    paperSize:""
  });

  const [showMaterialList, setShowMaterialList] = useState(false);

  const token = localStorage.getItem("token");

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    fetchMasters();
      fetchMachineCapacity();   
  }, []);
const thStyle = {
  padding: "10px",
  border: "1px solid #ddd",
  textAlign: "left"
};

const tdStyle = {
  padding: "10px",
  border: "1px solid #ddd"
};

const inputStyle = {
  padding: "6px",
  width: "100%",
  borderRadius: "5px",
  border: "1px solid #ccc"
};

const btnStyle = {
  padding: "6px 12px",
  backgroundColor: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer"
};

  const fetchMasters = async () => {
    const config = { headers: { Authorization: `Bearer ${token}` } };

const [
  cust,
  item,
  mach,
  loc,
  mat,
  act,
  pri,
  trans,
  status,
  inner,
  branches,
  fcharge,
  ftype
]= await Promise.all([
  axios.get(`${BASE_URL}/api/master/customers`, config),
  axios.get(`${BASE_URL}/api/master/items`, config),
  axios.get(`${BASE_URL}/api/master/machines`, config),
  axios.get(`${BASE_URL}/api/master/locations`, config),
  axios.get(`${BASE_URL}/api/master/materials`, config),
  axios.get(`${BASE_URL}/api/master/activities`, config),
  axios.get(`${BASE_URL}/api/master/priorities`, config),
  axios.get(`${BASE_URL}/api/master/transportations`, config),
  axios.get(`${BASE_URL}/api/master/machine-status`, config),
  axios.get(`${BASE_URL}/api/master/inner-packing`, config),
axios.get(`${BASE_URL}/api/master/branch`, config),
  // ✅ NEW
  axios.get(`${BASE_URL}/api/master/freight-charge-types`, config),
  axios.get(`${BASE_URL}/api/master/freight-types`, config),
]);

setBranches(branches.data);
setCustomers(cust.data);
setItems(item.data);
setMachines(mach.data);
setLocations(loc.data);
setMaterials(mat.data);
setActivities(act.data);
setPriorities(pri.data);
setTransportations(trans.data);
setMachineStatuses(status.data);
setInnerPackings(inner.data);
setFreightChargeTypes(fcharge.data);
setFreightTypes(ftype.data);
  };

  const fetchOrdersByCustomer = async (id) => {
    if (!id) return setOrders([]);
    const res = await axios.get(
      `${BASE_URL}/api/customer-orders?customerId=${id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setOrders(res.data);
  };

const fetchMachineCapacity = async () => {
  try {
    const res = await axios.get("http://localhost:5000/api/capacity");

    const capacityMap = {};

    res.data.forEach((item) => {
      capacityMap[item.machineId] = item.capacityPerHour;
    });

    setMachineCapacity(capacityMap);
  } catch (err) {
    console.error("Error fetching capacity:", err);
  }
};
  const addCustomer = async () => {
    if (!newCustomer) return;
    await axios.post(
      `${BASE_URL}/api/master/customer`,
      { name: newCustomer },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewCustomer("");
    fetchMasters();
  };
const addFreightCharge = async () => {
  if (!newFreightCharge.trim()) return;

  await axios.post(`${BASE_URL}/api/master/freight-charge-types`,
    { name: newFreightCharge },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setNewFreightCharge("");
  fetchMasters();
};

const addFreightType = async () => {
  if (!newFreightType.trim()) return;

  await axios.post(`${BASE_URL}/api/master/freight-types`,
    { name: newFreightType },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setNewFreightType("");
  fetchMasters();
};
const addBranch = async () => {

  if (!newBranch.branchCode) return;

  await axios.post(
    `${BASE_URL}/api/master/branch`,
    newBranch,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  setNewBranch({
    branchCode: "",
    dispatchAddress: ""
  });

  fetchMasters();
};
const addInnerPacking = async () => {
  if (!newInnerPacking.type) return;

  await axios.post(
    `${BASE_URL}/api/master/inner-packing`,
    newInnerPacking,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setNewInnerPacking({
    type: "", 
    leavesPerInner: "",
    innerPack: "",
    outerPack: "",
    innerPerOuter: ""
  });

  fetchMasters();
};

const addTransportation = async () => {
  if (!newTransportation.trim()) return;

  await axios.post(
    `${BASE_URL}/api/master/transportations`,
    { name: newTransportation.trim() },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setNewTransportation("");
  fetchMasters();
};

const addItem = async () => {
  if (!newItem.itemCode) return;

axios.post(`${BASE_URL}/api/master/items`,
    newItem,
    { headers: { Authorization: `Bearer ${token}` } }
  );

 setNewItem({
  itemCode: "",
  customerName: "",
  description: "",
  materialType: "",
  colorFront: "",
  colorBack: "",
  wasteQty: "",
  jobSize: "",
  inkDetails: ""
});

  fetchMasters();
};
  const addPriority = async () => {
  if (!newPriority.trim()) return;

axios.post(`${BASE_URL}/api/master/priorities`,
    { name: newPriority.trim() },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setNewPriority("");
  fetchMasters();
};
  const addMachine = async () => {
    if (!newMachine) return;
   axios.post(`${BASE_URL}/api/master/machine`,
      { machineName: newMachine },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewMachine("");
    fetchMasters();
  };

  const handleActivityMachineChange = (id) => {
    setNewActivity((prev) => ({
      ...prev,
      machines: prev.machines.includes(id)
        ? prev.machines.filter((m) => m !== id)
        : [...prev.machines, id],
    }));
  };

  const addActivity = async () => {
    if (!newActivity.activityName || newActivity.machines.length === 0) return;
   axios.post(`${BASE_URL}/api/master/activities`,
      newActivity,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewActivity({ activityName: "", machines: [] });
    fetchMasters();
  };

  const addMachineStatus = async () => {

  if (!newMachineStatus.trim()) return;

  const exists = machineStatuses.some(
    s => s.statusName.toLowerCase() === newMachineStatus.toLowerCase()
  );

  if (exists) {
    alert("Status already exists");
    return;
  }

  axios.post(`${BASE_URL}/api/master/machine-status`,
    { statusName: newMachineStatus.trim() },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setNewMachineStatus("");
  fetchMasters();
};

const addLocation = async () => {
  if (!newLocation.locationName || !newLocation.address) return;

axios.post(`${BASE_URL}/api/master/location`,
    newLocation,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setNewLocation({ locationName: "", address: "" });
  fetchMasters();
};

  const addMaterial = async () => {
    if (!newMaterial.code) return;
   axios.post(`${BASE_URL}/api/master/materials`,
      newMaterial,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setNewMaterial({ code: "", description: "", group: "", mill: "", gsm: "",paperSize:"" });
    fetchMasters();
  };

const updateMaster = async (url, id, data) => {
  // For string updates, trim and validate
  if ((typeof data === "string" && !data.trim()) || (typeof data === "object" && Object.keys(data).length === 0)) {
    alert("Value cannot be empty");
    return;
  }

  // For string, wrap in an object
  const payload = typeof data === "string" ? { name: data } : data;

  try {
    axios.put(`${BASE_URL}/api/master/${url}/${id}`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setEditingId(null);
    setEditingValue("");
    setEditingData({});
    fetchMasters();
  } catch (err) {
    console.error("Update failed:", err.response?.data || err.message);
    alert("Update failed: " + (err.response?.data?.message || err.message));
  }
};
const deleteMaster = async (url, id) => {
  if (!window.confirm("Are you sure you want to delete?")) return;

  
axios.delete(`${BASE_URL}/api/master/${url}/${id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  fetchMasters();
};

const getMachineNameById = (id) => {
    const machine = machines.find((m) => m._id === id);
    return machine ? machine.machineName : "Unknown";
  };
const filteredItems = items.filter((item) =>
  item.itemCode?.toLowerCase().includes(searchItemCode.toLowerCase())
);
const filteredMaterials = materials.filter((m) =>
  m.code?.toLowerCase().includes(searchMaterialCode.toLowerCase())
);
  return (
      <motion.div
        className="pro-container"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        {/* HEADER */}
        <div className="pro-header">
          <h1>Admin Control Center</h1>
          <button className="pro-btn primary" onClick={logout}>
            <LogOut size={16}/> Logout
          </button>
        </div>
     {/* PRIORITIES */}
<motion.div className="pro-card">
  <div className="pro-card-header">
    <span>Priorities</span>
  </div>

  {/* ADD PRIORITY */}
  <div className="pro-form-row">
    <input
      className="pro-input"
      placeholder="Priority Name"
      value={newPriority}
      onChange={(e) => setNewPriority(e.target.value)}
    />
    <button className="pro-btn primary" onClick={addPriority}>
      <PlusCircle size={16} /> Add
    </button>
  </div>

<div
  className="material-toggle"
  onClick={() => setShowPriorityList(!showPriorityList)}
>
  {showPriorityList ? "Hide Priorities ▲" : "Show Priorities ▼"}
</div>

{showPriorityList && (
<ul className="pro-list">
    {priorities.map((p) => (
      <li key={p._id} className="d-flex justify-content-between align-items-center">
        {editingId === p._id ? (
          <>
            <input
              className="pro-input"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
            />
            <button
              className="pro-btn primary"
              onClick={() => updateMaster("priorities", p._id, { name: editingValue })}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <span>{p.name}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="pro-btn"
                onClick={() => {
                  setEditingId(p._id);
                  setEditingValue(p.name);
                }}
              >
                Edit
              </button>
              <button
                className="pro-btn"
                onClick={() => deleteMaster("priorities", p._id)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </li>
    ))}
  </ul>
  )}
</motion.div>
<motion.div className="pro-card">

  <div className="pro-card-header">
    <span>Branch Master</span>
  </div>

  <div className="pro-grid">

    <input
      className="pro-input"
      placeholder="Branch Code"
      value={newBranch.branchCode}
      onChange={(e) =>
        setNewBranch({
          ...newBranch,
          branchCode: e.target.value
        })
      }
    />

    <textarea
      className="pro-input"
      placeholder="Dispatch Address"
      value={newBranch.dispatchAddress}
      onChange={(e) =>
        setNewBranch({
          ...newBranch,
          dispatchAddress: e.target.value
        })
      }
    />

  </div>

  <button
    className="pro-btn primary"
    onClick={addBranch}
  >
    Add Branch
  </button>

  <div
    className="material-toggle"
    onClick={() =>
      setShowBranchList(!showBranchList)
    }
  >
    {showBranchList
      ? "Hide Branches ▲"
      : "Show Branches ▼"}
  </div>

  {showBranchList && (

    <ul className="pro-list">

      {branches.map((b) => (

        <li
          key={b._id}
          className="d-flex justify-content-between align-items-center"
        >

          {editingId === b._id ? (
            <>

              <div className="pro-grid">

                <input
                  className="pro-input"
                  value={editingData.branchCode || ""}
                  onChange={(e) =>
                    setEditingData({
                      ...editingData,
                      branchCode: e.target.value
                    })
                  }
                />

                <textarea
                  className="pro-input"
                  value={editingData.dispatchAddress || ""}
                  onChange={(e) =>
                    setEditingData({
                      ...editingData,
                      dispatchAddress: e.target.value
                    })
                  }
                />

              </div>

              <button
                className="pro-btn primary"
                onClick={() =>
                  updateMaster(
                    "branch",
                    b._id,
                    editingData
                  )
                }
              >
                Save
              </button>

            </>
          ) : (
            <>

              <span>
                <strong>{b.branchCode}</strong>
                {" • "}
                {b.dispatchAddress}
              </span>

              <div
                style={{
                  display: "flex",
                  gap: "8px"
                }}
              >

                <button
                  className="pro-btn"
                  onClick={() => {

                    setEditingId(b._id);

                    setEditingData({
                      branchCode: b.branchCode,
                      dispatchAddress: b.dispatchAddress
                    });

                  }}
                >
                  Edit
                </button>

                <button
                  className="pro-btn"
                  onClick={() =>
                    deleteMaster("branch", b._id)
                  }
                >
                  Delete
                </button>

              </div>

            </>
          )}

        </li>

      ))}

    </ul>

  )}

</motion.div>
<motion.div className="pro-card">

  <div className="pro-card-header">
    <span>Inner Packing</span>
  </div>

  <div className="pro-grid">

   <input
  className="pro-input"
  placeholder="Type"
  value={newInnerPacking.type}
  onChange={(e) =>
    setNewInnerPacking({
      ...newInnerPacking,
      type: e.target.value
    })
  }
/>

<input
  className="pro-input"
  placeholder="Leaves Per Inner"
  value={newInnerPacking.leavesPerInner}
  onChange={(e) =>
    setNewInnerPacking({
      ...newInnerPacking,
      leavesPerInner: e.target.value
    })
  }
/>

<input
  className="pro-input"
  placeholder="Inner Pack"
  value={newInnerPacking.innerPack}
  onChange={(e) =>
    setNewInnerPacking({
      ...newInnerPacking,
      innerPack: e.target.value
    })
  }
/>

<input
  className="pro-input"
  placeholder="Outer Pack"
  value={newInnerPacking.outerPack}
  onChange={(e) =>
    setNewInnerPacking({
      ...newInnerPacking,
      outerPack: e.target.value
    })
  }
/>

<input
  className="pro-input"
  placeholder="Inner Per Outer"
  value={newInnerPacking.innerPerOuter}
  onChange={(e) =>
    setNewInnerPacking({
      ...newInnerPacking,
      innerPerOuter: e.target.value
    })
  }
/>
  </div>

  <button className="pro-btn primary" onClick={addInnerPacking}>
    Add Inner Packing
  </button>

  <div
    className="material-toggle"
    onClick={()=>setShowInnerPackingList(!showInnerPackingList)}
  >
    {showInnerPackingList ? "Hide Inner Packing ▲" : "Show Inner Packing ▼"}
  </div>

  {showInnerPackingList && (
    <ul className="pro-list">
  {innerPackings.map((i) => (
    <li key={i._id} className="d-flex justify-content-between align-items-center">

     {editingId === i._id ? (
  <>
    <div className="pro-grid">

      <input
        className="pro-input"
        placeholder="Type"
        value={editingData.type || ""}
        onChange={(e) =>
          setEditingData({
            ...editingData,
            type: e.target.value
          })
        }
      />

      <input
        className="pro-input"
        placeholder="Leaves Per Inner"
        value={editingData.leavesPerInner || ""}
        onChange={(e) =>
          setEditingData({
            ...editingData,
            leavesPerInner: e.target.value
          })
        }
      />

      <input
        className="pro-input"
        placeholder="Inner Pack"
        value={editingData.innerPack || ""}
        onChange={(e) =>
          setEditingData({
            ...editingData,
            innerPack: e.target.value
          })
        }
      />

      <input
        className="pro-input"
        placeholder="Outer Pack"
        value={editingData.outerPack || ""}
        onChange={(e) =>
          setEditingData({
            ...editingData,
            outerPack: e.target.value
          })
        }
      />

      <input
        className="pro-input"
        placeholder="Inner Per Outer"
        value={editingData.innerPerOuter || ""}
        onChange={(e) =>
          setEditingData({
            ...editingData,
            innerPerOuter: e.target.value
          })
        }
      />

    </div>

    <button
      className="pro-btn primary"
      onClick={() =>
        updateMaster("inner-packing", i._id, editingData)
      }
    >
      Save
    </button>
  </>
) : (
        <>
          <span><strong>{i.type}</strong> •{i.leavesPerInner} •{i.innerPack} •{i.outerPack} •{i.innerPerOuter} </span>

          <div style={{ display: "flex", gap: "8px" }}>
           <button
  className="pro-btn"
  onClick={() => {
    setEditingId(i._id);

    setEditingData({
      type: i.type,
      leavesPerInner: i.leavesPerInner,
      innerPack: i.innerPack,
      outerPack: i.outerPack,
      innerPerOuter: i.innerPerOuter
    });
  }}
>
  Edit
</button>

            <button
              className="pro-btn"
              onClick={() => deleteMaster("inner-packing", i._id)}
            >
              Delete
            </button>
          </div>
        </>
      )}

    </li>
  ))}
</ul>
  )}

</motion.div>
        
{/* ITEMS */}
<motion.div className="pro-card">
  <div className="pro-card-header">
    <span><Package size={18}/> Items</span>
  </div>

  {/* INPUTS ALWAYS VISIBLE */}
  <div className="pro-grid">
    <input
      className="pro-input"
      placeholder="Item Code (SFG Code)"
      value={newItem.itemCode}
      onChange={(e) =>
        setNewItem({ ...newItem, itemCode: e.target.value })
      }
    />

    <input
      className="pro-input"
      placeholder="Customer Name"
      value={newItem.customerName}
      onChange={(e) =>
        setNewItem({ ...newItem, customerName: e.target.value })
      }
    />

    <input
      className="pro-input"
      placeholder="Description"
      value={newItem.description}
      onChange={(e) =>
        setNewItem({ ...newItem, description: e.target.value })
      }
    />

    <input
      className="pro-input"
      placeholder="Material Type"
      value={newItem.materialType}
      onChange={(e) =>
        setNewItem({ ...newItem, materialType: e.target.value })
      }
    />
    <input
  className="pro-input"
  placeholder="Front Colors"
  value={newItem.colorFront}
  onChange={(e) =>
    setNewItem({ ...newItem, colorFront: e.target.value })
  }
/>

<input
  className="pro-input"
  placeholder="Back Colors"
  value={newItem.colorBack}
  onChange={(e) =>
    setNewItem({ ...newItem, colorBack: e.target.value })
  }
/>

<input
  className="pro-input"
  placeholder="Waste Quantity"
  value={newItem.wasteQty}
  onChange={(e) =>
    setNewItem({ ...newItem, wasteQty: e.target.value })
  }
/>

<input
  className="pro-input"
  placeholder="Job Size"
  value={newItem.jobSize}
  onChange={(e) =>
    setNewItem({ ...newItem, jobSize: e.target.value })
  }
/>

<input
  className="pro-input"
  placeholder="Ink Details"
  value={newItem.inkDetails}
  onChange={(e) =>
    setNewItem({ ...newItem, inkDetails: e.target.value })
  }
/>
  </div>

  <button className="pro-btn primary" onClick={addItem}>
    Add Item
  </button>
  <div style={{ marginTop: "12px", fontSize: "14px", color: "#555" }}>
  <label style={{ marginTop: "10px", fontSize: "14px", color: "#050505" }}><b>Search by Item Code:</b></label>  
  <input
  className="pro-input"
  placeholder="🔍 Search by Item Code..."
  value={searchItemCode}
  onChange={(e) => setSearchItemCode(e.target.value)}
  style={{ marginTop: "10px" }}
/>
</div>
  {/* TOGGLE STORED LIST */}
  <div
    className="material-toggle"
    onClick={() => setShowItemList(!showItemList)}
  >
    {showItemList ? "Hide Stored Items ▲" : "Show Stored Items ▼"}
  </div>

 {showItemList && (
  <motion.ul
    className="pro-list"
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
  >
 {filteredItems.map((i) => (
  <li key={i._id} className="d-flex justify-content-between align-items-center">

    {editingId === i._id ? (
      <>
        <div className="pro-grid">
          <input
            className="pro-input"
            value={editingData.itemCode}
            onChange={(e) =>
              setEditingData({ ...editingData, itemCode: e.target.value })
            }
          />
          <input
            className="pro-input"
            value={editingData.customerName}
            onChange={(e) =>
              setEditingData({ ...editingData, customerName: e.target.value })
            }
          />
          <input
            className="pro-input"
            value={editingData.description}
            onChange={(e) =>
              setEditingData({ ...editingData, description: e.target.value })
            }
          />
          <input
            className="pro-input"
            value={editingData.materialType}
            onChange={(e) =>
              setEditingData({ ...editingData, materialType: e.target.value })
            }
          />
          <input
className="pro-input"
placeholder="Front Colors"
value={editingData.colorFront}
onChange={(e)=>
setEditingData({...editingData,colorFront:e.target.value})
}
/>

<input
className="pro-input"
placeholder="Back Colors"
value={editingData.colorBack}
onChange={(e)=>
setEditingData({...editingData,colorBack:e.target.value})
}
/>

<input
className="pro-input"
placeholder="Waste Qty"
value={editingData.wasteQty}
onChange={(e)=>
setEditingData({...editingData,wasteQty:e.target.value})
}
/>

<input
className="pro-input"
placeholder="Job Size"
value={editingData.jobSize}
onChange={(e)=>
setEditingData({...editingData,jobSize:e.target.value})
}
/>

<input
className="pro-input"
placeholder="Ink Details"
value={editingData.inkDetails}
onChange={(e)=>
setEditingData({...editingData,inkDetails:e.target.value})
}
/>
        </div>

        <button
          className="pro-btn primary"
          onClick={() => updateMaster("items", i._id, editingData)}
        >
          Save
        </button>
      </>
    ) : (
      <>
       <span>
<strong>{i.itemCode}</strong> • {i.customerName} • {i.description} • {i.materialType}
•{i.colorFront} •{i.colorBack} •{i.wasteQty} •{i.jobSize}
</span>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="pro-btn"
            onClick={() => {
              setEditingId(i._id);
              setEditingData({
                itemCode: i.itemCode,
  customerName: i.customerName,
  description: i.description,
  materialType: i.materialType,
  colorFront: i.colorFront,
  colorBack: i.colorBack,
  wasteQty: i.wasteQty,
  jobSize: i.jobSize,
  inkDetails: i.inkDetails
              });
            }}
          >
            Edit
          </button>

          <button
            className="pro-btn"
            onClick={() => deleteMaster("items", i._id)}
          >
            Delete
          </button>
        </div>
      </>
    )}

  </li>
))}
  </motion.ul>
)}
</motion.div>
{/* TRANSPORTATIONS */}
<motion.div className="pro-card">
  <div className="pro-card-header">
    <span><Factory size={18}/> Transportation</span>
  </div>

  <div className="pro-form-row">
    <input
      className="pro-input"
      placeholder="Transportation Name"
      value={newTransportation}
      onChange={(e) => setNewTransportation(e.target.value)}
    />

    <button className="pro-btn primary" onClick={addTransportation}>
      <PlusCircle size={16}/> Add
    </button>
  </div>

  <div
  className="material-toggle"
  onClick={() => setShowTransportationList(!showTransportationList)}
>
  {showTransportationList
    ? "Hide Stored Transportations ▲"
    : "Show Stored Transportations ▼"}
</div>

{showTransportationList && (
<ul className="pro-list">
  {transportations.map((t) => (
    <li key={t._id} className="d-flex justify-content-between align-items-center">

      {editingId === t._id ? (
        <>
          <input
            className="pro-input"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
          />

          <button
            className="pro-btn primary"
            onClick={() =>
              updateMaster("transportations", t._id, { name: editingValue })
            }
          >
            Save
          </button>
        </>
      ) : (
        <>
          <span>{t.name}</span>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="pro-btn"
              onClick={() => {
                setEditingId(t._id);
                setEditingValue(t.name);
              }}
            >
              Edit
            </button>

            <button
              className="pro-btn"
              onClick={() => deleteMaster("transportations", t._id)}
            >
              Delete
            </button>
          </div>
        </>
      )}

    </li>
  ))}
</ul>
)}
</motion.div>
<motion.div className="pro-card">
  <div className="pro-card-header">
    <span>Freight Charge Type</span>
  </div>

  <div className="pro-form-row">
    <input
      className="pro-input"
      placeholder="Freight Charge Type"
      value={newFreightCharge}
      onChange={(e) => setNewFreightCharge(e.target.value)}
    />

    <button className="pro-btn primary" onClick={addFreightCharge}>
      Add
    </button>
  </div>

  <div
    className="material-toggle"
    onClick={() => setShowFreightChargeList(!showFreightChargeList)}
  >
    {showFreightChargeList ? "Hide ▲" : "Show ▼"}
  </div>

  {showFreightChargeList && (
    <ul className="pro-list">
      {freightChargeTypes.map((f) => (
        <li key={f._id} className="d-flex justify-content-between">

          {editingId === f._id ? (
            <>
              <input
                className="pro-input"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
              />

              <button
                className="pro-btn primary"
                onClick={() =>
                  updateMaster("freight-charge-types", f._id, { name: editingValue })
                }
              >
                Save
              </button>
            </>
          ) : (
            <>
              <span>{f.name}</span>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="pro-btn"
                  onClick={() => {
                    setEditingId(f._id);
                    setEditingValue(f.name);
                  }}
                >
                  Edit
                </button>

                <button
                  className="pro-btn"
                  onClick={() => deleteMaster("freight-charge-types", f._id)}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  )}
</motion.div>

<motion.div className="pro-card">
  <div className="pro-card-header">
    <span>Freight Type</span>
  </div>

  <div className="pro-form-row">
    <input
      className="pro-input"
      placeholder="Freight Type"
      value={newFreightType}
      onChange={(e) => setNewFreightType(e.target.value)}
    />

    <button className="pro-btn primary" onClick={addFreightType}>
      Add
    </button>
  </div>

  <div
    className="material-toggle"
    onClick={() => setShowFreightTypeList(!showFreightTypeList)}
  >
    {showFreightTypeList ? "Hide ▲" : "Show ▼"}
  </div>

  {showFreightTypeList && (
    <ul className="pro-list">
      {freightTypes.map((f) => (
        <li key={f._id} className="d-flex justify-content-between">

          {editingId === f._id ? (
            <>
              <input
                className="pro-input"
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
              />

              <button
                className="pro-btn primary"
                onClick={() =>
                  updateMaster("freight-types", f._id, { name: editingValue })
                }
              >
                Save
              </button>
            </>
          ) : (
            <>
              <span>{f.name}</span>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="pro-btn"
                  onClick={() => {
                    setEditingId(f._id);
                    setEditingValue(f.name);
                  }}
                >
                  Edit
                </button>

                <button
                  className="pro-btn"
                  onClick={() => deleteMaster("freight-types", f._id)}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  )}
</motion.div>

{/* MACHINE STATUS */}
<motion.div className="pro-card">

  <div className="pro-card-header">
    <span><Activity size={18}/> Machine Status</span>
  </div>

  <div className="pro-form-row">

    <input
      className="pro-input"
      placeholder="Machine Status"
      value={newMachineStatus}
      onChange={(e)=>setNewMachineStatus(e.target.value)}
    />

    <button className="pro-btn primary" onClick={addMachineStatus}>
      <PlusCircle size={16}/> Add
    </button>

  </div>

<div
  className="material-toggle"
  onClick={() => setShowMachineStatusList(!showMachineStatusList)}
>
  {showMachineStatusList ? "Hide Machine Status ▲" : "Show Machine Status ▼"}
</div>

{showMachineStatusList && (
<ul className="pro-list">

    {machineStatuses.map((s)=>(
      <li key={s._id} className="d-flex justify-content-between align-items-center">

        {editingId === s._id ? (
          <>
            <input
              className="pro-input"
              value={editingValue}
              onChange={(e)=>setEditingValue(e.target.value)}
            />

            <button
              className="pro-btn primary"
              onClick={()=>updateMaster("machine-status", s._id, { statusName: editingValue })}
            >
              Save
            </button>
          </>
        ) : (
          <>
           <span>{s.statusName}</span>

            <div style={{display:"flex", gap:"8px"}}>

              <button
                className="pro-btn"
                onClick={()=>{
                  setEditingId(s._id);
                  setEditingValue(s.statusName);
                }}
              >
                Edit
              </button>

              <button
                className="pro-btn"
                onClick={()=>deleteMaster("machine-status", s._id)}
              >
                Delete
              </button>

            </div>
          </>
        )}

      </li>
    ))}

  </ul>
)}

</motion.div>

        {/* MACHINES */}
        <motion.div className="pro-card">
          <div className="pro-card-header"> <span><Factory size={18}/> Machines</span></div>
          <div className="pro-form-row">
            <input className="pro-input" value={newMachine}
              onChange={(e)=>setNewMachine(e.target.value)}
              placeholder="Machine name"/>
            <button className="pro-btn primary" onClick={addMachine}>
              <PlusCircle size={16}/> Add
            </button>
          </div>
      <div
  className="material-toggle"
  onClick={() => setShowMachineList(!showMachineList)}
>
  {showMachineList ? "Hide Machines ▲" : "Show Machines ▼"}
</div>

{showMachineList && (
<ul className="pro-list">
{machines.map((m) => (
  <li key={m._id} className="d-flex justify-content-between align-items-center">

    {editingId === m._id ? (
      <>
        <input
          className="pro-input"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
        />

       <button
  className="pro-btn primary"
  onClick={() =>
    updateMaster("machine", m._id, { machineName: editingValue }) // singular
  }
>
  Save
</button>
      </>
    ) : (
      <>
        <span>{m.machineName}</span>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="pro-btn"
            onClick={() => {
              setEditingId(m._id);
              setEditingValue(m.machineName);
            }}
          >
            Edit
          </button>

          <button
            className="pro-btn"
            onClick={() => deleteMaster("machine", m._id)}
          >
            Delete
          </button>
        </div>
      </>
    )}

  </li>
))}
</ul>
)}
</motion.div>
   
     <motion.div className="pro-card">
   <div
  className="material-toggle"
  onClick={() => setShowMachineCapacity(!showMachineCapacity)}
>
  {showMachineCapacity
    ? "Hide Machine Capacity ▲"
    : "Show Machine Capacity ▼"}
</div>

{showMachineCapacity && (
  <>
    <h3 style={{ marginBottom: "15px" }}>Machine Capacity</h3>

    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ backgroundColor: "#f5f5f5" }}>
          <th style={thStyle}>Machine Name</th>
          <th style={thStyle}>Stored Capacity</th>
          <th style={thStyle}>Edit Capacity</th>
          <th style={thStyle}>Action</th>
        </tr>
      </thead>

      <tbody>
        {machines.map((m) => (
          <tr key={m._id}>
            <td style={tdStyle}>{m.machineName}</td>

            <td style={tdStyle}>
              {machineCapacity[m._id] ? (
                <span style={{ color: "green", fontWeight: "600" }}>
                  {machineCapacity[m._id]} /hr
                </span>
              ) : (
                <span style={{ color: "#999" }}>Not set</span>
              )}
            </td>

            <td style={tdStyle}>
              <input
                type="number"
                placeholder="Enter capacity"
                value={machineCapacity[m._id] || ""}
                onChange={(e) =>
                  setMachineCapacity({
                    ...machineCapacity,
                    [m._id]: e.target.value
                  })
                }
                style={inputStyle}
              />
            </td>

            <td style={tdStyle}>
              <button
                onClick={async () => {
                  try {
                    await axios.post(`${BASE_URL}/api/capacity`, {
                      machineId: m._id,
                      capacityPerHour: machineCapacity[m._id]
                    });

                    fetchMachineCapacity();
                    alert("Capacity saved successfully ✅");
                  } catch (err) {
                    console.error(err);
                    alert("Error saving capacity ❌");
                  }
                }}
                style={btnStyle}
              >
                Save
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
)}  
</motion.div>
        {/* ACTIVITIES */}
       {/* ACTIVITIES */}
<motion.div className="pro-card">
  <div className="pro-card-header"> <span><Activity size={18}/> Activities</span></div>

  {/* Add new activity */}
  <input
    className="pro-input"
    placeholder="Activity name"
    value={newActivity.activityName}
    onChange={(e) => setNewActivity({ ...newActivity, activityName: e.target.value })}
  />
  <div className="pro-chip-wrap">
    {machines.map((m) => (
      <label key={m._id} className="pro-chip">
        <input
          type="checkbox"
          checked={newActivity.machines.includes(m._id)}
          onChange={() => handleActivityMachineChange(m._id)}
        />
        {m.machineName}
      </label>
    ))}
  </div>
  <button className="pro-btn primary" onClick={addActivity}>Add Activity</button>

<div
  className="material-toggle"
  onClick={() => setShowActivityList(!showActivityList)}
>
  {showActivityList ? "Hide Stored Activities ▲" : "Show Stored Activities ▼"}
</div>

{showActivityList && (
<ul className="pro-list">
    {activities.map((a) => (
      <li key={a._id} className="d-flex justify-content-between align-items-center">

        {editingId === a._id ? (
          <>
            <div className="pro-grid">
              <input
                className="pro-input"
                value={editingData.activityName}
                onChange={(e) =>
                  setEditingData({ ...editingData, activityName: e.target.value })
                }
              />
              <div className="pro-chip-wrap">
                {machines.map((m) => (
                  <label key={m._id} className="pro-chip">
                    <input
                      type="checkbox"
                      checked={editingData.machines?.includes(m._id)}
                      onChange={() => {
                        setEditingData((prev) => ({
                          ...prev,
                          machines: prev.machines.includes(m._id)
                            ? prev.machines.filter((id) => id !== m._id)
                            : [...prev.machines, m._id],
                        }));
                      }}
                    />
                    {m.machineName}
                  </label>
                ))}
              </div>
            </div>
            <button
              className="pro-btn primary"
              onClick={() => updateMaster("activities", a._id, editingData)}
            >
              Save
            </button>
          </>
        ) : (
          <>
           <span>
  {a.activityName} —{" "}
  {a.machines
    ?.map((m) => {
      // If machine object already populated, use machineName
      if (m?.machineName) return m.machineName;
      // Otherwise, find machine by ID in current machines list
      const machine = machines.find((mach) => mach._id === (m._id || m));
      return machine?.machineName; // undefined if not found
    })
    .filter(Boolean) // remove undefined/null (deleted machines)
    .join(", ")}
</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="pro-btn"
                onClick={() => {
                  setEditingId(a._id);
                  setEditingData({
                    activityName: a.activityName,
                    machines: a.machines?.map((m) => (m._id ? m._id : m)) || [],
                  });
                }}
              >
                Edit
              </button>
              <button
                className="pro-btn"
                onClick={() => deleteMaster("activities", a._id)}
              >
                Delete
              </button>
            </div>
          </>
        )}

      </li>
    ))}
  </ul>
)}
</motion.div>

        {/* LOCATIONS */}
        <motion.div className="pro-card">
          <div className="pro-card-header"> <span><MapPin size={18}/> Locations</span></div>
      <div className="pro-grid">

  <input
    className="pro-input"
    placeholder="Location Name"
    value={newLocation.locationName}
    onChange={(e) =>
      setNewLocation({ ...newLocation, locationName: e.target.value })
    }
  />

  <input
    className="pro-input"
    placeholder="Address"
    value={newLocation.address}
    onChange={(e) =>
      setNewLocation({ ...newLocation, address: e.target.value })
    }
  />

  <button className="pro-btn primary" onClick={addLocation}>
    <PlusCircle size={16}/> Add
  </button>

</div>
      
         <div
  className="material-toggle"
  onClick={() => setShowLocationList(!showLocationList)}
>
  {showLocationList ? "Hide Stored Locations ▲" : "Show Stored Locations ▼"}
</div>

{showLocationList && (
<ul className="pro-list">
{locations.map((l) => (
  <li key={l._id} className="d-flex justify-content-between align-items-center">

    {editingId === l._id ? (
      <>
        <div className="pro-grid">

  <input
    className="pro-input"
    value={editingData.locationName}
    onChange={(e) =>
      setEditingData({ ...editingData, locationName: e.target.value })
    }
  />

  <input
    className="pro-input"
    value={editingData.address}
    onChange={(e) =>
      setEditingData({ ...editingData, address: e.target.value })
    }
  />

</div>

<button
  className="pro-btn primary"
  onClick={() =>
    updateMaster("location", l._id, editingData)
  }
>
  Save
</button>
      </>
    ) : (
      <>
        <span>
  <strong>{l.locationName}</strong> • {l.address}
</span>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="pro-btn"
           onClick={() => {
  setEditingId(l._id);
  setEditingData({
    locationName: l.locationName,
    address: l.address
  });
}}
          >
            Edit
          </button>

          <button
            className="pro-btn success"
            onClick={() => deleteMaster("location", l._id)}
          >
            Delete
          </button>
        </div>
      </>
    )}

  </li>
))}
</ul>
)}
        </motion.div>

        {/* MATERIALS */}
        <motion.div className="pro-card">
          <div className="pro-card-header">
            <span><Layers size={18}/> Materials</span>
          </div>

          {/* INPUTS ALWAYS VISIBLE */}
          <div className="pro-grid">
            <input className="pro-input" placeholder="Code"
              value={newMaterial.code}
              onChange={(e)=>setNewMaterial({...newMaterial, code:e.target.value})}/>
            <input className="pro-input" placeholder="Description"
              value={newMaterial.description}
              onChange={(e)=>setNewMaterial({...newMaterial, description:e.target.value})}/>
            <input className="pro-input" placeholder="Group"
              value={newMaterial.group}
              onChange={(e)=>setNewMaterial({...newMaterial, group:e.target.value})}/>
            <input className="pro-input" placeholder="Mill"
              value={newMaterial.mill}
              onChange={(e)=>setNewMaterial({...newMaterial, mill:e.target.value})}/>
            <input className="pro-input" placeholder="GSM"
              value={newMaterial.gsm}
              onChange={(e)=>setNewMaterial({...newMaterial, gsm:e.target.value})}/>
               <input className="pro-input" placeholder="PaperSize"
              value={newMaterial.paperSize}
              onChange={(e)=>setNewMaterial({...newMaterial, paperSize:e.target.value})}/>
          </div>

          <button className="pro-btn primary" onClick={addMaterial}>
            Add Material
          </button>
           <div style={{ marginTop: "12px", fontSize: "14px", color: "#555" }}>
<label style={{ marginTop: "10px", fontSize: "14px", color: "#050505" }}><b>Search by Material Code:</b></label>  
<input
  className="pro-input"
  placeholder="🔍 Search by Material Code..."
  value={searchMaterialCode}
  onChange={(e) => setSearchMaterialCode(e.target.value)}
  style={{ marginTop: "10px" }}
/>
</div>
          {/* TOGGLE STORED LIST */}
          <div
            className="material-toggle"
            onClick={()=>setShowMaterialList(!showMaterialList)}
          >
            {showMaterialList ? "Hide Stored Materials ▲" : "Show Stored Materials ▼"}
          </div>

          {showMaterialList && (
            <motion.ul
              className="pro-list"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
          {filteredMaterials.map((m) => (
  <li key={m._id} className="d-flex justify-content-between align-items-center">

   {editingId === m._id ? (
<>
<div className="pro-grid">

<input
className="pro-input"
value={editingData.code}
onChange={(e)=>setEditingData({...editingData,code:e.target.value})}
/>

<input
className="pro-input"
value={editingData.description}
onChange={(e)=>setEditingData({...editingData,description:e.target.value})}
/>

<input
className="pro-input"
value={editingData.group}
onChange={(e)=>setEditingData({...editingData,group:e.target.value})}
/>

<input
className="pro-input"
value={editingData.mill}
onChange={(e)=>setEditingData({...editingData,mill:e.target.value})}
/>

<input
className="pro-input"
value={editingData.gsm}
onChange={(e)=>setEditingData({...editingData,gsm:e.target.value})}
/>

<input
className="pro-input"
value={editingData.paperSize}
onChange={(e)=>setEditingData({...editingData,paperSize:e.target.value})}
/>

</div>

<button
className="pro-btn primary"
onClick={()=>updateMaster("materials", m._id, editingData)}
>
Save
</button>

</>
    ) : (
      <>
        <span>
          <strong>{m.code}</strong> • {m.description} • {m.group} • {m.mill} • {m.gsm} • {m.paperSize}
        </span>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="pro-btn"
            onClick={() => {
              setEditingId(m._id);
              setEditingData({
  code: m.code,
  description: m.description,
  group: m.group,
  mill: m.mill,
  gsm: m.gsm,
  paperSize: m.paperSize
});
            }}
          >
            Edit
          </button>

          <button
            className="pro-btn"
            onClick={() => deleteMaster("materials", m._id)}
          >
            Delete
          </button>
        </div>
      </>
    )}

  </li>
))}
            </motion.ul>
          )}
        </motion.div>

      </motion.div>
  
  );
}

export default AdminDashboard;