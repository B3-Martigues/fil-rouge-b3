import {
  createApiError,
  createApiSuccess,
  type ApiMode,
  type ApiResult,
} from "../../../shared/api/api.types";
import { apiRequest } from "../../../shared/api/httpClient";
import {
  getDataImageMimeType,
  isDataImageValue,
} from "../../../shared/utils/imageUpload";
import type { Organization } from "../../organization/types/organization";
import type { Favorite } from "../../user/types/favorite";
import type { History } from "../../user/types/history";
import type { Event } from "../types/event";
import type {
  EventCategoryName,
  EventCategoryOption,
} from "../types/event-categories";

export const EVENTS_API_MODE = (import.meta.env.VITE_EVENTS_API_MODE ??
  "http") as ApiMode;

export const EVENTS_API_ENDPOINTS = {
  list: "/api/events",
  map: "/api/events/map",
  upcoming: "/api/events/upcoming",
  past: "/api/events/past",
  popular: "/api/events/popular",
  detail: (eventId: number) => `/api/events/${toBackendId(eventId)}`,
  create: "/api/events",
  imageUpload: "/api/events/images",
  update: (eventId: number) => `/api/events/${toBackendId(eventId)}`,
  delete: (eventId: number) => `/api/events/${toBackendId(eventId)}`,
  active: (eventId: number) => `/api/events/${toBackendId(eventId)}/active`,
  organizationEvents: (organizationId: number) =>
    `/api/organizations/${toBackendId(organizationId)}/events`,
  categories: "/api/event-categories",
  category: (categoryId: number) =>
    `/api/event-categories/${toBackendId(categoryId)}`,
  categoryEvents: (categoryId: number) =>
    `/api/event-categories/${toBackendId(categoryId)}/events`,
  eventCategories: (eventId: number) =>
    `/api/events/${toBackendId(eventId)}/categories`,
  eventCategory: (eventId: number, categoryId: number) =>
    `/api/events/${toBackendId(eventId)}/categories/${toBackendId(categoryId)}`,
  favorite: (eventId: number) => `/api/events/${toBackendId(eventId)}/favorite`,
  favorites: "/api/me/favorites",
  history: (eventId: number) => `/api/events/${toBackendId(eventId)}/history`,
  histories: "/api/me/history",
  historyEntry: (historyId: number) => `/api/me/history/${toBackendId(historyId)}`,
} as const;

export type EventSort =
  | "newest"
  | "oldest"
  | "created-asc"
  | "date-asc"
  | "date-desc"
  | "price-asc"
  | "price-desc"
  | "popular"
  | "popularity-desc";

export type EventListFilters = {
  q?: string;
  search?: string;
  city?: string;
  postalCode?: string;
  categories?: EventCategoryName[];
  organizationId?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  free?: boolean;
  paid?: boolean;
  includeInactive?: boolean;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  sort?: EventSort;
  limit?: number;
  offset?: number;
};

export type EventCreatePayload = Omit<
  Event,
  "id" | "created_at" | "updated_at" | "deleted_at" | "organization"
>;

export type EventUpdatePayload = EventCreatePayload;

export type FavoriteState = {
  is_favorite: boolean;
};

type EventImageUploadResponse = {
  url: string;
};

const toBackendId = (value: number) => Math.abs(value);

const appendIfDefined = (
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
) => {
  if (value !== undefined && value !== "") {
    params.set(key, String(value));
  }
};

const buildEventQuery = (filters: EventListFilters = {}) => {
  const params = new URLSearchParams();

  appendIfDefined(params, "q", filters.q ?? filters.search);
  appendIfDefined(params, "city", filters.city);
  appendIfDefined(params, "postal_code", filters.postalCode);
  appendIfDefined(
    params,
    "organization_id",
    filters.organizationId ? toBackendId(filters.organizationId) : undefined,
  );
  appendIfDefined(params, "date", filters.date);
  appendIfDefined(params, "date_from", filters.dateFrom);
  appendIfDefined(params, "date_to", filters.dateTo);
  appendIfDefined(params, "price_min", filters.priceMin);
  appendIfDefined(params, "price_max", filters.priceMax);
  appendIfDefined(params, "free", filters.free);
  appendIfDefined(params, "paid", filters.paid);
  appendIfDefined(params, "include_inactive", filters.includeInactive);
  appendIfDefined(params, "sort", filters.sort);
  appendIfDefined(params, "limit", filters.limit);
  appendIfDefined(params, "offset", filters.offset);

  if (filters.categories?.length) {
    params.set("categories", filters.categories.join(","));
  }
  if (filters.bounds) {
    appendIfDefined(params, "north", filters.bounds.north);
    appendIfDefined(params, "south", filters.bounds.south);
    appendIfDefined(params, "east", filters.bounds.east);
    appendIfDefined(params, "west", filters.bounds.west);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const dataImageExtensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const dataUrlToBlob = (value: string) => {
  const [metadata = "", payload = ""] = value.split(",");
  const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1] ?? "";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

const uploadEventImage = (image: string): Promise<ApiResult<EventImageUploadResponse>> => {
  const mimeType = getDataImageMimeType(image);
  const extension = mimeType ? dataImageExtensionByMimeType[mimeType] : null;

  if (!mimeType || !extension) {
    return Promise.resolve(
      createApiError("validation_error", "Le format de l'image est invalide"),
    );
  }

  const formData = new FormData();
  formData.append("image", dataUrlToBlob(image), `event-image.${extension}`);

  return apiRequest<EventImageUploadResponse>(EVENTS_API_ENDPOINTS.imageUpload, {
    body: formData,
    method: "POST",
  });
};

const normalizePayload = async (
  payload: EventCreatePayload,
): Promise<ApiResult<EventCreatePayload>> => {
  const normalizedPayload: EventCreatePayload = {
    ...payload,
    organization_id: toBackendId(payload.organization_id),
    category_slugs: Array.from(new Set(payload.category_slugs)),
    image: payload.image.trim(),
    title: payload.title.trim(),
    description: payload.description.trim(),
    address: payload.address.trim(),
    city: payload.city.trim(),
    postal_code: payload.postal_code.trim(),
    ticketing_link: payload.ticketing_link.trim(),
    source: payload.source?.trim() || null,
    price: Number(payload.price),
  };

  if (!isDataImageValue(normalizedPayload.image)) {
    return createApiSuccess(normalizedPayload);
  }

  const uploadResult = await uploadEventImage(normalizedPayload.image);
  if (!uploadResult.ok) {
    return createApiError(uploadResult.error.code, uploadResult.error.message);
  }

  return createApiSuccess({
    ...normalizedPayload,
    image: uploadResult.data.url,
  });
};

export const eventsApi = {
  list(filters?: EventListFilters): Promise<ApiResult<Event[]>> {
    return apiRequest<Event[]>(`${EVENTS_API_ENDPOINTS.list}${buildEventQuery(filters)}`);
  },

  listMap(filters?: EventListFilters): Promise<ApiResult<Event[]>> {
    return apiRequest<Event[]>(`${EVENTS_API_ENDPOINTS.map}${buildEventQuery(filters)}`);
  },

  listUpcoming(filters?: EventListFilters): Promise<ApiResult<Event[]>> {
    return apiRequest<Event[]>(
      `${EVENTS_API_ENDPOINTS.upcoming}${buildEventQuery(filters)}`,
    );
  },

  listPast(filters?: EventListFilters): Promise<ApiResult<Event[]>> {
    return apiRequest<Event[]>(`${EVENTS_API_ENDPOINTS.past}${buildEventQuery(filters)}`);
  },

  listPopular(filters?: EventListFilters): Promise<ApiResult<Event[]>> {
    return apiRequest<Event[]>(
      `${EVENTS_API_ENDPOINTS.popular}${buildEventQuery(filters)}`,
    );
  },

  listByOrganization(
    organizationId: number,
    filters?: Omit<EventListFilters, "organizationId">,
  ): Promise<ApiResult<Event[]>> {
    return apiRequest<Event[]>(
      `${EVENTS_API_ENDPOINTS.organizationEvents(organizationId)}${buildEventQuery(
        filters,
      )}`,
    );
  },

  get(eventId: number): Promise<ApiResult<Event>> {
    return apiRequest<Event>(EVENTS_API_ENDPOINTS.detail(eventId));
  },

  async create(payload: EventCreatePayload): Promise<ApiResult<Event>> {
    const normalizedPayload = await normalizePayload(payload);
    if (!normalizedPayload.ok) return normalizedPayload;

    return apiRequest<Event>(EVENTS_API_ENDPOINTS.create, {
      body: normalizedPayload.data,
      method: "POST",
    });
  },

  async update(
    eventId: number,
    payload: EventUpdatePayload,
  ): Promise<ApiResult<Event>> {
    const normalizedPayload = await normalizePayload(payload);
    if (!normalizedPayload.ok) return normalizedPayload;

    return apiRequest<Event>(EVENTS_API_ENDPOINTS.update(eventId), {
      body: normalizedPayload.data,
      method: "PUT",
    });
  },

  remove(eventId: number): Promise<ApiResult<null>> {
    return apiRequest<null>(EVENTS_API_ENDPOINTS.delete(eventId), {
      method: "DELETE",
    });
  },

  setActive(eventId: number, isActive: boolean): Promise<ApiResult<Event>> {
    return apiRequest<Event>(EVENTS_API_ENDPOINTS.active(eventId), {
      body: { is_active: isActive },
      method: "PATCH",
    });
  },

  listCategories(): Promise<ApiResult<EventCategoryOption[]>> {
    return apiRequest<EventCategoryOption[]>(EVENTS_API_ENDPOINTS.categories);
  },

  getCategory(categoryId: number): Promise<ApiResult<EventCategoryOption>> {
    return apiRequest<EventCategoryOption>(EVENTS_API_ENDPOINTS.category(categoryId));
  },

  listByCategory(
    categoryId: number,
    filters?: EventListFilters,
  ): Promise<ApiResult<Event[]>> {
    return apiRequest<Event[]>(
      `${EVENTS_API_ENDPOINTS.categoryEvents(categoryId)}${buildEventQuery(filters)}`,
    );
  },

  replaceCategories(
    eventId: number,
    categorySlugs: EventCategoryName[],
  ): Promise<ApiResult<Event>> {
    return apiRequest<Event>(EVENTS_API_ENDPOINTS.eventCategories(eventId), {
      body: { category_slugs: categorySlugs },
      method: "PUT",
    });
  },

  addCategory(eventId: number, categoryId: number): Promise<ApiResult<Event>> {
    return apiRequest<Event>(EVENTS_API_ENDPOINTS.eventCategory(eventId, categoryId), {
      method: "POST",
    });
  },

  removeCategory(eventId: number, categoryId: number): Promise<ApiResult<Event>> {
    return apiRequest<Event>(EVENTS_API_ENDPOINTS.eventCategory(eventId, categoryId), {
      method: "DELETE",
    });
  },

  addFavorite(eventId: number): Promise<ApiResult<Favorite>> {
    return apiRequest<Favorite>(EVENTS_API_ENDPOINTS.favorite(eventId), {
      method: "POST",
    });
  },

  removeFavorite(eventId: number): Promise<ApiResult<null>> {
    return apiRequest<null>(EVENTS_API_ENDPOINTS.favorite(eventId), {
      method: "DELETE",
    });
  },

  isFavorite(eventId: number): Promise<ApiResult<FavoriteState>> {
    return apiRequest<FavoriteState>(EVENTS_API_ENDPOINTS.favorite(eventId));
  },

  listFavorites(): Promise<ApiResult<Favorite[]>> {
    return apiRequest<Favorite[]>(EVENTS_API_ENDPOINTS.favorites);
  },

  recordHistory(eventId: number): Promise<ApiResult<History>> {
    return apiRequest<History>(EVENTS_API_ENDPOINTS.history(eventId), {
      method: "POST",
    });
  },

  listHistory(): Promise<ApiResult<History[]>> {
    return apiRequest<History[]>(EVENTS_API_ENDPOINTS.histories);
  },

  removeHistory(historyId: number): Promise<ApiResult<null>> {
    return apiRequest<null>(EVENTS_API_ENDPOINTS.historyEntry(historyId), {
      method: "DELETE",
    });
  },
};

export const isPublicMockEvent = (
  event: Event,
  organization?: Organization | null,
) =>
  !event.deleted_at &&
  event.is_active &&
  (organization ? organization.is_active && !organization.deleted_at : true);
