/**
 * Layout public pour les utilisateurs non connectés.
 * Contient le header public et les pages accessibles sans authentification.
 */

import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/layout/Header";
import { ROUTES } from "../constants/routes";

export default function PublicLayout() {
  const { pathname } = useLocation();
  const isAuthPage =
    pathname === ROUTES.PUBLIC.LOGIN || pathname === ROUTES.PUBLIC.REGISTER;

  return (
    <div className={`public-layout${isAuthPage ? " public-layout--auth" : ""}`}>
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
