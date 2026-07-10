import { type ApiResult } from "./api.types";
import { apiRequest } from "./httpClient";

export type AddressSuggestion = {
  label: string;
  address: string;
  city: string;
  postal_code: string;
  latitude: number;
  longitude: number;
};

export type AddressSuggestionField = "address" | "city" | "postal_code";

const fetchAddressSuggestions = async (
  query: string,
  field: AddressSuggestionField,
  signal?: AbortSignal,
): Promise<ApiResult<AddressSuggestion[]>> => {
  const params = new URLSearchParams({
    limit: "5",
    q: query,
  });

  params.set("field", field);

  return apiRequest<AddressSuggestion[]>(
    `/api/geocoding/suggestions?${params.toString()}`,
    { signal },
  );
};

export const geocodingApi = {
  suggestions(
    query: string,
    field: AddressSuggestionField,
    signal?: AbortSignal,
  ): Promise<ApiResult<AddressSuggestion[]>> {
    return fetchAddressSuggestions(query, field, signal);
  },
};
