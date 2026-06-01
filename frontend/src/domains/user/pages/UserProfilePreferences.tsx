/**Page permettant à l'utilisateur de modifier ses préférences depuis son profil */

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

import PreferencesGrid from "../components/PreferencesGrid";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { ROUTES } from "../../../shared/constants/routes";
import Button from "../../../shared/components/ui/Button";

export default function UserProfilePreferences() {
  const navigate = useNavigate();

  /**Utilisateur connecté */
  const user = useAuthStore((s) => s.currentUser);

  /**Mise à jour des stores */
  const updateUser = useDataStore((s) => s.updateUser);
  const updateAuthUser = useAuthStore((s) => s.updateUser);

  /**Initialisation avec les préférences actuelles */
  const { preferences, toggle } = useUserPreferences(user?.preferences ?? []);

  /**Sauvegarde des préférences */
  function handleSave() {
    if (!user) return;

    /**Update dans le store globale (source de vérité) */
    updateUser(user.id, { preferences });

    /**Update du user connecté (UI immédiate)*/
    updateAuthUser({ ...user, preferences });

    toast.success("Préférences mises à jour");
    navigate(ROUTES.USER.PROFILE);
  }

  return (
    <div>
      <h1>Mes préférences</h1>
      <PreferencesGrid selected={preferences} toggle={toggle} />
      <div
        style={{
          marginTop: "20px",
          display: "flex",
          justifyContent: "center",
          gap: "20px",
        }}
      >
        <Button onClick={handleSave}>Enregistrer</Button>
        <Button onClick={() => navigate(ROUTES.USER.PROFILE)}>Annuler</Button>
      </div>
    </div>
  );
}
