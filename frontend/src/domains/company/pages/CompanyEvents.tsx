import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import { EVENT_CATEGORIES, type Event } from "../../events/types/category";
import useDataStore from "../../../shared/store/dataStore";
import { ROUTES } from "../../../shared/constants/routes";
import { useCompanyAccess } from "../hooks/useCompanyAccess";

type EventDraft = Omit<
  Event,
  "id" | "latitude" | "longitude" | "company_id" | "created_at" | "updated_at"
> & {
  latitude: string;
  longitude: string;
};

const toEventDraft = (event: Event): EventDraft => ({
  title: event.title,
  description: event.description,
  date: event.date.slice(0, 16),
  latitude: String(event.latitude),
  longitude: String(event.longitude),
  address: event.address ?? "",
  category: event.category,
  image: event.image ?? "",
  source: event.source ?? "",
});

export default function CompanyEvents() {
  const { isPendingApproval } = useCompanyAccess();
  const currentUser = useAuthStore((s) => s.currentUser);
  const events = useDataStore((s) => s.events);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const deleteEventFromStore = useDataStore((s) => s.deleteEvent);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft | null>(null);

  const companyEvents = events.filter((event) => event.company_id === currentUser?.id);

  const startEdit = (event: Event) => {
    setEditingEventId(event.id);
    setEventDraft(toEventDraft(event));
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEventDraft(null);
  };

  const saveEvent = () => {
    if (!editingEventId || !eventDraft || !currentUser) return;
    const originalEvent = companyEvents.find((event) => event.id === editingEventId);

    if (!originalEvent) return;

    if (!eventDraft.title.trim() || !eventDraft.date) {
      toast.error("Le titre et la date sont obligatoires");
      return;
    }

    updateEvent(editingEventId, {
      title: eventDraft.title.trim(),
      description: eventDraft.description.trim(),
      date: new Date(eventDraft.date).toISOString(),
      latitude: Number(eventDraft.latitude),
      longitude: Number(eventDraft.longitude),
      address: eventDraft.address?.trim() || undefined,
      category: eventDraft.category,
      image: eventDraft.image?.trim() || undefined,
      source: eventDraft.source?.trim() || "company",
      company_id: currentUser.id,
      created_at: originalEvent.created_at,
      updated_at: new Date().toISOString(),
    });

    cancelEdit();
    toast.success("Évènement mis a jour");
  };

  const deleteEvent = (eventId: number) => {
    const deletedEvent = companyEvents.find((event) => event.id === eventId);
    if (!deletedEvent) return;

    deleteEventFromStore(eventId);
    cancelEdit();
    toast.success(`${deletedEvent.title} supprime`);
  };

  if (isPendingApproval) {
    return (
      <div className="company-dashboard">
        <h2>Votre compte est en attente de validation</h2>
        <p>
          Votre compte doit etre valide par un administrateur avant de pouvoir
          gerer des évènements.
        </p>
      </div>
    );
  }

  return (
    <div className="company-dashboard">
      <section className="company-dashboard__header">
        <h2>Mes évènements</h2>
        <p>Consultez, modifiez ou supprimez les évènements de votre entreprise.</p>
      </section>

      <section className="company-events" aria-labelledby="company-events-title">
        <h2 id="company-events-title">Liste des évènements</h2>

        {companyEvents.length === 0 ? (
          <p className="admin-empty">Aucun évènement cree pour le moment.</p>
        ) : (
          <div className="company-events__list">
            {companyEvents.map((event) => (
              <article className="company-event" key={event.id}>
                {editingEventId === event.id && eventDraft ? (
                  <div className="company-event-editor">
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

                    <label>
                      Categorie
                      <select
                        value={eventDraft.category}
                        onChange={(inputEvent) =>
                          setEventDraft({
                            ...eventDraft,
                            category: inputEvent.target.value as Event["category"],
                          })
                        }
                      >
                        {EVENT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="company-event-editor__wide">
                      Description
                      <textarea
                        rows={4}
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
                      Latitude
                      <input
                        type="number"
                        step="any"
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
                        type="number"
                        step="any"
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

                    <div className="admin-actions company-event-editor__wide">
                      <button className="btn" type="button" onClick={saveEvent}>
                        Enregistrer
                      </button>
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={cancelEdit}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <h3>{event.title}</h3>
                      <p>{event.description}</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Date</dt>
                        <dd>{new Date(event.date).toLocaleString("fr-FR")}</dd>
                      </div>
                      <div>
                        <dt>Categorie</dt>
                        <dd>{event.category}</dd>
                      </div>
                      <div>
                        <dt>Adresse</dt>
                        <dd>{event.address ?? "Non renseignee"}</dd>
                      </div>
                    </dl>
                    <div className="admin-actions">
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={() => startEdit(event)}
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
              </article>
            ))}
          </div>
        )}
        <Link className="btn" to={ROUTES.COMPANY.CREATE}>
          Ajouter un nouvel évènement
        </Link>
      </section>
    </div>
  );
}
