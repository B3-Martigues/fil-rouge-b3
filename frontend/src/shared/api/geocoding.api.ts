import { createApiError, createApiSuccess, type ApiResult } from "./api.types";

export type AddressSuggestion = {
  label: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
};

export type AddressSuggestionField = "address" | "city" | "postal_code";

type GeoPfResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: number[];
    };
    properties?: {
      city?: string;
      label?: string;
      name?: string;
      postcode?: string;
    };
  }>;
};

const GEOPF_ENDPOINT = "https://data.geopf.fr/geocodage/search";

const toAddressSuggestion = (
  feature: NonNullable<GeoPfResponse["features"]>[number],
): AddressSuggestion | null => {
  const coordinates = feature.geometry?.coordinates;
  const properties = feature.properties;
  const address = properties?.name?.trim() || properties?.label?.trim() || "";
  const city = properties?.city?.trim() || "";
  const postalCode = properties?.postcode?.trim() || "";

  if (!coordinates || coordinates.length < 2 || !address || !city || !postalCode) {
    return null;
  }

  return {
    label: properties?.label?.trim() || `${address} ${postalCode} ${city}`,
    address,
    city,
    postal_code: postalCode,
    latitude: coordinates[1],
    longitude: coordinates[0],
  };
};

const fetchGeoPfSuggestions = async (
  query: string,
  field: AddressSuggestionField,
  signal?: AbortSignal,
): Promise<ApiResult<AddressSuggestion[]>> => {
  const params = new URLSearchParams({
    limit: "5",
    q: query,
  });

  if (field === "address") {
    params.set("index", "address");
  } else {
    params.set("type", "municipality");
  }

  try {
    const response = await fetch(`${GEOPF_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      return createApiError(
        "server_error",
        "Impossible de recuperer les suggestions d'adresse",
      );
    }

    const payload = (await response.json()) as GeoPfResponse;
    const seen = new Set<string>();
    const suggestions = (payload.features ?? []).flatMap((feature) => {
      const suggestion = toAddressSuggestion(feature);
      if (!suggestion) return [];

      const key =
        field === "address"
          ? `${suggestion.address}|${suggestion.postal_code}|${suggestion.city}`
          : `${suggestion.postal_code}|${suggestion.city}`;
      if (seen.has(key)) return [];

      seen.add(key);
      return [suggestion];
    });

    return createApiSuccess(suggestions);
  } catch {
    if (signal?.aborted) {
      return createApiSuccess([]);
    }

    return createApiError("network_error", "Impossible de joindre le service d'adresse");
  }
};

export const geocodingApi = {
  suggestions(
    query: string,
    field: AddressSuggestionField,
    signal?: AbortSignal,
  ): Promise<ApiResult<AddressSuggestion[]>> {
    return fetchGeoPfSuggestions(query, field, signal);
  },
};
