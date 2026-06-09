import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import NotificationCenter from "../../../domains/notifications/components/NotificationCenter";
import { FormModalNavLink } from "../forms/FormModalLink";
import { ROUTES } from "../../constants/routes";

export default function HeaderUser() {
  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <FormModalNavLink to={ROUTES.USER.PROFILE}>Profil</FormModalNavLink>
        <NavLink to={ROUTES.USER.FAVORITES}>Favoris</NavLink>
        <NavLink to={ROUTES.USER.HISTORY}>Historique</NavLink>
        <NotificationCenter />
        <LogoutButton />
      </nav>
    </header>
  );
}
