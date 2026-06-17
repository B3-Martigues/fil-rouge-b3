import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  getEventCategorySlug,
  type EventCategoryName,
} from "../../event/types/event-categories";
import ErrorMessage from "../../../shared/components/feedback/ErrorMessage";
import Button from "../../../shared/components/ui/Button";
import { ROUTES } from "../../../shared/constants/routes";
import useDataStore from "../../../shared/store/dataStore";
import useAuthStore from "../../auth/store/authStore";
import PreferencesGrid from "../components/PreferencesGrid";
import { useUserPreferences } from "../hooks/useUserPreferences";

export default function ProfilePreferences() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.currentUser);
  const userId = user?.user_id;
  const preferencesStore = useDataStore((s) => s.userEventPreferences);
  const setUserEventPreferences = useDataStore(
    (s) => s.setUserEventPreferences,
  );
  const initial = preferencesStore
    .filter((preference) => preference.user_id === userId)
    .map((preference) => getEventCategorySlug(preference.event_category_id))
    .filter((category): category is EventCategoryName => !!category);
  const { preferences, toggle } = useUserPreferences(initial);
  const [error, setError] = useState<string | null>(null);

  if (!user || !userId) return null;

  const handleToggle = (category: EventCategoryName) => {
    setError(null);
    toggle(category);
  };

  const handleSave = () => {
    if (preferences.length === 0) {
      setError("Selectionnez au moins une preference.");
      return;
    }

    setUserEventPreferences(userId, preferences);
    toast.success("Preferences mises a jour");
    navigate(ROUTES.USER.PROFILE);
  };

  return (
    <div className="profile-preferences">
      <h3 className="profile-preferences__title">Préférences</h3>
      <PreferencesGrid selected={preferences} toggle={handleToggle} />
      {error && <ErrorMessage message={error} />}
      <div className="profile-preferences__actions">
        <Button type="button" onClick={handleSave}>
          Enregistrer mes préférences
        </Button>
      </div>
    </div>
  );
}
