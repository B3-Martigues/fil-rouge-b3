/**Header affiché pour les comptes entreprise connectés */
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import LogoutButton from "../../../domains/auth/components/LogoutButton";

export default function HeaderCompany() {
  return (
    <header>
      {/* Navigation entreprise */}
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        {/* Accès à la carte publique */}
        {/* <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink> */}

        {/* Accès au profil entreprise */}
        <NavLink to={ROUTES.COMPANY.PROFILE}>Profil</NavLink>

        {/* Gestion des evenements entreprise */}
        <NavLink to={ROUTES.COMPANY.EVENTS}>Evenements</NavLink>

        {/* Creation d'un nouvel evenement */}
        <NavLink to={ROUTES.COMPANY.CREATE}>Nouvel evenement</NavLink>

        {/* Déconnexion utilisateur */}
        <LogoutButton />
      </nav>
    </header>
  );
}
