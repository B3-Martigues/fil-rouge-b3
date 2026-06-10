export type Organizer = {
  id: number;
  user_id: number;
  organization_id: number;
  job_role?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};
