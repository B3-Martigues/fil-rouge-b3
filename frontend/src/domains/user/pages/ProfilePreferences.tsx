import ProfilePreferencesForm from "../components/ProfilePreferencesForm";
import ThemeToggle from "../../../shared/components/layout/ThemeToggle";

export default function ProfilePreferences() {
  return (
    <section className="account-settings">
      <div className="account-settings__theme">
        <div>
          <h3>Theme</h3>
          <p>Choisissez l'affichage clair ou sombre de l'application.</p>
        </div>
        <ThemeToggle />
      </div>
      <ProfilePreferencesForm />
    </section>
  );
}
