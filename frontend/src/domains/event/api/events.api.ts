import type { Organization } from "../../organization/types/organization";
import type { Event } from "../types/event";
import type { EventCategoryName } from "../types/event-categories";

export const EVENTS_API_MODE = "mock" as const;

export const EVENTS_API_ENDPOINTS = {
  list: "/events",
  detail: (eventId: number) => `/events/${eventId}`,
  create: "/events",
  update: (eventId: number) => `/events/${eventId}`,
  delete: (eventId: number) => `/events/${eventId}`,
} as const;

export type EventListFilters = {
  search?: string;
  city?: string;
  categories?: EventCategoryName[];
  organizationId?: number;
  includeInactive?: boolean;
};

export type EventCreatePayload = Omit<
  Event,
  "id" | "created_at" | "updated_at" | "deleted_at"
>;

export type EventUpdatePayload = Partial<EventCreatePayload>;

export const isPublicMockEvent = (event: Event, organization?: Organization | null) =>
  !event.deleted_at &&
  event.is_active &&
  (organization ? organization.is_active && !organization.deleted_at : true);
