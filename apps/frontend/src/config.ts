const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const rawApiBaseUrl = stripTrailingSlash(
  process.env.NEXT_PUBLIC_API_BASE_URL || "",
);

const apiBaseWithoutVersion = rawApiBaseUrl.replace(/\/api\/v1$/, "");

export const API_BASE_URL = apiBaseWithoutVersion;
export const API_VERSION_PREFIX = "/api/v1";

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${API_VERSION_PREFIX}${normalizedPath}`;
}

export const API_ROUTES = {
  signup: apiUrl("/signup"),
  signin: apiUrl("/signin"),
  onramp: apiUrl("/onramp"),
  order: apiUrl("/order"),
  cancel: apiUrl("/cancel"),
  balance: apiUrl("/balance"),
  orders: (market: string) =>
    `${apiUrl("/orders")}?market=${encodeURIComponent(market)}`,
  depth: (market: string) =>
    `${apiUrl("/depth")}?market=${encodeURIComponent(market)}`,
  stats: (market: string) =>
    `${apiUrl("/stats")}?market=${encodeURIComponent(market)}`,
  position: (market: string) =>
    `${apiUrl("/position")}?market=${encodeURIComponent(market)}`,
  fills: (market: string) =>
    `${apiUrl("/fills")}?market=${encodeURIComponent(market)}`,
};

const envWsBaseUrl = process.env.NEXT_PUBLIC_WS_BASE_URL
  ? stripTrailingSlash(process.env.NEXT_PUBLIC_WS_BASE_URL)
  : "";

export const WS_BASE_URL =
  envWsBaseUrl ||
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8080`
    : "ws://127.0.0.1:8080");
