import { CalendarDays, ShieldCheck, UsersRound } from "lucide-react";
import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import { ROUTES } from "../../constants/routes";
import HeaderWeather from "./HeaderWeather";
import StaffAccountHeader from "./StaffAccountHeader";
import ThemeToggle from "./ThemeToggle";

type HeaderAdminProps = {
  showAccountHeader?: boolean;
};

const adminTabs = [
  {
    label: "Comptes",
    route: ROUTES.ADMIN.DASHBOARD,
    Icon: UsersRound,
    end: true,
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

export default function HeaderAdmin({
  showAccountHeader = false,
}: HeaderAdminProps) {
  if (showAccountHeader) {
    return <StaffAccountHeader ariaLabel="Navigation administrateur" tabs={adminTabs} />;
  }

  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.ADMIN.DASHBOARD}>Admin</NavLink>
        <NavLink to={ROUTES.MODERATOR.DASHBOARD}>Moderation</NavLink>
        <HeaderWeather />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
