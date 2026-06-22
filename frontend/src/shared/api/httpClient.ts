import { createApiError, createApiSuccess, type ApiResult } from "./api.types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "X-CSRF-Token";
let csrfTokenMemory: string | null = null;

type RequestOptions = Omit<RequestInit, "body" | "credentials"> & {
  body?: unknown;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
};

type MaybeCsrfBody = {
  csrf_token?: unknown;
};

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const buildUrl = (path: string) =>
  path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const getCookieValue = (name: string) => {
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${encodeURIComponent(name)}=`));

  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
};

const getCsrfToken = () => getCookieValue(CSRF_COOKIE_NAME) ?? csrfTokenMemory;

const rememberCsrfToken = (value: string | null) => {
  if (value) {
    csrfTokenMemory = value;
  }
};

const rememberCsrfFromBody = (body: unknown) => {
  const csrfToken = (body as MaybeCsrfBody | null)?.csrf_token;
  if (typeof csrfToken === "string") {
    rememberCsrfToken(csrfToken);
  }
};

const toErrorMessage = async (response: Response) => {
  const fallback = response.statusText || "Erreur serveur";

  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
};

const toErrorCode = (status: number) => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status >= 400 && status < 500) return "validation_error";
  return "server_error";
};

export async function apiRequest<Data>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<Data>> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const csrfToken = getCsrfToken();
  if (csrfToken && unsafeMethods.has(method)) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
      headers,
      method,
    });

    if (response.status === 204) {
      return createApiSuccess(null as Data);
    }

    if (!response.ok) {
      return createApiError(toErrorCode(response.status), await toErrorMessage(response));
    }

    rememberCsrfToken(response.headers.get(CSRF_HEADER_NAME));
    const data = (await response.json()) as Data;
    rememberCsrfFromBody(data);
    return createApiSuccess(data);
  } catch {
    return createApiError("network_error", "Impossible de joindre le serveur");
  }
}
