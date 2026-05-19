/**Header affiché pour les comptes entreprise connectés */
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import LogoutButton from "../../../domains/auth/components/LogoutButton";

export default function HeaderCompany() {
  return (
    <header>
      {/* Navigation entreprise */}
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        {/* Accès à la page d'accueil */}
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>

        {/* Accès au profil entreprise */}
        <NavLink to={ROUTES.COMPANY.PROFILE}>Profil</NavLink>

        {/* Gestion des évènements entreprise */}
        <NavLink to={ROUTES.COMPANY.EVENTS}>Évènements</NavLink>

        {/* Creation d'un nouvel évènement */}
        <NavLink to={ROUTES.COMPANY.CREATE}>Nouvel évènement</NavLink>

        {/* Déconnexion utilisateur */}
        <LogoutButton />
      </nav>
    </header>
  );
}
