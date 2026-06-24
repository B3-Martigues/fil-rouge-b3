export const toBackendId = (value: number) => Math.abs(value);

export const toLocalApiId = (value: number | null | undefined) =>
  value ? -Math.abs(value) : undefined;
