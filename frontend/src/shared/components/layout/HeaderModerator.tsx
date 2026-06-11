import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import useModeratorPermissions from "../../../domains/moderator/hooks/useModeratorPermissions";
import NotificationCenter from "../../../domains/notification/components/NotificationCenter";
import { ROUTES } from "../../constants/routes";
import HeaderWeather from "./HeaderWeather";
import ThemeToggle from "./ThemeToggle";

export default function HeaderModerator() {
  const { can } = useModeratorPermissions();
  const canReviewEvents = can("review_events");
  const canModerateEvents = can("moderate_events");
  const canReviewOrganizations = can("review_organizations");
  const canSuspendAccounts = can("suspend_accounts");
  const canManageReports = can("manage_reports");

  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.MODERATOR.DASHBOARD}>Moderation</NavLink>
        {(canReviewEvents || canModerateEvents) && (
          <NavLink to={ROUTES.MODERATOR.EVENTS}>Evenements</NavLink>
        )}
        {(canReviewOrganizations || canSuspendAccounts) && (
          <NavLink to={ROUTES.MODERATOR.ORGANIZATIONS}>Organisations</NavLink>
        )}
        {canSuspendAccounts && (
          <NavLink to={ROUTES.MODERATOR.ACCOUNTS}>Comptes</NavLink>
        )}
        {canManageReports && (
          <NavLink to={ROUTES.MODERATOR.REPORTS}>Signalements</NavLink>
        )}
        <NotificationCenter />
        <HeaderWeather />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
