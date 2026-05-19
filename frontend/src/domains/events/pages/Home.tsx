/**
 * Page d'accueil publique.
 * Affiche la carte et la recherche d'événements.
 */

import EventMap from "../components/EventMap";

export default function Home() {
  return (
    <div>
      <h1>Bienvenue sur la carte des événements</h1>
      <p>Explorez les événements autour de vous.</p>
      <EventMap />
    </div>
  );
}
