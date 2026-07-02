import type { ApiResult } from "../../../shared/api/api.types";
import { apiRequest } from "../../../shared/api/httpClient";
import type { Role } from "../../user/types/user";

export type AdminUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
};

export type CreateAdminUserPayload = {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
  role: Exclude<Role, "organization">;
  is_active: boolean;
};

export type UpdateAdminUserPayload = Partial<CreateAdminUserPayload>;

const ADMIN_USERS_ENDPOINTS = {
  list: "/api/admin/users",
  detail: (userId: number) => `/api/admin/users/${userId}`,
} as const;

export const adminUsersApi = {
  list(): Promise<ApiResult<AdminUser[]>> {
    return apiRequest<AdminUser[]>(ADMIN_USERS_ENDPOINTS.list);
  },

  create(payload: CreateAdminUserPayload): Promise<ApiResult<AdminUser>> {
    return apiRequest<AdminUser>(ADMIN_USERS_ENDPOINTS.list, {
      body: payload,
      method: "POST",
    });
  },

  update(
    userId: number,
    payload: UpdateAdminUserPayload,
  ): Promise<ApiResult<AdminUser>> {
    return apiRequest<AdminUser>(ADMIN_USERS_ENDPOINTS.detail(userId), {
      body: payload,
      method: "PATCH",
    });
  },

  remove(userId: number): Promise<ApiResult<null>> {
    return apiRequest<null>(ADMIN_USERS_ENDPOINTS.detail(userId), {
      method: "DELETE",
    });
  },
};
