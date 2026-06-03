export type Favorite = {
  id: number;
  user_id: number;
  event_id: number;
  created_at?: string;
  deleted_at?: string | null;
};
