/**Header affiché pour les utilisateur connectés */
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import LogoutButton from "../../../domains/auth/components/LogoutButton";

export default function HeaderUser() {
  return (
    <header>
      {/* Navigation utilisateur */}
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        {/* Accès à la page d'accueil */}
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>

        {/* Accès au profil utilisateur */}
        <NavLink to={ROUTES.USER.PROFILE}>Profil</NavLink>

        {/* Accès aux événements favoris */}
        <NavLink to={ROUTES.USER.FAVORITES}>Favoris</NavLink>

        {/* Accès à l'historique utilisateur */}
        <NavLink to={ROUTES.USER.HISTORY}>Historique</NavLink>

        {/* Déconnexion utilisateur */}
        <LogoutButton />
      </nav>
    </header>
  );
}
