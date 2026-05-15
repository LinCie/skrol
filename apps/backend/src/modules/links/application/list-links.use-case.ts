import type { Link } from "@/modules/links/domain/link.entity";
import type { LinksRepository } from "./links.repository";

export interface ListLinksInput {
  ownerUserId: string;
  limit: number;
  cursor?: string;
}

export interface ListLinksResult {
  items: Link[];
  nextCursor: string | null;
}

export class ListLinksUseCase {
  constructor(private readonly repository: LinksRepository) {}

  async execute(input: ListLinksInput): Promise<ListLinksResult> {
    return this.repository.listByOwner(input);
  }
}
