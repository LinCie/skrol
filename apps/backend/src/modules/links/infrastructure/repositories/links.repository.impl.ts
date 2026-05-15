import {
	getDatabase,
	type PostgresClient,
} from "@/shared/infrastructure/database";
import { Link } from "@/modules/links/domain/link.entity";
import type {
	CreateLinkRepositoryInput,
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
}
