import { domainToASCII } from "node:url";

export interface DomainBlocklistEntry {
  domain: string;
  disabledAt: Date | null;
}

export function normalizeHostForBlocklist(host: string): string {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "");
  const ascii = domainToASCII(normalized);
  return ascii || normalized;
}

export function domainMatchesBlocklist(
  host: string,
  rows: Array<DomainBlocklistEntry>,
): boolean {
  const normalizedHost = normalizeHostForBlocklist(host);

  return rows.some((row) => {
    if (row.disabledAt) {
      return false;
    }

    const blocked = normalizeHostForBlocklist(row.domain);
    return normalizedHost === blocked || normalizedHost.endsWith(`.${blocked}`);
  });
}
