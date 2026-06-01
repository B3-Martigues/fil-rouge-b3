/**
 * Gestion du routage avec séparation par layouts et rôles.
 * Utilise des constantes pour éviter les "magic strings".
 */

import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import useAuthStore from "../domains/auth/store/authStore";
import { ROUTES } from "../shared/constants/routes";

import Home from "../domains/events/pages/Home";
import Register from "../domains/auth/pages/Register";
import UserRegister from "../domains/auth/pages/UserRegister";
import CompanyRegister from "../domains/auth/pages/CompanyRegister";
import Login from "../domains/auth/pages/Login";
import Profile from "../domains/user/pages/Profile";
import ChangePassword from "../domains/user/components/ChangePassword";
import AdminDashboard from "../domains/admin/pages/AdminDashboard";
import CompanyDashboard from "../domains/companies/pages/CompanyDashboard";
import CompanyEvents from "../domains/companies/pages/CompanyEvents";
import CompanyProfile from "../domains/companies/pages/CompanyProfile";

import PublicLayout from "../shared/layouts/PublicLayout";
import PrivateLayout from "../shared/layouts/PrivateLayout";
import AdminLayout from "../shared/layouts/AdminLayout";
import CompanyLayout from "../shared/layouts/CompanyLayout";
import Favorites from "../domains/user/pages/Favorites";
import History from "../domains/user/pages/History";
import UserPreferences from "../domains/user/pages/UserPreferences";
import UserProfilePreferences from "../domains/user/pages/UserProfilePreferences";

type Props = {
  children: ReactNode;
};

/**
 * Protection des routes privées
 */
const PrivateRoute = ({ children }: Props) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? (
    children
  ) : (
    <Navigate to={ROUTES.PUBLIC.HOME} replace />
  );
};

/**
 * Protection par rôle utilisateur
 */
const RoleRoute = ({ children, role }: Props & { role: string }) => {
  const userRole = useAuthStore((s) => s.role);

  if (!userRole) {
    return <Navigate to={ROUTES.PUBLIC.LOGIN} replace />;
  }

  return userRole === role ? (
    children
  ) : (
    <Navigate to={ROUTES.PUBLIC.HOME} replace />
  );
};

const Router = () => {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route element={<PublicLayout />}>
        <Route path={ROUTES.PUBLIC.HOME} element={<Home />} />
        <Route path={ROUTES.PUBLIC.REGISTER} element={<Register />} />
        <Route path={ROUTES.PUBLIC.REGISTER_USER} element={<UserRegister />} />
        <Route
          path={ROUTES.PUBLIC.REGISTER_COMPANY}
          element={<CompanyRegister />}
        />
        <Route path={ROUTES.PUBLIC.LOGIN} element={<Login />} />
      </Route>

      {/* USER */}
      <Route
        element={
          <PrivateRoute>
            <RoleRoute role="user">
              <PrivateLayout />
            </RoleRoute>
          </PrivateRoute>
        }
      >
        <Route path={ROUTES.USER.PROFILE} element={<Profile />} />
        <Route path={ROUTES.USER.FAVORITES} element={<Favorites />} />
        <Route path={ROUTES.USER.HISTORY} element={<History />} />
        <Route
          path={ROUTES.USER.CHANGE_PASSWORD}
          element={<ChangePassword />}
        />
        <Route
          path={ROUTES.USER.ONBOARDING_PREFERENCES}
          element={<UserPreferences />}
        />
      </Route>
      <Route
        path={ROUTES.USER.PREFERENCES}
        element={<UserProfilePreferences />}
      />

      {/* ADMIN */}
      <Route
        element={
          <PrivateRoute>
            <RoleRoute role="admin">
              <AdminLayout />
            </RoleRoute>
          </PrivateRoute>
        }
      >
        <Route
          path={ROUTES.ADMIN.DASHBOARD}
          element={<AdminDashboard view="dashboard" />}
        />
        <Route
          path={ROUTES.ADMIN.EVENTS}
          element={<AdminDashboard view="events" />}
        />
        <Route
          path={ROUTES.ADMIN.USERS}
          element={<AdminDashboard view="accounts" />}
        />
      </Route>

      {/* COMPANY */}
      <Route
        element={
          <PrivateRoute>
            <RoleRoute role="company">
              <CompanyLayout />
            </RoleRoute>
          </PrivateRoute>
        }
      >
        <Route path={ROUTES.COMPANY.DASHBOARD} element={<CompanyDashboard />} />
        <Route path={ROUTES.COMPANY.PROFILE} element={<CompanyProfile />} />
        <Route path={ROUTES.COMPANY.EVENTS} element={<CompanyEvents />} />
        <Route path={ROUTES.COMPANY.CREATE} element={<CompanyDashboard />} />
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to={ROUTES.PUBLIC.HOME} replace />} />
    </Routes>
  );
};

export default Router;
