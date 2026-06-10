import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

export function useOrganizationAccess() {
  const user = useAuthStore((s) => s.currentUser);
  const organizations = useDataStore((s) => s.organizations);
  const isOrganization = user?.role === "organization";
  const currentOrganization = isOrganization
    ? organizations.find(
        (organization) =>
          organization.id === user.organization_id &&
          organization.account_id === user.account_id &&
          !organization.deleted_at,
      )
    : undefined;
  const isActive = isOrganization && !!currentOrganization?.is_active;
  const isPendingApproval = isOrganization && !isActive;
  const canManageEvents = isOrganization && isActive;

  return {
    isOrganization,
    isActive,
    isPendingApproval,
    canManageEvents,
    currentOrganization,
  };
}
