import { describe, expect, it } from "bun:test";
import { GetLinkDetailUseCase } from "@/modules/links/application/get-link-detail.use-case";
import { Link } from "@/modules/links/domain/link.entity";
import { ListLinksUseCase } from "@/modules/links/application/list-links.use-case";
import type { LinksRepository } from "@/modules/links/application/links.repository";
import { LinksRepositoryImpl } from "@/modules/links/infrastructure/repositories/links.repository.impl";

const ownerA = "user_aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ownerB = "user_bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

const ownerAFirstId = "11111111-1111-4111-8111-111111111111";
const ownerASecondId = "22222222-2222-4222-8222-222222222222";
const ownerBId = "33333333-3333-4333-8333-333333333333";
const deletedOwnerAId = "44444444-4444-4444-8444-444444444444";

const fixtureLinks = [
	linkFixture({
		id: ownerAFirstId,
		userId: ownerA,
		code: "owner-a-first",
		createdAt: new Date("2026-05-15T12:00:00.000Z"),
	}),
	linkFixture({
		id: ownerBId,
		userId: ownerB,
		code: "owner-b",
		createdAt: new Date("2026-05-15T12:01:00.000Z"),
	}),
	linkFixture({
		id: ownerASecondId,
		userId: ownerA,
		code: "owner-a-second",
		createdAt: new Date("2026-05-15T12:02:00.000Z"),
	}),
	linkFixture({
		id: deletedOwnerAId,
		userId: ownerA,
		code: "owner-a-deleted",
		createdAt: new Date("2026-05-15T12:03:00.000Z"),
		deletedAt: new Date("2026-05-15T12:04:00.000Z"),
	}),
];

describe("owner-scoped link use cases", () => {
	it("lists only non-deleted links owned by the principal", async () => {
		const repository = new StrictLinksRepositoryFake(fixtureLinks);
		const useCase = new ListLinksUseCase(repository);

		const result = await useCase.execute({ ownerUserId: ownerA, limit: 20 });

		expect(repository.listInputs).toEqual([
			{ ownerUserId: ownerA, limit: 20, cursor: undefined },
		]);
		expect(result.items.map((link) => link.id)).toEqual([
			ownerASecondId,
			ownerAFirstId,
		]);
		expect(result.nextCursor).toBeNull();
	});

	it("returns detail only for a link owned by the principal", async () => {
		const repository = new StrictLinksRepositoryFake(fixtureLinks);
		const useCase = new GetLinkDetailUseCase(repository);

		const owned = await useCase.execute({ id: ownerAFirstId, ownerUserId: ownerA });
		const crossOwner = await useCase.execute({ id: ownerBId, ownerUserId: ownerA });

		expect(owned?.id).toBe(ownerAFirstId);
		expect(crossOwner).toBeNull();
		expect(repository.detailInputs).toEqual([
			{ id: ownerAFirstId, ownerUserId: ownerA },
			{ id: ownerBId, ownerUserId: ownerA },
		]);
	});
});

describe("LinksRepositoryImpl owner-scoped queries", () => {
	it("filters list queries by owner and excludes soft-deleted links", async () => {
		const repository = new LinksRepositoryImpl(
			new StrictKyselyFake(fixtureLinks) as never,
		);

		const result = await repository.listByOwner({ ownerUserId: ownerA, limit: 20 });

		expect(result.items.map((link) => link.id)).toEqual([
			ownerASecondId,
			ownerAFirstId,
		]);
		expect(result.nextCursor).toBeNull();
	});

	it("returns detail only when the requested owner owns the link", async () => {
		const repository = new LinksRepositoryImpl(
			new StrictKyselyFake(fixtureLinks) as never,
		);

		const owned = await repository.findByIdForOwner(ownerAFirstId, ownerA);
		const crossOwner = await repository.findByIdForOwner(ownerBId, ownerA);

		expect(owned?.id).toBe(ownerAFirstId);
		expect(crossOwner).toBeNull();
	});

	it("returns a next cursor when one more owned item exists", async () => {
		const repository = new LinksRepositoryImpl(
			new StrictKyselyFake(fixtureLinks) as never,
		);

		const result = await repository.listByOwner({ ownerUserId: ownerA, limit: 1 });

		expect(result.items.map((link) => link.id)).toEqual([ownerASecondId]);
		expect(result.nextCursor).toBe(ownerASecondId);
	});

	it("uses the returned next cursor to fetch the following page", async () => {
		const repository = new LinksRepositoryImpl(
			new StrictKyselyFake(fixtureLinks) as never,
		);

		const firstPage = await repository.listByOwner({
			ownerUserId: ownerA,
			limit: 1,
		});
		const secondPage = await repository.listByOwner({
			ownerUserId: ownerA,
			limit: 1,
			cursor: firstPage.nextCursor ?? undefined,
		});

		expect(secondPage.items.map((link) => link.id)).toEqual([ownerAFirstId]);
		expect(secondPage.nextCursor).toBeNull();
	});

	it("starts listing after an owned cursor", async () => {
		const repository = new LinksRepositoryImpl(
			new StrictKyselyFake(fixtureLinks) as never,
		);

		const result = await repository.listByOwner({
			ownerUserId: ownerA,
			limit: 20,
			cursor: ownerASecondId,
		});

		expect(result.items.map((link) => link.id)).toEqual([ownerAFirstId]);
		expect(result.nextCursor).toBeNull();
	});
});

function linkFixture(input: {
	id: string;
	userId: string;
	code: string;
	createdAt: Date;
	deletedAt?: Date | null;
}): Link {
	return Link.create({
		id: input.id,
		userId: input.userId,
		code: input.code,
		createdViaApiKeyId: null,
		destinationUrl: `https://example.com/${input.code}`,
		title: input.code,
		status: "active",
		expiresAt: null,
		deletedAt: input.deletedAt ?? null,
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
	});
}

class StrictLinksRepositoryFake implements LinksRepository {
	readonly listInputs: Array<{
		ownerUserId: string;
		limit: number;
		cursor?: string;
	}> = [];
	readonly detailInputs: Array<{ id: string; ownerUserId: string }> = [];

	constructor(private readonly links: Link[]) {}

	async codeExists(): Promise<boolean> {
		throw new Error("not used by owner-scoped use cases");
	}

	async findByCode(): Promise<Link | null> {
		throw new Error("not used by owner-scoped use cases");
	}

	async createLink(): Promise<Link> {
		throw new Error("not used by owner-scoped use cases");
	}

	async listByOwner(input: {
		ownerUserId: string;
		limit: number;
		cursor?: string;
	}): Promise<{ items: Link[]; nextCursor: string | null }> {
		this.listInputs.push(input);

		const visibleLinks = this.links
			.filter((link) => link.userId === input.ownerUserId && !link.deletedAt)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		const startIndex = input.cursor
			? visibleLinks.findIndex((link) => link.id === input.cursor) + 1
			: 0;
		const page = visibleLinks.slice(startIndex, startIndex + input.limit + 1);

		return {
			items: page.slice(0, input.limit),
			nextCursor: page.length > input.limit ? page[input.limit]?.id ?? null : null,
		};
	}

	async findByIdForOwner(id: string, ownerUserId: string): Promise<Link | null> {
		this.detailInputs.push({ id, ownerUserId });

		return (
			this.links.find(
				(link) =>
					link.id === id && link.userId === ownerUserId && !link.deletedAt,
			) ?? null
		);
	}
}

class StrictKyselyFake {
	constructor(private readonly links: Link[]) {}

	selectFrom(table: string): StrictSelectQueryFake {
		if (table !== "links") {
			throw new Error(`unexpected table ${table}`);
		}

		return new StrictSelectQueryFake([...this.links]);
	}
}

type WhereOperator = "=" | "is" | "<";

class StrictSelectQueryFake {
	private rows: Link[];
	private selectedIdOnly = false;

	constructor(rows: Link[]) {
		this.rows = rows;
	}

	select(selection: string): this {
		if (selection !== "id" && selection !== "createdAt") {
			throw new Error(`unexpected selection ${selection}`);
		}

		this.selectedIdOnly = selection === "id";
		return this;
	}

	selectAll(): this {
		this.selectedIdOnly = false;
		return this;
	}

	where(column: string, operator: WhereOperator, value: string | Date | null): this {
		if (operator === "=" && column === "userId" && typeof value === "string") {
			this.rows = this.rows.filter((row) => row.userId === value);
			return this;
		}

		if (operator === "=" && column === "id" && typeof value === "string") {
			this.rows = this.rows.filter((row) => row.id === value);
			return this;
		}

		if (operator === "is" && column === "deletedAt" && value === null) {
			this.rows = this.rows.filter((row) => row.deletedAt === null);
			return this;
		}

		if (operator === "<" && column === "createdAt" && value instanceof Date) {
			this.rows = this.rows.filter(
				(row) => row.createdAt.getTime() < value.getTime(),
			);
			return this;
		}

		throw new Error(`unexpected where ${column} ${operator} ${value}`);
	}

	orderBy(column: string, direction: string): this {
		if (column !== "createdAt" || direction !== "desc") {
			throw new Error(`unexpected order ${column} ${direction}`);
		}

		this.rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		return this;
	}

	limit(count: number): this {
		this.rows = this.rows.slice(0, count);
		return this;
	}

	async execute(): Promise<Array<Link | { id: string }>> {
		return this.selectedIdOnly ? this.rows.map((row) => ({ id: row.id })) : this.rows;
	}

	async executeTakeFirst(): Promise<Link | { id: string } | undefined> {
		return (await this.execute())[0];
	}
}
