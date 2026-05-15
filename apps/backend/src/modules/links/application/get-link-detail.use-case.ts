import type { Link } from "@/modules/links/domain/link.entity";
import type { LinksRepository } from "./links.repository";

export interface GetLinkDetailInput {
  id: string;
  ownerUserId: string;
}

export class GetLinkDetailUseCase {
  constructor(private readonly repository: LinksRepository) {}

  async execute(input: GetLinkDetailInput): Promise<Link | null> {
    return this.repository.findByIdForOwner(input.id, input.ownerUserId);
  }
}
