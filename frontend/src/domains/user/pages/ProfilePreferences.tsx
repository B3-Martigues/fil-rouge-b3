/**Page permettant à l'utilisateur de modifier ses préférences depuis son profil */

import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

import PreferencesGrid from "../components/PreferencesGrid";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { ROUTES } from "../../../shared/constants/routes";
import Button from "../../../shared/components/ui/Button";

export default function ProfilePreferences() {
  const navigate = useNavigate();

  /**Utilisateur connecté */
  const user = useAuthStore((s) => s.currentUser);

  /**Mise à jour des stores */
  const preferencesStore = useDataStore((s) => s.userEventPreferences);
  const setUserEventPreferences = useDataStore(
    (s) => s.setUserEventPreferences,
  );

  if (!user) return null;

  const initial = preferencesStore
    .filter((p) => p.user_id === user.id)
    .map((p) => p.category_slug);

  const { preferences, toggle } = useUserPreferences(initial);

  /**Sauvegarde des préférences */
  function handleSave() {
    if (!user) return;

    setUserEventPreferences(user.id, preferences);

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
