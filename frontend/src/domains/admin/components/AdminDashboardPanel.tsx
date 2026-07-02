import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "react-toastify";

import RegisterForm from "../../auth/components/RegisterForm";
import { eventsApi } from "../../event/api/events.api";
import CategorySelect from "../../event/components/CategorySelect";
import EmptyState from "../../../shared/components/feedback/EmptyState";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import Loader from "../../../shared/components/feedback/Loader";
import DecisionReasonModal from "../../../shared/components/forms/DecisionReasonModal";
import FormModal from "../../../shared/components/forms/FormModal";
import ImageField from "../../../shared/components/forms/ImageField";
import ActionRow from "../../../shared/components/layout/ActionRow";
import PanelStats from "../../../shared/components/layout/PanelStats";
import Toolbar from "../../../shared/components/layout/Toolbar";
import Button from "../../../shared/components/ui/Button";
import Checkbox from "../../../shared/components/ui/Checkbox";
import CheckboxGroup from "../../../shared/components/ui/CheckboxGroup";
import FormField from "../../../shared/components/ui/FormField";
import Input from "../../../shared/components/ui/Input";
import Select from "../../../shared/components/ui/Select";
import StatusBadge from "../../../shared/components/ui/StatusBadge";
import Textarea from "../../../shared/components/ui/Textarea";
import { ROUTES } from "../../../shared/constants/routes";
import { useStaffHeaderAction } from "../../../shared/layouts/StaffHeaderActionContext";
import { accountRoleLabels } from "../../../shared/utils/account";
import { adminUsersApi } from "../api/adminUsers.api";
import useStaffSync from "../../staff/hooks/useStaffSync";
import useAuthStore from "../../auth/store/authStore";
import {
  EVENT_CATEGORIES,
  type EventCategory,
} from "../../event/types/event-categories";
import type { Event } from "../../event/types/event";
import type { Organization } from "../../organization/types/organization";
import {
  CATEGORIES as ORGANIZATION_CATEGORIES,
  type OrganizationCategoryName,
} from "../../organization/types/organization-categories";
import type {
  ModerationAction,
  ModerationTargetType,
} from "../../moderator/types/moderation";
import { organizationsApi } from "../../organization/api/organizations.api";
import {
  type AccountSummary,
  isAccountSuspended,
  type Role,
} from "../../user/types/user";
import useDataStore, {
  buildAccountSummaries,
} from "../../../shared/store/dataStore";
import { isValidUploadedImageValue } from "../../../shared/utils/imageUpload";
import {
  formatEventPrice,
  formatEventDateRange,
  getTicketingHref,
  isValidOptionalUrl,
  isEventSuspended,
  toDateTimeLocalValue,
} from "../../event/utils/event";

type UserDraft = {
  display_name: string;
  login_email: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
};

type OrganizationDraft = {
  name: string;
  contact_email: string;
  description: string;
  website: string;
  latitude: string;
  longitude: string;
  address: string;
  city: string;
  postal_code: string;
  logo: string;
  contact_phone_number: string;
  siret: string;
  is_verified: boolean;
  category_slugs: OrganizationCategoryName[];
};

type EventDraft = Omit<
  Event,
  | "id"
  | "latitude"
  | "longitude"
  | "organization_id"
  | "postal_code"
  | "price"
  | "ticketing_link"
  | "created_at"
  | "updated_at"
  | "category_slugs"
> & {
  latitude: string;
  longitude: string;
  organization_id: string;
  postal_code: string;
  price: string;
  ticketing_link: string;
  category_slugs: EventCategory[];
};

type AdminView = "dashboard" | "accounts" | "events";
type AccountStatusFilter = "all" | "active" | "pending" | "suspended";
type EventStatusFilter = "all" | "pending" | "deleted" | "reported" | "published";
type AccountSort = "username-asc" | "username-desc" | "role-asc";
type EventSort = "date-asc" | "date-desc" | "title-asc" | "title-desc" | "city-asc";

type AdminDashboardProps = {
  view?: AdminView;
};

type AdminDecisionRequest = {
  title: string;
  targetId: number;
  targetType: ModerationTargetType;
  action: ModerationAction;
  variant?: "primary" | "secondary" | "danger";
  onConfirm: (reason: string) => boolean | void | Promise<boolean | void>;
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

const ACCOUNT_LOGIN_ROLES: Exclude<Role, "organization">[] = [
  "user",
  "moderator",
  "admin",
];

type AccountLoginRole = (typeof ACCOUNT_LOGIN_ROLES)[number];
type AccountRoleFilter = AccountLoginRole | "organizer" | "all";

const accountLoginCreateLabels: Record<AccountLoginRole, string> = {
  user: "utilisateur",
  moderator: "moderateur",
  admin: "administrateur",
};

const getAdminAccountRoleLabel = (account: AccountSummary) =>
  account.organization_id
    ? "Utilisateur organisateur"
    : accountRoleLabels[account.role];

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

const toOrganizationDraft = (organization: Organization): OrganizationDraft => ({
  name: organization.name,
  contact_email: organization.contact_email,
  description: organization.description ?? "",
  website: organization.website ?? "",
  latitude: organization.latitude?.toString() ?? "",
  longitude: organization.longitude?.toString() ?? "",
  address: organization.address,
  city: organization.city,
  postal_code: organization.postal_code,
  logo: organization.logo ?? "",
  contact_phone_number: organization.contact_phone_number ?? "",
  siret: organization.siret ?? "",
  is_verified: organization.is_verified,
  category_slugs: organization.category_slugs.filter(
    (category): category is OrganizationCategoryName =>
      ORGANIZATION_CATEGORIES.includes(category as OrganizationCategoryName),
  ),
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
  price: event.price.toString(),
  ticketing_link: event.ticketing_link,
  source: event.source ?? "",
  organization_id: event.organization_id.toString(),
  is_active: event.is_active,
});

const emptyEventDraft = (organizationId?: number): EventDraft => ({
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  latitude: "",
  longitude: "",
  address: "",
  category_slugs: [],
  city: "",
  postal_code: "",
  image: "",
  price: "0",
  ticketing_link: "",
  source: "",
  organization_id: organizationId?.toString() ?? "",
  is_active: true,
});

const getEventCategories = (event: Event) => event.category_slugs;

const getAccountAdminStatus = (account: AccountSummary) => {
  if (isAccountSuspended(account)) {
    const suspendedUntil = account.suspended_until
      ? new Date(account.suspended_until).toLocaleDateString("fr-FR")
      : null;

    return {
      label: suspendedUntil ? `Suspendu jusqu'au ${suspendedUntil}` : "Suspendu",
      value: "suspended" as const,
      variant: "suspended" as const,
    };
  }

  if (account.is_active) {
    return {
      label: "Actif",
      value: "active" as const,
      variant: "active" as const,
    };
  }

  return {
    label: "En attente",
    value: "pending" as const,
    variant: "pending" as const,
  };
};

const getEventAdminStatus = (event: Event, hasOpenReport = false) => {
  if (event.deleted_at) {
    return {
      label: "Supprime",
      value: "deleted" as const,
      variant: "danger" as const,
    };
  }

  if (hasOpenReport) {
    return {
      label: "Signale",
      value: "reported" as const,
      variant: "warning" as const,
    };
  }

  if (isEventSuspended(event)) {
    const suspendedUntil = event.suspended_until
      ? new Date(event.suspended_until).toLocaleDateString("fr-FR")
      : null;

    return {
      label: suspendedUntil ? `Suspendu jusqu'au ${suspendedUntil}` : "Suspendu",
      value: "suspended" as const,
      variant: "suspended" as const,
    };
  }

  if (event.is_active) {
    return {
      label: "Publie",
      value: "published" as const,
      variant: "active" as const,
    };
  }

  return {
    label: "En attente",
    value: "pending" as const,
    variant: "pending" as const,
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
  const currentUser = useAuthStore((s) => s.currentUser);
  const {
    applyAction: applyStaffAction,
    error: staffSyncError,
    isLoaded: isStaffLoaded,
    isLoading: isStaffLoading,
    refresh: refreshStaffData,
  } = useStaffSync();
  const accountsData = useDataStore((s) => s.accounts);
  const usersData = useDataStore((s) => s.users);
  const organizationsData = useDataStore((s) => s.organizations);
  const eventsData = useDataStore((s) => s.events);
  const moderationReports = useDataStore((s) => s.moderationReports);
  const addEvent = useDataStore((s) => s.addEvent);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const deleteEventFromStore = useDataStore((s) => s.deleteEvent);
  const accountSummaries = useMemo(
    () => buildAccountSummaries(accountsData, usersData, organizationsData),
    [accountsData, usersData, organizationsData],
  );

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null);
  const [organizationDraft, setOrganizationDraft] =
    useState<OrganizationDraft | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [accountCreateRole, setAccountCreateRole] =
    useState<AccountLoginRole>("user");
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountRoleFilter, setAccountRoleFilter] =
    useState<AccountRoleFilter>("all");
  const [accountStatusFilter, setAccountStatusFilter] =
    useState<AccountStatusFilter>("all");
  const [accountSort, setAccountSort] = useState<AccountSort>("username-asc");
  const [eventSearch, setEventSearch] = useState("");
  const [eventCategoryFilter, setEventCategoryFilter] =
    useState<EventCategory | "all">("all");
  const [eventCityFilter, setEventCityFilter] = useState("all");
  const [eventStatusFilter, setEventStatusFilter] =
    useState<EventStatusFilter>("all");
  const [eventSort, setEventSort] = useState<EventSort>("date-asc");
  const [decisionRequest, setDecisionRequest] =
    useState<AdminDecisionRequest | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionReasonError, setDecisionReasonError] = useState("");

  const activeOrganizationsData = organizationsData.filter((organization) => !organization.deleted_at);
  const activeEventsData = eventsData.filter((event) => !event.deleted_at);
  const firstOrganizationId = useMemo(
    () => organizationsData.find((organization) => !organization.deleted_at)?.id,
    [organizationsData],
  );

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

  const hasDuplicateOrganizationContactEmail = (
    email: string,
    currentOrganizationId?: number,
  ) =>
    organizationsData.some(
      (organization) =>
        organization.id !== currentOrganizationId &&
        !organization.deleted_at &&
        normalizeComparable(organization.contact_email) ===
          normalizeComparable(email),
    );

  const hasDuplicateOrganizationSiret = (
    siret: string,
    currentOrganizationId?: number,
  ) =>
    siret.trim() !== "" &&
    organizationsData.some(
      (organization) =>
        organization.id !== currentOrganizationId &&
        !organization.deleted_at &&
        normalizeComparable(organization.siret ?? "") === normalizeComparable(siret),
    );

  const getOrganizationName = (organizationId: number) =>
    activeOrganizationsData.find((organization) => organization.id === organizationId)?.name ??
    "Non rattache";

  const recordDecision = async (
    action: ModerationAction,
    targetType: ModerationTargetType,
    targetId: number,
    reason: string,
  ) => {
    const trimmedReason = reason.trim();

    if (!action.endsWith("_admin_updated")) {
      return applyStaffAction({
        action,
        target_type: targetType,
        target_id: targetId,
        reason: trimmedReason || "Decision administrative",
      });
    }

    return true;
  };

  const openDecisionModal = (request: AdminDecisionRequest) => {
    setDecisionRequest(request);
    setDecisionReason("");
    setDecisionReasonError("");
  };

  const closeDecisionModal = () => {
    setDecisionRequest(null);
    setDecisionReason("");
    setDecisionReasonError("");
  };

  const confirmDecision = async () => {
    if (!decisionRequest) return;

    const reason = decisionReason.trim();

    if (reason.length < 5) {
      setDecisionReasonError("La justification est obligatoire.");
      return;
    }

    const result = await decisionRequest.onConfirm(reason);

    if (result === false) return;

    const recorded = await recordDecision(
      decisionRequest.action,
      decisionRequest.targetType,
      decisionRequest.targetId,
      reason,
    );
    if (recorded === false) return;
    closeDecisionModal();
  };

  const filteredUsers = useMemo(
    () =>
      accountSummaries
        .filter((account) => {
          const accountStatus = getAccountAdminStatus(account);
          const organization = account.organization_id
            ? organizationsData.find((item) => item.id === account.organization_id)
            : null;
          const searchableFields =
            [
              account.display_name,
              account.login_email,
              getAdminAccountRoleLabel(account),
              organization?.name ?? "",
              organization?.contact_email ?? "",
              accountStatus.label,
              account.suspension_reason ?? "",
            ];
          const matchesSearch = normalizeText(
            searchableFields.join(" "),
          ).includes(normalizeText(accountSearch));
          const matchesRole =
            accountRoleFilter === "all" ||
            (accountRoleFilter === "organizer"
              ? !!account.organization_id
              : account.role === accountRoleFilter && !account.organization_id);
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
            return getAdminAccountRoleLabel(firstUser).localeCompare(
              getAdminAccountRoleLabel(secondUser),
              "fr-FR",
            );
          }

          return firstUser.display_name.localeCompare(secondUser.display_name, "fr-FR");
        }),
    [
      accountRoleFilter,
      accountSearch,
      accountSort,
      accountStatusFilter,
      accountSummaries,
      organizationsData,
    ],
  );

  const eventCities = Array.from(
    new Set(eventsData.map((event) => event.city.trim()).filter(Boolean)),
  ).sort((firstCity, secondCity) =>
    firstCity.localeCompare(secondCity, "fr-FR"),
  );

  const reportedEventIds = useMemo(
    () =>
      new Set(
        moderationReports
          .filter(
            (report) =>
              report.target_type === "event" &&
              (report.status === "open" || report.status === "reviewing"),
          )
          .map((report) => report.target_id),
      ),
    [moderationReports],
  );

  const filteredEvents = eventsData
    .filter((event) => {
      const eventStatus = getEventAdminStatus(
        event,
        reportedEventIds.has(event.id),
      );
      const matchesSearch = normalizeText(
        [
          event.title,
          event.description,
          getEventCategories(event).join(" "),
          event.address,
          event.city,
          event.postal_code,
          formatEventPrice(event.price),
          event.ticketing_link,
          event.source ?? "",
          getOrganizationName(event.organization_id),
          eventStatus.label,
          event.suspension_reason ?? "",
        ].join(" "),
      ).includes(normalizeText(eventSearch));
      const matchesCategory =
        eventCategoryFilter === "all" ||
        getEventCategories(event).includes(eventCategoryFilter);
      const matchesCity =
        eventCityFilter === "all" || event.city === eventCityFilter;
      const matchesStatus =
        eventStatusFilter === "all" || eventStatus.value === eventStatusFilter;

      return matchesSearch && matchesCategory && matchesCity && matchesStatus;
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
    const organization = account.organization_id
      ? organizationsData.find((item) => item.id === account.organization_id) ?? null
      : null;

    setIsCreatingUser(false);
    setEditingUserId(account.account_id);
    setUserDraft(toUserDraft(account));
    setOrganizationDraft(organization ? toOrganizationDraft(organization) : null);
  };

  const startUserCreate = useCallback(() => {
    setEditingUserId(null);
    setOrganizationDraft(null);
    setAccountCreateRole("user");
    setIsCreatingUser(true);
    setUserDraft(emptyUserDraft());
  }, []);

  const closeUserForm = () => {
    setEditingUserId(null);
    setIsCreatingUser(false);
    setUserDraft(null);
    setOrganizationDraft(null);
    setAccountCreateRole("user");
  };

  const updateAccountCreateRole = (role: AccountLoginRole) => {
    setAccountCreateRole(role);
    setUserDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, role } : currentDraft,
    );
  };

  const saveUser = async (_reason?: string) => {
    if (!userDraft) return false;

    const displayName = (organizationDraft?.name ?? userDraft.display_name).trim();
    const loginEmail = userDraft.login_email.trim();

    if (!displayName || !loginEmail) {
      toast.error("Le nom et l'email sont obligatoires");
      return false;
    }

    if (!isValidEmail(loginEmail)) {
      toast.error("L'email de connexion est invalide");
      return false;
    }

    if (!isStrongPassword(userDraft.password_hash)) {
      toast.error(
        "Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un caractere special",
      );
      return false;
    }

    if (isCreatingUser) {
      if (userDraft.role === "organization") {
        toast.error("Utilisez le formulaire organisateur pour creer une organization");
        return false;
      }

      if (hasDuplicateAccountEmail(loginEmail)) {
        toast.error("Cet email est deja utilise");
        return false;
      }

      if (hasDuplicateUsername(displayName)) {
        toast.error("Ce nom d'utilisateur est deja utilise");
        return false;
      }

      const result = await adminUsersApi.create({
        email: loginEmail,
        password: userDraft.password_hash,
        first_name: displayName,
        last_name: "",
        role: userDraft.role,
        is_active: userDraft.is_active,
      });

      if (!result.ok) {
        toast.error(result.error.message);
        return false;
      }

      await refreshStaffData();

      setIsCreatingUser(false);
      setUserDraft(null);
      toast.success("Compte cree");
      return true;
    }

    if (!editingUserId) return false;

    const editedAccount = accountSummaries.find(
      (account) => account.account_id === editingUserId,
    );

    if (!editedAccount) return false;

    if (editedAccount.organization_id) {
      if (!organizationDraft) return false;

      const contactEmail = organizationDraft.contact_email.trim();
      const siret = organizationDraft.siret.trim();
      const phoneNumber = organizationDraft.contact_phone_number.trim();

      if (!isValidEmail(contactEmail)) {
        toast.error("L'email de contact est invalide");
        return false;
      }

      if (organizationDraft.description.trim().length < 10) {
        toast.error("La description doit contenir au moins 10 caracteres");
        return false;
      }

      if (organizationDraft.website.trim() && !URL.canParse(organizationDraft.website.trim())) {
        toast.error("URL du site invalide");
        return false;
      }

      if (organizationDraft.logo.trim() && !URL.canParse(organizationDraft.logo.trim())) {
        toast.error("URL du logo invalide");
        return false;
      }

      if (!isValidOptionalCoordinate(organizationDraft.latitude, -90, 90)) {
        toast.error("La latitude doit etre comprise entre -90 et 90");
        return false;
      }

      if (!isValidOptionalCoordinate(organizationDraft.longitude, -180, 180)) {
        toast.error("La longitude doit etre comprise entre -180 et 180");
        return false;
      }

      if (organizationDraft.address.trim().length < 5) {
        toast.error("L'adresse est obligatoire");
        return false;
      }

      if (organizationDraft.city.trim().length < 2) {
        toast.error("La ville est obligatoire");
        return false;
      }

      if (!/^\d{5}$/.test(organizationDraft.postal_code.trim())) {
        toast.error("Le code postal doit contenir 5 chiffres");
        return false;
      }

      if (phoneNumber && !/^\d{10}$/.test(phoneNumber)) {
        toast.error("Le telephone doit contenir 10 chiffres");
        return false;
      }

      if (siret && !/^\d{14}$/.test(siret)) {
        toast.error("Le SIRET doit contenir 14 chiffres");
        return false;
      }

      if (organizationDraft.category_slugs.length === 0) {
        toast.error("Selectionnez au moins une categorie");
        return false;
      }

      if (
        hasDuplicateOrganizationContactEmail(
          contactEmail,
          editedAccount.organization_id,
        )
      ) {
        toast.error("Cet email de contact est deja utilise");
        return false;
      }

      if (hasDuplicateOrganizationSiret(siret, editedAccount.organization_id)) {
        toast.error("Ce SIRET est deja utilise");
        return false;
      }
    }

    if (hasDuplicateAccountEmail(loginEmail, editingUserId)) {
      toast.error("Cet email est deja utilise");
      return false;
    }

    if (
      !editedAccount.organization_id &&
      editedAccount.user_id &&
      hasDuplicateUsername(displayName, editedAccount.user_id)
    ) {
      toast.error("Ce nom d'utilisateur est deja utilise");
      return false;
    }

    if (
      currentUser?.auth_source === "api" &&
      editedAccount.organization_id &&
      organizationDraft
    ) {
      const result = await organizationsApi.update(editedAccount.organization_id, {
        account_id: editedAccount.account_id,
        name: displayName,
        contact_email: organizationDraft.contact_email.trim(),
        description: organizationDraft.description.trim(),
        website: organizationDraft.website.trim() || null,
        latitude: parseOptionalCoordinate(organizationDraft.latitude),
        longitude: parseOptionalCoordinate(organizationDraft.longitude),
        address: organizationDraft.address.trim(),
        city: organizationDraft.city.trim(),
        postal_code: organizationDraft.postal_code.trim(),
        logo: organizationDraft.logo.trim() || null,
        contact_phone_number:
          organizationDraft.contact_phone_number.trim() || null,
        siret: organizationDraft.siret.trim() || null,
        category_slugs: organizationDraft.category_slugs,
        is_active: userDraft.is_active,
        is_verified: organizationDraft.is_verified,
      });

      if (!result.ok) {
        toast.error(result.error.message);
        return false;
      }

      await refreshStaffData();
      setEditingUserId(null);
      setUserDraft(null);
      setOrganizationDraft(null);
      toast.success("Compte mis a jour");
      return true;
    }

    if (
      currentUser?.auth_source === "api" &&
      !editedAccount.organization_id &&
      editedAccount.user_id
    ) {
      const result = await adminUsersApi.update(editingUserId, {
        email: loginEmail,
        first_name: displayName,
        last_name: "",
        role: userDraft.role === "organization" ? "user" : userDraft.role,
        is_active: userDraft.is_active,
      });

      if (!result.ok) {
        toast.error(result.error.message);
        return false;
      }

      await refreshStaffData();
      setEditingUserId(null);
      setUserDraft(null);
      setOrganizationDraft(null);
      toast.success("Compte mis a jour");
      return true;
    }

    toast.error("Session API requise pour modifier un compte");
    return false;
  };

  const deleteUser = (accountId: number, _reason: string) => {
    const deletedAccount = accountSummaries.find(
      (account) => account.account_id === accountId,
    );
    if (!deletedAccount) return false;

    if (currentUser?.auth_source === "api") return true;

    toast.error("Session API requise pour supprimer un compte");
    return false;
  };

  const liftAccountSuspension = (account: AccountSummary, _reason: string) => {
    if (currentUser?.auth_source === "api") return true;

    toast.error(`Session API requise pour lever la suspension de ${account.display_name}`);
    return false;
  };

  const liftEventSuspension = (event: Event, _reason: string) => {
    if (currentUser?.auth_source === "api") return true;

    toast.error(`Session API requise pour lever la suspension de ${event.title}`);
    return false;
  };

  const startEventEdit = (event: Event) => {
    setIsCreatingEvent(false);
    setEditingEventId(event.id);
    setEventDraft(toEventDraft(event));
  };

  const startEventCreate = useCallback(() => {
    setEditingEventId(null);
    setIsCreatingEvent(true);
    setEventDraft(emptyEventDraft(firstOrganizationId));
  }, [firstOrganizationId]);

  const closeEventForm = () => {
    setEditingEventId(null);
    setIsCreatingEvent(false);
    setEventDraft(null);
  };

  const saveEvent = async (_reason?: string) => {
    if (!eventDraft) return false;

    if (!eventDraft.organization_id) {
      toast.error("L'organization est obligatoire");
      return false;
    }

    const selectedOrganizationId = Number(eventDraft.organization_id);
    const selectedOrganization = activeOrganizationsData.find(
      (organization) => organization.id === selectedOrganizationId,
    );

    if (!selectedOrganization) {
      toast.error("Organization introuvable");
      return false;
    }

    if (eventDraft.is_active && !selectedOrganization.is_active) {
      toast.error("Impossible de publier un evenement d'une organization inactive");
      return false;
    }

    if (!eventDraft.start_date || !eventDraft.end_date) {
      toast.error("Les dates de debut et de fin sont obligatoires");
      return false;
    }

    if (new Date(eventDraft.end_date) < new Date(eventDraft.start_date)) {
      toast.error("La date de fin doit etre apres la date de debut");
      return false;
    }

    if (eventDraft.title.trim().length < 3) {
      toast.error("Le titre doit contenir au moins 3 caracteres");
      return false;
    }

    if (eventDraft.description.trim().length < 10) {
      toast.error("La description doit contenir au moins 10 caracteres");
      return false;
    }

    if (eventDraft.category_slugs.length === 0) {
      toast.error("Selectionnez au moins une categorie");
      return false;
    }

    if (eventDraft.address.trim().length < 5) {
      toast.error("L'adresse est obligatoire");
      return false;
    }

    if (eventDraft.city.trim().length < 2) {
      toast.error("La ville est obligatoire");
      return false;
    }

    if (!/^\d{5}$/.test(eventDraft.postal_code.trim())) {
      toast.error("Le code postal doit contenir 5 chiffres");
      return false;
    }

    if (!isValidOptionalCoordinate(eventDraft.latitude, -90, 90)) {
      toast.error("La latitude doit etre comprise entre -90 et 90");
      return false;
    }

    if (!isValidOptionalCoordinate(eventDraft.longitude, -180, 180)) {
      toast.error("La longitude doit etre comprise entre -180 et 180");
      return false;
    }

    if (!isValidUploadedImageValue(eventDraft.image)) {
      toast.error("Ajoutez une image PNG, JPG ou WebP de 1 Mo maximum");
      return false;
    }

    const price = Number(eventDraft.price.trim());

    if (!eventDraft.price.trim()) {
      toast.error("Le prix est obligatoire");
      return false;
    }

    if (Number.isNaN(price) || price < 0) {
      toast.error("Le prix doit etre un nombre positif ou egal a 0");
      return false;
    }

    if (!isValidOptionalUrl(eventDraft.ticketing_link)) {
      toast.error("L'URL de billetterie est invalide");
      return false;
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
      price,
      ticketing_link: eventDraft.ticketing_link.trim(),
      source: eventDraft.source?.trim() || null,
      organization_id: selectedOrganizationId,
      is_active: eventDraft.is_active,
      created_at: now,
      updated_at: now,
    };

    if (isCreatingEvent) {
      if (currentUser?.auth_source === "api") {
        const result = await eventsApi.create(payload);

        if (!result.ok) {
          toast.error(result.error.message);
          return false;
        }

        addEvent(result.data);
        toast.success("Evenement cree");
        setEditingEventId(null);
        setIsCreatingEvent(false);
        setEventDraft(null);
        return true;
      }

      toast.error("Session API requise pour creer un evenement");
      return false;
    } else if (editingEventId) {
      const event = eventsData.find((item) => item.id === editingEventId);
      if (!event) return false;

      if (currentUser?.auth_source === "api") {
        const result = await eventsApi.update(editingEventId, payload);

        if (!result.ok) {
          toast.error(result.error.message);
          return false;
        }

        updateEvent(editingEventId, result.data);
        toast.success("Evenement mis a jour");
        setEditingEventId(null);
        setIsCreatingEvent(false);
        setEventDraft(null);
        return true;
      }

      toast.error("Session API requise pour modifier un evenement");
      return false;
    }

    setEditingEventId(null);
    setIsCreatingEvent(false);
    setEventDraft(null);
    return true;
  };

  const deleteEvent = async (eventId: number, _reason: string) => {
    const deletedEvent = eventsData.find((event) => event.id === eventId);
    if (!deletedEvent) return false;

    if (currentUser?.auth_source === "api") {
      const result = await eventsApi.remove(eventId);

      if (!result.ok) {
        toast.error(result.error.message);
        return false;
      }
    }

    if (currentUser?.auth_source !== "api") {
      toast.error("Session API requise pour supprimer un evenement");
      return false;
    }

    deleteEventFromStore(eventId);
    setEditingEventId(null);
    toast.success(`${deletedEvent.title} supprime`);
  };

  const requestSaveUser = () => {
    if (!editingUserId) return;

    const editedAccount = accountSummaries.find(
      (account) => account.account_id === editingUserId,
    );

    if (!editedAccount) return;

    const editedOrganization = editedAccount.organization_id
      ? organizationsData.find((item) => item.id === editedAccount.organization_id)
      : null;
    const isOrganizationApproval =
      !!editedOrganization &&
      !editedOrganization.is_verified &&
      !!organizationDraft?.is_verified &&
      !!userDraft?.is_active;
    const isOrganizationRejection =
      !!editedOrganization &&
      !organizationDraft?.is_verified &&
      !userDraft?.is_active;
    const organizationAction: ModerationAction = isOrganizationApproval
      ? "organization_approved"
      : isOrganizationRejection
        ? "organization_rejected"
        : "organization_admin_updated";

    openDecisionModal({
      action: editedAccount.organization_id
        ? organizationAction
        : "account_admin_updated",
      targetId: editedAccount.organization_id ?? editingUserId,
      targetType: editedAccount.organization_id ? "organization" : "account",
      title: `Justifier la modification de ${editedAccount.display_name}`,
      variant: "primary",
      onConfirm: (reason) => saveUser(reason),
    });
  };

  const requestSaveEvent = () => {
    if (isCreatingEvent) {
      saveEvent();
      return;
    }

    if (!editingEventId) return;

    const event = eventsData.find((item) => item.id === editingEventId);
    if (!event) return;

    openDecisionModal({
      action: "event_admin_updated",
      targetId: editingEventId,
      targetType: "event",
      title: `Justifier la modification de ${event.title}`,
      variant: "primary",
      onConfirm: (reason) => saveEvent(reason),
    });
  };

  const isAccountsView = view === "accounts";
  const isEventsView = view === "events";
  const currentViewContent = viewContent[view];
  const { setAction: setStaffHeaderAction } = useStaffHeaderAction();
  const staffHeaderAction = useMemo<ReactNode | null>(() => {
    if (isAccountsView) {
      return (
        <Button type="button" onClick={startUserCreate}>
          Ajouter
        </Button>
      );
    }

    if (isEventsView) {
      return (
        <Button type="button" onClick={startEventCreate}>
          Ajouter
        </Button>
      );
    }

    return null;
  }, [isAccountsView, isEventsView, startEventCreate, startUserCreate]);
  const shouldRenderLocalActionHeader =
    !setStaffHeaderAction && (isAccountsView || isEventsView);
  const adminStats = [
    {
      label: "Comptes",
      to: ROUTES.ADMIN.DASHBOARD,
      value: accountSummaries.length,
      end: true,
    },
    { label: "Evenements", to: ROUTES.ADMIN.EVENTS, value: activeEventsData.length },
  ];

  useEffect(() => {
    if (!setStaffHeaderAction) return;

    setStaffHeaderAction(staffHeaderAction);

    return () => setStaffHeaderAction(null);
  }, [setStaffHeaderAction, staffHeaderAction]);

  if (staffSyncError && !isStaffLoaded) {
    return (
      <div className="admin-panel" aria-label={currentViewContent.title}>
        <section className="admin-section admin-section--wide">
          <ErrorMessage message={staffSyncError} />
          <Button type="button" onClick={() => void refreshStaffData()}>
            Recharger
          </Button>
        </section>
      </div>
    );
  }

  if (isStaffLoading || !isStaffLoaded) {
    return (
      <div className="admin-panel" aria-label={currentViewContent.title}>
        <section className="admin-section admin-section--wide">
          <Loader />
        </section>
      </div>
    );
  }

  return (
    <div className="admin-panel" aria-label={currentViewContent.title}>
      {shouldRenderLocalActionHeader && (
        <section className="admin-panel__header admin-panel__header--actions">
          <div className="admin-panel__heading">
            {staffHeaderAction}
          </div>
        </section>
      )}

      <PanelStats
        ariaLabel="Navigation administration"
        className="panel-stats--administration"
        stats={adminStats}
      />

      {isAccountsView && (
        <section className="admin-panel__grid">
          <article className="admin-section">
            <Toolbar ariaLabel="Filtres des comptes" className="admin-toolbar">
              <label>
                Rechercher
                <Input
                  value={accountSearch}
                  placeholder="Nom ou email..."
                  onChange={(event) => setAccountSearch(event.target.value)}
                />
              </label>
              <label>
                Type
                <Select
                  value={accountRoleFilter}
                  onChange={(event) =>
                    setAccountRoleFilter(event.target.value as AccountRoleFilter)
                  }
                >
                  <option value="all">Tous les types</option>
                  <option value="organizer">Utilisateurs organisateurs</option>
                  {ACCOUNT_LOGIN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {accountRoleLabels[role]}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Statut
                <Select
                  value={accountStatusFilter}
                  onChange={(event) =>
                    setAccountStatusFilter(event.target.value as AccountStatusFilter)
                  }
                >
                  <option value="all">Tous les statuts</option>
                  <option value="active">Actifs</option>
                  <option value="pending">En attente</option>
                  <option value="suspended">Suspendus</option>
                </Select>
              </label>
              <label>
                Trier par
                <Select
                  value={accountSort}
                  onChange={(event) =>
                    setAccountSort(event.target.value as AccountSort)
                  }
                >
                  <option value="username-asc">Nom A-Z</option>
                  <option value="username-desc">Nom Z-A</option>
                  <option value="role-asc">Type</option>
                </Select>
              </label>
            </Toolbar>

            <p className="admin-results-count">
              {filteredUsers.length} compte{filteredUsers.length > 1 ? "s" : ""}
            </p>

            {filteredUsers.length === 0 ? (
              <EmptyState message="Aucun compte ne correspond aux filtres." />
            ) : (
              <div className="admin-table admin-table--accounts" role="table" aria-label="Comptes">
                <div role="rowgroup">
                  {filteredUsers.map((user) => {
                    const accountStatus = getAccountAdminStatus(user);

                    return (
                      <div
                        className={[
                          "admin-table__row",
                          "admin-table__row--with-status",
                          accountStatus.value === "suspended"
                            ? "admin-table__row--suspended"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        role="row"
                        key={user.account_id}
                      >
                        <span role="cell">{user.display_name}</span>
                        <span role="cell">{user.login_email}</span>
                        <StatusBadge className="admin-account-role" role="cell">
                          {getAdminAccountRoleLabel(user)}
                        </StatusBadge>
                        <div className="admin-status-cell" role="cell">
                          <StatusBadge variant={accountStatus.variant}>
                            {accountStatus.label}
                          </StatusBadge>
                        </div>
                        {accountStatus.value === "suspended" &&
                          user.suspension_reason && (
                            <small
                              className="admin-suspension-reason admin-suspension-reason--inline"
                              role="cell"
                            >
                              Motif: {user.suspension_reason}
                            </small>
                          )}
                        <div className="admin-actions" role="cell">
                          {accountStatus.value === "suspended" && (
                            <Button
                              type="button"
                              onClick={() =>
                                openDecisionModal({
                                  action: "account_restored",
                                  targetId: user.account_id,
                                  targetType: "account",
                                  title: `Justifier la levee de suspension de ${user.display_name}`,
                                  variant: "primary",
                                  onConfirm: (reason) =>
                                    liftAccountSuspension(user, reason),
                                })
                              }
                            >
                              Lever suspension
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => startUserEdit(user)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="danger"
                            type="button"
                            onClick={() =>
                              openDecisionModal({
                                action: user.organization_id
                                  ? "organization_deleted"
                                  : "account_deleted",
                                targetId: user.organization_id ?? user.account_id,
                                targetType: user.organization_id
                                  ? "organization"
                                  : "account",
                                title: `Justifier la suppression de ${user.display_name}`,
                                onConfirm: (reason) =>
                                  deleteUser(user.account_id, reason),
                              })
                            }
                          >
                            Supprimer
                          </Button>
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
            <Toolbar ariaLabel="Filtres des evenements" className="admin-toolbar">
              <label>
                Rechercher
                <Input
                  value={eventSearch}
                  placeholder="Titre, ville, code postal..."
                  onChange={(event) => setEventSearch(event.target.value)}
                />
              </label>
              <label>
                Categorie
                <Select
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
                </Select>
              </label>
              <label>
                Ville
                <Select
                  value={eventCityFilter}
                  onChange={(event) => setEventCityFilter(event.target.value)}
                >
                  <option value="all">Toutes les villes</option>
                  {eventCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Statut
                <Select
                  value={eventStatusFilter}
                  onChange={(event) =>
                    setEventStatusFilter(event.target.value as EventStatusFilter)
                  }
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="deleted">Supprimes</option>
                  <option value="reported">Signales</option>
                  <option value="published">Publies</option>
                </Select>
              </label>
              <label>
                Trier par
                <Select
                  value={eventSort}
                  onChange={(event) => setEventSort(event.target.value as EventSort)}
                >
                  <option value="date-asc">Debut croissant</option>
                  <option value="date-desc">Debut decroissant</option>
                  <option value="title-asc">Titre A-Z</option>
                  <option value="title-desc">Titre Z-A</option>
                  <option value="city-asc">Ville A-Z</option>
                </Select>
              </label>
            </Toolbar>

            <p className="admin-results-count">
              {filteredEvents.length} evenement{filteredEvents.length > 1 ? "s" : ""}
            </p>

            {filteredEvents.length === 0 ? (
              <EmptyState message="Aucun evenement ne correspond aux filtres." />
            ) : (
              <div className="admin-table admin-table--events" role="table" aria-label="Événements">
                <div role="rowgroup">
                  {filteredEvents.map((event) => {
                    const eventStatus = getEventAdminStatus(
                      event,
                      reportedEventIds.has(event.id),
                    );
                    const ticketingHref = getTicketingHref(event.ticketing_link);

                    return (
                      <div
                        className="admin-table__row admin-table__row--event-card admin-table__row--with-status"
                        role="row"
                        key={event.id}
                      >
                        <span className="admin-event-image-cell" role="cell">
                          <img src={event.image} alt={`Visuel ${event.title}`} />
                        </span>
                        <span role="cell">{event.title}</span>
                        <span role="cell">{getEventCategories(event).join(", ")}</span>
                        <span role="cell">{event.city}</span>
                        <span className="admin-event-price-cell" role="cell">
                          {formatEventPrice(event.price)}
                          {ticketingHref && (
                            <a
                              href={ticketingHref}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Billetterie
                            </a>
                          )}
                        </span>
                        <span role="cell">{formatEventDateRange(event)}</span>
                        <div className="admin-status-cell" role="cell">
                          <StatusBadge variant={eventStatus.variant}>
                            {eventStatus.label}
                          </StatusBadge>
                          {eventStatus.value === "suspended" &&
                            event.suspension_reason && (
                              <small className="admin-suspension-reason">
                                Motif: {event.suspension_reason}
                              </small>
                            )}
                        </div>
                        <div className="admin-actions" role="cell">
                          {eventStatus.value === "suspended" && (
                            <Button
                              type="button"
                              onClick={() =>
                                openDecisionModal({
                                  action: "event_restored",
                                  targetId: event.id,
                                  targetType: "event",
                                  title: `Justifier la levee de suspension de ${event.title}`,
                                  variant: "primary",
                                  onConfirm: (reason) =>
                                    liftEventSuspension(event, reason),
                                })
                              }
                            >
                              Lever suspension
                            </Button>
                          )}
                          {eventStatus.value !== "deleted" && (
                            <>
                              <Button
                                variant="secondary"
                                type="button"
                                onClick={() => startEventEdit(event)}
                              >
                                Modifier
                              </Button>
                              <Button
                                variant="danger"
                                type="button"
                                onClick={() =>
                                  openDecisionModal({
                                    action: "event_deleted",
                                    targetId: event.id,
                                    targetType: "event",
                                    title: `Justifier la suppression de ${event.title}`,
                                    onConfirm: (reason) =>
                                      deleteEvent(event.id, reason),
                                  })
                                }
                              >
                                Supprimer
                              </Button>
                            </>
                          )}
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

      <FormModal
        ariaLabel={isCreatingUser ? "Ajouter un compte" : "Modifier un compte"}
        open={!!userDraft && (isCreatingUser || editingUserId !== null)}
        size="lg"
        onClose={closeUserForm}
      >
        {userDraft && isCreatingUser && (
          <div className="admin-create-account">
            <h2>Ajouter un compte</h2>
            <FormField label="Type d'utilisateur" htmlFor="admin-account-type">
              <Select
                id="admin-account-type"
                value={accountCreateRole}
                onChange={(event) =>
                  updateAccountCreateRole(event.target.value as AccountLoginRole)
                }
              >
                {ACCOUNT_LOGIN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {accountRoleLabels[role]}
                  </option>
                ))}
              </Select>
            </FormField>

            <RegisterForm
              mode="admin"
              role={accountCreateRole}
              title={`Ajouter un compte ${accountLoginCreateLabels[accountCreateRole]}`}
              submitLabel={`Creer le compte ${accountLoginCreateLabels[accountCreateRole]}`}
              onCancel={closeUserForm}
              onSuccess={() => {
                closeUserForm();
                void refreshStaffData();
              }}
            />
          </div>
        )}

        {userDraft && !isCreatingUser && editingUserId !== null && (
          <div className="admin-create-account">
            <h2>Modifier un compte</h2>
            <UserEditor
              draft={userDraft}
              setDraft={setUserDraft}
              showActions={!organizationDraft}
              showDisplayName={!organizationDraft}
              showRoleSelect={!organizationDraft}
              onSave={requestSaveUser}
              onCancel={closeUserForm}
            />
            {organizationDraft && (
              <>
                <OrganizationEditor
                  draft={organizationDraft}
                  setDraft={setOrganizationDraft}
                />
                <ActionRow className="admin-actions">
                  <Button type="button" onClick={requestSaveUser}>
                    Enregistrer
                  </Button>
                  <Button variant="secondary" type="button" onClick={closeUserForm}>
                    Annuler
                  </Button>
                </ActionRow>
              </>
            )}
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
              organizations={activeOrganizationsData}
              setDraft={setEventDraft}
              onSave={requestSaveEvent}
              onCancel={closeEventForm}
            />
          </div>
        )}
      </FormModal>
      <DecisionReasonModal
        error={decisionReasonError}
        open={!!decisionRequest}
        reason={decisionReason}
        title={decisionRequest?.title ?? "Justifier la decision"}
        variant={decisionRequest?.variant}
        onCancel={closeDecisionModal}
        onConfirm={confirmDecision}
        onReasonChange={(reason) => {
          setDecisionReason(reason);
          if (decisionReasonError) setDecisionReasonError("");
        }}
      />
    </div>
  );
}

type DraftSetter<T> = (draft: T | null) => void;

function UserEditor({
  draft,
  setDraft,
  showActions = true,
  showDisplayName = true,
  showRoleSelect = true,
  onSave,
  onCancel,
}: {
  draft: UserDraft;
  setDraft: DraftSetter<UserDraft>;
  showActions?: boolean;
  showDisplayName?: boolean;
  showRoleSelect?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="admin-inline-editor">
      {showDisplayName && (
        <FormField label="Nom" htmlFor="admin-user-name">
          <Input
            id="admin-user-name"
            value={draft.display_name}
            onChange={(event) =>
              setDraft({ ...draft, display_name: event.target.value })
            }
          />
        </FormField>
      )}
      <FormField label="Email de connexion" htmlFor="admin-user-email">
        <Input
          id="admin-user-email"
          type="email"
          value={draft.login_email}
          onChange={(event) =>
            setDraft({ ...draft, login_email: event.target.value })
          }
        />
      </FormField>
      <FormField label="Mot de passe / hash" htmlFor="admin-user-password">
        <Input
          id="admin-user-password"
          value={draft.password_hash}
          onChange={(event) =>
            setDraft({ ...draft, password_hash: event.target.value })
          }
        />
      </FormField>
      {showRoleSelect && (
        <FormField label="Type d'utilisateur" htmlFor="admin-user-role">
          <Select
            id="admin-user-role"
            value={draft.role}
            onChange={(event) =>
              setDraft({ ...draft, role: event.target.value as AccountLoginRole })
            }
          >
            {ACCOUNT_LOGIN_ROLES.map((role) => (
              <option key={role} value={role}>
                {accountRoleLabels[role]}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      <Checkbox
        checked={draft.is_active}
        className="admin-checkbox"
        label="Actif"
        onChange={(event) =>
          setDraft({ ...draft, is_active: event.target.checked })
        }
      />
      {showActions && (
        <ActionRow className="admin-actions">
          <Button type="button" onClick={onSave}>
            Enregistrer
          </Button>
          <Button variant="secondary" type="button" onClick={onCancel}>
            Annuler
          </Button>
        </ActionRow>
      )}
    </div>
  );
}

function OrganizationEditor({
  draft,
  setDraft,
}: {
  draft: OrganizationDraft;
  setDraft: DraftSetter<OrganizationDraft>;
}) {
  const updateField = <Key extends keyof OrganizationDraft>(
    field: Key,
    value: OrganizationDraft[Key],
  ) => {
    setDraft({ ...draft, [field]: value });
  };

  const toggleCategory = (category: OrganizationCategoryName) => {
    updateField(
      "category_slugs",
      draft.category_slugs.includes(category)
        ? draft.category_slugs.filter((item) => item !== category)
        : [...draft.category_slugs, category],
    );
  };

  return (
    <div className="admin-form-grid admin-organization-form">
      <h3 className="admin-form-grid__wide">Informations organisation</h3>
      <FormField label="Nom de l'organization" htmlFor="admin-organization-name">
        <Input
          id="admin-organization-name"
          value={draft.name}
          onChange={(event) => updateField("name", event.target.value)}
        />
      </FormField>
      <FormField label="Email de contact" htmlFor="admin-organization-contact-email">
        <Input
          id="admin-organization-contact-email"
          type="email"
          value={draft.contact_email}
          onChange={(event) => updateField("contact_email", event.target.value)}
        />
      </FormField>
      <FormField
        label="Description"
        htmlFor="admin-organization-description"
        className="admin-form-grid__wide"
      >
        <Textarea
          id="admin-organization-description"
          rows={4}
          value={draft.description}
          onChange={(event) => updateField("description", event.target.value)}
        />
      </FormField>
      <FormField label="Site web" htmlFor="admin-organization-website">
        <Input
          id="admin-organization-website"
          type="url"
          value={draft.website}
          onChange={(event) => updateField("website", event.target.value)}
        />
      </FormField>
      <FormField label="Logo" htmlFor="admin-organization-logo">
        <Input
          id="admin-organization-logo"
          type="url"
          value={draft.logo}
          onChange={(event) => updateField("logo", event.target.value)}
        />
      </FormField>
      <FormField
        label="Adresse"
        htmlFor="admin-organization-address"
        className="admin-form-grid__wide"
      >
        <Input
          id="admin-organization-address"
          value={draft.address}
          onChange={(event) => updateField("address", event.target.value)}
        />
      </FormField>
      <FormField label="Ville" htmlFor="admin-organization-city">
        <Input
          id="admin-organization-city"
          value={draft.city}
          onChange={(event) => updateField("city", event.target.value)}
        />
      </FormField>
      <FormField label="Code postal" htmlFor="admin-organization-postal-code">
        <Input
          id="admin-organization-postal-code"
          inputMode="numeric"
          value={draft.postal_code}
          onChange={(event) => updateField("postal_code", event.target.value)}
        />
      </FormField>
      <FormField label="Latitude" htmlFor="admin-organization-latitude">
        <Input
          id="admin-organization-latitude"
          step="any"
          type="number"
          value={draft.latitude}
          onChange={(event) => updateField("latitude", event.target.value)}
        />
      </FormField>
      <FormField label="Longitude" htmlFor="admin-organization-longitude">
        <Input
          id="admin-organization-longitude"
          step="any"
          type="number"
          value={draft.longitude}
          onChange={(event) => updateField("longitude", event.target.value)}
        />
      </FormField>
      <FormField label="Telephone" htmlFor="admin-organization-phone">
        <Input
          id="admin-organization-phone"
          type="tel"
          value={draft.contact_phone_number}
          onChange={(event) =>
            updateField("contact_phone_number", event.target.value)
          }
        />
      </FormField>
      <FormField label="SIRET" htmlFor="admin-organization-siret">
        <Input
          id="admin-organization-siret"
          inputMode="numeric"
          value={draft.siret}
          onChange={(event) => updateField("siret", event.target.value)}
        />
      </FormField>
      <Checkbox
        checked={draft.is_verified}
        className="admin-checkbox"
        label="Verifiee"
        onChange={(event) => updateField("is_verified", event.target.checked)}
      />
      <div className="admin-form-grid__wide">
        <CheckboxGroup label="Categories" labelId="admin-organization-categories">
          {ORGANIZATION_CATEGORIES.map((category) => (
            <Checkbox
              checked={draft.category_slugs.includes(category)}
              key={category}
              label={category}
              onChange={() => toggleCategory(category)}
            />
          ))}
        </CheckboxGroup>
      </div>
    </div>
  );
}

function EventEditor({
  draft,
  organizations,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: EventDraft;
  organizations: Organization[];
  setDraft: DraftSetter<EventDraft>;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="admin-form-grid admin-event-form">
      <FormField label="Titre" htmlFor="admin-event-title">
        <Input
          id="admin-event-title"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </FormField>
      <FormField label="Organization" htmlFor="admin-event-organization">
        <Select
          id="admin-event-organization"
          value={draft.organization_id}
          onChange={(event) =>
            setDraft({ ...draft, organization_id: event.target.value })
          }
        >
          <option value="">Selectionner</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="admin-form-grid__wide">
        <CategorySelect
          labelId="admin-event-categories"
          selected={draft.category_slugs}
          onToggle={(category) =>
            setDraft(toggleEventDraftCategory(draft, category))
          }
        />
      </div>
      <FormField
        label="Description"
        htmlFor="admin-event-description"
        className="admin-form-grid__wide"
      >
        <Textarea
          id="admin-event-description"
          rows={3}
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
        />
      </FormField>
      <FormField label="Date de debut" htmlFor="admin-event-start-date">
        <Input
          id="admin-event-start-date"
          type="datetime-local"
          value={draft.start_date}
          onChange={(event) =>
            setDraft({ ...draft, start_date: event.target.value })
          }
        />
      </FormField>
      <FormField label="Date de fin" htmlFor="admin-event-end-date">
        <Input
          id="admin-event-end-date"
          type="datetime-local"
          value={draft.end_date}
          onChange={(event) =>
            setDraft({ ...draft, end_date: event.target.value })
          }
        />
      </FormField>
      <FormField
        label="Adresse"
        htmlFor="admin-event-address"
        className="admin-form-grid__wide"
      >
        <Input
          id="admin-event-address"
          value={draft.address}
          onChange={(event) => setDraft({ ...draft, address: event.target.value })}
        />
      </FormField>
      <FormField label="Ville" htmlFor="admin-event-city">
        <Input
          id="admin-event-city"
          value={draft.city}
          onChange={(event) => setDraft({ ...draft, city: event.target.value })}
        />
      </FormField>
      <FormField label="Code postal" htmlFor="admin-event-postal-code">
        <Input
          id="admin-event-postal-code"
          inputMode="numeric"
          value={draft.postal_code}
          onChange={(event) =>
            setDraft({ ...draft, postal_code: event.target.value })
          }
        />
      </FormField>
      <FormField label="Latitude" htmlFor="admin-event-latitude">
        <Input
          id="admin-event-latitude"
          value={draft.latitude}
          onChange={(event) =>
            setDraft({ ...draft, latitude: event.target.value })
          }
        />
      </FormField>
      <FormField label="Longitude" htmlFor="admin-event-longitude">
        <Input
          id="admin-event-longitude"
          value={draft.longitude}
          onChange={(event) =>
            setDraft({ ...draft, longitude: event.target.value })
          }
        />
      </FormField>
      <ImageField
        className="admin-form-grid__wide"
        id="admin-event-image"
        value={draft.image}
        onChange={(value) => setDraft({ ...draft, image: value })}
      />
      <FormField label="Prix" htmlFor="admin-event-price">
        <Input
          id="admin-event-price"
          min="0"
          step="0.01"
          type="number"
          value={draft.price}
          onChange={(event) => setDraft({ ...draft, price: event.target.value })}
        />
      </FormField>
      <FormField label="Lien de billetterie" htmlFor="admin-event-ticketing-link">
        <Input
          id="admin-event-ticketing-link"
          type="url"
          value={draft.ticketing_link}
          onChange={(event) =>
            setDraft({ ...draft, ticketing_link: event.target.value })
          }
        />
      </FormField>
      <FormField label="Source" htmlFor="admin-event-source">
        <Input
          id="admin-event-source"
          value={draft.source ?? ""}
          onChange={(event) => setDraft({ ...draft, source: event.target.value })}
        />
      </FormField>
      <Checkbox
        checked={draft.is_active}
        className="admin-checkbox"
        label="Publie"
        onChange={(event) =>
          setDraft({ ...draft, is_active: event.target.checked })
        }
      />
      <ActionRow className="admin-actions admin-form-grid__wide">
        <Button type="button" onClick={onSave}>
          Enregistrer
        </Button>
        <Button variant="secondary" type="button" onClick={onCancel}>
          Annuler
        </Button>
      </ActionRow>
    </div>
  );
}
