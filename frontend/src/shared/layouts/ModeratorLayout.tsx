import { Outlet } from "react-router-dom";

import Header from "../components/layout/Header";

export default function ModeratorLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
}
