import { useNavigate } from "react-router-dom";
import PreferencesGrid from "../components/PreferencesGrid";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { ROUTES } from "../../../shared/constants/routes";
import useAuthStore from "../../auth/store/authStore";
import useDataStore from "../../../shared/store/dataStore";
import type { EventCategory } from "../../events/types/event-categories";

/**Page d'onboarding pour choisir les préférences utilisateur */
export default function Onboarding() {
  const navigate = useNavigate();
  const { preferences, toggle } = useUserPreferences([]);
  const user = useAuthStore((s) => s.currentUser);
  const setUserEventPreferences = useDataStore(
    (s) => s.setUserEventPreferences,
  );

  const buildPreferences = (userId: number, categories: EventCategory[]) => {
    return categories.map((cat, index) => ({
      id: Date.now() + index,
      user_id: userId,
      event_category_id: index,
      category_slug: cat,
    }));
  };

  /**Sauvegarde les préférences et redirige vers l'accueil */
  const handleSave = () => {
    if (!user) return;
    const mapped = buildPreferences(user.id, preferences);
    setUserEventPreferences(user.id, mapped);
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
