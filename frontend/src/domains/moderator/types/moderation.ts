export type ModerationTargetType = "event" | "organization" | "account";

export type ModerationReportStatus =
  | "open"
  | "reviewing"
  | "resolved"
  | "dismissed";

export type ModerationReportPriority = "low" | "medium" | "high";

export type ModerationAction =
  | "event_approved"
  | "event_rejected"
  | "event_hidden"
  | "event_deleted"
  | "event_restored"
  | "organization_approved"
  | "organization_rejected"
  | "account_suspended"
  | "report_resolved"
  | "report_dismissed";

export type ModerationReport = {
  id: number;
  target_type: ModerationTargetType;
  target_id: number;
  reporter_user_id: number;
  reason: string;
  details: string;
  status: ModerationReportStatus;
  priority: ModerationReportPriority;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  handled_by_user_id?: number | null;
  resolution_note?: string | null;
};

export type ModerationDecision = {
  id: number;
  action: ModerationAction;
  target_type: ModerationTargetType;
  target_id: number;
  moderator_user_id: number;
  reason: string;
  created_at: string;
};
