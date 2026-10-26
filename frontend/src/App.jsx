import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect, useState, createContext, useContext, lazy, Suspense } from "react";
import axios from "axios";
import BASE_URL from "./config/api";
import { Toaster } from "react-hot-toast";

import DashboardLayout from "./components/DashboardLayout";
import LoadingOverlay from "./components/LoadingOverlay";

/* INTERNAL AUTH (eager for immediate login render) */
import InternalLogin from "./pages/InternalLogin";

/* PROTECTED ROUTE */
import BaseProtectedRoute from "./components/ProtectedRoute";

/* LAZY-LOADED DASHBOARDS & TOOLS (Code-split for maximum performance) */
const QRScannerPage = lazy(() => import("./pages/Qrscannerpage"));
const PODetailsPage = lazy(() => import("./pages/PODetailsPage"));
const OCRScanEntry = lazy(() => import("./pages/OCRScanEntry"));
const BillingCountReport = lazy(() => import("./pages/BillingCountReport"));
const InternalRegister = lazy(() => import("./pages/InternalRegister"));
const ManualBoxPage = lazy(() => import("./pages/ManualBoxPage"));
const CertificateNumbering = lazy(() => import("./pages/Certificatenumbering"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PlannerDashboard = lazy(() => import("./pages/PlannerDashboard"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const Production = lazy(() => import("./pages/Production"));
const WastageReport = lazy(() => import("./pages/Waste"));
const SummaryReport = lazy(() => import("./pages/SummaryReport"));
const ProductionMachineStatusModule = lazy(() => import("./pages/ProductionMachineStatusModule"));
const ProductionRealDashboard = lazy(() => import("./pages/ProductionTrack"));
const LiveProductionPortal = lazy(() => import("./pages/Liveproductionportal"));
const DispatchManagement = lazy(() => import("./pages/DispatchManagement"));
const Productionreportt = lazy(() => import("./pages/Productionreportt"));
const ProductionReport = lazy(() => import("./pages/ProductionReport"));
const PrintingIns = lazy(() => import("./pages/PrintingIns"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const PersoReport = lazy(() => import("./pages/Persoreport"));
const ShreddingDashboard = lazy(() => import("./pages/ShreddingDashboard"));
const InwardRegister = lazy(() => import("./pages/Inwardregister"));
const NewIndent = lazy(() => import("./pages/Newindent"));
const PreprocessDashboard = lazy(() => import("./pages/Preprocessdashboard"));
const PlateRequestform = lazy(() => import("./pages/Platerequestform"));
const WelcomeBoardGenerator = lazy(() => import("./pages/Welcomeboardgenerator"));
const KasArtworkDashboard = lazy(() => import("./pages/Kasartworkdashboard"));
const InventoryDashboard = lazy(() => import("./pages/Inventorydashboard"));
const CalibrationDashboard = lazy(() => import("./pages/Calibrationdashboard"));
const ReceivingInspectionDashboard = lazy(() => import("./pages/ReceivingInspectionDashboard"));
const NewInspectionForm = lazy(() => import("./pages/NewInspectionForm"));
const ClickReport = lazy(() => import("./pages/Clickreport"));
const CustomerSatisfaction = lazy(() => import("./pages/CustomerSatisfaction"));

const RolesCtx = createContext([]);
// Master roles are added to every route except ADMIN-only ones (those have a single allowed role)
const ProtectedRoute = ({ allowedRoles = [], ...props }) => {
  const extra = useContext(RolesCtx);
  return <BaseProtectedRoute {...props} allowedRoles={allowedRoles.length > 1 ? [...allowedRoles, ...extra] : allowedRoles} />;
};

function App() {
  const location = useLocation();

  const [extraRoles, setExtraRoles] = useState(() => {
    try {
      const cached = sessionStorage.getItem("extraRoles");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [rolesToken, setRolesToken] = useState(() => {
    try {
      return sessionStorage.getItem("extraRolesToken") || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setExtraRoles([]);
      setRolesToken(null);
      try {
        sessionStorage.removeItem("extraRoles");
        sessionStorage.removeItem("extraRolesToken");
      } catch {}
      return;
    }
    if (token === rolesToken && extraRoles.length > 0) return;

    axios
      .get(`${BASE_URL}/api/master/roles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        const roles = (r.data || []).map((x) => String(x.name).toUpperCase());
        setExtraRoles(roles);
        setRolesToken(token);
        try {
          sessionStorage.setItem("extraRoles", JSON.stringify(roles));
          sessionStorage.setItem("extraRolesToken", token);
        } catch {}
      })
      .catch(() => {})
      .finally(() => setRolesToken(token));
  }, [location.pathname, rolesToken]);

  return (
    <>
      <Toaster position="top-right" />

      <RolesCtx.Provider value={extraRoles}>
        <Suspense fallback={<LoadingOverlay />}>
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
                  </ProtectedRoute>
                }
              />
              <Route
                path="/internal-register"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN"]}>
                    <InternalRegister />
                  </ProtectedRoute>
                }
              />
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
                path="/certificate-numbering"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER","PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <CertificateNumbering />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/welcome-board"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <WelcomeBoardGenerator />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ocr-scan"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <OCRScanEntry />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/new-in"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <NewIndent />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scan"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <QRScannerPage/>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/po-details"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <PODetailsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/manual-box"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <ManualBoxPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/production-real"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <ProductionRealDashboard/>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/production-portal"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <LiveProductionPortal/>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dispatch"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <DispatchManagement/>
                  </ProtectedRoute>
                }
              />

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

              <Route
                path="/print"
                element={
                  <ProtectedRoute allowedRoles={["KAS", "ADMIN","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <PrintingIns/>
                  </ProtectedRoute>
                }
              />

              {/* WASTE */}
              <Route
                path="/waste"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <WastageReport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/receiving-inspection"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <ReceivingInspectionDashboard/>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/new-inspection"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <NewInspectionForm/>
                  </ProtectedRoute>
                }
              />

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

              <Route
                path="/inventory-dashboard"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <InventoryDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/shredding"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <ShreddingDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/csat"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <CustomerSatisfaction />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inward-register"
                element={
                  <ProtectedRoute allowedRoles={["ADMIN","KAS","PLANNER", "PURCHASE ORDER","INDENTER","SCANNER","PREPRESS","PRODUCTION","DISPATCH","SUPERVISOR"]}>
                    <InwardRegister />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </RolesCtx.Provider>
    </>
  );
}

export default App;
