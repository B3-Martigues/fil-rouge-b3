import useAuthStore from "../../../domains/auth/store/authStore";
import useDataStore from "../../store/dataStore";

import HeaderAdmin from "./HeaderAdmin";
import HeaderCompany from "./HeaderCompany";
import HeaderModerator from "./HeaderModerator";
import HeaderPublic from "./HeaderPublic";
import HeaderUser from "./HeaderUser";

const accountTypeLabels = {
  admin: "Compte administrateur",
  moderator: "Compte moderateur",
  company: "Compte entreprise",
  user: "Compte utilisateur",
} as const;

export default function Header() {
  const { currentUser, isAuthenticated, role } = useAuthStore();
  const companies = useDataStore((s) => s.companies);

  if (!isAuthenticated) return <HeaderPublic />;

  const company =
    currentUser?.role === "company"
      ? companies.find(
          (item) =>
            item.id === currentUser.company_id &&
            item.account_id === currentUser.account_id &&
            !item.deleted_at,
        )
      : undefined;
  const isPendingCompany = role === "company" && !company?.is_active;
  const accountType = role ? accountTypeLabels[role] : "Compte connecte";

  const headerByRole = () => {
    if (role === "admin") return <HeaderAdmin />;
    if (role === "moderator") return <HeaderModerator />;
    if (role === "company") return <HeaderCompany />;

    return <HeaderUser />;
  };

  return (
    <>
      <div className="account-type-badge" aria-label="Type de compte connecte">
        {accountType}
        {isPendingCompany ? " - en attente de validation" : ""}
      </div>
      {headerByRole()}
    </>
  );
}
