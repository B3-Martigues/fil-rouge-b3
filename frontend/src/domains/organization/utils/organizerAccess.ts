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

  const memberships = organizers
    .filter(
      (organizer) => organizer.user_id === userId && !organizer.deleted_at,
    )
    .map((organizer) => {
      const organization = organizations.find(
        (item) => item.id === organizer.organization_id && !item.deleted_at,
      );

      if (!organization) return null;

      return { organizer, organization };
    })
    .filter(
      (membership): membership is UserOrganizationMembership =>
        membership !== null,
    );

  if (
    currentUser.organization_id &&
    !memberships.some(
      ({ organization }) => organization.id === currentUser.organization_id,
    )
  ) {
    const directOrganization = organizations.find(
      (item) => item.id === currentUser.organization_id && !item.deleted_at,
    );

    if (directOrganization) {
      memberships.push({
        organizer: {
          id: -directOrganization.id,
          user_id: userId,
          organization_id: directOrganization.id,
          job_role: "Organisateur",
          created_at: directOrganization.created_at,
          updated_at: directOrganization.updated_at,
        },
        organization: directOrganization,
      });
    }
  }

  return memberships;
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
