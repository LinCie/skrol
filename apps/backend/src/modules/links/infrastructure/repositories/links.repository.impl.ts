import {
	getDatabase,
	type PostgresClient,
} from "@/shared/infrastructure/database";
import type { Links } from "@/shared/infrastructure/database/types";
import { Link } from "@/modules/links/domain/link.entity";
import type { Updateable } from "kysely";
import type {
	CreateLinkAuditLogInput,
	CreateLinkRepositoryInput,
	ListLinksByOwnerInput,
	ListLinksByOwnerResult,
	LinksRepository,
	UpdateLinkRepositoryInput,
} from "../../application/links.repository";

export class LinksRepositoryImpl implements LinksRepository {
	constructor(private readonly db: PostgresClient = getDatabase()) {}

	async codeExists(code: string): Promise<boolean> {
		const row = await this.db
			.selectFrom("links")
			.select("id")
			.where("code", "=", code)
			.executeTakeFirst();

		return Boolean(row);
	}

	async createLink(input: CreateLinkRepositoryInput): Promise<Link> {
		const row = await this.db
			.insertInto("links")
			.values(input)
			.returningAll()
			.executeTakeFirstOrThrow();

		return Link.create(row);
	}

	async findByCode(code: string): Promise<Link | null> {
		const row = await this.db
			.selectFrom("links")
			.selectAll()
			.where("code", "=", code)
			.executeTakeFirst();

		return row ? Link.create(row) : null;
	}

	async listByOwner(
		input: ListLinksByOwnerInput,
	): Promise<ListLinksByOwnerResult> {
		let query = this.db
			.selectFrom("links")
			.selectAll()
			.where("userId", "=", input.ownerUserId)
			.where("deletedAt", "is", null);

		if (input.cursor) {
			const cursorRow = await this.db
				.selectFrom("links")
				.select(["id", "createdAt"])
				.where("id", "=", input.cursor)
				.where("userId", "=", input.ownerUserId)
				.where("deletedAt", "is", null)
				.executeTakeFirst();

			if (!cursorRow) {
				return { items: [], nextCursor: null };
			}

			query = query.where(({ eb, or, and }) =>
				or([
					eb("createdAt", "<", cursorRow.createdAt),
					and([
						eb("createdAt", "=", cursorRow.createdAt),
						eb("id", "<", cursorRow.id),
					]),
				]),
			);
		}

		const rows = await query
			.orderBy("createdAt", "desc")
			.orderBy("id", "desc")
			.limit(input.limit + 1)
			.execute();
		const items = rows.slice(0, input.limit).map((row) => Link.create(row));
		const nextCursor = rows.length > input.limit ? items.at(-1)?.id ?? null : null;

		return { items, nextCursor };
	}

	async findByIdForOwner(id: string, ownerUserId: string): Promise<Link | null> {
		const row = await this.db
			.selectFrom("links")
			.selectAll()
			.where("id", "=", id)
			.where("userId", "=", ownerUserId)
			.where("deletedAt", "is", null)
			.executeTakeFirst();

		return row ? Link.create(row) : null;
	}

	async findOwnedLinkForRead(input: {
		userId: string;
		linkId: string;
	}): Promise<Link | null> {
		const row = await this.db
			.selectFrom("links")
			.selectAll()
			.where("id", "=", input.linkId)
			.where("userId", "=", input.userId)
			.executeTakeFirst();

		return row ? Link.create(row) : null;
	}

	async updateLinkForOwner(
		input: UpdateLinkRepositoryInput,
	): Promise<Link | null> {
		const patch: Updateable<Links> = { updatedAt: input.updatedAt };
		if ("title" in input) patch.title = input.title ?? null;
		if ("destinationUrl" in input) patch.destinationUrl = input.destinationUrl;
		if ("expiresAt" in input) patch.expiresAt = input.expiresAt ?? null;
		if ("status" in input) patch.status = input.status;

		const row = await this.db
			.updateTable("links")
			.set(patch)
			.where("id", "=", input.id)
			.where("userId", "=", input.userId)
			.where("deletedAt", "is", null)
			.returningAll()
			.executeTakeFirst();

		return row ? Link.create(row) : null;
	}

	async softDeleteLinkForOwner(input: {
		id: string;
		userId: string;
		deletedAt: Date;
	}): Promise<Link | null> {
		const row = await this.db
			.updateTable("links")
			.set({
				status: "deleted",
				deletedAt: input.deletedAt,
				updatedAt: input.deletedAt,
			})
			.where("id", "=", input.id)
			.where("userId", "=", input.userId)
			.where("deletedAt", "is", null)
			.returningAll()
			.executeTakeFirst();

		return row ? Link.create(row) : null;
	}

	async createAuditLog(input: CreateLinkAuditLogInput): Promise<void> {
		await this.db
			.insertInto("linkAuditLogs")
			.values({
				linkId: input.linkId,
				userId: input.userId,
				actorApiKeyId: input.actorApiKeyId,
				action: input.action,
				previousValue: JSON.stringify(input.previousValue),
				newValue: JSON.stringify(input.newValue),
				createdAt: input.createdAt,
			})
			.execute();
	}
}
