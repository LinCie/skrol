import {
	getDatabase,
	type PostgresClient,
} from "@/shared/infrastructure/database";
import { Link } from "@/modules/links/domain/link.entity";
import type {
	CreateLinkRepositoryInput,
	ListLinksByOwnerInput,
	ListLinksByOwnerResult,
	LinksRepository,
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
}
