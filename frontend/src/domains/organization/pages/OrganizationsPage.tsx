import { Link } from "react-router-dom";

import EmptyState from "../../../shared/components/feedback/EmptyState";
import { FormModalLink } from "../../../shared/components/forms/FormModalLink";
import ActionRow from "../../../shared/components/layout/ActionRow";
import StatusBadge from "../../../shared/components/ui/StatusBadge";
import { ROUTES } from "../../../shared/constants/routes";
import useDataStore from "../../../shared/store/dataStore";
import useAuthStore from "../../auth/store/authStore";
import type { Organization } from "../types/organization";
import { getOrganizationStatus } from "../utils/organizationWorkflow";

const getOrganizationDetailPath = (organizationId: number) =>
  ROUTES.USER.ORGANIZATION_DETAIL.replace(":organizationId", String(organizationId));

export default function OrganizationsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const organizations = useDataStore((s) => s.organizations);
  const organizers = useDataStore((s) => s.organizers);
  const events = useDataStore((s) => s.events);
  const userId = currentUser?.user_id;
  const userOrganizations = userId
    ? organizers
        .filter((organizer) => organizer.user_id === userId && !organizer.deleted_at)
        .map((organizer) =>
          organizations.find(
            (organization) =>
              organization.id === organizer.organization_id && !organization.deleted_at,
          ),
        )
        .filter((organization): organization is Organization => Boolean(organization))
    : [];

  return (
    <section className="organizations-page">
      <div className="organizations-page__header">
        <div>
          <h1>Organisations</h1>
          <p>Retrouvez les organisations rattachees a votre compte.</p>
        </div>

        <FormModalLink className="btn" to={ROUTES.USER.CREATE_ORGANIZATION}>
          Ajouter une nouvelle organisation
        </FormModalLink>
      </div>

      {userOrganizations.length === 0 ? (
        <EmptyState message="Aucune organisation rattachee a votre compte." />
      ) : (
        <div className="organization-card-grid">
          {userOrganizations.map((organization) => {
            const status = getOrganizationStatus(organization);
            const eventCount = events.filter(
              (event) =>
                event.organization_id === organization.id && !event.deleted_at,
            ).length;

            return (
              <Link
                className="organization-card"
                key={organization.id}
                to={getOrganizationDetailPath(organization.id)}
              >
                <div className="organization-card__logo">
                  {organization.logo ? (
                    <img src={organization.logo} alt={`Logo ${organization.name}`} />
                  ) : (
                    <span>{organization.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <div className="organization-card__body">
                  <div className="organization-card__title">
                    <h2>{organization.name}</h2>
                    <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                  </div>

                  <dl>
                    <div>
                      <dt>Categorie</dt>
                      <dd>{organization.category_slugs.join(", ")}</dd>
                    </div>
                    <div>
                      <dt>Evenements</dt>
                      <dd>{eventCount}</dd>
                    </div>
                  </dl>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <ActionRow align="start">
        <FormModalLink className="btn btn--secondary" to={ROUTES.USER.CREATE_ORGANIZATION}>
          Ajouter une nouvelle organisation
        </FormModalLink>
      </ActionRow>
    </section>
  );
}
