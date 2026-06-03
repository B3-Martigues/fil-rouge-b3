import type { History } from "../types/history";

export const historiesMock: History[] = [
  {
    id: 1,
    user_id: 1,
    event_id: 1005,
    visited_at: "2026-05-24T17:30:00.000Z",
    deleted_at: null,
  },
  {
    id: 2,
    user_id: 1,
    event_id: 1001,
    visited_at: "2026-06-01T18:45:00.000Z",
    deleted_at: null,
  },
  {
    id: 3,
    user_id: 1,
    event_id: 1007,
    visited_at: "2026-06-02T08:10:00.000Z",
    deleted_at: null,
  },
  {
    id: 4,
    user_id: 3,
    event_id: 1003,
    visited_at: "2026-06-01T20:00:00.000Z",
    deleted_at: null,
  },
  {
    id: 5,
    user_id: 1,
    event_id: 1008,
    visited_at: "2026-05-28T09:00:00.000Z",
    deleted_at: "2026-06-01T09:00:00.000Z",
  },
];
