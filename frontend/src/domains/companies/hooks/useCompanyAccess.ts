import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

export function useCompanyAccess() {
  const user = useAuthStore((s) => s.currentUser);
  const companies = useDataStore((s) => s.companies);
  const isCompany = user?.role === "company";
  const currentCompany = isCompany
    ? companies.find(
        (company) =>
          company.id === user.company_id &&
          company.account_id === user.account_id &&
          !company.deleted_at,
      )
    : undefined;
  const isActive = isCompany && !!currentCompany?.is_active;
  const isPendingApproval = isCompany && !isActive;
  const canManageEvents = isCompany && isActive;

  return {
    isCompany,
    isActive,
    isPendingApproval,
    canManageEvents,
    currentCompany,
  };
}
