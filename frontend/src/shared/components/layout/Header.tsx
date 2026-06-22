import type { ReactNode } from "react";

import useAuthStore from "../../../domains/auth/store/authStore";
import useDataStore from "../../store/dataStore";

import HeaderAdmin from "./HeaderAdmin";
import HeaderOrganization from "./HeaderOrganization";
import HeaderModerator from "./HeaderModerator";
import HeaderPublic from "./HeaderPublic";
import HeaderUser from "./HeaderUser";

const accountTypeLabels = {
  admin: "Compte administrateur",
  moderator: "Compte moderateur",
  organization: "Compte organization",
  user: "Compte utilisateur",
} as const;

type HeaderProps = {
  showStaffAccountHeader?: boolean;
  staffHeaderAction?: ReactNode;
};

export default function Header({
  showStaffAccountHeader = false,
  staffHeaderAction,
}: HeaderProps) {
  const { currentUser, isAuthenticated, role } = useAuthStore();
  const organizations = useDataStore((s) => s.organizations);

  if (!isAuthenticated) return <HeaderPublic />;

  const organization =
    currentUser?.role === "organization"
      ? organizations.find(
          (item) =>
            item.id === currentUser.organization_id &&
            item.account_id === currentUser.account_id &&
            !item.deleted_at,
        )
      : undefined;
  const isPendingOrganization = role === "organization" && !organization?.is_active;
  const accountType = role ? accountTypeLabels[role] : "Compte connecte";

  const headerByRole = () => {
    if (role === "admin") {
      return (
        <HeaderAdmin
          showAccountHeader={showStaffAccountHeader}
          staffHeaderAction={staffHeaderAction}
        />
      );
    }
    if (role === "moderator") {
      return (
        <HeaderModerator
          showAccountHeader={showStaffAccountHeader}
          staffHeaderAction={staffHeaderAction}
        />
      );
    }
    if (role === "organization") return <HeaderOrganization />;

    return <HeaderUser />;
  };

  return (
    <>
      {role !== "admin" && role !== "moderator" && (
        <div className="account-type-badge" aria-label="Type de compte connecte">
          {accountType}
          {isPendingOrganization ? " - en attente de validation" : ""}
        </div>
      )}
      {headerByRole()}
    </>
  );
}
