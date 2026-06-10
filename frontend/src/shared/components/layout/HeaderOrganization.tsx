import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import { useOrganizationAccess } from "../../../domains/organizations/hooks/useOrganizationAccess";
import NotificationCenter from "../../../domains/notifications/components/NotificationCenter";
import { FormModalNavLink } from "../forms/FormModalLink";
import { ROUTES } from "../../constants/routes";
import ThemeToggle from "./ThemeToggle";

export default function HeaderOrganization() {
  const { canManageEvents } = useOrganizationAccess();

  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <FormModalNavLink to={ROUTES.ORGANIZATION.PROFILE}>Profil</FormModalNavLink>
        {canManageEvents && (
          <>
            <NavLink to={ROUTES.ORGANIZATION.EVENTS}>Mes evenements</NavLink>
            <FormModalNavLink to={ROUTES.ORGANIZATION.CREATE}>
              Nouvel evenement
            </FormModalNavLink>
          </>
        )}
        <NotificationCenter />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
