import {
  Building2,
  CalendarDays,
  Flag,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import useModeratorPermissions from "../../../domains/moderator/hooks/useModeratorPermissions";
import { ROUTES } from "../../constants/routes";
import StaffAccountHeader from "./StaffAccountHeader";

export default function HeaderModerator() {
  const { can } = useModeratorPermissions();
  const canReviewEvents = can("review_events");
  const canModerateEvents = can("moderate_events");
  const canReviewOrganizations = can("review_organizations");
  const canSuspendAccounts = can("suspend_accounts");
  const canManageReports = can("manage_reports");
  const moderatorTabs = [
    {
      label: "Moderation",
      route: ROUTES.MODERATOR.DASHBOARD,
      Icon: ShieldCheck,
      isVisible: true,
    },
    {
      label: "Evenements",
      route: ROUTES.MODERATOR.EVENTS,
      Icon: CalendarDays,
      isVisible: canReviewEvents || canModerateEvents,
    },
    {
      label: "Organisations",
      route: ROUTES.MODERATOR.ORGANIZATIONS,
      Icon: Building2,
      isVisible: canReviewOrganizations || canSuspendAccounts,
    },
    {
      label: "Comptes",
      route: ROUTES.MODERATOR.ACCOUNTS,
      Icon: UsersRound,
      isVisible: canSuspendAccounts,
    },
    {
      label: "Signalements",
      route: ROUTES.MODERATOR.REPORTS,
      Icon: Flag,
      isVisible: canManageReports,
    },
  ] as const;

  return (
    <StaffAccountHeader
      ariaLabel="Navigation moderation"
      tabs={moderatorTabs.filter((tab) => tab.isVisible)}
    />
  );
}
