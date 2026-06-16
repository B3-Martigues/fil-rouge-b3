import AccountPageShell from "../components/AccountPageShell";
import HistoryList from "../components/HistoryList";

export default function History() {
  return (
    <AccountPageShell activeSection="history">
      <HistoryList />
    </AccountPageShell>
  );
}
