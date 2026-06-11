import { createApiError, createApiSuccess } from "../api/api.types";
import type {
  AccountServiceContract,
  EventServiceContract,
  NotificationServiceContract,
  OrganizationServiceContract,
} from "./contracts";
import type { Event } from "../../domains/event/types/event";
import type { Organization } from "../../domains/organization/types/organization";
import type { Notification } from "../../domains/notification/types/notification";
import type { Account } from "../../domains/user/types/user";

export const createMockEventService = (getEvents: () => Event[]): EventServiceContract => ({
  async list() {
    return createApiSuccess(getEvents().filter((event) => !event.deleted_at));
  },
  async create(payload) {
    const now = new Date().toISOString();

    return createApiSuccess({
      ...payload,
      id: Date.now(),
      created_at: now,
      updated_at: now,
    });
  },
  async update(eventId, payload) {
    const event = getEvents().find((item) => item.id === eventId);

    if (!event) {
      return createApiError("not_found", "Evenement introuvable");
    }

    return createApiSuccess({
      ...event,
      ...payload,
      updated_at: new Date().toISOString(),
    });
  },
});

export const createMockOrganizationService = (
  getOrganizations: () => Organization[],
): OrganizationServiceContract => ({
  async list() {
    return createApiSuccess(
      getOrganizations().filter((organization) => !organization.deleted_at),
    );
  },
  async update(organizationId, payload) {
    const organization = getOrganizations().find((item) => item.id === organizationId);

    if (!organization) {
      return createApiError("not_found", "Organisation introuvable");
    }

    return createApiSuccess({
      ...organization,
      ...payload,
      updated_at: new Date().toISOString(),
    });
  },
});

export const createMockAccountService = (
  getAccounts: () => Account[],
): AccountServiceContract => ({
  async list() {
    return createApiSuccess(getAccounts().filter((account) => !account.deleted_at));
  },
  async suspend(accountId, payload) {
    const account = getAccounts().find((item) => item.id === accountId);

    if (!account) {
      return createApiError("not_found", "Compte introuvable");
    }

    return createApiSuccess({
      ...account,
      is_active: false,
      suspension_reason: payload.reason,
      suspended_until: payload.suspended_until,
      updated_at: new Date().toISOString(),
    });
  },
});

export const createMockNotificationService = (): NotificationServiceContract => ({
  async dispatch(notification: Notification) {
    return createApiSuccess(notification);
  },
});
