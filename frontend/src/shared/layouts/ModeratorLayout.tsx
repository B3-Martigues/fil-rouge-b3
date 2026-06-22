import { Outlet } from "react-router-dom";

import Header from "../components/layout/Header";

export default function ModeratorLayout() {
  return (
    <>
      <Header showStaffAccountHeader />
      <main className="staff-layout">
        <Outlet />
      </main>
    </>
  );
}
