/**
 * Page de profil utilisateur.
 */

import UserProfileForm from "../components/UserProfileForm";
import AccountPageShell from "../components/AccountPageShell";

export default function Profile() {
  return (
    <AccountPageShell activeSection="profile">
      <UserProfileForm />
    </AccountPageShell>
  );
}
