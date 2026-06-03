import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import NotificationCenter from "../../../domains/notifications/components/NotificationCenter";
import { ROUTES } from "../../constants/routes";

export default function HeaderCompany() {
  return (
    <header>
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.COMPANY.PROFILE}>Profil</NavLink>
        <NavLink to={ROUTES.COMPANY.EVENTS}>Mes événements</NavLink>
        <NavLink to={ROUTES.COMPANY.CREATE}>Nouvel evenement</NavLink>
        <NotificationCenter />
        <LogoutButton />
      </nav>
    </header>
  );
}
