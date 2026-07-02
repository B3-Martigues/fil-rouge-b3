/**Composant principal de l'application, il gere le routage et l'affichage des notifications (toast)  */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ToastContainer } from "react-toastify";
import { useLocation } from "react-router-dom";

import Router from "./app/Router";
import { authHttpApi } from "./domains/auth/api/authHttp.api";
import useAuthStore from "./domains/auth/store/authStore";
import { EVENTS_API_MODE, eventsApi } from "./domains/event/api/events.api";
import { organizationsApi } from "./domains/organization/api/organizations.api";
import { userApi } from "./domains/user/api/user.api";
import AppSplash from "./shared/components/layout/AppSplash";
import { ROUTES } from "./shared/constants/routes";
import useDataStore from "./shared/store/dataStore";

const hasCookie = (name: string) =>
  typeof document !== "undefined" &&
  document.cookie
    .split("; ")
    .some((part) => part.startsWith(`${encodeURIComponent(name)}=`));

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
  const setNotificationTypes = useDataStore((s) => s.setNotificationTypes);
  const upsertOrganizations = useDataStore((s) => s.upsertOrganizations);
  const upsertOrganizers = useDataStore((s) => s.upsertOrganizers);
  const events = useDataStore((s) => s.events);
  const organizations = useDataStore((s) => s.organizations);
  const [showSplash, setShowSplash] = useState(
    () => location.pathname === ROUTES.PUBLIC.HOME,
  );
  const [hasHomeMapReady, setHasHomeMapReady] = useState(false);
  const [areHomeImagesReady, setAreHomeImagesReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initialSessionUser] = useState(() => useAuthStore.getState().currentUser);
  const sessionRestorePromiseRef = useRef<ReturnType<
    typeof authHttpApi.restoreSession
  > | null>(null);
  const [hydratedUserDataKey, setHydratedUserDataKey] = useState<string | null>(
    null,
  );
  const [areEventsHydrated, setAreEventsHydrated] = useState(
    () => EVENTS_API_MODE !== "http",
  );
  const [areOrganizationsHydrated, setAreOrganizationsHydrated] = useState(
    () => EVENTS_API_MODE !== "http",
  );
  const isHomeDataReady = areEventsHydrated && areOrganizationsHydrated;
  const isHomeReady = isHomeDataReady && hasHomeMapReady && areHomeImagesReady;
  const userDataHydrationKey =
    EVENTS_API_MODE === "http" &&
    sessionReady &&
    currentUser?.auth_source === "api" &&
    currentUser.user_id
      ? `${currentUser.account_id}:${currentUser.user_id}:${currentUser.organization_id ?? "none"}`
      : null;
  const isUserDataReady =
    !userDataHydrationKey || hydratedUserDataKey === userDataHydrationKey;
  const hideSplash = useCallback(() => {
    setShowSplash(false);
  }, []);
  const homeImageSources = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...events
              .filter((event) => event.is_active && !event.deleted_at)
              .map((event) => event.image),
            ...organizations
              .filter((organization) => !organization.deleted_at)
              .map((organization) => organization.logo ?? ""),
          ].filter((source) => source.trim() !== ""),
        ),
      ),
    [events, organizations],
  );

  useEffect(() => {
    let ignore = false;

    const restoreSession = async () => {
      if (
        EVENTS_API_MODE !== "http" ||
        initialSessionUser?.auth_source !== "api" ||
        !hasCookie("csrf_token")
      ) {
        if (initialSessionUser) {
          logout();
        }
        setSessionReady(true);
        return;
      }

      sessionRestorePromiseRef.current ??= authHttpApi.restoreSession();
      const result = await sessionRestorePromiseRef.current;
      if (ignore) return;

      if (result.ok) {
        login(result.data);
      } else {
        logout();
      }

      setSessionReady(true);
    };

    void restoreSession();

    return () => {
      ignore = true;
    };
  }, [initialSessionUser, login, logout]);

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
      !sessionReady ||
      currentUser?.auth_source !== "api" ||
      !currentUser.user_id
    ) {
      const resetTimer = window.setTimeout(() => {
        setHydratedUserDataKey(null);
      }, 0);

      return () => {
        window.clearTimeout(resetTimer);
      };
    }

    let ignore = false;
    const hydrationKey = `${currentUser.account_id}:${currentUser.user_id}:${currentUser.organization_id ?? "none"}`;

    const hydrateUserData = async () => {
      const [favoritesResult, historiesResult] = await Promise.all([
        currentUser.role === "user" ? eventsApi.listFavorites() : null,
        currentUser.role === "user" ? eventsApi.listHistory() : null,
      ]);
      const [preferencesResult, notificationsResult] = await Promise.all([
        currentUser.role === "user" ? userApi.listPreferences() : null,
        userApi.listNotifications(),
      ]);
      const notificationTypesResult = await userApi.listNotificationTypes();

      if (ignore) return;

      if (favoritesResult?.ok) {
        setUserFavorites(currentUser.user_id!, favoritesResult.data);
      }
      if (historiesResult?.ok) {
        setUserHistories(currentUser.user_id!, historiesResult.data);
      }
      if (preferencesResult?.ok) {
        setUserEventPreferences(currentUser.user_id!, preferencesResult.data);
      }
      if (notificationsResult?.ok) {
        setUserNotifications(currentUser.user_id!, notificationsResult.data);
      }
      if (notificationTypesResult?.ok) {
        setNotificationTypes(notificationTypesResult.data);
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

      setHydratedUserDataKey(hydrationKey);
    };

    void hydrateUserData().finally(() => {
      if (!ignore) {
        setHydratedUserDataKey(hydrationKey);
      }
    });

    return () => {
      ignore = true;
    };
  }, [
    currentUser?.auth_source,
    currentUser?.account_id,
    currentUser?.organization_id,
    currentUser?.role,
    currentUser?.user_id,
    sessionReady,
    setUserFavorites,
    setUserHistories,
    setUserEventPreferences,
    setUserNotifications,
    setNotificationTypes,
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

  useLayoutEffect(() => {
    if (location.pathname !== ROUTES.PUBLIC.HOME) {
      setShowSplash(false);
      setHasHomeMapReady(false);
      setAreHomeImagesReady(false);
      return;
    }

    setShowSplash(true);
    setHasHomeMapReady(false);
    setAreHomeImagesReady(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== ROUTES.PUBLIC.HOME) {
      const resetTimer = window.setTimeout(() => {
        setAreHomeImagesReady(false);
      }, 0);

      return () => {
        window.clearTimeout(resetTimer);
      };
    }

    if (!isHomeDataReady) {
      const resetTimer = window.setTimeout(() => {
        setAreHomeImagesReady(false);
      }, 0);

      return () => {
        window.clearTimeout(resetTimer);
      };
    }

    if (homeImageSources.length === 0) {
      const readyTimer = window.setTimeout(() => {
        setAreHomeImagesReady(true);
      }, 0);

      return () => {
        window.clearTimeout(readyTimer);
      };
    }

    if (typeof Image === "undefined") {
      const readyTimer = window.setTimeout(() => {
        setAreHomeImagesReady(true);
      }, 0);

      return () => {
        window.clearTimeout(readyTimer);
      };
    }

    let ignore = false;

    const preloadImage = (source: string) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        const done = () => resolve();

        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        image.src = source;
      });

    Promise.all(homeImageSources.map(preloadImage)).then(() => {
      if (!ignore) {
        setAreHomeImagesReady(true);
      }
    });

    return () => {
      ignore = true;
    };
  }, [homeImageSources, isHomeDataReady, location.pathname]);
  return (
    <>
      {sessionReady ? (
        <Router
          isHomeDataReady={isHomeDataReady}
          isUserDataReady={isUserDataReady}
        />
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
