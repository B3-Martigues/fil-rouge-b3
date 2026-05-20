import { useState } from "react";
import { toast } from "react-toastify";

import { EVENT_CATEGORIES, type Event } from "../../events/types/event-categories";
import type { Company } from "../../companies/types/company";
import type { Role, User } from "../../user/types/user";
import useDataStore from "../../../shared/store/dataStore";

type UserDraft = Pick<User, "username" | "email" | "password" | "role" | "is_active">;
type CompanyDraft = Pick<
  Company,
  "name" | "email" | "description" | "website" | "address" | "logo" | "siret"
> & {
  phone_number: string;
};
type EventDraft = Omit<
  Event,
  "id" | "latitude" | "longitude" | "company_id" | "postal_code" | "created_at" | "updated_at"
> & {
  latitude: string;
  longitude: string;
  company_id: string;
  postal_code: string;
};
type AdminView = "dashboard" | "accounts" | "events";

type AdminDashboardProps = {
  view?: AdminView;
};
type AccountStatusFilter = "all" | "active" | "pending";
type AccountSort = "username-asc" | "username-desc" | "role-asc";
type EventSort = "date-asc" | "date-desc" | "title-asc" | "title-desc" | "city-asc";

const roleOptions: Role[] = ["user", "admin", "company"];

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatPhoneNumber = (phoneNumber: number) =>
  phoneNumber.toString().padStart(10, "0").replace(/(\d{2})(?=\d)/g, "$1 ");

const toUserDraft = (user: User): UserDraft => ({
  username: user.username,
  email: user.email,
  password: user.password,
  role: user.role,
  is_active: user.is_active,
});

const toCompanyDraft = (company: Company): CompanyDraft => ({
  name: company.name,
  email: company.email,
  description: company.description,
  website: company.website,
  address: company.address,
  logo: company.logo,
  phone_number: company.phone_number.toString().padStart(10, "0"),
  siret: company.siret,
});

const toEventDraft = (event: Event): EventDraft => ({
  title: event.title,
  description: event.description,
  date: event.date.slice(0, 16),
  latitude: String(event.latitude),
  longitude: String(event.longitude),
  address: event.address ?? "",
  category: event.category,
  categories: event.categories ?? [event.category],
  city: event.city ?? "",
  postal_code: event.postal_code?.toString() ?? "",
  image: event.image ?? "",
  source:
    event.source === "company" || event.source === "Entreprise"
      ? "Évènement créé par une entreprise"
      : event.source ?? "",
  company_id: event.company_id?.toString() ?? "",
  is_approved: event.is_approved ?? true,
});

const emptyEventDraft = (): EventDraft => ({
  title: "",
  description: "",
  date: "",
  latitude: "",
  longitude: "",
  address: "",
  category: "culture",
  categories: ["culture"],
  city: "",
  postal_code: "",
  image: "",
  source: "",
  company_id: "",
  is_approved: true,
});

const emptyUserDraft = (): UserDraft => ({
  username: "",
  email: "",
  password: "",
  role: "user",
  is_active: true,
});

const getEventCategories = (event: Event) =>
  event.categories && event.categories.length > 0 ? event.categories : [event.category];

const toggleEventDraftCategory = (
  draft: EventDraft,
  category: Event["category"],
): EventDraft => {
  const currentCategories = draft.categories ?? [draft.category];
  const nextCategories = currentCategories.includes(category)
    ? currentCategories.filter((item) => item !== category)
    : [...currentCategories, category];

  return {
    ...draft,
    category: nextCategories[0] ?? draft.category,
    categories: nextCategories,
  };
};

export default function AdminDashboard({ view = "dashboard" }: AdminDashboardProps) {
  const usersData = useDataStore((s) => s.users);
  const companiesData = useDataStore((s) => s.companies);
  const eventsData = useDataStore((s) => s.events);
  const addUser = useDataStore((s) => s.addUser);
  const updateUser = useDataStore((s) => s.updateUser);
  const deleteUserFromStore = useDataStore((s) => s.deleteUser);
  const updateCompany = useDataStore((s) => s.updateCompany);
  const activateCompanyInStore = useDataStore((s) => s.activateCompany);
  const addEvent = useDataStore((s) => s.addEvent);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const approveEventInStore = useDataStore((s) => s.approveEvent);
  const deleteEventFromStore = useDataStore((s) => s.deleteEvent);

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
    useState<Event["category"] | "all">("all");
  const [eventCityFilter, setEventCityFilter] = useState("all");
  const [eventSort, setEventSort] = useState<EventSort>("date-asc");

  const users = usersData.filter((user) => user.role === "user");
  const admins = usersData.filter((user) => user.role === "admin");
  const companies = usersData.filter((user) => user.role === "company");
  const pendingCompanies = companiesData.filter((company) => !company.is_active);
  const pendingEvents = eventsData.filter((event) => event.is_approved === false);
  const getCompanyName = (companyId?: number | null) =>
    companiesData.find((company) => company.id === companyId)?.name ?? "Non rattache";

  const activateCompany = (companyId: number) => {
    const company = companiesData.find((item) => item.id === companyId);
    const companyUser = usersData.find((user) => user.id === companyId);

    if (!company || !companyUser) {
      toast.error("Entreprise introuvable");
      return;
    }

    activateCompanyInStore(companyId);
    toast.success(`${company.name} est maintenant activee`);
  };

  const startCompanyEdit = (company: Company) => {
    setEditingCompanyId(company.id);
    setCompanyDraft(toCompanyDraft(company));
  };

  const saveCompany = () => {
    if (!editingCompanyId || !companyDraft) return;

    const company = companiesData.find((item) => item.id === editingCompanyId);
    const companyUser = usersData.find((user) => user.id === editingCompanyId);

    if (!company || !companyUser) {
      toast.error("Entreprise introuvable");
      return;
    }

    updateCompany(editingCompanyId, {
      name: companyDraft.name,
      email: companyDraft.email,
      description: companyDraft.description,
      website: companyDraft.website,
      address: companyDraft.address,
      logo: companyDraft.logo,
      phone_number: Number(companyDraft.phone_number),
      siret: companyDraft.siret,
    });

    setEditingCompanyId(null);
    setCompanyDraft(null);
    toast.success("Entreprise mise a jour");
  };

  const deleteCompany = (companyId: number) => {
    const deletedCompany = companiesData.find((company) => company.id === companyId);
    if (!deletedCompany) return;

    deleteUserFromStore(companyId);
    setEditingCompanyId(null);
    setCompanyDraft(null);
    toast.success(`${deletedCompany.name} supprimee`);
  };

  const startUserEdit = (user: User) => {
    setIsCreatingUser(false);
    setEditingUserId(user.id);
    setUserDraft(toUserDraft(user));
  };

  const startUserCreate = () => {
    setEditingUserId(null);
    setIsCreatingUser(true);
    setUserDraft(emptyUserDraft());
  };

  const saveUser = () => {
    if (!userDraft) return;

    if (isCreatingUser) {
      addUser({
        id: Date.now(),
        username: userDraft.username,
        email: userDraft.email,
        password: userDraft.password,
        role: userDraft.role,
        is_active: userDraft.is_active,
        preferences: {
          jour: false,
          culture: false,
          musique: false,
          art: false,
          tourisme: false,
          associatif: false,
          famille: false,
          sport: false,
        },
      });

      setIsCreatingUser(false);
      setUserDraft(null);
      toast.success("Compte cree");
      return;
    }

    if (!editingUserId) return;

    const user = usersData.find((item) => item.id === editingUserId);
    if (!user) return;

    updateUser(editingUserId, userDraft);

    setEditingUserId(null);
    setUserDraft(null);
    toast.success("Compte mis a jour");
  };

  const deleteUser = (userId: number) => {
    const deletedUser = usersData.find((user) => user.id === userId);
    if (!deletedUser) return;

    deleteUserFromStore(userId);
    setEditingUserId(null);
    toast.success(`${deletedUser.username} supprime`);
  };

  const startEventEdit = (event: Event) => {
    setIsCreatingEvent(false);
    setEditingEventId(event.id);
    setEventDraft(toEventDraft(event));
  };

  const startEventCreate = () => {
    setEditingEventId(null);
    setIsCreatingEvent(true);
    setEventDraft(emptyEventDraft());
  };

  const saveEvent = () => {
    if (!eventDraft) return;

    const payload: Omit<Event, "id"> = {
      title: eventDraft.title,
      description: eventDraft.description,
      date: new Date(eventDraft.date).toISOString(),
      latitude: Number(eventDraft.latitude),
      longitude: Number(eventDraft.longitude),
      address: eventDraft.address?.trim() || undefined,
      category: (eventDraft.categories?.[0] ?? eventDraft.category) as Event["category"],
      categories: eventDraft.categories,
      city: eventDraft.city?.trim() || undefined,
      postal_code: eventDraft.postal_code ? Number(eventDraft.postal_code) : undefined,
      image: eventDraft.image || undefined,
      source: eventDraft.source || undefined,
      company_id: eventDraft.company_id ? Number(eventDraft.company_id) : null,
      is_approved: eventDraft.is_approved,
    };

    if (isCreatingEvent) {
      addEvent({ id: Date.now(), ...payload });
      toast.success("Évènement cree");
    } else if (editingEventId) {
      const event = eventsData.find((item) => item.id === editingEventId);
      if (!event) return;
      updateEvent(editingEventId, payload);
      toast.success("Évènement mis a jour");
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
      toast.error("Évènement introuvable");
      return;
    }

    approveEventInStore(eventId);
    toast.success(`${event.title} est maintenant visible`);
  };

  const stats = [
    { label: "Évènements", value: eventsData.length },
    { label: "Utilisateurs", value: users.length },
    { label: "Entreprises", value: companies.length },
    { label: "Administrateurs", value: admins.length },
    { label: "Entreprises en attente", value: pendingCompanies.length },
    { label: "Évènements en attente", value: pendingEvents.length },
  ];

  const isDashboardView = view === "dashboard";
  const isAccountsView = view === "accounts";
  const isEventsView = view === "events";
  const filteredUsers = usersData
    .filter((user) => {
      const matchesSearch = normalizeText(
        [user.username, user.email, user.role].join(" "),
      ).includes(normalizeText(accountSearch));
      const matchesRole =
        accountRoleFilter === "all" || user.role === accountRoleFilter;
      const matchesStatus =
        accountStatusFilter === "all" ||
        (accountStatusFilter === "active" && user.is_active) ||
        (accountStatusFilter === "pending" && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((firstUser, secondUser) => {
      if (accountSort === "username-desc") {
        return secondUser.username.localeCompare(firstUser.username, "fr-FR");
      }

      if (accountSort === "role-asc") {
        return firstUser.role.localeCompare(secondUser.role, "fr-FR");
      }

      return firstUser.username.localeCompare(secondUser.username, "fr-FR");
    });
  const eventCities = Array.from(
    new Set(
      eventsData
        .map((event) => event.city?.trim())
        .filter((city): city is string => Boolean(city)),
    ),
  ).sort((firstCity, secondCity) => firstCity.localeCompare(secondCity, "fr-FR"));
  const filteredEvents = eventsData
    .filter((event) => {
      const matchesSearch = normalizeText(
        [
          event.title,
          event.description,
          getEventCategories(event).join(" "),
          event.address ?? "",
          event.city ?? "",
          event.postal_code?.toString() ?? "",
          event.source ?? "",
        ].join(" "),
      ).includes(normalizeText(eventSearch));
      const matchesCategory =
        eventCategoryFilter === "all" ||
        getEventCategories(event).includes(eventCategoryFilter);
      const matchesCity = eventCityFilter === "all" || event.city === eventCityFilter;

      return matchesSearch && matchesCategory && matchesCity;
    })
    .sort((firstEvent, secondEvent) => {
      if (eventSort === "date-desc") {
        return (
          new Date(secondEvent.date).getTime() - new Date(firstEvent.date).getTime()
        );
      }

      if (eventSort === "title-asc") {
        return firstEvent.title.localeCompare(secondEvent.title, "fr-FR");
      }

      if (eventSort === "title-desc") {
        return secondEvent.title.localeCompare(firstEvent.title, "fr-FR");
      }

      if (eventSort === "city-asc") {
        return (firstEvent.city ?? "").localeCompare(secondEvent.city ?? "", "fr-FR");
      }

      return (
        new Date(firstEvent.date).getTime() - new Date(secondEvent.date).getTime()
      );
    });

  return (
    <div className="admin-panel">
      <section className="admin-panel__header">
        <div className="admin-panel__heading">
          <h2>
            {isDashboardView && "Pannel administrateur"}
            {isAccountsView && "Comptes"}
            {isEventsView && "Évènements"}
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
          {isDashboardView && "Statistiques et validation des entreprises"}
          {isAccountsView && "Gestion des comptes utilisateurs, entreprises et administrateurs"}
          {isEventsView && "Gestion des évènements publiés"}
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
              <h2>Entreprises à vérifier</h2>
              <span className="admin-count">{pendingCompanies.length}</span>
            </div>

            {pendingCompanies.length === 0 ? (
              <p className="admin-empty">Aucune entreprise en attente.</p>
            ) : (
              <div className="company-review-list">
                {pendingCompanies.map((company) => (
              <article className="company-review" key={company.id}>
                <div className="company-review__media">
                  <img src={company.logo} alt={`Logo ${company.name}`} />
                </div>

                <div className="company-review__content">
                  {editingCompanyId === company.id && companyDraft ? (
                    <div className="admin-form-grid">
                      <label>
                        Nom
                        <input
                          value={companyDraft.name}
                          onChange={(event) =>
                            setCompanyDraft({ ...companyDraft, name: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          value={companyDraft.email}
                          onChange={(event) =>
                            setCompanyDraft({ ...companyDraft, email: event.target.value })
                          }
                        />
                      </label>
                      <label className="admin-form-grid__wide">
                        Description
                        <textarea
                          rows={3}
                          value={companyDraft.description}
                          onChange={(event) =>
                            setCompanyDraft({
                              ...companyDraft,
                              description: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Site web
                        <input
                          value={companyDraft.website}
                          onChange={(event) =>
                            setCompanyDraft({
                              ...companyDraft,
                              website: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Logo
                        <input
                          value={companyDraft.logo}
                          onChange={(event) =>
                            setCompanyDraft({ ...companyDraft, logo: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Telephone
                        <input
                          value={companyDraft.phone_number}
                          onChange={(event) =>
                            setCompanyDraft({
                              ...companyDraft,
                              phone_number: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        SIRET
                        <input
                          value={companyDraft.siret}
                          onChange={(event) =>
                            setCompanyDraft({ ...companyDraft, siret: event.target.value })
                          }
                        />
                      </label>
                      <label className="admin-form-grid__wide">
                        Adresse
                        <input
                          value={companyDraft.address}
                          onChange={(event) =>
                            setCompanyDraft({
                              ...companyDraft,
                              address: event.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="admin-actions admin-form-grid__wide">
                        <button className="btn" type="button" onClick={saveCompany}>
                          Enregistrer
                        </button>
                        <button
                          className="btn btn--secondary"
                          type="button"
                          onClick={() => {
                            setEditingCompanyId(null);
                            setCompanyDraft(null);
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
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
                          <dt>Email</dt>
                          <dd>{company.email}</dd>
                        </div>
                        <div>
                          <dt>SIRET</dt>
                          <dd>{company.siret}</dd>
                        </div>
                        <div>
                          <dt>Telephone</dt>
                          <dd>{formatPhoneNumber(company.phone_number)}</dd>
                        </div>
                        <div>
                          <dt>Adresse</dt>
                          <dd>{company.address}</dd>
                        </div>
                        <div>
                          <dt>Site web</dt>
                          <dd>
                            <a href={company.website} target="_blank" rel="noreferrer">
                              {company.website}
                            </a>
                          </dd>
                        </div>
                        <div>
                          <dt>Inscription</dt>
                          <dd>
                            {new Date(company.created_at).toLocaleDateString("fr-FR")}
                          </dd>
                        </div>
                      </dl>

                      <div className="company-review__footer">
                        <div className="company-review__categories">
                          {company.categories.map((category) => (
                            <span className="admin-badge" key={category.slug}>
                              {category.name}
                            </span>
                          ))}
                        </div>

                        <div className="admin-actions">
                          <button
                            className="btn btn--secondary"
                            type="button"
                            onClick={() => startCompanyEdit(company)}
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
                          <button
                            className="btn"
                            type="button"
                            onClick={() => activateCompany(company.id)}
                          >
                            Valider et activer
                          </button>
                        </div>
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
              <h2>Évènements à verifier</h2>
              <span className="admin-count">{pendingEvents.length}</span>
            </div>

            {pendingEvents.length === 0 ? (
              <p className="admin-empty">Aucun évènement en attente.</p>
            ) : (
              <div className="company-review-list">
                {pendingEvents.map((event) => (
                  <article className="company-review" key={event.id}>
                    <div className="company-review__media">
                      {event.image && <img src={event.image} alt={`Visuel ${event.title}`} />}
                    </div>

                    <div className="company-review__content">
                      {editingEventId === event.id && eventDraft ? (
                        <div className="admin-form-grid">
                          <label>
                            Titre
                            <input
                              value={eventDraft.title}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  title: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="admin-form-grid__wide">
                            <span className="form-field-label">Categories</span>
                            <div className="categories-select">
                              {EVENT_CATEGORIES.map((category) => (
                                <label className="categories-select__option" key={category}>
                                  <input
                                    type="checkbox"
                                    checked={(
                                      eventDraft.categories ?? [eventDraft.category]
                                    ).includes(category)}
                                    onChange={() =>
                                      setEventDraft(
                                        toggleEventDraftCategory(eventDraft, category),
                                      )
                                    }
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
                              value={eventDraft.description}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  description: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Date
                            <input
                              type="datetime-local"
                              value={eventDraft.date}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  date: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Entreprise ID
                            <input
                              value={eventDraft.company_id}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  company_id: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="admin-form-grid__wide">
                            Adresse
                            <input
                              value={eventDraft.address}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  address: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Ville
                            <input
                              value={eventDraft.city}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  city: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Code postal
                            <input
                              inputMode="numeric"
                              value={eventDraft.postal_code}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  postal_code: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Latitude
                            <input
                              value={eventDraft.latitude}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  latitude: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Longitude
                            <input
                              value={eventDraft.longitude}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  longitude: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Image
                            <input
                              value={eventDraft.image}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  image: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Source
                            <input
                              value={eventDraft.source}
                              onChange={(inputEvent) =>
                                setEventDraft({
                                  ...eventDraft,
                                  source: inputEvent.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="admin-actions admin-form-grid__wide">
                            <button className="btn" type="button" onClick={saveEvent}>
                              Enregistrer
                            </button>
                            <button
                              className="btn btn--secondary"
                              type="button"
                              onClick={() => {
                                setEditingEventId(null);
                                setEventDraft(null);
                              }}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
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
                              <dt>Date</dt>
                              <dd>{new Date(event.date).toLocaleString("fr-FR")}</dd>
                            </div>
                            <div>
                              <dt>Adresse</dt>
                              <dd>{event.address ?? "Non renseignee"}</dd>
                            </div>
                            <div>
                              <dt>Ville</dt>
                              <dd>{event.city ?? "Non renseignee"}</dd>
                            </div>
                            <div>
                              <dt>Code postal</dt>
                              <dd>{event.postal_code ?? "Non renseigne"}</dd>
                            </div>
                            <div>
                              <dt>Coordonnees</dt>
                              <dd>
                                {event.latitude}, {event.longitude}
                              </dd>
                            </div>
                            <div>
                              <dt>Entreprise</dt>
                              <dd>{getCompanyName(event.company_id)}</dd>
                            </div>
                            <div>
                              <dt>Source</dt>
                              <dd>{event.source ?? "Non renseignee"}</dd>
                            </div>
                            <div>
                              <dt>Date de creation</dt>
                              <dd>
                                {event.created_at
                                  ? new Date(event.created_at).toLocaleString("fr-FR")
                                  : "Non renseignee"}
                              </dd>
                            </div>
                          </dl>

                          <div className="company-review__footer">
                            <div className="company-review__categories">
                              {getEventCategories(event).map((category) => (
                                <span className="admin-badge" key={category}>
                                  {category}
                                </span>
                              ))}
                            </div>

                            <div className="admin-actions">
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
                              <button
                                className="btn"
                                type="button"
                                onClick={() => approveEvent(event.id)}
                              >
                                Valider
                              </button>
                            </div>
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
            <div className="admin-inline-editor admin-create-form">
              <input
                placeholder="Nom"
                value={userDraft.username}
                onChange={(event) =>
                  setUserDraft({ ...userDraft, username: event.target.value })
                }
              />
              <input
                type="email"
                placeholder="Email"
                value={userDraft.email}
                onChange={(event) =>
                  setUserDraft({ ...userDraft, email: event.target.value })
                }
              />
              <input
                placeholder="Mot de passe"
                value={userDraft.password}
                onChange={(event) =>
                  setUserDraft({ ...userDraft, password: event.target.value })
                }
              />
              <select
                value={userDraft.role}
                onChange={(event) =>
                  setUserDraft({
                    ...userDraft,
                    role: event.target.value as Role,
                  })
                }
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={userDraft.is_active}
                  onChange={(event) =>
                    setUserDraft({
                      ...userDraft,
                      is_active: event.target.checked,
                    })
                  }
                />
                Actif
              </label>
              <div className="admin-actions">
                <button className="btn" type="button" onClick={saveUser}>
                  Creer
                </button>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => {
                    setIsCreatingUser(false);
                    setUserDraft(null);
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
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
                {roleOptions.map((role) => (
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
                onChange={(event) => setAccountSort(event.target.value as AccountSort)}
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
              <div className="admin-table__row" role="row" key={user.id}>
                {editingUserId === user.id && userDraft ? (
                  <div className="admin-inline-editor">
                    <input
                      value={userDraft.username}
                      onChange={(event) =>
                        setUserDraft({ ...userDraft, username: event.target.value })
                      }
                    />
                    <input
                      type="email"
                      value={userDraft.email}
                      onChange={(event) =>
                        setUserDraft({ ...userDraft, email: event.target.value })
                      }
                    />
                    <input
                      value={userDraft.password}
                      onChange={(event) =>
                        setUserDraft({ ...userDraft, password: event.target.value })
                      }
                    />
                    <select
                      value={userDraft.role}
                      onChange={(event) =>
                        setUserDraft({
                          ...userDraft,
                          role: event.target.value as Role,
                        })
                      }
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <label className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={userDraft.is_active}
                        onChange={(event) =>
                          setUserDraft({
                            ...userDraft,
                            is_active: event.target.checked,
                          })
                        }
                      />
                      Actif
                    </label>
                    <div className="admin-actions">
                      <button className="btn" type="button" onClick={saveUser}>
                        Sauver
                      </button>
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={() => setEditingUserId(null)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span>{user.username}</span>
                    <span>{user.email}</span>
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
                        onClick={() => deleteUser(user.id)}
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
            <div className="admin-form-grid admin-event-form">
              <label>
                Titre
                <input
                  value={eventDraft.title}
                  onChange={(event) =>
                    setEventDraft({ ...eventDraft, title: event.target.value })
                  }
                />
              </label>
              <div className="admin-form-grid__wide">
                <span className="form-field-label">Categories</span>
                <div className="categories-select">
                  {EVENT_CATEGORIES.map((category) => (
                    <label className="categories-select__option" key={category}>
                      <input
                        type="checkbox"
                        checked={(eventDraft.categories ?? [eventDraft.category]).includes(
                          category,
                        )}
                        onChange={() =>
                          setEventDraft(toggleEventDraftCategory(eventDraft, category))
                        }
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
                  value={eventDraft.description}
                  onChange={(event) =>
                    setEventDraft({
                      ...eventDraft,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Date
                <input
                  type="datetime-local"
                  value={eventDraft.date}
                  onChange={(event) =>
                    setEventDraft({ ...eventDraft, date: event.target.value })
                  }
                />
              </label>
              <label>
                Entreprise ID
                <input
                  value={eventDraft.company_id}
                  onChange={(event) =>
                    setEventDraft({
                      ...eventDraft,
                      company_id: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Ville
                <input
                  value={eventDraft.city}
                  onChange={(event) =>
                    setEventDraft({
                      ...eventDraft,
                      city: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Code postal
                <input
                  inputMode="numeric"
                  value={eventDraft.postal_code}
                  onChange={(event) =>
                    setEventDraft({
                      ...eventDraft,
                      postal_code: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Latitude
                <input
                  value={eventDraft.latitude}
                  onChange={(event) =>
                    setEventDraft({
                      ...eventDraft,
                      latitude: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Longitude
                <input
                  value={eventDraft.longitude}
                  onChange={(event) =>
                    setEventDraft({
                      ...eventDraft,
                      longitude: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Image
                <input
                  value={eventDraft.image}
                  onChange={(event) =>
                    setEventDraft({ ...eventDraft, image: event.target.value })
                  }
                />
              </label>
              <label>
                Source
                <input
                  value={eventDraft.source}
                  onChange={(event) =>
                    setEventDraft({ ...eventDraft, source: event.target.value })
                  }
                />
              </label>
              <div className="admin-actions admin-form-grid__wide">
                <button className="btn" type="button" onClick={saveEvent}>
                  Enregistrer
                </button>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => {
                    setEditingEventId(null);
                    setIsCreatingEvent(false);
                    setEventDraft(null);
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div className="admin-toolbar" aria-label="Filtres des évènements">
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
                  setEventCategoryFilter(event.target.value as Event["category"] | "all")
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
                <option value="date-asc">Date croissante</option>
                <option value="date-desc">Date decroissante</option>
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
            <div className="admin-table admin-table--events" role="table" aria-label="Évènements">
              {filteredEvents.map((event) => (
              <div className="admin-table__row" role="row" key={event.id}>
                <span>{event.title}</span>
                <span>{getEventCategories(event).join(", ")}</span>
                <span>{event.city ?? "Ville non renseignee"}</span>
                <span>{new Date(event.date).toLocaleDateString("fr-FR")}</span>
                <span
                  className={`admin-status ${
                    event.is_approved === false ? "" : "admin-status--active"
                  }`}
                >
                  {event.is_approved === false ? "En attente" : "Validé"}
                </span>
                <div className="admin-actions">
                  <button
                    className="btn btn--secondary"
                    type="button"
                    onClick={() => startEventEdit(event)}
                  >
                    Modifier
                  </button>
                  {event.is_approved === false && (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => approveEvent(event.id)}
                    >
                      Valider
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
