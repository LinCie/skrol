import { isReservedRouteSegment } from "@/modules/links/constants/reserved-routes";

const ALIAS_REGEX = /^[a-z0-9_-]{3,64}$/;

export function normalizeAlias(input: string): string {
  return input.trim().toLowerCase();
}

export type AliasValidationErrorCode = "validation_error" | "reserved_alias";

export type AliasValidationResult =
  | { ok: true; alias: string }
  | { ok: false; code: AliasValidationErrorCode };

export function validateAlias(input: string): AliasValidationResult {
  const normalized = normalizeAlias(input);

  if (!ALIAS_REGEX.test(normalized)) {
    return { ok: false, code: "validation_error" };
  }

  if (isReservedRouteSegment(normalized)) {
    return { ok: false, code: "reserved_alias" };
  }

  return { ok: true, alias: normalized };
}
