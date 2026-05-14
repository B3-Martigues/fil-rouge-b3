/**Page de profil entreprise */

import useAuthStore from "../../auth/store/authStore";

export default function CompanyProfile() {
    /**Utilisateur actuellement connecté */
  const user = useAuthStore((s) => s.currentUser);

  return (
    <div>
      <h1>Profil entreprise</h1>
      <p>Bienvenue {user?.username} </p>
    </div>
  );
}
