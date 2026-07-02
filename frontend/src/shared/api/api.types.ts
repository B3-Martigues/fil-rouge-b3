export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "network_error"
  | "server_error";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ApiResult<Data> =
  | {
      ok: true;
      data: Data;
    }
  | {
      ok: false;
      error: ApiError;
    };

export const createApiSuccess = <Data>(data: Data): ApiResult<Data> => ({
  ok: true,
  data,
});

export const createApiError = (
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): ApiResult<never> => ({
  ok: false,
  error: {
    code,
    message,
    fieldErrors,
  },
});
