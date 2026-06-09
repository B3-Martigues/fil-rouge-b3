export const moderatorPermissions = [
  "review_events",
  "review_companies",
  "moderate_events",
  "suspend_accounts",
  "manage_reports",
] as const;

export type ModeratorPermission = (typeof moderatorPermissions)[number];

export type ModeratorProfile = {
  user_id: number;
  display_name: string;
  permissions: ModeratorPermission[];
  created_at: string;
};

export const moderatorProfilesMock: ModeratorProfile[] = [
  {
    user_id: 5,
    display_name: "Moderateur",
    permissions: [...moderatorPermissions],
    created_at: "2026-05-23T09:35:00.000Z",
  },
  {
    user_id: 6,
    display_name: "Modo Evenements",
    permissions: ["review_events", "moderate_events"],
    created_at: "2026-05-24T08:35:00.000Z",
  },
  {
    user_id: 7,
    display_name: "Modo Signalements",
    permissions: ["manage_reports", "suspend_accounts"],
    created_at: "2026-05-24T10:05:00.000Z",
  },
  {
    user_id: 8,
    display_name: "Modo Suspendu",
    permissions: [...moderatorPermissions],
    created_at: "2026-05-25T09:05:00.000Z",
  },
];
