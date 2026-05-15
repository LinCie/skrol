import type { Link } from "@/modules/links/domain/link.entity";

export interface CreateLinkRepositoryInput {
  userId: string;
  createdViaApiKeyId: string | null;
  code: string;
  destinationUrl: string;
  title: string | null;
  status: "active";
  expiresAt: Date | null;
  deletedAt: Date | null;
}

export interface ListLinksByOwnerInput {
  ownerUserId: string;
  limit: number;
  cursor?: string;
}

export interface ListLinksByOwnerResult {
  items: Link[];
  nextCursor: string | null;
}

export interface LinksRepository {
  codeExists(code: string): Promise<boolean>;
  findByCode(code: string): Promise<Link | null>;
  createLink(input: CreateLinkRepositoryInput): Promise<Link>;
  listByOwner(input: ListLinksByOwnerInput): Promise<ListLinksByOwnerResult>;
  findByIdForOwner(id: string, ownerUserId: string): Promise<Link | null>;
}
