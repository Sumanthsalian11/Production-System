import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";

import DashboardLayout from "./components/DashboardLayout";
import LoadingOverlay from "./components/LoadingOverlay";
import useDelayedLoading from "./hooks/useDelayedLoading";
import QRScannerPage from "./pages/Qrscannerpage";
import PODetailsPage from "./pages/PODetailsPage";
import ChatWidget from "./components/ChatWidget";
import OCRScanEntry from "./pages/OCRScanEntry";
import BillingCountReport from "./pages/BillingCountReport";

/* INTERNAL AUTH */
import InternalLogin from "./pages/InternalLogin";
import InternalRegister from "./pages/InternalRegister";
import ManualBoxPage from "./pages/ManualBoxPage";

/* DASHBOARDS */
import AdminDashboard from "./pages/AdminDashboard";
import PlannerDashboard from "./pages/PlannerDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import Production from "./pages/Production";
import WastageReport from "./pages/Waste";
import SummaryReport from "./pages/SummaryReport";
import ProductionMachineStatusModule from "./pages/ProductionMachineStatusModule";
import ProductionRealDashboard from "./pages/ProductionTrack";
import LiveProductionPortal from "./pages/Liveproductionportal";
import DispatchManagement from "./pages/DispatchManagement";
import Productionreportt from "./pages/Productionreportt";
import ProductionReport from "./pages/ProductionReport";
import PrintingIns from "./pages/PrintingIns";
import Scheduler from "./pages/Scheduler";
import PersoReport from "./pages/Persoreport";
import ShreddingDashboard from "./pages/ShreddingDashboard";
import InwardRegister from "./pages/Inwardregister";
import NewIndent from "./pages/Newindent";
import PreprocessDashboard from "./pages/Preprocessdashboard";
import PlateRequestform from "./pages/Platerequestform";
import WelcomeBoardGenerator from "./pages/Welcomeboardgenerator";
import KasArtworkDashboard from "./pages/Kasartworkdashboard";
import InventoryDashboard from "./pages/Inventorydashboard";
import CalibrationDashboard from "./pages/Calibrationdashboard";
import ReceivingInspectionDashboard from "./pages/ReceivingInspectionDashboard";
import NewInspectionForm from "./pages/NewInspectionForm";
import ClickReport from "./pages/Clickreport";



/* PROTECTED ROUTE */
import ProtectedRoute from "./components/ProtectedRoute";

// Routes where the chat widget should NOT appear (e.g. pre-login pages)
const HIDE_CHAT_ON = ["/", "/register"];

function App() {
  const location = useLocation();
  const showChat = !HIDE_CHAT_ON.includes(location.pathname);

// ⭐ Shows immediately on a hard refresh / first app load only — content waits, loader doesn't
  const [appInitializing, setAppInitializing] = useState(true);

  useEffect(() => {
    // Simulate/allow for real init work (auth check, etc.) to finish
    const timer = setTimeout(() => setAppInitializing(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // While initializing, show ONLY the loader — don't mount routes/content underneath yet
  if (appInitializing) {
    return (
      <>
        <Toaster position="top-right" />
        <LoadingOverlay />
      </>
    );
  }

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
  path="/perso"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","PRODUCTION","SUPERVISOR","PLANNER","DISPATCH","INDENTER","SCANNER","KAS","PREPRESS","PURCHASE ORDER"]}>
      <ProductionMachineStatusModule />
    </ProtectedRoute>}/>
               <Route
  path="/internal-register"
  element={
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <InternalRegister />
    </ProtectedRoute>}/>

          <Route
  path="/plate-request"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","PRODUCTION","SUPERVISOR","PLANNER","DISPATCH","INDENTER","SCANNER","KAS","PREPRESS","PURCHASE ORDER"]}>
      <PlateRequestform />
    </ProtectedRoute>
  }
/>
          {/* PLANNER */}
          <Route
            path="/planner"
            element={
              <ProtectedRoute allowedRoles={["PLANNER", "ADMIN","PURCHASE ORDER","INDENTER","SCANNER","KAS","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                <PlannerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
  path="/welcome-board"
  element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}><WelcomeBoardGenerator /></ProtectedRoute>}
/>

           <Route path="/ocr-scan" element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}><OCRScanEntry /></ProtectedRoute>} />

           <Route
            path="/new-in"
            element={
              <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                <NewIndent />
              </ProtectedRoute>
            }
          />
            <Route path="/scan" element={ <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}><QRScannerPage/></ProtectedRoute>}/>
          
          <Route
  path="/po-details"
 element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}><PODetailsPage /></ProtectedRoute>}

/>

          <Route
  path="/manual-box"
  element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}><ManualBoxPage /></ProtectedRoute>}
/>
          <Route path="/production-real" element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
            <ProductionRealDashboard/>
            </ProtectedRoute>}/>

                      <Route path="/production-portal" element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
            <LiveProductionPortal/>
            </ProtectedRoute>}/>
            
          <Route path="/dispatch" element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
            <DispatchManagement/>
          </ProtectedRoute>}/>

          
<Route
  path="/click-report"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER","PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <ClickReport />
    </ProtectedRoute>
  }
/>


          <Route
  path="/preprocess"
  element={
    <ProtectedRoute allowedRoles={["PREPRESS", "ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <PreprocessDashboard />
    </ProtectedRoute>
  }
/>
<Route
  path="/billing-report"
  element={
    <ProtectedRoute allowedRoles={["ADMIN", "KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <BillingCountReport />
    </ProtectedRoute>
  }
/>

          {/* PURCHASE ORDERS */}
          <Route
            path="/customer-dashboard"
            element={
              <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />

          {/* PRODUCTION */}
          <Route
            path="/production"
            element={
              <ProtectedRoute allowedRoles={["PRODUCTION", "ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","DISPATCH","SUPERVISOR"]}>
                <Production />
              </ProtectedRoute>
            }
          />
<Route
  path="/scheduler"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <Scheduler />
    </ProtectedRoute>
  }
/>
          
         
         <Route path="/print" element={<ProtectedRoute allowedRoles={["KAS", "ADMIN","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
            <PrintingIns/>
          </ProtectedRoute>}/>  

          {/* WASTE */}
          <Route
            path="/waste"
            element={
              <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                <WastageReport />
              </ProtectedRoute>
            }
          />
<Route path="/receiving-inspection" element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
            <ReceivingInspectionDashboard/>
          </ProtectedRoute>}/>
          <Route path="/new-inspection" element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
            <NewInspectionForm/>
          </ProtectedRoute>}/>

          {/* REPORTS */}
          <Route
            path="/summary"
            element={
              <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                <SummaryReport />
              </ProtectedRoute>
            }
          />

          <Route
  path="/calibration"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER","PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <CalibrationDashboard />
    </ProtectedRoute>
  }
/>

         <Route
  path="/kas"
  element={
    <ProtectedRoute allowedRoles={["KAS", "ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <KasArtworkDashboard />
    </ProtectedRoute>
  }
/>


          <Route
  path="/production-report"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <ProductionReport />
    </ProtectedRoute>
  }
/>
<Route
  path="/perso-machine-report"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <PersoReport />
    </ProtectedRoute>
  }
/>
<Route
  path="/perso-report"
  element={
    <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
      <Productionreportt />
    </ProtectedRoute>
  }
/>

<Route path="/inventory-dashboard" element={
   <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
    <InventoryDashboard />
  </ProtectedRoute>}/>

<Route
  path="/shredding"
  element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
    <ShreddingDashboard />
  </ProtectedRoute>}
/>
  <Route path="/inward-register" element={<ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
    <InwardRegister />
  </ProtectedRoute>} />
        </Route>
      

      </Routes>

      {/* {showChat && <ChatWidget />} */}

    </>
  );
}

export default App;