/**Composant principal de l'application, il gere le routage et l'affichage des notifications (toast)  */
import { useCallback, useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";
import { useLocation } from "react-router-dom";

import Router from "./app/Router";
import AppSplash from "./shared/components/layout/AppSplash";
import { ROUTES } from "./shared/constants/routes";

function App() {
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(
    () => location.pathname === ROUTES.PUBLIC.HOME,
  );
  const [isHomeReady, setIsHomeReady] = useState(false);
  const hideSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

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
      <Router />

      {showSplash && (
        <AppSplash isReady={isHomeReady} onFinished={hideSplash} />
      )}

      <ToastContainer position="top-right" autoClose={3000} theme="light" />
    </>
  );
}

export default App;
