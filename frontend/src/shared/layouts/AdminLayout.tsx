/**
 * Layout pour l'administration.
 */

import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/layout/Header";

export default function AdminLayout() {
  const location = useLocation();

  return (
    <>
      <Header key={location.pathname} showStaffAccountHeader />
      <main>
        <Outlet />
      </main>
    </>
  );
}
