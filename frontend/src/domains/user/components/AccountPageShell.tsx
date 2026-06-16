import type { ReactNode } from "react";
import { ArrowLeft, Clock3, Heart, Settings2, UserRound } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { FormModalLink } from "../../../shared/components/forms/FormModalLink";
import { ROUTES } from "../../../shared/constants/routes";
import useDataStore from "../../../shared/store/dataStore";
import useAuthStore from "../../auth/store/authStore";

type AccountSection = "profile" | "favorites" | "preferences" | "history";

type Props = {
  activeSection: AccountSection;
  children: ReactNode;
};

const accountSections = [
  {
    key: "profile",
    label: "Profil",
    title: "Mon profil",
    route: ROUTES.USER.PROFILE,
    Icon: UserRound,
  },

  {
    key: "preferences",
    label: "Préférences",
    title: "Mes preferences",
    route: ROUTES.USER.PREFERENCES,
    Icon: Settings2,
  },
  {
    key: "favorites",
    label: "Favoris",
    title: "Mes favoris",
    route: ROUTES.USER.FAVORITES,
    Icon: Heart,
  },
  {
    key: "history",
    label: "Historique",
    title: "Mon historique",
    route: ROUTES.USER.HISTORY,
    Icon: Clock3,
  },
] as const;

const getInitials = (name?: string | null) => {
  if (!name) return "U";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const formatMemberSince = (value?: string | null) => {
  if (!value) return "date inconnue";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "date inconnue";

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
};

export default function AccountPageShell({ activeSection, children }: Props) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const organizations = useDataStore((s) => s.organizations);
  const organizers = useDataStore((s) => s.organizers);
  const events = useDataStore((s) => s.events);
  const userId = currentUser?.user_id;
  const user = users.find((item) => item.id === userId && !item.deleted_at);
  const account = accounts.find(
    (item) => item.id === currentUser?.account_id && !item.deleted_at,
  );
  const userOrganizationIds = new Set(
    organizers
      .filter((organizer) => organizer.user_id === userId && !organizer.deleted_at)
      .map((organizer) => organizer.organization_id),
  );
  const organizationCount = organizations.filter(
    (organization) =>
      userOrganizationIds.has(organization.id) && !organization.deleted_at,
  ).length;
  const createdEventCount = events.filter(
    (event) => userOrganizationIds.has(event.organization_id) && !event.deleted_at,
  ).length;
  const hasOrganizations = organizationCount > 0;
  const memberSince = formatMemberSince(account?.created_at ?? user?.created_at);
  const displayName = currentUser?.username ?? "Utilisateur";
  const email = currentUser?.login_email ?? "Compte utilisateur";
  const activeSectionTitle =
    accountSections.find((section) => section.key === activeSection)?.title ??
    "Compte";

  return (
    <section className="account-shell" aria-labelledby="account-title">
      <header className="account-shell__header">
        <Link className="account-shell__home-link" to={ROUTES.PUBLIC.HOME}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Accueil</span>
        </Link>
        <h1 id="account-title">Compte</h1>
      </header>

      <div className="account-shell__sticky">
        <div className="account-summary">
          <div className="account-summary__avatar" aria-hidden="true">
            {getInitials(displayName)}
          </div>
          <div className="account-summary__identity">
            <strong>{displayName}</strong>
            <span>{email}</span>
          </div>
          <div
            className={`account-summary__meta${
              hasOrganizations ? " account-summary__meta--organizer" : ""
            }`}
            aria-label="Resume du compte"
          >
            <span className="account-summary__member-since">
              Membre depuis {memberSince}
            </span>
            {hasOrganizations ? (
              <>
                <span>
                  {organizationCount} organisation
                  {organizationCount > 1 ? "s" : ""}
                </span>
                <span>
                  {createdEventCount} evenement
                  {createdEventCount > 1 ? "s" : ""} cree
                  {createdEventCount > 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <FormModalLink
                className="btn account-summary__organizer-link"
                to={ROUTES.USER.BECOME_ORGANIZER}
              >
                Devenir organisateur
              </FormModalLink>
            )}
          </div>
        </div>

        <nav className="account-tabs" aria-label="Sections du compte">
          {accountSections.map(({ key, label, route, Icon }) => (
            <NavLink
              className={({ isActive }) =>
                [
                  "account-tabs__item",
                  isActive || activeSection === key ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              key={key}
              to={route}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <h2 className="account-shell__section-title">{activeSectionTitle}</h2>
      </div>

      <div className="account-shell__content">{children}</div>
    </section>
  );
}
