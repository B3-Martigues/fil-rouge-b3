/**
 * Page de profil utilisateur.
 */

import useAuthStore from "../../auth/store/authStore";

export default function Profile() {
  const user = useAuthStore((s) => s.currentUser);

  return (
    <div>
      <h1>Page profil utilisateur</h1>
      <p>Bienvenue {user?.username}</p>
    </div>
  );
}
