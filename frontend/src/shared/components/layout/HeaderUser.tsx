import { NavLink } from "react-router-dom";

import useAuthStore from "../../../domains/auth/store/authStore";
import LogoutButton from "../../../domains/auth/components/LogoutButton";
import NotificationCenter from "../../../domains/notifications/components/NotificationCenter";
import useDataStore from "../../store/dataStore";
import { FormModalNavLink } from "../forms/FormModalLink";
import { ROUTES } from "../../constants/routes";
import ThemeToggle from "./ThemeToggle";

export default function HeaderUser() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const organizers = useDataStore((s) => s.organizers);
  const hasOrganizations =
    !!currentUser?.user_id &&
    organizers.some(
      (organizer) =>
        organizer.user_id === currentUser.user_id && !organizer.deleted_at,
    );

  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <FormModalNavLink to={ROUTES.USER.PROFILE}>Profil</FormModalNavLink>
        <NavLink to={ROUTES.USER.FAVORITES}>Favoris</NavLink>
        <NavLink to={ROUTES.USER.HISTORY}>Historique</NavLink>
        {hasOrganizations && (
          <NavLink to={ROUTES.USER.ORGANIZATIONS}>Organisations</NavLink>
        )}
        <NotificationCenter />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
