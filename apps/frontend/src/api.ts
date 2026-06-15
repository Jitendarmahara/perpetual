export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(data: unknown, fallback: string) {
  if (isJsonObject(data) && typeof data.error === "string") {
    return data.error;
  }

  if (isJsonObject(data) && typeof data.message === "string") {
    return data.message;
  }

  return fallback;
}

export function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(input, init);
  const rawBody = await response.text();
  let data: unknown = null;

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new ApiError(
        `Backend returned an invalid response (${response.status}).`,
        response.status,
        rawBody,
      );
    }
  }

  const backendFailed = isJsonObject(data) && data.success === false;
  if (!response.ok || backendFailed) {
    throw new ApiError(
      getErrorMessage(data, `Request failed with status ${response.status}.`),
      response.status,
      data,
    );
  }

  return data as T;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
