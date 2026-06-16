import AccountPageShell from "../components/AccountPageShell";
import FavoritesList from "../components/FavoritesList";

export default function Favorites() {
  return (
    <AccountPageShell activeSection="favorites">
      <FavoritesList />
    </AccountPageShell>
  );
}
