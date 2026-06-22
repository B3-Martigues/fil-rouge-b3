import { apiRequest } from "../../../shared/api/httpClient";
import type { ApiResult } from "../../../shared/api/api.types";
import {
  ROLE_IDS,
  type AuthenticatedUser,
  type Role,
} from "../../user/types/user";

type BackendAuthUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
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

  return {
    id: user.id,
    account_id: user.id,
    login_email: user.email,
    role,
    role_id: ROLE_IDS[role],
    username: displayName || user.email.split("@")[0] || user.email,
    is_active: user.is_active,
    user_id: user.id,
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
};
