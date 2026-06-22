import { useMemo, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";

import Header from "../components/layout/Header";
import { StaffHeaderActionProvider } from "./StaffHeaderActionContext";

export default function AdminLayout() {
  const [staffHeaderAction, setStaffHeaderAction] = useState<ReactNode | null>(
    null,
  );
  const staffHeaderActionContext = useMemo(
    () => ({ setAction: setStaffHeaderAction }),
    [],
  );

  return (
    <StaffHeaderActionProvider value={staffHeaderActionContext}>
      <Header
        showStaffAccountHeader
        staffHeaderAction={staffHeaderAction}
      />
      <main className="staff-layout">
        <Outlet />
      </main>
    </StaffHeaderActionProvider>
  );
}
