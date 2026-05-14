/**
 * Page de favoris utilisateur.
 */

import useAuthStore from "../../auth/store/authStore";

export default function Favorites() {
  const user = useAuthStore((s) => s.currentUser);

  return (
    <div>
      <h1>Page de favoris</h1>
      <p>Bienvenue {user?.username}</p>
    </div>
  );
}
