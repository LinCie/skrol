const RESERVED_SEGMENTS = new Set([
  "admin",
  "app",
  "api",
  "auth",
  "dashboard",
  "health",
  "login",
  "logout",
  "settings",
  "signup",
  "status",
]);

export function isReservedRouteSegment(value: string): boolean {
  return RESERVED_SEGMENTS.has(value.toLowerCase());
}

export { RESERVED_SEGMENTS };
