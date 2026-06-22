import { apiRequest } from "../../../shared/api/httpClient";
import type { ApiResult } from "../../../shared/api/api.types";
import {
  ROLE_IDS,
  type AuthenticatedUser,
  type Role,
} from "../../user/types/user";

type BackendAuthUser = {
  id: number;
  account_id?: number;
  email: string;
  login_email?: string;
  first_name: string;
  last_name: string;
  username?: string;
  role: string;
  account_type?: string;
  is_active: boolean;
  organization_id?: number;
};

type LoginResponse = {
  ok: true;
  user: BackendAuthUser;
  csrf_token?: string;
};

type RefreshResponse = {
  ok: true;
  csrf_token?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterUserPayload = {
  login_email: string;
  username: string;
  password: string;
};

export type RegisterOrganizationPayload = {
  login_email: string;
  password: string;
  member_name: string;
  member_job_role: string;
  name: string;
  contact_email: string;
  description: string;
  website: string;
  address: string;
  city: string;
  postal_code: string;
  logo: string;
  contact_phone_number: string;
  siret: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

type AuthCheckResponse = {
  ok: true;
  allowed: boolean;
  actual: string;
};

const backendRoleToFrontendRole = (role: string): Role => {
  if (role === "admin") return "admin";
  if (role === "moderator") return "moderator";
  if (role === "organization") return "organization";
  if (role === "user") return "user";
  return "user";
};

const toAuthenticatedUser = (user: BackendAuthUser): AuthenticatedUser => {
  const role = backendRoleToFrontendRole(user.role);
  const displayName = [user.first_name, user.last_name]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const loginEmail = user.login_email ?? user.email;
  const accountId = user.account_id ?? user.id;

  return {
    id: accountId,
    account_id: accountId,
    login_email: loginEmail,
    role,
    role_id: ROLE_IDS[role],
    username: user.username || displayName || loginEmail.split("@")[0] || loginEmail,
    is_active: user.is_active,
    user_id: user.account_id ? user.id : accountId,
    organization_id: user.organization_id,
    auth_source: "api",
  };
};

const mapAuthUserResult = (
  result: ApiResult<BackendAuthUser>,
): ApiResult<AuthenticatedUser> =>
  result.ok ? { ok: true, data: toAuthenticatedUser(result.data) } : result;

export const authHttpApi = {
  async login(payload: LoginPayload): Promise<ApiResult<AuthenticatedUser>> {
    const result = await apiRequest<LoginResponse>("/api/auth/login", {
      body: payload,
      method: "POST",
    });

    return result.ok ? { ok: true, data: toAuthenticatedUser(result.data.user) } : result;
  },

  async registerUser(
    payload: RegisterUserPayload,
  ): Promise<ApiResult<AuthenticatedUser>> {
    const result = await apiRequest<LoginResponse>("/api/auth/register/user", {
      body: payload,
      method: "POST",
    });

    return result.ok ? { ok: true, data: toAuthenticatedUser(result.data.user) } : result;
  },

  async registerOrganization(
    payload: RegisterOrganizationPayload,
  ): Promise<ApiResult<AuthenticatedUser>> {
    const result = await apiRequest<LoginResponse>(
      "/api/auth/register/organization",
      {
        body: payload,
        method: "POST",
      },
    );

    return result.ok ? { ok: true, data: toAuthenticatedUser(result.data.user) } : result;
  },

  async refresh(): Promise<ApiResult<null>> {
    const result = await apiRequest<RefreshResponse>("/api/auth/refresh", {
      method: "POST",
    });

    return result.ok ? { ok: true, data: null } : result;
  },

  async me(): Promise<ApiResult<AuthenticatedUser>> {
    return mapAuthUserResult(await apiRequest<BackendAuthUser>("/api/auth/me"));
  },

  async restoreSession(): Promise<ApiResult<AuthenticatedUser>> {
    const meResult = await this.me();
    if (meResult.ok) return meResult;

    if (meResult.error.code !== "unauthorized") {
      return meResult;
    }

    const refreshResult = await this.refresh();
    if (!refreshResult.ok) return refreshResult;

    return this.me();
  },

  async logout(): Promise<ApiResult<null>> {
    const result = await apiRequest<null>("/api/auth/logout", {
      method: "POST",
    });

    if (result.ok || result.error.code !== "unauthorized") {
      return result;
    }

    const refreshResult = await this.refresh();
    if (!refreshResult.ok) return result;

    return apiRequest<null>("/api/auth/logout", {
      method: "POST",
    });
  },

  async changePassword(payload: ChangePasswordPayload): Promise<ApiResult<null>> {
    const result = await apiRequest<{ ok: true }>("/api/auth/password", {
      body: payload,
      method: "PATCH",
    });

    return result.ok ? { ok: true, data: null } : result;
  },

  async checkRole(role: Role): Promise<ApiResult<AuthCheckResponse>> {
    return apiRequest<AuthCheckResponse>(`/api/auth/check-role/${role}`);
  },

  async checkAccountType(
    accountType: Role,
  ): Promise<ApiResult<AuthCheckResponse>> {
    return apiRequest<AuthCheckResponse>(
      `/api/auth/check-account-type/${accountType}`,
    );
  },

  async deactivateAccount(): Promise<ApiResult<null>> {
    const result = await apiRequest<{ ok: true }>("/api/auth/deactivate", {
      method: "PATCH",
    });

    return result.ok ? { ok: true, data: null } : result;
  },

  async deleteAccount(): Promise<ApiResult<null>> {
    const result = await apiRequest<{ ok: true }>("/api/auth/account", {
      method: "DELETE",
    });

    return result.ok ? { ok: true, data: null } : result;
  },
};
