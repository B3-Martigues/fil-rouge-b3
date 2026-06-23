import type { AuthenticatedUser } from "../../user/types/user";
import type { Organization } from "../types/organization";
import type { Organizer } from "../types/organizer";

export type UserOrganizationMembership = {
  organizer: Organizer;
  organization: Organization;
};

export function getCurrentUserOrganizationMemberships(
  currentUser: AuthenticatedUser | null | undefined,
  organizers: Organizer[],
  organizations: Organization[],
): UserOrganizationMembership[] {
  const userId = currentUser?.user_id;
  if (!userId) return [];

  return organizers
    .filter(
      (organizer) => organizer.user_id === userId && !organizer.deleted_at,
    )
    .map((organizer) => {
      const organization = organizations.find(
        (item) => item.id === organizer.organization_id && !item.deleted_at,
      );

      if (!organization) return null;

      if (
        currentUser.auth_source === "api" &&
        organization.account_id !== currentUser.account_id
      ) {
        return null;
      }

      return { organizer, organization };
    })
    .filter(
      (membership): membership is UserOrganizationMembership =>
        membership !== null,
    );
}

export function hasCurrentUserOrganizationMembership(
  currentUser: AuthenticatedUser | null | undefined,
  organizers: Organizer[],
  organizations: Organization[],
) {
  return (
    getCurrentUserOrganizationMemberships(
      currentUser,
      organizers,
      organizations,
    ).length > 0
  );
}
