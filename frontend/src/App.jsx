import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import DashboardLayout from "./components/DashboardLayout";

/* INTERNAL AUTH */
import InternalLogin from "./pages/InternalLogin";
import InternalRegister from "./pages/InternalRegister";

/* DASHBOARDS */
import AdminDashboard from "./pages/AdminDashboard";
import PlannerDashboard from "./pages/PlannerDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import Production from "./pages/Production";
import WastageReport from "./pages/Waste";
import SummaryReport from "./pages/SummaryReport";

import ProductionRealDashboard from "./pages/ProductionRealDashboard";
import DispatchManagement from "./pages/DispatchManagement";
import ProductionReport from "./pages/ProductionReport";
import PrintingIns from "./pages/PrintingIns";
import Scheduler from "./pages/Scheduler";

/* PROTECTED ROUTE */
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <>
      <Toaster position="top-right" />

      <Routes>

        {/* 🔐 LOGIN ROUTES */}
        <Route path="/" element={<InternalLogin />} />
   

        {/* 🧭 DASHBOARD LAYOUT ROUTES */}
        <Route element={<DashboardLayout />}>

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
               <Route
  path="/internal/register"
  element={
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <InternalRegister />
    </ProtectedRoute>
  }
/>

          {/* PLANNER */}
          <Route
            path="/planner"
            element={
              <ProtectedRoute allowedRoles={["PLANNER", "ADMIN"]}>
                <PlannerDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/production-real" element={<ProtectedRoute allowedRoles={["PRODUCTION", "ADMIN"]}>
            <ProductionRealDashboard/>
            </ProtectedRoute>}/>
            
          <Route path="/dispatch" element={<ProtectedRoute allowedRoles={["ADMIN","DISPATCH"]}>
            <DispatchManagement/>
          </ProtectedRoute>}/>

          {/* PURCHASE ORDERS */}
          <Route
            path="/customer-dashboard"
            element={
              <ProtectedRoute allowedRoles={["PLANNER", "ADMIN", "PURCHASE ORDER"]}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />

          {/* PRODUCTION */}
          <Route
            path="/production"
            element={
              <ProtectedRoute allowedRoles={["PRODUCTION", "ADMIN"]}>
                <Production />
              </ProtectedRoute>
            }
          />
<Route
  path="/scheduler"
  element={
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <Scheduler />
    </ProtectedRoute>
  }
/>
          
         
         <Route path="/print" element={<ProtectedRoute allowedRoles={["PRINTING", "ADMIN"]}>
            <PrintingIns/>
          </ProtectedRoute>}/>  

          {/* WASTE */}
          <Route
            path="/waste"
            element={
              <ProtectedRoute allowedRoles={["ADMIN", "PRODUCTION","SUPERVISOR"]}>
                <WastageReport />
              </ProtectedRoute>
            }
          />

          {/* REPORTS */}
          <Route
            path="/summary"
            element={
              <ProtectedRoute allowedRoles={["ADMIN","PRODUCTION","SUPERVISOR"]}>
                <SummaryReport />
              </ProtectedRoute>
            }
          />

         
          <Route
  path="/production-report"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","PRODUCTION","SUPERVISOR"]}>
      <ProductionReport />
    </ProtectedRoute>
  }
/>

        </Route>

      </Routes>
    </>
  );
}

export default App;