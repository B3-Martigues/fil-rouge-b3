import AdminDashboardPanel from "../components/AdminDashboardPanel";

type AdminView = "dashboard" | "accounts" | "events";

type AdminDashboardProps = {
  view?: AdminView;
};

export default function AdminDashboard({ view }: AdminDashboardProps) {
  return <AdminDashboardPanel view={view} />;
}
