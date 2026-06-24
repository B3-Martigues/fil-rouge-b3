/**Composant principal de l'application, il gere le routage et l'affichage des notifications (toast)  */
import { useCallback, useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import { useLocation } from "react-router-dom";

import Router from "./app/Router";
import { authHttpApi } from "./domains/auth/api/authHttp.api";
import useAuthStore from "./domains/auth/store/authStore";
import { EVENTS_API_MODE, eventsApi } from "./domains/event/api/events.api";
import { getEventCategorySlug } from "./domains/event/types/event-categories";
import { organizationsApi } from "./domains/organization/api/organizations.api";
import { userApi } from "./domains/user/api/user.api";
import AppSplash from "./shared/components/layout/AppSplash";
import { ROUTES } from "./shared/constants/routes";
import useDataStore from "./shared/store/dataStore";

function App() {
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.currentUser);
  const setEvents = useDataStore((s) => s.setEvents);
  const setUserFavorites = useDataStore((s) => s.setUserFavorites);
  const setUserHistories = useDataStore((s) => s.setUserHistories);
  const setUserEventPreferences = useDataStore((s) => s.setUserEventPreferences);
  const setUserNotifications = useDataStore((s) => s.setUserNotifications);
  const upsertOrganizations = useDataStore((s) => s.upsertOrganizations);
  const upsertOrganizers = useDataStore((s) => s.upsertOrganizers);
  const [showSplash, setShowSplash] = useState(
    () => location.pathname === ROUTES.PUBLIC.HOME,
  );
  const [hasHomeMapReady, setHasHomeMapReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [areEventsHydrated, setAreEventsHydrated] = useState(
    () => EVENTS_API_MODE !== "http",
  );
  const [areOrganizationsHydrated, setAreOrganizationsHydrated] = useState(
    () => EVENTS_API_MODE !== "http",
  );
  const isHomeDataReady = areEventsHydrated && areOrganizationsHydrated;
  const isHomeReady = isHomeDataReady && hasHomeMapReady;
  const hideSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  useEffect(() => {
    let ignore = false;

    const restoreSession = async () => {
      const result = await authHttpApi.restoreSession();
      if (ignore) return;

      if (result.ok) {
        login(result.data);
      } else if (
        result.error.code === "unauthorized" ||
        useAuthStore.getState().currentUser?.auth_source === "api"
      ) {
        logout();
      }

      setSessionReady(true);
    };

    void restoreSession();

    return () => {
      ignore = true;
    };
  }, [login, logout]);

  useEffect(() => {
    if (EVENTS_API_MODE !== "http") return;

    let ignore = false;

    void eventsApi
      .list({ includeInactive: true })
      .then((result) => {
        if (!ignore && result.ok) {
          setEvents(result.data);
        }
      })
      .finally(() => {
        if (!ignore) {
          setAreEventsHydrated(true);
        }
      });

    return () => {
      ignore = true;
    };
  }, [setEvents]);

  useEffect(() => {
    if (EVENTS_API_MODE !== "http") return;

    let ignore = false;

    void organizationsApi
      .list()
      .then((result) => {
        if (!ignore && result.ok) {
          upsertOrganizations(result.data);
        }
      })
      .finally(() => {
        if (!ignore) {
          setAreOrganizationsHydrated(true);
        }
      });

    return () => {
      ignore = true;
    };
  }, [upsertOrganizations]);

  useEffect(() => {
    if (
      EVENTS_API_MODE !== "http" ||
      currentUser?.auth_source !== "api" ||
      !currentUser.user_id
    ) {
      return;
    }

    let ignore = false;

    const hydrateUserData = async () => {
      const [favoritesResult, historiesResult] = await Promise.all([
        currentUser.role === "user" ? eventsApi.listFavorites() : null,
        currentUser.role === "user" ? eventsApi.listHistory() : null,
      ]);
      const [preferencesResult, notificationsResult] = await Promise.all([
        currentUser.role === "user" ? userApi.listPreferences() : null,
        currentUser.role === "user" ? userApi.listNotifications() : null,
      ]);

      if (ignore) return;

      if (favoritesResult?.ok) {
        setUserFavorites(currentUser.user_id!, favoritesResult.data);
      }
      if (historiesResult?.ok) {
        setUserHistories(currentUser.user_id!, historiesResult.data);
      }
      if (preferencesResult?.ok) {
        setUserEventPreferences(
          currentUser.user_id!,
          preferencesResult.data
            .map((preference) => getEventCategorySlug(preference.event_category_id))
            .filter((slug): slug is NonNullable<typeof slug> => !!slug),
        );
      }
      if (notificationsResult?.ok) {
        setUserNotifications(currentUser.user_id!, notificationsResult.data);
      }

      const organizationsResult =
        currentUser.role === "organization"
          ? await organizationsApi.me()
          : currentUser.role === "user"
            ? await organizationsApi.mine()
            : null;

      if (ignore || !organizationsResult?.ok) return;

      const organizations = Array.isArray(organizationsResult.data)
        ? organizationsResult.data
        : [organizationsResult.data];

      upsertOrganizations(organizations);

      const membersResults = await Promise.all(
        organizations.map((organization) =>
          organizationsApi.listMembers(organization.id),
        ),
      );

      if (ignore) return;

      upsertOrganizers(
        membersResults.flatMap((result) => (result.ok ? result.data : [])),
      );
    };

    void hydrateUserData();

    return () => {
      ignore = true;
    };
  }, [
    currentUser?.auth_source,
    currentUser?.role,
    currentUser?.user_id,
    setUserFavorites,
    setUserHistories,
    setUserEventPreferences,
    setUserNotifications,
    upsertOrganizations,
    upsertOrganizers,
  ]);

  useEffect(() => {
    const markHomeReady = () => {
      setHasHomeMapReady(true);
    };

    window.addEventListener("mappening:home-map-ready", markHomeReady);

    return () => {
      window.removeEventListener("mappening:home-map-ready", markHomeReady);
    };
  }, []);

  return (
    <>
      {sessionReady ? (
        <Router isHomeDataReady={isHomeDataReady} />
      ) : (
        <div className="route-loading" role="status">
          Chargement...
        </div>
      )}

      {showSplash && (
        <AppSplash isReady={isHomeReady} onFinished={hideSplash} />
      )}

      <ToastContainer position="top-right" autoClose={3000} theme="light" />
    </>
  );
}

export default App;
