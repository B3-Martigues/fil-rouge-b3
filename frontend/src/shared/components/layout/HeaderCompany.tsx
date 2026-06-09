import { NavLink } from "react-router-dom";

import LogoutButton from "../../../domains/auth/components/LogoutButton";
import { useCompanyAccess } from "../../../domains/companies/hooks/useCompanyAccess";
import NotificationCenter from "../../../domains/notifications/components/NotificationCenter";
import { FormModalNavLink } from "../forms/FormModalLink";
import { ROUTES } from "../../constants/routes";

export default function HeaderCompany() {
  const { canManageEvents } = useCompanyAccess();

  return (
    <header className="role-header">
      <nav className="role-header__nav">
        <NavLink to={ROUTES.PUBLIC.HOME}>Accueil</NavLink>
        <FormModalNavLink to={ROUTES.COMPANY.PROFILE}>Profil</FormModalNavLink>
        {canManageEvents && (
          <>
            <NavLink to={ROUTES.COMPANY.EVENTS}>Mes evenements</NavLink>
            <FormModalNavLink to={ROUTES.COMPANY.CREATE}>
              Nouvel evenement
            </FormModalNavLink>
          </>
        )}
        <NotificationCenter />
        <LogoutButton />
      </nav>
    </header>
  );
}
