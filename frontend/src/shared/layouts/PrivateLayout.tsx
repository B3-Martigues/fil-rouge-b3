/**
 * Layout pour les utilisateurs connectés.
 * Affiche le header utilisateur et les pages privées.
 */

import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/layout/Header";
import { ROUTES } from "../constants/routes";

const accountRoutes = new Set<string>([
  ROUTES.USER.PROFILE,
  ROUTES.USER.FAVORITES,
  ROUTES.USER.HISTORY,
  ROUTES.USER.NOTIFICATIONS,
  ROUTES.USER.PARAMETERS,
  ROUTES.USER.ORGANIZATIONS,
  ROUTES.USER.EVENTS,
]);

export default function PrivateLayout() {
  const location = useLocation();
  const showHeader = !accountRoutes.has(location.pathname);

  return (
    <>
      {showHeader && <Header />}
      <main>
        <Outlet />
      </main>
    </>
  );
}
