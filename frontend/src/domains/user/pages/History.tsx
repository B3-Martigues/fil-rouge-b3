/**
 * Page d'historic utilisateur.
 */

import useAuthStore from "../../auth/store/authStore";

export default function History() {
  const user = useAuthStore((s) => s.currentUser);

  return (
    <div>
      <h1>Page d'historique</h1>
      <p>Bienvenue {user?.username}</p>
    </div>
  );
}
