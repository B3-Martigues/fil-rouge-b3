export type PasswordResetToken = {
  token: string;
  account_id: number;
  expires_at: string;
  used_at?: string | null;
  created_at: string;
};
