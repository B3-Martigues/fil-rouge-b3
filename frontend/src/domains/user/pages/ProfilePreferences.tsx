import ProfilePreferencesForm from "../components/ProfilePreferencesForm";
import ThemeToggle from "../../../shared/components/layout/ThemeToggle";
import useAuthStore from "../../auth/store/authStore";

export default function ProfilePreferences() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const canEditEventPreferences = currentUser?.role === "user";

  return (
    <section className="account-settings">
      <div className="account-settings__theme">
        <div>
          <h3>Theme</h3>
          <p>Choisissez l'affichage clair ou sombre de l'application.</p>
        </div>
        <ThemeToggle />
      </div>
      {canEditEventPreferences && <ProfilePreferencesForm />}
    </section>
  );
}
