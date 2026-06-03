/**Header affiche pour les utilisateurs connectes */
import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import NotificationCenter from "../../../domains/notifications/components/NotificationCenter";
import { ROUTES } from "../../constants/routes";

export default function HeaderUser() {
  return (
    <header>
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.USER.PROFILE}>Profil</NavLink>
        <NavLink to={ROUTES.USER.FAVORITES}>Favoris</NavLink>
        <NavLink to={ROUTES.USER.HISTORY}>Historique</NavLink>
        <NotificationCenter />
        <LogoutButton />
      </nav>
    </header>
  );
}
