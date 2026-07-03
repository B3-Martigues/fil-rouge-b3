export const ROLES = ["user", "admin", "moderator", "organization"] as const;

export type Role = (typeof ROLES)[number];

export const ACCOUNT_TYPES = ["user", "admin", "moderator", "organization"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_IDS: Record<AccountType, number> = {
  user: 1,
  admin: 2,
  organization: 3,
  moderator: 4,
};

export const ROLE_IDS: Record<Role, number> = {
  user: 1,
  admin: 2,
  organization: 3,
  moderator: 4,
};

export const getAccountTypeForRole = (role: Role): AccountType =>
  role === "organization" ? "user" : role;

export const getAccountTypeIdForRole = (role: Role) =>
  ACCOUNT_TYPE_IDS[getAccountTypeForRole(role)];

export type Account = {
  id: number;
  account_type_id: number;
  account_type: AccountType;
  login_email: string;
  password_hash: string;
  password_changed_at?: string | null;
  is_active: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
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
  suspended_until?: string | null;
  suspension_reason?: string | null;
  user_id?: number;
  organization_id?: number;
  is_verified?: boolean;
};

export type UserEventPreference = {
  id: number;
  user_id: number;
  event_category_id: number;
  category_slug?: string;
};

export type AuthenticatedUser = {
  id: number;
  account_id: number;
  login_email: string;
  role: Role;
  role_id: number;
  username: string;
  is_active: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  created_at?: string;
  user_id?: number;
  organization_id?: number;
  is_verified?: boolean;
  auth_source?: "api";
};

export function isAccountSuspended(
  account: Pick<Account, "suspended_until">,
  at = new Date(),
) {
  if (!account.suspended_until) return false;

  return new Date(account.suspended_until).getTime() > at.getTime();
}

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
    suspended_until: account.suspended_until ?? null,
    suspension_reason: account.suspension_reason ?? null,
    created_at: account.created_at,
    user_id: user.id,
  };
}

export function toAuthenticatedOrganization(params: {
  account: Account;
  user?: {
    id: number;
  } | null;
  organization: {
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
    role: "user",
    role_id: ROLE_IDS.user,
    username: params.organization.name,
    is_active: params.account.is_active && params.organization.is_active,
    suspended_until: params.account.suspended_until ?? null,
    suspension_reason: params.account.suspension_reason ?? null,
    created_at: params.account.created_at,
    user_id: params.user?.id,
    organization_id: params.organization.id,
    is_verified: params.organization.is_verified,
  };
}
