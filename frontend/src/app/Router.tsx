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
import { getEventCategoryById } from "../domains/event/types/event-categories";
import { isAccountSuspended, type Role } from "../domains/user/types/user";
import AdminLayout from "../shared/layouts/AdminLayout";
import OrganizationLayout from "../shared/layouts/OrganizationLayout";
import ModeratorLayout from "../shared/layouts/ModeratorLayout";
import PrivateLayout from "../shared/layouts/PrivateLayout";
import PublicLayout from "../shared/layouts/PublicLayout";
import FormModal from "../shared/components/forms/FormModal";
import { ROUTES } from "../shared/constants/routes";
import useDataStore from "../shared/store/dataStore";

const Home = lazy(() => import("../domains/event/pages/Home"));
const Register = lazy(() => import("../domains/auth/pages/Register"));
const Login = lazy(() => import("../domains/auth/pages/Login"));
const ForgotPassword = lazy(
  () => import("../domains/auth/pages/ForgotPassword"),
);
const ResetPassword = lazy(() => import("../domains/auth/pages/ResetPassword"));
const Profile = lazy(() => import("../domains/user/pages/Profile"));
const AccountPageShell = lazy(
  () => import("../domains/user/components/AccountPageShell"),
);
const ChangePassword = lazy(
  () => import("../domains/user/components/ChangePassword"),
);
const AdminDashboard = lazy(
  () => import("../domains/admin/pages/AdminDashboard"),
);
const ModeratorDashboard = lazy(
  () => import("../domains/moderator/pages/ModeratorDashboard"),
);
const OrganizationDashboard = lazy(
  () => import("../domains/organization/pages/OrganizationDashboard"),
);
const OrganizationsPage = lazy(
  () => import("../domains/organization/pages/OrganizationsPage"),
);
const OrganizationDetailPage = lazy(
  () => import("../domains/organization/pages/OrganizationDetailPage"),
);
const OrganizationSetup = lazy(
  () => import("../domains/organization/pages/OrganizationSetup"),
);
const OrganizationEvents = lazy(
  () => import("../domains/organization/pages/OrganizationEvents"),
);
const OrganizationProfile = lazy(
  () => import("../domains/organization/pages/OrganizationProfile"),
);
const Favorites = lazy(() => import("../domains/user/pages/Favorites"));
const History = lazy(() => import("../domains/user/pages/History"));
const Notifications = lazy(() => import("../domains/user/pages/Notifications"));
const UserEvents = lazy(() => import("../domains/user/pages/UserEvents"));
const Onboarding = lazy(() => import("../domains/user/pages/Onboarding"));
const ProfilePreferences = lazy(
  () => import("../domains/user/pages/ProfilePreferences"),
);
const NotFound = lazy(() => import("../shared/pages/NotFound"));

type Props = {
  children: ReactNode;
};

type FormModalLocationState = {
  backgroundLocation?: Location;
  formModal?: boolean;
};

const formModalRoutes = [
  { path: ROUTES.PUBLIC.FORGOT_PASSWORD, label: "Mot de passe oublié" },
  { path: ROUTES.PUBLIC.RESET_PASSWORD, label: "Réinitialisation du mot de passe" },
  { path: ROUTES.USER.CHANGE_PASSWORD, label: "Changement de mot de passe" },
  { path: ROUTES.USER.PREFERENCES, label: "Préférences utilisateur" },
  { path: ROUTES.USER.BECOME_ORGANIZER, label: "Devenir organisateur" },
  { path: ROUTES.USER.CREATE_ORGANIZATION, label: "Ajouter une organisation" },
  { path: ROUTES.ORGANIZATION.CREATE, label: "Ajouter un événement" },
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
  const organizations = useDataStore((s) => s.organizations);

  const account = currentUser
    ? accounts.find((item) => item.id === currentUser.account_id)
    : undefined;
  const hasValidAccount =
    !!account &&
    account.is_active &&
    !account.deleted_at &&
    !isAccountSuspended(account);
  const hasValidProfile =
    currentUser?.role === "organization"
      ? organizations.some(
          (organization) =>
            organization.id === currentUser.organization_id &&
            organization.account_id === currentUser.account_id &&
            !organization.deleted_at,
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

const RequireUserOrganizer = ({ children }: Props) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const organizers = useDataStore((s) => s.organizers);
  const userId = currentUser?.role === "user" ? currentUser.user_id : undefined;
  const hasOrganizations =
    !!userId &&
    organizers.some(
      (organizer) => organizer.user_id === userId && !organizer.deleted_at,
    );

  if (!hasOrganizations) {
    return <Navigate to={ROUTES.USER.PROFILE} replace />;
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
  const requestedFormModalLabel = locationState?.formModal
    ? getFormModalLabel(location.pathname)
    : null;
  const backgroundLocation = requestedFormModalLabel
    ? locationState?.backgroundLocation
    : undefined;
  const formModalLabel = backgroundLocation
    ? requestedFormModalLabel
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
              <RoleRoute roles={["user", "admin", "moderator"]}>
                <PrivateLayout />
              </RoleRoute>
            </PrivateRoute>
          }
        >
          <Route element={<AccountPageShell />}>
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
                <RoleRoute role="user">
                  <RequireUserPreferences>
                    <Favorites />
                  </RequireUserPreferences>
                </RoleRoute>
              }
            />
            <Route
              path={ROUTES.USER.HISTORY}
              element={
                <RoleRoute role="user">
                  <RequireUserPreferences>
                    <History />
                  </RequireUserPreferences>
                </RoleRoute>
              }
            />
            <Route
              path={ROUTES.USER.NOTIFICATIONS}
              element={
                <RoleRoute role="user">
                  <RequireUserPreferences>
                    <Notifications />
                  </RequireUserPreferences>
                </RoleRoute>
              }
            />
            <Route
              path={ROUTES.USER.PREFERENCES}
              element={
                <RoleRoute role="user">
                  <ProfilePreferences />
                </RoleRoute>
              }
            />
            <Route
              path={ROUTES.USER.ORGANIZATIONS}
              element={
                <RoleRoute role="user">
                  <RequireUserPreferences>
                    <RequireUserOrganizer>
                      <OrganizationsPage />
                    </RequireUserOrganizer>
                  </RequireUserPreferences>
                </RoleRoute>
              }
            />
            <Route
              path={ROUTES.USER.EVENTS}
              element={
                <RoleRoute role="user">
                  <RequireUserPreferences>
                    <RequireUserOrganizer>
                      <UserEvents />
                    </RequireUserOrganizer>
                  </RequireUserPreferences>
                </RoleRoute>
              }
            />
          </Route>
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
            path={ROUTES.USER.ORGANIZATION_DETAIL}
            element={
              <RequireUserPreferences>
                <RequireUserOrganizer>
                  <OrganizationDetailPage />
                </RequireUserOrganizer>
              </RequireUserPreferences>
            }
          />
          <Route
            path={ROUTES.USER.BECOME_ORGANIZER}
            element={<OrganizationSetup mode="become" />}
          />
          <Route
            path={ROUTES.USER.CREATE_ORGANIZATION}
            element={<OrganizationSetup mode="create" />}
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
            path={ROUTES.MODERATOR.ORGANIZATIONS}
            element={<ModeratorDashboard view="organizations" />}
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
              <RoleRoute role="organization">
                <OrganizationLayout />
              </RoleRoute>
            </PrivateRoute>
          }
        >
          <Route
            path={ROUTES.ORGANIZATION.DASHBOARD}
            element={<Navigate to={ROUTES.ORGANIZATION.EVENTS} replace />}
          />
          <Route path={ROUTES.ORGANIZATION.PROFILE} element={<OrganizationProfile />} />
          <Route path={ROUTES.ORGANIZATION.EVENTS} element={<OrganizationEvents />} />
          <Route path={ROUTES.ORGANIZATION.CREATE} element={<OrganizationDashboard />} />
        </Route>

          <Route path="*" element={<NotFound />} />
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
              <Route
                path={ROUTES.PUBLIC.FORGOT_PASSWORD}
                element={<ForgotPassword />}
              />
              <Route
                path={ROUTES.PUBLIC.RESET_PASSWORD}
                element={<ResetPassword />}
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
                path={ROUTES.USER.BECOME_ORGANIZER}
                element={
                  <PrivateRoute>
                    <RoleRoute role="user">
                      <OrganizationSetup mode="become" />
                    </RoleRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path={ROUTES.USER.CREATE_ORGANIZATION}
                element={
                  <PrivateRoute>
                    <RoleRoute role="user">
                      <OrganizationSetup mode="create" />
                    </RoleRoute>
                  </PrivateRoute>
                }
              />
              <Route
                path={ROUTES.ORGANIZATION.CREATE}
                element={
                  <PrivateRoute>
                    <RoleRoute role="organization">
                      <OrganizationDashboard />
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
