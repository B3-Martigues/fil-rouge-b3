import { useNavigate } from "react-router-dom";
import PreferencesGrid from "../components/PreferencesGrid";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { ROUTES } from "../../../shared/constants/routes";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";

/**Page d'onboarding pour choisir les préférences utilisateur */
export default function Onboarding() {
  const navigate = useNavigate();
  const { preferences, toggle } = useUserPreferences([]);
  const user = useAuthStore((s) => s.currentUser);
  const setUserEventPreferences = useDataStore(
    (s) => s.setUserEventPreferences,
  );

  /**Sauvegarde les préférences et redirige vers l'accueil */
  const handleSave = () => {
    if (!user) return;

    setUserEventPreferences(user.id, preferences);
    navigate(ROUTES.PUBLIC.HOME);
  };
  return (
    <div>
      <h1>Choisis tes centres d'intérêt</h1>
      <PreferencesGrid selected={preferences} toggle={toggle} />
      <button onClick={handleSave}>Continuer</button>
    </div>
  );
}
