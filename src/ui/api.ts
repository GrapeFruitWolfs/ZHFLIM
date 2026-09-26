let sessionToken = "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: unknown,
  ) {
    super(message);
  }
}

export const setSessionToken = (token: string) => {
  sessionToken = token;
};

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("content-type", "application/json");
  if (options.method && options.method !== "GET")
    headers.set("x-studio-token", sessionToken);
  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const message =
      typeof data === "object" && data ? data.message || data.error : data;
    throw new ApiError(
      typeof message === "string" ? message : "操作未完成，请重试。",
      response.status,
      data,
    );
  }
  return data as T;
}

export const post = <T>(path: string, body?: unknown, signal?: AbortSignal) =>
  api<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "操作未完成，请重试。";
