import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";

export default function NotFound() {
  return (
    <main className="not-found" aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page introuvable</h1>
      <p>Cette adresse ne correspond a aucune page de Mappening.</p>
      <Link className="btn" to={ROUTES.PUBLIC.HOME}>
        Retour a l'accueil
      </Link>
    </main>
  );
}
