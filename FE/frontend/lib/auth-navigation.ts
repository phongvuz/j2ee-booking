export type AuthMode = "login" | "register";

export function authModalUrl(pathname: string, search: string, mode: AuthMode | null) {
  const params = new URLSearchParams(search);
  if (mode) params.set("auth", mode);
  else {
    params.delete("auth");
    params.delete("next");
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function safeAuthReturnTo(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return null;
  const url = new URL(value, "https://nomad.local");
  if (url.origin !== "https://nomad.local" || ["/login", "/register"].includes(url.pathname)) return null;
  return `${authModalUrl(url.pathname, url.search, null)}${url.hash}`;
}
