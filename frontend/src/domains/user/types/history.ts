import type { Event } from "../../event/types/event";

export type History = {
  id: number;
  user_id: number;
  event_id: number;
  visited_at: string;
  deleted_at?: string | null;
  event?: Event | null;
};
