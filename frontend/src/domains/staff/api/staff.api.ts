import type { ApiResult } from "../../../shared/api/api.types";
import { apiRequest } from "../../../shared/api/httpClient";
import { toBackendId } from "../../../shared/api/idMapping";
import type { Event } from "../../event/types/event";
import type { ModerationDecision, ModerationReport } from "../../moderator/types/moderation";
import type { Notification, NotificationType } from "../../notification/types/notification";
import type { Organization } from "../../organization/types/organization";
import type { Organizer } from "../../organization/types/organizer";
import type { Account, User } from "../../user/types/user";

export type StaffSnapshot = {
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

type BackendStaffSnapshot = Omit<
  StaffSnapshot,
  | "notificationTypes"
  | "moderationReports"
  | "moderationDecisions"
> & {
  notification_types: NotificationType[];
  moderation_reports: ModerationReport[];
  moderation_decisions: ModerationDecision[];
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

const normalizeSnapshot = (snapshot: BackendStaffSnapshot): StaffSnapshot => ({
  accounts: snapshot.accounts ?? [],
  users: snapshot.users ?? [],
  organizations: snapshot.organizations ?? [],
  organizers: snapshot.organizers ?? [],
  events: snapshot.events ?? [],
  notificationTypes: snapshot.notification_types ?? [],
  notifications: snapshot.notifications ?? [],
  moderationReports: snapshot.moderation_reports ?? [],
  moderationDecisions: snapshot.moderation_decisions ?? [],
});

const mapSnapshotResult = (
  result: ApiResult<BackendStaffSnapshot>,
): ApiResult<StaffSnapshot> =>
  result.ok ? { ok: true, data: normalizeSnapshot(result.data) } : result;

export const staffApi = {
  async snapshot(): Promise<ApiResult<StaffSnapshot>> {
    return mapSnapshotResult(
      await apiRequest<BackendStaffSnapshot>("/api/staff/snapshot"),
    );
  },

  async applyAction(
    payload: StaffActionPayload,
  ): Promise<ApiResult<StaffSnapshot>> {
    return mapSnapshotResult(
      await apiRequest<BackendStaffSnapshot>("/api/staff/actions", {
        body: {
          ...payload,
          target_id: toBackendId(payload.target_id),
          report_id:
            payload.report_id != null ? toBackendId(payload.report_id) : payload.report_id,
        },
        method: "POST",
      }),
    );
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
