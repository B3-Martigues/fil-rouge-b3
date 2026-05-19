/**
 * Layout public pour les utilisateurs non connectés.
 * Contient le header public et les pages accessibles sans authentification.
 */

import { Outlet } from "react-router-dom";
import Header from "../components/layout/Header";

export default function PublicLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
