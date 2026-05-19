/**Header affiché pour l'administrateur connecté */
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import LogoutButton from "../../../domains/auth/components/LogoutButton";

export default function HeaderAdmin() {
  return (
    <header>
      {/* Navigation administrateur */}
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        {/* Accès tableau de bord admin */}
        <NavLink to={ROUTES.ADMIN.DASHBOARD}>Dashboard</NavLink>

        {/* Gestion des événements */}
        <NavLink to={ROUTES.ADMIN.EVENTS}>Événements</NavLink>

        {/* Gestion des comptes */}
        <NavLink to={ROUTES.ADMIN.USERS}>Comptes</NavLink>

        {/* Déconnexion administrateur */}
        <LogoutButton />
      </nav>
    </header>
  );
}
