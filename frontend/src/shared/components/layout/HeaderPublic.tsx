import { NavLink } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import HeaderWeather from "./HeaderWeather";
import ThemeToggle from "./ThemeToggle";

export default function HeaderPublic() {
  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.PUBLIC.LOGIN}>Connexion</NavLink>
        <HeaderWeather />
        <ThemeToggle />
      </nav>
    </header>
  );
}
