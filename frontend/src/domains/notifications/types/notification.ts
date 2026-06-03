export const NOTIFICATION_TYPE_SLUGS = [
  "favorite_event_today",
  "password_reset_requested",
  "password_changed",
  "company_approved",
  "event_approved",
  "welcome_email",
] as const;

export type NotificationTypeSlug = (typeof NOTIFICATION_TYPE_SLUGS)[number];

export type NotificationChannel = "in_app" | "email";

export type NotificationType = {
  id: number;
  name: string;
  slug: NotificationTypeSlug;
};

export type NotificationTypeConfig = NotificationType & {
  channels: NotificationChannel[];
};

export type Notification = {
  id: number;
  user_id: number;
  event_id?: number | null;
  company_id?: number | null;
  notification_type_id: number;
  title: string;
  message: string;
  is_read: boolean;
  read_at?: string | null;
  action_url?: string | null;
  created_at: string;
};

export type NotificationDraft = Omit<
  Notification,
  "id" | "created_at" | "is_read" | "read_at"
> & {
  is_read?: boolean;
  read_at?: string | null;
};
