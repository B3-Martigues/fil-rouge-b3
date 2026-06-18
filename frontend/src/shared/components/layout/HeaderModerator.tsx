import {
  Building2,
  CalendarDays,
  Flag,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import useModeratorPermissions from "../../../domains/moderator/hooks/useModeratorPermissions";
import { ROUTES } from "../../constants/routes";
import HeaderWeather from "./HeaderWeather";
import StaffAccountHeader from "./StaffAccountHeader";
import ThemeToggle from "./ThemeToggle";

type HeaderModeratorProps = {
  showAccountHeader?: boolean;
};

export default function HeaderModerator({
  showAccountHeader = false,
}: HeaderModeratorProps) {
  const { can } = useModeratorPermissions();
  const canReviewEvents = can("review_events");
  const canModerateEvents = can("moderate_events");
  const canReviewOrganizations = can("review_organizations");
  const canSuspendAccounts = can("suspend_accounts");
  const canManageReports = can("manage_reports");
  const moderatorTabs = [
    {
      label: "Moderation",
      route: ROUTES.MODERATOR.DASHBOARD,
      Icon: ShieldCheck,
      end: true,
      isVisible: true,
    },
    {
      label: "Evenements",
      route: ROUTES.MODERATOR.EVENTS,
      Icon: CalendarDays,
      isVisible: canReviewEvents || canModerateEvents,
    },
    {
      label: "Organisations",
      route: ROUTES.MODERATOR.ORGANIZATIONS,
      Icon: Building2,
      isVisible: canReviewOrganizations || canSuspendAccounts,
    },
    {
      label: "Comptes",
      route: ROUTES.MODERATOR.ACCOUNTS,
      Icon: UsersRound,
      isVisible: canSuspendAccounts,
    },
    {
      label: "Signalements",
      route: ROUTES.MODERATOR.REPORTS,
      Icon: Flag,
      isVisible: canManageReports,
    },
  ] as const;

  const visibleTabs = moderatorTabs.filter((tab) => tab.isVisible);

  if (showAccountHeader) {
    return (
      <StaffAccountHeader
        ariaLabel="Navigation moderation"
        tabs={visibleTabs}
      />
    );
  }

  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        {visibleTabs.map(({ label, route }) => (
          <NavLink key={route} to={route}>
            {label}
          </NavLink>
        ))}
        <HeaderWeather />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
