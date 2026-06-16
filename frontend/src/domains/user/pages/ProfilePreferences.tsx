import AccountPageShell from "../components/AccountPageShell";
import ProfilePreferencesForm from "../components/ProfilePreferencesForm";

export default function ProfilePreferences() {
  return (
    <AccountPageShell activeSection="preferences">
      <ProfilePreferencesForm />
    </AccountPageShell>
  );
}
