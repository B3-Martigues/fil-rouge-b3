import ModeratorDashboardPanel from "../components/ModeratorDashboardPanel";

type ModeratorView = "dashboard" | "events" | "organizations" | "accounts" | "reports";

type ModeratorDashboardProps = {
  view?: ModeratorView;
};

export default function ModeratorDashboard({ view }: ModeratorDashboardProps) {
  return <ModeratorDashboardPanel view={view} />;
}
