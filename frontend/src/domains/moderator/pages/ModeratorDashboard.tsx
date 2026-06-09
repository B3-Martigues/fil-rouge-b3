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
import type { Company } from "../../companies/types/company";
import type { CompanyMember } from "../../companies/types/company-member";
import type { Event } from "../../events/types/event";
import { formatEventDateRange } from "../../events/utils/event";
import {
  createAccountSuspendedNotification,
  createCompanyApprovedNotification,
  createCompanyRejectedNotification,
  createEventApprovedNotification,
  createEventDeletedNotification,
  createEventHiddenNotification,
  createEventRejectedNotification,
  createEventWithdrawnAfterReportNotification,
  createReportUsefulNotification,
} from "../../notifications/services/notificationFactory";
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

type ModeratorView = "dashboard" | "events" | "companies" | "accounts" | "reports";

type ModeratorDashboardProps = {
  view?: ModeratorView;
};

type CompanyMemberRow = {
  member: CompanyMember;
  user?: User;
  account?: Account;
  company?: Company;
};

type HandledReportStatus = Extract<
  ModerationReport["status"],
  "resolved" | "dismissed"
>;
type ModerationEventFilter = "all" | "pending" | "published";
type ModerationEventSort = "date-asc" | "date-desc" | "title-asc" | "city-asc";
type ModerationCompanyFilter = "all" | "pending" | "active" | "suspended";
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

const finalCompanyActions: ModerationAction[] = ["company_rejected"];

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
  companies: {
    title: "Moderation des entreprises",
    description:
      "Validation, comptes entreprise et collaborateurs rattaches aux fiches.",
  },
  accounts: {
    title: "Moderation des comptes",
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
  company: "Entreprise",
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
  company_approved: "Entreprise validee",
  company_rejected: "Entreprise refusee",
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
  const companies = useDataStore((s) => s.companies);
  const companyMembers = useDataStore((s) => s.companyMembers);
  const events = useDataStore((s) => s.events);
  const moderationReports = useDataStore((s) => s.moderationReports);
  const moderationDecisions = useDataStore((s) => s.moderationDecisions);
  const updateCompany = useDataStore((s) => s.updateCompany);
  const activateCompany = useDataStore((s) => s.activateCompany);
  const updateEvent = useDataStore((s) => s.updateEvent);
  const approveEvent = useDataStore((s) => s.approveEvent);
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
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<ModerationEventFilter>("all");
  const [eventSort, setEventSort] = useState<ModerationEventSort>("date-asc");
  const [companySearch, setCompanySearch] = useState("");
  const [companyFilter, setCompanyFilter] =
    useState<ModerationCompanyFilter>("all");
  const [companySort, setCompanySort] =
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
    () => buildAccountSummaries(accounts, users, companies),
    [accounts, companies, users],
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

  const activeCompanies = companies.filter((company) => !company.deleted_at);
  const visibleEvents = events.filter((event) => !event.deleted_at);
  const pendingEvents = visibleEvents.filter((event) => {
    const latestDecision = latestDecisionByTarget.get(
      getTargetKey("event", event.id),
    );

    return (
      !event.is_active &&
      (!latestDecision || !finalEventActions.includes(latestDecision))
    );
  });
  const publishedEvents = visibleEvents.filter((event) => event.is_active);
  const pendingCompanies = activeCompanies.filter((company) => {
    const latestDecision = latestDecisionByTarget.get(
      getTargetKey("company", company.id),
    );

    return (
      !company.is_active &&
      (!latestDecision || !finalCompanyActions.includes(latestDecision))
    );
  });
  const pendingReports = moderationReports.filter(
    (report) => report.status === "open",
  );
  const reviewingReports = moderationReports.filter(
    (report) => report.status === "reviewing",
  );
  const activeReportsCount = pendingReports.length + reviewingReports.length;
  const moderatableAccounts = accountSummaries.filter(
    (account) =>
      (account.role === "user" || account.role === "company") &&
      account.is_active &&
      !isAccountSuspended(account),
  );
  const suspendedAccounts = accountSummaries.filter(
    (account) =>
      (account.role === "user" || account.role === "company") &&
      isAccountSuspended(account),
  );
  const userAccountsToModerate = moderatableAccounts.filter(
    (account) => account.role === "user",
  );
  const companyAccountsToModerate = moderatableAccounts.filter(
    (account) => account.role === "company",
  );
  const suspendedUserAccounts = suspendedAccounts.filter(
    (account) => account.role === "user",
  );
  const suspendedCompanyAccounts = suspendedAccounts.filter(
    (account) => account.role === "company",
  );
  const companyMemberRows = useMemo<CompanyMemberRow[]>(() => {
    const companyById = new Map(
      companies.map((company) => [company.id, company]),
    );
    const userById = new Map(users.map((user) => [user.id, user]));
    const accountById = new Map(accounts.map((account) => [account.id, account]));

    return companyMembers
      .filter((member) => !member.deleted_at)
      .map((member) => {
        const user = userById.get(member.user_id);

        return {
          member,
          user,
          account: user ? accountById.get(user.account_id) : undefined,
          company: companyById.get(member.company_id),
        };
      });
  }, [accounts, companies, companyMembers, users]);

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

  const getCompanyName = (companyId: number) =>
    activeCompanies.find((company) => company.id === companyId)?.name ??
    "Entreprise introuvable";

  const getCompanyNotificationUser = (company: Company) => {
    const companyMember = companyMembers.find(
      (member) => member.company_id === company.id && !member.deleted_at,
    );

    return (
      users.find(
        (user) => user.id === companyMember?.user_id && !user.deleted_at,
      ) ??
      users.find(
        (user) => user.account_id === company.account_id && !user.deleted_at,
      )
    );
  };

  const notifyCompany = (
    company: Company,
    buildNotification: (user: User) => Parameters<typeof dispatchNotification>[0],
  ) => {
    const notificationUser = getCompanyNotificationUser(company);

    if (!notificationUser) {
      toast.error("Aucun membre entreprise rattache pour notifier la decision");
      return;
    }

    void dispatchNotification(buildNotification(notificationUser));
  };

  const getCompanyMemberUsers = (companyId: number) => {
    const memberUserIds = new Set(
      companyMembers
        .filter((member) => member.company_id === companyId && !member.deleted_at)
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
    const targetCompany =
      report.target_type === "company"
        ? companies.find((company) => company.id === report.target_id) ?? null
        : targetEvent
          ? companies.find((company) => company.id === targetEvent.company_id) ??
            null
          : null;

    void dispatchNotification(
      createReportUsefulNotification({
        user: reporter,
        targetLabel: getReportTargetLabel(
          report,
          events,
          companies,
          accountSummaries,
        ),
        moderatorMessage,
        event: targetEvent,
        company: targetCompany,
      }),
    );
  };

  const withdrawReportedEventAndNotifyCompany = (
    report: ModerationReport,
    moderatorMessage: string,
  ) => {
    if (report.target_type !== "event") return;

    const event = events.find(
      (item) => item.id === report.target_id && !item.deleted_at,
    );

    if (!event) return;

    const company = activeCompanies.find((item) => item.id === event.company_id);

    if (!company) return;

    recordDecision("event_deleted", "event", event.id, moderatorMessage);
    deleteEvent(event.id);

    getCompanyMemberUsers(company.id).forEach((user) => {
      void dispatchNotification(
        createEventWithdrawnAfterReportNotification({
          company,
          event,
          user,
          moderatorMessage,
        }),
      );
    });
  };

  const handleApproveCompany = (company: Company) => {
    activateCompany(company.id);
    notifyCompany(company, (user) =>
      createCompanyApprovedNotification({ company, user }),
    );
    recordDecision("company_approved", "company", company.id, "Compte valide");
    toast.success(`${company.name} est validee`);
  };

  const handleRejectCompany = (company: Company) => {
    const reason = getReason("company", company.id, "company_rejected");

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de refus");
      return;
    }

    updateCompany(company.id, {
      is_active: false,
      is_verified: false,
    });
    notifyCompany(company, (user) =>
      createCompanyRejectedNotification({ company, user, reason }),
    );
    recordDecision("company_rejected", "company", company.id, reason);
    clearReason("company", company.id, "company_rejected");
    toast.success(`${company.name} est refusee`);
  };

  const handleApproveEvent = (event: Event) => {
    const company = activeCompanies.find(
      (item) => item.id === event.company_id && item.is_active,
    );

    if (!company) {
      toast.error("Impossible de publier un evenement d'une entreprise inactive");
      return;
    }

    approveEvent(event.id);
    notifyCompany(company, (user) =>
      createEventApprovedNotification({ company, event, user }),
    );
    recordDecision("event_approved", "event", event.id, "Evenement valide");
    toast.success(`${event.title} est publie`);
  };

  const handleRejectEvent = (event: Event) => {
    const reason = getReason("event", event.id, "event_rejected");
    const company = activeCompanies.find((item) => item.id === event.company_id);

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de refus");
      return;
    }

    if (!company) {
      toast.error("Entreprise rattachee introuvable");
      return;
    }

    updateEvent(event.id, { is_active: false });
    notifyCompany(company, (user) =>
      createEventRejectedNotification({ company, event, user, reason }),
    );
    recordDecision("event_rejected", "event", event.id, reason);
    clearReason("event", event.id, "event_rejected");
    toast.success(`${event.title} est refuse`);
  };

  const handleHideEvent = (event: Event) => {
    const reason = getReason("event", event.id, "event_hidden");
    const company = activeCompanies.find((item) => item.id === event.company_id);

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de masquage");
      return;
    }

    if (!company) {
      toast.error("Entreprise rattachee introuvable");
      return;
    }

    updateEvent(event.id, { is_active: false });
    notifyCompany(company, (user) =>
      createEventHiddenNotification({ company, event, user, reason }),
    );
    recordDecision("event_hidden", "event", event.id, reason);
    clearReason("event", event.id, "event_hidden");
    toast.success(`${event.title} est masque`);
  };

  const handleDeleteEvent = (event: Event) => {
    const reason = getReason("event", event.id, "event_deleted");
    const company = activeCompanies.find((item) => item.id === event.company_id);

    if (isReasonMissing(reason)) {
      toast.error("Ajoutez une raison de suppression");
      return;
    }

    if (!company) {
      toast.error("Entreprise rattachee introuvable");
      return;
    }

    if (
      !window.confirm(
        `Supprimer l'evenement "${event.title}" ? Cette action retire l'evenement du mock.`,
      )
    ) {
      return;
    }

    notifyCompany(company, (user) =>
      createEventDeletedNotification({ company, event, user, reason }),
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
    const company = account.company_id
      ? companies.find((item) => item.id === account.company_id)
      : null;

    suspendAccount(account.account_id, reason, suspendedUntil);
    void dispatchNotification(
      createAccountSuspendedNotification({
        user,
        company,
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

    if (report.target_type === "company") {
      const reportedCompany = companies.find(
        (company) => company.id === report.target_id && !company.deleted_at,
      );

      if (!reportedCompany) return;

      updateCompany(reportedCompany.id, {
        is_active: false,
        is_verified: false,
      });
      notifyCompany(reportedCompany, (user) =>
        createCompanyRejectedNotification({
          company: reportedCompany,
          user,
          reason: decisionMessage,
        }),
      );
      recordDecision(
        "company_rejected",
        "company",
        reportedCompany.id,
        decisionMessage,
      );

      const reportedCompanyAccount = accountSummaries.find(
        (account) => account.company_id === reportedCompany.id,
      );

      if (reportedCompanyAccount) {
        handleSuspendAccountSummary(reportedCompanyAccount, decisionMessage, 7);
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
      withdrawReportedEventAndNotifyCompany(report, decisionMessage);
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
    filter: ModerationAccountFilter | ModerationCompanyFilter,
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
          : [...pendingEvents, ...publishedEvents];

    return sourceEvents
      .filter((event) =>
        normalizeText(
          [
            event.title,
            event.description,
            event.city,
            event.postal_code,
            event.address,
            activeCompanies.find((company) => company.id === event.company_id)
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
  const filteredPendingEvents = filteredEvents.filter((event) => !event.is_active);
  const filteredPublishedEvents = filteredEvents.filter((event) => event.is_active);

  const filteredCompanies = (() => {
    const companySearchText = normalizeText(companySearch);
    const sourceCompanies =
      companyFilter === "active" || companyFilter === "suspended"
        ? []
        : pendingCompanies;

    return [...sourceCompanies]
      .filter((company) =>
        normalizeText(
          [
            company.name,
            company.contact_email,
            company.description ?? "",
            company.city,
            company.postal_code,
            company.siret ?? "",
          ].join(" "),
        ).includes(companySearchText),
      )
      .sort((firstCompany, secondCompany) =>
        companySort === "name-desc"
          ? secondCompany.name.localeCompare(firstCompany.name, "fr-FR")
          : firstCompany.name.localeCompare(secondCompany.name, "fr-FR"),
      );
  })();
  const filteredCompanyAccounts = filterAccounts(
    companyAccountsToModerate,
    suspendedCompanyAccounts,
    companyFilter,
    companySearch,
    companySort,
  );
  const filteredCompanyMembers = companyMemberRows
    .filter(({ member, user, account, company }) =>
      normalizeText(
        [
          user?.username ?? "",
          account?.login_email ?? "",
          company?.name ?? "",
          member.job_role ?? "",
        ].join(" "),
      ).includes(normalizeText(companySearch)),
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
  const filteredActiveCompanyAccounts = filteredCompanyAccounts.filter(
    (account) => !isAccountSuspended(account),
  );
  const filteredSuspendedCompanyAccounts = filteredCompanyAccounts.filter(
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
          companies,
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
  const isCompaniesView = view === "companies";
  const isAccountsView = view === "accounts";
  const isReportsView = view === "reports";
  const currentViewContent = viewContent[view];
  const moderatorStats = [
    {
      label: "Comptes",
      to: ROUTES.MODERATOR.DASHBOARD,
      value: userAccountsToModerate.length + suspendedUserAccounts.length,
      end: true,
    },
    {
      label: "Evenements",
      to: ROUTES.MODERATOR.EVENTS,
      value: pendingEvents.length,
    },
    {
      label: "Entreprises",
      to: ROUTES.MODERATOR.COMPANIES,
      value:
        pendingCompanies.length +
        companyAccountsToModerate.length +
        suspendedCompanyAccounts.length,
    },
    {
      label: "Signalements",
      to: ROUTES.MODERATOR.REPORTS,
      value: activeReportsCount,
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
              placeholder="Titre, ville, entreprise..."
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
            <div className="company-review-list">
              {filteredPendingEvents.map((event) => (
                <EventModerationCard
                  event={event}
                  companyName={getCompanyName(event.company_id)}
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
            <div className="company-review-list">
              {filteredPublishedEvents.map((event) => (
                <PublishedEventModerationCard
                  event={event}
                  companyName={getCompanyName(event.company_id)}
                  hideReason={getReason("event", event.id, "event_hidden")}
                  deleteReason={getReason("event", event.id, "event_deleted")}
                  key={event.id}
                  onHideReasonChange={(reason) =>
                    updateReason("event", event.id, "event_hidden", reason)
                  }
                  onDeleteReasonChange={(reason) =>
                    updateReason("event", event.id, "event_deleted", reason)
                  }
                  onHide={() => handleHideEvent(event)}
                  onDelete={() => handleDeleteEvent(event)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {isCompaniesView && (
        <Toolbar ariaLabel="Filtres des entreprises" className="admin-toolbar">
          <label>
            Rechercher
            <Input
              value={companySearch}
              placeholder="Entreprise, email, SIRET..."
              onChange={(event) => setCompanySearch(event.target.value)}
            />
          </label>
          <label>
            Statut
            <Select
              value={companyFilter}
              onChange={(event) =>
                setCompanyFilter(event.target.value as ModerationCompanyFilter)
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
              value={companySort}
              onChange={(event) =>
                setCompanySort(event.target.value as ModerationAccountSort)
              }
            >
              <option value="name-asc">Nom A-Z</option>
              <option value="name-desc">Nom Z-A</option>
              <option value="email-asc">Email A-Z</option>
            </Select>
          </label>
        </Toolbar>
      )}

      {isCompaniesView && (
        <section className="admin-section admin-section--wide">
          <div className="admin-section__title">
            <h2>Comptes entreprise proposes</h2>
            <span className="admin-count">{filteredCompanies.length}</span>
          </div>

          {filteredCompanies.length === 0 ? (
            <EmptyState message="Aucun compte entreprise en attente." />
          ) : (
            <div className="company-review-list">
              {filteredCompanies.map((company) => (
                <CompanyModerationCard
                  company={company}
                  key={company.id}
                  reason={getReason("company", company.id, "company_rejected")}
                  onReasonChange={(reason) =>
                    updateReason("company", company.id, "company_rejected", reason)
                  }
                  onApprove={() => handleApproveCompany(company)}
                  onReject={() => handleRejectCompany(company)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {isCompaniesView && (
        <>
          <AccountSuspensionSection
            accounts={filteredActiveCompanyAccounts}
            getReason={getReason}
            onDaysChange={updateSuspensionDays}
            onReasonChange={(accountId, reason) =>
              updateReason("account", accountId, "account_suspended", reason)
            }
            onSuspend={handleSuspendAccount}
            suspensionDays={suspensionDays}
            title="Liste des entreprise"
          />

          <CompanyMemberAccountsSection rows={filteredCompanyMembers} />

          <SuspendedAccountsSection
            companyAccounts={filteredSuspendedCompanyAccounts}
            userAccounts={[]}
          />
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
            companyAccounts={[]}
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
                companies={companies}
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
                companies={companies}
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
                companies={companies}
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
  companyName,
  approveLabel,
  rejectLabel,
  reason,
  onReasonChange,
  onApprove,
  onReject,
}: {
  event: Event;
  companyName: string;
  approveLabel: string;
  rejectLabel: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="company-review">
      <div className="company-review__media">
        <img src={event.image} alt={`Visuel ${event.title}`} />
      </div>
      <div className="company-review__content">
        <div className="company-review__header">
          <div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
          </div>
          <StatusBadge variant="pending">En attente</StatusBadge>
        </div>
        <dl className="company-review__details">
          <div>
            <dt>Entreprise</dt>
            <dd>{companyName}</dd>
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
  companyName,
  hideReason,
  deleteReason,
  onHideReasonChange,
  onDeleteReasonChange,
  onHide,
  onDelete,
}: {
  event: Event;
  companyName: string;
  hideReason: string;
  deleteReason: string;
  onHideReasonChange: (reason: string) => void;
  onDeleteReasonChange: (reason: string) => void;
  onHide: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="company-review">
      <div className="company-review__media">
        <img src={event.image} alt={`Visuel ${event.title}`} />
      </div>
      <div className="company-review__content">
        <div className="company-review__header">
          <div>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
          </div>
          <StatusBadge variant="active">Publie</StatusBadge>
        </div>
        <dl className="company-review__details">
          <div>
            <dt>Entreprise</dt>
            <dd>{companyName}</dd>
          </div>
          <div>
            <dt>Debut / fin</dt>
            <dd>{formatEventDateRange(event)}</dd>
          </div>
        </dl>
        <div className="moderator-split-actions">
          <DecisionReason
            value={hideReason}
            placeholder="Raison de masquage"
            onChange={onHideReasonChange}
          />
          <Button variant="secondary" type="button" onClick={onHide}>
            Masquer
          </Button>
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

function CompanyModerationCard({
  company,
  reason,
  onReasonChange,
  onApprove,
  onReject,
}: {
  company: Company;
  reason: string;
  onReasonChange: (reason: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <article className="company-review">
      <div className="company-review__media">
        <img src={company.logo ?? ""} alt={`Logo ${company.name}`} />
      </div>
      <div className="company-review__content">
        <div className="company-review__header">
          <div>
            <h3>{company.name}</h3>
            <p>{company.description}</p>
          </div>
          <StatusBadge variant="pending">En attente</StatusBadge>
        </div>
        <dl className="company-review__details">
          <div>
            <dt>Email</dt>
            <dd>{company.contact_email}</dd>
          </div>
          <div>
            <dt>SIRET</dt>
            <dd>{company.siret ?? "Non renseigne"}</dd>
          </div>
          <div>
            <dt>Adresse</dt>
            <dd>
              {company.address}, {company.city} {company.postal_code}
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
  companies,
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
  companies: Company[];
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
        <div className="company-review-list">
          {reports.map((report) => (
            <ReportCard
              report={report}
              key={report.id}
              targetLabel={getReportTargetLabel(
                report,
                events,
                companies,
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
    <article className="company-review moderator-report">
      <div className="company-review__content">
        <div className="company-review__header">
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
        <dl className="company-review__details">
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

function CompanyMemberAccountsSection({
  rows,
}: {
  rows: CompanyMemberRow[];
}) {
  return (
    <section className="admin-section admin-section--wide moderator-company-members-section">
      <div className="admin-section__title">
        <h2>Comptes employes</h2>
        <span className="admin-count">{rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState message="Aucun compte employe rattache." />
      ) : (
        <div
          className="admin-table admin-table--company-members"
          role="table"
          aria-label="Comptes employes"
        >
          <div className="admin-table__row admin-table__row--head" role="row">
            <span role="columnheader">Employe</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Entreprise</span>
            <span role="columnheader">Poste</span>
            <span role="columnheader">Statut</span>
          </div>
          <div role="rowgroup">
            {rows.map(({ member, user, account, company }) => {
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
                    {company?.name ?? `Entreprise #${member.company_id}`}
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
  companyAccounts,
}: {
  userAccounts: AccountSummary[];
  companyAccounts: AccountSummary[];
}) {
  const totalSuspendedAccounts = userAccounts.length + companyAccounts.length;

  if (totalSuspendedAccounts === 0) return null;

  return (
    <section className="admin-section admin-section--wide moderator-suspended-section">
      <div className="admin-section__title">
        <h2>Suspensions en cours</h2>
        <span className="admin-count">{totalSuspendedAccounts}</span>
      </div>

      <div className="moderator-suspended-groups">
        <SuspendedAccountList title="Utilisateurs" accounts={userAccounts} />
        <SuspendedAccountList title="Entreprises" accounts={companyAccounts} />
      </div>
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
  companies: Company[],
  accountSummaries: AccountSummary[],
) {
  if (report.target_type === "event") {
    return events.find((event) => event.id === report.target_id)?.title ?? "Evenement";
  }

  if (report.target_type === "company") {
    return (
      companies.find((company) => company.id === report.target_id)?.name ??
      "Entreprise"
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
