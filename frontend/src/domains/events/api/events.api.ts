import type { Company } from "../../companies/types/company";
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
  companyId?: number;
  includeInactive?: boolean;
};

export type EventCreatePayload = Omit<
  Event,
  "id" | "created_at" | "updated_at" | "deleted_at"
>;

export type EventUpdatePayload = Partial<EventCreatePayload>;

export const isPublicMockEvent = (event: Event, company?: Company | null) =>
  !event.deleted_at &&
  event.is_active &&
  (company ? company.is_active && !company.deleted_at : true);
