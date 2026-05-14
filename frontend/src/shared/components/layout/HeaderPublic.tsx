/**Header affiché pour les visiteurs non connectés */
import { NavLink } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
export default function HeaderPublic() {
  return (
    <header>
      {/* Navigation publique */}
      <nav style={{ display: "flex", justifyContent: "center", gap: "50px" }}>
        {/* Accès à la carte des événements */}
        <NavLink to="/">Carte</NavLink>

        {/* Accès à la page de connexion */}
        <NavLink to={ROUTES.PUBLIC.LOGIN}>Connection</NavLink>
      </nav>
    </header>
  );
}
