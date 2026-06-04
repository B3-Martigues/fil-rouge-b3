export const ROLES = ["user", "admin", "company"] as const;

export type Role = (typeof ROLES)[number];

export const ACCOUNT_TYPES = ["user", "company"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_IDS: Record<AccountType, number> = {
  user: 1,
  company: 2,
};

export const ROLE_IDS: Record<Role, number> = {
  user: 1,
  admin: 2,
  company: 3,
};

export type Account = {
  id: number;
  account_type_id: number;
  account_type: AccountType;
  login_email: string;
  password_hash: string;
  password_changed_at?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type User = {
  id: number;
  account_id: number;
  username: string;
  role_id: number;
  role: Role;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type AccountSummary = {
  account_id: number;
  login_email: string;
  password_hash: string;
  role: Role;
  role_id: number;
  display_name: string;
  is_active: boolean;
  user_id?: number;
  company_id?: number;
  is_verified?: boolean;
};

export type UserEventPreference = {
  id: number;
  user_id: number;
  event_category_id: number;
};

export type AuthenticatedUser = {
  id: number;
  account_id: number;
  login_email: string;
  role: Role;
  role_id: number;
  username: string;
  is_active: boolean;
  user_id?: number;
  company_id?: number;
  is_verified?: boolean;
};

export function toAuthenticatedUser(
  account: Account,
  user: User,
): AuthenticatedUser {
  return {
    id: account.id,
    account_id: account.id,
    login_email: account.login_email,
    role: user.role,
    role_id: user.role_id,
    username: user.username,
    is_active: account.is_active,
    user_id: user.id,
  };
}

export function toAuthenticatedCompany(params: {
  account: Account;
  user?: {
    id: number;
  } | null;
  company: {
    id: number;
    name: string;
    role_id?: number | null;
    is_active: boolean;
    is_verified: boolean;
  };
}): AuthenticatedUser {
  return {
    id: params.account.id,
    account_id: params.account.id,
    login_email: params.account.login_email,
    role: "company",
    role_id: params.company.role_id ?? ROLE_IDS.company,
    username: params.company.name,
    is_active: params.account.is_active && params.company.is_active,
    user_id: params.user?.id,
    company_id: params.company.id,
    is_verified: params.company.is_verified,
  };
}
