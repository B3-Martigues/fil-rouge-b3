import { Outlet, useLocation } from "react-router-dom";

import Header from "../components/layout/Header";

export default function ModeratorLayout() {
  const location = useLocation();

  return (
    <>
      <Header key={location.pathname} />
      <main>
        <Outlet />
      </main>
    </>
  );
}
