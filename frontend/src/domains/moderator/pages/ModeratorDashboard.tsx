import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import EmptyState from "../../../shared/components/feedback/EmptyState";
import PanelStats from "../../../shared/components/layout/PanelStats";
import Toolbar from "../../../shared/components/layout/Toolbar";
import Button from "../../../shared/components/ui/Button";
import Input from "../../../shared/components/ui/Input";
import Select from "../../../shared/components/ui/Select";
import StatusBadge from "../../../shared/components/ui/StatusBadge";
import Textarea from "../../../shared/components/ui/Textarea";
import useAuthStore from "../../auth/store/authStore";
import type { Organization } from "../../organization/types/organization";
import type { Organizer } from "../../organization/types/organizer";
import type { Event } from "../../event/types/event";
import { formatEventDateRange, isEventSuspended } from "../../event/utils/event";
import {
  createAccountSuspendedNotification,
  createOrganizationApprovedNotification,
  createOrganizationRejectedNotification,
  createEventApprovedNotification,
  createEventDeletedNotification,
  createEventHiddenNotification,
  createEventRejectedNotification,
  createEventWithdrawnAfterReportNotification,
  createReportUsefulNotification,
} from "../../notification/services/notificationFactory";
import type { Account, AccountSummary, User } from "../../user/types/user";
import { isAccountSuspended } from "../../user/types/user";
import type {
  ModerationAction,
  ModerationReport,
  ModerationTargetType,
} from "../types/moderation";
import useDataStore, {
  buildAccountSummaries,
} from "../../../shared/store/dataStore";
import { ROUTES } from "../../../shared/constants/routes";

type ModeratorView = "dashboard" | "events" | "organizations" | "accounts" | "reports";

type ModeratorDashboardProps = {
  view?: ModeratorView;
};

type OrganizerRow = {
  member: Organizer;
  user?: User;
  account?: Account;
  organization?: Organization;
};

type HandledReportStatus = Extract<
  ModerationReport["status"],
  "resolved" | "dismissed"
>;
type ModerationEventFilter = "all" | "pending" | "published" | "suspended";
type ModerationEventSort = "date-asc" | "date-desc" | "title-asc" | "city-asc";
type ModerationOrganizationFilter = "all" | "pending" | "active" | "suspended";
type ModerationAccountFilter = "all" | "active" | "suspended";
type ModerationAccountSort = "name-asc" | "name-desc" | "email-asc";
type ModerationReportFilter = "all" | ModerationReport["status"];
type ModerationReportPriorityFilter = "all" | ModerationReport["priority"];
type ModerationReportSort = "newest" | "oldest" | "priority";

const finalEventActions: ModerationAction[] = [
  "event_rejected",
  "event_hidden",
  "event_deleted",
];

const finalOrganizationActions: ModerationAction[] = ["organization_rejected"];

const viewContent: Record<
  ModeratorView,
  {
    title: string;
    description: string;
  }
> = {
  dashboard: {
    title: "Panel moderation",
    description:
      "Vue d'ensemble des validations, signalements et suspensions en cours.",
  },
  events: {
    title: "Moderation des evenements",
    description: "Validation, refus motive, masquage et suppression d'evenements.",
  },
  organizations: {
    title: "Moderation des organizations",
    description:
      "Validation, comptes organization et collaborateurs rattaches aux fiches.",
  },
  accounts: {
    title: "Moderation des utilisateurs",
    description: "Suspension temporaire des comptes utilisateurs.",
  },
  reports: {
    title: "Signalements",
    description: "Suivi des signalements en attente, en cours et traites.",
  },
};

const accountRoleLabels: Record<AccountSummary["role"], string> = {
  admin: "Admin",
  moderator: "Moderateur",
  organization: "Organization",
  user: "Utilisateur",
};

const reportStatusLabels: Record<ModerationReport["status"], string> = {
  open: "En attente",
  reviewing: "En cours de traitement",
  resolved: "Traite",
  dismissed: "Traite",
};

const reportPriorityLabels: Record<ModerationReport["priority"], string> = {
  low: "Priorite basse",
  medium: "Priorite moyenne",
  high: "Priorite haute",
};

const moderationActionLabels: Record<ModerationAction, string> = {
  event_approved: "Evenement valide",
  event_rejected: "Evenement refuse",
  event_hidden: "Evenement masque",
  event_deleted: "Evenement supprime",
  event_restored: "Evenement restaure",
  organization_approved: "Organization validee",
  organization_rejected: "Organization refusee",
  account_suspended: "Compte suspendu",
  report_resolved: "Signalement confirme",
  report_dismissed: "Signalement restaure",
};

const handledReportOutcomes: Record<
  HandledReportStatus,
  {
    action: ModerationAction;
    label: string;
    note: string;
    variant: "success" | "suspended";
  }
> = {
  resolved: {
    action: "report_resolved",
    label: "Suspendu",
    note:
      "Decision: signalement confirme, la cible est marquee comme suspendue apres verification.",
    variant: "suspended",
  },
  dismissed: {
    action: "report_dismissed",
    label: "Restaure",
    note:
      "Decision: signalement classe, la cible est restauree ou maintenue accessible.",
    variant: "success",
  },
};

const getReasonKey = (
  targetType: ModerationTargetType,
  targetId: number,
  action: ModerationAction,
) => `${targetType}-${targetId}-${action}`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "Non renseigne";

const getTargetKey = (targetType: ModerationTargetType, targetId: number) =>
  `${targetType}-${targetId}`;

const isReasonMissing = (reason: string) => reason.trim().length < 5;

const isHandledReportStatus = (
  status: ModerationReport["status"],
): status is HandledReportStatus =>
  status === "resolved" || status === "dismissed";

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getReportTime = (report: ModerationReport) =>
  new Date(report.resolved_at ?? report.created_at).getTime();

const reportPriorityRank: Record<ModerationReport["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const createSuspendedUntil = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export default function ModeratorDashboard({
  view = "dashboard",
}: ModeratorDashboardProps) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const accounts = useDataStore((s) => s.accounts);
  const users = useDataStore((s) => s.users);
  const organizations = useDataStore((s) => s.organizations);
  const organizers = useDataStore((s) => s.organizers);
  const events = useDataStore((s) => s.events);
  const moderationReports = useDataStore((s) => s.moderationReports);
  const moderationDecisions = useDataStore((s) => s.moderationDecisions);
  const updateOrganization = useDataStore((s) => s.updateOrganization);
  const activateOrganization = useDataStore((s) => s.activateOrganization);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const approveEvent = useDataStore((s) => s.approveEvent);
  const suspendEvent = useDataStore((s) => s.suspendEvent);
  const liftEventSuspension = useDataStore((s) => s.liftEventSuspension);
  const deleteEvent = useDataStore((s) => s.deleteEvent);
  const restoreEvent = useDataStore((s) => s.restoreEvent);
  const deleteEventPermanently = useDataStore(
    (s) => s.deleteEventPermanently,
  );
  const suspendAccount = useDataStore((s) => s.suspendAccount);
  const updateModerationReport = useDataStore((s) => s.updateModerationReport);
  const addModerationDecision = useDataStore((s) => s.addModerationDecision);
  const dispatchNotification = useDataStore((s) => s.dispatchNotification);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reportDecisionMessages, setReportDecisionMessages] = useState<
    Record<number, string>
  >({});
  const [suspensionDays, setSuspensionDays] = useState<Record<number, string>>({});
  const [eventSuspensionDays, setEventSuspensionDays] = useState<
    Record<number, string>
  >({});
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<ModerationEventFilter>("all");
  const [eventSort, setEventSort] = useState<ModerationEventSort>("date-asc");
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [organizationFilter, setOrganizationFilter] =
    useState<ModerationOrganizationFilter>("all");
  const [organizationSort, setOrganizationSort] =
    useState<ModerationAccountSort>("name-asc");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountFilter, setAccountFilter] =
    useState<ModerationAccountFilter>("all");
  const [accountSort, setAccountSort] =
    useState<ModerationAccountSort>("name-asc");
  const [reportSearch, setReportSearch] = useState("");
  const [reportFilter, setReportFilter] =
    useState<ModerationReportFilter>("all");
  const [reportPriorityFilter, setReportPriorityFilter] =
    useState<ModerationReportPriorityFilter>("all");
  const [reportSort, setReportSort] =
    useState<ModerationReportSort>("newest");

  const moderatorUserId = currentUser?.user_id ?? currentUser?.id ?? 0;
  const canFinalizeEvents = currentUser?.role === "admin";
  const accountSummaries = useMemo(
    () => buildAccountSummaries(accounts, users, organizations),
    [accounts, organizations, users],
  );

  const latestDecisionByTarget = useMemo(() => {
    const decisionMap = new Map<string, ModerationAction>();

    [...moderationDecisions]
      .sort(
        (first, second) =>
          new Date(second.created_at).getTime() -
          new Date(first.created_at).getTime(),
      )
      .forEach((decision) => {
        const key = getTargetKey(decision.target_type, decision.target_id);

        if (!decisionMap.has(key)) {
          decisionMap.set(key, decision.action);
        }
      });

    return decisionMap;
  }, [moderationDecisions]);

  const activeOrganizations = organizations.filter((organization) => !organization.deleted_at);
  const visibleEvents = events.filter((event) => !event.deleted_at);
  const pendingEvents = visibleEvents.filter((event) => {
    const latestDecision = latestDecisionByTarget.get(
      getTargetKey("event", event.id),
    );

    return (
      !event.is_active &&
      !isEventSuspended(event) &&
      (!latestDecision || !finalEventActions.includes(latestDecision))
    );
  });
  const publishedEvents = visibleEvents.filter(
    (event) => event.is_active && !isEventSuspended(event),
  );
  const suspendedEvents = visibleEvents.filter((event) =>
    isEventSuspended(event),
  );
  const pendingOrganizations = activeOrganizations.filter((organization) => {
    const latestDecision = latestDecisionByTarget.get(
      getTargetKey("organization", organization.id),
    );

    return (
      !organization.is_active &&
      (!latestDecision || !finalOrganizationActions.includes(latestDecision))
    );
  });
  const pendingReports = moderationReports.filter(
    (report) => report.status === "open",
  );
  const moderatableAccounts = accountSummaries.filter(
    (account) =>
      (account.role === "user" || account.role === "organization") &&
      account.is_active &&
      !isAccountSuspended(account),
  );
  const suspendedAccounts = accountSummaries.filter(
    (account) =>
      (account.role === "user" || account.role === "organization") &&
      isAccountSuspended(account),
  );
  const userAccountsToModerate = moderatableAccounts.filter(
    (account) => account.role === "user",
  );
  const organizationAccountsToModerate = moderatableAccounts.filter(
    (account) => account.role === "organization",
  );
  const suspendedUserAccounts = suspendedAccounts.filter(
    (account) => account.role === "user",
  );
  const suspendedOrganizationAccounts = suspendedAccounts.filter(
    (account) => account.role === "organization",
  );
  const organizerRows = useMemo<OrganizerRow[]>(() => {
    const organizationById = new Map(
      organizations.map((organization) => [organization.id, organization]),
    );
    const userById = new Map(users.map((user) => [user.id, user]));
    const accountById = new Map(accounts.map((account) => [account.id, account]));

    return organizers
      .filter((member) => !member.deleted_at)
      .map((member) => {
        const user = userById.get(member.user_id);

        return {
          member,
          user,
          account: user ? accountById.get(user.account_id) : undefined,
          organization: organizationById.get(member.organization_id),
        };
      });
  }, [accounts, organizations, organizers, users]);

  const getReason = (
    targetType: ModerationTargetType,
    targetId: number,
    action: ModerationAction,
  ) => reasons[getReasonKey(targetType, targetId, action)] ?? "";

  const updateReason = (
    targetType: ModerationTargetType,
    targetId: number,
    action: ModerationAction,
    reason: string,
  ) => {
    setReasons((currentReasons) => ({
      ...currentReasons,
      [getReasonKey(targetType, targetId, action)]: reason,
    }));
  };

  const clearReason = (
    targetType: ModerationTargetType,
    targetId: number,
    action: ModerationAction,
  ) => {
    setReasons((currentReasons) => {
      const nextReasons = { ...currentReasons };
      delete nextReasons[getReasonKey(targetType, targetId, action)];
      return nextReasons;
    });
  };

  const updateReportDecisionMessage = (reportId: number, message: string) => {
    setReportDecisionMessages((currentMessages) => ({
      ...currentMessages,
      [reportId]: message,
    }));
  };

  const clearReportDecisionMessage = (reportId: number) => {
    setReportDecisionMessages((currentMessages) => {
      const nextMessages = { ...currentMessages };
      delete nextMessages[reportId];
      return nextMessages;
    });
  };

  const recordDecision = (
    action: ModerationAction,
    targetType: ModerationTargetType,
    targetId: number,
    reason: string,
  ) => {
    addModerationDecision({
      action,
      target_type: targetType,
      target_id: targetId,
      moderator_user_id: moderatorUserId,
      reason,
    });
  };

  const getOrganizationName = (organizationId: number) =>
    activeOrganizations.find((organization) => organization.id === organizationId)?.name ??
    "Organization introuvable";

  const getOrganizationNotificationUser = (organization: Organization) => {
    const organizer = organizers.find(
      (member) => member.organization_id === organization.id && !member.deleted_at,
    );

    return (
      users.find(
        (user) => user.id === organizer?.user_id && !user.deleted_at,
      ) ??
      users.find(
        (user) => user.account_id === organization.account_id && !user.deleted_at,
      )
    );
  };

  const notifyOrganization = (
    organization: Organization,
    buildNotification: (user: User) => Parameters<typeof dispatchNotification>[0],
  ) => {
    const notificationUser = getOrganizationNotificationUser(organization);

    if (!notificationUser) {
      toast.error("Aucun membre organization rattache pour notifier la decision");
      return;
    }

    void dispatchNotification(buildNotification(notificationUser));
  };

  const getOrganizerUsers = (organizationId: number) => {
    const memberUserIds = new Set(
      organizers
        .filter((member) => member.organization_id === organizationId && !member.deleted_at)
        .map((member) => member.user_id),
    );

    return users.filter(
      (user) => memberUserIds.has(user.id) && !user.deleted_at,
    );
  };

  const notifyUsefulReport = (
    report: ModerationReport,
    moderatorMessage: string,
  ) => {
    const reporter = users.find(
      (user) => user.id === report.reporter_user_id && !user.deleted_at,
    );

    if (!reporter) return;

    const targetEvent =
      report.target_type === "event"
        ? events.find((event) => event.id === report.target_id) ?? null
        : null;
    const targetOrganization =
      report.target_type === "organization"
        ? organizations.find((organization) => organization.id === report.target_id) ?? null
        : targetEvent
          ? organizations.find((organization) => organization.id === targetEvent.organization_id) ??
            null
          : null;

    void dispatchNotification(
      createReportUsefulNotification({
        user: reporter,
        targetLabel: getReportTargetLabel(
          report,
          events,
          organizations,
          accountSummaries,
        ),
        moderatorMessage,
        event: targetEvent,
        organization: targetOrganization,
      }),
    );
  };

  const withdrawReportedEventAndNotifyOrganization = (
    report: ModerationReport,
    moderatorMessage: string,
  ) => {
    if (report.target_type !== "event") return;

    const event = events.find(
      (item) => item.id === report.target_id && !item.deleted_at,
    );

    if (!event) return;

    const organization = activeOrganizations.find((item) => item.id === event.organization_id);

    if (!organization) return;

    recordDecision("event_deleted", "event", event.id, moderatorMessage);
    deleteEvent(event.id);

    getOrganizerUsers(organization.id).forEach((user) => {
      void dispatchNotification(
        createEventWithdrawnAfterReportNotification({
          organization,
          event,
          user,
          moderatorMessage,
        }),
      );
    });
  };

  const handleApproveOrganization = (organization: Organization) => {
    activateOrganization(organization.id);
    notifyOrganization(organization, (user) =>
      createOrganizationApprovedNotification({ organization, user }),
    );
    recordDecision("organization_approved", "organization", organization.id, "Compte valide");
    toast.success(`${organization.name} est validee`);
  };

  const handleRejectOrganization = (organization: Organization) => {
    const reason = getReason("organization", organization.id, "organization_rejected");

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de refus");
      return;
    }

    updateOrganization(organization.id, {
      is_active: false,
      is_verified: false,
    });
    notifyOrganization(organization, (user) =>
      createOrganizationRejectedNotification({ organization, user, reason }),
    );
    recordDecision("organization_rejected", "organization", organization.id, reason);
    clearReason("organization", organization.id, "organization_rejected");
    toast.success(`${organization.name} est refusee`);
  };

  const handleApproveEvent = (event: Event) => {
    const organization = activeOrganizations.find(
      (item) => item.id === event.organization_id && item.is_active,
    );

    if (!organization) {
      toast.error("Impossible de publier un evenement d'une organization inactive");
      return;
    }

    approveEvent(event.id);
    notifyOrganization(organization, (user) =>
      createEventApprovedNotification({ organization, event, user }),
    );
    recordDecision("event_approved", "event", event.id, "Evenement valide");
    toast.success(`${event.title} est publie`);
  };

  const handleRejectEvent = (event: Event) => {
    const reason = getReason("event", event.id, "event_rejected");
    const organization = activeOrganizations.find((item) => item.id === event.organization_id);

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de refus");
      return;
    }

    if (!organization) {
      toast.error("Organization rattachee introuvable");
      return;
    }

    updateEvent(event.id, { is_active: false });
    notifyOrganization(organization, (user) =>
      createEventRejectedNotification({ organization, event, user, reason }),
    );
    recordDecision("event_rejected", "event", event.id, reason);
    clearReason("event", event.id, "event_rejected");
    toast.success(`${event.title} est refuse`);
  };

  const handleSuspendEvent = (event: Event) => {
    const reason = getReason("event", event.id, "event_hidden");
    const daysValue = Number(eventSuspensionDays[event.id] ?? 7);
    const organization = activeOrganizations.find((item) => item.id === event.organization_id);

    if (!Number.isFinite(daysValue) || daysValue < 1 || daysValue > 90) {
      toast.error("La duree doit etre comprise entre 1 et 90 jours");
      return;
    }

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de suspension");
      return;
    }

    if (!organization) {
      toast.error("Organization rattachee introuvable");
      return;
    }

    const suspendedUntil = createSuspendedUntil(daysValue);

    suspendEvent(event.id, reason, suspendedUntil);
    notifyOrganization(organization, (user) =>
      createEventHiddenNotification({ organization, event, user, reason }),
    );
    recordDecision("event_hidden", "event", event.id, reason);
    clearReason("event", event.id, "event_hidden");
    toast.success(`${event.title} est suspendu temporairement`);
  };

  const handleLiftEventSuspension = (event: Event) => {
    liftEventSuspension(event.id);
    recordDecision(
      "event_restored",
      "event",
      event.id,
      "Suspension levee par la moderation",
    );
    toast.success(`Suspension levee pour ${event.title}`);
  };

  const handleDeleteEvent = (event: Event) => {
    const reason = getReason("event", event.id, "event_deleted");
    const organization = activeOrganizations.find((item) => item.id === event.organization_id);

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de suppression");
      return;
    }

    if (!organization) {
      toast.error("Organization rattachee introuvable");
      return;
    }

    if (
      !window.confirm(
        `Supprimer l'evenement "${event.title}" ? Cette action retire l'evenement du mock.`,
      )
    ) {
      return;
    }

    notifyOrganization(organization, (user) =>
      createEventDeletedNotification({ organization, event, user, reason }),
    );
    deleteEvent(event.id);
    recordDecision("event_deleted", "event", event.id, reason);
    clearReason("event", event.id, "event_deleted");
    toast.success(`${event.title} est supprime`);
  };

  const handleSuspendAccountSummary = (
    account: AccountSummary,
    reason: string,
    daysValue: number,
  ) => {
    const user = account.user_id
      ? users.find((item) => item.id === account.user_id && !item.deleted_at)
      : null;

    if (!user) {
      toast.error("Utilisateur rattache au compte introuvable");
      return false;
    }

    const suspendedUntil = createSuspendedUntil(daysValue);
    const organization = account.organization_id
      ? organizations.find((item) => item.id === account.organization_id)
      : null;

    suspendAccount(account.account_id, reason, suspendedUntil);
    void dispatchNotification(
      createAccountSuspendedNotification({
        user,
        organization,
        reason,
        suspendedUntil,
      }),
    );
    recordDecision(
      "account_suspended",
      "account",
      account.account_id,
      reason,
    );

    return true;
  };

  const handleSuspendAccount = (account: AccountSummary) => {
    const reason = getReason("account", account.account_id, "account_suspended");
    const daysValue = Number(suspensionDays[account.account_id] ?? 7);

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de suspension");
      return;
    }

    if (!Number.isFinite(daysValue) || daysValue < 1 || daysValue > 90) {
      toast.error("La duree doit etre comprise entre 1 et 90 jours");
      return;
    }

    if (!handleSuspendAccountSummary(account, reason, daysValue)) {
      return;
    }

    clearReason("account", account.account_id, "account_suspended");
    toast.success(`${account.display_name} est suspendu temporairement`);
  };

  const applyResolvedReportTargetAction = (
    report: ModerationReport,
    decisionMessage: string,
  ) => {
    if (report.target_type === "account") {
      const reportedAccount = accountSummaries.find(
        (account) => account.account_id === report.target_id,
      );

      if (reportedAccount) {
        handleSuspendAccountSummary(reportedAccount, decisionMessage, 7);
      }

      return;
    }

    if (report.target_type === "organization") {
      const reportedOrganization = organizations.find(
        (organization) => organization.id === report.target_id && !organization.deleted_at,
      );

      if (!reportedOrganization) return;

      updateOrganization(reportedOrganization.id, {
        is_active: false,
        is_verified: false,
      });
      notifyOrganization(reportedOrganization, (user) =>
        createOrganizationRejectedNotification({
          organization: reportedOrganization,
          user,
          reason: decisionMessage,
        }),
      );
      recordDecision(
        "organization_rejected",
        "organization",
        reportedOrganization.id,
        decisionMessage,
      );

      const reportedOrganizationAccount = accountSummaries.find(
        (account) => account.organization_id === reportedOrganization.id,
      );

      if (reportedOrganizationAccount) {
        handleSuspendAccountSummary(reportedOrganizationAccount, decisionMessage, 7);
      }
    }
  };

  const handleReportStatus = (
    report: ModerationReport,
    status: ModerationReport["status"],
    moderatorMessage = "",
  ) => {
    const handledOutcome = isHandledReportStatus(status)
      ? handledReportOutcomes[status]
      : null;
    const decisionMessage = moderatorMessage.trim();

    if (handledOutcome && isReasonMissing(decisionMessage)) {
      toast.error("Ajoutez un message de decision pour le signalement");
      return;
    }

    updateModerationReport(report.id, {
      status,
      handled_by_user_id: moderatorUserId,
      resolved_at: handledOutcome ? new Date().toISOString() : null,
      resolution_note: handledOutcome ? decisionMessage : null,
    });

    if (handledOutcome) {
      recordDecision(
        handledOutcome.action,
        report.target_type,
        report.target_id,
        decisionMessage,
      );
      clearReportDecisionMessage(report.id);
    }

    if (status === "resolved") {
      notifyUsefulReport(report, decisionMessage);
      withdrawReportedEventAndNotifyOrganization(report, decisionMessage);
      applyResolvedReportTargetAction(report, decisionMessage);
    }

    toast.success("Signalement mis a jour");
  };

  const handleRestoreEvent = (eventId: number) => {
    restoreEvent(eventId);
    recordDecision(
      "event_restored",
      "event",
      eventId,
      "Restaure en attente de validation par un administrateur",
    );
    toast.success("Evenement restaure en attente");
  };

  const handleDeleteEventPermanently = (eventId: number) => {
    const event = events.find((item) => item.id === eventId);
    const eventTitle = event?.title ?? "cet evenement";

    if (
      !window.confirm(
        `Supprimer definitivement "${eventTitle}" ? Cette action retire l'evenement du mock.`,
      )
    ) {
      return;
    }

    deleteEventPermanently(eventId);
    toast.success("Evenement supprime definitivement");
  };

  const updateSuspensionDays = (accountId: number, value: string) => {
    setSuspensionDays((currentValues) => ({
      ...currentValues,
      [accountId]: value,
    }));
  };

  const updateEventSuspensionDays = (eventId: number, value: string) => {
    setEventSuspensionDays((currentValues) => ({
      ...currentValues,
      [eventId]: value,
    }));
  };

  const sortAccounts = (items: AccountSummary[], sort: ModerationAccountSort) =>
    [...items].sort((first, second) => {
      if (sort === "name-desc") {
        return second.display_name.localeCompare(first.display_name, "fr-FR");
      }

      if (sort === "email-asc") {
        return first.login_email.localeCompare(second.login_email, "fr-FR");
      }

      return first.display_name.localeCompare(second.display_name, "fr-FR");
    });

  const matchesAccountSearch = (account: AccountSummary, search: string) =>
    normalizeText(
      [
        account.display_name,
        account.login_email,
        account.role,
        account.suspension_reason ?? "",
      ].join(" "),
    ).includes(normalizeText(search));

  const filterAccounts = (
    activeItems: AccountSummary[],
    suspendedItems: AccountSummary[],
    filter: ModerationAccountFilter | ModerationOrganizationFilter,
    search: string,
    sort: ModerationAccountSort,
  ) => {
    const sourceItems =
      filter === "active"
        ? activeItems
        : filter === "suspended"
          ? suspendedItems
          : [...activeItems, ...suspendedItems];

    return sortAccounts(
      sourceItems.filter((account) => matchesAccountSearch(account, search)),
      sort,
    );
  };

  const filteredEvents = (() => {
    const eventSearchText = normalizeText(eventSearch);
    const sourceEvents =
      eventFilter === "pending"
        ? pendingEvents
        : eventFilter === "published"
          ? publishedEvents
          : eventFilter === "suspended"
            ? suspendedEvents
            : [...pendingEvents, ...publishedEvents, ...suspendedEvents];

    return sourceEvents
      .filter((event) =>
        normalizeText(
          [
            event.title,
            event.description,
            event.city,
            event.postal_code,
            event.address,
            event.suspension_reason ?? "",
            activeOrganizations.find((organization) => organization.id === event.organization_id)
              ?.name ?? "",
          ].join(" "),
        ).includes(eventSearchText),
      )
      .sort((firstEvent, secondEvent) => {
        if (eventSort === "date-desc") {
          return (
            new Date(secondEvent.start_date).getTime() -
            new Date(firstEvent.start_date).getTime()
          );
        }

        if (eventSort === "title-asc") {
          return firstEvent.title.localeCompare(secondEvent.title, "fr-FR");
        }

        if (eventSort === "city-asc") {
          return firstEvent.city.localeCompare(secondEvent.city, "fr-FR");
        }

        return (
          new Date(firstEvent.start_date).getTime() -
          new Date(secondEvent.start_date).getTime()
        );
      });
  })();
  const filteredPendingEvents = filteredEvents.filter(
    (event) => !event.is_active && !isEventSuspended(event),
  );
  const filteredPublishedEvents = filteredEvents.filter(
    (event) => event.is_active && !isEventSuspended(event),
  );
  const filteredSuspendedEvents = filteredEvents.filter((event) =>
    isEventSuspended(event),
  );

  const filteredOrganizations = (() => {
    const organizationSearchText = normalizeText(organizationSearch);
    const sourceOrganizations =
      organizationFilter === "active" || organizationFilter === "suspended"
        ? []
        : pendingOrganizations;

    return [...sourceOrganizations]
      .filter((organization) =>
        normalizeText(
          [
            organization.name,
            organization.contact_email,
            organization.description ?? "",
            organization.city,
            organization.postal_code,
            organization.siret ?? "",
          ].join(" "),
        ).includes(organizationSearchText),
      )
      .sort((firstOrganization, secondOrganization) =>
        organizationSort === "name-desc"
          ? secondOrganization.name.localeCompare(firstOrganization.name, "fr-FR")
          : firstOrganization.name.localeCompare(secondOrganization.name, "fr-FR"),
      );
  })();
  const filteredOrganizationAccounts = filterAccounts(
    organizationAccountsToModerate,
    suspendedOrganizationAccounts,
    organizationFilter,
    organizationSearch,
    organizationSort,
  );
  const filteredOrganizers = organizerRows
    .filter(({ member, user, account, organization }) =>
      normalizeText(
        [
          user?.username ?? "",
          account?.login_email ?? "",
          organization?.name ?? "",
          member.job_role ?? "",
        ].join(" "),
      ).includes(normalizeText(organizationSearch)),
    )
    .sort((firstRow, secondRow) =>
      (firstRow.user?.username ?? "").localeCompare(
        secondRow.user?.username ?? "",
        "fr-FR",
      ),
    );

  const filteredUserAccounts = filterAccounts(
    userAccountsToModerate,
    suspendedUserAccounts,
    accountFilter,
    accountSearch,
    accountSort,
  );
  const filteredActiveUserAccounts = filteredUserAccounts.filter(
    (account) => !isAccountSuspended(account),
  );
  const filteredSuspendedUserAccounts = filteredUserAccounts.filter((account) =>
    isAccountSuspended(account),
  );
  const filteredActiveOrganizationAccounts = filteredOrganizationAccounts.filter(
    (account) => !isAccountSuspended(account),
  );
  const filteredSuspendedOrganizationAccounts = filteredOrganizationAccounts.filter(
    (account) => isAccountSuspended(account),
  );

  const filteredReports = (() => {
    const reportSearchText = normalizeText(reportSearch);

    return moderationReports
      .filter((report) => {
        const matchesStatus =
          reportFilter === "all" || report.status === reportFilter;
        const matchesPriority =
          reportPriorityFilter === "all" ||
          report.priority === reportPriorityFilter;
        const targetLabel = getReportTargetLabel(
          report,
          events,
          organizations,
          accountSummaries,
        );

        return (
          matchesStatus &&
          matchesPriority &&
          normalizeText(
            [
              report.reason,
              report.details,
              report.status,
              report.priority,
              targetLabel,
              getUserName(report.reporter_user_id, users),
            ].join(" "),
          ).includes(reportSearchText)
        );
      })
      .sort((firstReport, secondReport) => {
        if (reportSort === "oldest") {
          return getReportTime(firstReport) - getReportTime(secondReport);
        }

        if (reportSort === "priority") {
          return (
            reportPriorityRank[firstReport.priority] -
            reportPriorityRank[secondReport.priority]
          );
        }

        return getReportTime(secondReport) - getReportTime(firstReport);
      });
  })();
  const filteredPendingReports = filteredReports.filter(
    (report) => report.status === "open",
  );
  const filteredReviewingReports = filteredReports.filter(
    (report) => report.status === "reviewing",
  );
  const filteredHandledReports = filteredReports.filter((report) =>
    isHandledReportStatus(report.status),
  );
  const filteredDecisions = moderationDecisions.filter((decision) =>
    normalizeText(
      [
        moderationActionLabels[decision.action],
        decision.reason,
        decision.target_type,
        getUserName(decision.moderator_user_id, users),
      ].join(" "),
    ).includes(normalizeText(reportSearch)),
  );

  const isEventsView = view === "events";
  const isOrganizationsView = view === "organizations";
  const isAccountsView = view === "accounts";
  const isReportsView = view === "reports";
  const currentViewContent = viewContent[view];
  const moderatorStats = [
    {
      label: "Utilisateurs",
      to: ROUTES.MODERATOR.DASHBOARD,
      value: userAccountsToModerate.length + suspendedUserAccounts.length,
      end: true,
    },
    {
      label: "Evenements",
      to: ROUTES.MODERATOR.EVENTS,
      value: visibleEvents.length,
      detail: `${pendingEvents.length} en attente`,
    },
    {
      label: "Organizations",
      to: ROUTES.MODERATOR.ORGANIZATIONS,
      value: activeOrganizations.length,
      detail: `${pendingOrganizations.length} en attente`,
    },
    {
      label: "Signalements",
      to: ROUTES.MODERATOR.REPORTS,
      value: moderationReports.length,
      detail: `${pendingReports.length} en attente`,
    },
  ];

  return (
    <div className="admin-panel moderator-panel">
      <section className="admin-panel__header">
        <div className="admin-panel__heading">
          <h2>{currentViewContent.title}</h2>
        </div>
        <p>{currentViewContent.description}</p>
      </section>

      <PanelStats ariaLabel="Navigation moderation" stats={moderatorStats} />

      {isEventsView && (
        <Toolbar ariaLabel="Filtres des evenements" className="admin-toolbar">
          <label>
            Rechercher
            <Input
              value={eventSearch}
              placeholder="Titre, ville, organization..."
              onChange={(event) => setEventSearch(event.target.value)}
            />
          </label>
          <label>
            Statut
            <Select
              value={eventFilter}
              onChange={(event) =>
                setEventFilter(event.target.value as ModerationEventFilter)
              }
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">A valider</option>
              <option value="published">Publies</option>
              <option value="suspended">Suspendus</option>
            </Select>
          </label>
          <label>
            Trier par
            <Select
              value={eventSort}
              onChange={(event) =>
                setEventSort(event.target.value as ModerationEventSort)
              }
            >
              <option value="date-asc">Date croissante</option>
              <option value="date-desc">Date decroissante</option>
              <option value="title-asc">Titre A-Z</option>
              <option value="city-asc">Ville A-Z</option>
            </Select>
          </label>
        </Toolbar>
      )}

      {isEventsView && (
        <section className="admin-section admin-section--wide">
          <div className="admin-section__title">
            <h2>Evenements proposes</h2>
            <span className="admin-count">{filteredPendingEvents.length}</span>
          </div>

          {filteredPendingEvents.length === 0 ? (
            <EmptyState message="Aucun evenement en attente." />
          ) : (
            <div className="organization-review-list">
              {filteredPendingEvents.map((event) => (
                <EventModerationCard
                  event={event}
                  organizationName={getOrganizationName(event.organization_id)}
                  key={event.id}
                  approveLabel="Valider"
                  rejectLabel="Refuser"
                  reason={getReason("event", event.id, "event_rejected")}
                  onReasonChange={(reason) =>
                    updateReason("event", event.id, "event_rejected", reason)
                  }
                  onApprove={() => handleApproveEvent(event)}
                  onReject={() => handleRejectEvent(event)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {isEventsView && (
        <section className="admin-section admin-section--wide">
          <div className="admin-section__title">
            <h2>Evenements publies</h2>
            <span className="admin-count">{filteredPublishedEvents.length}</span>
          </div>

          {filteredPublishedEvents.length === 0 ? (
            <EmptyState message="Aucun evenement publie." />
          ) : (
            <div className="organization-review-list">
              {filteredPublishedEvents.map((event) => (
                <PublishedEventModerationCard
                  event={event}
                  organizationName={getOrganizationName(event.organization_id)}
                  suspensionDays={eventSuspensionDays[event.id] ?? "7"}
                  suspensionReason={getReason("event", event.id, "event_hidden")}
                  deleteReason={getReason("event", event.id, "event_deleted")}
                  key={event.id}
                  onSuspensionDaysChange={(value) =>
                    updateEventSuspensionDays(event.id, value)
                  }
                  onSuspensionReasonChange={(reason) =>
                    updateReason("event", event.id, "event_hidden", reason)
                  }
                  onDeleteReasonChange={(reason) =>
                    updateReason("event", event.id, "event_deleted", reason)
                  }
                  onSuspend={() => handleSuspendEvent(event)}
                  onDelete={() => handleDeleteEvent(event)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {isEventsView && (
        <section className="admin-section admin-section--wide">
          <div className="admin-section__title">
            <h2>Evenements suspendus</h2>
            <span className="admin-count">{filteredSuspendedEvents.length}</span>
          </div>

          {filteredSuspendedEvents.length === 0 ? (
            <EmptyState message="Aucun evenement suspendu." />
          ) : (
            <div className="organization-review-list">
              {filteredSuspendedEvents.map((event) => (
                <SuspendedEventModerationCard
                  event={event}
                  organizationName={getOrganizationName(event.organization_id)}
                  key={event.id}
                  onLift={() => handleLiftEventSuspension(event)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {isOrganizationsView && (
        <Toolbar ariaLabel="Filtres des organizations" className="admin-toolbar">
          <label>
            Rechercher
            <Input
              value={organizationSearch}
              placeholder="Organization, email, SIRET..."
              onChange={(event) => setOrganizationSearch(event.target.value)}
            />
          </label>
          <label>
            Statut
            <Select
              value={organizationFilter}
              onChange={(event) =>
                setOrganizationFilter(event.target.value as ModerationOrganizationFilter)
              }
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">A valider</option>
              <option value="active">Actifs</option>
              <option value="suspended">Suspendus</option>
            </Select>
          </label>
          <label>
            Trier par
            <Select
              value={organizationSort}
              onChange={(event) =>
                setOrganizationSort(event.target.value as ModerationAccountSort)
              }
            >
              <option value="name-asc">Nom A-Z</option>
              <option value="name-desc">Nom Z-A</option>
              <option value="email-asc">Email A-Z</option>
            </Select>
          </label>
        </Toolbar>
      )}

      {isOrganizationsView && (
        <section className="admin-section admin-section--wide">
          <div className="admin-section__title">
            <h2>Comptes organization proposes</h2>
            <span className="admin-count">{filteredOrganizations.length}</span>
          </div>

          {filteredOrganizations.length === 0 ? (
            <EmptyState message="Aucun compte organization en attente." />
          ) : (
            <div className="organization-review-list">
              {filteredOrganizations.map((organization) => (
                <OrganizationModerationCard
                  organization={organization}
                  key={organization.id}
                  reason={getReason("organization", organization.id, "organization_rejected")}
                  onReasonChange={(reason) =>
                    updateReason("organization", organization.id, "organization_rejected", reason)
                  }
                  onApprove={() => handleApproveOrganization(organization)}
                  onReject={() => handleRejectOrganization(organization)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {isOrganizationsView && (
        <>
          <AccountSuspensionSection
            accounts={filteredActiveOrganizationAccounts}
            getReason={getReason}
            onDaysChange={updateSuspensionDays}
            onReasonChange={(accountId, reason) =>
              updateReason("account", accountId, "account_suspended", reason)
            }
            onSuspend={handleSuspendAccount}
            suspensionDays={suspensionDays}
            title="Liste des organizations"
          />

          <OrganizerAccountsSection rows={filteredOrganizers} />

          <SuspendedOrganizationsSection accounts={filteredSuspendedOrganizationAccounts} />
        </>
      )}

      {isAccountsView && (
        <Toolbar ariaLabel="Filtres des comptes" className="admin-toolbar">
          <label>
            Rechercher
            <Input
              value={accountSearch}
              placeholder="Nom, email, motif..."
              onChange={(event) => setAccountSearch(event.target.value)}
            />
          </label>
          <label>
            Statut
            <Select
              value={accountFilter}
              onChange={(event) =>
                setAccountFilter(event.target.value as ModerationAccountFilter)
              }
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="suspended">Suspendus</option>
            </Select>
          </label>
          <label>
            Trier par
            <Select
              value={accountSort}
              onChange={(event) =>
                setAccountSort(event.target.value as ModerationAccountSort)
              }
            >
              <option value="name-asc">Nom A-Z</option>
              <option value="name-desc">Nom Z-A</option>
              <option value="email-asc">Email A-Z</option>
            </Select>
          </label>
        </Toolbar>
      )}

      {isAccountsView && (
        <>
          <AccountSuspensionSection
            accounts={filteredActiveUserAccounts}
            getReason={getReason}
            onDaysChange={updateSuspensionDays}
            onReasonChange={(accountId, reason) =>
              updateReason("account", accountId, "account_suspended", reason)
            }
            onSuspend={handleSuspendAccount}
            suspensionDays={suspensionDays}
            title="Comptes utilisateurs"
          />

          <SuspendedAccountsSection
            organizationAccounts={[]}
            userAccounts={filteredSuspendedUserAccounts}
          />
        </>
      )}

      {isReportsView && (
        <Toolbar ariaLabel="Filtres des signalements" className="admin-toolbar">
          <label>
            Rechercher
            <Input
              value={reportSearch}
              placeholder="Motif, cible, utilisateur..."
              onChange={(event) => setReportSearch(event.target.value)}
            />
          </label>
          <label>
            Statut
            <Select
              value={reportFilter}
              onChange={(event) =>
                setReportFilter(event.target.value as ModerationReportFilter)
              }
            >
              <option value="all">Tous les statuts</option>
              <option value="open">En attente</option>
              <option value="reviewing">En cours</option>
              <option value="resolved">Confirmes</option>
              <option value="dismissed">Restaures</option>
            </Select>
          </label>
          <label>
            Priorite
            <Select
              value={reportPriorityFilter}
              onChange={(event) =>
                setReportPriorityFilter(
                  event.target.value as ModerationReportPriorityFilter,
                )
              }
            >
              <option value="all">Toutes les priorites</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </Select>
          </label>
          <label>
            Trier par
            <Select
              value={reportSort}
              onChange={(event) =>
                setReportSort(event.target.value as ModerationReportSort)
              }
            >
              <option value="newest">Plus recents</option>
              <option value="oldest">Plus anciens</option>
              <option value="priority">Priorite</option>
            </Select>
          </label>
        </Toolbar>
      )}

      {isReportsView && (
        <section className="admin-section admin-section--wide">
          <div className="admin-section__title">
            <h2>Signalements</h2>
            <span className="admin-count">{filteredReports.length}</span>
          </div>

          {filteredReports.length === 0 ? (
            <EmptyState message="Aucun signalement." />
          ) : (
            <div className="moderator-report-groups">
              <ReportGroup
                title="En attente"
                reports={filteredPendingReports}
                emptyText="Aucun signalement en attente."
                events={events}
                organizations={organizations}
                accountSummaries={accountSummaries}
                users={users}
                decisionMessages={reportDecisionMessages}
                onDecisionMessageChange={updateReportDecisionMessage}
                onStatusChange={handleReportStatus}
              />
              <ReportGroup
                title="En cours de traitement"
                reports={filteredReviewingReports}
                emptyText="Aucun signalement en cours de traitement."
                events={events}
                organizations={organizations}
                accountSummaries={accountSummaries}
                users={users}
                decisionMessages={reportDecisionMessages}
                onDecisionMessageChange={updateReportDecisionMessage}
                onStatusChange={handleReportStatus}
              />
              <ReportGroup
                title="Traite"
                reports={filteredHandledReports}
                emptyText="Aucun signalement traite."
                events={events}
                organizations={organizations}
                accountSummaries={accountSummaries}
                users={users}
                decisionMessages={reportDecisionMessages}
                onDecisionMessageChange={updateReportDecisionMessage}
                onStatusChange={handleReportStatus}
              />
            </div>
          )}
        </section>
      )}

      {isReportsView && (
        <section className="admin-section admin-section--wide">
          <div className="admin-section__title">
            <h2>Journal des decisions</h2>
            <span className="admin-count">{filteredDecisions.length}</span>
          </div>

          <div className="moderator-decision-list">
            {filteredDecisions.map((decision) => {
              const event =
                decision.target_type === "event"
                  ? events.find((item) => item.id === decision.target_id)
                  : undefined;

              return (
                <article className="moderator-decision" key={decision.id}>
                  <div>
                    <strong>{moderationActionLabels[decision.action]}</strong>
                    <p>{decision.reason}</p>
                    <small>
                      {formatDate(decision.created_at)} par{" "}
                      {getUserName(decision.moderator_user_id, users)}
                    </small>
                  </div>
                  {canFinalizeEvents && decision.target_type === "event" && event && (
                    <div className="admin-actions">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => handleRestoreEvent(decision.target_id)}
                      >
                        Restaurer
                      </Button>
                      <Button
                        variant="danger"
                        type="button"
                        onClick={() =>
                          handleDeleteEventPermanently(decision.target_id)
                        }
                      >
                        Supprimer definitivement
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function EventModerationCard({
  event,
  organizationName,
  approveLabel,
  rejectLabel,
  reason,
  onReasonChange,
  onApprove,
  onReject,
}: {
  event: Event;
  organizationName: string;
  approveLabel: string;
  rejectLabel: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="organization-review">
      <div className="organization-review__media">
        <img src={event.image} alt={`Visuel ${event.title}`} />
      </div>
      <div className="organization-review__content">
        <div className="organization-review__header">
          <div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
          </div>
          <StatusBadge variant="pending">En attente</StatusBadge>
        </div>
        <dl className="organization-review__details">
          <div>
            <dt>Organization</dt>
            <dd>{organizationName}</dd>
          </div>
          <div>
            <dt>Debut / fin</dt>
            <dd>{formatEventDateRange(event)}</dd>
          </div>
          <div>
            <dt>Adresse</dt>
            <dd>
              {event.address}, {event.city} {event.postal_code}
            </dd>
          </div>
        </dl>
        <DecisionReason
          value={reason}
          placeholder="Raison obligatoire en cas de refus"
          onChange={onReasonChange}
        />
        <div className="admin-actions">
          <Button type="button" onClick={onApprove}>
            {approveLabel}
          </Button>
          <Button variant="danger" type="button" onClick={onReject}>
            {rejectLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

function PublishedEventModerationCard({
  event,
  organizationName,
  suspensionDays,
  suspensionReason,
  deleteReason,
  onSuspensionDaysChange,
  onSuspensionReasonChange,
  onDeleteReasonChange,
  onSuspend,
  onDelete,
}: {
  event: Event;
  organizationName: string;
  suspensionDays: string;
  suspensionReason: string;
  deleteReason: string;
  onSuspensionDaysChange: (value: string) => void;
  onSuspensionReasonChange: (reason: string) => void;
  onDeleteReasonChange: (reason: string) => void;
  onSuspend: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="organization-review">
      <div className="organization-review__media">
        <img src={event.image} alt={`Visuel ${event.title}`} />
      </div>
      <div className="organization-review__content">
        <div className="organization-review__header">
          <div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
          </div>
          <StatusBadge variant="active">Publie</StatusBadge>
        </div>
        <dl className="organization-review__details">
          <div>
            <dt>Organization</dt>
            <dd>{organizationName}</dd>
          </div>
          <div>
            <dt>Debut / fin</dt>
            <dd>{formatEventDateRange(event)}</dd>
          </div>
        </dl>
        <div className="moderator-split-actions moderator-split-actions--event">
          <div className="moderator-event-suspension">
            <label className="moderator-days">
              Jours
              <Input
                min={1}
                max={90}
                type="number"
                value={suspensionDays}
                onChange={(event) =>
                  onSuspensionDaysChange(event.target.value)
                }
              />
            </label>
            <DecisionReason
              value={suspensionReason}
              placeholder="Motif de suspension"
              onChange={onSuspensionReasonChange}
            />
            <Button variant="secondary" type="button" onClick={onSuspend}>
              Suspendre
            </Button>
          </div>
          <DecisionReason
            value={deleteReason}
            placeholder="Raison de suppression"
            onChange={onDeleteReasonChange}
          />
          <Button variant="danger" type="button" onClick={onDelete}>
            Supprimer
          </Button>
        </div>
      </div>
    </article>
  );
}

function SuspendedEventModerationCard({
  event,
  organizationName,
  onLift,
}: {
  event: Event;
  organizationName: string;
  onLift: () => void;
}) {
  return (
    <article className="organization-review">
      <div className="organization-review__media">
        <img src={event.image} alt={`Visuel ${event.title}`} />
      </div>
      <div className="organization-review__content">
        <div className="organization-review__header">
          <div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
          </div>
          <StatusBadge variant="suspended">Suspendu</StatusBadge>
        </div>
        <dl className="organization-review__details">
          <div>
            <dt>Organization</dt>
            <dd>{organizationName}</dd>
          </div>
          <div>
            <dt>Fin de suspension</dt>
            <dd>Jusqu'au {formatDate(event.suspended_until)}</dd>
          </div>
          <div>
            <dt>Motif</dt>
            <dd>{event.suspension_reason ?? "Motif non renseigne"}</dd>
          </div>
        </dl>
        <div className="admin-actions">
          <Button type="button" onClick={onLift}>
            Lever suspension
          </Button>
        </div>
      </div>
    </article>
  );
}

function OrganizationModerationCard({
  organization,
  reason,
  onReasonChange,
  onApprove,
  onReject,
}: {
  organization: Organization;
  reason: string;
  onReasonChange: (reason: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="organization-review">
      <div className="organization-review__media">
        <img src={organization.logo ?? ""} alt={`Logo ${organization.name}`} />
      </div>
      <div className="organization-review__content">
        <div className="organization-review__header">
          <div>
            <h3>{organization.name}</h3>
            <p>{organization.description}</p>
          </div>
          <StatusBadge variant="pending">En attente</StatusBadge>
        </div>
        <dl className="organization-review__details">
          <div>
            <dt>Email</dt>
            <dd>{organization.contact_email}</dd>
          </div>
          <div>
            <dt>SIRET</dt>
            <dd>{organization.siret ?? "Non renseigne"}</dd>
          </div>
          <div>
            <dt>Adresse</dt>
            <dd>
              {organization.address}, {organization.city} {organization.postal_code}
            </dd>
          </div>
        </dl>
        <DecisionReason
          value={reason}
          placeholder="Raison obligatoire en cas de refus"
          onChange={onReasonChange}
        />
        <div className="admin-actions">
          <Button type="button" onClick={onApprove}>
            Valider
          </Button>
          <Button variant="danger" type="button" onClick={onReject}>
            Refuser
          </Button>
        </div>
      </div>
    </article>
  );
}

function ReportGroup({
  title,
  reports,
  emptyText,
  events,
  organizations,
  accountSummaries,
  users,
  decisionMessages,
  onDecisionMessageChange,
  onStatusChange,
}: {
  title: string;
  reports: ModerationReport[];
  emptyText: string;
  events: Event[];
  organizations: Organization[];
  accountSummaries: AccountSummary[];
  users: User[];
  decisionMessages: Record<number, string>;
  onDecisionMessageChange: (reportId: number, message: string) => void;
  onStatusChange: (
    report: ModerationReport,
    status: ModerationReport["status"],
    moderatorMessage?: string,
  ) => void;
}) {
  return (
    <div className="moderator-report-group">
      <div className="moderator-report-group__title">
        <h3>{title}</h3>
        <span className="admin-count">{reports.length}</span>
      </div>

      {reports.length === 0 ? (
        <EmptyState message={emptyText} />
      ) : (
        <div className="organization-review-list">
          {reports.map((report) => (
            <ReportCard
              report={report}
              key={report.id}
              targetLabel={getReportTargetLabel(
                report,
                events,
                organizations,
                accountSummaries,
              )}
              reporterName={getUserName(report.reporter_user_id, users)}
              handlerName={
                report.handled_by_user_id
                  ? getUserName(report.handled_by_user_id, users)
                  : "Non assigne"
              }
              decisionMessage={decisionMessages[report.id] ?? ""}
              onDecisionMessageChange={(message) =>
                onDecisionMessageChange(report.id, message)
              }
              onReview={() => onStatusChange(report, "reviewing")}
              onResolve={(message) =>
                onStatusChange(report, "resolved", message)
              }
              onDismiss={(message) =>
                onStatusChange(report, "dismissed", message)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report,
  targetLabel,
  reporterName,
  handlerName,
  decisionMessage,
  onDecisionMessageChange,
  onReview,
  onResolve,
  onDismiss,
}: {
  report: ModerationReport;
  targetLabel: string;
  reporterName: string;
  handlerName: string;
  decisionMessage: string;
  onDecisionMessageChange: (message: string) => void;
  onReview: () => void;
  onResolve: (message: string) => void;
  onDismiss: (message: string) => void;
}) {
  const outcome = isHandledReportStatus(report.status)
    ? handledReportOutcomes[report.status]
    : null;
  const isHandled = outcome !== null;
  const decisionText = outcome
    ? report.resolution_note ?? outcome.note
    : null;

  return (
    <article className="organization-review moderator-report">
      <div className="organization-review__content">
        <div className="organization-review__header">
          <div>
            <h3>{report.reason}</h3>
            <p>{report.details}</p>
          </div>
          <div className="moderator-report__meta">
            <StatusBadge>
              {reportPriorityLabels[report.priority]}
            </StatusBadge>
            {outcome ? (
              <StatusBadge variant={outcome.variant}>
                {outcome.label}
              </StatusBadge>
            ) : null}
          </div>
        </div>
        <dl className="organization-review__details">
          <div>
            <dt>Cible</dt>
            <dd>{targetLabel}</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>{reportStatusLabels[report.status]}</dd>
          </div>
          <div>
            <dt>Signale par</dt>
            <dd>{reporterName}</dd>
          </div>
          <div>
            <dt>Assigne a</dt>
            <dd>{handlerName}</dd>
          </div>
        </dl>
        {decisionText ? (
          <div className="moderator-report__decision">
            <strong>Decision</strong>
            <p>{decisionText}</p>
          </div>
        ) : null}
        {!isHandled ? (
          <>
            <label className="moderator-reason moderator-report__message">
              Message du moderateur
              <Textarea
                rows={3}
                placeholder="Expliquez la decision qui sera transmise par notification"
                value={decisionMessage}
                onChange={(event) =>
                  onDecisionMessageChange(event.target.value)
                }
              />
            </label>
            <div className="admin-actions">
              {report.status === "open" ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={onReview}
                >
                  Prendre en charge
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => onResolve(decisionMessage)}
              >
                Marquer suspendu
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => onDismiss(decisionMessage)}
              >
                Marquer restaure
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}

function AccountSuspensionSection({
  title,
  accounts,
  suspensionDays,
  getReason,
  onReasonChange,
  onDaysChange,
  onSuspend,
}: {
  title: string;
  accounts: AccountSummary[];
  suspensionDays: Record<number, string>;
  getReason: (
    targetType: ModerationTargetType,
    targetId: number,
    action: ModerationAction,
  ) => string;
  onReasonChange: (accountId: number, reason: string) => void;
  onDaysChange: (accountId: number, value: string) => void;
  onSuspend: (account: AccountSummary) => void;
}) {
  return (
    <section className="admin-section admin-section--wide moderator-account-section">
      <div className="admin-section__title">
        <h2>{title}</h2>
        <span className="admin-count">{accounts.length}</span>
      </div>

      {accounts.length === 0 ? (
        <EmptyState message="Aucun compte actif a suspendre." />
      ) : (
        <div
          className="admin-table admin-table--accounts moderator-account-table"
          role="table"
          aria-label={title}
        >
          <div className="admin-table__row admin-table__row--head" role="row">
            <span role="columnheader">Compte</span>
            <span role="columnheader">Role</span>
            <span role="columnheader">Jours</span>
            <span role="columnheader">Raison</span>
            <span role="columnheader">Action</span>
          </div>
          <div role="rowgroup">
            {accounts.map((account) => (
              <div
                className="admin-table__row moderator-account-row"
                role="row"
                key={account.account_id}
              >
                <div className="moderator-account-identity" role="cell">
                  <span>{account.display_name}</span>
                  <small>{account.login_email}</small>
                </div>
                <StatusBadge role="cell">
                  {accountRoleLabels[account.role]}
                </StatusBadge>
                <label className="moderator-days" role="cell">
                  Jours
                  <Input
                    min={1}
                    max={90}
                    type="number"
                    value={suspensionDays[account.account_id] ?? "7"}
                    onChange={(event) =>
                      onDaysChange(account.account_id, event.target.value)
                    }
                  />
                </label>
                <label className="moderator-reason moderator-reason--compact" role="cell">
                  Raison
                  <Textarea
                    rows={2}
                    placeholder="Motif de suspension"
                    value={getReason(
                      "account",
                      account.account_id,
                      "account_suspended",
                    )}
                    onChange={(event) =>
                      onReasonChange(account.account_id, event.target.value)
                    }
                  />
                </label>
                <div role="cell">
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => onSuspend(account)}
                  >
                    Suspendre
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function OrganizerAccountsSection({
  rows,
}: {
  rows: OrganizerRow[];
}) {
  return (
    <section className="admin-section admin-section--wide moderator-organizers-section">
      <div className="admin-section__title">
        <h2>Comptes employes</h2>
        <span className="admin-count">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Aucun compte employe rattache." />
      ) : (
        <div
          className="admin-table admin-table--organizers"
          role="table"
          aria-label="Comptes employes"
        >
          <div className="admin-table__row admin-table__row--head" role="row">
            <span role="columnheader">Employe</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Organization</span>
            <span role="columnheader">Poste</span>
            <span role="columnheader">Statut</span>
          </div>
          <div role="rowgroup">
            {rows.map(({ member, user, account, organization }) => {
              const isActiveAccount =
                !!account &&
                account.is_active &&
                !account.deleted_at &&
                !isAccountSuspended(account);
              const statusLabel = !account
                ? "Compte introuvable"
                : isAccountSuspended(account)
                  ? "Suspendu"
                  : isActiveAccount
                    ? "Actif"
                    : "Inactif";

              return (
                <div className="admin-table__row" role="row" key={member.id}>
                  <div className="moderator-account-identity" role="cell">
                    <span>{user?.username ?? `Utilisateur #${member.user_id}`}</span>
                    <small>Membre #{member.id}</small>
                  </div>
                  <span role="cell">
                    {account?.login_email ?? "Email introuvable"}
                  </span>
                  <span role="cell">
                    {organization?.name ?? `Organization #${member.organization_id}`}
                  </span>
                  <span role="cell">{member.job_role ?? "Non renseigne"}</span>
                  <StatusBadge
                    variant={isActiveAccount ? "active" : "pending"}
                    role="cell"
                  >
                    {statusLabel}
                  </StatusBadge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function SuspendedAccountsSection({
  userAccounts,
  organizationAccounts,
}: {
  userAccounts: AccountSummary[];
  organizationAccounts: AccountSummary[];
}) {
  const totalSuspendedAccounts = userAccounts.length + organizationAccounts.length;

  if (totalSuspendedAccounts === 0) return null;

  return (
    <section className="admin-section admin-section--wide moderator-suspended-section">
      <div className="admin-section__title">
        <h2>Suspensions en cours</h2>
        <span className="admin-count">{totalSuspendedAccounts}</span>
      </div>

      <div className="moderator-suspended-groups">
        <SuspendedAccountList title="Utilisateurs" accounts={userAccounts} />
        <SuspendedAccountList title="Organizations" accounts={organizationAccounts} />
      </div>
    </section>
  );
}

function SuspendedOrganizationsSection({
  accounts,
}: {
  accounts: AccountSummary[];
}) {
  return (
    <section className="admin-section admin-section--wide moderator-suspended-section">
      <div className="admin-section__title">
        <h2>Organizations suspendues</h2>
        <span className="admin-count">{accounts.length}</span>
      </div>

      {accounts.length === 0 ? (
        <EmptyState message="Aucune organization suspendue." />
      ) : (
        <SuspendedAccountList title="Organizations" accounts={accounts} />
      )}
    </section>
  );
}

function SuspendedAccountList({
  title,
  accounts,
}: {
  title: string;
  accounts: AccountSummary[];
}) {
  if (accounts.length === 0) return null;

  return (
    <div className="moderator-suspended-group">
      <div className="moderator-suspended-group__title">
        <h3>{title}</h3>
        <span className="admin-count">{accounts.length}</span>
      </div>
      <div
        className="admin-table admin-table--suspended"
        role="table"
        aria-label={`${title} suspendus`}
      >
        <div className="admin-table__row admin-table__row--head" role="row">
          <span role="columnheader">Compte</span>
          <span role="columnheader">Role</span>
          <span role="columnheader">Fin</span>
          <span role="columnheader">Motif</span>
        </div>
        <div role="rowgroup">
          {accounts.map((account) => (
            <div className="admin-table__row" role="row" key={account.account_id}>
              <div className="moderator-account-identity" role="cell">
                <span>{account.display_name}</span>
                <small>{account.login_email}</small>
              </div>
              <StatusBadge role="cell">
                {accountRoleLabels[account.role]}
              </StatusBadge>
              <span role="cell">Jusqu'au {formatDate(account.suspended_until)}</span>
              <span role="cell">{account.suspension_reason ?? "Motif non renseigne"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DecisionReason({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="moderator-reason">
      Raison
      <Textarea
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function getReportTargetLabel(
  report: ModerationReport,
  events: Event[],
  organizations: Organization[],
  accountSummaries: AccountSummary[],
) {
  if (report.target_type === "event") {
    return events.find((event) => event.id === report.target_id)?.title ?? "Evenement";
  }

  if (report.target_type === "organization") {
    return (
      organizations.find((organization) => organization.id === report.target_id)?.name ??
      "Organization"
    );
  }

  return (
    accountSummaries.find((account) => account.account_id === report.target_id)
      ?.display_name ?? `Compte #${report.target_id}`
  );
}

function getUserName(userId: number, users: User[]) {
  return users.find((user) => user.id === userId)?.username ?? `Utilisateur #${userId}`;
}
