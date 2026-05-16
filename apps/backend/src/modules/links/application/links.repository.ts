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

export interface UpdateLinkRepositoryInput {
  id: string;
  userId: string;
  title?: string | null;
  destinationUrl?: string;
  expiresAt?: Date | null;
  status?: "active" | "disabled";
  updatedAt: Date;
}

export interface CreateLinkAuditLogInput {
  linkId: string;
  userId: string;
  actorApiKeyId: string | null;
  action: string;
  previousValue: unknown;
  newValue: unknown;
  createdAt: Date;
}

export interface LinksRepository {
  codeExists(code: string): Promise<boolean>;
  findByCode(code: string): Promise<Link | null>;
  createLink(input: CreateLinkRepositoryInput): Promise<Link>;
  listByOwner(input: ListLinksByOwnerInput): Promise<ListLinksByOwnerResult>;
  findByIdForOwner(id: string, ownerUserId: string): Promise<Link | null>;
  findOwnedLinkForRead(input: {
    userId: string;
    linkId: string;
  }): Promise<Link | null>;
  updateLinkForOwner(input: UpdateLinkRepositoryInput): Promise<Link | null>;
  softDeleteLinkForOwner(input: {
    id: string;
    userId: string;
    deletedAt: Date;
  }): Promise<Link | null>;
  createAuditLog(input: CreateLinkAuditLogInput): Promise<void>;
}
