import { NavLink } from "react-router-dom";

import useAuthStore from "../../../domains/auth/store/authStore";
import LogoutButton from "../../../domains/auth/components/LogoutButton";
import NotificationCenter from "../../../domains/notification/components/NotificationCenter";
import { hasCurrentUserOrganizationMembership } from "../../../domains/organization/utils/organizerAccess";
import useDataStore from "../../store/dataStore";
import { ROUTES } from "../../constants/routes";
import HeaderWeather from "./HeaderWeather";
import ThemeToggle from "./ThemeToggle";

export default function HeaderUser() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const organizers = useDataStore((s) => s.organizers);
  const organizations = useDataStore((s) => s.organizations);
  const hasOrganizations = hasCurrentUserOrganizationMembership(
    currentUser,
    organizers,
    organizations,
  );

  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.USER.PROFILE}>Profil</NavLink>
        <NavLink to={ROUTES.USER.FAVORITES}>Favoris</NavLink>
        <NavLink to={ROUTES.USER.HISTORY}>Historique</NavLink>
        {hasOrganizations && (
          <NavLink to={ROUTES.USER.ORGANIZATIONS}>Organisations</NavLink>
        )}
        <NotificationCenter />
        <HeaderWeather />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
