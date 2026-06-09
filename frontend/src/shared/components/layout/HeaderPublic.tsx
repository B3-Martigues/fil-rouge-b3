import { NavLink } from "react-router-dom";

import { FormModalNavLink } from "../forms/FormModalLink";
import { ROUTES } from "../../constants/routes";

export default function HeaderPublic() {
  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <FormModalNavLink to={ROUTES.PUBLIC.LOGIN}>Connexion</FormModalNavLink>
      </nav>
    </header>
  );
}
