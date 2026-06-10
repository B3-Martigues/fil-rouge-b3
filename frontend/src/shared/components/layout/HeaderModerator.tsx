import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import NotificationCenter from "../../../domains/notifications/components/NotificationCenter";
import { ROUTES } from "../../constants/routes";
import ThemeToggle from "./ThemeToggle";

export default function HeaderModerator() {
  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <NavLink to={ROUTES.MODERATOR.DASHBOARD}>Moderation</NavLink>
        <NotificationCenter />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
