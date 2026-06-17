import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LogOut, ShieldCheck, type LucideIcon } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import useAuthStore from "../../../domains/auth/store/authStore";
import useModeratorPermissions from "../../../domains/moderator/hooks/useModeratorPermissions";
import Button from "../ui/Button";
import { ROUTES } from "../../constants/routes";
import useDataStore from "../../store/dataStore";

type StaffAccountTab = {
  label: string;
  route: string;
  Icon: LucideIcon;
};

type Props = {
  ariaLabel: string;
  tabs: readonly StaffAccountTab[];
};

const roleLabels = {
  admin: "Administrateur",
  moderator: "Moderateur",
  organization: "Organisation",
  user: "Utilisateur",
} as const;

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

export default function StaffAccountHeader({ ariaLabel, tabs }: Props) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const { permissions } = useModeratorPermissions();
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const user = users.find(
    (item) => item.id === currentUser?.user_id && !item.deleted_at,
  );
  const account = accounts.find(
    (item) => item.id === currentUser?.account_id && !item.deleted_at,
  );
  const displayName = currentUser?.username ?? "Utilisateur";
  const email = currentUser?.login_email ?? "Compte utilisateur";
  const roleLabel = currentUser ? roleLabels[currentUser.role] : "Utilisateur";
  const memberSince = formatMemberSince(account?.created_at ?? user?.created_at);
  const staffScopeLabel =
    currentUser?.role === "admin"
      ? "Acces complet a la plateforme"
      : `${permissions.length} permission${permissions.length > 1 ? "s" : ""} active${
          permissions.length > 1 ? "s" : ""
        }`;

  const handleLogout = () => {
    logout();
    navigate(ROUTES.PUBLIC.LOGIN, { replace: true });
  };

  useEffect(() => {
    const header = headerRef.current;

    if (!header) return;

    const updateHeaderHeight = () => {
      setHeaderHeight(header.getBoundingClientRect().height);
    };

    updateHeaderHeight();

    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section
        className="account-shell account-shell--role-header"
        ref={headerRef}
        aria-labelledby="account-title"
      >
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
              <span className="account-summary__role">{roleLabel}</span>
            </div>
            <Button
              aria-label="Se deconnecter"
              className="account-summary__logout"
              icon={<LogOut size={17} aria-hidden="true" />}
              type="button"
              variant="secondary"
              onClick={handleLogout}
            >
              Deconnexion
            </Button>
            <div
              className="account-summary__meta account-summary__meta--staff"
              aria-label="Resume du compte"
            >
              <span className="account-summary__member-since">
                Membre depuis {memberSince}
              </span>
              <span>
                <ShieldCheck size={16} aria-hidden="true" />
                {staffScopeLabel}
              </span>
            </div>
          </div>

          <nav className="account-tabs account-tabs--role" aria-label={ariaLabel}>
            {tabs.map(({ label, route, Icon }) => (
              <NavLink
                className={({ isActive }) =>
                  ["account-tabs__item", isActive ? "is-active" : ""]
                    .filter(Boolean)
                    .join(" ")
                }
                key={route}
                to={route}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </section>
      <div
        className="account-shell__role-header-spacer"
        style={{ height: headerHeight }}
        aria-hidden="true"
      />
    </>
  );
}
