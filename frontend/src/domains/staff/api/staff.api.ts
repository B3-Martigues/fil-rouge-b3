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
  async loadData(): Promise<ApiResult<StaffDataSet>> {
    const [
      accounts,
      users,
      organizations,
      organizers,
      events,
      notificationTypes,
      notifications,
      moderationReports,
      moderationDecisions,
    ] = await Promise.all([
      apiRequest<Account[]>("/api/staff/accounts"),
      apiRequest<User[]>("/api/staff/users"),
      apiRequest<Organization[]>("/api/staff/organizations"),
      apiRequest<Organizer[]>("/api/staff/organizers"),
      apiRequest<Event[]>("/api/staff/events"),
      apiRequest<NotificationType[]>("/api/staff/notification-types"),
      apiRequest<Notification[]>("/api/staff/notifications"),
      apiRequest<ModerationReport[]>("/api/staff/moderation-reports"),
      apiRequest<ModerationDecision[]>("/api/staff/moderation-decisions"),
    ]);

    if (!accounts.ok) return accounts;
    if (!users.ok) return users;
    if (!organizations.ok) return organizations;
    if (!organizers.ok) return organizers;
    if (!events.ok) return events;
    if (!notificationTypes.ok) return notificationTypes;
    if (!notifications.ok) return notifications;
    if (!moderationReports.ok) return moderationReports;
    if (!moderationDecisions.ok) return moderationDecisions;

    return createApiSuccess({
      accounts: accounts.data ?? [],
      users: users.data ?? [],
      organizations: organizations.data ?? [],
      organizers: organizers.data ?? [],
      events: events.data ?? [],
      notificationTypes: notificationTypes.data ?? [],
      notifications: notifications.data ?? [],
      moderationReports: moderationReports.data ?? [],
      moderationDecisions: moderationDecisions.data ?? [],
    });
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
