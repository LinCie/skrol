import type { Link } from "@/modules/links/domain/link.entity";

export interface RedirectLinkLookupPort {
  findByCode(code: string): Promise<Link | null>;
}
