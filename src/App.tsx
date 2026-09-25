import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import MenuManager from "./pages/restaurant/MenuManager";
import DishForm from "./pages/restaurant/DishForm";
import OrdersManager from "./pages/restaurant/OrdersManager";
import OrderForm from "./pages/restaurant/OrderForm";
import TableMap from "./pages/restaurant/TableMap";
import KitchenDisplay from "./pages/restaurant/KitchenDisplay";
import ReservationsManager from "./pages/restaurant/ReservationsManager";
import ReservationForm from "./pages/restaurant/ReservationForm";
import Analytics from "./pages/restaurant/Analytics";
import { useAuth } from "./auth/useAuth";
import { Spinner } from "./components/icons";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Spinner className="w-5 h-5 text-zinc-600" />
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
            path="/restaurant/:companySlug/menu"
            element={<MenuManager />}
          />
          <Route
            path="/restaurant/:companySlug/menu/dishes/new"
            element={<DishForm />}
          />
          <Route
            path="/restaurant/:companySlug/menu/dishes/:dishId"
            element={<DishForm />}
          />
          <Route
            path="/restaurant/:companySlug/orders"
            element={<OrdersManager />}
          />
          <Route
            path="/restaurant/:companySlug/orders/new"
            element={<OrderForm />}
          />
          <Route
            path="/restaurant/:companySlug/orders/:orderId"
            element={<OrderForm />}
          />
          <Route path="/restaurant/:companySlug/map" element={<TableMap />} />
          <Route
            path="/restaurant/:companySlug/kitchen"
            element={<KitchenDisplay />}
          />
          <Route
            path="/restaurant/:companySlug/reservations"
            element={<ReservationsManager />}
          />
          <Route
            path="/restaurant/:companySlug/reservations/new"
            element={<ReservationForm />}
          />
          <Route
            path="/restaurant/:companySlug/reservations/:reservationId"
            element={<ReservationForm />}
          />
          <Route
            path="/restaurant/:companySlug/analytics"
            element={<Analytics />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
