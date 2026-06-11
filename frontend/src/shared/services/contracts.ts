import type { ApiMode, ApiResult } from "../api/api.types";
import type { Event } from "../../domains/event/types/event";
import type { Organization } from "../../domains/organization/types/organization";
import type { Notification } from "../../domains/notification/types/notification";
import type { Account, User } from "../../domains/user/types/user";

export type LoginPayload = {
  email: string;
  password: string;
};

export type ServiceContext = {
  mode: ApiMode;
};

export type AuthServiceContract = {
  login(payload: LoginPayload): Promise<ApiResult<User>>;
  logout(): Promise<ApiResult<null>>;
};

export type EventServiceContract = {
  list(): Promise<ApiResult<Event[]>>;
  create(payload: Omit<Event, "id" | "created_at" | "updated_at">): Promise<ApiResult<Event>>;
  update(eventId: number, payload: Partial<Event>): Promise<ApiResult<Event>>;
};

export type OrganizationServiceContract = {
  list(): Promise<ApiResult<Organization[]>>;
  update(
    organizationId: number,
    payload: Partial<Organization>,
  ): Promise<ApiResult<Organization>>;
};

export type AccountServiceContract = {
  list(): Promise<ApiResult<Account[]>>;
  suspend(
    accountId: number,
    payload: { reason: string; suspended_until: string },
  ): Promise<ApiResult<Account>>;
};

export type NotificationServiceContract = {
  dispatch(notification: Notification): Promise<ApiResult<Notification>>;
};
