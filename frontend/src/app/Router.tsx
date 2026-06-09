import { Suspense, lazy, type ReactNode } from "react";
import {
  matchPath,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type Location,
} from "react-router-dom";

import useAuthStore from "../domains/auth/store/authStore";
import { getEventCategoryById } from "../domains/events/types/event-categories";
import { isAccountSuspended, type Role } from "../domains/user/types/user";
import AdminLayout from "../shared/layouts/AdminLayout";
import CompanyLayout from "../shared/layouts/CompanyLayout";
import ModeratorLayout from "../shared/layouts/ModeratorLayout";
import PrivateLayout from "../shared/layouts/PrivateLayout";
import PublicLayout from "../shared/layouts/PublicLayout";
import FormModal from "../shared/components/forms/FormModal";
import { ROUTES } from "../shared/constants/routes";
import useDataStore from "../shared/store/dataStore";

const Home = lazy(() => import("../domains/events/pages/Home"));
const Register = lazy(() => import("../domains/auth/pages/Register"));
const UserRegister = lazy(() => import("../domains/auth/pages/UserRegister"));
const CompanyRegister = lazy(
  () => import("../domains/auth/pages/CompanyRegister"),
);
const Login = lazy(() => import("../domains/auth/pages/Login"));
const ForgotPassword = lazy(
  () => import("../domains/auth/pages/ForgotPassword"),
);
const ResetPassword = lazy(() => import("../domains/auth/pages/ResetPassword"));
const Profile = lazy(() => import("../domains/user/pages/Profile"));
const ChangePassword = lazy(
  () => import("../domains/user/components/ChangePassword"),
);
const AdminDashboard = lazy(
  () => import("../domains/admin/pages/AdminDashboard"),
);
const ModeratorDashboard = lazy(
  () => import("../domains/moderator/pages/ModeratorDashboard"),
);
const CompanyDashboard = lazy(
  () => import("../domains/companies/pages/CompanyDashboard"),
);
const CompanyEvents = lazy(
  () => import("../domains/companies/pages/CompanyEvents"),
);
const CompanyProfile = lazy(
  () => import("../domains/companies/pages/CompanyProfile"),
);
const Favorites = lazy(() => import("../domains/user/pages/Favorites"));
const History = lazy(() => import("../domains/user/pages/History"));
const Onboarding = lazy(() => import("../domains/user/pages/Onboarding"));
const ProfilePreferences = lazy(
  () => import("../domains/user/pages/ProfilePreferences"),
);

type Props = {
  children: ReactNode;
};

type FormModalLocationState = {
  backgroundLocation?: Location;
  formModal?: boolean;
};

const formModalRoutes = [
  { path: ROUTES.PUBLIC.LOGIN, label: "Connexion" },
  { path: ROUTES.PUBLIC.REGISTER, label: "Inscription" },
  { path: ROUTES.PUBLIC.REGISTER_USER, label: "Inscription utilisateur" },
  { path: ROUTES.PUBLIC.REGISTER_COMPANY, label: "Inscription entreprise" },
  { path: ROUTES.PUBLIC.FORGOT_PASSWORD, label: "Mot de passe oublie" },
  { path: ROUTES.PUBLIC.RESET_PASSWORD, label: "Reinitialisation du mot de passe" },
  { path: ROUTES.USER.PROFILE, label: "Profil utilisateur" },
  { path: ROUTES.USER.CHANGE_PASSWORD, label: "Changement de mot de passe" },
  { path: ROUTES.USER.PREFERENCES, label: "Preferences utilisateur" },
  { path: ROUTES.COMPANY.PROFILE, label: "Profil entreprise" },
  { path: ROUTES.COMPANY.CREATE, label: "Nouvel evenement" },
] as const;

const getFormModalLabel = (pathname: string) =>
  formModalRoutes.find((route) =>
    matchPath({ path: route.path, end: true }, pathname),
  )?.label ?? null;

const toLocationPath = (location: Location) =>
  `${location.pathname}${location.search}${location.hash}`;

const PrivateRoute = ({ children }: Props) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.currentUser);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const companies = useDataStore((s) => s.companies);

  const account = currentUser
    ? accounts.find((item) => item.id === currentUser.account_id)
    : undefined;
  const hasValidAccount =
    !!account &&
    account.is_active &&
    !account.deleted_at &&
    !isAccountSuspended(account);
  const hasValidProfile =
    currentUser?.role === "company"
      ? companies.some(
          (company) =>
            company.id === currentUser.company_id &&
            company.account_id === currentUser.account_id &&
            !company.deleted_at,
        )
      : users.some(
          (user) =>
            user.id === currentUser?.user_id &&
            user.account_id === currentUser?.account_id &&
            user.role === currentUser?.role &&
            !user.deleted_at,
        );

  return isAuthenticated &&
    currentUser &&
    hasValidAccount &&
    hasValidProfile ? (
    children
  ) : (
    <Navigate to={ROUTES.PUBLIC.LOGIN} replace />
  );
};

const RoleRoute = ({
  children,
  role,
  roles,
}: Props & { role?: Role; roles?: Role[] }) => {
  const userRole = useAuthStore((s) => s.currentUser?.role ?? s.role);
  const allowedRoles = roles ?? (role ? [role] : []);

  if (!userRole) {
    return <Navigate to={ROUTES.PUBLIC.LOGIN} replace />;
  }

  return allowedRoles.includes(userRole) ? (
    children
  ) : (
    <Navigate to={ROUTES.PUBLIC.HOME} replace />
  );
};

const RequireUserPreferences = ({ children }: Props) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const preferences = useDataStore((s) => s.userEventPreferences);
  const userId = currentUser?.role === "user" ? currentUser.user_id : undefined;
  const hasPreferences =
    !!userId &&
    preferences.some(
      (preference) =>
        preference.user_id === userId &&
        !!getEventCategoryById(preference.event_category_id),
    );

  if (currentUser?.role === "user" && !hasPreferences) {
    return <Navigate to={ROUTES.USER.ONBOARDING} replace />;
  }

  return children;
};

const routeFallback = (
  <div className="route-loading" role="status">
    Chargement...
  </div>
);

const Router = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as FormModalLocationState | null;
  const backgroundLocation = locationState?.formModal
    ? locationState.backgroundLocation
    : undefined;
  const formModalLabel = backgroundLocation
    ? getFormModalLabel(location.pathname)
    : null;
  const closeFormModal = () => {
    navigate(
      backgroundLocation ? toLocationPath(backgroundLocation) : ROUTES.PUBLIC.HOME,
      { replace: true },
    );
  };

  return (
    <>
      <Suspense fallback={routeFallback}>
        <Routes location={backgroundLocation ?? location}>
        <Route element={<PublicLayout />}>
          <Route
            path={ROUTES.PUBLIC.HOME}
            element={
              <RequireUserPreferences>
                <Home />
              </RequireUserPreferences>
            }
          />
          <Route path={ROUTES.PUBLIC.REGISTER} element={<Register />} />
          <Route path={ROUTES.PUBLIC.REGISTER_USER} element={<UserRegister />} />
          <Route
            path={ROUTES.PUBLIC.REGISTER_COMPANY}
            element={<CompanyRegister />}
          />
          <Route path={ROUTES.PUBLIC.LOGIN} element={<Login />} />
          <Route
            path={ROUTES.PUBLIC.FORGOT_PASSWORD}
            element={<ForgotPassword />}
          />
          <Route
            path={ROUTES.PUBLIC.RESET_PASSWORD}
            element={<ResetPassword />}
          />
        </Route>

        <Route
          element={
            <PrivateRoute>
              <RoleRoute role="user">
                <PrivateLayout />
              </RoleRoute>
            </PrivateRoute>
          }
        >
          <Route
            path={ROUTES.USER.PROFILE}
            element={
              <RequireUserPreferences>
                <Profile />
              </RequireUserPreferences>
            }
          />
          <Route
            path={ROUTES.USER.FAVORITES}
            element={
              <RequireUserPreferences>
                <Favorites />
              </RequireUserPreferences>
            }
          />
          <Route
            path={ROUTES.USER.HISTORY}
            element={
              <RequireUserPreferences>
                <History />
              </RequireUserPreferences>
            }
          />
          <Route
            path={ROUTES.USER.CHANGE_PASSWORD}
            element={
              <RequireUserPreferences>
                <ChangePassword />
              </RequireUserPreferences>
            }
          />
          <Route path={ROUTES.USER.ONBOARDING} element={<Onboarding />} />
          <Route
            path={ROUTES.USER.PREFERENCES}
            element={<ProfilePreferences />}
          />
        </Route>

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
            element={<AdminDashboard view="accounts" />}
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

        <Route
          element={
            <PrivateRoute>
              <RoleRoute roles={["admin", "moderator"]}>
                <ModeratorLayout />
              </RoleRoute>
            </PrivateRoute>
          }
        >
          <Route
            path={ROUTES.MODERATOR.DASHBOARD}
            element={<ModeratorDashboard view="accounts" />}
          />
          <Route
            path={ROUTES.MODERATOR.EVENTS}
            element={<ModeratorDashboard view="events" />}
          />
          <Route
            path={ROUTES.MODERATOR.COMPANIES}
            element={<ModeratorDashboard view="companies" />}
          />
          <Route
            path={ROUTES.MODERATOR.ACCOUNTS}
            element={<ModeratorDashboard view="accounts" />}
          />
          <Route
            path={ROUTES.MODERATOR.REPORTS}
            element={<ModeratorDashboard view="reports" />}
          />
        </Route>

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

          <Route path="*" element={<Navigate to={ROUTES.PUBLIC.HOME} replace />} />
        </Routes>
      </Suspense>

      {backgroundLocation && formModalLabel && (
        <FormModal
          ariaLabel={formModalLabel}
          open
          size="lg"
          onClose={closeFormModal}
        >
          <Suspense fallback={routeFallback}>
            <Routes location={location}>
              <Route path={ROUTES.PUBLIC.REGISTER} element={<Register />} />
              <Route path={ROUTES.PUBLIC.REGISTER_USER} element={<UserRegister />} />
              <Route
                path={ROUTES.PUBLIC.REGISTER_COMPANY}
                element={<CompanyRegister />}
              />
              <Route path={ROUTES.PUBLIC.LOGIN} element={<Login />} />
              <Route
                path={ROUTES.PUBLIC.FORGOT_PASSWORD}
                element={<ForgotPassword />}
              />
              <Route
                path={ROUTES.PUBLIC.RESET_PASSWORD}
                element={<ResetPassword />}
              />
              <Route
                path={ROUTES.USER.PROFILE}
                element={
                  <PrivateRoute>
                    <RoleRoute role="user">
                      <RequireUserPreferences>
                        <Profile />
                      </RequireUserPreferences>
                    </RoleRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path={ROUTES.USER.CHANGE_PASSWORD}
                element={
                  <PrivateRoute>
                    <RoleRoute role="user">
                      <RequireUserPreferences>
                        <ChangePassword />
                      </RequireUserPreferences>
                    </RoleRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path={ROUTES.USER.PREFERENCES}
                element={
                  <PrivateRoute>
                    <RoleRoute role="user">
                      <ProfilePreferences />
                    </RoleRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path={ROUTES.COMPANY.PROFILE}
                element={
                  <PrivateRoute>
                    <RoleRoute role="company">
                      <CompanyProfile />
                    </RoleRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path={ROUTES.COMPANY.CREATE}
                element={
                  <PrivateRoute>
                    <RoleRoute role="company">
                      <CompanyDashboard />
                    </RoleRoute>
                  </PrivateRoute>
                }
              />
            </Routes>
          </Suspense>
        </FormModal>
      )}
    </>
  );
};

export default Router;
