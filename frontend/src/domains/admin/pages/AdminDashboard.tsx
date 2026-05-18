/**
 * Tableau de bord administrateur.
 */

import { usersMock } from "../../auth/mocks/users.mock";
import { eventsMock } from "../../events/mocks/events.mock";

export default function AdminDashboard() {
  const users = usersMock.filter((user) => user.role === "user");
  const admins = usersMock.filter((user) => user.role === "admin");
  const companies = usersMock.filter((user) => user.role === "company");
  const pendingCompanies = companies.filter((company) => !company.is_active);

  const stats = [
    { label: "Utilisateurs", value: users.length },
    { label: "Administrateurs", value: admins.length },
    { label: "Entreprises", value: companies.length },
    { label: "En attente", value: pendingCompanies.length },
    { label: "Evenements", value: eventsMock.length },
  ];

  return (
    <div className="admin-panel">
      <section className="admin-panel__header">
        <h1>Panel admin</h1>
        <p>Gestion des utilisateurs, entreprises et evenements</p>
      </section>

      <section className="admin-panel__stats" aria-label="Statistiques admin">
        {stats.map((stat) => (
          <article className="admin-stat" key={stat.label}>
            <span className="admin-stat__value">{stat.value}</span>
            <span className="admin-stat__label">{stat.label}</span>
          </article>
        ))}
      </section>

      <section className="admin-panel__grid">
        <article className="admin-section">
          <h2>Comptes</h2>
          <div className="admin-table" role="table" aria-label="Comptes">
            {usersMock.map((user) => (
              <div className="admin-table__row" role="row" key={user.id}>
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
              </div>
            ))}
          </div>
        </article>

        <article className="admin-section">
          <h2>Evenements</h2>
          <div className="admin-table" role="table" aria-label="Evenements">
            {eventsMock.map((event) => (
              <div className="admin-table__row" role="row" key={event.id}>
                <span>{event.title}</span>
                <span>{event.category}</span>
                <span>{new Date(event.date).toLocaleDateString("fr-FR")}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
