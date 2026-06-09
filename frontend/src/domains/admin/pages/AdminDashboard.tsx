import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import CompanyRegisterForm from "../../auth/components/CompanyRegisterForm";
import RegisterForm from "../../auth/components/RegisterForm";
import FormModal from "../../../shared/components/forms/FormModal";
import PanelStats from "../../../shared/components/layout/PanelStats";
import { ROUTES } from "../../../shared/constants/routes";
import {
  EVENT_CATEGORIES,
  type EventCategory,
} from "../../events/types/event-categories";
import type { Event } from "../../events/types/event";
import type { Company } from "../../companies/types/company";
import {
  type Account,
  type AccountSummary,
  getAccountTypeForRole,
  getAccountTypeIdForRole,
  isAccountSuspended,
  ROLE_IDS,
  ROLES,
  type Role,
  type User,
} from "../../user/types/user";
import useDataStore, {
  buildAccountSummaries,
} from "../../../shared/store/dataStore";
import {
  formatEventDateRange,
  toDateTimeLocalValue,
} from "../../events/utils/event";

type UserDraft = {
  display_name: string;
  login_email: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
};

type EventDraft = Omit<
  Event,
  | "id"
  | "latitude"
  | "longitude"
  | "company_id"
  | "postal_code"
  | "created_at"
  | "updated_at"
  | "category_slugs"
> & {
  latitude: string;
  longitude: string;
  company_id: string;
  postal_code: string;
  category_slugs: EventCategory[];
};

type AdminView = "dashboard" | "accounts" | "events";
type AccountStatusFilter = "all" | "active" | "pending" | "suspended";
type AccountSort = "username-asc" | "username-desc" | "role-asc";
type EventSort = "date-asc" | "date-desc" | "title-asc" | "title-desc" | "city-asc";

type AdminDashboardProps = {
  view?: AdminView;
};

const viewContent: Record<
  AdminView,
  {
    title: string;
    description: string;
  }
> = {
  dashboard: {
    title: "Panel administrateur",
    description: "Vue d'ensemble de la gestion des comptes et des contenus.",
  },
  accounts: {
    title: "Gestion des comptes",
    description: "Creation, modification et suppression des comptes applicatifs.",
  },
  events: {
    title: "Gestion des evenements",
    description: "Creation, modification et suivi des evenements du site.",
  },
};

const accountCreateLabels: Record<Role, string> = {
  user: "utilisateur",
  moderator: "moderateur",
  admin: "administrateur",
  company: "entreprise",
};

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizeComparable = (value: string) => value.trim().toLowerCase();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

const isValidEmail = (value: string) => emailPattern.test(value.trim());

const isStrongPassword = (value: string) => passwordPattern.test(value);

const isValidOptionalCoordinate = (value: string, min: number, max: number) => {
  if (value.trim() === "") return true;

  const numberValue = Number(value);
  return !Number.isNaN(numberValue) && numberValue >= min && numberValue <= max;
};

const parseOptionalCoordinate = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : Number(trimmedValue);
};

const createNextId = (items: { id: number }[]) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

const toUserDraft = (account: AccountSummary): UserDraft => ({
  display_name: account.display_name,
  login_email: account.login_email,
  password_hash: account.password_hash,
  role: account.role,
  is_active: account.is_active,
});

const emptyUserDraft = (): UserDraft => ({
  display_name: "",
  login_email: "",
  password_hash: "",
  role: "user",
  is_active: true,
});

const toEventDraft = (event: Event): EventDraft => ({
  title: event.title,
  description: event.description,
  start_date: toDateTimeLocalValue(event.start_date),
  end_date: toDateTimeLocalValue(event.end_date),
  latitude: event.latitude?.toString() ?? "",
  longitude: event.longitude?.toString() ?? "",
  address: event.address,
  category_slugs: event.category_slugs,
  city: event.city,
  postal_code: event.postal_code,
  image: event.image,
  source: event.source ?? "",
  company_id: event.company_id.toString(),
  is_active: event.is_active,
});

const emptyEventDraft = (companyId?: number): EventDraft => ({
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  latitude: "",
  longitude: "",
  address: "",
  category_slugs: ["culture"],
  city: "",
  postal_code: "",
  image: "",
  source: "",
  company_id: companyId?.toString() ?? "",
  is_active: true,
});

const getEventCategories = (event: Event) => event.category_slugs;

const getAccountAdminStatus = (account: AccountSummary) => {
  if (isAccountSuspended(account)) {
    const suspendedUntil = account.suspended_until
      ? new Date(account.suspended_until).toLocaleDateString("fr-FR")
      : null;

    return {
      className: "admin-status admin-status--suspended",
      label: suspendedUntil ? `Suspendu jusqu'au ${suspendedUntil}` : "Suspendu",
      value: "suspended" as const,
    };
  }

  if (account.is_active) {
    return {
      className: "admin-status admin-status--active",
      label: "Actif",
      value: "active" as const,
    };
  }

  return {
    className: "admin-status",
    label: "En attente",
    value: "pending" as const,
  };
};

const toggleEventDraftCategory = (
  draft: EventDraft,
  category: EventCategory,
): EventDraft => {
  const currentCategories = draft.category_slugs;
  const nextCategories = currentCategories.includes(category)
    ? currentCategories.filter((item) => item !== category)
    : [...currentCategories, category];

  return {
    ...draft,
    category_slugs: nextCategories,
  };
};

export default function AdminDashboard({ view = "dashboard" }: AdminDashboardProps) {
  const accountsData = useDataStore((s) => s.accounts);
  const usersData = useDataStore((s) => s.users);
  const companiesData = useDataStore((s) => s.companies);
  const eventsData = useDataStore((s) => s.events);
  const addAccount = useDataStore((s) => s.addAccount);
  const updateAccount = useDataStore((s) => s.updateAccount);
  const deleteAccountFromStore = useDataStore((s) => s.deleteAccount);
  const addUser = useDataStore((s) => s.addUser);
  const updateUser = useDataStore((s) => s.updateUser);
  const deleteUserFromStore = useDataStore((s) => s.deleteUser);
  const updateCompany = useDataStore((s) => s.updateCompany);
  const deleteCompanyFromStore = useDataStore((s) => s.deleteCompany);
  const addEvent = useDataStore((s) => s.addEvent);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const deleteEventFromStore = useDataStore((s) => s.deleteEvent);
  const accountSummaries = useMemo(
    () => buildAccountSummaries(accountsData, usersData, companiesData),
    [accountsData, usersData, companiesData],
  );

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [accountCreateRole, setAccountCreateRole] = useState<Role>("user");
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountRoleFilter, setAccountRoleFilter] = useState<Role | "all">("all");
  const [accountStatusFilter, setAccountStatusFilter] =
    useState<AccountStatusFilter>("all");
  const [accountSort, setAccountSort] = useState<AccountSort>("username-asc");
  const [eventSearch, setEventSearch] = useState("");
  const [eventCategoryFilter, setEventCategoryFilter] =
    useState<EventCategory | "all">("all");
  const [eventCityFilter, setEventCityFilter] = useState("all");
  const [eventSort, setEventSort] = useState<EventSort>("date-asc");

  const activeCompaniesData = companiesData.filter((company) => !company.deleted_at);
  const activeEventsData = eventsData.filter((event) => !event.deleted_at);
  const firstCompanyId = activeCompaniesData[0]?.id;

  const hasDuplicateAccountEmail = (email: string, currentAccountId?: number) =>
    accountsData.some(
      (account) =>
        account.id !== currentAccountId &&
        normalizeComparable(account.login_email) === normalizeComparable(email),
    );

  const hasDuplicateUsername = (username: string, currentUserId?: number) =>
    usersData.some(
      (user) =>
        user.id !== currentUserId &&
        !user.deleted_at &&
        normalizeComparable(user.username) === normalizeComparable(username),
    );

  const getCompanyName = (companyId: number) =>
    activeCompaniesData.find((company) => company.id === companyId)?.name ??
    "Non rattache";

  const filteredUsers = useMemo(
    () =>
      accountSummaries
        .filter((account) => {
          const accountStatus = getAccountAdminStatus(account);
          const matchesSearch = normalizeText(
            [
              account.display_name,
              account.login_email,
              account.role,
              accountStatus.label,
              account.suspension_reason ?? "",
            ].join(" "),
          ).includes(normalizeText(accountSearch));
          const matchesRole =
            accountRoleFilter === "all" || account.role === accountRoleFilter;
          const matchesStatus =
            accountStatusFilter === "all" ||
            accountStatus.value === accountStatusFilter;

          return matchesSearch && matchesRole && matchesStatus;
        })
        .sort((firstUser, secondUser) => {
          if (accountSort === "username-desc") {
            return secondUser.display_name.localeCompare(firstUser.display_name, "fr-FR");
          }

          if (accountSort === "role-asc") {
            return firstUser.role.localeCompare(secondUser.role, "fr-FR");
          }

          return firstUser.display_name.localeCompare(secondUser.display_name, "fr-FR");
        }),
    [
      accountRoleFilter,
      accountSearch,
      accountSort,
      accountStatusFilter,
      accountSummaries,
    ],
  );

  const eventCities = Array.from(
    new Set(activeEventsData.map((event) => event.city.trim()).filter(Boolean)),
  ).sort((firstCity, secondCity) =>
    firstCity.localeCompare(secondCity, "fr-FR"),
  );

  const filteredEvents = activeEventsData
    .filter((event) => {
      const matchesSearch = normalizeText(
        [
          event.title,
          event.description,
          getEventCategories(event).join(" "),
          event.address,
          event.city,
          event.postal_code,
          event.source ?? "",
          getCompanyName(event.company_id),
        ].join(" "),
      ).includes(normalizeText(eventSearch));
      const matchesCategory =
        eventCategoryFilter === "all" ||
        getEventCategories(event).includes(eventCategoryFilter);
      const matchesCity =
        eventCityFilter === "all" || event.city === eventCityFilter;

      return matchesSearch && matchesCategory && matchesCity;
    })
    .sort((firstEvent, secondEvent) => {
      if (eventSort === "date-desc") {
        return (
          new Date(secondEvent.start_date).getTime() -
          new Date(firstEvent.start_date).getTime()
        );
      }

      if (eventSort === "title-asc") {
        return firstEvent.title.localeCompare(secondEvent.title, "fr-FR");
      }

      if (eventSort === "title-desc") {
        return secondEvent.title.localeCompare(firstEvent.title, "fr-FR");
      }

      if (eventSort === "city-asc") {
        return firstEvent.city.localeCompare(secondEvent.city, "fr-FR");
      }

      return (
        new Date(firstEvent.start_date).getTime() -
        new Date(secondEvent.start_date).getTime()
      );
    });

  const startUserEdit = (account: AccountSummary) => {
    setIsCreatingUser(false);
    setEditingUserId(account.account_id);
    setUserDraft(toUserDraft(account));
  };

  const startUserCreate = () => {
    setEditingUserId(null);
    setAccountCreateRole("user");
    setIsCreatingUser(true);
    setUserDraft(emptyUserDraft());
  };

  const closeUserForm = () => {
    setEditingUserId(null);
    setIsCreatingUser(false);
    setUserDraft(null);
    setAccountCreateRole("user");
  };

  const updateAccountCreateRole = (role: Role) => {
    setAccountCreateRole(role);
    setUserDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, role } : currentDraft,
    );
  };

  const saveUser = () => {
    if (!userDraft) return;

    if (!userDraft.display_name.trim() || !userDraft.login_email.trim()) {
      toast.error("Le nom et l'email sont obligatoires");
      return;
    }

    const displayName = userDraft.display_name.trim();
    const loginEmail = userDraft.login_email.trim();

    if (!isValidEmail(loginEmail)) {
      toast.error("L'email de connexion est invalide");
      return;
    }

    if (!isStrongPassword(userDraft.password_hash)) {
      toast.error(
        "Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un caractere special",
      );
      return;
    }

    if (isCreatingUser) {
      if (userDraft.role === "company") {
        toast.error("Creez les entreprises via le formulaire entreprise");
        return;
      }

      if (hasDuplicateAccountEmail(loginEmail)) {
        toast.error("Cet email est deja utilise");
        return;
      }

      if (hasDuplicateUsername(displayName)) {
        toast.error("Ce nom d'utilisateur est deja utilise");
        return;
      }

      const accountId = createNextId(accountsData);
      const userId = createNextId(usersData);
      const createdAt = new Date().toISOString();
      const account: Account = {
        id: accountId,
        account_type_id: getAccountTypeIdForRole(userDraft.role),
        account_type: getAccountTypeForRole(userDraft.role),
        login_email: loginEmail,
        password_hash: userDraft.password_hash,
        is_active: userDraft.is_active,
        created_at: createdAt,
        updated_at: createdAt,
      };
      const user: User = {
        id: userId,
        account_id: accountId,
        username: displayName,
        role_id: ROLE_IDS[userDraft.role],
        role: userDraft.role,
        created_at: createdAt,
        updated_at: createdAt,
      };

      addAccount(account);
      addUser(user);

      setIsCreatingUser(false);
      setUserDraft(null);
      toast.success("Compte cree");
      return;
    }

    if (!editingUserId) return;

    const editedAccount = accountSummaries.find(
      (account) => account.account_id === editingUserId,
    );

    if (!editedAccount) return;

    if (userDraft.role === "company" && !editedAccount.company_id) {
      toast.error("Creez les entreprises via le formulaire entreprise");
      return;
    }

    if (editedAccount.company_id && userDraft.role !== "company") {
      toast.error("Un compte entreprise doit garder le type company");
      return;
    }

    if (hasDuplicateAccountEmail(loginEmail, editingUserId)) {
      toast.error("Cet email est deja utilise");
      return;
    }

    if (
      !editedAccount.company_id &&
      editedAccount.user_id &&
      hasDuplicateUsername(displayName, editedAccount.user_id)
    ) {
      toast.error("Ce nom d'utilisateur est deja utilise");
      return;
    }

    updateAccount(editingUserId, {
      account_type_id: getAccountTypeIdForRole(userDraft.role),
      account_type: getAccountTypeForRole(userDraft.role),
      login_email: loginEmail,
      password_hash: userDraft.password_hash,
      is_active: userDraft.is_active,
    });

    if (editedAccount.company_id) {
      updateCompany(editedAccount.company_id, {
        name: displayName,
        is_active: userDraft.is_active,
        is_verified: userDraft.is_active,
      });
    } else if (editedAccount.user_id) {
      updateUser(editedAccount.user_id, {
        username: displayName,
        role: userDraft.role,
        role_id: ROLE_IDS[userDraft.role],
      });
    }

    setEditingUserId(null);
    setUserDraft(null);
    toast.success("Compte mis a jour");
  };

  const deleteUser = (accountId: number) => {
    const deletedAccount = accountSummaries.find(
      (account) => account.account_id === accountId,
    );
    if (!deletedAccount) return;

    if (
      !window.confirm(
        `Supprimer le compte "${deletedAccount.display_name}" ? Cette action retire le compte du mock.`,
      )
    ) {
      return;
    }

    if (deletedAccount.company_id) {
      deleteCompanyFromStore(deletedAccount.company_id);
    } else if (deletedAccount.user_id) {
      deleteUserFromStore(deletedAccount.user_id);
    } else {
      deleteAccountFromStore(accountId);
    }

    setEditingUserId(null);
    toast.success(`${deletedAccount.display_name} supprime`);
  };

  const liftAccountSuspension = (account: AccountSummary) => {
    updateAccount(account.account_id, {
      is_active: true,
      suspended_until: null,
      suspension_reason: null,
    });

    toast.success(`Suspension levee pour ${account.display_name}`);
  };

  const startEventEdit = (event: Event) => {
    setIsCreatingEvent(false);
    setEditingEventId(event.id);
    setEventDraft(toEventDraft(event));
  };

  const startEventCreate = () => {
    setEditingEventId(null);
    setIsCreatingEvent(true);
    setEventDraft(emptyEventDraft(firstCompanyId));
  };

  const closeEventForm = () => {
    setEditingEventId(null);
    setIsCreatingEvent(false);
    setEventDraft(null);
  };

  const saveEvent = () => {
    if (!eventDraft) return;

    if (!eventDraft.company_id) {
      toast.error("L'entreprise est obligatoire");
      return;
    }

    const selectedCompanyId = Number(eventDraft.company_id);
    const selectedCompany = activeCompaniesData.find(
      (company) => company.id === selectedCompanyId,
    );

    if (!selectedCompany) {
      toast.error("Entreprise introuvable");
      return;
    }

    if (eventDraft.is_active && !selectedCompany.is_active) {
      toast.error("Impossible de publier un evenement d'une entreprise inactive");
      return;
    }

    if (!eventDraft.start_date || !eventDraft.end_date) {
      toast.error("Les dates de debut et de fin sont obligatoires");
      return;
    }

    if (new Date(eventDraft.end_date) < new Date(eventDraft.start_date)) {
      toast.error("La date de fin doit etre apres la date de debut");
      return;
    }

    if (eventDraft.title.trim().length < 3) {
      toast.error("Le titre doit contenir au moins 3 caracteres");
      return;
    }

    if (eventDraft.description.trim().length < 10) {
      toast.error("La description doit contenir au moins 10 caracteres");
      return;
    }

    if (eventDraft.category_slugs.length === 0) {
      toast.error("Selectionnez au moins une categorie");
      return;
    }

    if (eventDraft.address.trim().length < 5) {
      toast.error("L'adresse est obligatoire");
      return;
    }

    if (eventDraft.city.trim().length < 2) {
      toast.error("La ville est obligatoire");
      return;
    }

    if (!/^\d{5}$/.test(eventDraft.postal_code.trim())) {
      toast.error("Le code postal doit contenir 5 chiffres");
      return;
    }

    if (!isValidOptionalCoordinate(eventDraft.latitude, -90, 90)) {
      toast.error("La latitude doit etre comprise entre -90 et 90");
      return;
    }

    if (!isValidOptionalCoordinate(eventDraft.longitude, -180, 180)) {
      toast.error("La longitude doit etre comprise entre -180 et 180");
      return;
    }

    if (!eventDraft.image.trim() || !URL.canParse(eventDraft.image.trim())) {
      toast.error("L'URL de l'image est invalide");
      return;
    }

    const now = new Date().toISOString();
    const payload: Omit<Event, "id"> = {
      title: eventDraft.title.trim(),
      description: eventDraft.description.trim(),
      start_date: new Date(eventDraft.start_date).toISOString(),
      end_date: new Date(eventDraft.end_date).toISOString(),
      latitude: parseOptionalCoordinate(eventDraft.latitude),
      longitude: parseOptionalCoordinate(eventDraft.longitude),
      address: eventDraft.address.trim(),
      category_slugs: eventDraft.category_slugs,
      city: eventDraft.city.trim(),
      postal_code: eventDraft.postal_code.trim(),
      image: eventDraft.image.trim(),
      source: eventDraft.source?.trim() || null,
      company_id: selectedCompanyId,
      is_active: eventDraft.is_active,
      created_at: now,
      updated_at: now,
    };

    if (isCreatingEvent) {
      addEvent({ id: createNextId(eventsData), ...payload });
      toast.success("Evenement cree");
    } else if (editingEventId) {
      const event = eventsData.find((item) => item.id === editingEventId);
      if (!event) return;
      updateEvent(editingEventId, {
        title: payload.title,
        description: payload.description,
        start_date: payload.start_date,
        end_date: payload.end_date,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        category_slugs: payload.category_slugs,
        city: payload.city,
        postal_code: payload.postal_code,
        image: payload.image,
        source: payload.source,
        company_id: payload.company_id,
        is_active: payload.is_active,
        updated_at: payload.updated_at,
      });
      toast.success("Evenement mis a jour");
    }

    setEditingEventId(null);
    setIsCreatingEvent(false);
    setEventDraft(null);
  };

  const deleteEvent = (eventId: number) => {
    const deletedEvent = eventsData.find((event) => event.id === eventId);
    if (!deletedEvent) return;

    if (
      !window.confirm(
        `Supprimer l'evenement "${deletedEvent.title}" ? Cette action retire l'evenement du mock.`,
      )
    ) {
      return;
    }

    deleteEventFromStore(eventId);
    setEditingEventId(null);
    toast.success(`${deletedEvent.title} supprime`);
  };

  const isAccountsView = view === "accounts";
  const isEventsView = view === "events";
  const currentViewContent = viewContent[view];
  const adminStats = [
    {
      label: "Comptes",
      to: ROUTES.ADMIN.DASHBOARD,
      value: accountSummaries.length,
      end: true,
    },
    { label: "Evenements", to: ROUTES.ADMIN.EVENTS, value: activeEventsData.length },
  ];

  return (
    <div className="admin-panel">
      <section className="admin-panel__header">
        <div className="admin-panel__heading">
          <h2>{currentViewContent.title}</h2>
          {isAccountsView && (
            <button className="btn" type="button" onClick={startUserCreate}>
              Ajouter
            </button>
          )}
          {isEventsView && (
            <button className="btn" type="button" onClick={startEventCreate}>
              Ajouter
            </button>
          )}
        </div>
        <p>{currentViewContent.description}</p>
      </section>

      <PanelStats ariaLabel="Navigation admin" stats={adminStats} />

      {isAccountsView && (
        <section className="admin-panel__grid">
          <article className="admin-section">
            <div className="admin-toolbar" aria-label="Filtres des comptes">
              <label>
                Rechercher
                <input
                  value={accountSearch}
                  placeholder="Nom, email, role..."
                  onChange={(event) => setAccountSearch(event.target.value)}
                />
              </label>
              <label>
                Role
                <select
                  value={accountRoleFilter}
                  onChange={(event) =>
                    setAccountRoleFilter(event.target.value as Role | "all")
                  }
                >
                  <option value="all">Tous les roles</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Statut
                <select
                  value={accountStatusFilter}
                  onChange={(event) =>
                    setAccountStatusFilter(event.target.value as AccountStatusFilter)
                  }
                >
                  <option value="all">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="pending">En attente</option>
                  <option value="suspended">Suspendus</option>
                </select>
              </label>
              <label>
                Trier par
                <select
                  value={accountSort}
                  onChange={(event) =>
                    setAccountSort(event.target.value as AccountSort)
                  }
                >
                  <option value="username-asc">Nom A-Z</option>
                  <option value="username-desc">Nom Z-A</option>
                  <option value="role-asc">Role</option>
                </select>
              </label>
            </div>

            <p className="admin-results-count">
              {filteredUsers.length} compte{filteredUsers.length > 1 ? "s" : ""}
            </p>

            {filteredUsers.length === 0 ? (
              <p className="admin-empty">Aucun compte ne correspond aux filtres.</p>
            ) : (
              <div className="admin-table admin-table--accounts" role="table" aria-label="Comptes">
                <div className="admin-table__row admin-table__row--head" role="row">
                  <span role="columnheader">Nom</span>
                  <span role="columnheader">Email</span>
                  <span role="columnheader">Role</span>
                  <span role="columnheader">Statut</span>
                  <span role="columnheader">Actions</span>
                </div>
                <div role="rowgroup">
                  {filteredUsers.map((user) => {
                    const accountStatus = getAccountAdminStatus(user);

                    return (
                      <div className="admin-table__row" role="row" key={user.account_id}>
                        <span role="cell">{user.display_name}</span>
                        <span role="cell">{user.login_email}</span>
                        <span className="admin-badge" role="cell">
                          {user.role}
                        </span>
                        <span
                          className={accountStatus.className}
                          role="cell"
                          title={user.suspension_reason ?? undefined}
                        >
                          {accountStatus.label}
                        </span>
                        <div className="admin-actions" role="cell">
                          {accountStatus.value === "suspended" && (
                            <button
                              className="btn"
                              type="button"
                              onClick={() => liftAccountSuspension(user)}
                            >
                              Lever suspension
                            </button>
                          )}
                          <button
                            className="btn btn--secondary"
                            type="button"
                            onClick={() => startUserEdit(user)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn btn--danger"
                            type="button"
                            onClick={() => deleteUser(user.account_id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        </section>
      )}

      {isEventsView && (
        <section className="admin-panel__grid">
          <article className="admin-section">
            <div className="admin-toolbar" aria-label="Filtres des événements">
              <label>
                Rechercher
                <input
                  value={eventSearch}
                  placeholder="Titre, ville, code postal..."
                  onChange={(event) => setEventSearch(event.target.value)}
                />
              </label>
              <label>
                Categorie
                <select
                  value={eventCategoryFilter}
                  onChange={(event) =>
                    setEventCategoryFilter(event.target.value as EventCategory | "all")
                  }
                >
                  <option value="all">Toutes les categories</option>
                  {EVENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ville
                <select
                  value={eventCityFilter}
                  onChange={(event) => setEventCityFilter(event.target.value)}
                >
                  <option value="all">Toutes les villes</option>
                  {eventCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Trier par
                <select
                  value={eventSort}
                  onChange={(event) => setEventSort(event.target.value as EventSort)}
                >
                  <option value="date-asc">Debut croissant</option>
                  <option value="date-desc">Debut decroissant</option>
                  <option value="title-asc">Titre A-Z</option>
                  <option value="title-desc">Titre Z-A</option>
                  <option value="city-asc">Ville A-Z</option>
                </select>
              </label>
            </div>

            <p className="admin-results-count">
              {filteredEvents.length} evenement{filteredEvents.length > 1 ? "s" : ""}
            </p>

            {filteredEvents.length === 0 ? (
              <p className="admin-empty">Aucun evenement ne correspond aux filtres.</p>
            ) : (
              <div className="admin-table admin-table--events" role="table" aria-label="Événements">
                <div className="admin-table__row admin-table__row--head" role="row">
                  <span role="columnheader">Titre</span>
                  <span role="columnheader">Categories</span>
                  <span role="columnheader">Ville</span>
                  <span role="columnheader">Dates</span>
                  <span role="columnheader">Statut</span>
                  <span role="columnheader">Actions</span>
                </div>
                <div role="rowgroup">
                  {filteredEvents.map((event) => (
                    <div className="admin-table__row" role="row" key={event.id}>
                      <span role="cell">{event.title}</span>
                      <span role="cell">{getEventCategories(event).join(", ")}</span>
                      <span role="cell">{event.city}</span>
                      <span role="cell">{formatEventDateRange(event)}</span>
                      <span
                        className={`admin-status ${
                          event.is_active ? "admin-status--active" : ""
                        }`}
                        role="cell"
                      >
                        {event.is_active ? "Publie" : "En attente"}
                      </span>
                      <div className="admin-actions" role="cell">
                        <button
                          className="btn btn--secondary"
                          type="button"
                          onClick={() => startEventEdit(event)}
                        >
                          Modifier
                        </button>
                        <button
                          className="btn btn--danger"
                          type="button"
                          onClick={() => deleteEvent(event.id)}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        </section>
      )}

      <FormModal
        ariaLabel={isCreatingUser ? "Ajouter un compte" : "Modifier un compte"}
        open={!!userDraft && (isCreatingUser || editingUserId !== null)}
        size="lg"
        onClose={closeUserForm}
      >
        {userDraft && isCreatingUser && (
          <div className="admin-create-account">
            <h2>Ajouter un compte</h2>
            <label className="admin-create-account__type">
              Type de compte
              <select
                value={accountCreateRole}
                onChange={(event) =>
                  updateAccountCreateRole(event.target.value as Role)
                }
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            {accountCreateRole === "company" ? (
              <CompanyRegisterForm
                mode="admin"
                title="Ajouter une entreprise"
                submitLabel="Creer l'entreprise"
                onCancel={closeUserForm}
                onSuccess={closeUserForm}
              />
            ) : (
              <RegisterForm
                mode="admin"
                role={accountCreateRole}
                title={`Ajouter un compte ${accountCreateLabels[accountCreateRole]}`}
                submitLabel={`Creer le compte ${accountCreateLabels[accountCreateRole]}`}
                onCancel={closeUserForm}
                onSuccess={closeUserForm}
              />
            )}
          </div>
        )}

        {userDraft && !isCreatingUser && editingUserId !== null && (
          <div className="admin-create-account">
            <h2>Modifier un compte</h2>
            <UserEditor
              draft={userDraft}
              setDraft={setUserDraft}
              onSave={saveUser}
              onCancel={closeUserForm}
            />
          </div>
        )}
      </FormModal>

      <FormModal
        ariaLabel={isCreatingEvent ? "Ajouter un evenement" : "Modifier un evenement"}
        open={!!eventDraft && (isCreatingEvent || editingEventId !== null)}
        size="lg"
        onClose={closeEventForm}
      >
        {eventDraft && (
          <div className="admin-create-account">
            <h2>{isCreatingEvent ? "Ajouter un evenement" : "Modifier un evenement"}</h2>
            <EventEditor
              draft={eventDraft}
              companies={activeCompaniesData}
              setDraft={setEventDraft}
              onSave={saveEvent}
              onCancel={closeEventForm}
            />
          </div>
        )}
      </FormModal>
    </div>
  );
}

type DraftSetter<T> = (draft: T | null) => void;

function UserEditor({
  draft,
  setDraft,
  showRoleSelect = true,
  onSave,
  onCancel,
}: {
  draft: UserDraft;
  setDraft: DraftSetter<UserDraft>;
  showRoleSelect?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="admin-inline-editor">
      <input
        placeholder="Nom"
        value={draft.display_name}
        onChange={(event) =>
          setDraft({ ...draft, display_name: event.target.value })
        }
      />
      <input
        type="email"
        placeholder="Email de connexion"
        value={draft.login_email}
        onChange={(event) =>
          setDraft({ ...draft, login_email: event.target.value })
        }
      />
      <input
        placeholder="Mot de passe / hash"
        value={draft.password_hash}
        onChange={(event) =>
          setDraft({ ...draft, password_hash: event.target.value })
        }
      />
      {showRoleSelect && (
        <select
          value={draft.role}
          onChange={(event) =>
            setDraft({ ...draft, role: event.target.value as Role })
          }
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      )}
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(event) =>
            setDraft({ ...draft, is_active: event.target.checked })
          }
        />
        Actif
      </label>
      <div className="admin-actions">
        <button className="btn" type="button" onClick={onSave}>
          Enregistrer
        </button>
        <button className="btn btn--secondary" type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function EventEditor({
  draft,
  companies,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: EventDraft;
  companies: Company[];
  setDraft: DraftSetter<EventDraft>;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="admin-form-grid admin-event-form">
      <label>
        Titre
        <input
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </label>
      <label>
        Entreprise
        <select
          value={draft.company_id}
          onChange={(event) =>
            setDraft({ ...draft, company_id: event.target.value })
          }
        >
          <option value="">Selectionner</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>
      <div className="admin-form-grid__wide">
        <span className="form-field-label">Categories</span>
        <div className="categories-select">
          {EVENT_CATEGORIES.map((category) => (
            <label className="categories-select__option" key={category}>
              <input
                type="checkbox"
                checked={draft.category_slugs.includes(category)}
                onChange={() => setDraft(toggleEventDraftCategory(draft, category))}
              />
              {category}
            </label>
          ))}
        </div>
      </div>
      <label className="admin-form-grid__wide">
        Description
        <textarea
          rows={3}
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
        />
      </label>
      <label>
        Date de debut
        <input
          type="datetime-local"
          value={draft.start_date}
          onChange={(event) =>
            setDraft({ ...draft, start_date: event.target.value })
          }
        />
      </label>
      <label>
        Date de fin
        <input
          type="datetime-local"
          value={draft.end_date}
          onChange={(event) =>
            setDraft({ ...draft, end_date: event.target.value })
          }
        />
      </label>
      <label className="admin-form-grid__wide">
        Adresse
        <input
          value={draft.address}
          onChange={(event) => setDraft({ ...draft, address: event.target.value })}
        />
      </label>
      <label>
        Ville
        <input
          value={draft.city}
          onChange={(event) => setDraft({ ...draft, city: event.target.value })}
        />
      </label>
      <label>
        Code postal
        <input
          inputMode="numeric"
          value={draft.postal_code}
          onChange={(event) =>
            setDraft({ ...draft, postal_code: event.target.value })
          }
        />
      </label>
      <label>
        Latitude
        <input
          value={draft.latitude}
          onChange={(event) =>
            setDraft({ ...draft, latitude: event.target.value })
          }
        />
      </label>
      <label>
        Longitude
        <input
          value={draft.longitude}
          onChange={(event) =>
            setDraft({ ...draft, longitude: event.target.value })
          }
        />
      </label>
      <label>
        Image
        <input
          value={draft.image}
          onChange={(event) => setDraft({ ...draft, image: event.target.value })}
        />
      </label>
      <label>
        Source
        <input
          value={draft.source ?? ""}
          onChange={(event) => setDraft({ ...draft, source: event.target.value })}
        />
      </label>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(event) =>
            setDraft({ ...draft, is_active: event.target.checked })
          }
        />
        Publie
      </label>
      <div className="admin-actions admin-form-grid__wide">
        <button className="btn" type="button" onClick={onSave}>
          Enregistrer
        </button>
        <button className="btn btn--secondary" type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}
