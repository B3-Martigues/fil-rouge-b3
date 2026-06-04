import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { EventCategoryName } from "../../events/types/event-categories";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import Button from "../../../shared/components/ui/Button";
import { ROUTES } from "../../../shared/constants/routes";
import useDataStore from "../../../shared/store/dataStore";
import useAuthStore from "../../auth/store/authStore";
import PreferencesGrid from "../components/PreferencesGrid";
import { useUserPreferences } from "../hooks/useUserPreferences";

export default function Onboarding() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.currentUser);
  const setUserEventPreferences = useDataStore(
    (s) => s.setUserEventPreferences,
  );
  const { preferences, toggle } = useUserPreferences([]);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (category: EventCategoryName) => {
    setError(null);
    toggle(category);
  };

  const handleSave = () => {
    if (!user?.user_id) return;

    if (preferences.length === 0) {
      setError("Selectionnez au moins une preference pour continuer.");
      return;
    }

    setUserEventPreferences(user.user_id, preferences);
    navigate(ROUTES.PUBLIC.HOME);
  };

  return (
    <div>
      <h1>Choisis tes centres d'interet</h1>
      <PreferencesGrid selected={preferences} toggle={handleToggle} />
      {error && <ErrorMessage message={error} />}
      <Button type="button" onClick={handleSave}>
        Continuer
      </Button>
    </div>
  );
}
