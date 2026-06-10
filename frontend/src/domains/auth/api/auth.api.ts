import type { Organization } from "../../organization/types/organization";
import type {
  Account,
  AuthenticatedUser,
  User,
} from "../../user/types/user";
import {
  isAccountSuspended,
  toAuthenticatedOrganization,
  toAuthenticatedUser,
} from "../../user/types/user";

export const AUTH_API_MODE = "mock" as const;

export const AUTH_API_ENDPOINTS = {
  login: "/auth/login",
  me: "/auth/me",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
} as const;

export type LoginCredentials = {
  login_email: string;
  password: string;
};

export type MockAuthContext = {
  accounts: Account[];
  users: User[];
  organizations: Organization[];
};

export type MockAuthErrorCode =
  | "invalid_credentials"
  | "disabled_account"
  | "suspended_account"
  | "missing_profile";

export type MockAuthResult =
  | {
      ok: true;
      user: AuthenticatedUser;
    }
  | {
      ok: false;
      code: MockAuthErrorCode;
      message: string;
    };

const normalizeComparable = (value: string) => value.trim().toLowerCase();

export function authenticateMockAccount(
  context: MockAuthContext,
  credentials: LoginCredentials,
  at = new Date(),
): MockAuthResult {
  const loginEmail = credentials.login_email.trim();
  const account = context.accounts.find(
    (item) =>
      normalizeComparable(item.login_email) === normalizeComparable(loginEmail) &&
      item.password_hash === credentials.password &&
      !item.deleted_at,
  );

  if (!account) {
    return {
      ok: false,
      code: "invalid_credentials",
      message: "Email ou mot de passe incorrect",
    };
  }

  if (!account.is_active) {
    return {
      ok: false,
      code: "disabled_account",
      message: "Ce compte est desactive",
    };
  }

  if (isAccountSuspended(account, at)) {
    const suspendedUntil = account.suspended_until
      ? new Date(account.suspended_until).toLocaleDateString("fr-FR")
      : null;
    const suspensionEnd = suspendedUntil
      ? ` jusqu'au ${suspendedUntil}`
      : "";

    return {
      ok: false,
      code: "suspended_account",
      message: `Ce compte a ete suspendu${suspensionEnd}. Consultez vos mails pour avoir plus de details sur la raison et la date de suspension.`,
    };
  }

  const organization =
    account.account_type === "organization"
      ? context.organizations.find(
          (item) => item.account_id === account.id && !item.deleted_at,
        )
      : undefined;
  const user = context.users.find(
    (item) => item.account_id === account.id && !item.deleted_at,
  );
  const authenticatedUser = organization
    ? toAuthenticatedOrganization({ account, user, organization })
    : user
      ? toAuthenticatedUser(account, user)
      : null;

  if (!authenticatedUser) {
    return {
      ok: false,
      code: "missing_profile",
      message: "Profil rattache au compte introuvable",
    };
  }

  return {
    ok: true,
    user: authenticatedUser,
  };
}
