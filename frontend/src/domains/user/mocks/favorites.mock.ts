import type { Favorite } from "../types/favorite";

export const favoritesMock: Favorite[] = [
  {
    id: 1,
    user_id: 1,
    event_id: 1001,
    created_at: "2026-05-31T18:00:00.000Z",
    deleted_at: null,
  },
  {
    id: 2,
    user_id: 1,
    event_id: 1002,
    created_at: "2026-06-01T09:30:00.000Z",
    deleted_at: null,
  },
  {
    id: 3,
    user_id: 3,
    event_id: 1003,
    created_at: "2026-06-01T12:15:00.000Z",
    deleted_at: null,
  },
  {
    id: 4,
    user_id: 1,
    event_id: 1005,
    created_at: "2026-05-22T08:00:00.000Z",
    deleted_at: "2026-05-25T08:00:00.000Z",
  },
];
