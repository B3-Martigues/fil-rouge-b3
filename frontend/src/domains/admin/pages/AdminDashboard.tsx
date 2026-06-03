import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  EVENT_CATEGORIES,
  type EventCategory,
} from "../../events/types/event-categories";
import type { Event } from "../../events/types/event";
import type { Company } from "../../companies/types/company";
import {
  ACCOUNT_TYPE_IDS,
  type Account,
  type AccountSummary,
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
import {
  createCompanyApprovedNotification,
  createEventApprovedNotification,
} from "../../notifications/services/notificationFactory";

type UserDraft = {
  display_name: string;
  login_email: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
};

type CompanyDraft = {
  name: string;
  contact_email: string;
  description: string;
  website: string;
  address: string;
  city: string;
  postal_code: string;
  logo: string;
  siret: string;
  latitude: string;
  longitude: string;
  contact_phone_number: string;
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
type AccountStatusFilter = "all" | "active" | "pending";
type AccountSort = "username-asc" | "username-desc" | "role-asc";
type EventSort = "date-asc" | "date-desc" | "title-asc" | "title-desc" | "city-asc";

type AdminDashboardProps = {
  view?: AdminView;
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

const isValidOptionalUrl = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue === "" || URL.canParse(trimmedValue);
};

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

const validateCompanyDraft = (draft: CompanyDraft) => {
  if (draft.name.trim().length < 2) {
    return "Le nom de l'entreprise est obligatoire";
  }

  if (!isValidEmail(draft.contact_email)) {
    return "L'email de contact est invalide";
  }

  if (draft.description.trim().length < 10) {
    return "La description doit contenir au moins 10 caracteres";
  }

  if (!isValidOptionalUrl(draft.website)) {
    return "URL du site invalide";
  }

  if (!isValidOptionalUrl(draft.logo)) {
    return "URL du logo invalide";
  }

  if (!isValidOptionalCoordinate(draft.latitude, -90, 90)) {
    return "La latitude doit etre comprise entre -90 et 90";
  }

  if (!isValidOptionalCoordinate(draft.longitude, -180, 180)) {
    return "La longitude doit etre comprise entre -180 et 180";
  }

  if (draft.address.trim().length < 5) {
    return "L'adresse est obligatoire";
  }

  if (draft.city.trim().length < 2) {
    return "La ville est obligatoire";
  }

  if (!/^\d{5}$/.test(draft.postal_code.trim())) {
    return "Le code postal doit contenir 5 chiffres";
  }

  if (!/^\d{10}$/.test(draft.contact_phone_number.trim())) {
    return "Le telephone doit contenir 10 chiffres";
  }

  if (!/^\d{14}$/.test(draft.siret.trim())) {
    return "Le SIRET doit contenir 14 chiffres";
  }

  return null;
};

const formatPhoneNumber = (phoneNumber?: string) =>
  phoneNumber ? phoneNumber.replace(/(\d{2})(?=\d)/g, "$1 ") : "Non renseigne";

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

const toCompanyDraft = (company: Company): CompanyDraft => ({
  name: company.name,
  contact_email: company.contact_email,
  description: company.description ?? "",
  website: company.website ?? "",
  latitude: company.latitude?.toString() ?? "",
  longitude: company.longitude?.toString() ?? "",
  address: company.address,
  city: company.city,
  postal_code: company.postal_code,
  logo: company.logo ?? "",
  contact_phone_number: company.contact_phone_number ?? "",
  siret: company.siret ?? "",
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
  const companyMembersData = useDataStore((s) => s.companyMembers);
  const eventsData = useDataStore((s) => s.events);
  const addAccount = useDataStore((s) => s.addAccount);
  const updateAccount = useDataStore((s) => s.updateAccount);
  const deleteAccountFromStore = useDataStore((s) => s.deleteAccount);
  const addUser = useDataStore((s) => s.addUser);
  const updateUser = useDataStore((s) => s.updateUser);
  const deleteUserFromStore = useDataStore((s) => s.deleteUser);
  const updateCompany = useDataStore((s) => s.updateCompany);
  const activateCompanyInStore = useDataStore((s) => s.activateCompany);
  const deleteCompanyFromStore = useDataStore((s) => s.deleteCompany);
  const addEvent = useDataStore((s) => s.addEvent);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const approveEventInStore = useDataStore((s) => s.approveEvent);
  const deleteEventFromStore = useDataStore((s) => s.deleteEvent);
  const dispatchNotification = useDataStore((s) => s.dispatchNotification);
  const accountSummaries = useMemo(
    () => buildAccountSummaries(accountsData, usersData, companiesData),
    [accountsData, usersData, companiesData],
  );

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userDraft, setUserDraft] = useState<UserDraft | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [companyDraft, setCompanyDraft] = useState<CompanyDraft | null>(null);
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
  const users = accountSummaries.filter((account) => account.role === "user");
  const admins = accountSummaries.filter((account) => account.role === "admin");
  const companies = accountSummaries.filter((account) => account.role === "company");
  const pendingCompanies = activeCompaniesData.filter((company) => !company.is_active);
  const pendingEvents = activeEventsData.filter((event) => !event.is_active);
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

  const hasDuplicateCompanyContactEmail = (
    email: string,
    currentCompanyId?: number,
  ) =>
    companiesData.some(
      (company) =>
        company.id !== currentCompanyId &&
        normalizeComparable(company.contact_email) === normalizeComparable(email),
    );

  const hasDuplicateCompanySiret = (siret: string, currentCompanyId?: number) =>
    companiesData.some(
      (company) =>
        company.id !== currentCompanyId &&
        normalizeComparable(company.siret ?? "") === normalizeComparable(siret),
    );

  const getCompanyName = (companyId: number) =>
    activeCompaniesData.find((company) => company.id === companyId)?.name ??
    "Non rattache";

  const getCompanyNotificationUser = (company: Company) => {
    const companyMember = companyMembersData.find(
      (item) => item.company_id === company.id && !item.deleted_at,
    );

    return (
      usersData.find(
        (user) => user.id === companyMember?.user_id && !user.deleted_at,
      ) ??
      usersData.find(
        (user) => user.account_id === company.account_id && !user.deleted_at,
      )
    );
  };

  const stats = [
    { label: "Evenements", value: activeEventsData.length },
    { label: "Utilisateurs", value: users.length },
    { label: "Entreprises", value: companies.length },
    { label: "Administrateurs", value: admins.length },
    { label: "Entreprises en attente", value: pendingCompanies.length },
    { label: "Evenements en attente", value: pendingEvents.length },
  ];

  const filteredUsers = useMemo(
    () =>
      accountSummaries
        .filter((account) => {
          const matchesSearch = normalizeText(
            [account.display_name, account.login_email, account.role].join(" "),
          ).includes(normalizeText(accountSearch));
          const matchesRole =
            accountRoleFilter === "all" || account.role === accountRoleFilter;
          const matchesStatus =
            accountStatusFilter === "all" ||
            (accountStatusFilter === "active" && account.is_active) ||
            (accountStatusFilter === "pending" && !account.is_active);

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

  const activateCompany = (companyId: number) => {
    const company = companiesData.find((item) => item.id === companyId);
    if (!company) {
      toast.error("Entreprise introuvable");
      return;
    }

    activateCompanyInStore(companyId);
    const notificationUser = getCompanyNotificationUser(company);

    if (!notificationUser) {
      toast.error("Aucun membre entreprise rattache pour notifier ce compte");
    } else {
      void dispatchNotification(
        createCompanyApprovedNotification({
          company,
          user: notificationUser,
        }),
      );
    }
    toast.success(`${company.name} est maintenant activee`);
  };

  const saveCompany = () => {
    if (!editingCompanyId || !companyDraft) return;

    const contactEmail = companyDraft.contact_email.trim();
    const siret = companyDraft.siret.trim();
    const validationError = validateCompanyDraft(companyDraft);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (hasDuplicateCompanyContactEmail(contactEmail, editingCompanyId)) {
      toast.error("Cet email de contact est deja utilise");
      return;
    }

    if (siret && hasDuplicateCompanySiret(siret, editingCompanyId)) {
      toast.error("Ce SIRET est deja utilise");
      return;
    }

    updateCompany(editingCompanyId, {
      name: companyDraft.name.trim(),
      contact_email: contactEmail,
      description: companyDraft.description.trim(),
      website: companyDraft.website.trim(),
      latitude: parseOptionalCoordinate(companyDraft.latitude),
      longitude: parseOptionalCoordinate(companyDraft.longitude),
      address: companyDraft.address.trim(),
      city: companyDraft.city.trim(),
      postal_code: companyDraft.postal_code.trim(),
      logo: companyDraft.logo.trim(),
      contact_phone_number: companyDraft.contact_phone_number.trim(),
      siret,
    });

    setEditingCompanyId(null);
    setCompanyDraft(null);
    toast.success("Entreprise mise a jour");
  };

  const deleteCompany = (companyId: number) => {
    const deletedCompany = companiesData.find((company) => company.id === companyId);
    if (!deletedCompany) return;

    deleteCompanyFromStore(companyId);
    setEditingCompanyId(null);
    setCompanyDraft(null);
    toast.success(`${deletedCompany.name} supprimee`);
  };

  const startUserEdit = (account: AccountSummary) => {
    setIsCreatingUser(false);
    setEditingUserId(account.account_id);
    setUserDraft(toUserDraft(account));
  };

  const startUserCreate = () => {
    setEditingUserId(null);
    setIsCreatingUser(true);
    setUserDraft(emptyUserDraft());
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
        account_type_id: ACCOUNT_TYPE_IDS.user,
        account_type: "user",
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

    deleteEventFromStore(eventId);
    setEditingEventId(null);
    toast.success(`${deletedEvent.title} supprime`);
  };

  const approveEvent = (eventId: number) => {
    const event = eventsData.find((item) => item.id === eventId);
    if (!event) {
      toast.error("Evenement introuvable");
      return;
    }

    const company = companiesData.find((item) => item.id === event.company_id);

    if (!company || company.deleted_at || !company.is_active) {
      toast.error("Impossible de publier un evenement rattache a une entreprise inactive");
      return;
    }

    approveEventInStore(eventId);
    const notificationUser = company
      ? getCompanyNotificationUser(company)
      : null;

    if (!company || !notificationUser) {
      toast.error("Aucun membre entreprise rattache pour notifier cet evenement");
    } else {
      void dispatchNotification(
        createEventApprovedNotification({
          company,
          event,
          user: notificationUser,
        }),
      );
    }
    toast.success(`${event.title} est maintenant visible`);
  };

  const isDashboardView = view === "dashboard";
  const isAccountsView = view === "accounts";
  const isEventsView = view === "events";

  return (
    <div className="admin-panel">
      <section className="admin-panel__header">
        <div className="admin-panel__heading">
          <h2>
            {isDashboardView && "Panel administrateur"}
            {isAccountsView && "Comptes"}
            {isEventsView && "Evenements"}
          </h2>
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
        <p>
          {isDashboardView && "Statistiques et validations"}
          {isAccountsView && "Gestion des comptes"}
          {isEventsView && "Gestion des evenements publies"}
        </p>
      </section>

      {isDashboardView && (
        <>
          <section className="admin-panel__stats" aria-label="Statistiques admin">
            {stats.map((stat) => (
              <article className="admin-stat" key={stat.label}>
                <span className="admin-stat__value">{stat.value}</span>
                <span className="admin-stat__label">{stat.label}</span>
              </article>
            ))}
          </section>

          <section className="admin-section admin-section--wide">
            <div className="admin-section__title">
              <h2>Entreprises en attente</h2>
              <span className="admin-count">{pendingCompanies.length}</span>
            </div>

            {pendingCompanies.length === 0 ? (
              <p className="admin-empty">Aucune entreprise en attente.</p>
            ) : (
              <div className="company-review-list">
                {pendingCompanies.map((company) => (
                  <article className="company-review" key={company.id}>
                    <div className="company-review__media">
                      <img src={company.logo ?? ""} alt={`Logo ${company.name}`} />
                    </div>
                    <div className="company-review__content">
                      {editingCompanyId === company.id && companyDraft ? (
                        <CompanyEditor
                          draft={companyDraft}
                          setDraft={setCompanyDraft}
                          onSave={saveCompany}
                          onCancel={() => {
                            setEditingCompanyId(null);
                            setCompanyDraft(null);
                          }}
                        />
                      ) : (
                        <>
                          <div className="company-review__header">
                            <div>
                              <h3>{company.name}</h3>
                              <p>{company.description}</p>
                            </div>
                            <span className="admin-status">En attente</span>
                          </div>
                          <dl className="company-review__details">
                            <div>
                              <dt>Email contact</dt>
                              <dd>{company.contact_email}</dd>
                            </div>
                            <div>
                              <dt>Telephone</dt>
                              <dd>
                                {formatPhoneNumber(
                                  company.contact_phone_number ?? undefined,
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt>Adresse</dt>
                              <dd>
                                {company.address}, {company.city} {company.postal_code}
                              </dd>
                            </div>
                            <div>
                              <dt>SIRET</dt>
                              <dd>{company.siret ?? "Non renseigne"}</dd>
                            </div>
                          </dl>
                          <div className="admin-actions">
                            <button
                              className="btn"
                              type="button"
                              onClick={() => activateCompany(company.id)}
                            >
                              Valider
                            </button>
                            <button
                              className="btn btn--secondary"
                              type="button"
                              onClick={() => {
                                setEditingCompanyId(company.id);
                                setCompanyDraft(toCompanyDraft(company));
                              }}
                            >
                              Modifier
                            </button>
                            <button
                              className="btn btn--danger"
                              type="button"
                              onClick={() => deleteCompany(company.id)}
                            >
                              Supprimer
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-section admin-section--wide">
            <div className="admin-section__title">
              <h2>Evenements en attente</h2>
              <span className="admin-count">{pendingEvents.length}</span>
            </div>

            {pendingEvents.length === 0 ? (
              <p className="admin-empty">Aucun evenement en attente.</p>
            ) : (
              <div className="company-review-list">
                {pendingEvents.map((event) => (
                  <article className="company-review" key={event.id}>
                    <div className="company-review__media">
                      <img src={event.image} alt={`Visuel ${event.title}`} />
                    </div>
                    <div className="company-review__content">
                      {editingEventId === event.id && eventDraft ? (
                        <EventEditor
                          draft={eventDraft}
                          companies={activeCompaniesData}
                          setDraft={setEventDraft}
                          onSave={saveEvent}
                          onCancel={() => {
                            setEditingEventId(null);
                            setEventDraft(null);
                          }}
                        />
                      ) : (
                        <>
                          <div className="company-review__header">
                            <div>
                              <h3>{event.title}</h3>
                              <p>{event.description}</p>
                            </div>
                            <span className="admin-status">En attente</span>
                          </div>
                          <dl className="company-review__details">
                            <div>
                              <dt>Debut / fin</dt>
                              <dd>{formatEventDateRange(event)}</dd>
                            </div>
                            <div>
                              <dt>Entreprise</dt>
                              <dd>{getCompanyName(event.company_id)}</dd>
                            </div>
                            <div>
                              <dt>Adresse</dt>
                              <dd>
                                {event.address}, {event.city} {event.postal_code}
                              </dd>
                            </div>
                          </dl>
                          <div className="admin-actions">
                            <button
                              className="btn"
                              type="button"
                              onClick={() => approveEvent(event.id)}
                            >
                              Publier
                            </button>
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
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {isAccountsView && (
        <section className="admin-panel__grid">
          <article className="admin-section">
            {isCreatingUser && userDraft && (
              <UserEditor
                draft={userDraft}
                setDraft={setUserDraft}
                onSave={saveUser}
                onCancel={() => {
                  setIsCreatingUser(false);
                  setUserDraft(null);
                }}
              />
            )}

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
                {filteredUsers.map((user) => (
                  <div className="admin-table__row" role="row" key={user.account_id}>
                    {editingUserId === user.account_id && userDraft ? (
                      <UserEditor
                        draft={userDraft}
                        setDraft={setUserDraft}
                        onSave={saveUser}
                        onCancel={() => {
                          setEditingUserId(null);
                          setUserDraft(null);
                        }}
                      />
                    ) : (
                      <>
                        <span>{user.display_name}</span>
                        <span>{user.login_email}</span>
                        <span className="admin-badge">{user.role}</span>
                        <span
                          className={`admin-status ${
                            user.is_active ? "admin-status--active" : ""
                          }`}
                        >
                          {user.is_active ? "Actif" : "En attente"}
                        </span>
                        <div className="admin-actions">
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
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      {isEventsView && (
        <section className="admin-panel__grid">
          <article className="admin-section">
            {eventDraft && (isCreatingEvent || editingEventId) && (
              <EventEditor
                draft={eventDraft}
                companies={activeCompaniesData}
                setDraft={setEventDraft}
                onSave={saveEvent}
                onCancel={() => {
                  setEditingEventId(null);
                  setIsCreatingEvent(false);
                  setEventDraft(null);
                }}
              />
            )}

            <div className="admin-toolbar" aria-label="Filtres des evenements">
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
              <div className="admin-table admin-table--events" role="table" aria-label="Evenements">
                {filteredEvents.map((event) => (
                  <div className="admin-table__row" role="row" key={event.id}>
                    <span>{event.title}</span>
                    <span>{getEventCategories(event).join(", ")}</span>
                    <span>{event.city}</span>
                    <span>{formatEventDateRange(event)}</span>
                    <span
                      className={`admin-status ${
                        event.is_active ? "admin-status--active" : ""
                      }`}
                    >
                      {event.is_active ? "Publie" : "En attente"}
                    </span>
                    <div className="admin-actions">
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={() => startEventEdit(event)}
                      >
                        Modifier
                      </button>
                      {!event.is_active && (
                        <button
                          className="btn"
                          type="button"
                          onClick={() => approveEvent(event.id)}
                        >
                          Publier
                        </button>
                      )}
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
            )}
          </article>
        </section>
      )}
    </div>
  );
}

type DraftSetter<T> = (draft: T | null) => void;

function UserEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: UserDraft;
  setDraft: DraftSetter<UserDraft>;
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

function CompanyEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: CompanyDraft;
  setDraft: DraftSetter<CompanyDraft>;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="admin-form-grid">
      <label>
        Nom
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        Email contact
        <input
          type="email"
          value={draft.contact_email}
          onChange={(event) =>
            setDraft({ ...draft, contact_email: event.target.value })
          }
        />
      </label>
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
        Site web
        <input
          value={draft.website}
          onChange={(event) => setDraft({ ...draft, website: event.target.value })}
        />
      </label>
      <label>
        Logo
        <input
          value={draft.logo}
          onChange={(event) => setDraft({ ...draft, logo: event.target.value })}
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
          value={draft.postal_code}
          onChange={(event) =>
            setDraft({ ...draft, postal_code: event.target.value })
          }
        />
      </label>
      <label>
        Telephone contact
        <input
          value={draft.contact_phone_number}
          onChange={(event) =>
            setDraft({ ...draft, contact_phone_number: event.target.value })
          }
        />
      </label>
      <label>
        SIRET
        <input
          value={draft.siret}
          onChange={(event) => setDraft({ ...draft, siret: event.target.value })}
        />
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
