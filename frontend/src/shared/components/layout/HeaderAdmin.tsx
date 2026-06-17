import { CalendarDays, ShieldCheck, UsersRound } from "lucide-react";

import { ROUTES } from "../../constants/routes";
import StaffAccountHeader from "./StaffAccountHeader";

const adminTabs = [
  {
    label: "Comptes",
    route: ROUTES.ADMIN.DASHBOARD,
    Icon: UsersRound,
  },
  {
    label: "Evenements",
    route: ROUTES.ADMIN.EVENTS,
    Icon: CalendarDays,
  },
  {
    label: "Moderation",
    route: ROUTES.MODERATOR.DASHBOARD,
    Icon: ShieldCheck,
  },
] as const;

export default function HeaderAdmin() {
  return <StaffAccountHeader ariaLabel="Navigation administrateur" tabs={adminTabs} />;
}
