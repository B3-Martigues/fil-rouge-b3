/**Header principal de l'application.
 * Affiche une navigation defférente selon l'état de connexion et le rôle utilisateur.
 */
import useAuthStore from "../../../domains/auth/store/authStore";

import HeaderPublic from "./HeaderPublic";
import HeaderUser from "./HeaderUser";
import HeaderAdmin from "./HeaderAdmin";
import HeaderCompany from "./HeaderCompany";

const accountTypeLabels = {
  admin: "Compte administrateur",
  company: "Compte entreprise",
  user: "Compte utilisateur",
} as const;

export default function Header() {
  /**Récupération des information auth depuis zustand */
  const { isAuthenticated, role } = useAuthStore();

  /**Utilisateur non connecté */
  if (!isAuthenticated) return <HeaderPublic />;

  const headerByRole = () => {
    /**Navigation administrateur */
    if (role === "admin") return <HeaderAdmin />;
    /**Navigation entreprise */
    if (role === "company") return <HeaderCompany />;

    /**Navigation utilisateur classique */
    return <HeaderUser />;
  };

  const accountType = role ? accountTypeLabels[role] : "Compte connecté";

  return (
    <>
      <div className="account-type-badge" aria-label="Type de compte connecté">
        {accountType}
      </div>
      {headerByRole()}
    </>
  );
}
