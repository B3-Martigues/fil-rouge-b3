/**Header affiché pour les visiteurs non connectés */
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
export default function HeaderPublic() {
  return (
    <header>
      {/* Navigation publique */}
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        {/* Accès à la page d'accueil */}
        <NavLink to="/">Accueil</NavLink>

        {/* Accès à la page de connexion */}
        <NavLink to={ROUTES.PUBLIC.LOGIN}>Connexion</NavLink>
      </nav>
    </header>
  );
}
