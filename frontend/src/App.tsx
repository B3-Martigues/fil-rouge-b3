/**Composant principal de l'application, il gere le routage et l'affichage des notifications (toast)  */
import { useCallback, useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import { useLocation } from "react-router-dom";

import Router from "./app/Router";
import { authHttpApi } from "./domains/auth/api/authHttp.api";
import useAuthStore from "./domains/auth/store/authStore";
import AppSplash from "./shared/components/layout/AppSplash";
import { ROUTES } from "./shared/constants/routes";

function App() {
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const [showSplash, setShowSplash] = useState(
    () => location.pathname === ROUTES.PUBLIC.HOME,
  );
  const [isHomeReady, setIsHomeReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
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
    const markHomeReady = () => {
      setIsHomeReady(true);
    };

    window.addEventListener("mappening:home-map-ready", markHomeReady);

    return () => {
      window.removeEventListener("mappening:home-map-ready", markHomeReady);
    };
  }, []);

  return (
    <>
      {sessionReady ? (
        <Router />
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
