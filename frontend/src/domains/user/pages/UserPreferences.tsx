import { useNavigate } from "react-router-dom";
import PreferencesGrid from "../components/PreferencesGrid";
import { useUserPreferences } from "../hooks/useUserPreferences";
import { ROUTES } from "../../../shared/constants/routes";

/**Page d'onboarding pour choisir les préférences utilisateur */
export default function UserPreferences() {
  const navigate = useNavigate();
  const { preferences, toggle } = useUserPreferences([]);

  /**Sauvegarde les préférences et redirige vers l'accueil */
  function handleSave() {
    localStorage.setItem("preferences", JSON.stringify(preferences));
    navigate(ROUTES.PUBLIC.HOME);
  }
  return (
    <div>
      <h1>Choisis tes centres d'intérêt</h1>
      <PreferencesGrid selected={preferences} toggle={toggle} />
      <button onClick={handleSave}>Continuer</button>
    </div>
  );
}
