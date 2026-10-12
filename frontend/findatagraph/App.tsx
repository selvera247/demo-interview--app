import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Shell from "./components/Shell";
import { fdgPath } from "./demoBase";
import AuditPage from "./pages/AuditPage";
import DashboardPage from "./pages/DashboardPage";
import ExceptionDetailPage from "./pages/ExceptionDetailPage";
import ExceptionsPage from "./pages/ExceptionsPage";
import LoginPage from "./pages/LoginPage";
import RunsPage from "./pages/RunsPage";
import "./styles.css";

function Protected({ children }: { children: ReactNode }) {
  const { token, booting } = useAuth();
  if (booting) return <div className="fdg-boot">Loading FinDataGraph…</div>;
  if (!token) return <Navigate to={fdgPath("/login")} replace />;
  return children;
}

function FdgRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <Shell />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="exceptions" element={<ExceptionsPage />} />
        <Route path="exceptions/:id" element={<ExceptionDetailPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to={fdgPath("/login")} replace />} />
    </Routes>
  );
}

/** Pages-native FinDataGraph control plane (synthetic Meridian Retail). */
export default function FinDataGraphApp() {
  return (
    <div className="fdg-root">
      <AuthProvider>
        <FdgRoutes />
      </AuthProvider>
    </div>
  );
}
