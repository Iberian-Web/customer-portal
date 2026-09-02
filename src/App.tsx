import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import MenuManager from "./pages/restaurant/MenuManager";
import OrdersManager from "./pages/restaurant/OrdersManager";
import ReservationsManager from "./pages/restaurant/ReservationsManager";
// import PropertiesManager from "./pages/realestate/PropertiesManager";
import { useAuth } from "./contexts/AuthContext";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <svg
        className="w-5 h-5 text-zinc-600 animate-spin"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        />
      </svg>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Pública */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Protegidas — todas dentro de MainLayout (Sidebar + Outlet) */}
        <Route
          element={
            isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />
          }
        >
          <Route index element={<Home />} />

          <Route
            path="/restaurant/:instanceId/menu"
            element={<MenuManager />}
          />
          <Route
            path="/restaurant/:instanceId/orders"
            element={<OrdersManager />}
          />
          <Route
            path="/restaurant/:instanceId/reservations"
            element={<ReservationsManager />}
          />

          {/* <Route path="/realestate/:instanceId/properties" element={<PropertiesManager />} /> */}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}