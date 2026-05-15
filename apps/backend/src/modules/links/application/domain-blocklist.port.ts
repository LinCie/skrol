import type { DomainBlocklistEntry } from "@/modules/links/domain/domain-blocklist-policy";

export interface DomainBlocklistPort {
  load(): Promise<Array<DomainBlocklistEntry>>;
}
