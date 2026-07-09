import { createApiSuccess, type ApiResult } from "../../../shared/api/api.types";
import { apiRequest } from "../../../shared/api/httpClient";
import { toBackendId } from "../../../shared/api/idMapping";
import type { Event } from "../../event/types/event";
import type { ModerationDecision, ModerationReport } from "../../moderator/types/moderation";
import type { Notification, NotificationType } from "../../notification/types/notification";
import type { Organization } from "../../organization/types/organization";
import type { Organizer } from "../../organization/types/organizer";
import type { Account, User } from "../../user/types/user";

export type StaffDataSet = {
  summary: StaffSummary;
  accounts: Account[];
  users: User[];
  organizations: Organization[];
  organizers: Organizer[];
  events: Event[];
  notificationTypes: NotificationType[];
  notifications: Notification[];
  moderationReports: ModerationReport[];
  moderationDecisions: ModerationDecision[];
};

export type StaffSummaryStat = {
  total: number;
  pending: number;
};

export type StaffSummary = {
  accounts: StaffSummaryStat;
  events: StaffSummaryStat;
  organizations: StaffSummaryStat;
  reports: StaffSummaryStat;
};

export type StaffDataScope =
  | "admin-dashboard"
  | "admin-accounts"
  | "admin-events"
  | "moderator-dashboard"
  | "moderator-events"
  | "moderator-organizations"
  | "moderator-accounts"
  | "moderator-reports";

export type StaffActionPayload = {
  action: string;
  target_type: "event" | "organization" | "account";
  target_id: number;
  reason: string;
  suspended_until?: string | null;
  report_id?: number | null;
  report_status?: ModerationReport["status"] | null;
};

export type CreateModerationReportPayload = {
  target_type: "event" | "organization" | "account";
  target_id: number;
  reporter_user_id: number;
  reason: string;
  details: string;
  priority?: ModerationReport["priority"];
};

export const staffApi = {
  async loadData(scope: StaffDataScope = "moderator-dashboard"): Promise<ApiResult<StaffDataSet>> {
    const data = emptyStaffDataSet();
    const requests = staffDataRequests(scope);

    for (const request of requests) {
      const result = await request.load();
      if (!result.ok) return result;
      assignStaffData(data, request.key, result.data ?? []);
    }

    return createApiSuccess(data);
  },

  async applyAction(
    payload: StaffActionPayload,
  ): Promise<ApiResult<null>> {
    return apiRequest<null>("/api/staff/actions", {
      body: {
        ...payload,
        target_id: toBackendId(payload.target_id),
        report_id:
          payload.report_id != null ? toBackendId(payload.report_id) : payload.report_id,
      },
      method: "POST",
    });
  },

  createReport(
    payload: CreateModerationReportPayload,
  ): Promise<ApiResult<ModerationReport>> {
    return apiRequest<ModerationReport>("/api/moderation/reports", {
      body: {
        ...payload,
        target_id: toBackendId(payload.target_id),
        reporter_user_id: toBackendId(payload.reporter_user_id),
      },
      method: "POST",
    });
  },
};

type StaffDataKey = keyof StaffDataSet;

type StaffDataRequest<K extends StaffDataKey = StaffDataKey> = {
  key: K;
  load: () => Promise<ApiResult<StaffDataSet[K]>>;
};

const STAFF_LIST_LIMIT = 100;

const staffListPath = (path: string, params: Record<string, string | number> = {}) => {
  const searchParams = new URLSearchParams({
    limit: String(STAFF_LIST_LIMIT),
    ...Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  });

  return `${path}?${searchParams.toString()}`;
};

const emptyStaffDataSet = (): StaffDataSet => ({
  summary: emptyStaffSummary(),
  accounts: [],
  users: [],
  organizations: [],
  organizers: [],
  events: [],
  notificationTypes: [],
  notifications: [],
  moderationReports: [],
  moderationDecisions: [],
});

const emptyStaffSummary = (): StaffSummary => ({
  accounts: { total: 0, pending: 0 },
  events: { total: 0, pending: 0 },
  organizations: { total: 0, pending: 0 },
  reports: { total: 0, pending: 0 },
});

const assignStaffData = <K extends StaffDataKey>(
  data: StaffDataSet,
  key: K,
  value: StaffDataSet[K],
) => {
  data[key] = value;
};

const staffDataRequests = (scope: StaffDataScope): StaffDataRequest[] => {
  const summaryRequest: StaffDataRequest = {
    key: "summary",
    load: async () => {
      const result = await apiRequest<StaffSummary>("/api/staff/summary");

      if (!result.ok && result.error.code === "not_found") {
        return createApiSuccess(emptyStaffSummary());
      }

      return result;
    },
  };
  const accountRequests: StaffDataRequest[] = [
    {
      key: "accounts",
      load: () => apiRequest<Account[]>(staffListPath("/api/staff/accounts")),
    },
    {
      key: "users",
      load: () => apiRequest<User[]>(staffListPath("/api/staff/users")),
    },
    {
      key: "organizations",
      load: () => apiRequest<Organization[]>(staffListPath("/api/staff/organizations")),
    },
  ];
  const eventRequests: StaffDataRequest[] = [
    {
      key: "organizations",
      load: () => apiRequest<Organization[]>(staffListPath("/api/staff/organizations")),
    },
    {
      key: "events",
      load: () => apiRequest<Event[]>(staffListPath("/api/staff/events")),
    },
    {
      key: "moderationReports",
      load: () =>
        apiRequest<ModerationReport[]>(staffListPath("/api/staff/moderation-reports")),
    },
    {
      key: "moderationDecisions",
      load: () =>
        apiRequest<ModerationDecision[]>(staffListPath("/api/staff/moderation-decisions")),
    },
  ];

  switch (scope) {
    case "admin-accounts":
      return [summaryRequest, ...accountRequests];
    case "admin-events":
      return [summaryRequest, ...eventRequests];
    case "admin-dashboard":
      return [
        summaryRequest,
        ...accountRequests,
        {
          key: "events",
          load: () => apiRequest<Event[]>(staffListPath("/api/staff/events")),
        },
      ];
    case "moderator-events":
      return [summaryRequest, ...eventRequests];
    case "moderator-organizations":
      return [
        summaryRequest,
        ...accountRequests,
        {
          key: "organizers",
          load: () => apiRequest<Organizer[]>(staffListPath("/api/staff/organizers")),
        },
        {
          key: "moderationDecisions",
          load: () =>
            apiRequest<ModerationDecision[]>(staffListPath("/api/staff/moderation-decisions")),
        },
      ];
    case "moderator-accounts":
      return [summaryRequest, ...accountRequests];
    case "moderator-reports":
      return [
        summaryRequest,
        ...accountRequests,
        {
          key: "events",
          load: () => apiRequest<Event[]>(staffListPath("/api/staff/events")),
        },
        {
          key: "moderationReports",
          load: () =>
            apiRequest<ModerationReport[]>(staffListPath("/api/staff/moderation-reports")),
        },
        {
          key: "moderationDecisions",
          load: () =>
            apiRequest<ModerationDecision[]>(staffListPath("/api/staff/moderation-decisions")),
        },
      ];
    case "moderator-dashboard":
    default:
      return [
        summaryRequest,
        ...accountRequests,
        {
          key: "events",
          load: () => apiRequest<Event[]>(staffListPath("/api/staff/events")),
        },
        {
          key: "moderationReports",
          load: () =>
            apiRequest<ModerationReport[]>(
              staffListPath("/api/staff/moderation-reports", { status: "open" }),
            ),
        },
        {
          key: "moderationDecisions",
          load: () =>
            apiRequest<ModerationDecision[]>(staffListPath("/api/staff/moderation-decisions")),
        },
      ];
  }
};
