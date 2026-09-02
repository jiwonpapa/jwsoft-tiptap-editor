/** Shared host authentication adapter. Cookie authentication remains available without storage. */
export function authorizationHeaders(): HeadersInit {
  try {
    const token = window.localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
