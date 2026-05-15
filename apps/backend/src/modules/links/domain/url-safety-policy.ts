import { isIP } from "node:net";

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (part.length === 0 || !/^\d+$/.test(part)) {
      return Number.NaN;
    }

    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255
      ? value
      : Number.NaN;
  });

  return octets.some(Number.isNaN) ? null : octets;
}

function ipv4ToHextets(octets: number[]): [string, string] {
  const [o0 = 0, o1 = 0, o2 = 0, o3 = 0] = octets;
  const high = ((o0 << 8) | o1).toString(16);
  const low = ((o2 << 8) | o3).toString(16);
  return [high, low];
}

function expandIpv6(address: string): string[] | null {
  const normalized = (address.toLowerCase().split("%", 1)[0] ?? "").trim();
  if (!normalized) {
    return null;
  }

  const lastColon = normalized.lastIndexOf(":");

  let working = normalized;
  if (normalized.includes(".")) {
    if (lastColon < 0) {
      return null;
    }

    const ipv4 = parseIpv4(normalized.slice(lastColon + 1));
    if (!ipv4) {
      return null;
    }

    const [high, low] = ipv4ToHextets(ipv4);
    working = `${normalized.slice(0, lastColon)}:${high}:${low}`;
  }

  const hasCompression = working.includes("::");
  if (working.indexOf("::") !== working.lastIndexOf("::")) {
    return null;
  }

  const parts = hasCompression ? working.split("::") : [working, ""];
  const leftRaw = parts[0] ?? "";
  const rightRaw = parts[1] ?? "";
  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];

  if (!hasCompression && left.length !== 8) {
    return null;
  }

  if (hasCompression && left.length + right.length > 8) {
    return null;
  }

  const zerosToInsert = hasCompression ? 8 - (left.length + right.length) : 0;
  const hextets = [
    ...left,
    ...Array.from({ length: zerosToInsert }, () => "0"),
    ...right,
  ];

  if (hextets.length !== 8) {
    return null;
  }

  return hextets;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b = 0] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isUnsafeIpv6Address(hostname: string): boolean {
  const hextets = expandIpv6(hostname);
  if (!hextets) {
    return false;
  }

  const values = hextets.map((part) => Number.parseInt(part, 16));
  if (values.some((value) => Number.isNaN(value))) {
    return false;
  }

  const [v0 = 0, , , , , v5 = 0, v6 = 0, v7 = 0] = values;

  const isUnspecified = values.every((value) => value === 0);
  const isLoopback =
    values.slice(0, 7).every((value) => value === 0) && v7 === 1;
  const isUniqueLocal = (v0 & 0xfe00) === 0xfc00;
  const isLinkLocal = (v0 & 0xffc0) === 0xfe80;
  const isSiteLocal = (v0 & 0xffc0) === 0xfec0;
  const isIpv4Mapped =
    values.slice(0, 5).every((value) => value === 0) && v5 === 0xffff;

  if (
    isUnspecified ||
    isLoopback ||
    isUniqueLocal ||
    isLinkLocal ||
    isSiteLocal
  ) {
    return true;
  }

  if (isIpv4Mapped) {
    const mappedIpv4 = [
      (v6 >> 8) & 0xff,
      v6 & 0xff,
      (v7 >> 8) & 0xff,
      v7 & 0xff,
    ];
    return isPrivateIpv4(mappedIpv4);
  }

  return false;
}

function isUnsafeHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  if (isIP(normalized) === 4) {
    const octets = parseIpv4(normalized);
    return octets ? isPrivateIpv4(octets) : true;
  }

  if (isIP(normalized) === 6) {
    return isUnsafeIpv6Address(normalized);
  }

  return false;
}

export type DestinationUrlValidationErrorCode = "invalid_url" | "unsafe_url";

export type DestinationUrlValidationResult =
  | { ok: true; destination: URL }
  | { ok: false; code: DestinationUrlValidationErrorCode };

export function validateDestinationUrl(
  rawUrl: string,
): DestinationUrlValidationResult {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, code: "invalid_url" };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { ok: false, code: "unsafe_url" };
  }

  if (!parsed.hostname || parsed.username || parsed.password) {
    return { ok: false, code: "unsafe_url" };
  }

  if (isUnsafeHostname(parsed.hostname)) {
    return { ok: false, code: "unsafe_url" };
  }

  return { ok: true, destination: parsed };
}
