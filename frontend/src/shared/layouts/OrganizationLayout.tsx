/**
 * Layout pour les organizations.
 */

import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";

export default function OrganizationLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
