import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import NotificationCenter from "../../../domains/notification/components/NotificationCenter";
import { ROUTES } from "../../constants/routes";
import HeaderWeather from "./HeaderWeather";
import ThemeToggle from "./ThemeToggle";

export default function HeaderAdmin() {
  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.ADMIN.DASHBOARD}>Admin</NavLink>
        <NavLink to={ROUTES.MODERATOR.DASHBOARD}>Moderation</NavLink>
        <NotificationCenter />
        <HeaderWeather />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
